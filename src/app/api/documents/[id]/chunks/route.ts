import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const res = await query(
      `SELECT id, content, page_number as "pageNumber", created_at as "createdAt"
       FROM document_chunks
       WHERE document_id = $1
       ORDER BY page_number ASC, created_at ASC`,
      [id]
    );

    return NextResponse.json({ chunks: res.rows });
  } catch (error: any) {
    console.error('Error fetching document chunks from Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
