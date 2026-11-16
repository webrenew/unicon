// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  assertSafeIcon,
  assignNames,
  generateIconFile,
  generateSingleFile,
  generateSplitFiles,
  getRenderMode,
  isDirectoryPath,
  matchIconRefs,
  mergeIndexFile,
  toComponentName,
  toJsxBody,
  toSafeFileName,
  type CodegenIcon,
} from "./codegen";

const lucideHome: CodegenIcon = {
  id: "lucide:home",
  normalizedName: "home",
  sourceId: "lucide",
  viewBox: "0 0 24 24",
  content: '<path d="M3 9l9-7 9 7v11H3z" stroke-linecap="round"/>',
  strokeWidth: "2",
  defaultStroke: true,
  defaultFill: false,
};
const tablerHome: CodegenIcon = { ...lucideHome, id: "tabler:home", sourceId: "tabler" };
const githubLogo: CodegenIcon = {
  id: "simple-icons:github",
  normalizedName: "github",
  sourceId: "simple-icons",
  viewBox: "0 0 24 24",
  content: '<title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12" fill-rule="evenodd"/>',
  strokeWidth: null,
  defaultStroke: false,
  defaultFill: true,
};
const fiveHundredPx: CodegenIcon = { ...githubLogo, id: "simple-icons:500px", normalizedName: "500px" };

describe("getRenderMode", () => {
  it("should use fill for icons flagged as fill-only, such as brand logos", () => {
    expect(getRenderMode(githubLogo)).toBe("fill");
  });

  it("should use stroke for stroke icons", () => {
    expect(getRenderMode(lucideHome)).toBe("stroke");
  });

  it("should fall back to the library when the flags are missing", () => {
    expect(getRenderMode({ sourceId: "simple-icons" })).toBe("fill");
    expect(getRenderMode({ sourceId: "lucide" })).toBe("stroke");
  });
});

describe("toComponentName", () => {
  it("should convert kebab-case to PascalCase", () => {
    expect(toComponentName("log-out")).toBe("LogOut");
  });

  it("should prefix names that start with a digit so they are valid identifiers", () => {
    expect(toComponentName("500px")).toBe("Icon500px");
  });
});

describe("toJsxBody", () => {
  it("should camelCase hyphenated SVG attributes but keep data and aria attributes", () => {
    expect(toJsxBody('<path fill-rule="evenodd" data-x="1" aria-label="a" stroke-linecap="round"/>')).toBe(
      '<path fillRule="evenodd" data-x="1" aria-label="a" strokeLinecap="round"/>'
    );
  });
});

describe("generateIconFile", () => {
  it("should render brand logos with fill, not stroke", () => {
    const code = generateIconFile(githubLogo, "react");
    expect(code).toContain('fill="currentColor"');
    expect(code).not.toContain('stroke="currentColor"');
  });

  it("should drop <title> because the svg is aria-hidden", () => {
    expect(generateIconFile(githubLogo, "svg")).not.toContain("<title>");
  });

  it("should write JSX attribute names in React output", () => {
    const code = generateIconFile(githubLogo, "react");
    expect(code).toContain("fillRule=");
    expect(code).not.toContain("fill-rule=");
  });

  it("should write a Vue single-file component with a template", () => {
    const code = generateIconFile(lucideHome, "vue");
    expect(code).toContain("<template>");
    expect(code).toContain('stroke-width="2"');
    expect(code).not.toContain("SVGProps");
  });

  it("should write a Svelte component that forwards attributes", () => {
    const code = generateIconFile(lucideHome, "svelte");
    expect(code).toContain("{...$$restProps}");
    expect(code).not.toContain("SVGProps");
  });

  it("should use a valid component name for names that start with a digit", () => {
    expect(generateIconFile(fiveHundredPx, "react")).toContain("export function Icon500px(");
  });
});

describe("assignNames", () => {
  it("should give icons with the same name from different libraries unique names", () => {
    const names = assignNames([lucideHome, tablerHome]);
    expect(names.map((entry) => entry.fileName)).toEqual(["home", "home-tabler"]);
    expect(names.map((entry) => entry.componentName)).toEqual(["Home", "HomeTabler"]);
  });
});

describe("generateSplitFiles", () => {
  it("should write one Vue file per icon and an index that re-exports them", () => {
    const files = generateSplitFiles([lucideHome, githubLogo], "vue");
    expect(files.map((file) => file.path)).toEqual(["home.vue", "github.vue", "index.ts"]);
    expect(files[2]?.content).toContain('export { default as Home } from "./home.vue";');
  });

  it("should write individual svg files without an index", () => {
    const files = generateSplitFiles([lucideHome, githubLogo], "svg");
    expect(files.map((file) => file.path)).toEqual(["home.svg", "github.svg"]);
    for (const file of files) expect(file.content.match(/<svg /g)).toHaveLength(1);
  });

  it("should not repeat an export when two libraries share a name", () => {
    const index = generateSplitFiles([lucideHome, tablerHome], "react").find((file) => file.path === "index.ts");
    expect(index?.content).toContain('export { Home } from "./home";');
    expect(index?.content).toContain('export { HomeTabler } from "./home-tabler";');
  });
});

describe("generateSingleFile", () => {
  it("should write an svg sprite with one root element and a symbol per icon", () => {
    const sprite = generateSingleFile([lucideHome, githubLogo], "svg");
    expect(sprite.match(/<svg /g)).toHaveLength(1);
    expect(sprite).toContain('<symbol id="home"');
    expect(sprite).toContain('<symbol id="github"');
  });

  it("should write valid JSON", () => {
    const parsed = JSON.parse(generateSingleFile([lucideHome, githubLogo], "json")) as { id: string; renderMode: string }[];
    expect(parsed.map((icon) => [icon.id, icon.renderMode])).toEqual([
      ["lucide:home", "stroke"],
      ["simple-icons:github", "fill"],
    ]);
  });

  it("should reject vue and svelte, which need one file per component", () => {
    expect(() => generateSingleFile([lucideHome], "vue")).toThrow(/one component per file/);
  });
});

describe("matchIconRefs", () => {
  it("should match exact names in the requested library and report the rest", () => {
    const { icons, missing } = matchIconRefs(["tabler:home", "github", "settings"], [lucideHome, tablerHome, githubLogo]);
    expect(icons.map((icon) => icon.id)).toEqual(["tabler:home", "simple-icons:github"]);
    expect(missing).toEqual(["settings"]);
  });

  it("should prefer Lucide when no library is given", () => {
    expect(matchIconRefs(["home"], [tablerHome, lucideHome]).icons[0]?.id).toBe("lucide:home");
  });

  it("should use the default library for bare names", () => {
    expect(matchIconRefs(["home"], [lucideHome, tablerHome], "tabler").icons[0]?.id).toBe("tabler:home");
  });

  it("should never fall back to a different icon", () => {
    expect(matchIconRefs(["x"], [fiveHundredPx], "simple-icons")).toEqual({ icons: [], missing: ["x"] });
  });
});

describe("isDirectoryPath", () => {
  it("should treat paths without an extension or with a trailing slash as directories", () => {
    expect(isDirectoryPath("src/components/icons")).toBe(true);
    expect(isDirectoryPath("src/icons/")).toBe(true);
    expect(isDirectoryPath("src/icons/nav.tsx")).toBe(false);
  });
});

describe("mergeIndexFile", () => {
  it("should keep existing exports and add only the missing ones", () => {
    const existing = 'export { Check } from "./check";\nexport { Home } from "./home";\n';
    const generated = '// Generated\nexport { Home } from "./home";\nexport { Github } from "./github";\n';
    expect(mergeIndexFile(existing, generated)).toBe(
      'export { Check } from "./check";\nexport { Home } from "./home";\nexport { Github } from "./github";\n'
    );
  });
});

describe("assertSafeIcon", () => {
  it("should accept real icon data", () => {
    expect(() => assertSafeIcon(githubLogo)).not.toThrow();
  });

  it.each([
    ["braces that JSX would evaluate", '<path d="M0 0" />{process.exit()}'],
    ["a script element", "<script>alert(1)</script>"],
    ["an event handler", '<path onload="alert(1)" d="M0 0"/>'],
    ["a javascript: URL", '<a href="javascript:alert(1)"><path d="M0 0"/></a>'],
  ])("should reject content with %s", (_, content) => {
    expect(() => generateIconFile({ ...lucideHome, content }, "react")).toThrow(/Refusing to generate/);
  });

  it("should reject a viewBox that is not four numbers", () => {
    expect(() => assertSafeIcon({ ...lucideHome, viewBox: '0 0 24 24" onload="x' })).toThrow(/invalid viewBox/);
  });
});

describe("toSafeFileName", () => {
  it("should keep only lowercase letters, digits, and hyphens", () => {
    expect(toSafeFileName("hive_blockchain")).toBe("hive-blockchain");
    expect(toSafeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(toSafeFileName("..")).toBe("icon");
  });

  it("should keep generated paths inside the output directory", () => {
    const evil: CodegenIcon = { ...lucideHome, normalizedName: "../../outside", sourceId: "../x" };
    for (const file of generateSplitFiles([evil, evil], "svg")) expect(file.path).toMatch(/^[a-z0-9-]+\.svg$/);
  });
});
