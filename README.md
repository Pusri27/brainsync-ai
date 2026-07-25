# 🧠 BrainSync AI — AI-Powered Personal Knowledge Base & RAG System

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Neon-PostgreSQL_&_pgvector-00e599?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

> **BrainSync AI** is an advanced, full-stack Personal Knowledge Management (PKM) platform powered by **Retrieval-Augmented Generation (RAG)**, **Hybrid Vector & Keyword Search**, interactive **Knowledge Graph**, and an AI-augmented **TipTap Editor**. Effortlessly ingest, analyze, connect, and chat with your documents in real-time with verified source citations.

---

## 🚀 Key Features

- 📄 **Multi-Format Document Ingestion:** Full support for PDF files (`pdf-parse`), Markdown (`.md`), and raw text, complete with automatic chunking and vector indexing.
- 🌐 **Web Content Scraping:** Dedicated web scraping API endpoint to parse, extract, and convert online articles into structured knowledge entries.
- ⚡ **Hybrid Search & RAG Pipeline:** Combines **Dense Vector Embeddings** (`pgvector`) with **Sparse Keyword Search** (BM25 algorithms) for high-precision document chunk retrieval.
- 💬 **Interactive AI Chat:** Context-aware assistant powered by OpenRouter LLM APIs with real-time response streaming and precise chunk-level source citations.
- 🕸️ **Knowledge Graph Visualization:** Automatically maps interconnected document nodes, semantic tags, and entity relationships to uncover hidden insights.
- 📝 **Smart AI Workspace & Editor:** Seamless TipTap Rich Text Editor featuring AI-assisted writing tools (summarization, rephrasing, inline content generation).
- 📊 **Built-in Observability & Analytics:** Real-time query performance monitoring, token consumption tracking, and audit logging.
- 🔒 **Secure Authentication:** Integrated session management and secure API route protections.

---

## 🛠️ Architecture & Tech Stack

### Technology Stack
- **Framework & Routing:** [Next.js 14](https://nextjs.org/) (App Router, Server Actions, API Routes)
- **Language & Styling:** [TypeScript 5](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), Lucide Icons
- **Rich Text Editor:** [TipTap Editor](https://tiptap.dev/) (`@tiptap/react`, `@tiptap/starter-kit`)
- **Database & Vector Engine:** [Neon Postgres](https://neon.tech/) (`@neondatabase/serverless` + `pgvector`)
- **AI & LLM Integration:** OpenRouter API (`gpt-4o-mini`, `text-embedding-3-small` / custom models)
- **Document Parser:** `pdf-parse` for automated text extraction
- **Observability:** Custom metrics, request duration logger, and token tracker

---

## 📁 Repository Structure

```
brainsync-ai/
├── public/                # Static assets & icons
├── src/
│   ├── app/               # Next.js 14 App Router
│   │   ├── api/           # Backend API Endpoints
│   │   │   ├── analytics/ # Observability & system metrics
│   │   │   ├── auth/      # Login/Logout & session handler
│   │   │   ├── chat/      # Single chat RAG streaming endpoint
│   │   │   ├── chats/     # Conversation history management
│   │   │   ├── documents/ # Document upload, chunking & list
│   │   │   ├── graph/     # Knowledge graph node & edge data
│   │   │   ├── scrape/    # Web URL content extraction
│   │   │   └── search/    # Hybrid search (vector + keyword)
│   │   ├── dashboard/     # Workspace UI routes
│   │   ├── globals.css    # Global Tailwind CSS styles
│   │   ├── layout.tsx     # Application root layout
│   │   └── page.tsx       # Landing page & dashboard entrance
│   ├── components/        # Reusable React & UI Components
│   │   ├── Header.tsx     # Top navigation bar
│   │   ├── Sidebar.tsx    # Knowledge navigation sidebar
│   │   ├── TipTap.tsx     # Rich text editor component
│   │   └── ...
│   ├── lib/               # Core utility modules & database drivers
│   │   ├── auth.ts        # Authentication helpers
│   │   ├── db.ts          # Neon Serverless postgres connection pool
│   │   ├── hybridSearch.ts# Vector & Keyword search implementation
│   │   ├── models.ts      # Data types & interfaces
│   │   ├── observability.ts# Analytics & metric logger
│   │   └── openrouter.ts  # OpenRouter API client wrapper
│   └── types/             # TypeScript definitions
├── package.json           # Project dependencies & scripts
├── tailwind.config.ts     # Tailwind configuration
└── tsconfig.json          # TypeScript configuration
```

---

## 🗄️ Database Schema & Vector Indexing

The project utilizes **PostgreSQL** with the **`pgvector`** extension hosted on Neon Serverless.

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_path TEXT,
  file_type VARCHAR(50) NOT NULL,
  content TEXT,
  status VARCHAR(20) DEFAULT 'READY',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Chunks Table with Vector Embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- Vector size matching OpenAI/OpenRouter embeddings
  chunk_index INT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vector Cosine Index for Fast Similarity Search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

---

## 🚦 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** `>= 18.17.0`
- **npm** or **pnpm** / **yarn**
- A **Neon PostgreSQL Database** instance with `pgvector` enabled
- An **OpenRouter API Key**

### 1. Installation

Clone the repository and install the project dependencies:

```bash
git clone https://github.com/Pusri27/brainsync-ai.git
cd brainsync-ai
npm install
```

### 2. Environment Variables Configuration

Create a `.env.local` file in the root directory and add the following variables:

```env
# Neon Postgres Connection String
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require

# OpenRouter API Credentials
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Next Auth Secret & Base URL
NEXTAUTH_SECRET=your_super_secret_jwt_key
NEXTAUTH_URL=http://localhost:3000
```

### 3. Running the Application

Launch the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to explore **BrainSync AI**.

To create a production build:

```bash
npm run build
npm run start
```

---

## 📡 API Overview

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/logout` | `POST` | Invalidates current user session |
| `/api/documents` | `GET` / `POST` | Retrieve user documents or upload/process new document |
| `/api/documents/[id]/chunks` | `GET` | Fetch parsed text chunks for a specific document |
| `/api/chat` | `POST` | Query the RAG engine for streaming AI responses with citations |
| `/api/chats` | `GET` / `POST` | Manage user chat sessions and history |
| `/api/search` | `POST` | Execute hybrid search (vector similarity + keyword filtering) |
| `/api/graph` | `GET` | Fetch document nodes and relationship edges for visualization |
| `/api/scrape` | `POST` | Scrape web page URLs and ingest raw text into vector database |
| `/api/analytics` | `GET` | Get system metrics, token counts, and performance logs |

---

## 🤝 Contributing

Contributions are welcome! If you find bugs or want to introduce new features:

1. Fork the Repository
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.
