export interface OpenRouterEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

// Generate vector embedding (1536-dimensional) for a given text string
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey && apiKey !== 'your_openrouter_api_key_here') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'BrainSync AI',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: text,
        }),
        signal: AbortSignal.timeout(10000), // 10s timeout to prevent hanging
      });

      if (res.ok) {
        const json: OpenRouterEmbeddingResponse = await res.json();
        if (json.data && json.data[0] && json.data[0].embedding) {
          return json.data[0].embedding;
        }
      }
    } catch (err) {
      console.warn('OpenRouter Embeddings API failed, generating deterministic fallback vector:', err);
    }
  }

  // Deterministic 1536-dimensional fallback vector generator for local demo
  const vector: number[] = new Array(1536).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < 1536; i++) {
    vector[i] = Math.sin(hash + i) * 0.5 + 0.5;
  }
  return vector;
}

// Generate vector embeddings in batch (1536-dimensional) for an array of text strings
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey && apiKey !== 'your_openrouter_api_key_here') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'BrainSync AI',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: texts,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const json: OpenRouterEmbeddingResponse = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const sorted = [...json.data].sort((a, b) => a.index - b.index);
          return sorted.map((d) => d.embedding);
        }
      }
    } catch (err) {
      console.warn('Batch OpenRouter Embeddings API failed, falling back to parallel requests:', err);
    }
  }

  // Fallback: Parallel requests in batches of 5
  const results: number[][] = [];
  const BATCH_SIZE = 5;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    const chunkEmbeddings = await Promise.all(chunk.map((t) => generateEmbedding(t)));
    results.push(...chunkEmbeddings);
  }
  return results;
}

// Stream or fetch completion response from OpenRouter
export async function getOpenRouterCompletion(
  messages: Array<{ role: string; content: string }>,
  model: string = 'openai/gpt-4o-mini'
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey && apiKey !== 'your_openrouter_api_key_here') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'BrainSync AI',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          const msg = data.choices[0].message;

          // Some free/reasoning models expose chain-of-thought in `reasoning` field
          // or prepend it before the actual response. Strip it out.
          let content: string = msg.content || '';

          // If model returns a separate reasoning field, ignore it (only use content)
          // Also strip common reasoning leak patterns that appear in the content itself:
          // patterns like "<think>...</think>", "We need to respond...", directive echoes, etc.
          content = content
            // Strip <think>...</think> or <reasoning>...</reasoning> blocks
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
            // Strip lines that start with obvious reasoning leaks
            .replace(/^(We need to respond\.|The developer instructions:|According to the developer|Let's produce|I'm going to|We have to|The safe approach:|Should we|Is that allowed\?|But there's no|But indeed|So let's|Let me|Thus we|But maybe|Hmm,|OK,).*$/gm, '')
            // Strip raw system prompt directive echoes
            .replace(/CRITICAL DIRECTIVES FOR DOCUMENT RAG RESPONSE:[\s\S]*?(?=\n\n|$)/g, '')
            // Strip assistant internal self-talk segments separated by <|end|>
            .replace(/<\|end\|>[\s\S]*/g, '')
            // Strip meta-commentary enclosed in backtick fences referring to instructions
            .replace(/```[\s\S]*?```/g, (m) => m.toLowerCase().includes('developer instructions') ? '' : m)
            .trim();

          // Collapse excessive blank lines produced by stripping
          content = content.replace(/\n{3,}/g, '\n\n').trim();

          if (content) return content;
        }
      }
    } catch (err) {
      console.warn('OpenRouter Completion API error:', err);
    }
  }

  return '';
}
