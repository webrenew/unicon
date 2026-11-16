# Unicon CLI Documentation

> 🦄 Command-line interface for browsing and exporting 19,000+ icons

**Quick Install**: `npm install -g @webrenew/unicon` or use `npx @webrenew/unicon`

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [search](#unicon-search)
  - [get](#unicon-get)
  - [info](#unicon-info)
  - [preview](#unicon-preview)
  - [bundle](#unicon-bundle)
  - [init](#unicon-init)
  - [sync](#unicon-sync)
  - [add](#unicon-add)
  - [categories](#unicon-categories)
  - [sources](#unicon-sources)
  - [cache](#unicon-cache)
  - [skill](#unicon-skill)
- [Output Formats](#output-formats)
- [Config File](#config-file)
- [API Reference](#api-reference)
- [Examples](#examples)

---

## Installation

```bash
# Global install
npm install -g @webrenew/unicon

# Or use with npx (no install needed)
npx @webrenew/unicon search "dashboard"
```

---

## Quick Start

```bash
# Search for icons
unicon search "dashboard settings"

# Get a single icon (React component)
unicon get home

# Copy to clipboard (macOS)
unicon get home | pbcopy

# Save to file
unicon get settings --format react -o ./Settings.tsx

# Bundle multiple icons
unicon bundle --category Dashboards -o ./icons

# Initialize config-driven workflow
unicon init
unicon add nav --query "arrow menu chevron"
unicon sync

# Install AI assistant skill (Claude Code, Cursor, Windsurf, etc.)
unicon skill --ide claude
unicon skill --all
```

---

## Commands

### unicon search

AI-powered semantic search for icons.

```bash
unicon search <query> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--source <id>` | Filter by library (lucide, phosphor, hugeicons, heroicons, tabler, feather, remix, simple-icons, iconoir) | all |
| `--category <name>` | Filter by category | all |
| `--limit <n>` | Max results | 20 |
| `--json` | Output as JSON | false |

**Examples:**

```bash
unicon search "dashboard settings"
unicon search "arrow" --source lucide --limit 10
unicon search "social" --category Social --json
```

---

### unicon get

Get a single icon and output to stdout or file.

```bash
unicon get <name> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--format <type>` | Output format: react, vue, svelte, svg, json | react |
| `--source <id>` | Specify source if name is ambiguous | auto |
| `-o, --output <path>` | Write to file instead of stdout | stdout |

**Examples:**

```bash
# Output React component to stdout
unicon get home

# Copy to clipboard (macOS)
unicon get home | pbcopy

# Save Vue component
unicon get settings --format vue -o ./Settings.vue

# Get from specific library
unicon get arrow-right --source phosphor

# Raw SVG
unicon get star --format svg -o ./star.svg
```

---

### unicon info

Show detailed information about an icon.

```bash
unicon info <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--source <id>` | Specify source if ambiguous |
| `--json` | Output as JSON |

**Output includes:**
- Icon name and normalized name
- Source library
- Category and tags
- ViewBox dimensions
- Stroke/fill defaults

**Examples:**

```bash
unicon info home
unicon info arrow-right --source phosphor
unicon info github --json
```

---

### unicon preview

Show ASCII art preview of an icon in the terminal.

```bash
unicon preview <name> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--width <n>` | Preview width in characters | 16 |
| `--height <n>` | Preview height in characters | auto |
| `--source <id>` | Specify source if ambiguous | auto |

**Examples:**

```bash
unicon preview home
unicon preview star --width 24
unicon preview arrow-right --source lucide
```

---

### unicon bundle

Bundle multiple icons into files.

```bash
unicon bundle [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--query <text>` | Search query to select icons | - |
| `--category <name>` | Bundle by category | - |
| `--source <id>` | Filter by library | all |
| `--format <type>` | Output format | react |
| `--limit <n>` | Max icons to bundle | 50 |
| `-o, --output <path>` | Output directory or file | ./icons |
| `--split` | One file per icon (tree-shakeable) | false |
| `--single-file` | All icons in one file | true |

**Examples:**

```bash
# Bundle by category
unicon bundle --category Dashboards -o ./src/icons

# Bundle by search query
unicon bundle --query "navigation arrows" --format vue -o ./icons

# Split into individual files (tree-shakeable)
unicon bundle --category Social --split -o ./src/icons/social

# Single file with all icons
unicon bundle --query "home settings user" --single-file -o ./icons.tsx
```

---

### unicon init

Initialize a `.uniconrc.json` config file.

```bash
unicon init [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Overwrite existing config |

**Example:**

```bash
unicon init
# Creates .uniconrc.json with example bundles
```

---

### unicon sync

Regenerate all bundles defined in `.uniconrc.json`.

```bash
unicon sync [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--name <bundle>` | Sync only specified bundle |
| `--dry-run` | Preview changes without writing |

**Examples:**

```bash
# Sync all bundles
unicon sync

# Sync specific bundle
unicon sync --name dashboard

# Preview what would be generated
unicon sync --dry-run
```

---

### unicon add

Add a new bundle configuration to `.uniconrc.json`.

```bash
unicon add <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--query <text>` | Search query for icons |
| `--category <name>` | Category filter |
| `--source <id>` | Library filter |
| `--format <type>` | Output format |
| `--limit <n>` | Max icons |
| `-o, --output <path>` | Output path |

**Examples:**

```bash
# Add category bundle
unicon add dashboard --category Dashboards

# Add query-based bundle
unicon add nav --query "arrow menu chevron" --limit 30

# Add with specific options
unicon add social --category Social --source phosphor --format vue
```

---

### unicon categories

List all available icon categories.

```bash
unicon categories [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

---

### unicon sources

List all available icon libraries.

```bash
unicon sources [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Shows each library with icon count and license.**

---

### unicon cache

Manage local icon cache.

```bash
unicon cache [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--stats` | Show cache statistics |
| `--clear` | Clear all cached data |

**Examples:**

```bash
# View cache info
unicon cache --stats

# Clear cache
unicon cache --clear
```

**Cache Location:** Icons are cached at `~/.unicon/cache` with a 24-hour TTL.

---

### unicon skill

Install Unicon skill/rules for AI coding assistants (Claude Code, Cursor, Windsurf, etc.).

```bash
unicon skill [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--ide <name>` | Target IDE (claude, codex, cursor, agents, windsurf, opencode, gemini) |
| `--all` | Install for all supported IDEs |
| `-l, --list` | List all supported IDEs |
| `-f, --force` | Overwrite existing skill files |
| `-y, --yes` | Skip the confirmation prompt |

**Supported IDEs:**

Every assistant gets the same files from `skills/unicon/`: `SKILL.md` and
`references/`.

| IDE | Directory |
|-----|-----------|
| Claude Code | `.claude/skills/unicon/` |
| Codex | `.codex/skills/unicon/` |
| Cursor | `.cursor/skills/unicon/` |
| Agents (generic) | `.agents/skills/unicon/` |
| Windsurf | `.windsurf/skills/unicon/` |
| OpenCode | `.opencode/skills/unicon/` |
| Gemini CLI | `.gemini/skills/unicon/` |

**Examples:**

```bash
# List supported IDEs
unicon skill --list

# Install for specific IDE
unicon skill --ide claude
unicon skill --ide cursor

# Install for all IDEs
unicon skill --all

# Force overwrite existing files
unicon skill --ide cursor --force

# Auto-detect (installs for detected IDE directories)
unicon skill
```

**What it does:**

The skill command installs documentation files that teach AI coding assistants how to use Unicon. Once installed, you can ask your AI assistant:

- "Add a home icon to my project"
- "Search for dashboard icons"
- "Bundle navigation icons for my React app"

The AI will know to use `npx @webrenew/unicon` commands to help you.

---

### Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--help` | Show command help |
| `--version` | Show CLI version |
| `--no-color` | Disable colored output |

---

## Output Formats

### react (default)

TypeScript React components with proper typing.

```tsx
import { SVGProps } from "react";

export function Home(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="..." />
    </svg>
  );
}
```

### vue

Vue 3 Single File Components.

```vue
<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" v-bind="$attrs">
    <path d="..." />
  </svg>
</template>

<script setup lang="ts">
defineOptions({ name: "Home", inheritAttrs: false });
</script>
```

### svelte

Svelte components.

```svelte
<script lang="ts">
  export let size = 24;
  export let color = "currentColor";
</script>

<svg viewBox="0 0 24 24" width={size} height={size} stroke={color} {...$$restProps}>
  <path d="..." />
</svg>
```

### svg

Raw SVG files.

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path d="..." />
</svg>
```

### json

Icon data as JSON for programmatic use.

```json
{
  "name": "Home",
  "viewBox": "0 0 24 24",
  "content": "<path d=\"...\" />",
  "source": "lucide"
}
```

---

## Config File

The `.uniconrc.json` file defines your project's icon bundles for reproducible generation.

### Schema

```json
{
  "bundles": [
    {
      "name": "string",
      "query": "string (optional)",
      "category": "string (optional)",
      "source": "string (optional)",
      "limit": "number (optional, default: 50)",
      "format": "react | vue | svelte | svg | json",
      "output": "string (path)",
      "split": "boolean (optional, default: false)"
    }
  ]
}
```

### Bundle Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Bundle identifier |
| `query` | string | No* | Search query for icons |
| `category` | string | No* | Filter by category |
| `source` | string | No | Filter by library (lucide, phosphor, etc.) |
| `limit` | number | No | Max icons (default: 50) |
| `format` | string | Yes | Output format |
| `output` | string | Yes | Output path (file or directory) |
| `split` | boolean | No | One file per icon (default: false) |

*Either `query` or `category` should be specified.

### Complete Example

```json
{
  "bundles": [
    {
      "name": "dashboard",
      "category": "Dashboards",
      "limit": 50,
      "format": "react",
      "output": "./src/icons/dashboard.tsx"
    },
    {
      "name": "navigation",
      "query": "arrow chevron menu home",
      "limit": 30,
      "format": "react",
      "output": "./src/icons/navigation.tsx"
    },
    {
      "name": "social",
      "category": "Social",
      "source": "phosphor",
      "format": "vue",
      "output": "./src/icons/social",
      "split": true
    },
    {
      "name": "brands",
      "query": "github twitter facebook",
      "source": "simple-icons",
      "format": "svg",
      "output": "./public/icons/brands",
      "split": true
    }
  ]
}
```

### Split Mode

When `split: true`, each icon becomes a separate file:

```
output/
├── Home.tsx
├── Settings.tsx
├── User.tsx
└── index.ts  # Re-exports all icons
```

This enables true tree-shaking:

```tsx
// Only Home is bundled
import { Home } from "./icons/dashboard";
```

### Workflow

```bash
# 1. Initialize config
unicon init

# 2. Search for icons you need
unicon search "dashboard"

# 3. Add bundles based on your needs
unicon add dashboard --category Dashboards
unicon add nav --query "arrow menu chevron home"

# 4. Generate all bundles
unicon sync
```

---

## API Reference

REST API for programmatic access to Unicon icons.

**Base URL**: `https://unicon.sh/api`

### GET /api/icons

Fetch icons with optional filters. Supports AI-powered semantic search.

**Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `q` | string | Search query (AI search if 3+ chars) | - |
| `source` | string | Filter by library | all |
| `category` | string | Filter by category | all |
| `names` | string | Comma-separated exact names | - |
| `limit` | number | Results per page (max: 320) | 100 |
| `offset` | number | Pagination offset | 0 |
| `ai` | boolean | Enable AI search | true |

**Response:**

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
      "content": "<path d=\"...\"/>",
      "defaultStroke": true,
      "defaultFill": false,
      "strokeWidth": "2",
      "brandColor": null
    }
  ],
  "hasMore": true,
  "searchType": "semantic"
}
```

**Examples:**

```bash
# Search with AI
curl "https://unicon.sh/api/icons?q=dashboard"

# Filter by source
curl "https://unicon.sh/api/icons?q=arrow&source=lucide"

# Get specific icons by name
curl "https://unicon.sh/api/icons?names=home,settings,user"

# Browse by category
curl "https://unicon.sh/api/icons?category=Social&limit=50"
```

### POST /api/search

Hybrid semantic + exact match search with scoring.

**Request Body:**

```json
{
  "query": "string (required)",
  "sourceId": "string (optional)",
  "limit": "number (optional, default: 50)",
  "useAI": "boolean (optional, default: false)"
}
```

**Response:**

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
      "score": 0.95
    }
  ]
}
```

**Examples:**

```bash
# Basic search
curl -X POST "https://unicon.sh/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "dashboard"}'

# Filter by source
curl -X POST "https://unicon.sh/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "arrow", "sourceId": "phosphor", "limit": 20}'
```

---

## Icon Sources

| Source | Icons | License | Description |
|--------|-------|---------|-------------|
| `lucide` | 1,900+ | ISC | Beautiful & consistent |
| `phosphor` | 1,500+ | MIT | 6 weights available |
| `hugeicons` | 1,800+ | MIT | Modern outlined icons |
| `heroicons` | 292 | MIT | Tailwind Labs |
| `tabler` | 4,600+ | MIT | Pixel-perfect stroke |
| `feather` | 287 | MIT | Simple and clean |
| `remix` | 2,800+ | Apache-2.0 | Multiple categories |
| `simple-icons` | 3,300+ | CC0 | Brand logos |
| `iconoir` | 1,600+ | MIT | Modern outlined icons |

---

## Examples

### Quick Icon Copy

```bash
# Get React component
unicon get home

# Get Vue component
unicon get home --format vue

# Get raw SVG
unicon get home --format svg

# Copy to clipboard (macOS)
unicon get home | pbcopy

# Copy to clipboard (Windows)
unicon get home | clip

# Copy to clipboard (Linux)
unicon get home | xclip -selection clipboard
```

### Project Setup

```bash
# 1. Initialize configuration
unicon init

# 2. Add icon bundles
unicon add ui --query "home settings user menu search"
unicon add navigation --category Navigation
unicon add social --query "github twitter linkedin" --source simple-icons

# 3. Generate icons
unicon sync

# 4. Use in your app
# import { Home, Settings, User } from "./src/icons/ui"
```

### Framework-Specific Examples

#### React/Next.js

```bash
unicon bundle --category Dashboards --format react --split -o ./src/icons
```

```tsx
// Usage
import { Home, Settings, User } from "./icons";

export function MyComponent() {
  return (
    <div>
      <Home className="w-6 h-6" />
      <Settings size={24} />
      <User style={{ width: 32, height: 32 }} />
    </div>
  );
}
```

#### Vue

```bash
unicon bundle --category Dashboards --format vue --split -o ./src/icons
```

```vue
<script setup>
import { Home, Settings, User } from "./icons";
</script>

<template>
  <div>
    <Home class="w-6 h-6" />
    <Settings :size="24" />
    <User :style="{ width: '32px', height: '32px' }" />
  </div>
</template>
```

#### Svelte

```bash
unicon bundle --category Dashboards --format svelte --split -o ./src/icons
```

```svelte
<script>
  import { Home, Settings, User } from "./icons";
</script>

<div>
  <Home size={24} color="currentColor" />
  <Settings size={24} color="blue" />
  <User size={32} />
</div>
```

---

## Why Unicon?

### vs Traditional Icon Packages

**Traditional (`npm install lucide-react`):**
- ❌ Downloads thousands of unused icons
- ❌ Increases bundle size
- ❌ Relies on bundler tree-shaking
- ❌ External dependency to maintain

**Unicon:**
- ✅ Generates only icons you need
- ✅ Zero bundle bloat
- ✅ No external dependencies
- ✅ One file per icon for perfect tree-shaking
- ✅ 19,000+ icons from 9 libraries in one place

### Tree-Shaking Benefits

Unicon generates separate files for each icon:

```
src/icons/
├── Home.tsx        (only this is bundled)
├── Settings.tsx    (not bundled)
├── User.tsx        (not bundled)
└── index.ts
```

```tsx
// Only Home component is included in your bundle
import { Home } from "./icons";
```

---

## Web Interface

Browse and copy icons visually at: **https://unicon.sh**

Features:
- Visual search with AI
- One-click copy (SVG, React, Vue, Svelte)
- Filter by library and category
- Bundle builder for multiple icons
- Direct integration with v0.dev

---

## Support & Resources

- **Website**: https://unicon.sh
- **GitHub**: https://github.com/WebRenew/unicon
- **Issues**: https://github.com/WebRenew/unicon/issues
- **License**: MIT

---

**Last Updated**: 2026-01-22
