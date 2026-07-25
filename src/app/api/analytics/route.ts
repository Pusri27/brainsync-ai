import { NextRequest, NextResponse } from 'next/server';
import { ragObserver } from '@/lib/observability';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    const analytics = await ragObserver.getAnalyticsSummary(user?.id);

    let totalDocuments = 0;
    let totalChunks = 0;

    if (user) {
      // Fetch document stats from DB for authenticated user
      try {
        const docCountRes = await query(`SELECT COUNT(*) as total FROM documents WHERE user_id = $1`, [user.id]);
        const chunkCountRes = await query(
          `SELECT COUNT(*) as total 
           FROM document_chunks 
           WHERE document_id IN (SELECT id FROM documents WHERE user_id = $1)`,
          [user.id]
        );

        totalDocuments = parseInt(docCountRes.rows[0]?.total || '0', 10);
        totalChunks = parseInt(chunkCountRes.rows[0]?.total || '0', 10);
      } catch (dbErr) {
        console.warn('Doc/Chunk count query error:', dbErr);
      }
    } else {
      // Guest mode: fetch guest document stats (user_id IS NULL OR user_id = '')
      try {
        const docCountRes = await query(`SELECT COUNT(*) as total FROM documents WHERE user_id IS NULL OR user_id = ''`);
        const chunkCountRes = await query(
          `SELECT COUNT(*) as total 
           FROM document_chunks 
           WHERE document_id IN (SELECT id FROM documents WHERE user_id IS NULL OR user_id = '')`
        );

        totalDocuments = parseInt(docCountRes.rows[0]?.total || '0', 10);
        totalChunks = parseInt(chunkCountRes.rows[0]?.total || '0', 10);
      } catch (dbErr) {
        console.warn('Guest doc/chunk count query error:', dbErr);
      }
    }

    return NextResponse.json({
      ...analytics,
      totalDocuments,
      totalChunks,
    });
  } catch (error: any) {
    console.error('Error fetching RAG analytics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { traceId, feedback } = await req.json();
    if (traceId && feedback) {
      await ragObserver.setFeedback(traceId, feedback);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Missing traceId or feedback' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

