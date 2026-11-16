# API Reference

The REST API returns icon data for code that calls unicon.sh directly. No
authentication is needed for these endpoints.

**Base URL**: `https://unicon.sh/api`

**Rate limit**: 60 requests per minute per IP address, shared across these
endpoints. Over the limit, the API returns `429` with `Retry-After` and
`X-RateLimit-*` headers. Cache results instead of searching on every
keystroke.

---

## GET /api/icons

Fetch icons with optional filters. Supports AI-powered semantic search.
Allows cross-origin requests (`Access-Control-Allow-Origin: *`).

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `q` | string | Search query. Semantic search for 3+ characters, text search otherwise | - |
| `source` | string | Filter by library | all |
| `category` | string | Filter by category (text search and browsing only) | all |
| `names` | string | Comma-separated exact normalized names, for example `home,settings`. Returns every library's icon with each name | - |
| `limit` | number | Results per page (max 320) | 100 |
| `offset` | number | Pagination offset | 0 |
| `ai` | boolean | `false` uses fast text search instead of semantic search | true |

### Response

```json
{
  "icons": [
    {
      "id": "lucide:home",
      "name": "Home",
      "normalizedName": "home",
      "sourceId": "lucide",
      "category": "Buildings",
      "tags": ["house", "building", "residence"],
      "viewBox": "0 0 24 24",
      "content": "<path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>...",
      "defaultStroke": true,
      "defaultFill": false,
      "strokeWidth": "2",
      "brandColor": null
    }
  ],
  "hasMore": true,
  "searchType": "semantic",
  "expandedQuery": "home house building residence dwelling"
}
```

Text search and browsing responses also include `total`, the number of
matching icons. Semantic responses do not.

### Search Types

| Type | Description |
|------|-------------|
| `semantic` | AI-powered vector search with query expansion |
| `text` | Name and tag matching with aliases (`ai=false`, short queries, or fallback) |
| `exact` | Exact name match (when using `names` param) |

### Examples

```bash
# Search with AI
curl "https://unicon.sh/api/icons?q=dashboard"

# Filter by source
curl "https://unicon.sh/api/icons?q=arrow&source=lucide"

# Get specific icons by name
curl "https://unicon.sh/api/icons?names=home,settings,user"

# Browse by category
curl "https://unicon.sh/api/icons?category=Social&limit=50"

# Disable AI search
curl "https://unicon.sh/api/icons?q=home&ai=false"
```

---

## POST /api/search

Hybrid semantic + exact match search with scoring.

### Request Body

```json
{
  "query": "string (required)",
  "sourceId": "string (optional)",
  "limit": "number (optional, default 50, max 320)",
  "offset": "number (optional, default 0)",
  "useAI": "boolean (optional, default false)"
}
```

Queries shorter than 3 characters use text search. `useAI: true` asks Claude
to expand queries that the built-in synonyms do not cover, with a 2-second
time limit.

### Response

```json
{
  "results": [
    {
      "id": "lucide:home",
      "name": "Home",
      "normalizedName": "home",
      "sourceId": "lucide",
      "category": "Buildings",
      "tags": ["house", "building"],
      "viewBox": "0 0 24 24",
      "content": "<path ... />",
      "defaultStroke": true,
      "defaultFill": false,
      "strokeWidth": "2",
      "brandColor": null,
      "score": 0.95
    }
  ],
  "searchType": "semantic",
  "expandedQuery": "home house building residence",
  "hasMore": true
}
```

### Score

Results include a `score` (0-1) combining:
- **Semantic similarity** (60% weight) - Vector distance
- **Exact match boost** (40% weight) - Name/tag/category matches

### Examples

```bash
# Basic search
curl -X POST "https://unicon.sh/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "dashboard"}'

# Filter by source
curl -X POST "https://unicon.sh/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "arrow", "sourceId": "phosphor", "limit": 20}'

# Enable AI expansion
curl -X POST "https://unicon.sh/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "celebration", "useAI": true}'
```

---

## Icon Data Schema

```typescript
interface IconData {
  id: string;              // "lucide:home"
  name: string;            // "Home" (PascalCase)
  normalizedName: string;  // "home" (kebab-case)
  sourceId: string;        // "lucide", "phosphor", etc.
  category: string | null; // "Buildings", "Arrows", etc.
  tags: string[];          // ["house", "building"]
  viewBox: string;         // "0 0 24 24"
  content: string;         // Raw SVG inner content
  pathData: { tag: string; attrs: Record<string, string> }[] | null; // Parsed elements (semantic results only)
  defaultStroke: boolean;  // Uses stroke for rendering
  defaultFill: boolean;    // Uses fill for rendering
  strokeWidth: string | null;
  brandColor: string | null; // Hex color for brand icons
}
```

---

## Available Sources

| ID | Name | Icons |
|----|------|-------|
| `lucide` | Lucide | 1,900+ |
| `phosphor` | Phosphor | 1,500+ |
| `hugeicons` | Huge Icons | 1,800+ |
| `heroicons` | Heroicons | 640+ |
| `tabler` | Tabler | 4,900+ |
| `feather` | Feather | 280+ |
| `remix` | Remix Icon | 3,100+ |
| `iconoir` | Iconoir | 1,600+ |
| `simple-icons` | Simple Icons (brand logos) | 3,300+ |

---

## Caching

Responses are cached at the CDN:

| Request | Cache time |
|---------|-----------|
| Browsing, text search, `names` | 1 hour |
| Semantic search (`GET /api/icons?q=...`) | 30 minutes |
| `POST /api/search` with an AI-expanded query | 1 minute |

Requests that the CDN answers from its cache never reach the server and do
not count toward the rate limit.

---

## Usage in Code

### JavaScript/TypeScript

```typescript
async function searchIcons(query: string) {
  const response = await fetch(
    `https://unicon.sh/api/icons?q=${encodeURIComponent(query)}`
  );
  const { icons } = await response.json();
  return icons;
}

// Get specific icons
async function getIcons(names: string[]) {
  const response = await fetch(
    `https://unicon.sh/api/icons?names=${names.join(",")}`
  );
  const { icons } = await response.json();
  return icons;
}
```

### Rendering Icons

```tsx
function Icon({ icon }: { icon: IconData }) {
  return (
    <svg
      viewBox={icon.viewBox}
      dangerouslySetInnerHTML={{ __html: icon.content }}
      fill={icon.defaultFill ? "currentColor" : "none"}
      stroke={icon.defaultStroke ? "currentColor" : "none"}
      strokeWidth={icon.strokeWidth ?? 2}
    />
  );
}
```

---

## Error Responses

```json
{
  "error": "Failed to fetch icons"
}
```

| Status | Description |
|--------|-------------|
| 400 | Invalid request (missing query, invalid `limit` or `offset`, etc.) |
| 429 | Rate limit exceeded. Wait for `Retry-After` seconds |
| 500 | Server error |
