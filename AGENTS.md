# Unicon

**Just the icons you need. Zero bloat.**

Browse 20,000+ icons and copy exactly what you need. Like [shadcn/ui](https://ui.shadcn.com), but for icons.

- **Browse once, use anywhere** — Search 9 icon libraries (Lucide, Phosphor, Huge Icons, Heroicons, Tabler, Feather, Remix, Simple Icons, Iconoir)
- **Copy exactly what you need** — React, SVG, or JSON
- **Bundle multiple icons** — Export a set at once
- **Zero dependencies** — Paste directly into your project
- **CLI** — `npx @webrenew/unicon search arrow`
- **AI integration** — MCP server + IDE skills for Claude, Cursor, Windsurf, and more
- **Self-hostable** — See [DEVELOPMENT.md](./DEVELOPMENT.md)

## Tech Stack

- Next.js 16, React 19, TypeScript
- Supabase (auth, database, storage)
- Tailwind CSS v4
- Vercel (hosting)

## Icons

**NEVER use emojis in the UI.** Always use icon components from `@/components/icons/ui/`.

All icons must be:
1. Imported from `@/components/icons/ui/[icon-name].tsx`
2. React components following the standard Unicon pattern
3. Named with `Icon` suffix (e.g., `SearchIcon`, `PackageIcon`)

### Adding New Icons

Create icon components in `src/components/icons/ui/` following this pattern:

```tsx
import { SVGProps } from "react";

export function IconNameIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {/* SVG paths */}
    </svg>
  );
}
```

### Prohibited

- No emojis in UI components
- No external icon libraries (lucide-react, heroicons, react-icons, etc.)
- No inline SVGs without extracting to a component

## Code Style

- TypeScript preferred
- Functional components with hooks
- Tailwind CSS for styling
- Use `cn()` from `@/lib/utils` for conditional classes
- Use theme CSS variables (e.g., `bg-background`, `text-foreground`, `border-border`) — never hardcode colors

## Build Notes

- The app builds with `webpack` (`next build --webpack`) for deterministic CI/local builds
- The home route (`/`) is intentionally dynamic to avoid build-time database fetches during prerender

