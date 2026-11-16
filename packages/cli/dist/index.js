#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import figlet from "figlet";
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { dirname, resolve, join, extname } from "path";
import { homedir } from "os";
import { createRequire } from "module";
import { createInterface } from "readline";
import * as p from "@clack/prompts";
import clipboard from "clipboardy";
import chokidar from "chokidar";

// ../../skills/unicon/SKILL.md
var SKILL_default = '---\nname: unicon\ndescription: Adds icons to web projects with Unicon, which generates zero-dependency icon code from 19,000+ icons in Lucide, Phosphor, Hugeicons, Heroicons, Tabler, Feather, Remix, Iconoir, and Simple Icons (brand logos). Searches icons semantically, then writes React, Vue, Svelte, SVG, or JSON into the project with the `unicon` CLI (`npx @webrenew/unicon`) or the unicon.sh REST API. Use this skill whenever the user wants to add, find, replace, or bundle icons or brand logos in a React, Next.js, Vue, Nuxt, Svelte, or HTML project, mentions Unicon, `.uniconrc.json`, or `unicon` commands, or wants icons without adding a package such as lucide-react or react-icons, even if they only say "put a settings icon here" or "I need the GitHub logo". When Unicon MCP tools are connected, see the unicon-mcp skill.\nlicense: MIT\ncompatibility: Requires Node.js 18+ for the CLI and network access to https://unicon.sh.\nmetadata:\n  author: webrenew\n  version: "0.3.0"\n  website: https://unicon.sh\n  repository: https://github.com/WebRenew/unicon\n  openclaw:\n    emoji: "\u{1F984}"\n    requires:\n      bins: ["node"]\n    install:\n      - type: node\n        package: "@webrenew/unicon"\n        global: true\n---\n\n# Unicon\n\nUnicon writes icon source code into the project instead of adding an icon\npackage. Each icon becomes a small component, SVG file, or JSON object that the\nproject owns. Only the icons in use ship, and there is no dependency to install\nor upgrade.\n\nRun the CLI with `npx @webrenew/unicon <command>`. If it is installed globally\n(`npm install -g @webrenew/unicon`), use `unicon <command>`. Every command\ncalls https://unicon.sh, so it needs network access.\n\nRun `npx` commands one at a time, not in parallel. Parallel `npx` runs share\nthe npm cache, and the first run can fail with `EEXIST` or a missing module\nwhile the package downloads. If that happens, run the command again.\n\n## Choose an approach\n\n| The user wants | Use |\n|----------------|-----|\n| One icon, or a few specific icons | `unicon get <name>`, once per icon |\n| A themed set of icons (navigation, social, ...) | `unicon bundle --query ... -o <dir>` |\n| A set the team regenerates later | `.uniconrc.json` and `unicon sync` |\n| Icons fetched from code, or no Node.js | The REST API, see [api-reference.md](references/api-reference.md) |\n| Unicon MCP tools are connected | The MCP tools, see the unicon-mcp skill |\n\n## Workflow\n\n### 1. Match the project\n\nRead `package.json` and look at the icons the project already uses before you\nadd new ones. Icon libraries differ in stroke width, corner style, and grid,\nso icons from two libraries side by side look inconsistent. If the project\nalready uses one style, keep to its library with `--source`. For example, a\nshadcn/ui project uses Lucide, so use `--source lucide`. Use `simple-icons`\nfor brand logos.\n\n### 2. Search, then use exact names\n\n```bash\nnpx @webrenew/unicon search "log out" --source lucide --limit 10 --json\n```\n\nSearch is semantic, so describe the concept ("sign out", "delete") instead of\nguessing a file name. Results identify icons as `source:name`, for example\n`lucide:log-out`. The same name exists in several libraries, so pass the\nsame `--source` to `get` or `bundle` to get the icon you picked. Use `--json`\nwhen you read the results yourself, because the default output is formatted\nfor people.\n\n### 3. Generate the code\n\n**Specific icons:** use `get` for each icon. This gives an exact set:\n\n```bash\nnpx @webrenew/unicon get log-out --source lucide -o src/components/icons/log-out.tsx\nnpx @webrenew/unicon get settings --source lucide -o src/components/icons/settings.tsx\n```\n\n`get` takes the name part of the ID (`log-out`, not `lucide:log-out`). It\nsearches for that name and uses an exact match. If there is no exact match,\nit silently uses the closest result, which can be a different icon. Copy names\nfrom the `search` output, and check the component name in the generated file.\n\nWithout `-o`, the code goes to stdout. The format follows the framework in\n`package.json`: `react`, `next`, or `@remix-run/react` give `react`; `vue`\nor `nuxt` give `vue`; `svelte` or `@sveltejs/kit` give `svelte`. Otherwise\nthe format is `react`. Pass `--format react|vue|svelte|svg|json` to choose\nthe format yourself.\n\n**A themed set:** use `bundle` into a directory:\n\n```bash\nnpx @webrenew/unicon bundle --query "arrows chevrons" --source lucide --limit 20 -o src/components/icons\n```\n\nFor `react`, `vue`, and `svelte`, this writes one file per icon and an\n`index.ts` that re-exports them, so bundlers remove the icons the app does not\nimport. For `svg` and `json`, it writes one file at `-o` instead. For\nindividual `.svg` files, use `get --format svg` for each icon. A query returns up to\n`--limit` matches (default 100), and some can be loosely related. Run the\nsame `search` first and set `--limit` to the number of matches you want.\n`--single-file` writes one file instead (React, SVG, or JSON only), and that\nfile is not tree-shakeable.\n\n**A repeatable set:** use the config file:\n\n```bash\nnpx @webrenew/unicon add nav --query "arrow chevron menu" --source lucide --limit 20\nnpx @webrenew/unicon sync\n```\n\n`add` creates an entry in `.uniconrc.json`. `sync` writes each entry to one\nfile, by default `./src/icons/<name>.tsx`. Config entries select icons by\nsearch query, not by exact name, so check the result after `sync`. `sync`\ngenerates React or JSON only. In a Vue or Svelte project it writes React\ncode, so use `bundle` or `get` there. Read\n[config-file.md](references/config-file.md) before you edit the config by\nhand.\n\n### 4. Use the icons and verify\n\nGenerated React components look like this:\n\n```tsx\nexport function LogOut({ className, ...props }: SVGProps<SVGSVGElement>) {\n  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" /* ... */ className={className} {...props} />;\n}\n```\n\n- Components use `currentColor`, so set the color with CSS or text classes.\n- Components have no fixed size. Set the size with `className`, for example\n  `className="size-4"`, or with `width` and `height`.\n- Components are `aria-hidden`. Next to an icon-only button, add an\n  `aria-label` to the button.\n- Simple Icons logos are fill-based and include the brand color in the API\n  data (`brandColor`).\n\nImport from the generated path, then run the project\'s typecheck or build to\nconfirm that the imports resolve.\n\n## Commands that need a terminal\n\n`search --pick`, `init --interactive`, and `browse` wait for keyboard input.\nThey stop an agent that runs commands without a terminal. Use the\nnon-interactive flags shown above instead. `--copy` copies to the clipboard,\nwhich is useful for a person, not for an agent.\n\n## Libraries\n\n| Source | Icons | Notes |\n|--------|-------|-------|\n| `lucide` | 1,900+ | Stroke icons, the shadcn/ui default |\n| `phosphor` | 1,500+ | |\n| `hugeicons` | 1,800+ | |\n| `heroicons` | 640+ | Tailwind Labs |\n| `tabler` | 4,900+ | Stroke icons, largest set |\n| `feather` | 280+ | Lucide\'s predecessor |\n| `remix` | 3,100+ | |\n| `iconoir` | 1,600+ | |\n| `simple-icons` | 3,300+ | Brand logos |\n\n`npx @webrenew/unicon sources` prints the current list.\n\n## References\n\n- [cli-commands.md](references/cli-commands.md): every command and flag.\n  Read it for options not shown here, or for `audit`, `compare`, `stars`,\n  `login`, `bundles`, and `bundle:pull`.\n- [config-file.md](references/config-file.md): the `.uniconrc.json` fields.\n  Read it before you write or edit the config by hand.\n- [api-reference.md](references/api-reference.md): REST endpoints,\n  parameters, the response format, and rate limits. Read it when code calls\n  unicon.sh directly or when the CLI is not available.\n';

// ../../skills/unicon/references/cli-commands.md
var cli_commands_default = '# CLI Commands Reference\n\nEvery command and option in the Unicon CLI (`@webrenew/unicon` 0.3.x).\n\nRun commands with `npx @webrenew/unicon <command>`, or with `unicon <command>`\nafter `npm install -g @webrenew/unicon`.\n\nCommands marked **(interactive)** wait for keyboard input. Do not run them\nfrom an agent without a terminal.\n\n## Contents\n\n- Find icons: [search](#unicon-search-query), [info](#unicon-info-name),\n  [preview](#unicon-preview-name), [compare](#unicon-compare-concept),\n  [browse](#unicon-browse), [sources](#unicon-sources),\n  [categories](#unicon-categories)\n- Generate code: [get](#unicon-get-name), [bundle](#unicon-bundle)\n- Config file: [init](#unicon-init), [add](#unicon-add-name),\n  [bundle:add](#unicon-bundleadd-bundle-icons), [sync](#unicon-sync),\n  [audit](#unicon-audit)\n- Favorites: [star](#unicon-star-name), [unstar](#unicon-unstar-name),\n  [stars](#unicon-stars)\n- Saved bundles from unicon.sh: [login](#unicon-login),\n  [logout](#unicon-logout), [whoami](#unicon-whoami),\n  [bundles](#unicon-bundles), [bundle:pull](#unicon-bundlepull-bundleid)\n- Assistant skills: [skill](#unicon-skill), [skills](#unicon-skills)\n- Other: [cache](#unicon-cache), [global options](#global-options),\n  [environment variables](#environment-variables),\n  [framework detection](#framework-detection)\n\n---\n\n## Find icons\n\n### `unicon search <query>`\n\nSemantic search: describe the concept, not the file name.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-s, --source <source>` | Filter by library | all |\n| `-c, --category <category>` | Filter by category | all |\n| `-l, --limit <number>` | Maximum results | 20 |\n| `-j, --json` | Output JSON (use when a program reads the output) | off |\n| `-p, --pick` | **(interactive)** Select results, then copy, save, star, or add them to a bundle | off |\n\n```bash\nunicon search "dashboard"\nunicon search "arrow" --source lucide --limit 10 --json\n```\n\n### `unicon info <name>`\n\nShow an icon\'s library, category, viewBox, tags, and example commands.\n\n| Option | Description |\n|--------|-------------|\n| `-s, --source <source>` | Prefer this library |\n\n### `unicon preview <name>`\n\nDraw an icon as ASCII art in the terminal.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-s, --source <source>` | Prefer this library | |\n| `-w, --width <number>` | Width in characters | 20 |\n| `-h, --height <number>` | Height in characters | 20 |\n\n### `unicon compare <concept>`\n\nShow the same concept (for example `home`) from each library side by side, to\nhelp choose a library.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-w, --width <number>` | Preview width | 16 |\n| `-h, --height <number>` | Preview height | 10 |\n\n### `unicon browse`\n\n**(interactive)** Browse icons with fuzzy search.\n\n| Option | Description |\n|--------|-------------|\n| `-s, --source <source>` | Filter by library |\n| `-c, --category <category>` | Filter by category |\n\n### `unicon sources`\n\nList the icon libraries.\n\n### `unicon categories`\n\nList the icon categories. `-j, --json` outputs JSON.\n\n---\n\n## Generate code\n\n### `unicon get <name>`\n\nWrite one icon to stdout, a file, or the clipboard.\n\n`name` is the icon name without the library prefix (`log-out`, not\n`lucide:log-out`). The CLI searches for the name and uses an exact match. If\nthere is no exact match, it uses the closest result, which can be a different\nicon. Use names from `search` output.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-s, --source <source>` | Prefer this library | any |\n| `-f, --format <format>` | `react`, `vue`, `svelte`, `svg`, `json` | from `package.json` |\n| `-o, --output <path>` | Write to this file | stdout |\n| `-c, --copy` | Copy to the clipboard | off |\n\n```bash\nunicon get settings --source lucide -o src/components/icons/settings.tsx\nunicon get home --format vue -o src/components/icons/Home.vue\n```\n\n### `unicon bundle`\n\nWrite many icons at once, selected by query, category, library, or favorites.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-q, --query <query>` | Search query | |\n| `-c, --category <category>` | Category filter | |\n| `-s, --source <source>` | Library filter | all |\n| `-f, --format <format>` | `react`, `vue`, `svelte`, `svg`, `json` | from `package.json` |\n| `-o, --output <path>` | Output directory for components; output file for `svg`, `json`, or `--single-file` | `./icons` or `icons.<ext>` |\n| `-l, --limit <number>` | Maximum icons | 100 |\n| `--single-file` | Put every icon in one file. Not tree-shakeable, and not available for `vue` or `svelte` | off |\n| `--stars` | Bundle the favorited icons | off |\n\nFor component formats (`react`, `vue`, `svelte`), `bundle` writes one file\nper icon and an `index.ts` that re-exports them, so bundlers remove unused\nicons. For `svg` and `json` it writes one file: `svg` puts every icon in it\nas a separate `<svg>` element, which is not a valid standalone SVG. For\nindividual `.svg` files, run `unicon get <name> --format svg -o <file>.svg`\nfor each icon.\n\n```bash\nunicon bundle --query "social media" --source simple-icons -o src/components/icons/social\nunicon bundle --category Arrows --source lucide --limit 30 -o src/components/icons/arrows\nunicon bundle --stars -o src/components/icons/favorites\nunicon bundle --query "logos" --format json -o src/data/logos.json\n```\n\n---\n\n## Config file\n\nSee [config-file.md](config-file.md) for the file format.\n\n### `unicon init`\n\nCreate `.uniconrc.json` in the current directory.\n\n| Option | Description |\n|--------|-------------|\n| `-f, --force` | Overwrite an existing config |\n| `-i, --interactive` | **(interactive)** Choose the framework, library, output directory, and a first bundle |\n\n### `unicon add <name>`\n\nAdd a bundle entry to `.uniconrc.json`, creating the file if needed. It does\nnot generate code; run `unicon sync` afterwards.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-q, --query <query>` | Search query | |\n| `-c, --category <category>` | Category filter | |\n| `-s, --source <source>` | Library filter | all |\n| `-f, --format <format>` | `react`, `svg`, or `json` | `react` |\n| `-l, --limit <number>` | Maximum icons | 50 |\n| `-o, --output <path>` | Output file | `./src/icons/<name>.<ext>` |\n\n```bash\nunicon add nav --query "arrow chevron menu" --source lucide --limit 20\nunicon add social --category Social --source simple-icons\n```\n\n### `unicon bundle:add <bundle> <icons...>`\n\nAppend names to an existing bundle\'s `query`, then sync that bundle. Bundles\nselect icons by search, so check the result.\n\n```bash\nunicon bundle:add nav home settings\n```\n\n### `unicon sync`\n\nGenerate the code for each bundle in `.uniconrc.json`. Each bundle is written\nto one file at its `output` path. `sync` generates React or JSON only: `vue`\nand `svelte` bundles get React code, and `svg` bundles get several `<svg>`\nelements in one file. Use `unicon bundle` for Vue or Svelte components, and\n`unicon get` for individual `.svg` files.\n\n| Option | Description |\n|--------|-------------|\n| `-n, --name <name>` | Sync only this bundle |\n| `-d, --dry-run` | Show what would be written, without writing |\n| `-w, --watch` | Sync again when the config changes (runs until stopped) |\n\n### `unicon audit`\n\nCompare the bundled icons with the icons the code imports. It reports unused\nicons (bundled but not imported) and missing icons (imported but not bundled).\n\n| Option | Description |\n|--------|-------------|\n| `-j, --json` | Output JSON |\n| `-v, --verbose` | Show the file locations for each icon |\n\n---\n\n## Favorites\n\nFavorites are stored locally in `~/.unicon`.\n\n### `unicon star <name>`\n\nAdd an icon to favorites. `-s, --source <source>` prefers a library.\n\n### `unicon unstar <name>`\n\nRemove an icon from favorites.\n\n### `unicon stars`\n\nList favorites. `-j, --json` outputs JSON. Use `unicon bundle --stars` to\ngenerate them.\n\n---\n\n## Saved bundles from unicon.sh\n\nBundles saved on https://unicon.sh/bundles can be pulled into a project.\n\n### `unicon login`\n\nSign in with a device code in the browser. Credentials are saved to\n`~/.unicon/auth.json`. Set `UNICON_API_TOKEN` instead in CI.\n\n### `unicon logout`\n\nRemove the saved credentials.\n\n### `unicon whoami`\n\nShow whether the CLI is signed in.\n\n### `unicon bundles`\n\nList your saved bundles (requires login). `-j, --json` outputs JSON.\n\n### `unicon bundle:pull <bundleId>`\n\nWrite a saved bundle into the project (requires login).\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-o, --output <path>` | Output file | `src/components/icons/bundle.tsx` |\n| `-f, --format <format>` | `react`, `svg`, or `json` | `react` |\n\n---\n\n## Assistant skills\n\n### `unicon skill`\n\nInstall the Unicon skill (`SKILL.md` and its references) into a project for\ncoding assistants.\n\n| Option | Description |\n|--------|-------------|\n| `--ide <ide>` | `claude`, `codex`, `cursor`, `agents`, `windsurf`, `opencode`, or `gemini` |\n| `--all` | Install for every supported assistant |\n| `-l, --list` | List the supported assistants and install paths |\n| `-f, --force` | Overwrite existing files |\n| `-y, --yes` | Skip the confirmation prompt |\n\nEach assistant gets `.<ide>/skills/unicon/` (for example\n`.claude/skills/unicon/SKILL.md`). Run `unicon skill --list` for the exact\npaths.\n\n### `unicon skills`\n\nList and download skills from the registry at https://unicon.sh/skills.\n\n| Option | Description |\n|--------|-------------|\n| `-l, --list` | List skills |\n| `-g, --get <id>` | Print a skill (`unicon` or `unicon-mcp`) |\n| `-o, --output <path>` | Write the skill to a file instead |\n| `-j, --json` | Output the list as JSON |\n\n---\n\n## Other\n\n### `unicon cache`\n\nAPI responses are cached in `~/.unicon/cache` for 24 hours.\n\n| Option | Description |\n|--------|-------------|\n| `-s, --stats` | Show cache size and entries |\n| `-c, --clear` | Delete the cache |\n\n### Global options\n\n| Option | Description |\n|--------|-------------|\n| `-h, --help` | Show help for the CLI or a command |\n| `-V, --version` | Show the version |\n\n### Environment variables\n\n| Variable | Description |\n|----------|-------------|\n| `UNICON_API_URL` | API base URL (default `https://unicon.sh`), for a self-hosted Unicon |\n| `UNICON_API_TOKEN` | API token for saved bundles, used instead of `unicon login` |\n\n### Framework detection\n\nWhen no `--format` is given, the CLI reads `package.json` dependencies:\n\n| Dependencies | Format |\n|--------------|--------|\n| `react`, `next`, `@remix-run/react` | `react` |\n| `vue`, `nuxt`, `@nuxt/kit` | `vue` |\n| `svelte`, `@sveltejs/kit` | `svelte` |\n| none of these | `react` |\n';

// ../../skills/unicon/references/config-file.md
var config_file_default = '# `.uniconrc.json` Reference\n\n`.uniconrc.json` lists icon bundles for `unicon sync` to generate. Put it in\nthe project root, next to `package.json`, and commit it together with the\ngenerated files so the team can regenerate the same icons.\n\n## Format\n\n```json\n{\n  "$schema": "https://unicon.sh/schema/uniconrc.json",\n  "bundles": [\n    {\n      "name": "nav",\n      "query": "arrow chevron menu",\n      "source": "lucide",\n      "limit": 20,\n      "format": "react",\n      "output": "./src/icons/nav.tsx"\n    }\n  ]\n}\n```\n\nThe CLI reads only these fields. It ignores any other field, so a setting\nsuch as `outputDir` or `strokeWidth` has no effect.\n\n### Root\n\n| Field | Type | Description |\n|-------|------|-------------|\n| `$schema` | string | Optional. Written by `unicon init` |\n| `bundles` | array | The bundles to generate |\n\n### Bundle\n\n| Field | Type | Required | Description |\n|-------|------|----------|-------------|\n| `name` | string | yes | Unique bundle name, used by `sync --name` and `bundle:add` |\n| `output` | string | yes | File to write, relative to the project root |\n| `query` | string | one of `query`, `category`, `source` | Semantic search query |\n| `category` | string | one of `query`, `category`, `source` | Category filter, for example `Arrows` |\n| `source` | string | one of `query`, `category`, `source` | Library: `lucide`, `phosphor`, `hugeicons`, `heroicons`, `tabler`, `feather`, `remix`, `iconoir`, `simple-icons` |\n| `format` | string | no | `react` (default) or `json`. See [Formats](#formats) before using `svg`, `vue`, or `svelte` |\n| `limit` | number | no | Maximum icons. Default 100 |\n\n`sync` skips a bundle that has none of `query`, `category`, or `source`.\n\n## How selection works\n\nA bundle selects icons by search, not by a list of names. `sync` searches with\nthe bundle\'s `query`, `category`, and `source`, and takes the first `limit`\nresults. This has two consequences:\n\n- The set can include loosely related icons, or miss one you expected. Run\n  `unicon search "<query>" --source <lib> --limit <n>` to see what the bundle\n  will contain, and adjust the query or `limit`.\n- `unicon bundle:add <bundle> <names...>` appends the names to `query`. It\n  does not pin exact icons.\n\nTo control the exact icons, generate them with `unicon get` instead (see\n[cli-commands.md](cli-commands.md)).\n\n## Output\n\n`sync` writes each bundle to one file at `output`. A React bundle is one\n`.tsx` file that exports one component per icon:\n\n```ts\nimport { ArrowRight, Menu } from "./src/icons/nav";\n```\n\nFor one file per icon, use `unicon bundle -o <directory>` instead of the\nconfig file.\n\n## Formats\n\n`sync` generates only two formats correctly:\n\n| `format` | Result |\n|----------|--------|\n| `react` | One `.tsx` file with one component per icon |\n| `json` | One `.json` file with the icon data |\n| `svg` | All icons as separate `<svg>` elements in one file. This is not a valid standalone SVG; use it only to paste markup |\n| `vue`, `svelte` | React (TSX) code. `sync` has no Vue or Svelte generator |\n\nWithout `format`, `sync` uses the framework in `package.json`. In a Vue or\nSvelte project it therefore writes React code. Use the CLI commands instead\nof the config file:\n\n```bash\n# Vue or Svelte components: one file per icon\nunicon bundle --query "home settings user search" --source lucide --format vue -o src/components/icons\n\n# Individual .svg files: one get per icon\nunicon get github --source simple-icons --format svg -o public/icons/github.svg\n```\n\n## Examples\n\n### Several bundles\n\n```json\n{\n  "bundles": [\n    {\n      "name": "nav",\n      "query": "arrow chevron menu",\n      "source": "lucide",\n      "limit": 20,\n      "output": "./src/components/icons/nav.tsx"\n    },\n    {\n      "name": "social",\n      "category": "Social",\n      "source": "simple-icons",\n      "limit": 30,\n      "output": "./src/components/icons/social.tsx"\n    }\n  ]\n}\n```\n\n## Workflow\n\n1. `unicon init` creates the file. `unicon add <name> --query ...` adds a\n   bundle.\n2. `unicon sync --dry-run` shows what each bundle would contain.\n3. `unicon sync` writes the files. `unicon sync --watch` writes them again\n   when the config changes.\n4. `unicon audit` finds icons that are bundled but unused, or imported but not\n   bundled.\n';

// ../../skills/unicon/references/api-reference.md
var api_reference_default = '# API Reference\n\nThe REST API returns icon data for code that calls unicon.sh directly. No\nauthentication is needed for these endpoints.\n\n**Base URL**: `https://unicon.sh/api`\n\n**Rate limit**: 60 requests per minute per IP address, shared across these\nendpoints. Over the limit, the API returns `429` with `Retry-After` and\n`X-RateLimit-*` headers. Cache results instead of searching on every\nkeystroke.\n\n---\n\n## GET /api/icons\n\nFetch icons with optional filters. Supports AI-powered semantic search.\nAllows cross-origin requests (`Access-Control-Allow-Origin: *`).\n\n### Parameters\n\n| Parameter | Type | Description | Default |\n|-----------|------|-------------|---------|\n| `q` | string | Search query. Semantic search for 3+ characters, text search otherwise | - |\n| `source` | string | Filter by library | all |\n| `category` | string | Filter by category (text search and browsing only) | all |\n| `names` | string | Comma-separated exact normalized names, for example `home,settings`. Returns every library\'s icon with each name | - |\n| `limit` | number | Results per page (max 320) | 100 |\n| `offset` | number | Pagination offset | 0 |\n| `ai` | boolean | `false` uses fast text search instead of semantic search | true |\n\n### Response\n\n```json\n{\n  "icons": [\n    {\n      "id": "lucide:home",\n      "name": "Home",\n      "normalizedName": "home",\n      "sourceId": "lucide",\n      "category": "Buildings",\n      "tags": ["house", "building", "residence"],\n      "viewBox": "0 0 24 24",\n      "content": "<path d=\\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\\"/>...",\n      "defaultStroke": true,\n      "defaultFill": false,\n      "strokeWidth": "2",\n      "brandColor": null\n    }\n  ],\n  "hasMore": true,\n  "searchType": "semantic",\n  "expandedQuery": "home house building residence dwelling"\n}\n```\n\nText search and browsing responses also include `total`, the number of\nmatching icons. Semantic responses do not.\n\n### Search Types\n\n| Type | Description |\n|------|-------------|\n| `semantic` | AI-powered vector search with query expansion |\n| `text` | Name and tag matching with aliases (`ai=false`, short queries, or fallback) |\n| `exact` | Exact name match (when using `names` param) |\n\n### Examples\n\n```bash\n# Search with AI\ncurl "https://unicon.sh/api/icons?q=dashboard"\n\n# Filter by source\ncurl "https://unicon.sh/api/icons?q=arrow&source=lucide"\n\n# Get specific icons by name\ncurl "https://unicon.sh/api/icons?names=home,settings,user"\n\n# Browse by category\ncurl "https://unicon.sh/api/icons?category=Social&limit=50"\n\n# Disable AI search\ncurl "https://unicon.sh/api/icons?q=home&ai=false"\n```\n\n---\n\n## POST /api/search\n\nHybrid semantic + exact match search with scoring.\n\n### Request Body\n\n```json\n{\n  "query": "string (required)",\n  "sourceId": "string (optional)",\n  "limit": "number (optional, default 50, max 320)",\n  "offset": "number (optional, default 0)",\n  "useAI": "boolean (optional, default false)"\n}\n```\n\nQueries shorter than 3 characters use text search. `useAI: true` asks Claude\nto expand queries that the built-in synonyms do not cover, with a 2-second\ntime limit.\n\n### Response\n\n```json\n{\n  "results": [\n    {\n      "id": "lucide:home",\n      "name": "Home",\n      "normalizedName": "home",\n      "sourceId": "lucide",\n      "category": "Buildings",\n      "tags": ["house", "building"],\n      "viewBox": "0 0 24 24",\n      "content": "<path ... />",\n      "defaultStroke": true,\n      "defaultFill": false,\n      "strokeWidth": "2",\n      "brandColor": null,\n      "score": 0.95\n    }\n  ],\n  "searchType": "semantic",\n  "expandedQuery": "home house building residence",\n  "hasMore": true\n}\n```\n\n### Score\n\nResults include a `score` (0-1) combining:\n- **Semantic similarity** (60% weight) - Vector distance\n- **Exact match boost** (40% weight) - Name/tag/category matches\n\n### Examples\n\n```bash\n# Basic search\ncurl -X POST "https://unicon.sh/api/search" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"query": "dashboard"}\'\n\n# Filter by source\ncurl -X POST "https://unicon.sh/api/search" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"query": "arrow", "sourceId": "phosphor", "limit": 20}\'\n\n# Enable AI expansion\ncurl -X POST "https://unicon.sh/api/search" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"query": "celebration", "useAI": true}\'\n```\n\n---\n\n## Icon Data Schema\n\n```typescript\ninterface IconData {\n  id: string;              // "lucide:home"\n  name: string;            // "Home" (PascalCase)\n  normalizedName: string;  // "home" (kebab-case)\n  sourceId: string;        // "lucide", "phosphor", etc.\n  category: string | null; // "Buildings", "Arrows", etc.\n  tags: string[];          // ["house", "building"]\n  viewBox: string;         // "0 0 24 24"\n  content: string;         // Raw SVG inner content\n  pathData: { tag: string; attrs: Record<string, string> }[] | null; // Parsed elements (semantic results only)\n  defaultStroke: boolean;  // Uses stroke for rendering\n  defaultFill: boolean;    // Uses fill for rendering\n  strokeWidth: string | null;\n  brandColor: string | null; // Hex color for brand icons\n}\n```\n\n---\n\n## Available Sources\n\n| ID | Name | Icons |\n|----|------|-------|\n| `lucide` | Lucide | 1,900+ |\n| `phosphor` | Phosphor | 1,500+ |\n| `hugeicons` | Huge Icons | 1,800+ |\n| `heroicons` | Heroicons | 640+ |\n| `tabler` | Tabler | 4,900+ |\n| `feather` | Feather | 280+ |\n| `remix` | Remix Icon | 3,100+ |\n| `iconoir` | Iconoir | 1,600+ |\n| `simple-icons` | Simple Icons (brand logos) | 3,300+ |\n\n---\n\n## Caching\n\nResponses are cached at the CDN:\n\n| Request | Cache time |\n|---------|-----------|\n| Browsing, text search, `names` | 1 hour |\n| Semantic search (`GET /api/icons?q=...`) | 30 minutes |\n| `POST /api/search` with an AI-expanded query | 1 minute |\n\nRequests that the CDN answers from its cache never reach the server and do\nnot count toward the rate limit.\n\n---\n\n## Usage in Code\n\n### JavaScript/TypeScript\n\n```typescript\nasync function searchIcons(query: string) {\n  const response = await fetch(\n    `https://unicon.sh/api/icons?q=${encodeURIComponent(query)}`\n  );\n  const { icons } = await response.json();\n  return icons;\n}\n\n// Get specific icons\nasync function getIcons(names: string[]) {\n  const response = await fetch(\n    `https://unicon.sh/api/icons?names=${names.join(",")}`\n  );\n  const { icons } = await response.json();\n  return icons;\n}\n```\n\n### Rendering Icons\n\n```tsx\nfunction Icon({ icon }: { icon: IconData }) {\n  return (\n    <svg\n      viewBox={icon.viewBox}\n      dangerouslySetInnerHTML={{ __html: icon.content }}\n      fill={icon.defaultFill ? "currentColor" : "none"}\n      stroke={icon.defaultStroke ? "currentColor" : "none"}\n      strokeWidth={icon.strokeWidth ?? 2}\n    />\n  );\n}\n```\n\n---\n\n## Error Responses\n\n```json\n{\n  "error": "Failed to fetch icons"\n}\n```\n\n| Status | Description |\n|--------|-------------|\n| 400 | Invalid request (missing query, invalid `limit` or `offset`, etc.) |\n| 429 | Rate limit exceeded. Wait for `Retry-After` seconds |\n| 500 | Server error |\n';

// src/index.ts
var require2 = createRequire(import.meta.url);
var { version: CLI_VERSION } = require2("../package.json");
function confirm2(message) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve2) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve2(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
var API_BASE = process.env.UNICON_API_URL || "https://unicon.sh";
var CONFIG_FILE = ".uniconrc.json";
var UNICON_DIR = join(homedir(), ".unicon");
var CACHE_DIR = join(UNICON_DIR, "cache");
var FAVORITES_FILE = join(UNICON_DIR, "favorites.json");
var AUTH_FILE = join(UNICON_DIR, "auth.json");
var CACHE_TTL = 24 * 60 * 60 * 1e3;
function ensureUniconDir() {
  if (!existsSync(UNICON_DIR)) {
    mkdirSync(UNICON_DIR, { recursive: true });
  }
}
function loadAuth() {
  if (!existsSync(AUTH_FILE)) {
    return null;
  }
  try {
    const content = readFileSync(AUTH_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function saveAuth(data) {
  ensureUniconDir();
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function clearAuth() {
  if (existsSync(AUTH_FILE)) {
    unlinkSync(AUTH_FILE);
  }
}
function getAuthToken() {
  if (process.env.UNICON_API_TOKEN) {
    return process.env.UNICON_API_TOKEN;
  }
  const auth = loadAuth();
  return auth?.access_token || null;
}
async function startDeviceAuth() {
  const res = await fetch(`${API_BASE}/api/auth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "CLI", scope: "bundles:read" })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error_description || error.error || "Failed to start device authorization");
  }
  return res.json();
}
async function pollForToken(deviceCode, interval, expiresIn) {
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1e3;
  while (Date.now() < expiresAt) {
    await new Promise((resolve2) => setTimeout(resolve2, interval * 1e3));
    const res = await fetch(`${API_BASE}/api/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      })
    });
    const data = await res.json();
    if (res.ok) {
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    if (data.error === "authorization_pending") {
      continue;
    }
    if (data.error === "slow_down") {
      interval += 5;
      continue;
    }
    if (data.error === "expired_token") {
      throw new Error("Authorization expired. Please try again.");
    }
    if (data.error === "access_denied") {
      throw new Error("Authorization denied by user.");
    }
    throw new Error(data.error_description || data.error || "Failed to get access token");
  }
  throw new Error("Authorization expired. Please try again.");
}
function detectFramework() {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  if (!existsSync(packageJsonPath)) {
    return { framework: null, reason: "No package.json found" };
  }
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.react || deps.next || deps["@remix-run/react"]) {
      const detected = deps.next ? "next" : deps["@remix-run/react"] ? "remix" : "react";
      return { framework: "react", reason: `Detected ${detected} in dependencies` };
    }
    if (deps.vue || deps.nuxt || deps["@nuxt/kit"]) {
      const detected = deps.nuxt || deps["@nuxt/kit"] ? "nuxt" : "vue";
      return { framework: "vue", reason: `Detected ${detected} in dependencies` };
    }
    if (deps.svelte || deps["@sveltejs/kit"]) {
      const detected = deps["@sveltejs/kit"] ? "@sveltejs/kit" : "svelte";
      return { framework: "svelte", reason: `Detected ${detected} in dependencies` };
    }
    return { framework: null, reason: "No supported framework detected" };
  } catch {
    return { framework: null, reason: "Failed to parse package.json" };
  }
}
function getFormatForFramework(framework) {
  return framework || "react";
}
async function copyToClipboard(content) {
  try {
    await clipboard.write(content);
    return true;
  } catch {
    return false;
  }
}
function ensureFavoritesDir() {
  const dir = dirname(FAVORITES_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function loadFavorites() {
  ensureFavoritesDir();
  if (!existsSync(FAVORITES_FILE)) {
    return { favorites: [] };
  }
  try {
    const content = readFileSync(FAVORITES_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { favorites: [] };
  }
}
function saveFavorites(data) {
  ensureFavoritesDir();
  writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function addFavorite(icon) {
  const data = loadFavorites();
  if (data.favorites.some((f) => f.name === icon.normalizedName)) {
    return false;
  }
  data.favorites.push({
    name: icon.normalizedName,
    sourceId: icon.sourceId,
    addedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  saveFavorites(data);
  return true;
}
function removeFavorite(name) {
  const data = loadFavorites();
  const index = data.favorites.findIndex((f) => f.name === name);
  if (index === -1) {
    return false;
  }
  data.favorites.splice(index, 1);
  saveFavorites(data);
  return true;
}
function watchConfig(configPath, onChange) {
  const watcher = chokidar.watch(configPath, {
    persistent: true,
    ignoreInitial: true
  });
  watcher.on("change", async () => {
    await onChange();
  });
  return {
    close: () => watcher.close()
  };
}
async function scanProjectForIconUsage() {
  const usages = [];
  function scanDir(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", ".next", ".nuxt"].includes(entry.name)) {
          continue;
        }
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if ([".tsx", ".jsx", ".vue", ".svelte", ".ts", ".js"].includes(ext)) {
          try {
            const content = readFileSync(fullPath, "utf-8");
            const importMatches = content.matchAll(/import\s*\{?\s*([A-Z][a-zA-Z0-9]+(?:Icon)?)\s*\}?\s*from/g);
            for (const match of importMatches) {
              const name = match[1];
              if (name && /^[A-Z]/.test(name)) {
                const kebabName = name.replace(/Icon$/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
                usages.push({ iconName: kebabName, file: fullPath });
              }
            }
            const componentMatches = content.matchAll(/<([A-Z][a-zA-Z0-9]+(?:Icon)?)\s*[^>]*\/?>/g);
            for (const match of componentMatches) {
              const name = match[1];
              if (name && /^[A-Z]/.test(name)) {
                const kebabName = name.replace(/Icon$/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
                usages.push({ iconName: kebabName, file: fullPath });
              }
            }
          } catch {
          }
        }
      }
    }
  }
  scanDir(process.cwd());
  return usages;
}
async function auditProject() {
  const config = loadConfig();
  const bundled = /* @__PURE__ */ new Set();
  if (config) {
    for (const bundle of config.bundles) {
      if (bundle.query || bundle.category || bundle.source) {
        try {
          const { icons } = await fetchIcons({
            query: bundle.query,
            category: bundle.category,
            source: bundle.source,
            limit: bundle.limit || 100
          });
          for (const icon of icons) {
            bundled.add(icon.normalizedName);
          }
        } catch {
        }
      }
    }
  }
  const usages = await scanProjectForIconUsage();
  const used = /* @__PURE__ */ new Set();
  const usageLocations = {};
  for (const usage of usages) {
    used.add(usage.iconName);
    if (!usageLocations[usage.iconName]) {
      usageLocations[usage.iconName] = [];
    }
    const locations = usageLocations[usage.iconName];
    if (!locations.includes(usage.file)) {
      locations.push(usage.file);
    }
  }
  const unused = [...bundled].filter((name) => !used.has(name));
  const missing = [...used].filter((name) => !bundled.has(name));
  return {
    bundled: [...bundled],
    used: [...used],
    unused,
    missing,
    usageLocations
  };
}
var DEFAULT_STROKE = {
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
function getIconRenderMode(sourceId) {
  return sourceId === "phosphor" ? "fill" : "stroke";
}
function findConfigFile() {
  const configPath = resolve(process.cwd(), CONFIG_FILE);
  return existsSync(configPath) ? configPath : null;
}
function loadConfig() {
  const configPath = findConfigFile();
  if (!configPath) return null;
  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(chalk.red(`Failed to parse ${CONFIG_FILE}:`), error);
    return null;
  }
}
function createDefaultConfig() {
  return {
    $schema: "https://unicon.sh/schema/uniconrc.json",
    bundles: [
      {
        name: "dashboard",
        category: "Dashboards",
        limit: 50,
        format: "react",
        output: "./src/icons/dashboard.tsx"
      },
      {
        name: "navigation",
        query: "arrow chevron menu home",
        limit: 30,
        format: "react",
        output: "./src/icons/navigation.tsx"
      }
    ]
  };
}
function showBanner() {
  const banner = figlet.textSync("UNICON", {
    font: "ANSI Shadow",
    horizontalLayout: "fitted"
  });
  console.log(chalk.cyan(banner));
  console.log(chalk.dim("  The unified icon library for React, Vue & Svelte\n"));
}
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}
function getCacheKey(params) {
  const sorted = Object.entries(params).filter(([, v]) => v !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  return Buffer.from(sorted).toString("base64url");
}
function getFromCache(key) {
  ensureCacheDir();
  const cachePath = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(cachePath)) return null;
  try {
    const content = readFileSync(cachePath, "utf-8");
    const entry = JSON.parse(content);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      unlinkSync(cachePath);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}
function setCache(key, data) {
  ensureCacheDir();
  const cachePath = join(CACHE_DIR, `${key}.json`);
  const entry = { data, timestamp: Date.now() };
  writeFileSync(cachePath, JSON.stringify(entry), "utf-8");
}
function clearCache() {
  ensureCacheDir();
  let count = 0;
  let size = 0;
  try {
    const files = readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = join(CACHE_DIR, file);
        const content = readFileSync(filePath, "utf-8");
        size += content.length;
        unlinkSync(filePath);
        count++;
      }
    }
  } catch {
  }
  return { count, size };
}
function getCacheStats() {
  ensureCacheDir();
  let count = 0;
  let size = 0;
  let oldest = null;
  try {
    const files = readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = join(CACHE_DIR, file);
        const content = readFileSync(filePath, "utf-8");
        size += content.length;
        count++;
        try {
          const entry = JSON.parse(content);
          if (oldest === null || entry.timestamp < oldest) {
            oldest = entry.timestamp;
          }
        } catch {
        }
      }
    }
  } catch {
  }
  return { count, size, oldest: oldest ? new Date(oldest) : null };
}
function renderAsciiPreview(icon, width = 16, height = 16) {
  const chars = [" ", "\u2591", "\u2592", "\u2593", "\u2588"];
  const grid = Array.from({ length: height }, () => Array(width).fill(0));
  const parts = icon.viewBox.split(" ").map(Number);
  const vbWidth = parts[2] ?? 24;
  const vbHeight = parts[3] ?? 24;
  const scaleX = width / vbWidth;
  const scaleY = height / vbHeight;
  const pathMatches = icon.content.matchAll(/d="([^"]+)"/g);
  for (const match of pathMatches) {
    const pathData = match[1];
    if (!pathData) continue;
    const coords = pathData.matchAll(/[-\d.]+/g);
    let x = 0, y = 0;
    let isX = true;
    for (const coord of coords) {
      const coordVal = coord[0];
      if (!coordVal) continue;
      const val = parseFloat(coordVal);
      if (isNaN(val)) continue;
      if (isX) {
        x = Math.floor(val * scaleX);
      } else {
        y = Math.floor(val * scaleY);
        const row = grid[y];
        const rowAbove = grid[y - 1];
        const rowBelow = grid[y + 1];
        if (row && x >= 0 && x < width && y >= 0 && y < height) {
          row[x] = Math.min(4, (row[x] ?? 0) + 2);
          if (x > 0) row[x - 1] = Math.min(4, (row[x - 1] ?? 0) + 1);
          if (x < width - 1) row[x + 1] = Math.min(4, (row[x + 1] ?? 0) + 1);
          if (rowAbove) rowAbove[x] = Math.min(4, (rowAbove[x] ?? 0) + 1);
          if (rowBelow) rowBelow[x] = Math.min(4, (rowBelow[x] ?? 0) + 1);
        }
      }
      isX = !isX;
    }
  }
  const circleMatches = icon.content.matchAll(/cx="([\d.]+)"\s+cy="([\d.]+)"\s+r="([\d.]+)"/g);
  for (const match of circleMatches) {
    const cxStr = match[1];
    const cyStr = match[2];
    const rStr = match[3];
    if (!cxStr || !cyStr || !rStr) continue;
    const cx = Math.floor(parseFloat(cxStr) * scaleX);
    const cy = Math.floor(parseFloat(cyStr) * scaleY);
    const r = Math.ceil(parseFloat(rStr) * Math.min(scaleX, scaleY));
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        const row = grid[py];
        if (row && px >= 0 && px < width && py >= 0 && py < height) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= r) {
            row[px] = Math.min(4, (row[px] ?? 0) + 2);
          }
        }
      }
    }
  }
  const lines = [];
  for (const row of grid) {
    lines.push(row.map((v) => chars[v] ?? " ").join(""));
  }
  return lines.join("\n");
}
async function fetchIcons(params, options = { useCache: true }) {
  if (options.useCache) {
    const cacheKey = getCacheKey({ type: "icons", ...params });
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }
  const url = new URL(`${API_BASE}/api/icons`);
  if (params.query) url.searchParams.set("q", params.query);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.source) url.searchParams.set("source", params.source);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (options.useCache) {
    const cacheKey = getCacheKey({ type: "icons", ...params });
    setCache(cacheKey, data);
  }
  return data;
}
async function fetchCategories() {
  const res = await fetch(`${API_BASE}/api/icons?limit=1`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return [
    "Arrows",
    "Communication",
    "Dashboards",
    "Devices",
    "Editing",
    "Files",
    "General",
    "Media",
    "Navigation",
    "Shapes",
    "Social",
    "Weather"
  ];
}
function toPascalCase(str) {
  return str.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
}
function getSvgAttributes(icon) {
  const mode = getIconRenderMode(icon.sourceId);
  if (mode === "fill") {
    return 'fill="currentColor"';
  }
  const strokeWidth = parseFloat(icon.strokeWidth || "2") || DEFAULT_STROKE.strokeWidth;
  return [
    'fill="none"',
    'stroke="currentColor"',
    `stroke-width="${strokeWidth}"`,
    `stroke-linecap="${DEFAULT_STROKE.strokeLinecap}"`,
    `stroke-linejoin="${DEFAULT_STROKE.strokeLinejoin}"`
  ].join(" ");
}
function getJsxAttributes(icon) {
  const mode = getIconRenderMode(icon.sourceId);
  if (mode === "fill") {
    return 'fill="currentColor"';
  }
  const strokeWidth = parseFloat(icon.strokeWidth || "2") || DEFAULT_STROKE.strokeWidth;
  return [
    'fill="none"',
    'stroke="currentColor"',
    `strokeWidth={${strokeWidth}}`,
    `strokeLinecap="${DEFAULT_STROKE.strokeLinecap}"`,
    `strokeLinejoin="${DEFAULT_STROKE.strokeLinejoin}"`
  ].join(" ");
}
function generateReactComponents(icons) {
  const components = icons.map((icon) => {
    const name = toPascalCase(icon.normalizedName);
    const attrs = getJsxAttributes(icon);
    return `export function ${name}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${icon.viewBox}"
      ${attrs}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      ${icon.content}
    </svg>
  );
}`;
  });
  return `/**
 * Icon components generated by @webrenew/unicon
 * @see https://unicon.sh
 */
import type { SVGProps } from "react";

${components.join("\n\n")}
`;
}
function generateSvgBundle(icons) {
  return icons.map((icon) => {
    const attrs = getSvgAttributes(icon);
    return `<!-- ${icon.normalizedName} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${attrs} aria-hidden="true" focusable="false">
  ${icon.content}
</svg>`;
  }).join("\n\n");
}
function generateJsonBundle(icons) {
  return JSON.stringify(
    icons.map((icon) => ({
      id: icon.id,
      name: icon.normalizedName,
      source: icon.sourceId,
      viewBox: icon.viewBox,
      content: icon.content,
      tags: icon.tags,
      category: icon.category
    })),
    null,
    2
  );
}
var program = new Command();
program.name("unicon").description("CLI for searching and bundling icons from Unicon").version(CLI_VERSION).hook("preAction", (thisCommand) => {
  if (thisCommand.args.length === 0 || process.argv.includes("--help") || process.argv.includes("-h")) {
    return;
  }
}).addHelpText("beforeAll", () => {
  showBanner();
  return "";
});
program.command("search <query>").description("Search for icons by name or keyword").option("-s, --source <source>", "Filter by source (lucide, phosphor, hugeicons)").option("-c, --category <category>", "Filter by category").option("-l, --limit <number>", "Maximum number of results", "20").option("-j, --json", "Output as JSON").option("-p, --pick", "Interactively select icons from results").action(async (query, options) => {
  const spinner = ora("Searching icons...").start();
  try {
    const { icons, searchType, expandedQuery } = await fetchIcons({
      query,
      source: options.source,
      category: options.category,
      limit: parseInt(options.limit, 10)
    });
    spinner.stop();
    if (icons.length === 0) {
      console.log(chalk.yellow("No icons found."));
      return;
    }
    if (options.json) {
      console.log(JSON.stringify(icons, null, 2));
      return;
    }
    if (options.pick) {
      if (searchType === "semantic" && expandedQuery) {
        console.log(chalk.dim(`AI expanded: "${expandedQuery}"
`));
      }
      const selected = await p.multiselect({
        message: `Select icons (${icons.length} found)`,
        options: icons.map((icon) => ({
          value: icon,
          label: icon.normalizedName,
          hint: `${icon.sourceId}${icon.category ? ` / ${icon.category}` : ""}`
        }))
      });
      if (p.isCancel(selected)) {
        console.log(chalk.dim("Cancelled."));
        return;
      }
      const selectedIcons = selected;
      if (selectedIcons.length === 0) {
        console.log(chalk.yellow("No icons selected."));
        return;
      }
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "copy", label: "Copy to clipboard", hint: "Copy React component(s)" },
          { value: "save", label: "Save to file", hint: "Write to disk" },
          { value: "star", label: "Add to favorites", hint: "Star for later" },
          { value: "bundle", label: "Create bundle", hint: "Add to .uniconrc.json" }
        ]
      });
      if (p.isCancel(action)) {
        console.log(chalk.dim("Cancelled."));
        return;
      }
      const { framework } = detectFramework();
      const format = getFormatForFramework(framework);
      switch (action) {
        case "copy": {
          const components = selectedIcons.map((icon) => {
            const name = toPascalCase(icon.normalizedName);
            const jsxAttrs = getJsxAttributes(icon);
            return `export function ${name}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${jsxAttrs} aria-hidden="true" focusable="false" className={className} {...props}>
      ${icon.content}
    </svg>
  );
}`;
          });
          const content = `import type { SVGProps } from "react";

${components.join("\n\n")}`;
          const success = await copyToClipboard(content);
          if (success) {
            console.log(chalk.green(`\u2713 ${selectedIcons.length} icon(s) copied to clipboard`));
          } else {
            console.log(chalk.red("Failed to copy to clipboard"));
          }
          break;
        }
        case "save": {
          const outputPath = await p.text({
            message: "Output directory:",
            placeholder: "./src/icons",
            defaultValue: "./src/icons"
          });
          if (p.isCancel(outputPath)) return;
          const outDir = resolve(process.cwd(), outputPath);
          mkdirSync(outDir, { recursive: true });
          for (const icon of selectedIcons) {
            const name = toPascalCase(icon.normalizedName);
            const jsxAttrs = getJsxAttributes(icon);
            const content = `import type { SVGProps } from "react";

export function ${name}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${jsxAttrs} aria-hidden="true" focusable="false" className={className} {...props}>
      ${icon.content}
    </svg>
  );
}`;
            writeFileSync(join(outDir, `${icon.normalizedName}.tsx`), content, "utf-8");
          }
          console.log(chalk.green(`\u2713 ${selectedIcons.length} icon(s) saved to ${outputPath}`));
          break;
        }
        case "star": {
          let added = 0;
          for (const icon of selectedIcons) {
            if (addFavorite(icon)) added++;
          }
          console.log(chalk.green(`\u2713 Added ${added} icon(s) to favorites`));
          break;
        }
        case "bundle": {
          const bundleName = await p.text({
            message: "Bundle name:",
            placeholder: "my-icons"
          });
          if (p.isCancel(bundleName)) return;
          let config = loadConfig();
          if (!config) {
            config = { bundles: [] };
          }
          const iconNames = selectedIcons.map((i) => i.normalizedName).join(" ");
          const newBundle = {
            name: bundleName,
            query: iconNames,
            format,
            output: `./src/icons/${bundleName}.tsx`
          };
          config.bundles.push(newBundle);
          const configPath = resolve(process.cwd(), CONFIG_FILE);
          writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
          console.log(chalk.green(`\u2713 Added bundle "${bundleName}" to ${CONFIG_FILE}`));
          break;
        }
      }
      return;
    }
    if (searchType === "semantic" && expandedQuery) {
      console.log(chalk.dim(`AI expanded: "${expandedQuery}"
`));
    }
    console.log(chalk.bold(`Found ${icons.length} icons:
`));
    icons.forEach((icon) => {
      const source = chalk.dim(`[${icon.sourceId}]`);
      const category = icon.category ? chalk.cyan(icon.category) : "";
      console.log(`  ${chalk.green(icon.normalizedName)} ${source} ${category}`);
    });
    console.log(
      chalk.dim(`
Use ${chalk.white("unicon get <name>")} to copy a single icon.`)
    );
    console.log(
      chalk.dim(`Use ${chalk.white("unicon search <query> --pick")} to select interactively.`)
    );
  } catch (error) {
    spinner.fail("Search failed");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("info <name>").description("Show detailed information about an icon").option("-s, --source <source>", "Prefer source (lucide, phosphor, hugeicons)").action(async (name, options) => {
  const spinner = ora("Fetching icon info...").start();
  try {
    const { icons } = await fetchIcons({
      query: name,
      source: options.source,
      limit: 10
    });
    const exactMatch = icons.find(
      (i) => i.normalizedName === name || i.normalizedName === name.toLowerCase()
    );
    const icon = exactMatch || icons[0];
    if (!icon) {
      spinner.fail(`Icon "${name}" not found.`);
      process.exit(1);
    }
    spinner.stop();
    console.log();
    console.log(chalk.bold.cyan(icon.normalizedName));
    console.log(chalk.dim("\u2500".repeat(40)));
    console.log();
    console.log(`  ${chalk.dim("Source:")}     ${chalk.yellow(icon.sourceId)}`);
    console.log(`  ${chalk.dim("Category:")}   ${icon.category || chalk.dim("none")}`);
    console.log(`  ${chalk.dim("ViewBox:")}    ${icon.viewBox}`);
    console.log(`  ${chalk.dim("Tags:")}       ${icon.tags?.join(", ") || chalk.dim("none")}`);
    console.log();
    console.log(chalk.dim("Commands:"));
    console.log(`  ${chalk.white(`unicon get ${icon.normalizedName}`)}`);
    console.log(`  ${chalk.white(`unicon get ${icon.normalizedName} --format svg`)}`);
    console.log();
  } catch (error) {
    spinner.fail("Failed to fetch icon info");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("get <name>").description("Get a single icon by name (outputs to stdout)").option("-s, --source <source>", "Prefer source (lucide, phosphor, hugeicons)").option("-f, --format <format>", "Output format: react, vue, svelte, svg, json").option("-o, --output <path>", "Write to file instead of stdout").option("-c, --copy", "Copy to clipboard instead of stdout").action(async (name, options) => {
  try {
    const { icons } = await fetchIcons({
      query: name,
      source: options.source,
      limit: 10
    });
    const exactMatch = icons.find(
      (i) => i.normalizedName === name || i.normalizedName === name.toLowerCase()
    );
    const icon = exactMatch || icons[0];
    if (!icon) {
      console.error(chalk.red(`Icon "${name}" not found.`));
      console.error(chalk.dim(`Try: unicon search "${name}"`));
      process.exit(1);
    }
    let format = options.format;
    if (!format) {
      const { framework, reason } = detectFramework();
      format = getFormatForFramework(framework);
      if (framework && (options.copy || options.output)) {
        console.error(chalk.dim(`Auto-detected: ${reason} \u2192 ${format}`));
      }
    }
    let content;
    const componentName = toPascalCase(icon.normalizedName);
    const svgAttrs = getSvgAttributes(icon);
    const jsxAttrs = getJsxAttributes(icon);
    switch (format) {
      case "svg":
        content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${svgAttrs} aria-hidden="true" focusable="false">
  ${icon.content}
</svg>`;
        break;
      case "json":
        content = JSON.stringify({
          name: icon.normalizedName,
          source: icon.sourceId,
          viewBox: icon.viewBox,
          content: icon.content
        }, null, 2);
        break;
      case "vue":
        content = `<!-- Generated by @webrenew/unicon - https://unicon.sh -->
<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${icon.viewBox}"
    ${svgAttrs}
    aria-hidden="true"
    :focusable="false"
    :class="className"
    v-bind="$attrs"
  >
    ${icon.content}
  </svg>
</template>

<script setup lang="ts">
defineProps<{ className?: string }>();
</script>`;
        break;
      case "svelte":
        content = `<!-- Generated by @webrenew/unicon - https://unicon.sh -->
<script lang="ts">
  let className: string = "";
  export { className as class };
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${icon.viewBox}"
  ${svgAttrs}
  aria-hidden="true"
  focusable="false"
  class={className}
  {...$$restProps}
>
  ${icon.content}
</svg>`;
        break;
      case "react":
      default:
        content = `// Generated by @webrenew/unicon - https://unicon.sh
import type { SVGProps } from "react";

export function ${componentName}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${icon.viewBox}"
      ${jsxAttrs}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      ${icon.content}
    </svg>
  );
}`;
        break;
    }
    if (options.copy) {
      const success = await copyToClipboard(content);
      if (success) {
        console.log(chalk.green(`\u2713 ${componentName} copied to clipboard (${format})`));
      } else {
        console.error(chalk.red("Failed to copy to clipboard"));
        process.exit(1);
      }
    } else if (options.output) {
      const fullPath = resolve(process.cwd(), options.output);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      console.error(chalk.green(`\u2713 ${componentName} \u2192 ${options.output}`));
    } else {
      console.log(content);
    }
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("bundle").description("Bundle icons for tree-shakeable imports (split by default for components)").option("-q, --query <query>", "Search query").option("-c, --category <category>", "Filter by category").option("-s, --source <source>", "Filter by source (lucide, phosphor, hugeicons)").option("-f, --format <format>", "Output format: react, vue, svelte, svg, json").option("-o, --output <path>", "Output file/directory path").option("-l, --limit <number>", "Maximum number of icons", "100").option("--single-file", "Combine all icons into one file (not recommended for components)").option("--stars", "Bundle all favorited icons").action(async (options) => {
  if (options.stars) {
    const favorites = loadFavorites();
    if (favorites.favorites.length === 0) {
      console.log(chalk.yellow("No favorited icons. Use 'unicon star <name>' to add favorites."));
      process.exit(1);
    }
    options.query = favorites.favorites.map((f) => f.name).join(" ");
  }
  if (!options.query && !options.category && !options.source) {
    console.log(
      chalk.yellow("Please provide at least one filter: --query, --category, --source, or --stars")
    );
    process.exit(1);
  }
  if (!options.format) {
    const { framework, reason } = detectFramework();
    options.format = getFormatForFramework(framework);
    if (framework) {
      console.log(chalk.dim(`Auto-detected: ${reason} \u2192 ${options.format}`));
    }
  }
  const isComponentFormat = ["react", "vue", "svelte"].includes(options.format);
  if ((options.format === "vue" || options.format === "svelte") && options.singleFile) {
    console.log(
      chalk.red(`Error: --single-file is not supported for ${options.format} format.`)
    );
    console.log(
      chalk.dim(`Vue and Svelte require one component per file. Remove --single-file.`)
    );
    process.exit(1);
  }
  const useSplitMode = isComponentFormat && !options.singleFile;
  const spinner = ora("Fetching icons...").start();
  try {
    const { icons } = await fetchIcons({
      query: options.query,
      category: options.category,
      source: options.source,
      limit: parseInt(options.limit, 10)
    });
    if (icons.length === 0) {
      spinner.fail("No icons found matching your criteria");
      process.exit(1);
    }
    if (options.singleFile && icons.length > 10) {
      spinner.warn(
        chalk.yellow(`Bundling ${icons.length} icons into a single file is not tree-shakeable.`)
      );
      console.log(chalk.dim(`  Consider removing --single-file for better bundle optimization.
`));
      spinner.start("Generating bundle...");
    }
    if (useSplitMode) {
      const outDir = options.output || "./icons";
      const fullDir = resolve(process.cwd(), outDir);
      mkdirSync(fullDir, { recursive: true });
      spinner.text = `Writing ${icons.length} icons to ${outDir}/...`;
      const extMap = {
        react: "tsx",
        vue: "vue",
        svelte: "svelte",
        svg: "svg",
        json: "json"
      };
      const ext2 = extMap[options.format] || "tsx";
      for (const icon of icons) {
        const fileName = `${icon.normalizedName}.${ext2}`;
        const filePath = join(fullDir, fileName);
        const name = toPascalCase(icon.normalizedName);
        const svgAttrs = getSvgAttributes(icon);
        const jsxAttrs = getJsxAttributes(icon);
        let content2;
        switch (options.format) {
          case "svg":
            content2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${svgAttrs} aria-hidden="true" focusable="false">
  ${icon.content}
</svg>`;
            break;
          case "json":
            content2 = JSON.stringify({
              name: icon.normalizedName,
              source: icon.sourceId,
              viewBox: icon.viewBox,
              content: icon.content
            }, null, 2);
            break;
          case "vue":
            content2 = `<!-- Generated by @webrenew/unicon -->
<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${icon.viewBox}"
    ${svgAttrs}
    aria-hidden="true"
    :focusable="false"
    :class="className"
    v-bind="$attrs"
  >
    ${icon.content}
  </svg>
</template>

<script setup lang="ts">
defineProps<{ className?: string }>();
</script>
`;
            break;
          case "svelte":
            content2 = `<!-- Generated by @webrenew/unicon -->
<script lang="ts">
  let className: string = "";
  export { className as class };
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${icon.viewBox}"
  ${svgAttrs}
  aria-hidden="true"
  focusable="false"
  class={className}
  {...$$restProps}
>
  ${icon.content}
</svg>
`;
            break;
          case "react":
          default:
            content2 = `// @webrenew/unicon
import type { SVGProps } from "react";

export function ${name}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${icon.viewBox}"
      ${jsxAttrs}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      ${icon.content}
    </svg>
  );
}
`;
            break;
        }
        writeFileSync(filePath, content2, "utf-8");
      }
      if (["react", "vue", "svelte"].includes(options.format)) {
        let indexContent;
        if (options.format === "react") {
          indexContent = `// Tree-shakeable re-exports. Add "sideEffects": false to package.json.
${icons.map((icon) => `export { ${toPascalCase(icon.normalizedName)} } from "./${icon.normalizedName}";`).join("\n")}
`;
        } else {
          indexContent = `// Tree-shakeable re-exports. Add "sideEffects": false to package.json.
${icons.map((icon) => `export { default as ${toPascalCase(icon.normalizedName)} } from "./${icon.normalizedName}.${ext2}";`).join("\n")}
`;
        }
        writeFileSync(join(fullDir, "index.ts"), indexContent, "utf-8");
      }
      spinner.succeed(`${chalk.green(icons.length)} icons \u2192 ${chalk.cyan(outDir)}/`);
      console.log(chalk.green(`  \u2713 Tree-shakeable! Only imported icons will be bundled.`));
      console.log(chalk.dim(`  Import: import { Home, Settings } from "${outDir}";`));
      return;
    }
    spinner.text = `Generating ${options.format} bundle for ${icons.length} icons...`;
    let content;
    let ext;
    switch (options.format) {
      case "svg":
        content = generateSvgBundle(icons);
        ext = "svg";
        break;
      case "json":
        content = generateJsonBundle(icons);
        ext = "json";
        break;
      case "react":
      default:
        content = generateReactComponents(icons);
        ext = "tsx";
        break;
    }
    const outputPath = options.output || `icons.${ext}`;
    const fullPath = resolve(process.cwd(), outputPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
    spinner.succeed(
      `Bundled ${chalk.green(icons.length)} icons to ${chalk.cyan(outputPath)}`
    );
    const sources = [...new Set(icons.map((i) => i.sourceId))];
    console.log(chalk.dim(`  Sources: ${sources.join(", ")}`));
    console.log(chalk.dim(`  Format: ${options.format}`));
    if (options.format === "react") {
      console.log();
      console.log(chalk.yellow(`  \u26A0 Single-file mode is NOT tree-shakeable.`));
      console.log(chalk.dim(`    All ${icons.length} icons will be included in your bundle.`));
      console.log(chalk.dim(`    For tree-shaking, remove --single-file flag.`));
    }
  } catch (error) {
    spinner.fail("Bundle failed");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("categories").description("List available icon categories").option("-j, --json", "Output as JSON").action(async (options) => {
  const spinner = ora("Fetching categories...").start();
  try {
    const categories = await fetchCategories();
    spinner.stop();
    if (options.json) {
      console.log(JSON.stringify(categories, null, 2));
      return;
    }
    console.log(chalk.bold("Available categories:\n"));
    categories.forEach((cat) => {
      console.log(`  ${chalk.green("\u2022")} ${cat}`);
    });
    console.log(
      chalk.dim(`
Use ${chalk.white("unicon bundle --category <name>")} to export a category.`)
    );
  } catch (error) {
    spinner.fail("Failed to fetch categories");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("sources").description("List available icon sources/libraries").action(() => {
  console.log(chalk.bold("Available icon sources:\n"));
  console.log(`  ${chalk.green("\u2022")} ${chalk.yellow("lucide")}    - Lucide Icons`);
  console.log(`  ${chalk.green("\u2022")} ${chalk.cyan("phosphor")}  - Phosphor Icons`);
  console.log(`  ${chalk.green("\u2022")} ${chalk.magenta("hugeicons")} - Huge Icons`);
  console.log(
    chalk.dim(`
Use ${chalk.white("unicon bundle --source <name>")} to export from a source.`)
  );
});
program.command("init").description("Initialize a .uniconrc.json config file").option("-f, --force", "Overwrite existing config").option("-i, --interactive", "Interactive setup wizard").action(async (options) => {
  const configPath = resolve(process.cwd(), CONFIG_FILE);
  if (existsSync(configPath) && !options.force) {
    console.log(chalk.yellow(`${CONFIG_FILE} already exists. Use --force to overwrite.`));
    process.exit(1);
  }
  if (options.interactive) {
    console.log();
    p.intro(chalk.cyan("Unicon Setup Wizard"));
    const { framework, reason } = detectFramework();
    let selectedFormat = "react";
    if (framework) {
      console.log(chalk.dim(`  ${reason}`));
      const useDetected = await p.confirm({
        message: `Use ${framework} format?`,
        initialValue: true
      });
      if (p.isCancel(useDetected)) {
        p.outro(chalk.dim("Setup cancelled."));
        return;
      }
      if (useDetected) {
        selectedFormat = framework;
      } else {
        const formatChoice = await p.select({
          message: "Select output format:",
          options: [
            { value: "react", label: "React", hint: "React/Next.js/Remix" },
            { value: "vue", label: "Vue", hint: "Vue 3/Nuxt" },
            { value: "svelte", label: "Svelte", hint: "Svelte/SvelteKit" }
          ]
        });
        if (p.isCancel(formatChoice)) {
          p.outro(chalk.dim("Setup cancelled."));
          return;
        }
        selectedFormat = formatChoice;
      }
    } else {
      const formatChoice = await p.select({
        message: "Select output format:",
        options: [
          { value: "react", label: "React", hint: "React/Next.js/Remix" },
          { value: "vue", label: "Vue", hint: "Vue 3/Nuxt" },
          { value: "svelte", label: "Svelte", hint: "Svelte/SvelteKit" }
        ]
      });
      if (p.isCancel(formatChoice)) {
        p.outro(chalk.dim("Setup cancelled."));
        return;
      }
      selectedFormat = formatChoice;
    }
    const libraries = await p.multiselect({
      message: "Which icon libraries do you want to use?",
      options: [
        { value: "lucide", label: "Lucide", hint: "1,900+ stroke icons" },
        { value: "phosphor", label: "Phosphor", hint: "1,500+ fill icons" },
        { value: "heroicons", label: "Heroicons", hint: "292 Tailwind icons" },
        { value: "tabler", label: "Tabler", hint: "4,600+ stroke icons" },
        { value: "feather", label: "Feather", hint: "287 minimalist icons" },
        { value: "simple-icons", label: "Simple Icons", hint: "3,300+ brand logos" }
      ],
      required: false
    });
    if (p.isCancel(libraries)) {
      p.outro(chalk.dim("Setup cancelled."));
      return;
    }
    const outputDir = await p.text({
      message: "Icon output directory:",
      placeholder: "./src/icons",
      defaultValue: "./src/icons"
    });
    if (p.isCancel(outputDir)) {
      p.outro(chalk.dim("Setup cancelled."));
      return;
    }
    const createStarter = await p.confirm({
      message: "Create a starter bundle with common icons?",
      initialValue: true
    });
    if (p.isCancel(createStarter)) {
      p.outro(chalk.dim("Setup cancelled."));
      return;
    }
    const ext = selectedFormat === "react" ? "tsx" : selectedFormat;
    const bundles = [];
    if (createStarter) {
      bundles.push({
        name: "common",
        query: "home settings user search menu close check arrow-right arrow-left",
        format: selectedFormat,
        limit: 20,
        output: `${outputDir}/common.${ext}`
      });
    }
    const selectedLibraries = libraries;
    if (selectedLibraries.length > 0) {
      for (const lib of selectedLibraries) {
        bundles.push({
          name: lib,
          source: lib,
          format: selectedFormat,
          limit: 50,
          output: `${outputDir}/${lib}.${ext}`
        });
      }
    }
    const config2 = {
      $schema: "https://unicon.sh/schema/uniconrc.json",
      bundles
    };
    writeFileSync(configPath, JSON.stringify(config2, null, 2), "utf-8");
    p.outro(chalk.green(`Created ${CONFIG_FILE}`));
    console.log();
    console.log(chalk.dim("Bundles configured:"));
    config2.bundles.forEach((bundle) => {
      console.log(`  ${chalk.cyan(bundle.name)} \u2192 ${bundle.output}`);
    });
    console.log();
    console.log(chalk.dim(`Run ${chalk.white("unicon sync")} to generate bundles.`));
    return;
  }
  const config = createDefaultConfig();
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(chalk.green(`\u2713 Created ${CONFIG_FILE}
`));
  console.log(chalk.dim("Default bundles configured:"));
  config.bundles.forEach((bundle) => {
    console.log(`  ${chalk.cyan(bundle.name)} \u2192 ${bundle.output}`);
  });
  console.log(chalk.dim(`
Run ${chalk.white("unicon sync")} to generate bundles.`));
});
program.command("sync").description("Generate all bundles from .uniconrc.json").option("-n, --name <name>", "Sync only a specific bundle by name").option("-d, --dry-run", "Show what would be generated without writing files").option("-w, --watch", "Watch for config changes and re-sync automatically").action(async (options) => {
  async function performSync() {
    const config = loadConfig();
    if (!config) {
      console.log(chalk.yellow(`No ${CONFIG_FILE} found. Run ${chalk.white("unicon init")} first.`));
      return { success: 0, error: 1 };
    }
    const bundlesToSync = options.name ? config.bundles.filter((b) => b.name === options.name) : config.bundles;
    if (bundlesToSync.length === 0) {
      if (options.name) {
        console.log(chalk.yellow(`Bundle "${options.name}" not found in config.`));
      } else {
        console.log(chalk.yellow("No bundles configured."));
      }
      return { success: 0, error: 1 };
    }
    console.log(chalk.bold(`Syncing ${bundlesToSync.length} bundle${bundlesToSync.length > 1 ? "s" : ""}...
`));
    let successCount2 = 0;
    let errorCount2 = 0;
    for (const bundle of bundlesToSync) {
      const spinner = ora(`${bundle.name}: Fetching icons...`).start();
      try {
        if (!bundle.query && !bundle.category && !bundle.source) {
          spinner.warn(`${bundle.name}: Skipped (no query, category, or source specified)`);
          continue;
        }
        const { icons } = await fetchIcons({
          query: bundle.query,
          category: bundle.category,
          source: bundle.source,
          limit: bundle.limit || 100
        }, { useCache: !options.watch });
        if (icons.length === 0) {
          spinner.warn(`${bundle.name}: No icons found`);
          continue;
        }
        let format = bundle.format;
        if (!format) {
          const { framework } = detectFramework();
          format = getFormatForFramework(framework);
        }
        let content;
        switch (format) {
          case "svg":
            content = generateSvgBundle(icons);
            break;
          case "json":
            content = generateJsonBundle(icons);
            break;
          case "react":
          default:
            content = generateReactComponents(icons);
            break;
        }
        if (options.dryRun) {
          spinner.info(`${bundle.name}: Would write ${icons.length} icons to ${bundle.output}`);
        } else {
          const fullPath = resolve(process.cwd(), bundle.output);
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, content, "utf-8");
          spinner.succeed(`${bundle.name}: ${chalk.green(icons.length)} icons \u2192 ${chalk.cyan(bundle.output)}`);
        }
        successCount2++;
      } catch (error) {
        spinner.fail(`${bundle.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
        errorCount2++;
      }
    }
    return { success: successCount2, error: errorCount2 };
  }
  if (options.watch) {
    const configPath = resolve(process.cwd(), CONFIG_FILE);
    if (!existsSync(configPath)) {
      console.log(chalk.yellow(`No ${CONFIG_FILE} found. Run ${chalk.white("unicon init")} first.`));
      process.exit(1);
    }
    console.log(chalk.cyan("Watch mode enabled. Press Ctrl+C to exit.\n"));
    await performSync();
    console.log();
    console.log(chalk.dim(`Watching ${CONFIG_FILE} for changes...`));
    const watcher = watchConfig(configPath, async () => {
      console.log();
      console.log(chalk.cyan(`${CONFIG_FILE} changed, re-syncing...`));
      console.log();
      await performSync();
      console.log();
      console.log(chalk.dim(`Watching ${CONFIG_FILE} for changes...`));
    });
    process.on("SIGINT", () => {
      console.log();
      console.log(chalk.dim("Watch mode stopped."));
      watcher.close();
      process.exit(0);
    });
    await new Promise(() => {
    });
    return;
  }
  const { success: successCount, error: errorCount } = await performSync();
  console.log();
  if (errorCount === 0) {
    console.log(chalk.green(`\u2713 All ${successCount} bundles synced successfully`));
  } else {
    console.log(chalk.yellow(`Completed with ${errorCount} error${errorCount > 1 ? "s" : ""}`));
  }
});
program.command("add <name>").description("Add a new bundle to .uniconrc.json").option("-q, --query <query>", "Search query").option("-c, --category <category>", "Filter by category").option("-s, --source <source>", "Filter by source").option("-f, --format <format>", "Output format: react, svg, json", "react").option("-l, --limit <number>", "Maximum icons", "50").option("-o, --output <path>", "Output file path").action((name, options) => {
  let config = loadConfig();
  if (!config) {
    console.log(chalk.yellow(`No ${CONFIG_FILE} found. Creating one...`));
    config = { bundles: [] };
  }
  if (config.bundles.some((b) => b.name === name)) {
    console.log(chalk.yellow(`Bundle "${name}" already exists in config.`));
    process.exit(1);
  }
  if (!options.query && !options.category && !options.source) {
    console.log(chalk.yellow("Please provide at least one filter: --query, --category, or --source"));
    process.exit(1);
  }
  const ext = options.format === "json" ? "json" : options.format === "svg" ? "svg" : "tsx";
  const newBundle = {
    name,
    output: options.output || `./src/icons/${name}.${ext}`,
    format: options.format,
    limit: parseInt(options.limit, 10)
  };
  if (options.query) newBundle.query = options.query;
  if (options.category) newBundle.category = options.category;
  if (options.source) newBundle.source = options.source;
  config.bundles.push(newBundle);
  const configPath = resolve(process.cwd(), CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(chalk.green(`\u2713 Added bundle "${name}" to ${CONFIG_FILE}`));
  console.log(chalk.dim(`  Output: ${newBundle.output}`));
  console.log(chalk.dim(`
Run ${chalk.white(`unicon sync --name ${name}`)} to generate.`));
});
program.command("preview <name>").description("Show ASCII art preview of an icon in the terminal").option("-s, --source <source>", "Prefer source (lucide, phosphor, hugeicons)").option("-w, --width <number>", "Preview width", "20").option("-h, --height <number>", "Preview height", "20").action(async (name, options) => {
  const spinner = ora("Fetching icon...").start();
  try {
    const { icons } = await fetchIcons({
      query: name,
      source: options.source,
      limit: 10
    });
    const exactMatch = icons.find(
      (i) => i.normalizedName === name || i.normalizedName === name.toLowerCase()
    );
    const icon = exactMatch || icons[0];
    if (!icon) {
      spinner.fail(`Icon "${name}" not found.`);
      process.exit(1);
    }
    spinner.stop();
    const width = parseInt(options.width, 10);
    const height = parseInt(options.height, 10);
    const preview = renderAsciiPreview(icon, width, height);
    console.log();
    console.log(chalk.bold.cyan(icon.normalizedName) + chalk.dim(` (${icon.sourceId})`));
    console.log(chalk.dim("\u2500".repeat(width)));
    console.log(chalk.yellow(preview));
    console.log(chalk.dim("\u2500".repeat(width)));
    console.log();
    console.log(chalk.dim(`Get: ${chalk.white(`unicon get ${icon.normalizedName}`)}`));
    console.log();
  } catch (error) {
    spinner.fail("Failed to fetch icon");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("cache").description("Manage local icon cache").option("-c, --clear", "Clear all cached data").option("-s, --stats", "Show cache statistics").action((options) => {
  if (options.clear) {
    const { count, size } = clearCache();
    console.log(chalk.green(`\u2713 Cleared ${count} cached items (${(size / 1024).toFixed(1)} KB)`));
    return;
  }
  if (options.stats || !options.clear && !options.stats) {
    const { count, size, oldest } = getCacheStats();
    console.log(chalk.bold("Cache Statistics\n"));
    console.log(`  ${chalk.dim("Location:")} ${CACHE_DIR}`);
    console.log(`  ${chalk.dim("Items:")}    ${count}`);
    console.log(`  ${chalk.dim("Size:")}     ${(size / 1024).toFixed(1)} KB`);
    console.log(`  ${chalk.dim("TTL:")}      24 hours`);
    if (oldest) {
      const age = Math.round((Date.now() - oldest.getTime()) / 1e3 / 60);
      console.log(`  ${chalk.dim("Oldest:")}   ${age} minutes ago`);
    }
    console.log();
    console.log(chalk.dim(`Clear with: ${chalk.white("unicon cache --clear")}`));
  }
});
var UNICON_SKILL_FILES = [
  { path: "SKILL.md", content: SKILL_default },
  { path: "references/cli-commands.md", content: cli_commands_default },
  { path: "references/config-file.md", content: config_file_default },
  { path: "references/api-reference.md", content: api_reference_default }
];
function printSkillFileTree(indent) {
  UNICON_SKILL_FILES.forEach((file, index) => {
    const branch = index === UNICON_SKILL_FILES.length - 1 ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
    console.log(chalk.dim(`${indent}${branch} ${file.path}`));
  });
}
var IDE_CONFIGS = {
  claude: {
    name: "Claude Code",
    dir: ".claude/skills/unicon",
    filename: "SKILL.md",
    description: "Claude Code (Anthropic CLI)"
  },
  codex: {
    name: "Codex",
    dir: ".codex/skills/unicon",
    filename: "SKILL.md",
    description: "OpenAI Codex CLI"
  },
  cursor: {
    name: "Cursor",
    dir: ".cursor/skills/unicon",
    filename: "SKILL.md",
    description: "Cursor IDE"
  },
  agents: {
    name: "Agents",
    dir: ".agents/skills/unicon",
    filename: "SKILL.md",
    description: "Generic .agents directory"
  },
  windsurf: {
    name: "Windsurf",
    dir: ".windsurf/skills/unicon",
    filename: "SKILL.md",
    description: "Windsurf (Codeium)"
  },
  opencode: {
    name: "OpenCode",
    dir: ".opencode/skills/unicon",
    filename: "SKILL.md",
    description: "OpenCode"
  },
  gemini: {
    name: "Gemini",
    dir: ".gemini/skills/unicon",
    filename: "SKILL.md",
    description: "Google Gemini CLI"
  }
};
function detectIDEs() {
  const detected = [];
  const cwd = process.cwd();
  for (const [key, config] of Object.entries(IDE_CONFIGS)) {
    const parentDir = config.dir.split("/")[0];
    if (parentDir && existsSync(join(cwd, parentDir))) {
      detected.push(key);
    }
  }
  return detected;
}
async function fetchSkillsIndex() {
  const res = await fetch(`${API_BASE}/skills/index.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch skills registry: ${res.status}`);
  }
  const data = await res.json();
  return data.skills;
}
async function fetchSkillContent(file) {
  const res = await fetch(`${API_BASE}/skills/${file}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch skill: ${res.status}`);
  }
  return res.text();
}
program.command("skills").description("List and download skills from the Unicon public registry").option("-l, --list", "List available skills").option("-g, --get <id>", "Download a skill by ID and print to stdout").option("-o, --output <path>", "Write downloaded skill to file instead of stdout").option("-j, --json", "Output list as JSON").action(async (options) => {
  const shouldList = options.list || !options.get;
  if (shouldList && !options.get) {
    const spinner = ora("Fetching skills registry...").start();
    try {
      const skills = await fetchSkillsIndex();
      spinner.stop();
      if (options.json) {
        console.log(JSON.stringify(skills, null, 2));
        return;
      }
      console.log(chalk.bold(`
Available Skills (${skills.length}):
`));
      for (const skill of skills) {
        console.log(`  ${chalk.green(skill.id.padEnd(16))} ${chalk.dim(skill.name)}`);
        console.log(`  ${" ".repeat(16)} ${skill.description}`);
        if (skill.tags.length > 0) {
          console.log(`  ${" ".repeat(16)} ${chalk.cyan(skill.tags.join(", "))}`);
        }
        console.log();
      }
      console.log(chalk.dim(`Download with: ${chalk.white("unicon skills --get <id>")}`));
      console.log(chalk.dim(`Save to file:  ${chalk.white("unicon skills --get <id> -o SKILL.md")}`));
      console.log();
    } catch (error) {
      spinner.fail("Failed to fetch skills registry");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
    return;
  }
  if (options.get) {
    const spinner = ora(`Fetching skill "${options.get}"...`).start();
    try {
      const skills = await fetchSkillsIndex();
      const skill = skills.find((s) => s.id === options.get);
      if (!skill) {
        spinner.fail(`Skill "${options.get}" not found`);
        console.log(chalk.dim(`Available: ${skills.map((s) => s.id).join(", ")}`));
        process.exit(1);
      }
      const content = await fetchSkillContent(skill.file);
      spinner.stop();
      if (options.output) {
        const fullPath = resolve(process.cwd(), options.output);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, "utf-8");
        console.log(chalk.green(`\u2713 ${skill.name} \u2192 ${options.output}`));
      } else {
        console.log(content);
      }
    } catch (error) {
      spinner.fail("Failed to fetch skill");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  }
});
program.command("skill").description("Install Unicon skill/rules for AI coding assistants").option("--ide <ide>", "Target IDE (claude, codex, cursor, agents, windsurf, opencode, gemini)").option("--all", "Install for all supported IDEs").option("-l, --list", "List supported IDEs").option("-f, --force", "Overwrite existing skill files").option("-y, --yes", "Skip confirmation prompt").action(async (options) => {
  if (options.list) {
    console.log(chalk.bold("\nSupported AI Coding Assistants:\n"));
    for (const [key, config] of Object.entries(IDE_CONFIGS)) {
      console.log(`  ${chalk.green(key.padEnd(12))} ${chalk.dim(config.description)}`);
      console.log(`  ${" ".repeat(12)} ${chalk.dim(`\u2192 ${config.dir}/`)}`);
      printSkillFileTree(`  ${" ".repeat(12)}   `);
    }
    console.log();
    console.log(chalk.dim(`Install with: ${chalk.white("npx @webrenew/unicon skill --ide <name>")}`));
    console.log(chalk.dim(`Install all:  ${chalk.white("npx @webrenew/unicon skill --all")}`));
    console.log();
    return;
  }
  const cwd = process.cwd();
  let targetIDEs = [];
  let needsConfirmation = false;
  if (options.all) {
    targetIDEs = Object.keys(IDE_CONFIGS);
    needsConfirmation = true;
  } else if (options.ide) {
    const ide = options.ide.toLowerCase();
    if (!IDE_CONFIGS[ide]) {
      console.log(chalk.red(`Unknown IDE: ${options.ide}`));
      console.log(chalk.dim(`Supported: ${Object.keys(IDE_CONFIGS).join(", ")}`));
      process.exit(1);
    }
    targetIDEs = [ide];
  } else {
    const detected = detectIDEs();
    if (detected.length > 0) {
      targetIDEs = detected;
      needsConfirmation = true;
    } else {
      console.log(chalk.yellow("No IDE configuration detected. Installing for Claude Code by default."));
      console.log(chalk.dim(`Use --ide <name> or --all for other targets.`));
      targetIDEs = ["claude"];
    }
  }
  if (needsConfirmation && !options.yes) {
    console.log(chalk.bold("\nThe following skill directories will be created:\n"));
    for (const ideKey of targetIDEs) {
      const config = IDE_CONFIGS[ideKey];
      if (!config) continue;
      const skillFile = join(cwd, config.dir, config.filename);
      const exists = existsSync(skillFile);
      if (exists && !options.force) {
        console.log(chalk.dim(`  \u2298 ${config.name.padEnd(14)} ${config.dir}/ (already exists)`));
      } else {
        console.log(`  ${chalk.green("+")} ${config.name.padEnd(14)} ${chalk.cyan(config.dir + "/")}`);
        printSkillFileTree(`    ${" ".repeat(14)} `);
      }
    }
    console.log();
    const confirmed = await confirm2("Proceed with installation?");
    if (!confirmed) {
      console.log(chalk.yellow("\nInstallation cancelled."));
      return;
    }
  }
  console.log(chalk.bold(`
Installing Unicon skill...
`));
  let installed = 0;
  let skipped = 0;
  for (const ideKey of targetIDEs) {
    const config = IDE_CONFIGS[ideKey];
    if (!config) continue;
    const targetDir = join(cwd, config.dir);
    const skillFile = join(targetDir, config.filename);
    if (existsSync(skillFile) && !options.force) {
      console.log(chalk.yellow(`  \u2298 ${config.name}: Already exists (use --force to overwrite)`));
      skipped++;
      continue;
    }
    try {
      for (const file of UNICON_SKILL_FILES) {
        const filePath = join(targetDir, file.path);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, file.content, "utf-8");
      }
      console.log(chalk.green(`  \u2713 ${config.name}: ${config.dir}/`));
      printSkillFileTree("      ");
      installed++;
    } catch (error) {
      console.log(chalk.red(`  \u2717 ${config.name}: ${error instanceof Error ? error.message : "Failed"}`));
    }
  }
  console.log();
  if (installed > 0) {
    console.log(chalk.green(`Installed ${installed} skill${installed > 1 ? "s" : ""}.`));
  }
  if (skipped > 0) {
    console.log(chalk.dim(`Skipped ${skipped} existing skill${skipped > 1 ? "s" : ""}.`));
  }
  console.log();
  console.log(chalk.dim("Your AI assistant can now help you add icons with Unicon!"));
  console.log(chalk.dim(`Try: "Add a home icon to my project"`));
  console.log();
});
program.command("star <name>").description("Add an icon to favorites").option("-s, --source <source>", "Prefer source (lucide, phosphor, hugeicons)").action(async (name, options) => {
  const spinner = ora("Finding icon...").start();
  try {
    const { icons } = await fetchIcons({
      query: name,
      source: options.source,
      limit: 10
    });
    const exactMatch = icons.find(
      (i) => i.normalizedName === name || i.normalizedName === name.toLowerCase()
    );
    const icon = exactMatch || icons[0];
    if (!icon) {
      spinner.fail(`Icon "${name}" not found.`);
      process.exit(1);
    }
    spinner.stop();
    const added = addFavorite(icon);
    if (added) {
      console.log(chalk.green(`\u2605 Added ${chalk.bold(icon.normalizedName)} to favorites`));
    } else {
      console.log(chalk.yellow(`${icon.normalizedName} is already in favorites`));
    }
  } catch (error) {
    spinner.fail("Failed to add favorite");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("unstar <name>").description("Remove an icon from favorites").action((name) => {
  const removed = removeFavorite(name);
  if (removed) {
    console.log(chalk.green(`\u2606 Removed ${chalk.bold(name)} from favorites`));
  } else {
    console.log(chalk.yellow(`${name} is not in favorites`));
  }
});
program.command("stars").description("List all favorited icons").option("-j, --json", "Output as JSON").action((options) => {
  const data = loadFavorites();
  if (data.favorites.length === 0) {
    console.log(chalk.yellow("No favorites yet. Use 'unicon star <name>' to add icons."));
    return;
  }
  if (options.json) {
    console.log(JSON.stringify(data.favorites, null, 2));
    return;
  }
  console.log(chalk.bold(`
Favorites (${data.favorites.length}):
`));
  for (const fav of data.favorites) {
    const date = new Date(fav.addedAt).toLocaleDateString();
    console.log(`  ${chalk.yellow("\u2605")} ${chalk.green(fav.name)} ${chalk.dim(`[${fav.sourceId}]`)} ${chalk.dim(date)}`);
  }
  console.log();
  console.log(chalk.dim(`Bundle all: ${chalk.white("unicon bundle --stars")}`));
  console.log(chalk.dim(`Remove:     ${chalk.white("unicon unstar <name>")}`));
  console.log();
});
program.command("bundle:add <bundle> <icons...>").description("Add icons to an existing bundle").action(async (bundleName, iconNames) => {
  const config = loadConfig();
  if (!config) {
    console.log(chalk.yellow(`No ${CONFIG_FILE} found. Run ${chalk.white("unicon init")} first.`));
    process.exit(1);
  }
  const bundle = config.bundles.find((b) => b.name === bundleName);
  if (!bundle) {
    console.log(chalk.yellow(`Bundle "${bundleName}" not found.`));
    console.log(chalk.dim(`Available bundles: ${config.bundles.map((b) => b.name).join(", ")}`));
    process.exit(1);
  }
  const existingQuery = bundle.query || "";
  const newIcons = iconNames.join(" ");
  bundle.query = existingQuery ? `${existingQuery} ${newIcons}` : newIcons;
  const configPath = resolve(process.cwd(), CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(chalk.green(`\u2713 Added ${iconNames.length} icon(s) to bundle "${bundleName}"`));
  console.log(chalk.dim(`  Query: ${bundle.query}`));
  console.log();
  const shouldSync = await confirm2("Sync bundle now?");
  if (shouldSync) {
    const spinner = ora(`${bundleName}: Fetching icons...`).start();
    try {
      const { icons } = await fetchIcons({
        query: bundle.query,
        category: bundle.category,
        source: bundle.source,
        limit: bundle.limit || 100
      });
      if (icons.length === 0) {
        spinner.warn(`${bundleName}: No icons found`);
        return;
      }
      const format = bundle.format || "react";
      let content;
      switch (format) {
        case "svg":
          content = generateSvgBundle(icons);
          break;
        case "json":
          content = generateJsonBundle(icons);
          break;
        case "react":
        default:
          content = generateReactComponents(icons);
          break;
      }
      const fullPath = resolve(process.cwd(), bundle.output);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      spinner.succeed(`${bundleName}: ${chalk.green(icons.length)} icons \u2192 ${chalk.cyan(bundle.output)}`);
    } catch (error) {
      spinner.fail(`${bundleName}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
});
program.command("browse").description("Interactive icon browser with fuzzy search").option("-s, --source <source>", "Filter by source").option("-c, --category <category>", "Filter by category").action(async (options) => {
  console.log();
  p.intro(chalk.cyan("Unicon Browser"));
  const query = await p.text({
    message: "Search icons:",
    placeholder: "e.g., arrow, dashboard, notification"
  });
  if (p.isCancel(query)) {
    p.outro(chalk.dim("Cancelled."));
    return;
  }
  const spinner = ora("Searching...").start();
  try {
    const { icons } = await fetchIcons({
      query,
      source: options.source,
      category: options.category,
      limit: 50
    });
    spinner.stop();
    if (icons.length === 0) {
      p.outro(chalk.yellow("No icons found."));
      return;
    }
    const selected = await p.multiselect({
      message: `Found ${icons.length} icons. Select to continue:`,
      options: icons.map((icon) => ({
        value: icon,
        label: icon.normalizedName,
        hint: `${icon.sourceId}${icon.category ? ` / ${icon.category}` : ""}`
      }))
    });
    if (p.isCancel(selected)) {
      p.outro(chalk.dim("Cancelled."));
      return;
    }
    const selectedIcons = selected;
    if (selectedIcons.length === 0) {
      p.outro(chalk.yellow("No icons selected."));
      return;
    }
    const action = await p.select({
      message: `What would you like to do with ${selectedIcons.length} icon(s)?`,
      options: [
        { value: "copy", label: "Copy to clipboard", hint: "Copy as React components" },
        { value: "save", label: "Save to files", hint: "Write individual files" },
        { value: "star", label: "Add to favorites", hint: "Star for later use" },
        { value: "preview", label: "Preview ASCII", hint: "Show ASCII art previews" }
      ]
    });
    if (p.isCancel(action)) {
      p.outro(chalk.dim("Cancelled."));
      return;
    }
    detectFramework();
    switch (action) {
      case "copy": {
        const components = selectedIcons.map((icon) => {
          const name = toPascalCase(icon.normalizedName);
          const jsxAttrs = getJsxAttributes(icon);
          return `export function ${name}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${jsxAttrs} aria-hidden="true" focusable="false" className={className} {...props}>
      ${icon.content}
    </svg>
  );
}`;
        });
        const content = `import type { SVGProps } from "react";

${components.join("\n\n")}`;
        const success = await copyToClipboard(content);
        p.outro(
          success ? chalk.green(`\u2713 ${selectedIcons.length} icon(s) copied to clipboard`) : chalk.red("Failed to copy to clipboard")
        );
        break;
      }
      case "save": {
        const outputPath = await p.text({
          message: "Output directory:",
          placeholder: "./src/icons",
          defaultValue: "./src/icons"
        });
        if (p.isCancel(outputPath)) {
          p.outro(chalk.dim("Cancelled."));
          return;
        }
        const outDir = resolve(process.cwd(), outputPath);
        mkdirSync(outDir, { recursive: true });
        for (const icon of selectedIcons) {
          const name = toPascalCase(icon.normalizedName);
          const jsxAttrs = getJsxAttributes(icon);
          const content = `import type { SVGProps } from "react";

export function ${name}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${jsxAttrs} aria-hidden="true" focusable="false" className={className} {...props}>
      ${icon.content}
    </svg>
  );
}`;
          writeFileSync(join(outDir, `${icon.normalizedName}.tsx`), content, "utf-8");
        }
        p.outro(chalk.green(`\u2713 ${selectedIcons.length} icon(s) saved to ${outputPath}`));
        break;
      }
      case "star": {
        let added = 0;
        for (const icon of selectedIcons) {
          if (addFavorite(icon)) added++;
        }
        p.outro(chalk.green(`\u2713 Added ${added} icon(s) to favorites`));
        break;
      }
      case "preview": {
        console.log();
        for (const icon of selectedIcons) {
          console.log(chalk.bold.cyan(icon.normalizedName) + chalk.dim(` (${icon.sourceId})`));
          console.log(chalk.dim("\u2500".repeat(20)));
          console.log(chalk.yellow(renderAsciiPreview(icon, 20, 10)));
          console.log();
        }
        p.outro(chalk.dim("Preview complete."));
        break;
      }
    }
  } catch (error) {
    spinner.stop();
    p.outro(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
});
program.command("compare <concept>").description("Compare the same icon concept across different libraries").option("-w, --width <number>", "Preview width", "16").option("-h, --height <number>", "Preview height", "10").action(async (concept, options) => {
  const spinner = ora(`Finding "${concept}" across libraries...`).start();
  const sources = ["lucide", "phosphor", "heroicons", "tabler", "feather", "iconoir"];
  const results = [];
  try {
    for (const source of sources) {
      try {
        const { icons } = await fetchIcons({
          query: concept,
          source,
          limit: 1
        });
        const match = icons.find(
          (i) => i.normalizedName.includes(concept.toLowerCase()) || concept.toLowerCase().includes(i.normalizedName)
        ) || icons[0] || null;
        results.push({ source, icon: match });
      } catch {
        results.push({ source, icon: null });
      }
    }
    spinner.stop();
    console.log();
    console.log(chalk.bold(`Comparison: "${concept}"
`));
    const width = parseInt(options.width, 10);
    const height = parseInt(options.height, 10);
    for (const { source, icon } of results) {
      if (!icon) {
        console.log(chalk.dim(`${source.padEnd(12)} - not found`));
        continue;
      }
      console.log(chalk.cyan(source.padEnd(12)) + chalk.green(icon.normalizedName));
      console.log(chalk.dim("\u2500".repeat(width)));
      const preview = renderAsciiPreview(icon, width, height);
      const lines = preview.split("\n");
      for (const line of lines) {
        console.log(chalk.yellow(line));
      }
      console.log();
    }
    console.log(chalk.dim("Get an icon:"));
    results.filter((r) => r.icon).slice(0, 3).forEach((r) => {
      console.log(chalk.dim(`  unicon get ${r.icon.normalizedName} --source ${r.source}`));
    });
    console.log();
  } catch (error) {
    spinner.fail("Comparison failed");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("audit").description("Audit project for icon usage vs bundled icons").option("-j, --json", "Output as JSON").option("-v, --verbose", "Show file locations for each icon").action(async (options) => {
  const spinner = ora("Scanning project...").start();
  try {
    const result = await auditProject();
    spinner.stop();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log();
    console.log(chalk.bold("Icon Usage Audit\n"));
    console.log(chalk.dim("\u2500".repeat(50)));
    console.log(`  ${chalk.cyan("Bundled:")}  ${result.bundled.length} icons in config`);
    console.log(`  ${chalk.green("Used:")}     ${result.used.length} icons found in code`);
    console.log(`  ${chalk.yellow("Unused:")}   ${result.unused.length} bundled but not imported`);
    console.log(`  ${chalk.red("Missing:")}  ${result.missing.length} imported but not bundled`);
    console.log(chalk.dim("\u2500".repeat(50)));
    console.log();
    if (result.unused.length > 0) {
      console.log(chalk.yellow.bold(`Unused Icons (${result.unused.length}):`));
      console.log(chalk.dim("These icons are bundled but not imported in your code:\n"));
      for (const name of result.unused.slice(0, 20)) {
        console.log(`  ${chalk.yellow("\u25CB")} ${name}`);
      }
      if (result.unused.length > 20) {
        console.log(chalk.dim(`  ... and ${result.unused.length - 20} more`));
      }
      console.log();
    }
    if (result.missing.length > 0) {
      console.log(chalk.red.bold(`Missing Icons (${result.missing.length}):`));
      console.log(chalk.dim("These icons are imported but not in your bundles:\n"));
      for (const name of result.missing.slice(0, 20)) {
        const locations = result.usageLocations[name] || [];
        console.log(`  ${chalk.red("\u2717")} ${name}`);
        if (options.verbose && locations.length > 0) {
          for (const loc of locations.slice(0, 3)) {
            const relPath = loc.replace(process.cwd() + "/", "");
            console.log(chalk.dim(`      ${relPath}`));
          }
          if (locations.length > 3) {
            console.log(chalk.dim(`      ... and ${locations.length - 3} more files`));
          }
        }
      }
      if (result.missing.length > 20) {
        console.log(chalk.dim(`  ... and ${result.missing.length - 20} more`));
      }
      console.log();
      if (result.missing.length > 0 && result.missing.length <= 10) {
        console.log(chalk.dim("Add missing icons:"));
        console.log(chalk.dim(`  unicon bundle --query "${result.missing.join(" ")}" -o ./src/icons/`));
        console.log();
      }
    }
    if (options.verbose && result.used.length > 0) {
      console.log(chalk.green.bold(`Used Icons (${result.used.length}):`));
      for (const name of result.used.slice(0, 30)) {
        const locations = result.usageLocations[name] || [];
        console.log(`  ${chalk.green("\u2713")} ${name} ${chalk.dim(`(${locations.length} file${locations.length > 1 ? "s" : ""})`)}`);
      }
      if (result.used.length > 30) {
        console.log(chalk.dim(`  ... and ${result.used.length - 30} more`));
      }
      console.log();
    }
    if (result.unused.length === 0 && result.missing.length === 0) {
      console.log(chalk.green("\u2713 All bundled icons are used and all used icons are bundled!"));
    } else if (result.missing.length > 0) {
      console.log(chalk.yellow("\u26A0 Some icons need attention. See above for details."));
    } else {
      console.log(chalk.dim("Consider removing unused icons to reduce bundle size."));
    }
    console.log();
  } catch (error) {
    spinner.fail("Audit failed");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("login").description("Authenticate to access your saved bundles for free").action(async () => {
  const existingAuth = loadAuth();
  if (existingAuth) {
    const shouldContinue = await confirm2("You are already logged in. Do you want to re-authenticate?");
    if (!shouldContinue) {
      console.log(chalk.dim("Cancelled."));
      return;
    }
  }
  console.log();
  console.log(chalk.bold("Unicon CLI Login"));
  console.log(chalk.dim("Authenticate to access your saved bundles."));
  console.log();
  const spinner = ora("Starting device authorization...").start();
  try {
    const deviceAuth = await startDeviceAuth();
    spinner.stop();
    console.log(chalk.bold("To complete login:"));
    console.log();
    console.log(`  1. Open: ${chalk.cyan(deviceAuth.verification_uri)}`);
    console.log(`  2. Enter code: ${chalk.bold.yellow(deviceAuth.user_code)}`);
    console.log();
    const { exec } = await import("child_process");
    const openCommand = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${openCommand} "${deviceAuth.verification_uri}?code=${deviceAuth.user_code}"`);
    console.log(chalk.dim("Browser opened automatically. If not, copy the URL above."));
    console.log();
    const pollSpinner = ora("Waiting for authorization...").start();
    const auth = await pollForToken(deviceAuth.device_code, 5, deviceAuth.expires_in);
    saveAuth(auth);
    pollSpinner.succeed(chalk.green("Successfully logged in!"));
    console.log();
    console.log(chalk.dim("You can now access your saved bundles with:"));
    console.log(chalk.cyan("  unicon bundles"));
    console.log();
  } catch (error) {
    spinner.fail("Login failed");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("logout").description("Log out and remove saved credentials").action(async () => {
  const auth = loadAuth();
  if (!auth) {
    console.log(chalk.dim("Not logged in."));
    return;
  }
  clearAuth();
  console.log(chalk.green("Logged out successfully."));
});
program.command("whoami").description("Show current authentication status").action(async () => {
  const token = getAuthToken();
  if (!token) {
    console.log(chalk.dim("Not logged in."));
    console.log();
    console.log(`Run ${chalk.cyan("unicon login")} to authenticate.`);
    return;
  }
  const spinner = ora("Checking authentication...").start();
  try {
    const res = await fetch(`${API_BASE}/api/bundles/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data2 = await res.json().catch(() => ({}));
      spinner.fail(data2.message || "Invalid or expired token");
      console.log();
      console.log(`Run ${chalk.cyan("unicon login")} to re-authenticate.`);
      return;
    }
    const data = await res.json();
    spinner.succeed(chalk.green("Authenticated"));
    console.log();
    console.log(`  Bundles: ${chalk.bold(data.total)} saved`);
    console.log();
  } catch (error) {
    spinner.fail("Failed to check authentication");
    console.error(chalk.red(error instanceof Error ? error.message : "Network error"));
  }
});
program.command("bundles").description("List your saved bundles (requires login)").option("-j, --json", "Output as JSON").action(async (options) => {
  const token = getAuthToken();
  if (!token) {
    console.log(chalk.red("Not logged in."));
    console.log();
    console.log(`Run ${chalk.cyan("unicon login")} to authenticate.`);
    process.exit(1);
  }
  const spinner = ora("Fetching your bundles...").start();
  try {
    const res = await fetch(`${API_BASE}/api/bundles/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data2 = await res.json().catch(() => ({}));
      if (res.status === 401) {
        spinner.fail("Session expired");
        console.log();
        console.log(`Run ${chalk.cyan("unicon login")} to re-authenticate.`);
        process.exit(1);
      }
      if (res.status === 403) {
        spinner.fail(data2.message || "Authentication failed");
        process.exit(1);
      }
      throw new Error(data2.message || "Failed to fetch bundles");
    }
    const data = await res.json();
    spinner.stop();
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (data.bundles.length === 0) {
      console.log(chalk.dim("No bundles found."));
      console.log();
      console.log(`Create bundles at ${chalk.cyan("https://unicon.sh/bundles")}`);
      return;
    }
    console.log(chalk.bold(`Your Bundles (${data.total})`));
    console.log();
    for (const bundle of data.bundles) {
      const publicTag = bundle.is_public ? chalk.green(" [public]") : "";
      console.log(`  ${chalk.cyan(bundle.name)}${publicTag}`);
      console.log(chalk.dim(`    ID: ${bundle.id}`));
      console.log(chalk.dim(`    Icons: ${bundle.icon_count}`));
      if (bundle.description) {
        console.log(chalk.dim(`    ${bundle.description}`));
      }
      console.log();
    }
    console.log(chalk.dim(`Use ${chalk.cyan("unicon bundle:pull <id>")} to download a bundle.`));
  } catch (error) {
    spinner.fail("Failed to fetch bundles");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("bundle:pull <bundleId>").description("Download a bundle to your project (requires login)").option("-o, --output <path>", "Output file path", "src/components/icons/bundle.tsx").option("-f, --format <format>", "Output format (react, svg, json)", "react").action(async (bundleId, options) => {
  const token = getAuthToken();
  if (!token) {
    console.log(chalk.red("Not logged in."));
    console.log();
    console.log(`Run ${chalk.cyan("unicon login")} to authenticate.`);
    process.exit(1);
  }
  const spinner = ora("Fetching bundle...").start();
  try {
    const url = new URL(`${API_BASE}/api/bundles/me/${bundleId}`);
    url.searchParams.set("format", options.format);
    url.searchParams.set("code", "true");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data2 = await res.json().catch(() => ({}));
      if (res.status === 401) {
        spinner.fail("Session expired");
        console.log();
        console.log(`Run ${chalk.cyan("unicon login")} to re-authenticate.`);
        process.exit(1);
      }
      if (res.status === 404) {
        spinner.fail("Bundle not found");
        console.log();
        console.log(`Run ${chalk.cyan("unicon bundles")} to see your bundles.`);
        process.exit(1);
      }
      throw new Error(data2.message || "Failed to fetch bundle");
    }
    const data = await res.json();
    spinner.stop();
    if (!data.code) {
      console.log(chalk.yellow("Bundle is empty - no icons to export."));
      return;
    }
    const outputPath = resolve(process.cwd(), options.output);
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    writeFileSync(outputPath, data.code, "utf-8");
    console.log(chalk.green(`Bundle "${data.bundle.name}" saved to ${options.output}`));
    console.log(chalk.dim(`  ${data.bundle.icon_count} icons exported as ${options.format}`));
  } catch (error) {
    spinner.fail("Failed to pull bundle");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.parse();
