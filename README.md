## RAGify – Retrieval‑Augmented QA over Your Own Data

RAGify is a Retrieval‑Augmented Generation (RAG) web application built on Next.js that lets you upload documents, paste text, or point to websites and then ask targeted questions against those sources.  
It uses LangChain, Google Generative AI, and Qdrant to index and retrieve relevant content while enforcing per‑session usage limits via Redis.

### Overview

- **Multi‑source ingestion**: Upload PDF, Markdown, and text files, add raw text, or provide a URL for live web scraping.
- **Semantic indexing and retrieval**: Documents are chunked and embedded using Google Generative AI embeddings and stored in Qdrant.
- **Document‑grounded answers**: The chat endpoint is constrained to answer strictly from retrieved document context (no general world knowledge).
- **Per‑session isolation**: Each browser session gets its own ID, file list, embeddings, and token quota.
- **Modern UI**: Responsive Next.js App Router UI with a sources sidebar, chat interface, theming, and token display.

### Tech Stack

- **Frontend**
  - Next.js 15 (App Router, TypeScript)
  - React 19, Tailwind CSS 4, Radix UI primitives, Shadcn‑style UI components
- **Backend**
  - Next.js API routes (`/api/indexing`, `/api/chat`, `/api/session`)
  - LangChain (document loaders, text splitters)
  - Cheerio (DOM parsing for websites)
  - `pdf-parse` / `WebPDFLoader` for PDF handling
- **AI & Vector Search**
  - Google Generative AI embeddings (`text-embedding-004`)
  - Gemini (via `ai` and `@ai-sdk/google`) for answer generation
  - Qdrant vector database (`@qdrant/js-client-rest`, `@langchain/qdrant`)
- **State & Storage**
  - Redis (ioredis) for session files and daily token quotas
  - Browser `localStorage` for client‑side chat history per session

### Project Structure

- **root**
  - `package.json` – project metadata, scripts, and dependencies
  - `next.config.ts`, `tailwind.config.ts`, `eslint.config.mjs` – framework and tooling configuration
  - `public/` – static assets
- **src/app**
  - `page.tsx` – main RAGify UI (sources panel, chat interface, token display, theme toggle)
  - `layout.tsx`, `globals.css` – app shell and global styles
  - `api/indexing/route.ts` – handles uploads and ingestion:
    - PDF parsing via `WebPDFLoader` with per‑page metadata
    - Text/Markdown ingestion as `Document`s
    - Website scraping via `CheerioWebBaseLoader` and DOM text extraction
    - Text chunking via `RecursiveCharacterTextSplitter`
    - Embedding and storage in Qdrant with `tenant_id` per session
  - `api/chat/route.ts` – semantic search in Qdrant scoped to session and source, then Gemini‑based answer streaming with strict grounding rules
  - `api/session/route.ts` – session bootstrap, token count, file list, and session reset (including Redis and Qdrant cleanup)
- **src/components**
  - `chat/` – chat interface, message list, and streaming display
  - `sources/` – source list, add‑source dialog (file, URL, text), and remove actions
  - `ai-elements/` – message rendering, code blocks, prompt input
  - `ui/` – shared UI primitives (buttons, dialogs, sheets, tabs, etc.)
  - `ThemeToggle.tsx` – light/dark theme switching
- **src/lib**
  - `redis.ts` – Redis client and helpers for session tokens and file metadata
  - `logger.ts` – environment‑aware logging
  - `utils.ts` – shared utilities
- **src/types**
  - `index.ts` – shared TypeScript types (e.g., `Source`, `ChatMessage`)

### Running Locally (Self‑Hosting)

#### Prerequisites

- Node.js (LTS recommended)
- Redis instance (local or remote)
- Qdrant instance (e.g., Docker or managed Qdrant)
- Google Generative AI API key (for embeddings and Gemini)

#### Environment Variables

Create a `.env.local` file in the project root with at least:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_google_genai_api_key

QDRANT_URL=https://your-qdrant-endpoint
QDRANT_KEY=your_qdrant_api_key

REDIS_URL=redis://localhost:6379
```

Adjust the values to match your infrastructure (local Docker, cloud instances, etc.).

#### Install Dependencies

```bash
npm install
```

#### Start Development Server

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

#### Production Build

```bash
npm run build
npm start
```

Ensure Redis and Qdrant are reachable from your deployment environment and that the environment variables are configured there as well.

### Using the Application

1. **Start a session**
   - The app generates a session ID in the browser and syncs it with Redis and Qdrant via `/api/session`.
2. **Add sources**
   - Upload a PDF, `.txt`, or Markdown file, paste text, or enter a website URL.
   - The backend parses, chunks, embeds, and indexes the content into Qdrant, and records file metadata in Redis.
3. **Ask questions**
   - Select a source and ask natural‑language questions.
   - The chat endpoint retrieves the most relevant chunks for that session and source, then Gemini generates an answer constrained to those chunks.
4. **Token limits**
   - Each session has a limited number of daily questions (tokens), enforced via Redis and surfaced in the UI.

### Difficulties and Design Considerations

- **Parsing large PDFs**
  - Large multi‑page PDFs required per‑page loading with `WebPDFLoader`, custom metadata (page numbers, total pages, size), and explicit word‑count estimation to keep indexing transparent and debuggable.
- **Handling large text and Markdown files**
  - Text files can be long and unstructured, so a recursive character text splitter is used with overlap to balance retrieval granularity and context continuity.
- **Robust DOM extraction for websites**
  - Websites vary widely in structure and markup quality; Cheerio is used to normalize HTML and extract text while enriching documents with titles, sections, and a `tenant_id` to preserve multi‑tenant isolation in Qdrant.
- **Session isolation and cleanup**
  - Ensuring that embeddings, token counts, and file lists are scoped per session required consistent use of `tenant_id` in Qdrant payloads and dedicated cleanup logic in `/api/session` and `/api/indexing` delete paths.

