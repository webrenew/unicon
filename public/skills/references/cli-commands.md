# CLI Commands Reference

Every command and option in the Unicon CLI (`@webrenew/unicon` 0.3.x).

Run commands with `npx @webrenew/unicon <command>`, or with `unicon <command>`
after `npm install -g @webrenew/unicon`.

Commands marked **(interactive)** wait for keyboard input. Do not run them
from an agent without a terminal.

## Contents

- Find icons: [search](#unicon-search-query), [info](#unicon-info-name),
  [preview](#unicon-preview-name), [compare](#unicon-compare-concept),
  [browse](#unicon-browse), [sources](#unicon-sources),
  [categories](#unicon-categories)
- Generate code: [get](#unicon-get-name), [bundle](#unicon-bundle)
- Config file: [init](#unicon-init), [add](#unicon-add-name),
  [bundle:add](#unicon-bundleadd-bundle-icons), [sync](#unicon-sync),
  [audit](#unicon-audit)
- Favorites: [star](#unicon-star-name), [unstar](#unicon-unstar-name),
  [stars](#unicon-stars)
- Saved bundles from unicon.sh: [login](#unicon-login),
  [logout](#unicon-logout), [whoami](#unicon-whoami),
  [bundles](#unicon-bundles), [bundle:pull](#unicon-bundlepull-bundleid)
- Assistant skills: [skill](#unicon-skill), [skills](#unicon-skills)
- Other: [cache](#unicon-cache), [global options](#global-options),
  [environment variables](#environment-variables),
  [framework detection](#framework-detection)

---

## Find icons

### `unicon search <query>`

Semantic search: describe the concept, not the file name.

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --source <source>` | Filter by library | all |
| `-c, --category <category>` | Filter by category | all |
| `-l, --limit <number>` | Maximum results | 20 |
| `-j, --json` | Output JSON (use when a program reads the output) | off |
| `-p, --pick` | **(interactive)** Select results, then copy, save, star, or add them to a bundle | off |

```bash
unicon search "dashboard"
unicon search "arrow" --source lucide --limit 10 --json
```

### `unicon info <name>`

Show an icon's library, category, viewBox, tags, and example commands.

| Option | Description |
|--------|-------------|
| `-s, --source <source>` | Prefer this library |

### `unicon preview <name>`

Draw an icon as ASCII art in the terminal.

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --source <source>` | Prefer this library | |
| `-w, --width <number>` | Width in characters | 20 |
| `-h, --height <number>` | Height in characters | 20 |

### `unicon compare <concept>`

Show the same concept (for example `home`) from each library side by side, to
help choose a library.

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --width <number>` | Preview width | 16 |
| `-h, --height <number>` | Preview height | 10 |

### `unicon browse`

**(interactive)** Browse icons with fuzzy search.

| Option | Description |
|--------|-------------|
| `-s, --source <source>` | Filter by library |
| `-c, --category <category>` | Filter by category |

### `unicon sources`

List the icon libraries.

### `unicon categories`

List the icon categories. `-j, --json` outputs JSON.

---

## Generate code

### `unicon get <name>`

Write one icon to stdout, a file, or the clipboard.

`name` is the icon name without the library prefix (`log-out`, not
`lucide:log-out`). The CLI searches for the name and uses an exact match. If
there is no exact match, it uses the closest result, which can be a different
icon. Use names from `search` output.

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --source <source>` | Prefer this library | any |
| `-f, --format <format>` | `react`, `vue`, `svelte`, `svg`, `json` | from `package.json` |
| `-o, --output <path>` | Write to this file | stdout |
| `-c, --copy` | Copy to the clipboard | off |

```bash
unicon get settings --source lucide -o src/components/icons/settings.tsx
unicon get home --format vue -o src/components/icons/Home.vue
```

### `unicon bundle`

Write many icons at once, selected by query, category, library, or favorites.

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --query <query>` | Search query | |
| `-c, --category <category>` | Category filter | |
| `-s, --source <source>` | Library filter | all |
| `-f, --format <format>` | `react`, `vue`, `svelte`, `svg`, `json` | from `package.json` |
| `-o, --output <path>` | Output directory for components; output file for `svg`, `json`, or `--single-file` | `./icons` or `icons.<ext>` |
| `-l, --limit <number>` | Maximum icons | 100 |
| `--single-file` | Put every icon in one file. Not tree-shakeable, and not available for `vue` or `svelte` | off |
| `--stars` | Bundle the favorited icons | off |

For component formats (`react`, `vue`, `svelte`), `bundle` writes one file
per icon and an `index.ts` that re-exports them, so bundlers remove unused
icons. For `svg` and `json` it writes one file: `svg` puts every icon in it
as a separate `<svg>` element, which is not a valid standalone SVG. For
individual `.svg` files, run `unicon get <name> --format svg -o <file>.svg`
for each icon.

```bash
unicon bundle --query "social media" --source simple-icons -o src/components/icons/social
unicon bundle --category Arrows --source lucide --limit 30 -o src/components/icons/arrows
unicon bundle --stars -o src/components/icons/favorites
unicon bundle --query "logos" --format json -o src/data/logos.json
```

---

## Config file

See [config-file.md](config-file.md) for the file format.

### `unicon init`

Create `.uniconrc.json` in the current directory.

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite an existing config |
| `-i, --interactive` | **(interactive)** Choose the framework, library, output directory, and a first bundle |

### `unicon add <name>`

Add a bundle entry to `.uniconrc.json`, creating the file if needed. It does
not generate code; run `unicon sync` afterwards.

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --query <query>` | Search query | |
| `-c, --category <category>` | Category filter | |
| `-s, --source <source>` | Library filter | all |
| `-f, --format <format>` | `react`, `svg`, or `json` | `react` |
| `-l, --limit <number>` | Maximum icons | 50 |
| `-o, --output <path>` | Output file | `./src/icons/<name>.<ext>` |

```bash
unicon add nav --query "arrow chevron menu" --source lucide --limit 20
unicon add social --category Social --source simple-icons
```

### `unicon bundle:add <bundle> <icons...>`

Append names to an existing bundle's `query`, then sync that bundle. Bundles
select icons by search, so check the result.

```bash
unicon bundle:add nav home settings
```

### `unicon sync`

Generate the code for each bundle in `.uniconrc.json`. Each bundle is written
to one file at its `output` path. `sync` generates React or JSON only: `vue`
and `svelte` bundles get React code, and `svg` bundles get several `<svg>`
elements in one file. Use `unicon bundle` for Vue or Svelte components, and
`unicon get` for individual `.svg` files.

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | Sync only this bundle |
| `-d, --dry-run` | Show what would be written, without writing |
| `-w, --watch` | Sync again when the config changes (runs until stopped) |

### `unicon audit`

Compare the bundled icons with the icons the code imports. It reports unused
icons (bundled but not imported) and missing icons (imported but not bundled).

| Option | Description |
|--------|-------------|
| `-j, --json` | Output JSON |
| `-v, --verbose` | Show the file locations for each icon |

---

## Favorites

Favorites are stored locally in `~/.unicon`.

### `unicon star <name>`

Add an icon to favorites. `-s, --source <source>` prefers a library.

### `unicon unstar <name>`

Remove an icon from favorites.

### `unicon stars`

List favorites. `-j, --json` outputs JSON. Use `unicon bundle --stars` to
generate them.

---

## Saved bundles from unicon.sh

Bundles saved on https://unicon.sh/bundles can be pulled into a project.

### `unicon login`

Sign in with a device code in the browser. Credentials are saved to
`~/.unicon/auth.json`. Set `UNICON_API_TOKEN` instead in CI.

### `unicon logout`

Remove the saved credentials.

### `unicon whoami`

Show whether the CLI is signed in.

### `unicon bundles`

List your saved bundles (requires login). `-j, --json` outputs JSON.

### `unicon bundle:pull <bundleId>`

Write a saved bundle into the project (requires login).

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output file | `src/components/icons/bundle.tsx` |
| `-f, --format <format>` | `react`, `svg`, or `json` | `react` |

---

## Assistant skills

### `unicon skill`

Install the Unicon skill (`SKILL.md` and its references) into a project for
coding assistants.

| Option | Description |
|--------|-------------|
| `--ide <ide>` | `claude`, `codex`, `cursor`, `agents`, `windsurf`, `opencode`, or `gemini` |
| `--all` | Install for every supported assistant |
| `-l, --list` | List the supported assistants and install paths |
| `-f, --force` | Overwrite existing files |
| `-y, --yes` | Skip the confirmation prompt |

Each assistant gets `.<ide>/skills/unicon/` (for example
`.claude/skills/unicon/SKILL.md`). Run `unicon skill --list` for the exact
paths.

### `unicon skills`

List and download skills from the registry at https://unicon.sh/skills.

| Option | Description |
|--------|-------------|
| `-l, --list` | List skills |
| `-g, --get <id>` | Print a skill (`unicon` or `unicon-mcp`) |
| `-o, --output <path>` | Write the skill to a file instead |
| `-j, --json` | Output the list as JSON |

---

## Other

### `unicon cache`

API responses are cached in `~/.unicon/cache` for 24 hours.

| Option | Description |
|--------|-------------|
| `-s, --stats` | Show cache size and entries |
| `-c, --clear` | Delete the cache |

### Global options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help for the CLI or a command |
| `-V, --version` | Show the version |

### Environment variables

| Variable | Description |
|----------|-------------|
| `UNICON_API_URL` | API base URL (default `https://unicon.sh`), for a self-hosted Unicon |
| `UNICON_API_TOKEN` | API token for saved bundles, used instead of `unicon login` |

### Framework detection

When no `--format` is given, the CLI reads `package.json` dependencies:

| Dependencies | Format |
|--------------|--------|
| `react`, `next`, `@remix-run/react` | `react` |
| `vue`, `nuxt`, `@nuxt/kit` | `vue` |
| `svelte`, `@sveltejs/kit` | `svelte` |
| none of these | `react` |
