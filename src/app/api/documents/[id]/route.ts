import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    await query('DELETE FROM documents WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (error: any) {
    console.error('Error deleting document from Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
