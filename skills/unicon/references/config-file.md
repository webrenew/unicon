# `.uniconrc.json` Reference

`.uniconrc.json` lists icon bundles for `unicon sync` to generate. Put it in
the project root, next to `package.json`, and commit it together with the
generated files so the team can regenerate the same icons.

## Format

```json
{
  "$schema": "https://unicon.sh/schema/uniconrc.json",
  "bundles": [
    {
      "name": "nav",
      "icons": ["home", "search", "bell", "user", "simple-icons:github"],
      "source": "lucide",
      "format": "react",
      "output": "./src/icons/nav"
    }
  ]
}
```

The `$schema` URL gives editors completion and validation. The schema rejects
fields the CLI does not read, such as `outputDir`, `split`, or `strokeWidth`.

### Root

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | string | Optional. Written by `unicon init` |
| `bundles` | array | The bundles to generate |

### Bundle

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique bundle name, used by `sync --name` and `bundle:add` |
| `output` | string | yes | A directory or a file, relative to the project root. See [Output](#output) |
| `icons` | string[] | one of `icons`, `query`, `category`, `source` | Exact icons: `name` (from `source`, else Lucide) or `source:name` |
| `query` | string | one of `icons`, `query`, `category`, `source` | Semantic search query |
| `category` | string | one of `icons`, `query`, `category`, `source` | Category filter for the search, for example `Arrows` |
| `source` | string | one of `icons`, `query`, `category`, `source` | Library: `lucide`, `phosphor`, `hugeicons`, `heroicons`, `tabler`, `feather`, `remix`, `iconoir`, `simple-icons` |
| `format` | string | no | `react`, `vue`, `svelte`, `svg`, or `json`. Default: the framework in `package.json`, else `react` |
| `limit` | number | no | Maximum icons from `query`, `category`, or `source`. Default 100 |

## How selection works

- **`icons`** selects exact icons, in order. Use it whenever you know which
  icons you want. A name that does not exist makes `sync` fail with
  `Not found: <name>`, so typos show up instead of producing a different icon.
- **`query`, `category`, `source`** run a search and add up to `limit`
  matches. Search is semantic, so a query such as `"user"` can return `users`
  before `user`, and results can change as the index changes. Use a search
  for a themed set where the exact members do not matter.
- With both, `sync` writes the `icons` first and then the search results that
  are not already in the list. `source` alone (no `icons` or `query`) adds the
  first `limit` icons of that library.

`unicon bundle:add <bundle> <icons...>` appends to `icons`.

## Output

| `output` | `format` | Result |
|----------|----------|--------|
| A directory (`./src/icons/nav`, no extension) | `react`, `vue`, `svelte` | One component file per icon and an `index.ts` that re-exports them. Bundlers drop the icons the app does not import |
| A directory | `svg`, `json` | One `.svg` or `.json` file per icon |
| A file (`./src/icons/nav.tsx`) | `react` | All components in one file. Not tree-shakeable |
| A file (`./public/icons.svg`) | `svg` | An SVG sprite with one `<symbol id="<name>">` per icon. Use it with `<svg><use href="/icons.svg#home" /></svg>` |
| A file (`./src/icons/nav.json`) | `json` | A JSON array with each icon's data |
| A file | `vue`, `svelte` | Error: Vue and Svelte need one component per file, so use a directory |

When two libraries have an icon with the same name, the second gets the
library as a suffix: `home.tsx` and `home-tabler.tsx`, components `Home` and
`HomeTabler`.

## Examples

### React app with exact icons

```json
{
  "bundles": [
    {
      "name": "ui",
      "icons": ["home", "search", "settings", "log-out", "user"],
      "source": "lucide",
      "output": "./src/components/icons"
    },
    {
      "name": "social",
      "icons": ["github", "discord", "x"],
      "source": "simple-icons",
      "output": "./src/components/icons/social"
    }
  ]
}
```

Import with `import { Home, Search } from "@/components/icons";`.

### Nuxt or SvelteKit

```json
{
  "bundles": [
    { "name": "header", "icons": ["settings", "log-out", "user"], "source": "lucide", "output": "./components/icons/header" }
  ]
}
```

`format` is detected from `nuxt`, `vue`, `svelte`, or `@sveltejs/kit` in
`package.json`. Each icon becomes a `.vue` or `.svelte` file.

### SVG sprite and a themed set

```json
{
  "bundles": [
    { "name": "sprite", "icons": ["home", "menu", "x"], "source": "lucide", "format": "svg", "output": "./public/icons.svg" },
    { "name": "arrows", "query": "arrow chevron", "source": "lucide", "limit": 20, "output": "./src/icons/arrows" }
  ]
}
```

## Workflow

1. `unicon init` creates the file. `unicon add <name> --icons ...` or
   `unicon add <name> --query ...` adds a bundle.
2. `unicon sync --dry-run` shows what each bundle would write.
3. `unicon sync` writes the files. It exits with code 1 when a bundle fails or
   a listed icon does not exist, so it can run in CI. `unicon sync --watch`
   writes them again when the config changes.
4. `unicon audit` finds icons that are bundled but unused, or imported but not
   bundled.
