import { Metadata } from "next";
import Link from "next/link";
import { SparklesIcon } from "@/components/icons/ui/sparkles";
import { DownloadIcon } from "@/components/icons/ui/download";
import { skillEntries } from "@/lib/skills";
import { DocsPageNav, getDocsNavLinks } from "@/components/docs-page-nav";
import { CopyPageButton } from "@/components/copy-page-button";
import { CodeBlock } from "@/components/ui/code-block";

/** Assistants supported by `unicon skill --ide <id>`; keep in sync with IDE_CONFIGS in packages/cli. */
const SUPPORTED_ASSISTANTS = [
  { id: "claude", name: "Claude Code", dir: ".claude/skills/unicon/" },
  { id: "codex", name: "Codex", dir: ".codex/skills/unicon/" },
  { id: "cursor", name: "Cursor", dir: ".cursor/skills/unicon/" },
  { id: "agents", name: "Agents (generic)", dir: ".agents/skills/unicon/" },
  { id: "windsurf", name: "Windsurf", dir: ".windsurf/skills/unicon/" },
  { id: "opencode", name: "OpenCode", dir: ".opencode/skills/unicon/" },
  { id: "gemini", name: "Gemini CLI", dir: ".gemini/skills/unicon/" },
] as const;

const ASSISTANT_IDS = SUPPORTED_ASSISTANTS.map((assistant) => assistant.id).join(", ");
const SKILL_FILES = "SKILL.md, references/";

/** The "Available Skills" section, from the registry so it matches the rendered cards. */
const AVAILABLE_SKILLS_MARKDOWN = skillEntries
  .map((skill) => `### ${skill.name}\n${skill.description}\n\nTags: ${skill.tags.join(", ")}\n\nDownload: https://unicon.sh${skill.publicPath}`)
  .join("\n\n");

const PAGE_MARKDOWN = `# Unicon Skills Registry

Download Unicon skills for AI assistants. Install once and let your assistant generate icons on demand.

## What is a Skill?

A skill is a markdown document that teaches AI assistants how to use Unicon. Once installed, your assistant can search for icons, generate components, and bundle icons automatically.

## Two CLI Commands

Unicon provides two commands for working with skills:

### unicon skill (Local Installation)

Installs skills directly into your AI assistant's config directory.

\`\`\`bash
unicon skill [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`--ide <name>\` | Target IDE: ${ASSISTANT_IDS} |
| \`--all\` | Install for all supported IDEs at once |
| \`-l, --list\` | List all supported IDEs and their config paths |
| \`-f, --force\` | Overwrite existing skill files |
| \`-y, --yes\` | Skip the confirmation prompt |

**Examples:**
\`\`\`bash
unicon skill --list              # See supported IDEs
unicon skill --ide claude        # Install for Claude Code
unicon skill --ide cursor        # Install for Cursor
unicon skill --all               # Install for all IDEs
unicon skill --ide claude -f     # Force overwrite existing
\`\`\`

### unicon skills (Registry Download)

Lists and downloads skills from the public registry.

\`\`\`bash
unicon skills [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-l, --list\` | List available skills (default if no flags) |
| \`-g, --get <id>\` | Download a skill by ID |
| \`-o, --output <path>\` | Write to file instead of stdout |
| \`-j, --json\` | Output list as JSON |

**Examples:**
\`\`\`bash
unicon skills                        # List available skills
unicon skills --get unicon           # Download to stdout
unicon skills --get unicon -o SKILL.md   # Save to file
unicon skills --json                 # List as JSON (for scripts)
\`\`\`

## Available Skills

${AVAILABLE_SKILLS_MARKDOWN}

## Supported IDEs

| IDE | Directory | Files |
|-----|-----------|-------|
${SUPPORTED_ASSISTANTS.map((assistant) => `| ${assistant.name} | \`${assistant.dir}\` | ${SKILL_FILES} |`).join("\n")}

## Direct Downloads

- Registry JSON: https://unicon.sh/skills/index.json
- Unicon Skill: https://unicon.sh/skills/unicon.md
- MCP Skill: https://unicon.sh/skills/unicon-mcp.md
`;

export const metadata: Metadata = {
  title: "Skills Registry | Unicon",
  description: "Download Unicon skills for AI assistants. Install once and let your assistant generate icons on demand.",
  keywords: [
    "unicon skills",
    "ai assistant skills",
    "cursor rules",
    "claude skills",
    "developer workflow",
  ],
  alternates: {
    canonical: "/docs/skills",
  },
  openGraph: {
    title: "Unicon Skills Registry",
    description: "Download Unicon skills for AI assistants and add icon workflows to your tools.",
    url: "https://unicon.sh/docs/skills",
    type: "website",
  },
};

export default function SkillsDocsPage() {
  return (
    <div className="w-full py-10 px-6 md:px-12 lg:px-16">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="p-3 rounded-xl bg-[var(--accent-lavender)]/10 border border-[var(--accent-lavender)]/20">
            <SparklesIcon className="w-6 h-6 text-[var(--accent-lavender)]" />
          </div>
          <CopyPageButton markdown={PAGE_MARKDOWN} />
        </div>
        <h1 className="text-4xl font-bold mb-4">Unicon Skills</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Install Unicon skills in your AI assistant to generate icons and bundles automatically.
          Skills are plain markdown files you can audit, version, and share.
        </p>
      </div>

      <div className="space-y-16">
        <section id="install-with-the-cli">
          <h2 className="text-2xl font-bold mb-4">What is a Skill?</h2>
          <div className="p-5 rounded-xl border border-border bg-card">
            <p className="text-muted-foreground leading-relaxed">
              Unicon skills teach AI assistants how to search, bundle, and generate icons. They are designed
              for tools like Claude Code, Cursor, and Windsurf and can be installed locally for private use
              or shared across teams.
            </p>
          </div>
        </section>

        <section id="direct-downloads">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Available Skills</h2>
            <Link
              href="/skills/index.json"
              className="text-sm text-[var(--accent-aqua)] hover:text-[var(--accent-aqua)]/80 underline"
            >
              Download registry JSON
            </Link>
          </div>
          <div className="grid gap-4">
            {skillEntries.map((skill) => (
              <div
                key={skill.id}
                className="p-5 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{skill.name}</h3>
                    <span className="text-xs font-mono text-muted-foreground">
                      Updated {skill.updatedAt}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{skill.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {skill.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs font-mono rounded-full bg-black/5 dark:bg-white/10 text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <a
                  href={skill.publicPath}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-accent transition-colors"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* CLI Commands */}
        <section id="cli-commands">
          <h2 className="text-2xl font-bold mb-6">CLI Commands</h2>
          <p className="text-muted-foreground mb-6">
            Unicon provides two commands for working with skills:
          </p>

          {/* skill command */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <code className="text-[var(--accent-aqua)]">unicon skill</code>
              <span className="text-sm font-normal text-muted-foreground">— Local Installation</span>
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Installs skills directly into your AI assistant&apos;s config directory.
            </p>
            
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold">Flag</th>
                    <th className="text-left py-2 px-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-[var(--accent-aqua)]">--ide &lt;name&gt;</td>
                    <td className="py-2 px-3 text-muted-foreground">Target IDE: {ASSISTANT_IDS}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-[var(--accent-aqua)]">--all</td>
                    <td className="py-2 px-3 text-muted-foreground">Install for all supported IDEs at once</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-[var(--accent-aqua)]">-l, --list</td>
                    <td className="py-2 px-3 text-muted-foreground">List all supported IDEs and their config paths</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-[var(--accent-aqua)]">-f, --force</td>
                    <td className="py-2 px-3 text-muted-foreground">Overwrite existing skill files</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock title="Examples">{`unicon skill --list              # See supported IDEs
unicon skill --ide claude        # Install for Claude Code
unicon skill --ide cursor        # Install for Cursor
unicon skill --all               # Install for all IDEs
unicon skill --ide claude -f     # Force overwrite existing`}</CodeBlock>
          </div>

          {/* skills command */}
          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <code className="text-[var(--accent-lavender)]">unicon skills</code>
              <span className="text-sm font-normal text-muted-foreground">— Registry Download</span>
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Lists and downloads skills from the public registry at unicon.sh.
            </p>
            
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold">Flag</th>
                    <th className="text-left py-2 px-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-[var(--accent-lavender)]">-l, --list</td>
                    <td className="py-2 px-3 text-muted-foreground">List available skills (default if no flags)</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-[var(--accent-lavender)]">-g, --get &lt;id&gt;</td>
                    <td className="py-2 px-3 text-muted-foreground">Download a skill by ID</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-[var(--accent-lavender)]">-o, --output &lt;path&gt;</td>
                    <td className="py-2 px-3 text-muted-foreground">Write to file instead of stdout</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-[var(--accent-lavender)]">-j, --json</td>
                    <td className="py-2 px-3 text-muted-foreground">Output list as JSON (for scripts)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock title="Examples">{`unicon skills                        # List available skills
unicon skills --get unicon           # Download to stdout
unicon skills --get unicon -o SKILL.md   # Save to file
unicon skills --json                 # List as JSON (for scripts)`}</CodeBlock>
          </div>
        </section>

        {/* Supported IDEs */}
        <section id="supported-ides">
          <h2 className="text-2xl font-bold mb-4">Supported IDEs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold">IDE</th>
                  <th className="text-left py-3 px-4 font-semibold">Directory</th>
                  <th className="text-left py-3 px-4 font-semibold">Files</th>
                </tr>
              </thead>
              <tbody>
                {SUPPORTED_ASSISTANTS.map((assistant, index) => (
                  <tr
                    key={assistant.id}
                    className={index < SUPPORTED_ASSISTANTS.length - 1 ? "border-b border-border" : undefined}
                  >
                    <td className="py-3 px-4">{assistant.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{assistant.dir}</td>
                    <td className="py-3 px-4 font-mono text-xs">{SKILL_FILES}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Direct Downloads */}
        <section id="direct-downloads">
          <h2 className="text-2xl font-bold mb-4">Direct Downloads</h2>
          <div className="p-5 rounded-xl border border-border bg-card space-y-3">
            <p className="text-sm text-muted-foreground">
              Prefer manual installs? Download the markdown files directly:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/skills/index.json"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono border border-border bg-background hover:bg-accent transition-colors"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                index.json
              </a>
              <a
                href="/skills/unicon.md"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono border border-border bg-background hover:bg-accent transition-colors"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                unicon.md
              </a>
              <a
                href="/skills/unicon-mcp.md"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono border border-border bg-background hover:bg-accent transition-colors"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                unicon-mcp.md
              </a>
            </div>
          </div>
        </section>

        {/* Page Navigation */}
        <DocsPageNav {...getDocsNavLinks("/docs/skills")} />
      </div>
    </div>
  );
}
