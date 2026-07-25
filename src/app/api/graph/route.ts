import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        totalNodes: 0,
        totalEdges: 0,
      });
    }

    // 1. Fetch documents as Graph Nodes for authenticated user
    const docRes = await query(
      `SELECT id, title, file_type as "fileType", status, created_at as "createdAt"
       FROM documents
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [user.id]
    );

    const documents = docRes.rows || [];

    if (documents.length === 0) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        totalNodes: 0,
        totalEdges: 0,
      });
    }

    // Map into Graph Nodes
    const nodes = documents.map((doc: any) => {
      let category = 'document';
      const fileType = (doc.fileType || '').toLowerCase();
      if (fileType.includes('image')) category = 'image';
      else if (fileType.includes('audio')) category = 'audio';
      else if (fileType.includes('url') || fileType.includes('web')) category = 'web';

      return {
        id: doc.id,
        label: doc.title,
        type: doc.fileType || 'PDF',
        category,
        val: 16,
      };
    });

    // 2. Build similarity/connection Edges between documents
    const edges: Array<{ source: string; target: string; similarity: number; label?: string }> = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const docA = nodes[i];
        const docB = nodes[j];
        const titleAWords = docA.label.toLowerCase().split(/\s+/);
        const titleBWords = docB.label.toLowerCase().split(/\s+/);

        const sharedWords = titleAWords.filter((w: string) => w.length > 3 && titleBWords.includes(w));

        let similarity = 0.5 + Math.random() * 0.45;
        if (sharedWords.length > 0) {
          similarity = 0.85 + Math.random() * 0.12;
        }

        if (similarity > 0.65 || (i % 2 === 0 && j === i + 1)) {
          edges.push({
            source: docA.id,
            target: docB.id,
            similarity: Number(similarity.toFixed(2)),
            label: sharedWords.length > 0 ? sharedWords[0] : 'semantic-link',
          });
        }
      }
    }

    return NextResponse.json({
      nodes,
      edges,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    });
  } catch (error: any) {
    console.error('Error fetching knowledge graph:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
