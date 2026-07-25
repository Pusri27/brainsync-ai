import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentIds, messages } = await req.json();

    // 1. Claim all guest documents and assign them to the logged-in user
    if (Array.isArray(documentIds) && documentIds.length > 0) {
      await query(
        `UPDATE documents 
         SET user_id = $1 
         WHERE id::text = ANY($2::text[]) AND (user_id IS NULL OR user_id = '')`,
        [user.id, documentIds]
      );
    }

    // 2. Claim all unassigned guest documents created recently if array empty
    if (!documentIds || documentIds.length === 0) {
      await query(
        `UPDATE documents 
         SET user_id = $1 
         WHERE user_id IS NULL AND created_at >= NOW() - INTERVAL '2 hours'`,
        [user.id]
      );
    }

    // 3. Migrate guest in-memory chat messages into a new conversation for user
    let newConversationId: string | null = null;
    if (Array.isArray(messages) && messages.length > 0) {
      const firstUserMsg = messages.find((m: any) => m.sender === 'user');
      const rawTitle = firstUserMsg ? firstUserMsg.content : 'Saved Guest Chat';
      const cleanTitle = rawTitle.length > 50 ? rawTitle.substring(0, 47) + '...' : rawTitle;

      const convRes = await query(
        `INSERT INTO conversations (title, user_id)
         VALUES ($1, $2)
         RETURNING id`,
        [cleanTitle, user.id]
      );

      newConversationId = convRes.rows[0].id;

      // Insert each message into chat_messages table
      for (const msg of messages) {
        if (msg.content && msg.sender) {
          await query(
            `INSERT INTO chat_messages (conversation_id, sender, content, citations)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [
              newConversationId,
              msg.sender,
              msg.content,
              JSON.stringify(msg.citations || []),
            ]
          );
        }
      }
    }

    // 4. Migrate guest RAG traces to logged-in user account
    try {
      await query(
        `UPDATE rag_traces 
         SET user_id = $1 
         WHERE user_id = 'guest' OR user_id IS NULL`,
        [user.id]
      );
    } catch (traceErr) {
      console.warn('Could not migrate guest RAG traces:', traceErr);
    }

    return NextResponse.json({
      success: true,
      conversationId: newConversationId,
      message: 'Guest session successfully migrated to user account.',
    });
  } catch (error: any) {
    console.error('Error claiming guest session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
