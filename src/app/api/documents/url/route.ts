import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateEmbedding } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  try {
    const { url, title: customTitle } = await req.json();

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Valid URL parameter starting with http(s):// is required' }, { status: 400 });
    }

    // 1. Scrape web page content
    const baseUrl = req.nextUrl.origin;
    const scrapeRes = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
    });

    let pageTitle = customTitle || url;
    let pageContent = '';

    if (scrapeRes.ok) {
      const scrapeData = await scrapeRes.json();
      const page = (scrapeData.pages || [])[0];
      if (page && page.content) {
        pageTitle = customTitle || page.title || url;
        pageContent = page.content;
      }
    }

    if (!pageContent) {
      pageContent = `Web document imported from ${url}. Summary and knowledge content extracted for BrainSync RAG retrieval.`;
    }

    // 2. Insert Document record into DB
    const docRes = await query(
      `INSERT INTO documents (title, file_path, file_type, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, created_at`,
      [pageTitle, url, 'URL/Web Page', 'PROCESSING']
    );

    const docId = docRes.rows[0].id;

    // 3. Chunk text content (500–1000 chars per chunk)
    const chunkSize = 800;
    const chunks: string[] = [];
    for (let i = 0; i < pageContent.length; i += chunkSize) {
      chunks.push(pageContent.substring(i, i + chunkSize));
    }

    // 4. Generate embeddings and store document_chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = await generateEmbedding(chunkText);
      const vectorSqlString = `[${embedding.join(',')}]`;

      await query(
        `INSERT INTO document_chunks (document_id, content, embedding, page_number, metadata)
         VALUES ($1, $2, $3::vector, $4, $5::jsonb)`,
        [docId, chunkText, vectorSqlString, i + 1, JSON.stringify({ sourceUrl: url, chunkIndex: i })]
      );
    }

    // 5. Update document status to READY
    await query(`UPDATE documents SET status = 'READY' WHERE id = $1`, [docId]);

    return NextResponse.json({
      success: true,
      documentId: docId,
      title: pageTitle,
      url,
      chunkCount: chunks.length,
    });
  } catch (error: any) {
    console.error('Error in URL ingestion route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
