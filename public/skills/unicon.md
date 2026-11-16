---
name: unicon
description: Adds icons to web projects with Unicon, which generates zero-dependency icon code from 19,000+ icons in Lucide, Phosphor, Hugeicons, Heroicons, Tabler, Feather, Remix, Iconoir, and Simple Icons (brand logos). Searches icons semantically, then writes React, Vue, Svelte, SVG, or JSON into the project with the `unicon` CLI (`npx @webrenew/unicon`) or the unicon.sh REST API. Use this skill whenever the user wants to add, find, replace, or bundle icons or brand logos in a React, Next.js, Vue, Nuxt, Svelte, or HTML project, mentions Unicon, `.uniconrc.json`, or `unicon` commands, or wants icons without adding a package such as lucide-react or react-icons, even if they only say "put a settings icon here" or "I need the GitHub logo". When Unicon MCP tools are connected, see the unicon-mcp skill.
license: MIT
compatibility: Requires Node.js 18+, @webrenew/unicon 0.4.0+ (what npx installs), and network access to https://unicon.sh.
metadata:
  author: webrenew
  version: "0.4.0"
  website: https://unicon.sh
  repository: https://github.com/WebRenew/unicon
  openclaw:
    emoji: "🦄"
    requires:
      bins: ["node"]
    install:
      - type: node
        package: "@webrenew/unicon"
        global: true
---

# Unicon

Unicon writes icon source code into the project instead of adding an icon
package. Each icon becomes a small component, SVG file, or JSON object that the
project owns. Only the icons in use ship, and there is no dependency to install
or upgrade.

Run the CLI with `npx @webrenew/unicon <command>`. If it is installed globally
(`npm install -g @webrenew/unicon`), use `unicon <command>`. Every command
calls https://unicon.sh, so it needs network access.

Run `npx` commands one at a time, not in parallel. Parallel `npx` runs share
the npm cache, and the first run can fail with `EEXIST` or a missing module
while the package downloads. If that happens, run the command again.

## Choose an approach

| The user wants | Use |
|----------------|-----|
| One icon, or a few specific icons | `unicon get <name>`, or `unicon bundle --icons a,b,c` |
| A themed set of icons (navigation, social, ...) | `unicon bundle --query ... -o <dir>` |
| A set the team regenerates later | `.uniconrc.json` and `unicon sync` |
| Icons fetched from code, or no Node.js | The REST API, see [api-reference.md](references/api-reference.md) |
| Unicon MCP tools are connected | The MCP tools, see the unicon-mcp skill |

## Workflow

### 1. Match the project

Read `package.json` and look at the icons the project already uses before you
add new ones. Icon libraries differ in stroke width, corner style, and grid,
so icons from two libraries side by side look inconsistent. If the project
already uses one style, keep to its library with `--source`. For example, a
shadcn/ui project uses Lucide, so use `--source lucide`. Use `simple-icons`
for brand logos.

### 2. Search, then use exact names

```bash
npx @webrenew/unicon search "log out" --source lucide --limit 10 --json
```

Search is semantic, so describe the concept ("sign out", "delete") instead of
guessing a file name. Results identify icons as `source:name`, for example
`lucide:log-out`. The same name exists in several libraries, so pass the
same `--source` to `get` or `bundle` to get the icon you picked. Use `--json`
when you read the results yourself, because the default output is formatted
for people.

### 3. Generate the code

**Specific icons:** use `get` for one icon, or `bundle --icons` for several:

```bash
npx @webrenew/unicon get log-out --source lucide -o src/components/icons
npx @webrenew/unicon bundle --icons settings,log-out,user --source lucide -o src/components/icons
```

Both match names exactly. `get` takes a name (`log-out`) and `--icons` also
takes full IDs (`lucide:log-out,simple-icons:github`), so one command can mix
libraries. If a name does not exist, `get` exits with an error and suggests
similar icons, and `bundle` warns and writes the rest. Copy names from the
`search` output.

`-o` takes a directory or a file. In a directory, `get` writes
`<name>.<ext>`, and `bundle` writes one file per icon and an `index.ts` that
re-exports the components, so bundlers drop the icons the app does not
import. Without `-o`, `get` prints the code. When two libraries have an icon
with the same name, the second file gets the library as a suffix
(`home-tabler.tsx`, component `HomeTabler`).

The format follows the framework in `package.json`: `react`, `next`, or
`@remix-run/react` give `react`; `vue` or `nuxt` give `vue`; `svelte` or
`@sveltejs/kit` give `svelte`. Otherwise the format is `react`. Pass
`--format react|vue|svelte|svg|json` to choose it yourself. With `svg`, a
directory gets one `.svg` file per icon, and a file path gets an SVG sprite of
`<symbol>` elements.

**A themed set:** use `bundle --query`:

```bash
npx @webrenew/unicon bundle --query "arrows chevrons" --source lucide --limit 20 -o src/components/icons
```

A query adds up to `--limit` matches (default 100), and some can be loosely
related. Run the same `search` first, then either set `--limit` or pass the
names you want with `--icons`.

**A repeatable set:** use the config file:

```bash
npx @webrenew/unicon add nav --icons home,search,bell,user --source lucide
npx @webrenew/unicon sync
```

`add` creates an entry in `.uniconrc.json`, and `sync` regenerates every
entry. List exact names in `icons`; a `query` adds search results, which can
change as the index changes. An `output` without an extension
(`./src/icons/nav`) gets one file per icon; Vue and Svelte need this. `sync`
exits with an error if a listed icon does not exist, so it can run in CI.
Read [config-file.md](references/config-file.md) before you edit the config
by hand.

### 4. Use the icons and verify

Generated React components look like this:

```tsx
export function LogOut({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" /* ... */ className={className} {...props} />;
}
```

- Components use `currentColor`, so set the color with CSS or text classes.
- Components have no fixed size. Set the size with `className`, for example
  `className="size-4"`, or with `width` and `height`.
- Components are `aria-hidden`. Next to an icon-only button, add an
  `aria-label` to the button.
- Fill icons (Phosphor, Remix, Simple Icons logos, Heroicons and Iconoir
  solid) use `fill="currentColor"`, and stroke icons use `stroke`. The API
  data has each logo's brand color (`brandColor`).

Import from the generated path, then run the project's typecheck or build to
confirm that the imports resolve.

## Commands that need a terminal

`search --pick`, `init --interactive`, and `browse` wait for keyboard input.
They stop an agent that runs commands without a terminal. Use the
non-interactive flags shown above instead. `--copy` copies to the clipboard,
which is useful for a person, not for an agent.

## Libraries

| Source | Icons | Notes |
|--------|-------|-------|
| `lucide` | 1,900+ | Stroke icons, the shadcn/ui default |
| `phosphor` | 1,500+ | |
| `hugeicons` | 1,800+ | |
| `heroicons` | 640+ | Tailwind Labs |
| `tabler` | 4,900+ | Stroke icons, largest set |
| `feather` | 280+ | Lucide's predecessor |
| `remix` | 3,100+ | |
| `iconoir` | 1,600+ | |
| `simple-icons` | 3,300+ | Brand logos |

`npx @webrenew/unicon sources` prints the current list.

## References

- [cli-commands.md](references/cli-commands.md): every command and flag.
  Read it for options not shown here, or for `audit`, `compare`, `stars`,
  `login`, `bundles`, and `bundle:pull`.
- [config-file.md](references/config-file.md): the `.uniconrc.json` fields.
  Read it before you write or edit the config by hand.
- [api-reference.md](references/api-reference.md): REST endpoints,
  parameters, the response format, and rate limits. Read it when code calls
  unicon.sh directly or when the CLI is not available.
