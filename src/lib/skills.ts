export interface SkillEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly publicPath: string;
  readonly tags: readonly string[];
  readonly updatedAt: string;
}

export const skillEntries: readonly SkillEntry[] = [
  {
    id: "unicon",
    name: "Unicon",
    description:
      "Add icons from 19,000+ icons to React, Vue, Svelte, or HTML projects with the Unicon CLI or REST API.",
    publicPath: "/skills/unicon.md",
    tags: ["icons", "cli", "ai-assistants", "api"],
    updatedAt: "2026-11-16",
  },
  {
    id: "unicon-mcp",
    name: "Unicon MCP",
    description:
      "Connect and use the Unicon MCP server in Claude Code, Claude Desktop, Cursor, and other MCP clients.",
    publicPath: "/skills/unicon-mcp.md",
    tags: ["mcp", "ai-assistants", "icons", "setup"],
    updatedAt: "2026-11-16",
  },
];
