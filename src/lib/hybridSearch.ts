import { query } from '@/lib/db';
import { generateEmbedding } from '@/lib/openrouter';

export interface ChunkCitation {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  pageNumber: number;
  similarityScore: number;
  hybridScore?: number;
  sourceType?: 'document' | 'url' | 'web' | 'image' | 'audio';
  url?: string;
}

export async function performHybridSearch(
  userQuery: string,
  selectedDocumentId?: string | string[],
  limit: number = 4,
  userId?: string | null,
  allowedGuestDocIds?: string[]
): Promise<ChunkCitation[]> {
  const sanitized = userQuery.replace(/\x00/g, '').replace(/\u0000/g, '');
  if (!sanitized.trim()) return [];

  // Check if AI Only / NONE mode is explicitly requested
  const isNone =
    !selectedDocumentId ||
    selectedDocumentId === 'NONE' ||
    (Array.isArray(selectedDocumentId) &&
      (selectedDocumentId.length === 0 || selectedDocumentId.includes('NONE')));

  if (isNone) {
    return [];
  }

  // Check if user is asking for a general document summary / overview
  const isSummaryQuery = /summarize|summary|overview|main points|key points|explain the document|about this file|tell me about|analyze document|what do you know|apa yang kamu ketahui|ketahui dari file|ringkas|rangkuman/i.test(sanitized);

  // Only generate vector embedding when actually needed (skip for summary queries to avoid timeout)
  let vectorSqlString = '';
  if (!isSummaryQuery) {
    const queryVector = await generateEmbedding(sanitized);
    vectorSqlString = `[${queryVector.join(',')}]`;
  }

  // Clean text terms for tsquery / keyword search
  const keywords = sanitized
    .replace(/[^\w\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5);

  try {
    const params: any[] = [];
    let paramIdx = 1;

    // Security Scoping
    let guestDocIds: string[] = [];

    if (!userId) {
      // Guest Mode: collect all allowed document IDs for this session
      guestDocIds = Array.from(
        new Set([
          ...(allowedGuestDocIds || []),
          ...(Array.isArray(selectedDocumentId)
            ? selectedDocumentId
            : selectedDocumentId && selectedDocumentId !== 'ALL' && selectedDocumentId !== 'NONE'
            ? [selectedDocumentId]
            : []),
        ])
      ).filter((id) => id !== 'ALL' && id !== 'NONE');
    }

    const whereConditions: string[] = userId ? ["d.status = 'READY'"] : ["1=1"];

    if (userId) {
      whereConditions.push(`d.user_id = $${paramIdx}`);
      params.push(userId);
      paramIdx++;
    } else {
      // Guest: restrict to unassigned guest documents (user_id IS NULL)
      whereConditions.push(`(d.user_id IS NULL OR d.user_id = '')`);
      if (guestDocIds.length > 0) {
        whereConditions.push(`d.id::text = ANY($${paramIdx}::text[])`);
        params.push(guestDocIds);
        paramIdx++;
      } else {
        // Fallback: match any unassigned guest document uploaded in the last 2 hours
        whereConditions.push(`d.created_at >= NOW() - INTERVAL '2 hours'`);
      }
    }

    // Optional: user explicitly selected specific document(s) from dropdown
    if (selectedDocumentId && userId) {
      const docIds = Array.isArray(selectedDocumentId) ? selectedDocumentId : [selectedDocumentId];
      const validDocIds = docIds.filter((id) => id !== 'ALL' && id !== 'NONE');
      if (validDocIds.length > 0) {
        whereConditions.push(`d.id::text = ANY($${paramIdx}::text[])`);
        params.push(validDocIds);
        paramIdx++;
      }
    }

    const whereClause = whereConditions.join(' AND ');

    let sql = '';
    if (isSummaryQuery) {
      sql = `
        SELECT c.id, c.document_id as "documentId", c.content, c.page_number as "pageNumber",
               d.title as "documentTitle", d.file_type as "fileType",
               0.95 as "vectorScore"
        FROM document_chunks c
        JOIN documents d ON c.document_id::text = d.id::text
        WHERE ${whereClause}
        ORDER BY c.page_number ASC, c.id ASC LIMIT 10
      `;
    } else {
      const vecParamIdx = paramIdx;
      params.push(vectorSqlString);
      sql = `
        SELECT c.id, c.document_id as "documentId", c.content, c.page_number as "pageNumber",
               d.title as "documentTitle", d.file_type as "fileType",
               (1 - (c.embedding <=> $${vecParamIdx}::vector)) as "vectorScore"
        FROM document_chunks c
        JOIN documents d ON c.document_id::text = d.id::text
        WHERE ${whereClause}
        ORDER BY c.embedding <=> $${vecParamIdx}::vector ASC LIMIT 12
      `;
    }

    const res = await query(sql, params);

    if (!res.rows || res.rows.length === 0) {
      return [];
    }

    // Score with Reciprocal Rank Fusion / Weighted Hybrid Scoring
    const scoredCitations: ChunkCitation[] = res.rows.map((row: any) => {
      const vecScore = Math.min(0.99, Math.max(0.70, parseFloat(row.vectorScore || '0.85')));

      let keywordHits = 0;
      const lowerContent = (row.content || '').toLowerCase();
      keywords.forEach((kw) => {
        if (lowerContent.includes(kw.toLowerCase())) {
          keywordHits += 1;
        }
      });

      const textMatchRatio = keywords.length > 0 ? keywordHits / keywords.length : 0;
      const hybridScore = Number((vecScore * 0.7 + textMatchRatio * 0.3).toFixed(3));

      let sourceType: ChunkCitation['sourceType'] = 'document';
      const fileType = (row.fileType || '').toLowerCase();
      if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg')) {
        sourceType = 'image';
      } else if (fileType.includes('audio') || fileType.includes('mp3') || fileType.includes('wav')) {
        sourceType = 'audio';
      } else if (fileType.includes('url') || fileType.includes('web')) {
        sourceType = 'url';
      }

      return {
        id: row.id,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        content: row.content,
        pageNumber: row.pageNumber || 1,
        similarityScore: vecScore,
        hybridScore: hybridScore,
        sourceType: sourceType,
      };
    });

    scoredCitations.sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0));
    return scoredCitations.slice(0, limit);
  } catch (err) {
    console.warn('Hybrid search error:', err);
    return [];
  }
}
