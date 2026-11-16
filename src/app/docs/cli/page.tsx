import { Metadata } from "next";
import { PackageIcon } from "@/components/icons/ui/package";
import { TerminalIcon } from "@/components/icons/ui/terminal";
import { FileCodeIcon } from "@/components/icons/ui/file-code";
import { FolderSyncIcon } from "@/components/icons/ui/folder-sync";
import { PlusIcon } from "@/components/icons/ui/plus";
import { SearchIcon } from "@/components/icons/ui/search";
import { ListIcon } from "@/components/icons/ui/list";
import { InfoIcon } from "@/components/icons/ui/info";
import { DownloadIcon } from "@/components/icons/ui/download";
import { EyeIcon } from "@/components/icons/ui/eye";
import { DatabaseIcon } from "@/components/icons/ui/database";
import { LayersIcon } from "@/components/icons/ui/layers";
import { MCPIcon } from "@/components/icons/mcp-icon";
import { DocsPageNav, getDocsNavLinks } from "@/components/docs-page-nav";
import { CopyPageButton } from "@/components/copy-page-button";
import { CodeBlock } from "@/components/ui/code-block";

const PAGE_MARKDOWN = `# Unicon CLI

Command-line interface for searching and bundling icons from 19,000+ icons across 9 libraries.

## Installation

\`\`\`bash
# Run without installing (recommended)
npx @webrenew/unicon <command>      # npm
pnpm dlx @webrenew/unicon <command> # pnpm
bunx @webrenew/unicon <command>     # bun

# Or install globally
npm install -g @webrenew/unicon
pnpm add -g @webrenew/unicon
bun add -g @webrenew/unicon
\`\`\`

## Commands

### search <query>
AI-powered semantic search for icons.

\`\`\`bash
unicon search "dashboard"
unicon search "notification bell"
unicon search "arrow" --source lucide --limit 10
\`\`\`

Options:
- \`--source <id>\` - Filter by library (lucide, phosphor, etc.)
- \`--category <name>\` - Filter by category
- \`--limit <n>\` - Max results (default: 20)
- \`--json\` - Output as JSON

### get <name>
Get a single icon and output to stdout or file.

\`\`\`bash
unicon get home
unicon get home --format svg
unicon get home -o src/icons
unicon get simple-icons:github -o src/icons/github.tsx
\`\`\`

Matches the name exactly; exits with an error and suggestions if no icon has it.

Options:
- \`--format <type>\` - react, vue, svelte, svg, json (default: from package.json)
- \`--source <id>\` - Library to take the icon from (default: Lucide, then any)
- \`-o, --output <path>\` - Write to a file, or to <name>.<ext> in a directory

### bundle
Write many icons. A directory gets one file per icon plus index.ts (tree-shakeable); a file gets all icons in one file (a .svg file becomes a sprite).

\`\`\`bash
unicon bundle --icons settings,log-out,user --source lucide -o src/icons
unicon bundle --query "arrow chevron" --source lucide --limit 20 -o src/icons/arrows
unicon bundle --icons home,menu,x --format svg -o public/icons.svg
\`\`\`

Options:
- \`--icons <list>\` - Exact icons, comma-separated (home,lucide:settings)
- \`--query <text>\` - Search query
- \`--category <name>\` - Filter by category
- \`--source <id>\` - Library for bare names, and search filter
- \`--format <type>\` - Output format (default: from package.json)
- \`--limit <n>\` - Max icons from a search (default: 100)
- \`-o, --output <path>\` - Output directory or file (default: ./icons)
- \`--single-file\` - Write icons.<ext> in the output directory

### init
Create a \`.uniconrc.json\` config file.

\`\`\`bash
unicon init
\`\`\`

### sync
Regenerate all bundles from config.

\`\`\`bash
unicon sync
unicon sync --name dashboard
unicon sync --dry-run
\`\`\`

### add <name>
Add a bundle to config.

\`\`\`bash
unicon add nav --icons home,search,bell,user --source lucide
unicon add arrows --query "arrow chevron" --source lucide --limit 20
\`\`\`

### info <name>
Show detailed icon information.

### preview <name>
ASCII art preview in terminal.

### categories / sources
List available categories and sources.

### cache
Manage local cache.

\`\`\`bash
unicon cache --stats
unicon cache --clear
\`\`\`

### skill
Install AI assistant skills.

\`\`\`bash
unicon skill --list
unicon skill --ide cursor
unicon skill --all
\`\`\`

## Config File (.uniconrc.json)

\`\`\`json
{
  "$schema": "https://unicon.sh/schema/uniconrc.json",
  "bundles": [
    {
      "name": "ui",
      "icons": ["home", "search", "settings", "simple-icons:github"],
      "source": "lucide",
      "output": "./src/icons/ui"
    },
    {
      "name": "arrows",
      "query": "arrow chevron",
      "source": "lucide",
      "limit": 20,
      "output": "./src/icons/arrows"
    }
  ]
}
\`\`\`

\`icons\` selects exact icons; \`query\`, \`category\`, and \`source\` add search results. An \`output\` without an extension gets one file per icon (required for Vue and Svelte). \`sync\` exits with code 1 if a listed icon does not exist.

## Output Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| react | .tsx | React/Next.js (default) |
| vue | .vue | Vue 3 SFC |
| svelte | .svelte | Svelte components |
| svg | .svg | Raw SVG |
| json | .json | Data/programmatic |

## Icon Sources

| Source | Icons | Description |
|--------|-------|-------------|
| lucide | 1,900+ | Stroke icons |
| phosphor | 1,500+ | Fill icons (6 weights) |
| hugeicons | 1,800+ | Modern outlined |
| heroicons | 292 | Tailwind Labs |
| tabler | 4,600+ | Pixel-perfect stroke |
| feather | 287 | Minimalist |
| remix | 2,800+ | Comprehensive |
| simple-icons | 3,300+ | Brand logos |
| iconoir | 1,600+ | Regular & solid |

## Tree-Shaking

Default bundle mode creates one file per icon:

\`\`\`
src/icons/
├── index.ts      # Re-exports
├── home.tsx
├── settings.tsx
└── user.tsx
\`\`\`

Import only what you use:
\`\`\`tsx
import { Home, Settings } from "./icons"
\`\`\`

## Offline Support

Icons are cached at \`~/.unicon/cache\` for 24 hours.
`;

export const metadata: Metadata = {
  title: "CLI | Unicon",
  description: "Command-line interface for searching and bundling icons. Install via npm, search 14,000+ icons, and generate tree-shakeable React, Vue, or Svelte components. Open source icon CLI tool.",
  keywords: [
    "icon cli",
    "command line icons",
    "npm icon tool",
    "icon bundler",
    "react icon cli",
    "vue icon cli",
    "svelte icon cli",
    "tree shaking icons",
    "icon generator",
    "cli tool",
    "developer tools",
    "icon search cli",
    "offline icon tool",
  ],
  alternates: {
    canonical: "/docs/cli",
  },
  openGraph: {
    title: "Unicon CLI — Icon Bundler for Command Line",
    description: "Search and bundle icons from the command line. Generate tree-shakeable components for React, Vue, and Svelte.",
    url: "https://unicon.sh/docs/cli",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unicon CLI — Icon Bundler for Command Line",
    description: "Search and bundle icons from the command line. Generate tree-shakeable components.",
  },
};

function CommandCard({
  icon: Icon,
  command,
  description,
  example,
}: {
  icon: React.ElementType;
  command: string;
  description: string;
  example: string;
}) {
  return (
    <div className="p-4 md:p-5 rounded-xl border border-border bg-card hover:bg-accent transition-colors overflow-hidden">
      <div className="flex items-start gap-2 md:gap-3 mb-3">
        <div className="p-1.5 md:p-2 rounded-lg bg-[var(--accent-aqua)]/10 shrink-0">
          <Icon className="w-4 h-4 text-[var(--accent-aqua)]" />
        </div>
        <code className="font-mono font-medium text-sm md:text-base overflow-x-auto whitespace-nowrap">{command}</code>
      </div>
      <p className="text-muted-foreground text-sm mb-4">{description}</p>
      <CodeBlock>{example}</CodeBlock>
    </div>
  );
}

export default function CLIPage() {
  return (
    <div className="w-full py-10 px-4 md:px-12 lg:px-16 bg-background text-foreground">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 md:p-3 rounded-xl bg-[var(--accent-aqua)]/10 border border-[var(--accent-aqua)]/20">
            <TerminalIcon className="w-5 h-5 md:w-6 md:h-6 text-[var(--accent-aqua)]" />
          </div>
          <CopyPageButton markdown={PAGE_MARKDOWN} />
        </div>
        <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">Unicon CLI</h1>
        <p className="text-base md:text-xl text-muted-foreground max-w-2xl">
          Search and bundle icons from 9 libraries via command line. Define your icon sets once,
          regenerate anytime with a single command.
        </p>
      </div>

      <div className="space-y-10 md:space-y-16">
        {/* Quick Start */}
        <section id="installation">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Installation</h2>
          <div className="space-y-4">
            <CodeBlock title="Install globally">npm install -g @webrenew/unicon</CodeBlock>
            <p className="text-muted-foreground text-sm">Or use directly with npx:</p>
            <CodeBlock>npx @webrenew/unicon search &quot;dashboard&quot;</CodeBlock>
          </div>
        </section>

        {/* Commands */}
        <section id="commands">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Commands</h2>
          <div className="grid gap-4">
            <CommandCard
              icon={SearchIcon}
              command="unicon search <query>"
              description="Search for icons by name, keyword, or concept. Uses AI-powered semantic search for better results."
              example={`unicon search "settings gear"
unicon search "dashboard" --category Dashboards
unicon search "arrow" --source lucide --limit 10`}
            />

            <CommandCard
              icon={DownloadIcon}
              command="unicon get <name>"
              description="Get one icon by exact name and output to stdout, a file, or a directory. Exits with suggestions if no icon has that name."
              example={`unicon get home
unicon get simple-icons:github -o ./src/icons
unicon get settings --format svelte -o ./settings.svelte`}
            />

            <CommandCard
              icon={InfoIcon}
              command="unicon info <name>"
              description="Show detailed information about an icon including source, category, tags, and viewBox."
              example={`unicon info home
unicon info arrow-right --source phosphor`}
            />

            <CommandCard
              icon={PackageIcon}
              command="unicon bundle"
              description="Write many icons by exact name or search. A directory output gets one tree-shakeable file per icon; a .svg file gets a sprite."
              example={`unicon bundle --icons home,settings,user --source lucide -o ./icons
unicon bundle --query "arrow chevron" --format vue -o ./icons
unicon bundle --icons home,menu,x --format svg -o ./public/icons.svg`}
            />

            <CommandCard
              icon={FileCodeIcon}
              command="unicon init"
              description="Initialize a .uniconrc.json config file in your project with example bundle configurations."
              example={`unicon init
unicon init --force  # Overwrite existing`}
            />

            <CommandCard
              icon={FolderSyncIcon}
              command="unicon sync"
              description="Generate all bundles defined in your .uniconrc.json config file."
              example={`unicon sync
unicon sync --name ui         # Sync specific bundle
unicon sync --dry-run         # Preview changes`}
            />

            <CommandCard
              icon={PlusIcon}
              command="unicon add <name>"
              description="Add a new bundle configuration to your .uniconrc.json file."
              example={`unicon add nav --icons home,search,bell --source lucide
unicon add social --icons github,discord,x --source simple-icons
unicon add arrows --query "arrow chevron" --limit 20`}
            />

            <CommandCard
              icon={ListIcon}
              command="unicon categories"
              description="List all available icon categories."
              example={`unicon categories
unicon categories --json`}
            />

            <CommandCard
              icon={EyeIcon}
              command="unicon preview <name>"
              description="Show ASCII art preview of an icon directly in the terminal."
              example={`unicon preview home
unicon preview star --width 24 --height 24
unicon preview arrow --source phosphor`}
            />

            <CommandCard
              icon={LayersIcon}
              command="unicon sources"
              description="List the 9 icon libraries and their --source IDs."
              example={`unicon sources
unicon sources --json`}
            />

            <CommandCard
              icon={DatabaseIcon}
              command="unicon cache"
              description="Manage local cache for offline use. Icons are cached for 24 hours."
              example={`unicon cache --stats  # Show cache info
unicon cache --clear  # Clear all cached data`}
            />
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Typical Workflow</h2>
          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent-aqua)]/20 text-[var(--accent-aqua)] text-xs font-mono flex items-center justify-center">1</span>
              <div>
                <p className="text-foreground/80 text-sm font-medium">Initialize config</p>
                <code className="text-xs text-muted-foreground">unicon init</code>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent-aqua)]/20 text-[var(--accent-aqua)] text-xs font-mono flex items-center justify-center">2</span>
              <div>
                <p className="text-foreground/80 text-sm font-medium">Search for icons you need</p>
                <code className="text-xs text-muted-foreground">unicon search &quot;dashboard&quot;</code>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent-aqua)]/20 text-[var(--accent-aqua)] text-xs font-mono flex items-center justify-center">3</span>
              <div>
                <p className="text-foreground/80 text-sm font-medium">Add bundles to your config</p>
                <code className="text-xs text-muted-foreground">unicon add dashboard --category Dashboards</code>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent-aqua)]/20 text-[var(--accent-aqua)] text-xs font-mono flex items-center justify-center">4</span>
              <div>
                <p className="text-foreground/80 text-sm font-medium">Generate all bundles</p>
                <code className="text-xs text-muted-foreground">unicon sync</code>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent-mint)]/20 text-[var(--accent-mint)] text-xs font-mono flex items-center justify-center">✓</span>
              <div>
                <p className="text-foreground/80 text-sm font-medium">Import and use</p>
                <code className="text-xs text-muted-foreground">{`import { Home, Settings } from "./icons/dashboard"`}</code>
              </div>
            </div>
          </div>
        </section>

        {/* Config File */}
        <section id="config-file">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Config File</h2>
          <p className="text-muted-foreground mb-4 md:mb-6 text-sm md:text-base">
            Define your icon bundles in <code className="text-cyan-400 text-xs md:text-sm">.uniconrc.json</code> and
            regenerate them anytime with <code className="text-cyan-400 text-xs md:text-sm">unicon sync</code>.
          </p>
          <CodeBlock title=".uniconrc.json">{`{
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
      "format": "svg",
      "output": "./public/icons/social.svg"
    }
  ]
}`}</CodeBlock>
        </section>

        {/* Output Formats */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Output Formats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            <div className="p-4 md:p-5 rounded-xl border border-border bg-card">
              <h3 className="font-mono font-medium mb-2 text-[var(--accent-aqua)]">react</h3>
              <p className="text-muted-foreground text-xs md:text-sm mb-2 md:mb-3">TypeScript React components.</p>
              <code className="text-xs text-muted-foreground">.tsx</code>
            </div>
            <div className="p-4 md:p-5 rounded-xl border border-border bg-card">
              <h3 className="font-mono font-medium mb-2 text-[var(--accent-mint)]">vue</h3>
              <p className="text-muted-foreground text-xs md:text-sm mb-2 md:mb-3">Vue 3 SFC components.</p>
              <code className="text-xs text-muted-foreground">.vue</code>
            </div>
            <div className="p-4 md:p-5 rounded-xl border border-border bg-card">
              <h3 className="font-mono font-medium mb-2 text-[var(--accent-lavender)]">svelte</h3>
              <p className="text-muted-foreground text-xs md:text-sm mb-2 md:mb-3">Svelte components.</p>
              <code className="text-xs text-muted-foreground">.svelte</code>
            </div>
            <div className="p-4 md:p-5 rounded-xl border border-border bg-card">
              <h3 className="font-mono font-medium mb-2 text-[var(--accent-aqua)]">svg</h3>
              <p className="text-muted-foreground text-xs md:text-sm mb-2 md:mb-3">Raw SVG markup.</p>
              <code className="text-xs text-muted-foreground">.svg</code>
            </div>
            <div className="p-4 md:p-5 rounded-xl border border-border bg-card">
              <h3 className="font-mono font-medium mb-2 text-[var(--accent-lavender)]">json</h3>
              <p className="text-muted-foreground text-xs md:text-sm mb-2 md:mb-3">Icon data as JSON.</p>
              <code className="text-xs text-muted-foreground">.json</code>
            </div>
          </div>
        </section>

        {/* Sources */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Icon Sources</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Access 19,000+ icons from 9 popular icon libraries:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
              <h3 className="font-mono font-medium mb-1 text-orange-400">lucide</h3>
              <p className="text-muted-foreground text-xs">1,456 icons</p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <h3 className="font-mono font-medium mb-1 text-emerald-400">phosphor</h3>
              <p className="text-muted-foreground text-xs">7,488 icons</p>
            </div>
            <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
              <h3 className="font-mono font-medium mb-1 text-violet-400">hugeicons</h3>
              <p className="text-muted-foreground text-xs">3,000+ icons</p>
            </div>
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <h3 className="font-mono font-medium mb-1 text-blue-400">heroicons</h3>
              <p className="text-muted-foreground text-xs">292 icons</p>
            </div>
            <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
              <h3 className="font-mono font-medium mb-1 text-cyan-400">tabler</h3>
              <p className="text-muted-foreground text-xs">3,000+ icons</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-500/20 bg-gray-500/5">
              <h3 className="font-mono font-medium mb-1 text-gray-400">feather</h3>
              <p className="text-muted-foreground text-xs">287 icons</p>
            </div>
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
              <h3 className="font-mono font-medium mb-1 text-indigo-400">remix</h3>
              <p className="text-muted-foreground text-xs">2,000+ icons</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-500/20 bg-slate-500/5">
              <h3 className="font-mono font-medium mb-1 text-slate-400">simple-icons</h3>
              <p className="text-muted-foreground text-xs">2,000+ brand logos</p>
            </div>
            <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5">
              <h3 className="font-mono font-medium mb-1 text-teal-400">iconoir</h3>
              <p className="text-muted-foreground text-xs">1,600+ icons</p>
            </div>
          </div>
        </section>

        {/* MCP Server */}
        <section>
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <h2 className="text-xl md:text-2xl font-bold">AI Assistant Integration</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">NEW</span>
          </div>
          <div className="p-5 md:p-6 rounded-xl border border-[var(--accent-lavender)]/20 bg-[var(--accent-lavender)]/5">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 rounded-lg bg-[var(--accent-lavender)]/10 shrink-0">
                <MCPIcon className="w-5 h-5 text-[var(--accent-lavender)]" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Use Unicon with Claude & Cursor</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Connect Unicon to AI assistants via Model Context Protocol (MCP).
                  Search and generate icon components using natural language.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground text-xs mb-2">Install the MCP server:</p>
                <CodeBlock>npx @webrenew/unicon-mcp-server</CodeBlock>
              </div>

              <div>
                <p className="text-muted-foreground text-xs mb-2">Add to Claude Desktop config:</p>
                <CodeBlock title="claude_desktop_config.json">{`{
  "mcpServers": {
    "unicon": {
      "command": "npx",
      "args": ["-y", "@webrenew/unicon-mcp-server"]
    }
  }
}`}</CodeBlock>
              </div>

              <div className="pt-2">
                <p className="text-muted-foreground text-xs mb-3">Then ask Claude:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2 items-start">
                    <span className="text-purple-400">→</span>
                    <span className="text-muted-foreground">&quot;Search for dashboard icons in Lucide&quot;</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-purple-400">→</span>
                    <span className="text-muted-foreground">&quot;Get the React component for lucide:home&quot;</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-purple-400">→</span>
                    <span className="text-muted-foreground">&quot;Generate Vue components for social media icons&quot;</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex gap-3 text-xs">
                <a
                  href="https://github.com/WebRenew/unicon/blob/main/docs/mcp-quickstart.md"
                  className="text-[var(--accent-lavender)] hover:text-[var(--accent-lavender)]/80 hover:underline inline-flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quick Start Guide →
                </a>
                <a
                  href="https://github.com/WebRenew/unicon/blob/main/docs/mcp-integration.md"
                  className="text-[var(--accent-lavender)] hover:text-[var(--accent-lavender)]/80 hover:underline inline-flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Full Documentation →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Tree Shaking */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Tree-Shaking</h2>
          <div className="p-4 md:p-5 rounded-xl border border-[var(--accent-mint)]/20 bg-[var(--accent-mint)]/5">
            <p className="text-foreground/80 text-sm mb-4">
              Unlike <code className="text-muted-foreground">npm install lucide-react</code> which downloads thousands of icons,
              the CLI generates <strong>only the icons you need</strong> as individual files.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="text-[var(--accent-mint)]">✓</span>
                <span className="text-muted-foreground">One component per file = true tree-shaking</span>
              </div>
              <div className="flex gap-3">
                <span className="text-[var(--accent-mint)]">✓</span>
                <span className="text-muted-foreground">No external dependencies to ship</span>
              </div>
              <div className="flex gap-3">
                <span className="text-[var(--accent-mint)]">✓</span>
                <span className="text-muted-foreground">Import only what you use: <code className="text-[var(--accent-aqua)]">{`import { Home } from "./icons"`}</code></span>
              </div>
            </div>
          </div>
        </section>

        {/* Caching */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Offline Support</h2>
          <div className="p-4 md:p-5 rounded-xl border border-border bg-card">
            <p className="text-muted-foreground text-sm mb-4">
              The CLI automatically caches icon data locally at <code className="text-[var(--accent-aqua)]">~/.unicon/cache</code> for
              24 hours. This enables faster subsequent searches and partial offline usage.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-2 py-1 rounded bg-muted text-muted-foreground">unicon cache --stats</span>
              <span className="px-2 py-1 rounded bg-muted text-muted-foreground">unicon cache --clear</span>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="text-center py-8">
          <p className="text-muted-foreground mb-4">Ready to bundle some icons?</p>
          <CodeBlock>npx @webrenew/unicon init</CodeBlock>
        </section>

        {/* Page Navigation */}
        <DocsPageNav {...getDocsNavLinks("/docs/cli")} />
      </div>
    </div>
  );
}
