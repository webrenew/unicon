/**
 * Builds the public skills registry (`public/skills/`) from the skill sources
 * in `skills/<id>/`. The sources are the only files to edit; run
 * `pnpm skills:sync` to regenerate the registry. A test fails when the
 * registry is out of date.
 *
 * Layout served at https://unicon.sh/skills/:
 * - `index.json`: the entries from `skillEntries`
 * - `<id>.md`: each skill's `SKILL.md`
 * - `references/<file>.md`: reference files, so the relative links in a
 *   skill (`references/x.md`) resolve next to `/skills/<id>.md`
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { skillEntries, type SkillEntry } from "./skills";

export interface RegistryFile {
  /** Path relative to `public/skills/`. */
  path: string;
  content: string;
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

/**
 * Compute every file the public registry should contain.
 *
 * @param rootDir - Repository root
 * @param entries - Registry entries; defaults to `skillEntries`
 * @throws When a skill source is missing or two skills publish the same reference path
 */
export function planSkillRegistry(
  rootDir: string,
  entries: readonly SkillEntry[] = skillEntries
): RegistryFile[] {
  const files: RegistryFile[] = [];
  const owners = new Map<string, string>();

  for (const entry of entries) {
    const skillDir = join(rootDir, "skills", entry.id);
    const skillFile = join(skillDir, "SKILL.md");
    if (!existsSync(skillFile)) throw new Error(`Missing skill source: ${relative(rootDir, skillFile)}`);

    files.push({ path: `${entry.id}.md`, content: readFileSync(skillFile, "utf8") });

    for (const referenceFile of listFiles(join(skillDir, "references"))) {
      const path = relative(skillDir, referenceFile).split("\\").join("/");
      const owner = owners.get(path);
      if (owner) throw new Error(`Skills "${owner}" and "${entry.id}" both publish ${path}`);
      owners.set(path, entry.id);
      files.push({ path, content: readFileSync(referenceFile, "utf8") });
    }
  }

  files.push({ path: "index.json", content: `${JSON.stringify(entries, null, 2)}\n` });
  return files;
}

/**
 * List registry files that are missing, different, or no longer produced.
 *
 * @param rootDir - Repository root
 * @returns Paths relative to `public/skills/`; empty when the registry is current
 */
export function findStaleRegistryFiles(rootDir: string): string[] {
  const publicDir = join(rootDir, "public", "skills");
  const planned = planSkillRegistry(rootDir);
  const plannedPaths = new Set(planned.map((file) => file.path));

  const stale = planned
    .filter((file) => {
      const target = join(publicDir, file.path);
      return !existsSync(target) || readFileSync(target, "utf8") !== file.content;
    })
    .map((file) => file.path);

  const existing = [...listFiles(publicDir), join(publicDir, "index.json")]
    .filter((file) => existsSync(file))
    .map((file) => relative(publicDir, file).split("\\").join("/"));
  for (const path of existing) {
    if (!plannedPaths.has(path)) stale.push(path);
  }
  return stale;
}
