import { NextRequest, NextResponse } from 'next/server';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const MAX_CONTENT_CHARS = 8000; // ~2k tokens per URL

/**
 * Strip HTML tags and clean up whitespace from raw HTML string.
 * Extracts <title> and readable body text without external dependencies.
 */
function parseHtml(html: string): { title: string; content: string } {
  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    : 'Untitled Page';

  // Remove script, style, nav, footer, header, aside blocks entirely
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')          // Strip remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')           // Collapse multiple spaces
    .replace(/\n{3,}/g, '\n\n')        // Collapse multiple newlines
    .trim();

  // Truncate to MAX_CONTENT_CHARS
  if (body.length > MAX_CONTENT_CHARS) {
    body = body.substring(0, MAX_CONTENT_CHARS) + '... [content truncated]';
  }

  return { title, content: body };
}

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array is required' }, { status: 400 });
    }

    // Limit to 5 URLs per request
    const urlsToFetch = urls.slice(0, 5);

    const results = await Promise.allSettled(
      urlsToFetch.map(async (url: string) => {
        // Basic URL validation
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          throw new Error(`Invalid URL: ${url}`);
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
        }

        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; BrainSyncBot/1.0; +http://brainsync.ai)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          // 10 second timeout
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
          throw new Error(`Unsupported content type: ${contentType}`);
        }

        const html = await res.text();
        const { title, content } = parseHtml(html);

        return { url, title, content, success: true };
      })
    );

    const pages = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: urlsToFetch[i],
          title: 'Failed to load',
          content: '',
          success: false,
          error: result.reason?.message || 'Unable to fetch page content',
        };
      }
    });

    return NextResponse.json({ pages });
  } catch (error: any) {
    console.error('Scrape API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
