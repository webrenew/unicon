#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import figlet from "figlet";
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { dirname, resolve, join, extname, sep } from "path";
import { homedir } from "os";
import { createRequire } from "module";
import { createInterface } from "readline";
import * as p from "@clack/prompts";
import clipboard from "clipboardy";
import chokidar from "chokidar";

// ../../skills/unicon/SKILL.md
var SKILL_default = '---\nname: unicon\ndescription: Adds icons to web projects with Unicon, which generates zero-dependency icon code from 19,000+ icons in Lucide, Phosphor, Hugeicons, Heroicons, Tabler, Feather, Remix, Iconoir, and Simple Icons (brand logos). Searches icons semantically, then writes React, Vue, Svelte, SVG, or JSON into the project with the `unicon` CLI (`npx @webrenew/unicon`) or the unicon.sh REST API. Use this skill whenever the user wants to add, find, replace, or bundle icons or brand logos in a React, Next.js, Vue, Nuxt, Svelte, or HTML project, mentions Unicon, `.uniconrc.json`, or `unicon` commands, or wants icons without adding a package such as lucide-react or react-icons, even if they only say "put a settings icon here" or "I need the GitHub logo". When Unicon MCP tools are connected, see the unicon-mcp skill.\nlicense: MIT\ncompatibility: Requires Node.js 18+, @webrenew/unicon 0.4.0+ (what npx installs), and network access to https://unicon.sh.\nmetadata:\n  author: webrenew\n  version: "0.4.0"\n  website: https://unicon.sh\n  repository: https://github.com/WebRenew/unicon\n  openclaw:\n    emoji: "\u{1F984}"\n    requires:\n      bins: ["node"]\n    install:\n      - type: node\n        package: "@webrenew/unicon"\n        global: true\n---\n\n# Unicon\n\nUnicon writes icon source code into the project instead of adding an icon\npackage. Each icon becomes a small component, SVG file, or JSON object that the\nproject owns. Only the icons in use ship, and there is no dependency to install\nor upgrade.\n\nRun the CLI with `npx @webrenew/unicon <command>`. If it is installed globally\n(`npm install -g @webrenew/unicon`), use `unicon <command>`. Every command\ncalls https://unicon.sh, so it needs network access.\n\nRun `npx` commands one at a time, not in parallel. Parallel `npx` runs share\nthe npm cache, and the first run can fail with `EEXIST` or a missing module\nwhile the package downloads. If that happens, run the command again.\n\n## Choose an approach\n\n| The user wants | Use |\n|----------------|-----|\n| One icon, or a few specific icons | `unicon get <name>`, or `unicon bundle --icons a,b,c` |\n| A themed set of icons (navigation, social, ...) | `unicon bundle --query ... -o <dir>` |\n| A set the team regenerates later | `.uniconrc.json` and `unicon sync` |\n| Icons fetched from code, or no Node.js | The REST API, see [api-reference.md](references/api-reference.md) |\n| Unicon MCP tools are connected | The MCP tools, see the unicon-mcp skill |\n\n## Workflow\n\n### 1. Match the project\n\nRead `package.json` and look at the icons the project already uses before you\nadd new ones. Icon libraries differ in stroke width, corner style, and grid,\nso icons from two libraries side by side look inconsistent. If the project\nalready uses one style, keep to its library with `--source`. For example, a\nshadcn/ui project uses Lucide, so use `--source lucide`. Use `simple-icons`\nfor brand logos.\n\n### 2. Search, then use exact names\n\n```bash\nnpx @webrenew/unicon search "log out" --source lucide --limit 10 --json\n```\n\nSearch is semantic, so describe the concept ("sign out", "delete") instead of\nguessing a file name. Results identify icons as `source:name`, for example\n`lucide:log-out`. The same name exists in several libraries, so pass the\nsame `--source` to `get` or `bundle` to get the icon you picked. Use `--json`\nwhen you read the results yourself, because the default output is formatted\nfor people.\n\n### 3. Generate the code\n\n**Specific icons:** use `get` for one icon, or `bundle --icons` for several:\n\n```bash\nnpx @webrenew/unicon get log-out --source lucide -o src/components/icons\nnpx @webrenew/unicon bundle --icons settings,log-out,user --source lucide -o src/components/icons\n```\n\nBoth match names exactly. `get` takes a name (`log-out`) and `--icons` also\ntakes full IDs (`lucide:log-out,simple-icons:github`), so one command can mix\nlibraries. If a name does not exist, `get` exits with an error and suggests\nsimilar icons, and `bundle` warns and writes the rest. Copy names from the\n`search` output.\n\n`-o` takes a directory or a file. In a directory, `get` writes\n`<name>.<ext>`, and `bundle` writes one file per icon and an `index.ts` that\nre-exports the components, so bundlers drop the icons the app does not\nimport. Without `-o`, `get` prints the code. When two libraries have an icon\nwith the same name, the second file gets the library as a suffix\n(`home-tabler.tsx`, component `HomeTabler`).\n\nThe format follows the framework in `package.json`: `react`, `next`, or\n`@remix-run/react` give `react`; `vue` or `nuxt` give `vue`; `svelte` or\n`@sveltejs/kit` give `svelte`. Otherwise the format is `react`. Pass\n`--format react|vue|svelte|svg|json` to choose it yourself. With `svg`, a\ndirectory gets one `.svg` file per icon, and a file path gets an SVG sprite of\n`<symbol>` elements.\n\n**A themed set:** use `bundle --query`:\n\n```bash\nnpx @webrenew/unicon bundle --query "arrows chevrons" --source lucide --limit 20 -o src/components/icons\n```\n\nA query adds up to `--limit` matches (default 100), and some can be loosely\nrelated. Run the same `search` first, then either set `--limit` or pass the\nnames you want with `--icons`.\n\n**A repeatable set:** use the config file:\n\n```bash\nnpx @webrenew/unicon add nav --icons home,search,bell,user --source lucide\nnpx @webrenew/unicon sync\n```\n\n`add` creates an entry in `.uniconrc.json`, and `sync` regenerates every\nentry. List exact names in `icons`; a `query` adds search results, which can\nchange as the index changes. An `output` without an extension\n(`./src/icons/nav`) gets one file per icon; Vue and Svelte need this. `sync`\nexits with an error if a listed icon does not exist, so it can run in CI.\nRead [config-file.md](references/config-file.md) before you edit the config\nby hand.\n\n### 4. Use the icons and verify\n\nGenerated React components look like this:\n\n```tsx\nexport function LogOut({ className, ...props }: SVGProps<SVGSVGElement>) {\n  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" /* ... */ className={className} {...props} />;\n}\n```\n\n- Components use `currentColor`, so set the color with CSS or text classes.\n- Components have no fixed size. Set the size with `className`, for example\n  `className="size-4"`, or with `width` and `height`.\n- Components are `aria-hidden`. Next to an icon-only button, add an\n  `aria-label` to the button.\n- Fill icons (Phosphor, Remix, Simple Icons logos, Heroicons and Iconoir\n  solid) use `fill="currentColor"`, and stroke icons use `stroke`. The API\n  data has each logo\'s brand color (`brandColor`).\n\nImport from the generated path, then run the project\'s typecheck or build to\nconfirm that the imports resolve.\n\n## Commands that need a terminal\n\n`search --pick`, `init --interactive`, and `browse` wait for keyboard input.\nThey stop an agent that runs commands without a terminal. Use the\nnon-interactive flags shown above instead. `--copy` copies to the clipboard,\nwhich is useful for a person, not for an agent.\n\n## Libraries\n\n| Source | Icons | Notes |\n|--------|-------|-------|\n| `lucide` | 1,900+ | Stroke icons, the shadcn/ui default |\n| `phosphor` | 1,500+ | |\n| `hugeicons` | 1,800+ | |\n| `heroicons` | 640+ | Tailwind Labs |\n| `tabler` | 4,900+ | Stroke icons, largest set |\n| `feather` | 280+ | Lucide\'s predecessor |\n| `remix` | 3,100+ | |\n| `iconoir` | 1,600+ | |\n| `simple-icons` | 3,300+ | Brand logos |\n\n`npx @webrenew/unicon sources` prints the current list.\n\n## References\n\n- [cli-commands.md](references/cli-commands.md): every command and flag.\n  Read it for options not shown here, or for `audit`, `compare`, `stars`,\n  `login`, `bundles`, and `bundle:pull`.\n- [config-file.md](references/config-file.md): the `.uniconrc.json` fields.\n  Read it before you write or edit the config by hand.\n- [api-reference.md](references/api-reference.md): REST endpoints,\n  parameters, the response format, and rate limits. Read it when code calls\n  unicon.sh directly or when the CLI is not available.\n';

// ../../skills/unicon/references/cli-commands.md
var cli_commands_default = '# CLI Commands Reference\n\nEvery command and option in the Unicon CLI (`@webrenew/unicon` 0.3.x).\n\nRun commands with `npx @webrenew/unicon <command>`, or with `unicon <command>`\nafter `npm install -g @webrenew/unicon`.\n\nCommands marked **(interactive)** wait for keyboard input. Do not run them\nfrom an agent without a terminal.\n\n## Contents\n\n- Find icons: [search](#unicon-search-query), [info](#unicon-info-name),\n  [preview](#unicon-preview-name), [compare](#unicon-compare-concept),\n  [browse](#unicon-browse), [sources](#unicon-sources),\n  [categories](#unicon-categories)\n- Generate code: [get](#unicon-get-name), [bundle](#unicon-bundle)\n- Config file: [init](#unicon-init), [add](#unicon-add-name),\n  [bundle:add](#unicon-bundleadd-bundle-icons), [sync](#unicon-sync),\n  [audit](#unicon-audit)\n- Favorites: [star](#unicon-star-name), [unstar](#unicon-unstar-name),\n  [stars](#unicon-stars)\n- Saved bundles from unicon.sh: [login](#unicon-login),\n  [logout](#unicon-logout), [whoami](#unicon-whoami),\n  [bundles](#unicon-bundles), [bundle:pull](#unicon-bundlepull-bundleid)\n- Assistant skills: [skill](#unicon-skill), [skills](#unicon-skills)\n- Other: [cache](#unicon-cache), [global options](#global-options),\n  [environment variables](#environment-variables),\n  [framework detection](#framework-detection)\n\n---\n\n## Find icons\n\n### `unicon search <query>`\n\nSemantic search: describe the concept, not the file name.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-s, --source <source>` | Filter by library | all |\n| `-c, --category <category>` | Filter by category | all |\n| `-l, --limit <number>` | Maximum results | 20 |\n| `-j, --json` | Output JSON (use when a program reads the output) | off |\n| `-p, --pick` | **(interactive)** Select results, then copy, save, star, or add them to a bundle | off |\n\n```bash\nunicon search "dashboard"\nunicon search "arrow" --source lucide --limit 10 --json\n```\n\n### `unicon info <name>`\n\nShow an icon\'s library, category, viewBox, tags, and example commands.\n\n| Option | Description |\n|--------|-------------|\n| `-s, --source <source>` | Prefer this library |\n\n### `unicon preview <name>`\n\nDraw an icon as ASCII art in the terminal.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-s, --source <source>` | Prefer this library | |\n| `-w, --width <number>` | Width in characters | 20 |\n| `-h, --height <number>` | Height in characters | 20 |\n\n### `unicon compare <concept>`\n\nShow the same concept (for example `home`) from each library side by side, to\nhelp choose a library.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-w, --width <number>` | Preview width | 16 |\n| `-h, --height <number>` | Preview height | 10 |\n\n### `unicon browse`\n\n**(interactive)** Browse icons with fuzzy search.\n\n| Option | Description |\n|--------|-------------|\n| `-s, --source <source>` | Filter by library |\n| `-c, --category <category>` | Filter by category |\n\n### `unicon sources`\n\nList the nine icon libraries and their `--source` IDs.\n\n### `unicon categories`\n\nList the icon categories. `-j, --json` outputs JSON.\n\n---\n\n## Generate code\n\n### `unicon get <name>`\n\nWrite one icon to stdout, a file, a directory, or the clipboard.\n\n`name` is an exact icon name (`log-out`) or ID (`lucide:log-out`). If no icon\nhas that name, `get` exits with code 1 and lists similar icons; it never\nsubstitutes a different icon. Use names from `search` output.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-s, --source <source>` | Library to take the icon from. Without it, Lucide, then the first library with that name | |\n| `-f, --format <format>` | `react`, `vue`, `svelte`, `svg`, `json` | from `package.json` |\n| `-o, --output <path>` | A file, or a directory (writes `<name>.<ext>` in it) | stdout |\n| `-c, --copy` | Copy to the clipboard | off |\n\n```bash\nunicon get settings --source lucide -o src/components/icons\nunicon get simple-icons:github -o src/components/icons/github.tsx\nunicon get home --format vue -o components/icons\n```\n\n### `unicon bundle`\n\nWrite many icons at once: exact names, a search, or favorites.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-i, --icons <icons>` | Exact icons, comma-separated: `home,lucide:settings,simple-icons:github` | |\n| `-q, --query <query>` | Search query | |\n| `-c, --category <category>` | Category filter for the search | |\n| `-s, --source <source>` | Library for bare `--icons` names, and filter for the search | all |\n| `-f, --format <format>` | `react`, `vue`, `svelte`, `svg`, `json` | from `package.json` |\n| `-o, --output <path>` | A directory (one file per icon) or a file (every icon in one file) | `./icons` |\n| `-l, --limit <number>` | Maximum icons from a search | 100 |\n| `--single-file` | Write `icons.<ext>` inside the output directory instead of one file per icon. `react`, `svg`, `json` only | off |\n| `--stars` | Bundle the favorited icons | off |\n\nOutput, by path and format:\n\n- **Directory, `react`/`vue`/`svelte`:** one component per file and an\n  `index.ts` that re-exports them, so bundlers remove unused icons.\n- **Directory, `svg`/`json`:** one `.svg` or `.json` file per icon.\n- **File, `react`:** every component in one `.tsx` file (not tree-shakeable).\n- **File, `svg`:** an SVG sprite with a `<symbol id="<name>">` per icon, for\n  `<svg><use href="/icons.svg#home" /></svg>`.\n- **File, `json`:** a JSON array.\n- Vue and Svelte always need a directory.\n\nWith `--icons`, names that do not exist are reported and the rest are\nwritten. When two libraries have an icon with the same name, the second file\ngets the library as a suffix (`home-tabler.tsx`, component `HomeTabler`).\n\n```bash\nunicon bundle --icons settings,log-out,user --source lucide -o src/components/icons\nunicon bundle --icons github,discord,x --source simple-icons --format svg -o public/logos\nunicon bundle --category Arrows --source lucide --limit 30 -o src/components/icons/arrows\nunicon bundle --icons home,menu,x --source lucide --format svg -o public/icons.svg\nunicon bundle --stars -o src/components/icons/favorites\n```\n\n---\n\n## Config file\n\nSee [config-file.md](config-file.md) for the file format.\n\n### `unicon init`\n\nCreate `.uniconrc.json` in the current directory.\n\n| Option | Description |\n|--------|-------------|\n| `-f, --force` | Overwrite an existing config |\n| `-i, --interactive` | **(interactive)** Choose the framework, library, output directory, and a first bundle |\n\n### `unicon add <name>`\n\nAdd a bundle entry to `.uniconrc.json`, creating the file if needed. It does\nnot generate code; run `unicon sync` afterwards.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-i, --icons <icons>` | Exact icons, comma-separated | |\n| `-q, --query <query>` | Search query | |\n| `-c, --category <category>` | Category filter | |\n| `-s, --source <source>` | Library for bare names, and search filter | all |\n| `-f, --format <format>` | `react`, `vue`, `svelte`, `svg`, `json` | from `package.json` |\n| `-l, --limit <number>` | Maximum icons from a search | 50 |\n| `-o, --output <path>` | Output directory or file | `./src/icons/<name>` (components), `./src/icons/<name>.<ext>` (svg, json) |\n\n```bash\nunicon add nav --icons home,search,bell,user --source lucide\nunicon add social --icons github,discord,x --source simple-icons\nunicon add arrows --query "arrow chevron" --source lucide --limit 20\n```\n\n### `unicon bundle:add <bundle> <icons...>`\n\nAppend exact icons (`name` or `source:name`) to a bundle\'s `icons` list.\nIn a terminal it asks whether to sync the bundle; `--sync` syncs without\nasking. Without a terminal and without `--sync`, it only updates the config.\n\n```bash\nunicon bundle:add nav settings lucide:log-out --sync\n```\n\n### `unicon sync`\n\nGenerate the code for each bundle in `.uniconrc.json`, in the bundle\'s\n`format` at its `output`, as described in [config-file.md](config-file.md).\n`sync` exits with code 1 when a bundle fails or a listed icon does not exist,\nso it can run in CI.\n\n| Option | Description |\n|--------|-------------|\n| `-n, --name <name>` | Sync only this bundle |\n| `-d, --dry-run` | Show what would be written, without writing |\n| `-w, --watch` | Sync again when the config changes (runs until stopped) |\n\n### `unicon audit`\n\nCompare the bundled icons with the icons the code imports. It reports unused\nicons (bundled but not imported) and missing icons (imported but not bundled).\n\n| Option | Description |\n|--------|-------------|\n| `-j, --json` | Output JSON |\n| `-v, --verbose` | Show the file locations for each icon |\n\n---\n\n## Favorites\n\nFavorites are stored locally in `~/.unicon`.\n\n### `unicon star <name>`\n\nAdd an icon to favorites. `-s, --source <source>` prefers a library.\n\n### `unicon unstar <name>`\n\nRemove an icon from favorites.\n\n### `unicon stars`\n\nList favorites. `-j, --json` outputs JSON. Use `unicon bundle --stars` to\ngenerate them.\n\n---\n\n## Saved bundles from unicon.sh\n\nBundles saved on https://unicon.sh/bundles can be pulled into a project.\n\n### `unicon login`\n\nSign in with a device code in the browser. Credentials are saved to\n`~/.unicon/auth.json`. Set `UNICON_API_TOKEN` instead in CI.\n\n### `unicon logout`\n\nRemove the saved credentials.\n\n### `unicon whoami`\n\nShow whether the CLI is signed in.\n\n### `unicon bundles`\n\nList your saved bundles (requires login). `-j, --json` outputs JSON.\n\n### `unicon bundle:pull <bundleId>`\n\nWrite a saved bundle into the project (requires login).\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `-o, --output <path>` | Output file | `src/components/icons/bundle.tsx` |\n| `-f, --format <format>` | `react`, `svg`, or `json` | `react` |\n\n---\n\n## Assistant skills\n\n### `unicon skill`\n\nInstall the Unicon skill (`SKILL.md` and its references) into a project for\ncoding assistants.\n\n| Option | Description |\n|--------|-------------|\n| `--ide <ide>` | `claude`, `codex`, `cursor`, `agents`, `windsurf`, `opencode`, or `gemini` |\n| `--all` | Install for every supported assistant |\n| `-l, --list` | List the supported assistants and install paths |\n| `-f, --force` | Overwrite existing files |\n| `-y, --yes` | Skip the confirmation prompt |\n\nEach assistant gets `.<ide>/skills/unicon/` (for example\n`.claude/skills/unicon/SKILL.md`). Run `unicon skill --list` for the exact\npaths.\n\n### `unicon skills`\n\nList and download skills from the registry at https://unicon.sh/skills.\n\n| Option | Description |\n|--------|-------------|\n| `-l, --list` | List skills |\n| `-g, --get <id>` | Print a skill (`unicon` or `unicon-mcp`) |\n| `-o, --output <path>` | Write the skill to a file instead |\n| `-j, --json` | Output the list as JSON |\n\n---\n\n## Other\n\n### `unicon cache`\n\nAPI responses are cached in `~/.unicon/cache` for 24 hours.\n\n| Option | Description |\n|--------|-------------|\n| `-s, --stats` | Show cache size and entries |\n| `-c, --clear` | Delete the cache |\n\n### Global options\n\n| Option | Description |\n|--------|-------------|\n| `-h, --help` | Show help for the CLI or a command |\n| `-V, --version` | Show the version |\n\n### Environment variables\n\n| Variable | Description |\n|----------|-------------|\n| `UNICON_API_URL` | API base URL (default `https://unicon.sh`), for a self-hosted Unicon |\n| `UNICON_API_TOKEN` | API token for saved bundles, used instead of `unicon login` |\n\n### Framework detection\n\nWhen no `--format` is given, the CLI reads `package.json` dependencies:\n\n| Dependencies | Format |\n|--------------|--------|\n| `react`, `next`, `@remix-run/react` | `react` |\n| `vue`, `nuxt`, `@nuxt/kit` | `vue` |\n| `svelte`, `@sveltejs/kit` | `svelte` |\n| none of these | `react` |\n';

// ../../skills/unicon/references/config-file.md
var config_file_default = '# `.uniconrc.json` Reference\n\n`.uniconrc.json` lists icon bundles for `unicon sync` to generate. Put it in\nthe project root, next to `package.json`, and commit it together with the\ngenerated files so the team can regenerate the same icons.\n\n## Format\n\n```json\n{\n  "$schema": "https://unicon.sh/schema/uniconrc.json",\n  "bundles": [\n    {\n      "name": "nav",\n      "icons": ["home", "search", "bell", "user", "simple-icons:github"],\n      "source": "lucide",\n      "format": "react",\n      "output": "./src/icons/nav"\n    }\n  ]\n}\n```\n\nThe `$schema` URL gives editors completion and validation. The schema rejects\nfields the CLI does not read, such as `outputDir`, `split`, or `strokeWidth`.\n\n### Root\n\n| Field | Type | Description |\n|-------|------|-------------|\n| `$schema` | string | Optional. Written by `unicon init` |\n| `bundles` | array | The bundles to generate |\n\n### Bundle\n\n| Field | Type | Required | Description |\n|-------|------|----------|-------------|\n| `name` | string | yes | Unique bundle name, used by `sync --name` and `bundle:add` |\n| `output` | string | yes | A directory or a file, relative to the project root. See [Output](#output) |\n| `icons` | string[] | one of `icons`, `query`, `category`, `source` | Exact icons: `name` (from `source`, else Lucide) or `source:name` |\n| `query` | string | one of `icons`, `query`, `category`, `source` | Semantic search query |\n| `category` | string | one of `icons`, `query`, `category`, `source` | Category filter for the search, for example `Arrows` |\n| `source` | string | one of `icons`, `query`, `category`, `source` | Library: `lucide`, `phosphor`, `hugeicons`, `heroicons`, `tabler`, `feather`, `remix`, `iconoir`, `simple-icons` |\n| `format` | string | no | `react`, `vue`, `svelte`, `svg`, or `json`. Default: the framework in `package.json`, else `react` |\n| `limit` | number | no | Maximum icons from `query`, `category`, or `source`. Default 100 |\n\n## How selection works\n\n- **`icons`** selects exact icons, in order. Use it whenever you know which\n  icons you want. A name that does not exist makes `sync` fail with\n  `Not found: <name>`, so typos show up instead of producing a different icon.\n- **`query`, `category`, `source`** run a search and add up to `limit`\n  matches. Search is semantic, so a query such as `"user"` can return `users`\n  before `user`, and results can change as the index changes. Use a search\n  for a themed set where the exact members do not matter.\n- With both, `sync` writes the `icons` first and then the search results that\n  are not already in the list. `source` alone (no `icons` or `query`) adds the\n  first `limit` icons of that library.\n\n`unicon bundle:add <bundle> <icons...>` appends to `icons`.\n\n## Output\n\n| `output` | `format` | Result |\n|----------|----------|--------|\n| A directory (`./src/icons/nav`, no extension) | `react`, `vue`, `svelte` | One component file per icon and an `index.ts` that re-exports them. Bundlers drop the icons the app does not import |\n| A directory | `svg`, `json` | One `.svg` or `.json` file per icon |\n| A file (`./src/icons/nav.tsx`) | `react` | All components in one file. Not tree-shakeable |\n| A file (`./public/icons.svg`) | `svg` | An SVG sprite with one `<symbol id="<name>">` per icon. Use it with `<svg><use href="/icons.svg#home" /></svg>` |\n| A file (`./src/icons/nav.json`) | `json` | A JSON array with each icon\'s data |\n| A file | `vue`, `svelte` | Error: Vue and Svelte need one component per file, so use a directory |\n\nWhen two libraries have an icon with the same name, the second gets the\nlibrary as a suffix: `home.tsx` and `home-tabler.tsx`, components `Home` and\n`HomeTabler`.\n\n## Examples\n\n### React app with exact icons\n\n```json\n{\n  "bundles": [\n    {\n      "name": "ui",\n      "icons": ["home", "search", "settings", "log-out", "user"],\n      "source": "lucide",\n      "output": "./src/components/icons"\n    },\n    {\n      "name": "social",\n      "icons": ["github", "discord", "x"],\n      "source": "simple-icons",\n      "output": "./src/components/icons/social"\n    }\n  ]\n}\n```\n\nImport with `import { Home, Search } from "@/components/icons";`.\n\n### Nuxt or SvelteKit\n\n```json\n{\n  "bundles": [\n    { "name": "header", "icons": ["settings", "log-out", "user"], "source": "lucide", "output": "./components/icons/header" }\n  ]\n}\n```\n\n`format` is detected from `nuxt`, `vue`, `svelte`, or `@sveltejs/kit` in\n`package.json`. Each icon becomes a `.vue` or `.svelte` file.\n\n### SVG sprite and a themed set\n\n```json\n{\n  "bundles": [\n    { "name": "sprite", "icons": ["home", "menu", "x"], "source": "lucide", "format": "svg", "output": "./public/icons.svg" },\n    { "name": "arrows", "query": "arrow chevron", "source": "lucide", "limit": 20, "output": "./src/icons/arrows" }\n  ]\n}\n```\n\n## Workflow\n\n1. `unicon init` creates the file. `unicon add <name> --icons ...` or\n   `unicon add <name> --query ...` adds a bundle.\n2. `unicon sync --dry-run` shows what each bundle would write.\n3. `unicon sync` writes the files. It exits with code 1 when a bundle fails or\n   a listed icon does not exist, so it can run in CI. `unicon sync --watch`\n   writes them again when the config changes.\n4. `unicon audit` finds icons that are bundled but unused, or imported but not\n   bundled.\n';

// ../../skills/unicon/references/api-reference.md
var api_reference_default = '# API Reference\n\nThe REST API returns icon data for code that calls unicon.sh directly. No\nauthentication is needed for these endpoints.\n\n**Base URL**: `https://unicon.sh/api`\n\n**Rate limit**: 60 requests per minute per IP address, shared across these\nendpoints. Over the limit, the API returns `429` with `Retry-After` and\n`X-RateLimit-*` headers. Cache results instead of searching on every\nkeystroke.\n\n---\n\n## GET /api/icons\n\nFetch icons with optional filters. Supports AI-powered semantic search.\nAllows cross-origin requests (`Access-Control-Allow-Origin: *`).\n\n### Parameters\n\n| Parameter | Type | Description | Default |\n|-----------|------|-------------|---------|\n| `q` | string | Search query. Semantic search for 3+ characters, text search otherwise | - |\n| `source` | string | Filter by library | all |\n| `category` | string | Filter by category (text search and browsing only) | all |\n| `names` | string | Comma-separated exact normalized names, for example `home,settings`. Returns every library\'s icon with each name | - |\n| `limit` | number | Results per page (max 320) | 100 |\n| `offset` | number | Pagination offset | 0 |\n| `ai` | boolean | `false` uses fast text search instead of semantic search | true |\n\n### Response\n\n```json\n{\n  "icons": [\n    {\n      "id": "lucide:home",\n      "name": "Home",\n      "normalizedName": "home",\n      "sourceId": "lucide",\n      "category": "Buildings",\n      "tags": ["house", "building", "residence"],\n      "viewBox": "0 0 24 24",\n      "content": "<path d=\\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\\"/>...",\n      "defaultStroke": true,\n      "defaultFill": false,\n      "strokeWidth": "2",\n      "brandColor": null\n    }\n  ],\n  "hasMore": true,\n  "searchType": "semantic",\n  "expandedQuery": "home house building residence dwelling"\n}\n```\n\nText search and browsing responses also include `total`, the number of\nmatching icons. Semantic responses do not.\n\n### Search Types\n\n| Type | Description |\n|------|-------------|\n| `semantic` | AI-powered vector search with query expansion |\n| `text` | Name and tag matching with aliases (`ai=false`, short queries, or fallback) |\n| `exact` | Exact name match (when using `names` param) |\n\n### Examples\n\n```bash\n# Search with AI\ncurl "https://unicon.sh/api/icons?q=dashboard"\n\n# Filter by source\ncurl "https://unicon.sh/api/icons?q=arrow&source=lucide"\n\n# Get specific icons by name\ncurl "https://unicon.sh/api/icons?names=home,settings,user"\n\n# Browse by category\ncurl "https://unicon.sh/api/icons?category=Social&limit=50"\n\n# Disable AI search\ncurl "https://unicon.sh/api/icons?q=home&ai=false"\n```\n\n---\n\n## POST /api/search\n\nHybrid semantic + exact match search with scoring.\n\n### Request Body\n\n```json\n{\n  "query": "string (required)",\n  "sourceId": "string (optional)",\n  "limit": "number (optional, default 50, max 320)",\n  "offset": "number (optional, default 0)",\n  "useAI": "boolean (optional, default false)"\n}\n```\n\nQueries shorter than 3 characters use text search. `useAI: true` asks Claude\nto expand queries that the built-in synonyms do not cover, with a 2-second\ntime limit.\n\n### Response\n\n```json\n{\n  "results": [\n    {\n      "id": "lucide:home",\n      "name": "Home",\n      "normalizedName": "home",\n      "sourceId": "lucide",\n      "category": "Buildings",\n      "tags": ["house", "building"],\n      "viewBox": "0 0 24 24",\n      "content": "<path ... />",\n      "defaultStroke": true,\n      "defaultFill": false,\n      "strokeWidth": "2",\n      "brandColor": null,\n      "score": 0.95\n    }\n  ],\n  "searchType": "semantic",\n  "expandedQuery": "home house building residence",\n  "hasMore": true\n}\n```\n\n### Score\n\nResults include a `score` (0-1) combining:\n- **Semantic similarity** (60% weight) - Vector distance\n- **Exact match boost** (40% weight) - Name/tag/category matches\n\n### Examples\n\n```bash\n# Basic search\ncurl -X POST "https://unicon.sh/api/search" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"query": "dashboard"}\'\n\n# Filter by source\ncurl -X POST "https://unicon.sh/api/search" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"query": "arrow", "sourceId": "phosphor", "limit": 20}\'\n\n# Enable AI expansion\ncurl -X POST "https://unicon.sh/api/search" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"query": "celebration", "useAI": true}\'\n```\n\n---\n\n## Icon Data Schema\n\n```typescript\ninterface IconData {\n  id: string;              // "lucide:home"\n  name: string;            // "Home" (PascalCase)\n  normalizedName: string;  // "home" (kebab-case)\n  sourceId: string;        // "lucide", "phosphor", etc.\n  category: string | null; // "Buildings", "Arrows", etc.\n  tags: string[];          // ["house", "building"]\n  viewBox: string;         // "0 0 24 24"\n  content: string;         // Raw SVG inner content\n  pathData: { tag: string; attrs: Record<string, string> }[] | null; // Parsed elements (semantic results only)\n  defaultStroke: boolean;  // Uses stroke for rendering\n  defaultFill: boolean;    // Uses fill for rendering\n  strokeWidth: string | null;\n  brandColor: string | null; // Hex color for brand icons\n}\n```\n\n---\n\n## Available Sources\n\n| ID | Name | Icons |\n|----|------|-------|\n| `lucide` | Lucide | 1,900+ |\n| `phosphor` | Phosphor | 1,500+ |\n| `hugeicons` | Huge Icons | 1,800+ |\n| `heroicons` | Heroicons | 640+ |\n| `tabler` | Tabler | 4,900+ |\n| `feather` | Feather | 280+ |\n| `remix` | Remix Icon | 3,100+ |\n| `iconoir` | Iconoir | 1,600+ |\n| `simple-icons` | Simple Icons (brand logos) | 3,300+ |\n\n---\n\n## Caching\n\nResponses are cached at the CDN:\n\n| Request | Cache time |\n|---------|-----------|\n| Browsing, text search, `names` | 1 hour |\n| Semantic search (`GET /api/icons?q=...`) | 30 minutes |\n| `POST /api/search` with an AI-expanded query | 1 minute |\n\nRequests that the CDN answers from its cache never reach the server and do\nnot count toward the rate limit.\n\n---\n\n## Usage in Code\n\n### JavaScript/TypeScript\n\n```typescript\nasync function searchIcons(query: string) {\n  const response = await fetch(\n    `https://unicon.sh/api/icons?q=${encodeURIComponent(query)}`\n  );\n  const { icons } = await response.json();\n  return icons;\n}\n\n// Get specific icons\nasync function getIcons(names: string[]) {\n  const response = await fetch(\n    `https://unicon.sh/api/icons?names=${names.join(",")}`\n  );\n  const { icons } = await response.json();\n  return icons;\n}\n```\n\n### Rendering Icons\n\n```tsx\nfunction Icon({ icon }: { icon: IconData }) {\n  return (\n    <svg\n      viewBox={icon.viewBox}\n      dangerouslySetInnerHTML={{ __html: icon.content }}\n      fill={icon.defaultFill ? "currentColor" : "none"}\n      stroke={icon.defaultStroke ? "currentColor" : "none"}\n      strokeWidth={icon.strokeWidth ?? 2}\n    />\n  );\n}\n```\n\n---\n\n## Error Responses\n\n```json\n{\n  "error": "Failed to fetch icons"\n}\n```\n\n| Status | Description |\n|--------|-------------|\n| 400 | Invalid request (missing query, invalid `limit` or `offset`, etc.) |\n| 429 | Rate limit exceeded. Wait for `Retry-After` seconds |\n| 500 | Server error |\n';

// src/codegen.ts
var ICON_FORMATS = ["react", "vue", "svelte", "svg", "json"];
var COMPONENT_FORMATS = /* @__PURE__ */ new Set(["react", "vue", "svelte"]);
var FILE_EXTENSIONS = {
  react: "tsx",
  vue: "vue",
  svelte: "svelte",
  svg: "svg",
  json: "json"
};
var DEFAULT_STROKE_WIDTH = 2;
var TITLE_PATTERN = /<title>[\s\S]*?<\/title>\s*/g;
var FILL_SOURCES = /* @__PURE__ */ new Set(["phosphor", "remix", "simple-icons"]);
function isIconFormat(value) {
  return typeof value === "string" && ICON_FORMATS.includes(value);
}
function getRenderMode(icon) {
  if (icon.defaultFill === void 0 && icon.defaultStroke === void 0) {
    return FILL_SOURCES.has(icon.sourceId) ? "fill" : "stroke";
  }
  return icon.defaultFill && !icon.defaultStroke ? "fill" : "stroke";
}
function toComponentName(name) {
  const pascal = name.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  if (!pascal) return "Icon";
  return /^[0-9]/.test(pascal) ? `Icon${pascal}` : pascal;
}
var VIEWBOX_PATTERN = /^-?\d+(\.\d+)?( -?\d+(\.\d+)?){3}$/;
var UNSAFE_CONTENT = [
  { pattern: /[{}]/, reason: "braces, which JSX, Vue, and Svelte evaluate as code" },
  { pattern: /<\s*(script|foreignObject|iframe|style)\b/i, reason: "a script, style, or foreign element" },
  { pattern: /\son[a-z]+\s*=/i, reason: "an event handler attribute" },
  { pattern: /(javascript|data):/i, reason: "a javascript: or data: URL" }
];
function assertSafeIcon(icon) {
  if (!VIEWBOX_PATTERN.test(icon.viewBox.trim())) {
    throw new Error(`Refusing to generate ${icon.id}: invalid viewBox "${icon.viewBox}"`);
  }
  for (const { pattern, reason } of UNSAFE_CONTENT) {
    if (pattern.test(icon.content)) throw new Error(`Refusing to generate ${icon.id}: its SVG contains ${reason}`);
  }
}
function toSafeFileName(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "icon";
}
function getBody(icon) {
  return icon.content.replace(TITLE_PATTERN, "").trim();
}
var HYPHENATED_ATTRIBUTE = /(\s)([a-z]+(?:-[a-z]+)+)=/g;
function toJsxBody(body) {
  return body.replace(HYPHENATED_ATTRIBUTE, (match, space, attribute) => {
    if (attribute.startsWith("data-") || attribute.startsWith("aria-")) return match;
    return `${space}${attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}=`;
  });
}
function getStrokeWidth(icon) {
  return parseFloat(icon.strokeWidth ?? "") || DEFAULT_STROKE_WIDTH;
}
function getSvgAttributes(icon) {
  if (getRenderMode(icon) === "fill") return 'fill="currentColor"';
  return `fill="none" stroke="currentColor" stroke-width="${getStrokeWidth(icon)}" stroke-linecap="round" stroke-linejoin="round"`;
}
function getJsxAttributes(icon) {
  if (getRenderMode(icon) === "fill") return 'fill="currentColor"';
  return `fill="none" stroke="currentColor" strokeWidth={${getStrokeWidth(icon)}} strokeLinecap="round" strokeLinejoin="round"`;
}
function indent(text2, spaces) {
  const pad = " ".repeat(spaces);
  return text2.split("\n").map((line) => line ? pad + line : line).join("\n");
}
function reactComponent(icon, componentName) {
  return `export function ${componentName}({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${icon.viewBox}"
      ${getJsxAttributes(icon)}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
${indent(toJsxBody(getBody(icon)), 6)}
    </svg>
  );
}`;
}
function svgElement(icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${getSvgAttributes(icon)} aria-hidden="true" focusable="false">
${indent(getBody(icon), 2)}
</svg>`;
}
function jsonIcon(icon) {
  return {
    id: icon.id,
    name: icon.normalizedName,
    source: icon.sourceId,
    viewBox: icon.viewBox,
    content: getBody(icon),
    renderMode: getRenderMode(icon),
    ...getRenderMode(icon) === "stroke" ? { strokeWidth: getStrokeWidth(icon) } : {},
    tags: icon.tags ?? [],
    category: icon.category ?? null
  };
}
function generateIconFile(icon, format, componentName = toComponentName(icon.normalizedName)) {
  assertSafeIcon(icon);
  const header = `Generated by @webrenew/unicon from ${icon.id} - https://unicon.sh`;
  switch (format) {
    case "svg":
      return `${svgElement(icon)}
`;
    case "json":
      return `${JSON.stringify(jsonIcon(icon), null, 2)}
`;
    case "vue":
      return `<!-- ${header} -->
<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${icon.viewBox}"
    ${getSvgAttributes(icon)}
    aria-hidden="true"
    focusable="false"
  >
${indent(getBody(icon), 4)}
  </svg>
</template>
`;
    case "svelte":
      return `<!-- ${header} -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${icon.viewBox}"
  ${getSvgAttributes(icon)}
  aria-hidden="true"
  focusable="false"
  {...$$restProps}
>
${indent(getBody(icon), 2)}
</svg>
`;
    case "react":
      return `// ${header}
import type { SVGProps } from "react";

${reactComponent(icon, componentName)}
`;
  }
}
function assignNames(icons) {
  const used = /* @__PURE__ */ new Set();
  return icons.map((icon) => {
    const base = toSafeFileName(icon.normalizedName);
    const withSource = `${base}-${toSafeFileName(icon.sourceId)}`;
    let fileName = used.has(base) ? withSource : base;
    for (let n = 2; used.has(fileName); n++) fileName = `${withSource}-${n}`;
    used.add(fileName);
    return { icon, fileName, componentName: toComponentName(fileName) };
  });
}
function generateSplitFiles(icons, format) {
  const ext = FILE_EXTENSIONS[format];
  const named = assignNames(icons);
  const files = named.map(({ icon, fileName, componentName }) => ({
    path: `${fileName}.${ext}`,
    content: generateIconFile(icon, format, componentName)
  }));
  if (!COMPONENT_FORMATS.has(format)) return files;
  const exports = named.map(
    ({ fileName, componentName }) => format === "react" ? `export { ${componentName} } from "./${fileName}";` : `export { default as ${componentName} } from "./${fileName}.${ext}";`
  );
  files.push({
    path: "index.ts",
    content: `// Generated by @webrenew/unicon. Re-exports each icon so bundlers can tree-shake.
${exports.join("\n")}
`
  });
  return files;
}
function generateSingleFile(icons, format) {
  icons.forEach(assertSafeIcon);
  const named = assignNames(icons);
  switch (format) {
    case "react":
      return `/**
 * Icon components generated by @webrenew/unicon
 * @see https://unicon.sh
 */
import type { SVGProps } from "react";

${named.map(({ icon, componentName }) => `// ${icon.id}
${reactComponent(icon, componentName)}`).join("\n\n")}
`;
    case "json":
      return `${JSON.stringify(named.map(({ icon }) => jsonIcon(icon)), null, 2)}
`;
    case "svg": {
      const symbols = named.map(
        ({ icon, fileName }) => `  <symbol id="${fileName}" viewBox="${icon.viewBox}" ${getSvgAttributes(icon)}>
${indent(getBody(icon), 4)}
  </symbol>`
      );
      return `<!-- Generated by @webrenew/unicon - https://unicon.sh. Use: <svg><use href="icons.svg#${named[0]?.fileName ?? "name"}" /></svg> -->
<svg xmlns="http://www.w3.org/2000/svg" style="display: none">
${symbols.join("\n")}
</svg>
`;
    }
    case "vue":
    case "svelte":
      throw new Error(`${format} needs one component per file. Use a directory as the output.`);
  }
}
function parseIconRef(ref, defaultSource) {
  const trimmed = ref.trim();
  const colon = trimmed.indexOf(":");
  if (colon === -1) return { source: defaultSource, name: trimmed.toLowerCase() };
  return { source: trimmed.slice(0, colon).toLowerCase(), name: trimmed.slice(colon + 1).toLowerCase() };
}
function matchIconRefs(refs, candidates, defaultSource) {
  const icons = [];
  const missing = [];
  for (const ref of refs) {
    const { source, name } = parseIconRef(ref, defaultSource);
    const matches = candidates.filter((icon2) => icon2.normalizedName.toLowerCase() === name && (!source || icon2.sourceId === source));
    const icon = matches.find((match) => match.sourceId === "lucide") ?? matches[0];
    if (icon) icons.push(icon);
    else missing.push(ref);
  }
  return { icons, missing };
}
function isDirectoryPath(path) {
  if (/[\\/]$/.test(path)) return true;
  const last = path.split(/[\\/]/).pop() ?? "";
  return !/\.[a-zA-Z0-9]+$/.test(last);
}
function mergeIndexFile(existing, generated) {
  const lines = existing.replace(/\n+$/, "").split("\n");
  const present = new Set(lines.map((line) => line.trim()));
  const added = generated.split("\n").filter((line) => line.startsWith("export ") && !present.has(line.trim()));
  return `${[...lines, ...added].join("\n")}
`;
}

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
        name: "common",
        icons: ["home", "settings", "user", "search", "menu", "x", "check"],
        source: "lucide",
        format: "react",
        output: "./src/icons/common"
      },
      {
        name: "navigation",
        query: "arrow chevron menu",
        source: "lucide",
        limit: 30,
        format: "react",
        output: "./src/icons/navigation"
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
async function fetchIconsByRefs(refs, defaultSource, options = { useCache: true }) {
  const names = [...new Set(refs.map((ref) => ref.slice(ref.indexOf(":") + 1).trim().toLowerCase()).filter(Boolean))];
  if (names.length === 0) return { icons: [], missing: [...refs] };
  const cacheKey = getCacheKey({ type: "names", names: names.join(",") });
  let candidates = options.useCache ? getFromCache(cacheKey) : null;
  if (!candidates) {
    const url = new URL(`${API_BASE}/api/icons`);
    url.searchParams.set("names", names.join(","));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    candidates = (await res.json()).icons;
    if (options.useCache) setCache(cacheKey, candidates);
  }
  const { icons, missing } = matchIconRefs(refs, candidates, defaultSource);
  return { icons, missing };
}
function writeGeneratedFiles(directory, files) {
  const fullDir = resolve(process.cwd(), directory);
  mkdirSync(fullDir, { recursive: true });
  for (const file of files) {
    const target = resolve(fullDir, file.path);
    if (!target.startsWith(fullDir + sep)) throw new Error(`Refusing to write outside ${directory}: ${file.path}`);
    const content = file.path === "index.ts" && existsSync(target) ? mergeIndexFile(readFileSync(target, "utf-8"), file.content) : file.content;
    writeFileSync(target, content, "utf-8");
  }
}
function writeIconSet(icons, format, output, options = {}) {
  if (isDirectoryPath(output)) {
    const files = generateSplitFiles(icons, format);
    if (!options.dryRun) writeGeneratedFiles(output, files);
    return `${output.replace(/[\\/]+$/, "")}/ (${files.length} files)`;
  }
  if (COMPONENT_FORMATS.has(format) && format !== "react") {
    const suggestion = output.replace(/\.[a-zA-Z0-9]+$/, "");
    throw new Error(`${format} needs one component per file, so the output must be a directory. Use "${suggestion}" instead of "${output}".`);
  }
  if (!options.dryRun) {
    const fullPath = resolve(process.cwd(), output);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, generateSingleFile(icons, format), "utf-8");
  }
  return output;
}
function parseFormat(value) {
  if (value === void 0) return void 0;
  if (isIconFormat(value)) return value;
  console.error(chalk.red(`Unknown format "${String(value)}". Use react, vue, svelte, svg, or json.`));
  process.exit(1);
}
function parseIconList(value) {
  return value.split(/[\s,]+/).map((ref) => ref.trim()).filter(Boolean);
}
async function syncBundle(bundle, options = {}) {
  if (!bundle.icons?.length && !bundle.query && !bundle.category && !bundle.source) {
    return { skipped: "no icons, query, category, or source specified" };
  }
  let format;
  if (bundle.format === void 0) {
    format = getFormatForFramework(detectFramework().framework);
  } else if (isIconFormat(bundle.format)) {
    format = bundle.format;
  } else {
    throw new Error(`unknown format "${String(bundle.format)}"`);
  }
  let icons = [];
  let missing = [];
  if (bundle.icons?.length) {
    ({ icons, missing } = await fetchIconsByRefs(bundle.icons, bundle.source, { useCache: options.useCache ?? true }));
  }
  if (bundle.query || bundle.category || !bundle.icons?.length && bundle.source) {
    const { icons: found } = await fetchIcons(
      { query: bundle.query, category: bundle.category, source: bundle.source, limit: bundle.limit || 100 },
      { useCache: options.useCache ?? true }
    );
    const seen = new Set(icons.map((icon) => icon.id));
    icons.push(...found.filter((icon) => !seen.has(icon.id)));
  }
  if (icons.length === 0) return { skipped: missing.length ? `not found: ${missing.join(", ")}` : "no icons found" };
  const written = writeIconSet(icons, format, bundle.output, { dryRun: options.dryRun ?? false });
  return { count: icons.length, written, missing };
}
var ICON_SOURCES = [
  ["lucide", "Lucide (stroke)"],
  ["phosphor", "Phosphor (fill)"],
  ["hugeicons", "Hugeicons (stroke)"],
  ["heroicons", "Heroicons (outline and solid)"],
  ["tabler", "Tabler (stroke)"],
  ["feather", "Feather (stroke)"],
  ["remix", "Remix Icon (fill)"],
  ["iconoir", "Iconoir (stroke and solid)"],
  ["simple-icons", "Simple Icons (brand logos, fill)"]
];
var program = new Command();
program.name("unicon").description("CLI for searching and bundling icons from Unicon").version(CLI_VERSION).hook("preAction", (thisCommand) => {
  if (thisCommand.args.length === 0 || process.argv.includes("--help") || process.argv.includes("-h")) {
    return;
  }
}).addHelpText("beforeAll", () => {
  showBanner();
  return "";
});
program.command("search <query>").description("Search for icons by name or keyword").option("-s, --source <source>", "Filter by source (lucide, phosphor, simple-icons, ...; see `unicon sources`)").option("-c, --category <category>", "Filter by category").option("-l, --limit <number>", "Maximum number of results", "20").option("-j, --json", "Output as JSON").option("-p, --pick", "Interactively select icons from results").action(async (query, options) => {
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
          const content = generateSingleFile(selectedIcons, "react");
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
          writeGeneratedFiles(outDir, generateSplitFiles(selectedIcons, getFormatForFramework(detectFramework().framework)));
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
          const newBundle = {
            name: bundleName,
            icons: selectedIcons.map((i) => i.id),
            format,
            output: `./src/icons/${bundleName}`
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
program.command("info <name>").description("Show detailed information about an icon").option("-s, --source <source>", "Prefer source (lucide, phosphor, simple-icons, ...; see `unicon sources`)").action(async (name, options) => {
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
program.command("get <name>").description("Get one icon by exact name (outputs to stdout)").option("-s, --source <source>", "Library to take the icon from (lucide, phosphor, simple-icons, ...)").option("-f, --format <format>", "Output format: react, vue, svelte, svg, json").option("-o, --output <path>", "Write to file instead of stdout").option("-c, --copy", "Copy to clipboard instead of stdout").action(async (name, options) => {
  try {
    const { icons } = await fetchIconsByRefs([name], options.source);
    const icon = icons[0];
    if (!icon) {
      const where = options.source ? ` in ${options.source}` : "";
      console.error(chalk.red(`No icon is named "${name}"${where}.`));
      const { icons: similar } = await fetchIcons({ query: name.replace(/^[^:]*:/, ""), source: options.source, limit: 5 }).catch(() => ({ icons: [] }));
      if (similar.length > 0) {
        console.error(chalk.dim(`Similar: ${similar.map((i) => `${i.sourceId}:${i.normalizedName}`).join(", ")}`));
      }
      console.error(chalk.dim(`Search with: unicon search "${name}"${options.source ? ` --source ${options.source}` : ""}`));
      process.exit(1);
    }
    let format = parseFormat(options.format);
    if (!format) {
      const { framework, reason } = detectFramework();
      format = getFormatForFramework(framework);
      if (framework && (options.copy || options.output)) {
        console.error(chalk.dim(`Auto-detected: ${reason} \u2192 ${format}`));
      }
    }
    const componentName = toComponentName(icon.normalizedName);
    const content = generateIconFile(icon, format, componentName);
    if (options.copy) {
      const success = await copyToClipboard(content);
      if (success) {
        console.log(chalk.green(`\u2713 ${componentName} copied to clipboard (${format})`));
      } else {
        console.error(chalk.red("Failed to copy to clipboard"));
        process.exit(1);
      }
    } else if (options.output) {
      const output = isDirectoryPath(options.output) ? join(options.output, `${toSafeFileName(icon.normalizedName)}.${FILE_EXTENSIONS[format]}`) : options.output;
      const fullPath = resolve(process.cwd(), output);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      console.error(chalk.green(`\u2713 ${icon.id} \u2192 ${output}`));
    } else {
      console.log(content);
    }
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    process.exit(1);
  }
});
program.command("bundle").description("Write a set of icons: one file per icon in a directory, or one file").option("-q, --query <query>", "Search query").option("-i, --icons <icons>", "Exact icons, comma-separated: home,lucide:settings").option("-c, --category <category>", "Filter by category").option("-s, --source <source>", "Filter by source (lucide, phosphor, simple-icons, ...)").option("-f, --format <format>", "Output format: react, vue, svelte, svg, json").option("-o, --output <path>", "Output directory (one file per icon) or file (one file)", "./icons").option("-l, --limit <number>", "Maximum number of icons from a search", "100").option("--single-file", "Combine all icons into one file in the output directory (react, svg, json)").option("--stars", "Bundle all favorited icons").action(async (options) => {
  let refs = options.icons ? parseIconList(options.icons) : void 0;
  if (options.stars) {
    const favorites = loadFavorites();
    if (favorites.favorites.length === 0) {
      console.log(chalk.yellow("No favorited icons. Use 'unicon star <name>' to add favorites."));
      process.exit(1);
    }
    refs = favorites.favorites.map((f) => `${f.sourceId}:${f.name}`);
  }
  if (!refs && !options.query && !options.category && !options.source) {
    console.log(chalk.yellow("Please provide at least one of: --icons, --query, --category, --source, or --stars"));
    process.exit(1);
  }
  let format = parseFormat(options.format);
  if (!format) {
    const { framework, reason } = detectFramework();
    format = getFormatForFramework(framework);
    if (framework) console.log(chalk.dim(`Auto-detected: ${reason} \u2192 ${format}`));
  }
  let output = options.output;
  if (options.singleFile) {
    if (COMPONENT_FORMATS.has(format) && format !== "react") {
      console.log(chalk.red(`Error: --single-file is not supported for ${format}. Vue and Svelte need one component per file.`));
      process.exit(1);
    }
    if (isDirectoryPath(output)) output = join(output, `icons.${FILE_EXTENSIONS[format]}`);
  }
  const spinner = ora("Fetching icons...").start();
  try {
    let icons;
    if (refs) {
      const result = await fetchIconsByRefs(refs, options.source);
      icons = result.icons;
      if (result.missing.length > 0) {
        spinner.warn(chalk.yellow(`Not found: ${result.missing.join(", ")}. Check names with unicon search.`));
        spinner.start("Writing icons...");
      }
    } else {
      ({ icons } = await fetchIcons({
        query: options.query,
        category: options.category,
        source: options.source,
        limit: parseInt(options.limit, 10)
      }));
    }
    if (icons.length === 0) {
      spinner.fail("No icons found matching your criteria");
      process.exit(1);
    }
    const written = writeIconSet(icons, format, output);
    spinner.succeed(`${chalk.green(icons.length)} icons \u2192 ${chalk.cyan(written)}`);
    const sources = [...new Set(icons.map((i) => i.sourceId))];
    console.log(chalk.dim(`  Sources: ${sources.join(", ")}  Format: ${format}`));
    if (isDirectoryPath(output) && COMPONENT_FORMATS.has(format)) {
      const importPath = output.replace(/[\\/]+$/, "");
      console.log(chalk.dim(`  Import: import { ${toComponentName(icons[0]?.normalizedName ?? "icon")} } from "${/^\.{0,2}\//.test(importPath) ? importPath : `./${importPath}`}";`));
    } else if (format === "react" && icons.length > 10) {
      console.log(chalk.yellow(`  \u26A0 One file with ${icons.length} components is not tree-shakeable. Use a directory output instead.`));
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
program.command("sources").description("List available icon sources/libraries").option("-j, --json", "Output as JSON").action((options) => {
  if (options.json) {
    console.log(JSON.stringify(ICON_SOURCES.map(([id, description]) => ({ id, description })), null, 2));
    return;
  }
  console.log(chalk.bold("Available icon sources:\n"));
  for (const [id, label] of ICON_SOURCES) {
    console.log(`  ${chalk.green("\u2022")} ${chalk.yellow(id.padEnd(13))} ${label}`);
  }
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
      options: ICON_SOURCES.map(([value, hint]) => ({ value, label: value, hint })),
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
    const selectedLibraries = libraries;
    const outputFor = (name) => isIconFormat(selectedFormat) && COMPONENT_FORMATS.has(selectedFormat) ? `${outputDir}/${name}` : `${outputDir}/${name}.${isIconFormat(selectedFormat) ? FILE_EXTENSIONS[selectedFormat] : "tsx"}`;
    const bundles = [];
    if (createStarter) {
      bundles.push({
        name: "common",
        icons: ["home", "settings", "user", "search", "menu", "x", "check", "arrow-right", "arrow-left"],
        ...selectedLibraries[0] ? { source: selectedLibraries[0] } : {},
        format: selectedFormat,
        output: outputFor("common")
      });
    }
    if (selectedLibraries.length > 0) {
      for (const lib of selectedLibraries) {
        bundles.push({
          name: lib,
          source: lib,
          format: selectedFormat,
          limit: 50,
          output: outputFor(lib)
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
        const result = await syncBundle(bundle, { useCache: !options.watch, dryRun: options.dryRun });
        if ("skipped" in result) {
          spinner.warn(`${bundle.name}: Skipped (${result.skipped})`);
          if (bundle.icons?.length) errorCount2++;
          continue;
        }
        const verb = options.dryRun ? "would write" : "\u2192";
        spinner.succeed(`${bundle.name}: ${chalk.green(result.count)} icons ${verb} ${chalk.cyan(result.written)}`);
        if (result.missing.length > 0) {
          console.log(chalk.red(`  Not found: ${result.missing.join(", ")}. Check the names with unicon search.`));
          errorCount2++;
          continue;
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
    process.exitCode = 1;
  }
});
program.command("add <name>").description("Add a new bundle to .uniconrc.json").option("-i, --icons <icons>", "Exact icons, comma-separated: home,lucide:settings").option("-q, --query <query>", "Search query").option("-c, --category <category>", "Filter by category").option("-s, --source <source>", "Filter by source").option("-f, --format <format>", "Output format: react, vue, svelte, svg, json").option("-l, --limit <number>", "Maximum icons from a search", "50").option("-o, --output <path>", "Output directory or file").action((name, options) => {
  let config = loadConfig();
  if (!config) {
    console.log(chalk.yellow(`No ${CONFIG_FILE} found. Creating one...`));
    config = { bundles: [] };
  }
  if (config.bundles.some((b) => b.name === name)) {
    console.log(chalk.yellow(`Bundle "${name}" already exists in config.`));
    process.exit(1);
  }
  if (!options.icons && !options.query && !options.category && !options.source) {
    console.log(chalk.yellow("Please provide at least one of: --icons, --query, --category, or --source"));
    process.exit(1);
  }
  const format = parseFormat(options.format) ?? getFormatForFramework(detectFramework().framework);
  const defaultOutput = COMPONENT_FORMATS.has(format) ? `./src/icons/${name}` : `./src/icons/${name}.${FILE_EXTENSIONS[format]}`;
  const newBundle = {
    name,
    output: options.output || defaultOutput,
    format
  };
  if (options.icons) newBundle.icons = parseIconList(options.icons);
  if (options.query || options.category || !options.icons) newBundle.limit = parseInt(options.limit, 10);
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
program.command("preview <name>").description("Show ASCII art preview of an icon in the terminal").option("-s, --source <source>", "Prefer source (lucide, phosphor, simple-icons, ...; see `unicon sources`)").option("-w, --width <number>", "Preview width", "20").option("-h, --height <number>", "Preview height", "20").action(async (name, options) => {
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
function printSkillFileTree(indent2) {
  UNICON_SKILL_FILES.forEach((file, index) => {
    const branch = index === UNICON_SKILL_FILES.length - 1 ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
    console.log(chalk.dim(`${indent2}${branch} ${file.path}`));
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
  const skills = Array.isArray(data) ? data : data.skills;
  if (!Array.isArray(skills)) throw new Error("Unexpected skills registry format");
  return skills;
}
async function fetchSkillContent(skill) {
  const path = skill.publicPath ?? (skill.file ? `/skills/${skill.file}` : `/skills/${skill.id}.md`);
  const res = await fetch(`${API_BASE}${path}`);
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
      const content = await fetchSkillContent(skill);
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
program.command("star <name>").description("Add an icon to favorites").option("-s, --source <source>", "Prefer source (lucide, phosphor, simple-icons, ...; see `unicon sources`)").action(async (name, options) => {
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
program.command("bundle:add <bundle> <icons...>").description("Add exact icons (name or source:name) to a bundle in .uniconrc.json").option("--sync", "Sync the bundle afterwards without asking").action(async (bundleName, iconNames, options) => {
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
  const refs = iconNames.flatMap(parseIconList);
  bundle.icons = [.../* @__PURE__ */ new Set([...bundle.icons ?? [], ...refs])];
  const configPath = resolve(process.cwd(), CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(chalk.green(`\u2713 Added ${iconNames.length} icon(s) to bundle "${bundleName}"`));
  console.log(chalk.dim(`  Icons: ${bundle.icons.join(", ")}`));
  console.log();
  const shouldSync = options.sync || (process.stdin.isTTY ? await confirm2("Sync bundle now?") : false);
  if (!shouldSync) {
    console.log(chalk.dim(`Run ${chalk.white(`unicon sync --name ${bundleName}`)} to generate.`));
    return;
  }
  const spinner = ora(`${bundleName}: Fetching icons...`).start();
  try {
    const result = await syncBundle(bundle);
    if ("skipped" in result) {
      spinner.warn(`${bundleName}: Skipped (${result.skipped})`);
      return;
    }
    spinner.succeed(`${bundleName}: ${chalk.green(result.count)} icons \u2192 ${chalk.cyan(result.written)}`);
    if (result.missing.length > 0) console.log(chalk.yellow(`  Not found: ${result.missing.join(", ")}`));
  } catch (error) {
    spinner.fail(`${bundleName}: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
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
        const content = generateSingleFile(selectedIcons, "react");
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
        writeGeneratedFiles(outDir, generateSplitFiles(selectedIcons, getFormatForFramework(detectFramework().framework)));
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
