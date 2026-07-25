# 🧠 BrainSync AI — AI-Powered Personal Knowledge Base (RAG System)

> An open-source, full-stack Personal Knowledge Management (PKM) platform equipped with Retrieval-Augmented Generation (RAG) to upload, organize, search, and chat with your documents in real-time with precise citations.

---

## 📌 Executive Summary & Product Overview

**BrainSync AI** solves the information overload problem for students, researchers, and developers. Traditional keyword searches fail when querying large personal document collections. Generic LLMs lack private access to user notes and suffer from hallucinations. 

BrainSync AI combines a modern **Markdown/Rich-Text Editor** with a **Vector Database & RAG Pipeline**, delivering instant semantic context retrieval, streaming AI responses, and accurate source attribution.

---

## 🎯 Key Features

- 📁 **Multi-Format Document Ingestion:** Support for PDF, Markdown (`.md`), and Plain Text (`.txt`) up to 20MB per file.
- ⚡ **Automated Vector Pipeline:** Instant parsing, recursive chunking (500–1000 tokens), embedding generation, and vector indexing.
- 💬 **Interactive RAG Chat:** Conversational UI with word-by-word streaming responses via Server-Sent Events (SSE).
- 🔍 **Source Citation & Traceability:** Every AI answer cites the exact document chunk and similarity score used to form the response.
- 📝 **Smart Markdown Editor:** Integrated TipTap/Slate editor with inline AI completions (summarize, rephrase, continue writing).
- 🔒 **Privacy & Rate Limiting:** Row-Level Security (RLS) ensures full document isolation, with API usage capped via Upstash Redis.

---

## 🛠️ Tech Stack & System Architecture

### Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI
- **Editor:** TipTap Headless Editor
- **Backend & API:** Next.js API Routes / Node.js
- **Database & Vectors:** Neon (PostgreSQL + `pgvector`)
- **AI Framework & SDK:** LangChain.js, Vercel AI SDK
- **LLM & Embedding Models:** OpenRouter (`gpt-4o-mini`, `text-embedding-3-small`) / Google Gemini API
- **Rate Limiting:** Upstash Redis

---

## 🏗️ System Architecture & Data Flow

```
+-------------------------------------------------------------------+
|                           FRONTEND                                |
|  Next.js 14 (App Router) + React + Tailwind CSS + Shadcn UI       |
|  - TipTap / Editor Component                                     |
|  - SSE Client (AI Streaming UI)                                   |
+---------------------------------+---------------------------------+
                                  | HTTP / SSE
                                  v
+-------------------------------------------------------------------+
|                           BACKEND API                             |
|  Next.js API Routes / Node.js (Fastify/Express)                   |
|  - Auth & Document Service                                        |
|  - Ingestion Pipeline (LangChain / LlamaIndex)                    |
+-----------------+---------------------------------+---------------+
                  |                                 |
     Vector Data  |                                 | Structured Data
                  v                                 v
+-----------------------------------+   +---------------------------+
|         VECTOR DATABASE           |   |    RELATIONAL DATABASE    |
| Supabase Vector (pgvector) /      |   | PostgreSQL (Supabase)     |
| Pinecone                          |   | - Users, Metadata, Logs   |
+-----------------------------------+   +---------------------------+
```

---

## 📊 Database Schema Design

```sql
-- Documents Table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'PROCESSING', -- 'PROCESSING', 'READY', 'FAILED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Chunks Table (Vector Store)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- Dimension size for text-embedding-3-small
  page_number INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Vector Cosine Distance
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- Node.js >= 18.17.0
- Supabase Account & PostgreSQL Instance with `pgvector` enabled
- OpenAI API Key or Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/brainsync-ai.git
   cd brainsync-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   
   OPENAI_API_KEY=your-openai-api-key
   # or
   GEMINI_API_KEY=your-gemini-api-key

   UPSTASH_REDIS_REST_URL=your-upstash-redis-url
   UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token
   ```

4. **Run Database Migrations:**
   Execute the schema SQL inside your Supabase SQL Editor.

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗺️ Implementation Roadmap

- [x] **Phase 1: Foundation (MVP)**
  - Next.js 14 setup with Shadcn UI.
  - Supabase Auth & RLS Configuration.
  - Basic PDF/Text Upload & Vectorization Pipeline (`pgvector`).
  - Single-session RAG Chat UI.

- [ ] **Phase 2: Core Polish & UX**
  - Vercel AI SDK Integration for Word-by-Word Streaming Responses.
  - Citation Accordion / Source Highlight Overlay in Chat.
  - Background Job status tracking (Ingestion Progress Bar).

- [ ] **Phase 3: Smart Editor & Enhancements**
  - TipTap Editor integration with custom AI slash commands (`/summarize`, `/rephrase`).
  - Upstash Redis Rate Limiting middleware.
  - Hybrid Search (BM25 Keyword Search + Vector Similarity Search).

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
