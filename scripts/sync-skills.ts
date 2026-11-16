/**
 * Regenerate public/skills/ (the registry served at https://unicon.sh/skills)
 * from the skill sources in skills/.
 *
 * Usage:
 *   pnpm skills:sync           # write public/skills/
 *   pnpm skills:sync --check   # exit 1 if public/skills/ is out of date
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findStaleRegistryFiles, planSkillRegistry } from "../src/lib/skills-registry";

const rootDir = resolve(__dirname, "..");
const publicDir = join(rootDir, "public", "skills");

function main(): void {
  const stale = findStaleRegistryFiles(rootDir);

  if (process.argv.includes("--check")) {
    if (stale.length === 0) {
      console.log("public/skills is up to date.");
      return;
    }
    console.error(`public/skills is out of date: ${stale.join(", ")}\nRun: pnpm skills:sync`);
    process.exit(1);
  }

  const planned = planSkillRegistry(rootDir);
  const plannedPaths = new Set(planned.map((file) => file.path));
  for (const path of stale) {
    if (!plannedPaths.has(path)) rmSync(join(publicDir, path));
  }
  for (const file of planned) {
    const target = join(publicDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, "utf8");
  }
  console.log(stale.length === 0 ? "public/skills is up to date." : `Updated public/skills: ${stale.join(", ")}`);
}

main();
