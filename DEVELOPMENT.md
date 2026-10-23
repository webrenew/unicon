# Unicon Development Guide

This guide covers self-hosting, development setup, and contributing to Unicon.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Database**: [Turso](https://turso.tech) (libSQL) + [Drizzle ORM](https://orm.drizzle.team)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai) + [Anthropic Claude](https://anthropic.com) + [OpenRouter](https://openrouter.ai)
- **Embeddings**: OpenAI `text-embedding-3-large` (3072 dimensions)
- **Vector Search**: Turso's `vector_distance_cos()` for semantic similarity
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Components**: [Radix UI](https://radix-ui.com) primitives
- **Deployment**: [Vercel](https://vercel.com)

## Prerequisites

- Node.js 18+
- [Turso](https://turso.tech) database (or any libSQL-compatible database)
- [OpenRouter API key](https://openrouter.ai) or [OpenAI API key](https://platform.openai.com) (for semantic search embeddings)
- [Anthropic API key](https://console.anthropic.com) (optional, for AI query expansion)
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key (optional, for other AI features)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/WebRenew/unicon.git
cd unicon

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
```

## Environment Variables

```bash
# Turso Database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI/OpenRouter (for semantic search embeddings - choose one)
OPENAI_API_KEY=sk-...                    # OpenAI API key
# OR
OPENAI_API_KEY=sk-or-v1-...              # OpenRouter API key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Vercel AI Gateway (optional, for other AI features)
AI_GATEWAY_API_KEY=vck_...

# Anthropic Claude (optional, for AI query expansion)
ANTHROPIC_API_KEY=sk-ant-...

# Admin API (optional)
ADMIN_SECRET=your-secret-for-admin-routes
```

## Database Setup

```bash
# Push schema to database
pnpm db:push

# (Optional) Open Drizzle Studio
pnpm db:studio
```

## Populating Icons

The icon extraction pipeline lives in the `extractor/` directory:

```bash
cd extractor
pip install -e .

# Extract icons from each library
python -m extractor.main
```

## Generating Embeddings

After populating icons, generate vector embeddings for semantic search:

```bash
# Generate embeddings for all icons
pnpm embeddings

# Or generate for specific library
pnpm embeddings --source lucide

# Monitor progress
tail -f embedding-progress.log
```

This uses OpenAI's `text-embedding-3-large` model (3072 dimensions) to create semantic vectors for each icon.

**Cost estimate**: ~$0.13 USD for all 17,786 icons on OpenRouter.

## Running the Dev Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build Behavior

- Production build runs with webpack via `pnpm build` (`next build --webpack`).
- The `/` page is configured as dynamic so build does not require live DB access during prerender.
- This keeps CI and local builds reliable in sandboxed/offline environments.

## CI Checks

Pull requests run these GitHub Actions checks:

- `Lint, Typecheck & Build`
- `Test Coverage`
- `Data API permission contract` (disposable Supabase replay)

To mirror CI locally:

```bash
pnpm security:migration-grants
pnpm test:migration-grants
pnpm test:data-api-grants
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
```

Coverage artifacts produced by CI:

- `coverage/lcov.info`
- `coverage/coverage-summary.json`

## How Semantic Search Works

Unicon uses vector embeddings to understand the meaning of search queries:

1. **Embedding Generation**: Each icon's metadata (name, category, tags, aliases) is converted to a 3072-dimensional vector using OpenAI's `text-embedding-3-large` model
2. **Query Embedding**: User search queries are embedded using the same model
3. **Similarity Search**: Turso's `vector_distance_cos()` finds icons with the most similar embeddings
4. **Smart Fallback**: If no embeddings exist, falls back to traditional SQL `LIKE` search
5. **Intelligent Caching**: Popular queries are cached with TTL expiration and LRU eviction

**Example**: Searching for "happy face" semantically matches icons like `FaceSmileSolid`, `EmotionHappyLine`, and `SmileyBlank` — even though they don't contain the words "happy" or "face".

## Project Structure

```
unicon/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   │   ├── icons/       # Icon search endpoint
│   │   │   ├── search/      # AI semantic search
│   │   │   └── admin/       # Admin endpoints
│   │   └── page.tsx         # Main browse page
│   ├── components/
│   │   ├── icons/           # Icon browser components
│   │   └── ui/              # Shared UI components
│   ├── lib/
│   │   ├── ai.ts            # AI/embedding utilities
│   │   ├── db.ts            # Database client
│   │   ├── queries.ts       # Database queries
│   │   └── schema.ts        # Drizzle schema
│   └── types/               # TypeScript types
├── extractor/               # Python icon extraction pipeline
│   ├── extractors/          # Per-library extractors
│   └── main.py              # Entry point
├── packages/cli/            # CLI tool
└── drizzle/                 # Database migrations
```

## API Reference

### `GET /api/icons`

Fetch paginated icons with optional filters and semantic search.

| Parameter | Type   | Description                          |
|-----------|--------|--------------------------------------|
| `q`       | string | Search query (uses semantic search when embeddings available) |
| `source`  | string | Filter by library (lucide, phosphor, hugeicons, heroicons, tabler, feather, remix, simple-icons) |
| `limit`   | number | Results per page (default: 100, max: 160) |
| `offset`  | number | Pagination offset                    |
| `ai`      | boolean | Enable AI search (default: true)    |

**Response includes**:
- `searchType`: `"semantic"` (vector similarity) or `"text"` (SQL LIKE)
- `icons`: Array of matching icons

**Example**:
```bash
curl 'https://unicon.sh/api/icons?q=happy%20face&limit=5'
```

### `POST /api/search`

Legacy semantic search endpoint (prefer GET /api/icons).

```json
{
  "query": "business icons",
  "sourceId": "lucide",
  "limit": 50
}
```

### `GET /api/health`

System health check with database, AI, and cache statistics.

```json
{
  "status": "healthy",
  "database": {
    "icons": { "total": 17786, "withEmbeddings": 17786, "percentage": 100 }
  },
  "ai": {
    "openai": { "configured": true },
    "anthropic": { "configured": false }
  },
  "cache": {
    "searchResults": { "size": 3, "utilization": 1 }
  }
}
```

### `POST /api/admin/warm-cache`

Pre-populate search cache with popular queries (requires ADMIN_SECRET).

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Credits

Built by [WebRenew](https://webrenew.com)

Icon libraries and their licenses:
- [Lucide](https://lucide.dev) — ISC License
- [Phosphor Icons](https://phosphoricons.com) — MIT License
- [Huge Icons](https://hugeicons.com) — MIT License
- [Heroicons](https://heroicons.com) — MIT License
- [Tabler Icons](https://tabler.io/icons) — MIT License
- [Feather Icons](https://feathericons.com) — MIT License
- [Remix Icon](https://remixicon.com) — Apache-2.0 License
- [Simple Icons](https://simpleicons.org) — CC0 1.0 Universal (brand logos are trademarks of their respective owners)
- [Iconoir](https://iconoir.com) — MIT License
