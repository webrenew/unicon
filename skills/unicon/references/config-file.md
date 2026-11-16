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
      "query": "arrow chevron menu",
      "source": "lucide",
      "limit": 20,
      "format": "react",
      "output": "./src/icons/nav.tsx"
    }
  ]
}
```

The CLI reads only these fields. It ignores any other field, so a setting
such as `outputDir` or `strokeWidth` has no effect.

### Root

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | string | Optional. Written by `unicon init` |
| `bundles` | array | The bundles to generate |

### Bundle

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique bundle name, used by `sync --name` and `bundle:add` |
| `output` | string | yes | File to write, relative to the project root |
| `query` | string | one of `query`, `category`, `source` | Semantic search query |
| `category` | string | one of `query`, `category`, `source` | Category filter, for example `Arrows` |
| `source` | string | one of `query`, `category`, `source` | Library: `lucide`, `phosphor`, `hugeicons`, `heroicons`, `tabler`, `feather`, `remix`, `iconoir`, `simple-icons` |
| `format` | string | no | `react` (default) or `json`. See [Formats](#formats) before using `svg`, `vue`, or `svelte` |
| `limit` | number | no | Maximum icons. Default 100 |

`sync` skips a bundle that has none of `query`, `category`, or `source`.

## How selection works

A bundle selects icons by search, not by a list of names. `sync` searches with
the bundle's `query`, `category`, and `source`, and takes the first `limit`
results. This has two consequences:

- The set can include loosely related icons, or miss one you expected. Run
  `unicon search "<query>" --source <lib> --limit <n>` to see what the bundle
  will contain, and adjust the query or `limit`.
- `unicon bundle:add <bundle> <names...>` appends the names to `query`. It
  does not pin exact icons.

To control the exact icons, generate them with `unicon get` instead (see
[cli-commands.md](cli-commands.md)).

## Output

`sync` writes each bundle to one file at `output`. A React bundle is one
`.tsx` file that exports one component per icon:

```ts
import { ArrowRight, Menu } from "./src/icons/nav";
```

For one file per icon, use `unicon bundle -o <directory>` instead of the
config file.

## Formats

`sync` generates only two formats correctly:

| `format` | Result |
|----------|--------|
| `react` | One `.tsx` file with one component per icon |
| `json` | One `.json` file with the icon data |
| `svg` | All icons as separate `<svg>` elements in one file. This is not a valid standalone SVG; use it only to paste markup |
| `vue`, `svelte` | React (TSX) code. `sync` has no Vue or Svelte generator |

Without `format`, `sync` uses the framework in `package.json`. In a Vue or
Svelte project it therefore writes React code. Use the CLI commands instead
of the config file:

```bash
# Vue or Svelte components: one file per icon
unicon bundle --query "home settings user search" --source lucide --format vue -o src/components/icons

# Individual .svg files: one get per icon
unicon get github --source simple-icons --format svg -o public/icons/github.svg
```

## Examples

### Several bundles

```json
{
  "bundles": [
    {
      "name": "nav",
      "query": "arrow chevron menu",
      "source": "lucide",
      "limit": 20,
      "output": "./src/components/icons/nav.tsx"
    },
    {
      "name": "social",
      "category": "Social",
      "source": "simple-icons",
      "limit": 30,
      "output": "./src/components/icons/social.tsx"
    }
  ]
}
```

## Workflow

1. `unicon init` creates the file. `unicon add <name> --query ...` adds a
   bundle.
2. `unicon sync --dry-run` shows what each bundle would contain.
3. `unicon sync` writes the files. `unicon sync --watch` writes them again
   when the config changes.
4. `unicon audit` finds icons that are bundled but unused, or imported but not
   bundled.
