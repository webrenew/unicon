/**
 * Shared types, schemas, constants, and helpers for MCP tool handlers.
 */

import { z } from "zod";
import { STARTER_PACKS } from "@/lib/starter-packs";
import { STANDARD_VIEWBOX } from "@/lib/icon-utils";

// Constants
export const CHARACTER_LIMIT = 100000;
export const VALID_PACK_IDS = STARTER_PACKS.map((p) => p.id);

// Auth context for authenticated tools
export interface AuthContext {
  userId: string;
}

// Reusable Zod schemas
export const iconIdSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(
    /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/i,
    "Invalid iconId format. Expected 'source:name' (e.g., 'lucide:arrow-right')"
  )
  .describe("Icon ID in format 'source:name' (e.g., 'lucide:arrow-right')");

export const formatSchema = z
  .enum(["svg", "react", "vue", "svelte", "json"])
  .default("react")
  .describe("Output format");

export const sizeSchema = z
  .number()
  .int()
  .min(8)
  .max(512)
  .default(24)
  .describe("Icon size in pixels");

export const strokeWidthSchema = z
  .number()
  .min(0.5)
  .max(4)
  .default(2)
  .describe("Stroke width");

export const normalizeStrokesSchema = z
  .boolean()
  .default(false)
  .describe("Normalize stroke widths across icons (skips fill-based icons automatically)");

export const outputSchema = z
  .enum(["individual", "bundle"])
  .default("bundle")
  .describe("Output mode: 'bundle' (single file, 70% smaller) or 'individual' (separate components)");

export const sourceSchema = z
  .enum([
    "lucide",
    "phosphor",
    "hugeicons",
    "heroicons",
    "tabler",
    "feather",
    "remix",
    "simple-icons",
    "iconoir",
  ])
  .optional()
  .describe("Filter by icon library");

export const bundleNameSchema = z.string().min(1).max(80).describe("Bundle name");

export const bundleDescriptionSchema = z
  .string()
  .max(300)
  .optional()
  .nullable()
  .describe("Bundle description");

export const bundleIconIdsSchema = z
  .array(iconIdSchema)
  .min(1)
  .max(200)
  .describe("List of icon IDs to save in the bundle");

export const strokePresetSchema = z
  .enum(["thin", "regular", "bold"])
  .optional()
  .describe("Stroke weight preset");

export const viewBoxSchema = z
  .string()
  .max(50)
  .default(STANDARD_VIEWBOX)
  .describe("Target viewBox when normalizing");

// Helper to truncate response if too large
export function truncateIfNeeded(text: string, limit: number = CHARACTER_LIMIT): string {
  if (text.length <= limit) return text;
  return (
    text.slice(0, limit) +
    `\n\n[Response truncated. Original size: ${text.length} characters. Use pagination or filters to reduce results.]`
  );
}

// Helper to get comment syntax based on format
export function getCommentSyntax(format: string): { start: string; end: string } {
  switch (format) {
    case "svg":
      return { start: "<!-- ", end: " -->" };
    case "react":
    case "json":
      return { start: "// ", end: "" };
    case "vue":
      return { start: "<!-- ", end: " -->" };
    case "svelte":
      return { start: "<!-- ", end: " -->" };
    default:
      return { start: "// ", end: "" };
  }
}

// Helper to format batch icons with identifying comments
export function formatBatchIconsText(
  icons: Array<{ id?: string; name: string; code: string; error?: string }>,
  format: string
): string {
  const { start, end } = getCommentSyntax(format);
  const separator = "\n" + "=".repeat(60) + "\n";

  return icons
    .map((icon, index) => {
      const iconId = icon.id || icon.name;
      const header = `${start}[${index + 1}] ${iconId}${icon.error ? " (ERROR)" : ""}${end}`;

      if (icon.error) {
        return `${header}\n${start}Error: ${icon.error}${end}`;
      }

      return `${header}\n${icon.code}`;
    })
    .join(separator);
}
