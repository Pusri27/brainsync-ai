import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      // Guest mode: do not return saved chat history
      return NextResponse.json({ conversations: [] });
    }

    const res = await query(
      `SELECT id, title, created_at as "createdAt"
       FROM conversations 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );
    return NextResponse.json({ conversations: res.rows });
  } catch (error: any) {
    console.error('Error fetching conversations from Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    const { title = 'New Conversation' } = await req.json();

    const sanitizedTitle = title.replace(/\x00/g, '').substring(0, 100);

    const res = await query(
      `INSERT INTO conversations (title, user_id)
       VALUES ($1, $2)
       RETURNING id, title, created_at as "createdAt"`,
      [sanitizedTitle, user ? user.id : null]
    );

    return NextResponse.json({ conversation: res.rows[0] });
  } catch (error: any) {
    console.error('Error creating conversation in Neon DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
