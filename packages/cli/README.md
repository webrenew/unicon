# @webrenew/unicon

**CLI for browsing and exporting 19,000+ icons from 9 libraries.**

Like [shadcn/ui](https://ui.shadcn.com), but for icons. Search once, copy exactly what you need.

## Installation

```bash
npm install -g @webrenew/unicon

# Or use npx (no install needed)
npx @webrenew/unicon search arrow
```

## Quick Start

```bash
# Search for icons
unicon search "dashboard settings"

# Get icon as React component
unicon get home

# Copy to clipboard (macOS)
unicon get home | pbcopy

# Save to file
unicon get settings --format react -o ./Settings.tsx

# Bundle multiple icons
unicon bundle --category Dashboards -o ./icons

# Preview in terminal
unicon preview star
```

## Commands

| Command | Description |
|---------|-------------|
| `search <query>` | AI-powered semantic search |
| `get <name>` | Get single icon (React, Vue, Svelte, SVG) |
| `bundle` | Export multiple icons at once |
| `preview <name>` | ASCII preview in terminal |
| `info <name>` | Show icon metadata |
| `init` | Create `.uniconrc.json` config |
| `sync` | Regenerate all configured bundles |
| `add <name>` | Add bundle to config |
| `categories` | List available categories |
| `sources` | List icon libraries |
| `skill` | Install AI assistant rules |

## Output Formats

| Format | Flag | Description |
|--------|------|-------------|
| React | `--format react` | TypeScript component (default) |
| Vue | `--format vue` | Vue 3 SFC |
| Svelte | `--format svelte` | Svelte component |
| SVG | `--format svg` | Raw SVG |
| JSON | `--format json` | Icon metadata |

## Config-Driven Workflow

For larger projects, define bundles in `.uniconrc.json`:

```bash
unicon init
unicon add ui --icons home,search,settings,user --source lucide
unicon add arrows --query "arrow chevron" --source lucide --limit 20
unicon sync
```

## Icon Libraries

| Library | Icons |
|---------|-------|
| Lucide | 1,900+ |
| Phosphor | 1,500+ |
| Huge Icons | 1,800+ |
| Heroicons | 640+ |
| Tabler | 4,900+ |
| Feather | 280+ |
| Remix Icon | 3,100+ |
| Simple Icons | 3,300+ |
| Iconoir | 1,600+ |

## AI Integration

Install rules for AI coding assistants:

```bash
unicon skill --ide claude
unicon skill --ide cursor
unicon skill --all
```

Then ask your AI to "add a home icon" and it will use Unicon.

## Links

- **Website**: [unicon.sh](https://unicon.sh)
- **Full CLI Docs**: [CLI.md](https://github.com/WebRenew/unicon/blob/main/CLI.md)
- **GitHub**: [github.com/WebRenew/unicon](https://github.com/WebRenew/unicon)

## License

MIT
