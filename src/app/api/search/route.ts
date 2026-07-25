import { NextRequest, NextResponse } from 'next/server';

// Allow fetching external websites even if SSL certificates have expired or have self-signed issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const MAX_CONTENT_CHARS = 6000;
const MAX_RESULTS = 3;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parse DuckDuckGo Lite HTML to extract result URLs and snippets
 */
function parseDDGResults(html: string): Array<{ url: string; title: string; snippet: string }> {
  const results: Array<{ url: string; title: string; snippet: string }> = [];

  // Match result links from DuckDuckGo HTML (class="result__a", class="result-link", or any result link with href)
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null && results.length < MAX_RESULTS) {
    let rawHref = match[1];
    let title = stripHtml(match[2]).trim();

    // Extract actual target URL from DuckDuckGo redirect link /l/?uddg=...
    if (rawHref.includes('uddg=')) {
      const uddgMatch = rawHref.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        try {
          rawHref = decodeURIComponent(uddgMatch[1]);
        } catch {}
      }
    }

    if (
      rawHref.startsWith('http') &&
      !rawHref.includes('duckduckgo.com') &&
      title.length > 2 &&
      !title.toLowerCase().includes('duckduckgo')
    ) {
      // Avoid duplicate URLs
      if (!results.some((r) => r.url === rawHref)) {
        results.push({ url: rawHref, title, snippet: '' });
      }
    }
  }

  // Extract snippets: class="result__snippet", class="result-snippet", etc.
  const snippetRegex = /<(td|div|span)[^>]+class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/(td|div|span)>/gi;
  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    const text = stripHtml(match[2]).trim();
    if (text.length > 0) snippets.push(text);
  }

  results.forEach((r, i) => {
    if (snippets[i]) r.snippet = snippets[i];
  });

  return results;
}

/**
 * Fetch and extract readable text from a URL
 */
async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return '';

    let body = await res.text();
    body = body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return body.substring(0, MAX_CONTENT_CHARS);
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const cleanQuery = query.replace(/^[\s💡🔍📝]+/, '').trim();
    const searchQuery = encodeURIComponent(cleanQuery);

    let searchResults: Array<{ url: string; title: string; snippet: string }> = [];

    // Attempt 1: Fetch DuckDuckGo HTML
    try {
      const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${searchQuery}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (ddgRes.ok) {
        const ddgHtml = await ddgRes.text();
        searchResults = parseDDGResults(ddgHtml);
      }
    } catch (ddgErr) {
      console.warn('DuckDuckGo HTML search error:', ddgErr);
    }

    // Attempt 2: Wikipedia Search API fallback if DDG returned no results
    if (searchResults.length === 0) {
      try {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&origin=*`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const items = wikiData.query?.search || [];
          searchResults = items.slice(0, 3).map((item: any) => ({
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
            title: item.title,
            snippet: stripHtml(item.snippet),
          }));
        }
      } catch (wikiErr) {
        console.warn('Wikipedia API fallback error:', wikiErr);
      }
    }

    if (searchResults.length === 0) {
      return NextResponse.json({ results: [], summary: 'No search results found.' });
    }

    // Fetch full content for each result in parallel
    const pagesWithContent = await Promise.allSettled(
      searchResults.map(async (r) => {
        const content = await fetchPageContent(r.url);
        return { ...r, content: content || r.snippet };
      })
    );

    const results = pagesWithContent.map((p, i) => {
      if (p.status === 'fulfilled') return p.value;
      return { ...searchResults[i], content: searchResults[i].snippet };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Web search API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
