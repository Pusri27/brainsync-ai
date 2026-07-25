import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    const res = await query(
      `SELECT id, sender, content, citations, created_at as "createdAt"
       FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({ messages: res.rows });
  } catch (error: any) {
    console.error('Error fetching chat messages from Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    const { title } = await req.json();
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    await query(
      'UPDATE conversations SET title = $1 WHERE id = $2',
      [title.trim().substring(0, 100), id]
    );

    return NextResponse.json({ success: true, title: title.trim() });
  } catch (error: any) {
    console.error('Error updating conversation title:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    await query('DELETE FROM conversations WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Conversation deleted' });
  } catch (error: any) {
    console.error('Error deleting conversation from Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

