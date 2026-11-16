// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { skillEntries } from "./skills";
import { findStaleRegistryFiles, planSkillRegistry } from "./skills-registry";

const ROOT_DIR = resolve(__dirname, "../..");
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n/;
const MARKDOWN_LINK_PATTERN = /\]\(([^)#\s]+)(?:#[^)]*)?\)/g;

function readFrontmatterField(markdown: string, field: string): string | undefined {
  const frontmatter = FRONTMATTER_PATTERN.exec(markdown)?.[1] ?? "";
  return new RegExp(`^${field}: (.+)$`, "m").exec(frontmatter)?.[1]?.trim();
}

describe("skills registry", () => {
  it("should keep public/skills in sync with skills/ (run `pnpm skills:sync`)", () => {
    expect(findStaleRegistryFiles(ROOT_DIR)).toEqual([]);
  });

  it("should reject two skills that publish the same reference path", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "unicon-skills-"));
    try {
      for (const id of ["a", "b"]) {
        mkdirSync(join(rootDir, "skills", id, "references"), { recursive: true });
        writeFileSync(join(rootDir, "skills", id, "SKILL.md"), `---\nname: ${id}\n---\n`);
        writeFileSync(join(rootDir, "skills", id, "references", "guide.md"), "# Guide\n");
      }
      const entries = ["a", "b"].map((id) => ({ ...skillEntries[0]!, id, publicPath: `/skills/${id}.md` }));

      expect(() => planSkillRegistry(rootDir, entries)).toThrow(/both publish references\/guide\.md/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  describe.each(skillEntries.map((entry) => entry.id))("skill %s", (id) => {
    const skillFile = join(ROOT_DIR, "skills", id, "SKILL.md");
    const markdown = readFileSync(skillFile, "utf8");

    it("should have Agent Skills frontmatter whose name matches its directory", () => {
      const name = readFrontmatterField(markdown, "name");
      expect(name).toBe(id);
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(name!.length).toBeLessThanOrEqual(64);
    });

    it("should have a description within the 1024-character limit", () => {
      const description = readFrontmatterField(markdown, "description") ?? "";
      expect(description.length).toBeGreaterThan(50);
      expect(description.length).toBeLessThanOrEqual(1024);
    });

    it("should keep SKILL.md under 500 lines", () => {
      expect(markdown.split("\n").length).toBeLessThan(500);
    });

    it("should only link to files that exist", () => {
      const skillDocs = [skillFile, ...planSkillRegistry(ROOT_DIR)
        .filter((file) => file.path.startsWith("references/"))
        .map((file) => join(ROOT_DIR, "skills", id, file.path))
        .filter((file) => existsSync(file))];

      for (const doc of skillDocs) {
        for (const [, target] of readFileSync(doc, "utf8").matchAll(MARKDOWN_LINK_PATTERN)) {
          if (!target || /^[a-z]+:/i.test(target)) continue;
          expect(existsSync(resolve(dirname(doc), target)), `${doc} links to ${target}`).toBe(true);
        }
      }
    });
  });
});
