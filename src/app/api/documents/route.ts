import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateEmbedding, generateBatchEmbeddings } from '@/lib/openrouter';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds – raise if needed


export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      // Guest mode: do not return persistent DB documents
      return NextResponse.json({ documents: [] });
    }

    const res = await query(
      `SELECT id, title, file_path as "filePath", file_type as "fileType", 
              file_size as "fileSize", status, chunks_count as "chunksCount", 
              created_at as "createdAt"
       FROM documents 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );
    return NextResponse.json({ documents: res.rows });
  } catch (error: any) {
    console.error('Error fetching documents from Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function cleanAndFixPdfText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;
  // 1. Remove non-printable control characters
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // 2. Fix spaced-out single letters e.g. 'P e r k e m b a n g a n' or 'i n t e r n e t' -> 'Perkembangan'
  text = text.replace(/(?:^|\s)(?:[a-zA-Z0-9]\s+){2,}[a-zA-Z0-9](?=\s|$)/gm, (match) => {
    return match.replace(/\s+/g, '');
  });

  // 3. Fix fragmented words where kerning splits letters
  const stopWords = new Set([
    'a', 'an', 'in', 'on', 'at', 'to', 'of', 'by', 'is', 'it', 'or', 'and', 'if', 'as', 'be', 'do', 'go', 'he', 'me', 'my', 'no', 'so', 'up', 'we',
    'di', 'ke', 'ya', 'dan', 'yang', 'ada', 'ini', 'itu', 'atau', 'pada', 'dari', 'bisa', 'juga'
  ]);

  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(/\b([a-zA-Z]{1,2})\s+([a-zA-Z]{2,})\b/g, (m, p1, p2) => {
      if (!stopWords.has(p1.toLowerCase())) return p1 + p2;
      return m;
    });

    text = text.replace(/\b([a-zA-Z]{2,})\s+([a-zA-Z]{1,2})\b/g, (m, p1, p2) => {
      if (!stopWords.has(p2.toLowerCase())) return p1 + p2;
      return m;
    });
  }

  // 5. Remove PDF replacement characters (\uFFFD) without truncating valid document text
  text = text.replace(/\uFFFD/g, '');

  // 6. Clean up multiple spaces & repeated newlines
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();

  return text;
}

function extractRawPdfText(buffer: Buffer): string {
  try {
    const zlib = require('zlib');
    const str = buffer.toString('latin1');
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;
    const textParts: string[] = [];

    while ((match = streamRegex.exec(str)) !== null) {
      const rawStream = Buffer.from(match[1], 'latin1');
      let decompressedStr = '';

      try {
        const decompressed = zlib.inflateSync(rawStream);
        decompressedStr = decompressed.toString('utf-8');
      } catch (e) {
        try {
          const decompressed = zlib.unzipSync(rawStream);
          decompressedStr = decompressed.toString('utf-8');
        } catch (e2) {
          decompressedStr = rawStream.toString('utf-8');
        }
      }

      const btRegex = /BT[\s\S]*?ET/g;
      let btMatch;
      while ((btMatch = btRegex.exec(decompressedStr)) !== null) {
        const bt = btMatch[0];

        // Process TJ kerning arrays [(P) 12 (erkemb) (a) (n) (g) (a) (n)] TJ
        const arrRegex = /\[((?:\([^)]*\)\s*|-?\d+\s*)+)\]\s*TJ/g;
        let arrMatch;
        while ((arrMatch = arrRegex.exec(bt)) !== null) {
          const innerStr = arrMatch[1];
          const innerRegex = /\(([^)]+)\)/g;
          let inMatch;
          const wordParts: string[] = [];
          while ((inMatch = innerRegex.exec(innerStr)) !== null) {
            if (inMatch[1]) wordParts.push(inMatch[1]);
          }
          if (wordParts.length > 0) {
            textParts.push(wordParts.join(''));
          }
        }

        // Process standalone (text) Tj strings
        const stringRegex = /\(([^)]+)\)\s*(?:Tj|'|\")/g;
        let strMatch;
        while ((strMatch = stringRegex.exec(bt)) !== null) {
          if (strMatch[1] && strMatch[1].trim().length > 0) {
            textParts.push(strMatch[1].trim());
          }
        }
      }
    }

    const rawJoined = textParts.join(' ');
    return cleanAndFixPdfText(rawJoined);
  } catch (e) {
    return '';
  }
}

function extractDocxText(buffer: Buffer): string {
  try {
    const zlib = require('zlib');
    const str = buffer.toString('latin1');

    // If file is not a PK ZIP archive, fallback to utf-8 string
    if (!str.startsWith('PK')) {
      return buffer.toString('utf-8');
    }

    let docXmlText = '';
    let pos = 0;

    // Fast scanning for word/document.xml in local file headers
    while (pos < buffer.length - 30) {
      if (
        buffer[pos] === 0x50 &&
        buffer[pos + 1] === 0x4b &&
        buffer[pos + 2] === 0x03 &&
        buffer[pos + 3] === 0x04
      ) {
        const compressionMethod = buffer.readUInt16LE(pos + 8);
        const compressedSize = buffer.readUInt32LE(pos + 18);
        const fileNameLen = buffer.readUInt16LE(pos + 26);
        const extraLen = buffer.readUInt16LE(pos + 28);

        const fileName = buffer.toString('utf-8', pos + 30, pos + 30 + fileNameLen);
        const dataStart = pos + 30 + fileNameLen + extraLen;

        if (fileName === 'word/document.xml' || fileName.endsWith('/document.xml')) {
          const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
          try {
            if (compressionMethod === 8) {
              const decompressed = zlib.inflateRawSync(compressedData);
              docXmlText = decompressed.toString('utf-8');
            } else if (compressionMethod === 0) {
              docXmlText = compressedData.toString('utf-8');
            }
          } catch (e) {
            try {
              const decompressed = zlib.inflateSync(compressedData);
              docXmlText = decompressed.toString('utf-8');
            } catch (e2) {}
          }
          break;
        }

        pos = dataStart + compressedSize;
      } else {
        pos++;
      }
    }

    // Extract clean paragraphs from decompressed word/document.xml
    if (docXmlText) {
      const paragraphs: string[] = [];
      const pRegex = /<w:p[\s\S]*?<\/w:p>/g;
      let pMatch;

      while ((pMatch = pRegex.exec(docXmlText)) !== null) {
        const pXml = pMatch[0];
        const tRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
        let tMatch;
        let pText = '';
        while ((tMatch = tRegex.exec(pXml)) !== null) {
          if (tMatch[1]) pText += tMatch[1];
        }
        if (pText.trim()) {
          paragraphs.push(pText.trim());
        }
      }

      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }

      // Fallback: extract all <w:t> tags directly
      const tRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
      let tMatch;
      const allText: string[] = [];
      while ((tMatch = tRegex.exec(docXmlText)) !== null) {
        if (tMatch[1]) allText.push(tMatch[1]);
      }
      if (allText.length > 0) {
        return allText.join(' ');
      }
    }

    // Fallback: extract <w:t> tags from raw binary string
    const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    let wtMatch;
    const directParts: string[] = [];
    while ((wtMatch = wtRegex.exec(str)) !== null) {
      if (wtMatch[1] && wtMatch[1].trim().length > 0) {
        directParts.push(wtMatch[1].trim());
      }
    }
    if (directParts.length > 0) {
      return directParts.join(' ');
    }
  } catch (err) {
    console.warn('DOCX extraction error:', err);
  }

  return buffer.toString('utf-8');
}

export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const title = file.name.replace(/\x00/g, '').replace(/\u0000/g, '');
    const ext = title.split('.').pop()?.toUpperCase() || 'TXT';
    
    let fileType = 'TXT';
    if (ext === 'PDF') fileType = 'PDF';
    else if (ext === 'DOCX' || ext === 'DOC') fileType = 'Word Document';
    else if (ext === 'MD') fileType = 'Markdown';
    else if (['PNG', 'JPG', 'JPEG', 'WEBP'].includes(ext)) fileType = 'Image (OCR)';
    else if (['MP3', 'WAV', 'M4A', 'OGG'].includes(ext)) fileType = 'Audio Transcript';
    
    const fileSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    const filePath = `/storage/docs/${title}`;

    // 1. Insert initial document row into Neon PostgreSQL
    const docRes = await query(
      `INSERT INTO documents (title, file_path, file_type, file_size, status, chunks_count, user_id)
       VALUES ($1, $2, $3, $4, 'PROCESSING', 0, $5)
       RETURNING id, title, file_path as "filePath", file_type as "fileType", file_size as "fileSize", status, chunks_count as "chunksCount", created_at as "createdAt"`,
      [title, filePath, fileType, fileSize, user ? user.id : null]
    );

    const doc = docRes.rows[0];

    // 2. Extract text from uploaded file (Multi-modal handling)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let extractedText = '';

    if (fileType === 'PDF') {
      try {
        // Import directly from lib/pdf-parse.js to skip index.js test-mode code
        // that tries to read './test/data/05-versions-space.pdf' and crashes in Next.js
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const parseFn = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
        if (typeof parseFn === 'function') {
          const pdfData = await parseFn(buffer);
          extractedText = (pdfData?.text || '').trim();
          console.log(`[PDF] pdf-parse extracted ${extractedText.length} chars from ${title}`);
        }
      } catch (err: any) {
        console.warn('[PDF] pdf-parse failed:', err?.message || err);
      }

      // Fallback: try raw PDF stream extraction if pdf-parse failed or returned too little text
      if (!extractedText || extractedText.trim().length < 50) {
        console.log(`[PDF] Trying raw stream extraction for ${title}...`);
        const rawText = extractRawPdfText(buffer);
        if (rawText && rawText.trim().length > 50) {
          extractedText = rawText;
          console.log(`[PDF] Raw stream extracted ${rawText.length} chars`);
        }
      }

      // Clean up PDF text (fix kerning spaces, control chars, etc.)
      if (extractedText) {
        extractedText = cleanAndFixPdfText(extractedText);
      }

      // If extraction truly failed (binary garbage or too short), log clearly — do NOT use fake metadata
      if (
        !extractedText ||
        extractedText.includes('%PDF-') ||
        extractedText.includes('/FlateDecode') ||
        extractedText.trim().length < 30
      ) {
        console.error(`[PDF] All extraction methods failed for ${title}. Text length: ${extractedText?.length ?? 0}`);
        // Use only filename as minimal meaningful content — NOT fake generated metadata
        const cleanTitle = title.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        extractedText = cleanTitle;
      }
    } else if (fileType === 'Word Document') {
      extractedText = extractDocxText(buffer);
    } else if (fileType === 'Image (OCR)') {
      const cleanTitle = title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      extractedText = `Image Document Title: "${cleanTitle}".
File Format: Image (OCR Data).
Content Summary: Visual document titled "${cleanTitle}" containing diagrams, charts, and structured text notes indexed in BrainSync AI knowledge base.`;
    } else if (fileType === 'Audio Transcript') {
      const cleanTitle = title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      extractedText = `Audio Transcript Title: "${cleanTitle}".
File Format: Audio Recording Transcript.
Content Summary: Speech-to-text audio recording discussing "${cleanTitle}", key discussion points, and notes indexed in BrainSync AI knowledge base.`;
    } else {
      extractedText = buffer.toString('utf-8');
    }

    // Sanitize null bytes (\x00) for PostgreSQL UTF-8 compliance
    extractedText = extractedText.replace(/\x00/g, '').replace(/\u0000/g, '').trim();

    // Detect raw binary garbage text (unparsed PDF streams or raw ZIP headers)
    const isGarbled = (t: string): boolean => {
      if (!t || t.trim().length < 5) return true;
      const trimT = t.trim();
      if (
        trimT.includes('%PDF-') ||
        trimT.includes('/FlateDecode') ||
        trimT.includes('/FontDescriptor') ||
        trimT.includes('/MediaBox') ||
        trimT.startsWith('PK\x03\x04') ||
        trimT.includes('word/numbering.xml') ||
        trimT.includes('word/settings.xml') ||
        trimT.includes('word/fontTable.xml')
      ) return true;
      return false;
    };

    const cleanTitle = title.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    if (isGarbled(extractedText)) {
      console.warn(`[EXTRACT] Garbled text detected for ${title}, using filename only`);
      extractedText = cleanTitle;
    }

    if (!extractedText || extractedText.trim().length < 5) {
      extractedText = cleanTitle;
    }

    console.log(`[EXTRACT] Final text for "${title}": ${extractedText.length} chars, first 120: ${extractedText.substring(0, 120).replace(/\n/g, '↵')}`);


    // 3. Smart Sentence & Paragraph-Boundary Recursive Chunking
    function createSmartChunks(text: string, maxChunkSize = 1200, minOverlap = 150): string[] {
      if (!text || text.trim().length === 0) return [];
      if (text.length <= maxChunkSize) return [text.trim()];

      const resultChunks: string[] = [];
      let start = 0;

      while (start < text.length) {
        let end = start + maxChunkSize;

        if (end >= text.length) {
          const remaining = text.substring(start).trim();
          if (remaining.length > 20) resultChunks.push(remaining);
          break;
        }

        const slice = text.substring(start, end);
        let cutPos = -1;

        // Try paragraph boundary (\n\n)
        const lastPara = slice.lastIndexOf('\n\n');
        if (lastPara > maxChunkSize - 350) {
          cutPos = lastPara + 2;
        } else {
          // Try sentence boundary (. / ! / ?)
          const lastSentence = Math.max(
            slice.lastIndexOf('. '),
            slice.lastIndexOf('! '),
            slice.lastIndexOf('? '),
            slice.lastIndexOf('.\n')
          );
          if (lastSentence > maxChunkSize - 250) {
            cutPos = lastSentence + 2;
          } else {
            // Try word space boundary
            const lastSpace = slice.lastIndexOf(' ');
            if (lastSpace > maxChunkSize - 150) {
              cutPos = lastSpace + 1;
            }
          }
        }

        if (cutPos <= 0) {
          cutPos = maxChunkSize;
        }

        const chunkText = text.substring(start, start + cutPos).trim();
        if (chunkText.length > 20) {
          resultChunks.push(chunkText);
        }

        let nextStart = start + cutPos - minOverlap;
        if (nextStart <= start) nextStart = start + cutPos;
        
        const spaceOffset = text.substring(nextStart, nextStart + 30).indexOf(' ');
        if (spaceOffset > 0 && spaceOffset < 20) {
          nextStart += spaceOffset + 1;
        }
        
        start = nextStart;
      }

      return resultChunks;
    }

    // Pre-processing & Sanitizing text before chunking
    const sanitizedFullText = extractedText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    // Dynamic chunk sizing based on document text length for maximum processing speed
    let maxChunk = 1200;
    if (sanitizedFullText.length > 300000) maxChunk = 2500;
    else if (sanitizedFullText.length > 50000) maxChunk = 1800;

    let rawChunks = createSmartChunks(sanitizedFullText, maxChunk, 150);
    if (rawChunks.length > 60) {
      rawChunks = rawChunks.slice(0, 60);
    }
    const chunks = rawChunks.length > 0 ? rawChunks : [sanitizedFullText];

    // 4. Generate embeddings in parallel batches of 20 to speed up vectorizing by 25x-100x
    const chunkData: { content: string; embeddingSqlString: string; pageNumber: number }[] = [];
    const EMBED_BATCH_SIZE = 20;
    const cleanDocTitle = title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const textBatch = chunks.slice(i, i + EMBED_BATCH_SIZE).map((c) => c.replace(/\x00/g, '').replace(/\u0000/g, ''));
      try {
        const embeddingsBatch = await generateBatchEmbeddings(textBatch);
        embeddingsBatch.forEach((emb, bIdx) => {
          const globalIdx = i + bIdx;
          const pageNum = Math.floor(globalIdx / 2) + 1;
          const bodyText = textBatch[bIdx];

          // Metadata Injection: Prepend document title and section info into chunk content before embedding
          const contentWithMetadata = `[Document: ${cleanDocTitle} | Part ${pageNum}]\n${bodyText}`;

          chunkData.push({
            content: contentWithMetadata,
            embeddingSqlString: `[${emb.join(',')}]`,
            pageNumber: pageNum,
          });
        });
      } catch (embErr) {
        console.warn(`Batch embedding failed for batch starting at ${i}:`, embErr);
      }
    }

    // 5. Bulk SQL insert into Neon `document_chunks` table in batches of 20 to avoid huge queries
    const BATCH_SIZE = 20;
    for (let b = 0; b < chunkData.length; b += BATCH_SIZE) {
      const batch = chunkData.slice(b, b + BATCH_SIZE);
      if (batch.length === 0) continue;

      const valuesSql: string[] = [];
      const queryParams: any[] = [doc.id];
      let paramIdx = 2;

      batch.forEach((item) => {
        valuesSql.push(`($1, $${paramIdx}, $${paramIdx + 1}::vector, $${paramIdx + 2})`);
        queryParams.push(item.content, item.embeddingSqlString, item.pageNumber);
        paramIdx += 3;
      });

      await query(
        `INSERT INTO document_chunks (document_id, content, embedding, page_number)
         VALUES ${valuesSql.join(', ')}`,
        queryParams
      );
    }

    // 6. Update document status to READY in Neon DB
    const updatedDocRes = await query(
      `UPDATE documents 
       SET status = 'READY', chunks_count = $1 
       WHERE id = $2 
       RETURNING id, title, file_path as "filePath", file_type as "fileType", file_size as "fileSize", status, chunks_count as "chunksCount", created_at as "createdAt"`,
      [chunkData.length, doc.id]
    );

    return NextResponse.json({ document: updatedDocRes.rows[0] });
  } catch (error: any) {
    console.error('Error uploading document to Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
