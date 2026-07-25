export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  isFree?: boolean;
  isPremium?: boolean;
  description?: string;
  category?: 'chat' | 'code' | 'rerank' | 'embedding';
}

export const OPENROUTER_MODELS: AIModelOption[] = [
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'NVIDIA Nemotron 3 Ultra 550B',
    provider: 'NVIDIA',
    isFree: true,
    isPremium: true,
    category: 'chat',
    description: 'Ultra-large 550B parameter model for complex reasoning (Login required)',
  },
  {
    id: 'poolside/laguna-m.1:free',
    name: 'Poolside Laguna M.1',
    provider: 'Poolside',
    isFree: true,
    isPremium: true,
    category: 'chat',
    description: 'High performance general purpose reasoning model (Login required)',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'NVIDIA Nemotron 3 Super 120B',
    provider: 'NVIDIA',
    isFree: true,
    isPremium: true,
    category: 'chat',
    description: '120B parameter model optimized for RAG context synthesis (Login required)',
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere North Mini Code',
    provider: 'Cohere',
    isFree: true,
    isPremium: true,
    category: 'code',
    description: 'Specialized model for code generation and technical QA (Login required)',
  },
  {
    id: 'poolside/laguna-xs-2.1:free',
    name: 'Poolside Laguna XS 2.1',
    provider: 'Poolside',
    isFree: true,
    isPremium: false,
    category: 'chat',
    description: 'Fast lightweight conversational reasoning model (Guest standard)',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'OpenAI GPT OSS 20B',
    provider: 'OpenAI',
    isFree: true,
    isPremium: false,
    category: 'chat',
    description: 'Open source 20B model tuned for instructions (Guest standard)',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google Gemma 4 26B IT',
    provider: 'Google',
    isFree: true,
    isPremium: true,
    category: 'chat',
    description: 'Google Gemma 26B instruction-tuned model (Login required)',
  },
  {
    id: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
    name: 'NVIDIA Llama Nemotron Rerank 1B',
    provider: 'NVIDIA',
    isFree: true,
    isPremium: true,
    category: 'rerank',
    description: 'Reranking model for fine-grained document score refinement (Login required)',
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    name: 'NVIDIA Nemotron Nano 12B VL',
    provider: 'NVIDIA',
    isFree: true,
    isPremium: true,
    category: 'chat',
    description: 'Nano 12B vision & language model (Login required)',
  },
];
