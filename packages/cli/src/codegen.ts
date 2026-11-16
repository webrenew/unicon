/**
 * Code generation for the unicon CLI. Pure functions only, so `get`, `bundle`
 * and `sync` produce the same output and can be tested without the network.
 */

export type IconFormat = "react" | "vue" | "svelte" | "svg" | "json";

export const ICON_FORMATS: readonly IconFormat[] = ["react", "vue", "svelte", "svg", "json"];

/** Formats where each icon is its own component file. */
export const COMPONENT_FORMATS: ReadonlySet<IconFormat> = new Set(["react", "vue", "svelte"]);

export const FILE_EXTENSIONS: Record<IconFormat, string> = {
  react: "tsx",
  vue: "vue",
  svelte: "svelte",
  svg: "svg",
  json: "json",
};

export interface CodegenIcon {
  id: string;
  normalizedName: string;
  sourceId: string;
  viewBox: string;
  content: string;
  category?: string | null | undefined;
  tags?: string[] | undefined;
  strokeWidth?: string | null | undefined;
  defaultStroke?: boolean | undefined;
  defaultFill?: boolean | undefined;
}

export interface GeneratedFile {
  /** Path relative to the output directory. */
  path: string;
  content: string;
}

const DEFAULT_STROKE_WIDTH = 2;
const TITLE_PATTERN = /<title>[\s\S]*?<\/title>\s*/g;

/** Libraries that are fill-based, for API responses without `defaultFill`. */
const FILL_SOURCES = new Set(["phosphor", "remix", "simple-icons"]);

export function isIconFormat(value: unknown): value is IconFormat {
  return typeof value === "string" && (ICON_FORMATS as readonly string[]).includes(value);
}

/**
 * Whether an icon is drawn with fill or stroke. Uses the icon's own
 * `defaultFill`/`defaultStroke` flags, so filled icons in mostly-stroke
 * libraries (Heroicons solid, Iconoir solid) and brand logos render correctly.
 */
export function getRenderMode(icon: Pick<CodegenIcon, "sourceId" | "defaultFill" | "defaultStroke">): "fill" | "stroke" {
  if (icon.defaultFill === undefined && icon.defaultStroke === undefined) {
    return FILL_SOURCES.has(icon.sourceId) ? "fill" : "stroke";
  }
  return icon.defaultFill && !icon.defaultStroke ? "fill" : "stroke";
}

/**
 * Turn an icon name into a valid component identifier: `log-out` → `LogOut`,
 * `500px` → `Icon500px`.
 */
export function toComponentName(name: string): string {
  const pascal = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  if (!pascal) return "Icon";
  return /^[0-9]/.test(pascal) ? `Icon${pascal}` : pascal;
}

/** The SVG body without `<title>`: the generated `<svg>` is `aria-hidden`. */
function getBody(icon: CodegenIcon): string {
  return icon.content.replace(TITLE_PATTERN, "").trim();
}

const HYPHENATED_ATTRIBUTE = /(\s)([a-z]+(?:-[a-z]+)+)=/g;

/**
 * The SVG body with JSX attribute names (`fill-rule` → `fillRule`), so React
 * does not warn about invalid DOM properties. `data-*` and `aria-*` stay.
 */
export function toJsxBody(body: string): string {
  return body.replace(HYPHENATED_ATTRIBUTE, (match, space: string, attribute: string) => {
    if (attribute.startsWith("data-") || attribute.startsWith("aria-")) return match;
    return `${space}${attribute.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}=`;
  });
}

function getStrokeWidth(icon: CodegenIcon): number {
  return parseFloat(icon.strokeWidth ?? "") || DEFAULT_STROKE_WIDTH;
}

/** Paint attributes in SVG/HTML syntax (`stroke-width`). */
export function getSvgAttributes(icon: CodegenIcon): string {
  if (getRenderMode(icon) === "fill") return 'fill="currentColor"';
  return `fill="none" stroke="currentColor" stroke-width="${getStrokeWidth(icon)}" stroke-linecap="round" stroke-linejoin="round"`;
}

/** Paint attributes in JSX syntax (`strokeWidth={2}`). */
export function getJsxAttributes(icon: CodegenIcon): string {
  if (getRenderMode(icon) === "fill") return 'fill="currentColor"';
  return `fill="none" stroke="currentColor" strokeWidth={${getStrokeWidth(icon)}} strokeLinecap="round" strokeLinejoin="round"`;
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((line) => (line ? pad + line : line)).join("\n");
}

function reactComponent(icon: CodegenIcon, componentName: string): string {
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

function svgElement(icon: CodegenIcon): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${getSvgAttributes(icon)} aria-hidden="true" focusable="false">
${indent(getBody(icon), 2)}
</svg>`;
}

function jsonIcon(icon: CodegenIcon): Record<string, unknown> {
  return {
    id: icon.id,
    name: icon.normalizedName,
    source: icon.sourceId,
    viewBox: icon.viewBox,
    content: getBody(icon),
    renderMode: getRenderMode(icon),
    ...(getRenderMode(icon) === "stroke" ? { strokeWidth: getStrokeWidth(icon) } : {}),
    tags: icon.tags ?? [],
    category: icon.category ?? null,
  };
}

/**
 * The code for one icon in one file.
 *
 * @param componentName - Component name for react; defaults to the icon name
 */
export function generateIconFile(icon: CodegenIcon, format: IconFormat, componentName = toComponentName(icon.normalizedName)): string {
  const header = `Generated by @webrenew/unicon from ${icon.id} - https://unicon.sh`;
  switch (format) {
    case "svg":
      return `${svgElement(icon)}\n`;
    case "json":
      return `${JSON.stringify(jsonIcon(icon), null, 2)}\n`;
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

/**
 * Give every icon a unique file and component name. When two libraries have
 * an icon with the same name, the later ones get the library as a suffix
 * (`home`, `home-tabler`), so no file is overwritten and no export repeats.
 */
export function assignNames(icons: readonly CodegenIcon[]): { icon: CodegenIcon; fileName: string; componentName: string }[] {
  const used = new Set<string>();
  return icons.map((icon) => {
    let fileName = icon.normalizedName;
    if (used.has(fileName)) fileName = `${icon.normalizedName}-${icon.sourceId}`;
    for (let n = 2; used.has(fileName); n++) fileName = `${icon.normalizedName}-${icon.sourceId}-${n}`;
    used.add(fileName);
    return { icon, fileName, componentName: toComponentName(fileName) };
  });
}

/**
 * One file per icon, plus an `index.ts` that re-exports the components, for
 * react, vue and svelte. For svg and json there is no index.
 */
export function generateSplitFiles(icons: readonly CodegenIcon[], format: IconFormat): GeneratedFile[] {
  const ext = FILE_EXTENSIONS[format];
  const named = assignNames(icons);
  const files = named.map(({ icon, fileName, componentName }) => ({
    path: `${fileName}.${ext}`,
    content: generateIconFile(icon, format, componentName),
  }));
  if (!COMPONENT_FORMATS.has(format)) return files;

  const exports = named.map(({ fileName, componentName }) =>
    format === "react"
      ? `export { ${componentName} } from "./${fileName}";`
      : `export { default as ${componentName} } from "./${fileName}.${ext}";`
  );
  files.push({
    path: "index.ts",
    content: `// Generated by @webrenew/unicon. Re-exports each icon so bundlers can tree-shake.\n${exports.join("\n")}\n`,
  });
  return files;
}

/**
 * All icons in one file: React components, a JSON array, or an SVG sprite of
 * `<symbol>` elements (use with `<svg><use href="icons.svg#home" /></svg>`).
 * Vue and Svelte need one component per file, so they have no single-file form.
 *
 * @throws For vue and svelte
 */
export function generateSingleFile(icons: readonly CodegenIcon[], format: IconFormat): string {
  const named = assignNames(icons);
  switch (format) {
    case "react":
      return `/**
 * Icon components generated by @webrenew/unicon
 * @see https://unicon.sh
 */
import type { SVGProps } from "react";

${named.map(({ icon, componentName }) => `// ${icon.id}\n${reactComponent(icon, componentName)}`).join("\n\n")}
`;
    case "json":
      return `${JSON.stringify(named.map(({ icon }) => jsonIcon(icon)), null, 2)}\n`;
    case "svg": {
      const symbols = named.map(({ icon, fileName }) =>
        `  <symbol id="${fileName}" viewBox="${icon.viewBox}" ${getSvgAttributes(icon)}>\n${indent(getBody(icon), 4)}\n  </symbol>`
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

/** Parse `source:name` or `name` into its parts. */
export function parseIconRef(ref: string, defaultSource?: string): { source: string | undefined; name: string } {
  const trimmed = ref.trim();
  const colon = trimmed.indexOf(":");
  if (colon === -1) return { source: defaultSource, name: trimmed.toLowerCase() };
  return { source: trimmed.slice(0, colon).toLowerCase(), name: trimmed.slice(colon + 1).toLowerCase() };
}

/**
 * Pick the icons that exactly match each reference, in reference order.
 * Without a source, Lucide wins, then the first library returned.
 *
 * @returns The matched icons and the references that matched nothing
 */
export function matchIconRefs(
  refs: readonly string[],
  candidates: readonly CodegenIcon[],
  defaultSource?: string
): { icons: CodegenIcon[]; missing: string[] } {
  const icons: CodegenIcon[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    const { source, name } = parseIconRef(ref, defaultSource);
    const matches = candidates.filter((icon) => icon.normalizedName.toLowerCase() === name && (!source || icon.sourceId === source));
    const icon = matches.find((match) => match.sourceId === "lucide") ?? matches[0];
    if (icon) icons.push(icon);
    else missing.push(ref);
  }
  return { icons, missing };
}

/**
 * Whether an output path names a directory rather than a file: it ends with
 * a slash or has no file extension.
 */
export function isDirectoryPath(path: string): boolean {
  if (/[\\/]$/.test(path)) return true;
  const last = path.split(/[\\/]/).pop() ?? "";
  return !/\.[a-zA-Z0-9]+$/.test(last);
}

/**
 * Merge a newly generated `index.ts` into an existing one: keep every line
 * already there (exports of icons from earlier runs or written by hand) and
 * append the new export lines that are missing.
 */
export function mergeIndexFile(existing: string, generated: string): string {
  const lines = existing.replace(/\n+$/, "").split("\n");
  const present = new Set(lines.map((line) => line.trim()));
  const added = generated.split("\n").filter((line) => line.startsWith("export ") && !present.has(line.trim()));
  return `${[...lines, ...added].join("\n")}\n`;
}
