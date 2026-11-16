#!/usr/bin/env node

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
// Bundled as text at build time; the repository's skills/ directory is the source.
import uniconSkillMd from "../../../skills/unicon/SKILL.md";
import uniconCliCommandsMd from "../../../skills/unicon/references/cli-commands.md";
import uniconConfigFileMd from "../../../skills/unicon/references/config-file.md";
import uniconApiReferenceMd from "../../../skills/unicon/references/api-reference.md";
import {
  COMPONENT_FORMATS,
  FILE_EXTENSIONS,
  generateIconFile,
  generateSingleFile,
  generateSplitFiles,
  isDirectoryPath,
  isIconFormat,
  matchIconRefs,
  mergeIndexFile,
  toComponentName,
  toSafeFileName,
  type GeneratedFile,
  type IconFormat,
} from "./codegen";

const require = createRequire(import.meta.url);
const { version: CLI_VERSION } = require("../package.json") as { version: string };

/**
 * Simple yes/no confirmation prompt
 */
function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

const API_BASE = process.env.UNICON_API_URL || "https://unicon.sh";
const CONFIG_FILE = ".uniconrc.json";
const UNICON_DIR = join(homedir(), ".unicon");
const CACHE_DIR = join(UNICON_DIR, "cache");
const FAVORITES_FILE = join(UNICON_DIR, "favorites.json");
const AUTH_FILE = join(UNICON_DIR, "auth.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────

interface AuthData {
  access_token: string;
  refresh_token?: string;
  created_at: string;
}

function ensureUniconDir(): void {
  if (!existsSync(UNICON_DIR)) {
    mkdirSync(UNICON_DIR, { recursive: true });
  }
}

function loadAuth(): AuthData | null {
  if (!existsSync(AUTH_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(AUTH_FILE, "utf-8");
    return JSON.parse(content) as AuthData;
  } catch {
    return null;
  }
}

function saveAuth(data: AuthData): void {
  ensureUniconDir();
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function clearAuth(): void {
  if (existsSync(AUTH_FILE)) {
    unlinkSync(AUTH_FILE);
  }
}

function getAuthToken(): string | null {
  // Environment variable takes precedence
  if (process.env.UNICON_API_TOKEN) {
    return process.env.UNICON_API_TOKEN;
  }
  
  const auth = loadAuth();
  return auth?.access_token || null;
}

async function startDeviceAuth(): Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number }> {
  const res = await fetch(`${API_BASE}/api/auth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "CLI", scope: "bundles:read" }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error_description || error.error || "Failed to start device authorization");
  }

  return res.json();
}

async function pollForToken(deviceCode: string, interval: number, expiresIn: number): Promise<AuthData> {
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;

  while (Date.now() < expiresAt) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    const res = await fetch(`${API_BASE}/api/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const data = await res.json();

    if (res.ok) {
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        created_at: new Date().toISOString(),
      };
    }

    // Handle specific errors
    if (data.error === "authorization_pending") {
      continue; // Keep polling
    }

    if (data.error === "slow_down") {
      interval += 5; // Increase polling interval
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

// ─────────────────────────────────────────────────────────────────────────────
// Framework Auto-Detection
// ─────────────────────────────────────────────────────────────────────────────

type FrameworkType = "react" | "vue" | "svelte" | null;

interface FrameworkDetectionResult {
  framework: FrameworkType;
  reason: string;
}

function detectFramework(): FrameworkDetectionResult {
  const packageJsonPath = resolve(process.cwd(), "package.json");

  if (!existsSync(packageJsonPath)) {
    return { framework: null, reason: "No package.json found" };
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check for React/Next.js
    if (deps.react || deps.next || deps["@remix-run/react"]) {
      const detected = deps.next ? "next" : deps["@remix-run/react"] ? "remix" : "react";
      return { framework: "react", reason: `Detected ${detected} in dependencies` };
    }

    // Check for Vue/Nuxt
    if (deps.vue || deps.nuxt || deps["@nuxt/kit"]) {
      const detected = deps.nuxt || deps["@nuxt/kit"] ? "nuxt" : "vue";
      return { framework: "vue", reason: `Detected ${detected} in dependencies` };
    }

    // Check for Svelte/SvelteKit
    if (deps.svelte || deps["@sveltejs/kit"]) {
      const detected = deps["@sveltejs/kit"] ? "@sveltejs/kit" : "svelte";
      return { framework: "svelte", reason: `Detected ${detected} in dependencies` };
    }

    return { framework: null, reason: "No supported framework detected" };
  } catch {
    return { framework: null, reason: "Failed to parse package.json" };
  }
}

function getFormatForFramework(framework: FrameworkType): "react" | "vue" | "svelte" {
  return framework || "react";
}

// ─────────────────────────────────────────────────────────────────────────────
// Clipboard Support
// ─────────────────────────────────────────────────────────────────────────────

async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await clipboard.write(content);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Favorites System
// ─────────────────────────────────────────────────────────────────────────────

interface FavoriteIcon {
  name: string;
  sourceId: string;
  addedAt: string;
}

interface FavoritesData {
  favorites: FavoriteIcon[];
}

function ensureFavoritesDir(): void {
  const dir = dirname(FAVORITES_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadFavorites(): FavoritesData {
  ensureFavoritesDir();

  if (!existsSync(FAVORITES_FILE)) {
    return { favorites: [] };
  }

  try {
    const content = readFileSync(FAVORITES_FILE, "utf-8");
    return JSON.parse(content) as FavoritesData;
  } catch {
    return { favorites: [] };
  }
}

function saveFavorites(data: FavoritesData): void {
  ensureFavoritesDir();
  writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function addFavorite(icon: Icon): boolean {
  const data = loadFavorites();

  // Check if already favorited
  if (data.favorites.some(f => f.name === icon.normalizedName)) {
    return false;
  }

  data.favorites.push({
    name: icon.normalizedName,
    sourceId: icon.sourceId,
    addedAt: new Date().toISOString(),
  });

  saveFavorites(data);
  return true;
}

function removeFavorite(name: string): boolean {
  const data = loadFavorites();
  const index = data.favorites.findIndex(f => f.name === name);

  if (index === -1) {
    return false;
  }

  data.favorites.splice(index, 1);
  saveFavorites(data);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Watch Mode
// ─────────────────────────────────────────────────────────────────────────────

function watchConfig(configPath: string, onChange: () => Promise<void>): { close: () => void } {
  const watcher = chokidar.watch(configPath, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on("change", async () => {
    await onChange();
  });

  return {
    close: () => watcher.close(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage Audit
// ─────────────────────────────────────────────────────────────────────────────

interface AuditResult {
  bundled: string[];
  used: string[];
  unused: string[];
  missing: string[];
  usageLocations: Record<string, string[]>;
}

async function scanProjectForIconUsage(): Promise<{ iconName: string; file: string }[]> {
  const usages: { iconName: string; file: string }[] = [];

  // Recursively scan directories
  function scanDir(dir: string): void {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip node_modules, .git, dist, build
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

            // Look for icon imports
            // Match: import { IconName } from
            // Match: import IconName from
            const importMatches = content.matchAll(/import\s*\{?\s*([A-Z][a-zA-Z0-9]+(?:Icon)?)\s*\}?\s*from/g);

            for (const match of importMatches) {
              const name = match[1];
              if (name && /^[A-Z]/.test(name)) {
                // Convert PascalCase to kebab-case for matching
                const kebabName = name
                  .replace(/Icon$/, "")
                  .replace(/([a-z])([A-Z])/g, "$1-$2")
                  .toLowerCase();
                usages.push({ iconName: kebabName, file: fullPath });
              }
            }

            // Also look for direct component usage: <Home /> <HomeIcon />
            const componentMatches = content.matchAll(/<([A-Z][a-zA-Z0-9]+(?:Icon)?)\s*[^>]*\/?>/g);
            for (const match of componentMatches) {
              const name = match[1];
              if (name && /^[A-Z]/.test(name)) {
                const kebabName = name
                  .replace(/Icon$/, "")
                  .replace(/([a-z])([A-Z])/g, "$1-$2")
                  .toLowerCase();
                usages.push({ iconName: kebabName, file: fullPath });
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }
  }

  scanDir(process.cwd());
  return usages;
}

async function auditProject(): Promise<AuditResult> {
  const config = loadConfig();
  const bundled: Set<string> = new Set();

  // Get all bundled icons from config
  if (config) {
    for (const bundle of config.bundles) {
      if (bundle.query || bundle.category || bundle.source) {
        try {
          const { icons } = await fetchIcons({
            query: bundle.query,
            category: bundle.category,
            source: bundle.source,
            limit: bundle.limit || 100,
          });
          for (const icon of icons) {
            bundled.add(icon.normalizedName);
          }
        } catch {
          // Skip failed fetches
        }
      }
    }
  }

  // Scan project for icon usage
  const usages = await scanProjectForIconUsage();
  const used = new Set<string>();
  const usageLocations: Record<string, string[]> = {};

  for (const usage of usages) {
    used.add(usage.iconName);
    if (!usageLocations[usage.iconName]) {
      usageLocations[usage.iconName] = [];
    }
    const locations = usageLocations[usage.iconName]!;
    if (!locations.includes(usage.file)) {
      locations.push(usage.file);
    }
  }

  // Calculate unused (bundled but not used) and missing (used but not bundled)
  const unused = [...bundled].filter(name => !used.has(name));
  const missing = [...used].filter(name => !bundled.has(name));

  return {
    bundled: [...bundled],
    used: [...used],
    unused,
    missing,
    usageLocations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized SVG Generation Constants
// ─────────────────────────────────────────────────────────────────────────────

// Config file types
interface BundleConfig {
  name: string;
  /** Exact icons, as `source:name` or `name` (uses `source`). */
  icons?: string[];
  query?: string;
  category?: string;
  source?: string;
  format?: "react" | "vue" | "svelte" | "svg" | "json";
  limit?: number;
  output: string;
}

interface UniconConfig {
  $schema?: string;
  bundles: BundleConfig[];
}

function findConfigFile(): string | null {
  const configPath = resolve(process.cwd(), CONFIG_FILE);
  return existsSync(configPath) ? configPath : null;
}

function loadConfig(): UniconConfig | null {
  const configPath = findConfigFile();
  if (!configPath) return null;
  
  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as UniconConfig;
  } catch (error) {
    console.error(chalk.red(`Failed to parse ${CONFIG_FILE}:`), error);
    return null;
  }
}

function createDefaultConfig(): UniconConfig {
  return {
    $schema: "https://unicon.sh/schema/uniconrc.json",
    bundles: [
      {
        name: "common",
        icons: ["home", "settings", "user", "search", "menu", "x", "check"],
        source: "lucide",
        format: "react",
        output: "./src/icons/common",
      },
      {
        name: "navigation",
        query: "arrow chevron menu",
        source: "lucide",
        limit: 30,
        format: "react",
        output: "./src/icons/navigation",
      },
    ],
  };
}

function showBanner(): void {
  const banner = figlet.textSync("UNICON", {
    font: "ANSI Shadow",
    horizontalLayout: "fitted",
  });

  console.log(chalk.cyan(banner));
  console.log(chalk.dim("  The unified icon library for React, Vue & Svelte\n"));
}

// Cache functions
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(params: Record<string, string | number | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return Buffer.from(sorted).toString("base64url");
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getFromCache<T>(key: string): T | null {
  ensureCacheDir();
  const cachePath = join(CACHE_DIR, `${key}.json`);
  
  if (!existsSync(cachePath)) return null;
  
  try {
    const content = readFileSync(cachePath, "utf-8");
    const entry = JSON.parse(content) as CacheEntry<T>;
    
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      unlinkSync(cachePath);
      return null;
    }
    
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  ensureCacheDir();
  const cachePath = join(CACHE_DIR, `${key}.json`);
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  writeFileSync(cachePath, JSON.stringify(entry), "utf-8");
}

function clearCache(): { count: number; size: number } {
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
    // Ignore errors
  }
  
  return { count, size };
}

function getCacheStats(): { count: number; size: number; oldest: Date | null } {
  ensureCacheDir();
  let count = 0;
  let size = 0;
  let oldest: number | null = null;
  
  try {
    const files = readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = join(CACHE_DIR, file);
        const content = readFileSync(filePath, "utf-8");
        size += content.length;
        count++;
        
        try {
          const entry = JSON.parse(content) as CacheEntry<unknown>;
          if (oldest === null || entry.timestamp < oldest) {
            oldest = entry.timestamp;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } catch {
    // Ignore errors
  }
  
  return { count, size, oldest: oldest ? new Date(oldest) : null };
}

// ASCII Preview - renders SVG viewBox as simple grid
function renderAsciiPreview(icon: Icon, width = 16, height = 16): string {
  const chars = [" ", "░", "▒", "▓", "█"];
  const grid: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
  
  // Parse viewBox
  const parts = icon.viewBox.split(" ").map(Number);
  const vbWidth = parts[2] ?? 24;
  const vbHeight = parts[3] ?? 24;
  const scaleX = width / vbWidth;
  const scaleY = height / vbHeight;
  
  // Simple path parsing - marks cells that contain path elements
  const pathMatches = icon.content.matchAll(/d="([^"]+)"/g);
  
  for (const match of pathMatches) {
    const pathData = match[1];
    if (!pathData) continue;
    
    // Extract coordinate pairs from path
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
        // Mark this cell and neighbors
        const row = grid[y];
        const rowAbove = grid[y - 1];
        const rowBelow = grid[y + 1];
        
        if (row && x >= 0 && x < width && y >= 0 && y < height) {
          row[x] = Math.min(4, (row[x] ?? 0) + 2);
          // Add neighbors for thickness
          if (x > 0) row[x - 1] = Math.min(4, (row[x - 1] ?? 0) + 1);
          if (x < width - 1) row[x + 1] = Math.min(4, (row[x + 1] ?? 0) + 1);
          if (rowAbove) rowAbove[x] = Math.min(4, (rowAbove[x] ?? 0) + 1);
          if (rowBelow) rowBelow[x] = Math.min(4, (rowBelow[x] ?? 0) + 1);
        }
      }
      isX = !isX;
    }
  }
  
  // Also check for circles, rects, lines
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
  
  // Render grid
  const lines: string[] = [];
  for (const row of grid) {
    lines.push(row.map((v) => chars[v] ?? " ").join(""));
  }
  
  return lines.join("\n");
}

interface Icon {
  id: string;
  name: string;
  normalizedName: string;
  sourceId: string;
  viewBox: string;
  content: string;
  category: string | null;
  tags: string[];
  strokeWidth: string | null;
  defaultStroke?: boolean;
  defaultFill?: boolean;
}

interface SearchResponse {
  icons: Icon[];
  hasMore: boolean;
  searchType?: string;
  expandedQuery?: string;
}

async function fetchIcons(
  params: {
    query?: string | undefined;
    category?: string | undefined;
    source?: string | undefined;
    limit?: number | undefined;
  },
  options: { useCache?: boolean } = { useCache: true }
): Promise<SearchResponse> {
  // Check cache first
  if (options.useCache) {
    const cacheKey = getCacheKey({ type: "icons", ...params });
    const cached = getFromCache<SearchResponse>(cacheKey);
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
  
  const data = await res.json() as SearchResponse;
  
  // Cache the result
  if (options.useCache) {
    const cacheKey = getCacheKey({ type: "icons", ...params });
    setCache(cacheKey, data);
  }
  
  return data;
}

async function fetchCategories(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/icons?limit=1`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  // Categories come from a separate endpoint or we can list known ones
  // For now, return common categories
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
    "Weather",
  ];
}

/**
 * Fetch icons by exact name. The API returns every library's icon with each
 * name; `matchIconRefs` picks the requested library.
 *
 * @param refs - `source:name` or `name`
 * @param defaultSource - Library for bare names
 */
async function fetchIconsByRefs(
  refs: readonly string[],
  defaultSource?: string,
  options: { useCache?: boolean } = { useCache: true }
): Promise<{ icons: Icon[]; missing: string[] }> {
  const names = [...new Set(refs.map((ref) => ref.slice(ref.indexOf(":") + 1).trim().toLowerCase()).filter(Boolean))];
  if (names.length === 0) return { icons: [], missing: [...refs] };

  const cacheKey = getCacheKey({ type: "names", names: names.join(",") });
  let candidates = options.useCache ? getFromCache<Icon[]>(cacheKey) : null;
  if (!candidates) {
    const url = new URL(`${API_BASE}/api/icons`);
    url.searchParams.set("names", names.join(","));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    candidates = ((await res.json()) as SearchResponse).icons;
    if (options.useCache) setCache(cacheKey, candidates);
  }

  const { icons, missing } = matchIconRefs(refs, candidates, defaultSource);
  return { icons: icons as Icon[], missing };
}

/** Write generated files under a directory, creating it if needed. */
function writeGeneratedFiles(directory: string, files: readonly GeneratedFile[]): void {
  const fullDir = resolve(process.cwd(), directory);
  mkdirSync(fullDir, { recursive: true });
  for (const file of files) {
    const target = resolve(fullDir, file.path);
    if (!target.startsWith(fullDir + sep)) throw new Error(`Refusing to write outside ${directory}: ${file.path}`);
    // Keep exports from earlier runs, so adding icons to a folder never drops existing ones.
    const content = file.path === "index.ts" && existsSync(target) ? mergeIndexFile(readFileSync(target, "utf-8"), file.content) : file.content;
    writeFileSync(target, content, "utf-8");
  }
}

/**
 * Write a set of icons to `output`. A directory gets one file per icon (plus
 * an `index.ts` for components); a file path gets all icons in one file.
 * Vue and Svelte always need a directory.
 *
 * @returns A description of what was written, for messages
 * @throws When a Vue or Svelte set is given a file path
 */
function writeIconSet(icons: readonly Icon[], format: IconFormat, output: string, options: { dryRun?: boolean } = {}): string {
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

/** Validate a `--format` value, exiting with a message when it is unknown. */
function parseFormat(value: unknown): IconFormat | undefined {
  if (value === undefined) return undefined;
  if (isIconFormat(value)) return value;
  console.error(chalk.red(`Unknown format "${String(value)}". Use react, vue, svelte, svg, or json.`));
  process.exit(1);
}

/** Split a comma- or space-separated list of icon references. */
function parseIconList(value: string): string[] {
  return value.split(/[\s,]+/).map((ref) => ref.trim()).filter(Boolean);
}

/**
 * Fetch a config bundle's icons and write them to its output.
 *
 * @returns The number of icons and where they went, or a reason it was skipped
 */
async function syncBundle(
  bundle: BundleConfig,
  options: { useCache?: boolean; dryRun?: boolean } = {}
): Promise<{ count: number; written: string; missing: string[] } | { skipped: string }> {
  if (!bundle.icons?.length && !bundle.query && !bundle.category && !bundle.source) {
    return { skipped: "no icons, query, category, or source specified" };
  }

  let format: IconFormat;
  if (bundle.format === undefined) {
    format = getFormatForFramework(detectFramework().framework);
  } else if (isIconFormat(bundle.format)) {
    format = bundle.format;
  } else {
    throw new Error(`unknown format "${String(bundle.format)}"`);
  }

  let icons: Icon[] = [];
  let missing: string[] = [];
  if (bundle.icons?.length) {
    ({ icons, missing } = await fetchIconsByRefs(bundle.icons, bundle.source, { useCache: options.useCache ?? true }));
  }
  if (bundle.query || bundle.category || (!bundle.icons?.length && bundle.source)) {
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

/** Libraries on unicon.sh, as `--source` IDs. */
const ICON_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ["lucide", "Lucide (stroke)"],
  ["phosphor", "Phosphor (fill)"],
  ["hugeicons", "Hugeicons (stroke)"],
  ["heroicons", "Heroicons (outline and solid)"],
  ["tabler", "Tabler (stroke)"],
  ["feather", "Feather (stroke)"],
  ["remix", "Remix Icon (fill)"],
  ["iconoir", "Iconoir (stroke and solid)"],
  ["simple-icons", "Simple Icons (brand logos, fill)"],
];

const program = new Command();

program
  .name("unicon")
  .description("CLI for searching and bundling icons from Unicon")
  .version(CLI_VERSION)
  .hook("preAction", (thisCommand) => {
    // Show banner only for main commands, not subcommands
    if (thisCommand.args.length === 0 || process.argv.includes("--help") || process.argv.includes("-h")) {
      return;
    }
  })
  .addHelpText("beforeAll", () => {
    showBanner();
    return "";
  });

// Search command
program
  .command("search <query>")
  .description("Search for icons by name or keyword")
  .option("-s, --source <source>", "Filter by source (lucide, phosphor, simple-icons, ...; see `unicon sources`)")
  .option("-c, --category <category>", "Filter by category")
  .option("-l, --limit <number>", "Maximum number of results", "20")
  .option("-j, --json", "Output as JSON")
  .option("-p, --pick", "Interactively select icons from results")
  .action(async (query: string, options) => {
    const spinner = ora("Searching icons...").start();

    try {
      const { icons, searchType, expandedQuery } = await fetchIcons({
        query,
        source: options.source,
        category: options.category,
        limit: parseInt(options.limit, 10),
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

      // Interactive pick mode
      if (options.pick) {
        if (searchType === "semantic" && expandedQuery) {
          console.log(chalk.dim(`AI expanded: "${expandedQuery}"\n`));
        }

        const selected = await p.multiselect({
          message: `Select icons (${icons.length} found)`,
          options: icons.map(icon => ({
            value: icon,
            label: icon.normalizedName,
            hint: `${icon.sourceId}${icon.category ? ` / ${icon.category}` : ""}`,
          })),
        });

        if (p.isCancel(selected)) {
          console.log(chalk.dim("Cancelled."));
          return;
        }

        const selectedIcons = selected as Icon[];
        if (selectedIcons.length === 0) {
          console.log(chalk.yellow("No icons selected."));
          return;
        }

        // Ask what to do with selected icons
        const action = await p.select({
          message: "What would you like to do?",
          options: [
            { value: "copy", label: "Copy to clipboard", hint: "Copy React component(s)" },
            { value: "save", label: "Save to file", hint: "Write to disk" },
            { value: "star", label: "Add to favorites", hint: "Star for later" },
            { value: "bundle", label: "Create bundle", hint: "Add to .uniconrc.json" },
          ],
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
              console.log(chalk.green(`✓ ${selectedIcons.length} icon(s) copied to clipboard`));
            } else {
              console.log(chalk.red("Failed to copy to clipboard"));
            }
            break;
          }
          case "save": {
            const outputPath = await p.text({
              message: "Output directory:",
              placeholder: "./src/icons",
              defaultValue: "./src/icons",
            });
            if (p.isCancel(outputPath)) return;

            const outDir = resolve(process.cwd(), outputPath as string);
            mkdirSync(outDir, { recursive: true });

            writeGeneratedFiles(outDir, generateSplitFiles(selectedIcons, getFormatForFramework(detectFramework().framework)));
            console.log(chalk.green(`✓ ${selectedIcons.length} icon(s) saved to ${outputPath}`));
            break;
          }
          case "star": {
            let added = 0;
            for (const icon of selectedIcons) {
              if (addFavorite(icon)) added++;
            }
            console.log(chalk.green(`✓ Added ${added} icon(s) to favorites`));
            break;
          }
          case "bundle": {
            const bundleName = await p.text({
              message: "Bundle name:",
              placeholder: "my-icons",
            });
            if (p.isCancel(bundleName)) return;

            let config = loadConfig();
            if (!config) {
              config = { bundles: [] };
            }

            const newBundle: BundleConfig = {
              name: bundleName as string,
              icons: selectedIcons.map((i) => i.id),
              format,
              output: `./src/icons/${bundleName}`,
            };

            config.bundles.push(newBundle);
            const configPath = resolve(process.cwd(), CONFIG_FILE);
            writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
            console.log(chalk.green(`✓ Added bundle "${bundleName}" to ${CONFIG_FILE}`));
            break;
          }
        }
        return;
      }

      if (searchType === "semantic" && expandedQuery) {
        console.log(chalk.dim(`AI expanded: "${expandedQuery}"\n`));
      }

      console.log(chalk.bold(`Found ${icons.length} icons:\n`));

      icons.forEach((icon) => {
        const source = chalk.dim(`[${icon.sourceId}]`);
        const category = icon.category ? chalk.cyan(icon.category) : "";
        console.log(`  ${chalk.green(icon.normalizedName)} ${source} ${category}`);
      });

      console.log(
        chalk.dim(`\nUse ${chalk.white("unicon get <name>")} to copy a single icon.`)
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

// Info command - show icon details
program
  .command("info <name>")
  .description("Show detailed information about an icon")
  .option("-s, --source <source>", "Prefer source (lucide, phosphor, simple-icons, ...; see `unicon sources`)")
  .action(async (name: string, options) => {
    const spinner = ora("Fetching icon info...").start();

    try {
      const { icons } = await fetchIcons({
        query: name,
        source: options.source,
        limit: 10,
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
      console.log(chalk.dim("─".repeat(40)));
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

// Get command - copy a single icon (like shadcn add)
program
  .command("get <name>")
  .description("Get one icon by exact name (outputs to stdout)")
  .option("-s, --source <source>", "Library to take the icon from (lucide, phosphor, simple-icons, ...)")
  .option("-f, --format <format>", "Output format: react, vue, svelte, svg, json")
  .option("-o, --output <path>", "Write to file instead of stdout")
  .option("-c, --copy", "Copy to clipboard instead of stdout")
  .action(async (name: string, options) => {
    try {
      const { icons } = await fetchIconsByRefs([name], options.source);
      const icon = icons[0];

      if (!icon) {
        const where = options.source ? ` in ${options.source}` : "";
        console.error(chalk.red(`No icon is named "${name}"${where}.`));
        const { icons: similar } = await fetchIcons({ query: name.replace(/^[^:]*:/, ""), source: options.source, limit: 5 }).catch(() => ({ icons: [] as Icon[] }));
        if (similar.length > 0) {
          console.error(chalk.dim(`Similar: ${similar.map((i) => `${i.sourceId}:${i.normalizedName}`).join(", ")}`));
        }
        console.error(chalk.dim(`Search with: unicon search "${name}"${options.source ? ` --source ${options.source}` : ""}`));
        process.exit(1);
      }

      // Auto-detect format if not specified
      let format = parseFormat(options.format);
      if (!format) {
        const { framework, reason } = detectFramework();
        format = getFormatForFramework(framework);
        if (framework && (options.copy || options.output)) {
          console.error(chalk.dim(`Auto-detected: ${reason} → ${format}`));
        }
      }

      const componentName = toComponentName(icon.normalizedName);
      const content = generateIconFile(icon, format, componentName);

      // Handle output: clipboard, file, or stdout
      if (options.copy) {
        const success = await copyToClipboard(content);
        if (success) {
          console.log(chalk.green(`✓ ${componentName} copied to clipboard (${format})`));
        } else {
          console.error(chalk.red("Failed to copy to clipboard"));
          process.exit(1);
        }
      } else if (options.output) {
        const output: string = isDirectoryPath(options.output)
          ? join(options.output, `${toSafeFileName(icon.normalizedName)}.${FILE_EXTENSIONS[format]}`)
          : options.output;
        const fullPath = resolve(process.cwd(), output);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, "utf-8");
        console.error(chalk.green(`✓ ${icon.id} → ${output}`));
      } else {
        // Output to stdout (no colors, pipe-friendly)
        console.log(content);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });

// Bundle command
program
  .command("bundle")
  .description("Write a set of icons: one file per icon in a directory, or one file")
  .option("-q, --query <query>", "Search query")
  .option("-i, --icons <icons>", "Exact icons, comma-separated: home,lucide:settings")
  .option("-c, --category <category>", "Filter by category")
  .option("-s, --source <source>", "Filter by source (lucide, phosphor, simple-icons, ...)")
  .option("-f, --format <format>", "Output format: react, vue, svelte, svg, json")
  .option("-o, --output <path>", "Output directory (one file per icon) or file (one file)", "./icons")
  .option("-l, --limit <number>", "Maximum number of icons from a search", "100")
  .option("--single-file", "Combine all icons into one file in the output directory (react, svg, json)")
  .option("--stars", "Bundle all favorited icons")
  .action(async (options) => {
    let refs: string[] | undefined = options.icons ? parseIconList(options.icons) : undefined;

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
      if (framework) console.log(chalk.dim(`Auto-detected: ${reason} → ${format}`));
    }

    let output: string = options.output;
    if (options.singleFile) {
      if (COMPONENT_FORMATS.has(format) && format !== "react") {
        console.log(chalk.red(`Error: --single-file is not supported for ${format}. Vue and Svelte need one component per file.`));
        process.exit(1);
      }
      if (isDirectoryPath(output)) output = join(output, `icons.${FILE_EXTENSIONS[format]}`);
    }

    const spinner = ora("Fetching icons...").start();

    try {
      let icons: Icon[];
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
          limit: parseInt(options.limit, 10),
        }));
      }

      if (icons.length === 0) {
        spinner.fail("No icons found matching your criteria");
        process.exit(1);
      }

      const written = writeIconSet(icons, format, output);
      spinner.succeed(`${chalk.green(icons.length)} icons → ${chalk.cyan(written)}`);

      const sources = [...new Set(icons.map((i) => i.sourceId))];
      console.log(chalk.dim(`  Sources: ${sources.join(", ")}  Format: ${format}`));
      if (isDirectoryPath(output) && COMPONENT_FORMATS.has(format)) {
        const importPath = output.replace(/[\\/]+$/, "");
        console.log(chalk.dim(`  Import: import { ${toComponentName(icons[0]?.normalizedName ?? "icon")} } from "${/^\.{0,2}\//.test(importPath) ? importPath : `./${importPath}`}";`));
      } else if (format === "react" && icons.length > 10) {
        console.log(chalk.yellow(`  ⚠ One file with ${icons.length} components is not tree-shakeable. Use a directory output instead.`));
      }
    } catch (error) {
      spinner.fail("Bundle failed");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });

// Categories command
program
  .command("categories")
  .description("List available icon categories")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
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
        console.log(`  ${chalk.green("•")} ${cat}`);
      });

      console.log(
        chalk.dim(`\nUse ${chalk.white("unicon bundle --category <name>")} to export a category.`)
      );
    } catch (error) {
      spinner.fail("Failed to fetch categories");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });

// Sources command
program
  .command("sources")
  .description("List available icon sources/libraries")
  .option("-j, --json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    if (options.json) {
      console.log(JSON.stringify(ICON_SOURCES.map(([id, description]) => ({ id, description })), null, 2));
      return;
    }
    console.log(chalk.bold("Available icon sources:\n"));
    for (const [id, label] of ICON_SOURCES) {
      console.log(`  ${chalk.green("•")} ${chalk.yellow(id.padEnd(13))} ${label}`);
    }
    console.log(
      chalk.dim(`\nUse ${chalk.white("unicon bundle --source <name>")} to export from a source.`)
    );
  });

// Init command
program
  .command("init")
  .description("Initialize a .uniconrc.json config file")
  .option("-f, --force", "Overwrite existing config")
  .option("-i, --interactive", "Interactive setup wizard")
  .action(async (options) => {
    const configPath = resolve(process.cwd(), CONFIG_FILE);

    if (existsSync(configPath) && !options.force) {
      console.log(chalk.yellow(`${CONFIG_FILE} already exists. Use --force to overwrite.`));
      process.exit(1);
    }

    // Interactive mode
    if (options.interactive) {
      console.log();
      p.intro(chalk.cyan("Unicon Setup Wizard"));

      // Step 1: Detect framework
      const { framework, reason } = detectFramework();
      let selectedFormat: "react" | "vue" | "svelte" = "react";

      if (framework) {
        console.log(chalk.dim(`  ${reason}`));
        const useDetected = await p.confirm({
          message: `Use ${framework} format?`,
          initialValue: true,
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
              { value: "svelte", label: "Svelte", hint: "Svelte/SvelteKit" },
            ],
          });
          if (p.isCancel(formatChoice)) {
            p.outro(chalk.dim("Setup cancelled."));
            return;
          }
          selectedFormat = formatChoice as "react" | "vue" | "svelte";
        }
      } else {
        const formatChoice = await p.select({
          message: "Select output format:",
          options: [
            { value: "react", label: "React", hint: "React/Next.js/Remix" },
            { value: "vue", label: "Vue", hint: "Vue 3/Nuxt" },
            { value: "svelte", label: "Svelte", hint: "Svelte/SvelteKit" },
          ],
        });
        if (p.isCancel(formatChoice)) {
          p.outro(chalk.dim("Setup cancelled."));
          return;
        }
        selectedFormat = formatChoice as "react" | "vue" | "svelte";
      }

      // Step 2: Choose icon libraries
      const libraries = await p.multiselect({
        message: "Which icon libraries do you want to use?",
        options: ICON_SOURCES.map(([value, hint]) => ({ value, label: value, hint })),
        required: false,
      });

      if (p.isCancel(libraries)) {
        p.outro(chalk.dim("Setup cancelled."));
        return;
      }

      // Step 3: Set output directory
      const outputDir = await p.text({
        message: "Icon output directory:",
        placeholder: "./src/icons",
        defaultValue: "./src/icons",
      });

      if (p.isCancel(outputDir)) {
        p.outro(chalk.dim("Setup cancelled."));
        return;
      }

      // Step 4: Create starter bundle?
      const createStarter = await p.confirm({
        message: "Create a starter bundle with common icons?",
        initialValue: true,
      });

      if (p.isCancel(createStarter)) {
        p.outro(chalk.dim("Setup cancelled."));
        return;
      }

      const selectedLibraries = libraries as string[];

      // Build config. Component formats write a directory per bundle (one
      // file per icon); svg and json write one file.
      const outputFor = (name: string): string =>
        isIconFormat(selectedFormat) && COMPONENT_FORMATS.has(selectedFormat)
          ? `${outputDir}/${name}`
          : `${outputDir}/${name}.${isIconFormat(selectedFormat) ? FILE_EXTENSIONS[selectedFormat] : "tsx"}`;
      const bundles: BundleConfig[] = [];

      if (createStarter) {
        bundles.push({
          name: "common",
          icons: ["home", "settings", "user", "search", "menu", "x", "check", "arrow-right", "arrow-left"],
          ...(selectedLibraries[0] ? { source: selectedLibraries[0] } : {}),
          format: selectedFormat,
          output: outputFor("common"),
        });
      }

      // Add library-specific bundles if selected
      if (selectedLibraries.length > 0) {
        for (const lib of selectedLibraries) {
          bundles.push({
            name: lib,
            source: lib,
            format: selectedFormat,
            limit: 50,
            output: outputFor(lib),
          });
        }
      }

      const config: UniconConfig = {
        $schema: "https://unicon.sh/schema/uniconrc.json",
        bundles,
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      p.outro(chalk.green(`Created ${CONFIG_FILE}`));
      console.log();
      console.log(chalk.dim("Bundles configured:"));
      config.bundles.forEach((bundle) => {
        console.log(`  ${chalk.cyan(bundle.name)} → ${bundle.output}`);
      });
      console.log();
      console.log(chalk.dim(`Run ${chalk.white("unicon sync")} to generate bundles.`));
      return;
    }

    // Non-interactive mode
    const config = createDefaultConfig();
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    console.log(chalk.green(`✓ Created ${CONFIG_FILE}\n`));
    console.log(chalk.dim("Default bundles configured:"));
    config.bundles.forEach((bundle) => {
      console.log(`  ${chalk.cyan(bundle.name)} → ${bundle.output}`);
    });
    console.log(chalk.dim(`\nRun ${chalk.white("unicon sync")} to generate bundles.`));
  });

// Sync command
program
  .command("sync")
  .description("Generate all bundles from .uniconrc.json")
  .option("-n, --name <name>", "Sync only a specific bundle by name")
  .option("-d, --dry-run", "Show what would be generated without writing files")
  .option("-w, --watch", "Watch for config changes and re-sync automatically")
  .action(async (options) => {
    // Helper function to perform sync
    async function performSync(): Promise<{ success: number; error: number }> {
      const config = loadConfig();

      if (!config) {
        console.log(chalk.yellow(`No ${CONFIG_FILE} found. Run ${chalk.white("unicon init")} first.`));
        return { success: 0, error: 1 };
      }

      const bundlesToSync = options.name
        ? config.bundles.filter((b) => b.name === options.name)
        : config.bundles;

      if (bundlesToSync.length === 0) {
        if (options.name) {
          console.log(chalk.yellow(`Bundle "${options.name}" not found in config.`));
        } else {
          console.log(chalk.yellow("No bundles configured."));
        }
        return { success: 0, error: 1 };
      }

      console.log(chalk.bold(`Syncing ${bundlesToSync.length} bundle${bundlesToSync.length > 1 ? "s" : ""}...\n`));

      let successCount = 0;
      let errorCount = 0;

      for (const bundle of bundlesToSync) {
        const spinner = ora(`${bundle.name}: Fetching icons...`).start();

        try {
          const result = await syncBundle(bundle, { useCache: !options.watch, dryRun: options.dryRun });
          if ("skipped" in result) {
            spinner.warn(`${bundle.name}: Skipped (${result.skipped})`);
            // A listed icon that does not exist is a typo to fix, not an empty search.
            if (bundle.icons?.length) errorCount++;
            continue;
          }
          const verb = options.dryRun ? "would write" : "→";
          spinner.succeed(`${bundle.name}: ${chalk.green(result.count)} icons ${verb} ${chalk.cyan(result.written)}`);
          if (result.missing.length > 0) {
            console.log(chalk.red(`  Not found: ${result.missing.join(", ")}. Check the names with unicon search.`));
            errorCount++;
            continue;
          }

          successCount++;
        } catch (error) {
          spinner.fail(`${bundle.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
          errorCount++;
        }
      }

      return { success: successCount, error: errorCount };
    }

    // Watch mode
    if (options.watch) {
      const configPath = resolve(process.cwd(), CONFIG_FILE);

      if (!existsSync(configPath)) {
        console.log(chalk.yellow(`No ${CONFIG_FILE} found. Run ${chalk.white("unicon init")} first.`));
        process.exit(1);
      }

      console.log(chalk.cyan("Watch mode enabled. Press Ctrl+C to exit.\n"));

      // Initial sync
      await performSync();
      console.log();
      console.log(chalk.dim(`Watching ${CONFIG_FILE} for changes...`));

      // Watch for changes
      const watcher = watchConfig(configPath, async () => {
        console.log();
        console.log(chalk.cyan(`${CONFIG_FILE} changed, re-syncing...`));
        console.log();
        await performSync();
        console.log();
        console.log(chalk.dim(`Watching ${CONFIG_FILE} for changes...`));
      });

      // Keep process running
      process.on("SIGINT", () => {
        console.log();
        console.log(chalk.dim("Watch mode stopped."));
        watcher.close();
        process.exit(0);
      });

      // Prevent the process from exiting
      await new Promise(() => {});
      return;
    }

    // Normal sync
    const { success: successCount, error: errorCount } = await performSync();

    console.log();
    if (errorCount === 0) {
      console.log(chalk.green(`✓ All ${successCount} bundles synced successfully`));
    } else {
      console.log(chalk.yellow(`Completed with ${errorCount} error${errorCount > 1 ? "s" : ""}`));
      process.exitCode = 1;
    }
  });

// Add command - add a bundle to config
program
  .command("add <name>")
  .description("Add a new bundle to .uniconrc.json")
  .option("-i, --icons <icons>", "Exact icons, comma-separated: home,lucide:settings")
  .option("-q, --query <query>", "Search query")
  .option("-c, --category <category>", "Filter by category")
  .option("-s, --source <source>", "Filter by source")
  .option("-f, --format <format>", "Output format: react, vue, svelte, svg, json")
  .option("-l, --limit <number>", "Maximum icons from a search", "50")
  .option("-o, --output <path>", "Output directory or file")
  .action((name: string, options) => {
    let config = loadConfig();
    
    if (!config) {
      console.log(chalk.yellow(`No ${CONFIG_FILE} found. Creating one...`));
      config = { bundles: [] };
    }

    // Check for duplicate
    if (config.bundles.some((b) => b.name === name)) {
      console.log(chalk.yellow(`Bundle "${name}" already exists in config.`));
      process.exit(1);
    }

    if (!options.icons && !options.query && !options.category && !options.source) {
      console.log(chalk.yellow("Please provide at least one of: --icons, --query, --category, or --source"));
      process.exit(1);
    }

    const format = parseFormat(options.format) ?? getFormatForFramework(detectFramework().framework);
    // Vue and Svelte need a directory; React defaults to one too, so it is tree-shakeable.
    const defaultOutput = COMPONENT_FORMATS.has(format) ? `./src/icons/${name}` : `./src/icons/${name}.${FILE_EXTENSIONS[format]}`;
    const newBundle: BundleConfig = {
      name,
      output: options.output || defaultOutput,
      format,
    };

    if (options.icons) newBundle.icons = parseIconList(options.icons);
    if (options.query || options.category || !options.icons) newBundle.limit = parseInt(options.limit, 10);
    if (options.query) newBundle.query = options.query;
    if (options.category) newBundle.category = options.category;
    if (options.source) newBundle.source = options.source;

    config.bundles.push(newBundle);

    const configPath = resolve(process.cwd(), CONFIG_FILE);
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    console.log(chalk.green(`✓ Added bundle "${name}" to ${CONFIG_FILE}`));
    console.log(chalk.dim(`  Output: ${newBundle.output}`));
    console.log(chalk.dim(`\nRun ${chalk.white(`unicon sync --name ${name}`)} to generate.`));
  });

// Preview command - ASCII art preview of an icon
program
  .command("preview <name>")
  .description("Show ASCII art preview of an icon in the terminal")
  .option("-s, --source <source>", "Prefer source (lucide, phosphor, simple-icons, ...; see `unicon sources`)")
  .option("-w, --width <number>", "Preview width", "20")
  .option("-h, --height <number>", "Preview height", "20")
  .action(async (name: string, options) => {
    const spinner = ora("Fetching icon...").start();

    try {
      const { icons } = await fetchIcons({
        query: name,
        source: options.source,
        limit: 10,
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
      console.log(chalk.dim("─".repeat(width)));
      console.log(chalk.yellow(preview));
      console.log(chalk.dim("─".repeat(width)));
      console.log();
      console.log(chalk.dim(`Get: ${chalk.white(`unicon get ${icon.normalizedName}`)}`));
      console.log();
    } catch (error) {
      spinner.fail("Failed to fetch icon");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });

// Cache command - manage local cache
program
  .command("cache")
  .description("Manage local icon cache")
  .option("-c, --clear", "Clear all cached data")
  .option("-s, --stats", "Show cache statistics")
  .action((options) => {
    if (options.clear) {
      const { count, size } = clearCache();
      console.log(chalk.green(`✓ Cleared ${count} cached items (${(size / 1024).toFixed(1)} KB)`));
      return;
    }

    if (options.stats || (!options.clear && !options.stats)) {
      const { count, size, oldest } = getCacheStats();

      console.log(chalk.bold("Cache Statistics\n"));
      console.log(`  ${chalk.dim("Location:")} ${CACHE_DIR}`);
      console.log(`  ${chalk.dim("Items:")}    ${count}`);
      console.log(`  ${chalk.dim("Size:")}     ${(size / 1024).toFixed(1)} KB`);
      console.log(`  ${chalk.dim("TTL:")}      24 hours`);

      if (oldest) {
        const age = Math.round((Date.now() - oldest.getTime()) / 1000 / 60);
        console.log(`  ${chalk.dim("Oldest:")}   ${age} minutes ago`);
      }

      console.log();
      console.log(chalk.dim(`Clear with: ${chalk.white("unicon cache --clear")}`));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Skill Installation
// ─────────────────────────────────────────────────────────────────────────────

interface IDEConfig {
  name: string;
  dir: string;
  filename: string;
  description: string;
}

/**
 * The Unicon skill, bundled from `skills/unicon/` in the repository at build
 * time (tsup `--loader .md=text`), so `unicon skill` installs the same files
 * that the skills registry serves. Paths are relative to the skill directory.
 */
const UNICON_SKILL_FILES: ReadonlyArray<{ path: string; content: string }> = [
  { path: "SKILL.md", content: uniconSkillMd },
  { path: "references/cli-commands.md", content: uniconCliCommandsMd },
  { path: "references/config-file.md", content: uniconConfigFileMd },
  { path: "references/api-reference.md", content: uniconApiReferenceMd },
];

/** Print the installed skill files as a tree under a skill directory. */
function printSkillFileTree(indent: string): void {
  UNICON_SKILL_FILES.forEach((file, index) => {
    const branch = index === UNICON_SKILL_FILES.length - 1 ? "└──" : "├──";
    console.log(chalk.dim(`${indent}${branch} ${file.path}`));
  });
}

// Every assistant reads the open Agent Skills format: .<ide>/skills/unicon/SKILL.md
const IDE_CONFIGS: Record<string, IDEConfig> = {
  claude: {
    name: "Claude Code",
    dir: ".claude/skills/unicon",
    filename: "SKILL.md",
    description: "Claude Code (Anthropic CLI)",
  },
  codex: {
    name: "Codex",
    dir: ".codex/skills/unicon",
    filename: "SKILL.md",
    description: "OpenAI Codex CLI",
  },
  cursor: {
    name: "Cursor",
    dir: ".cursor/skills/unicon",
    filename: "SKILL.md",
    description: "Cursor IDE",
  },
  agents: {
    name: "Agents",
    dir: ".agents/skills/unicon",
    filename: "SKILL.md",
    description: "Generic .agents directory",
  },
  windsurf: {
    name: "Windsurf",
    dir: ".windsurf/skills/unicon",
    filename: "SKILL.md",
    description: "Windsurf (Codeium)",
  },
  opencode: {
    name: "OpenCode",
    dir: ".opencode/skills/unicon",
    filename: "SKILL.md",
    description: "OpenCode",
  },
  gemini: {
    name: "Gemini",
    dir: ".gemini/skills/unicon",
    filename: "SKILL.md",
    description: "Google Gemini CLI",
  },
};

function detectIDEs(): string[] {
  const detected: string[] = [];
  const cwd = process.cwd();

  for (const [key, config] of Object.entries(IDE_CONFIGS)) {
    // Check if the parent directory exists (e.g., .claude, .cursor)
    const parentDir = config.dir.split("/")[0];
    if (parentDir && existsSync(join(cwd, parentDir))) {
      detected.push(key);
    }
  }

  return detected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills Registry (fetch from public /skills/index.json)
// ─────────────────────────────────────────────────────────────────────────────

interface SkillRegistryEntry {
  id: string;
  name: string;
  description: string;
  file: string;
  tags: string[];
}

async function fetchSkillsIndex(): Promise<SkillRegistryEntry[]> {
  const res = await fetch(`${API_BASE}/skills/index.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch skills registry: ${res.status}`);
  }
  const data = (await res.json()) as { skills: SkillRegistryEntry[] };
  return data.skills;
}

async function fetchSkillContent(file: string): Promise<string> {
  const res = await fetch(`${API_BASE}/skills/${file}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch skill: ${res.status}`);
  }
  return res.text();
}

// Skills command - list and download from registry
program
  .command("skills")
  .description("List and download skills from the Unicon public registry")
  .option("-l, --list", "List available skills")
  .option("-g, --get <id>", "Download a skill by ID and print to stdout")
  .option("-o, --output <path>", "Write downloaded skill to file instead of stdout")
  .option("-j, --json", "Output list as JSON")
  .action(async (options) => {
    // Default to list if no flags provided
    const shouldList = options.list || (!options.get);

    if (shouldList && !options.get) {
      const spinner = ora("Fetching skills registry...").start();

      try {
        const skills = await fetchSkillsIndex();
        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(skills, null, 2));
          return;
        }

        console.log(chalk.bold(`\nAvailable Skills (${skills.length}):\n`));

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
          console.log(chalk.green(`✓ ${skill.name} → ${options.output}`));
        } else {
          // Output to stdout (pipe-friendly)
          console.log(content);
        }
      } catch (error) {
        spinner.fail("Failed to fetch skill");
        console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
        process.exit(1);
      }
    }
  });

// Skill install command (existing local installation)
program
  .command("skill")
  .description("Install Unicon skill/rules for AI coding assistants")
  .option("--ide <ide>", "Target IDE (claude, codex, cursor, agents, windsurf, opencode, gemini)")
  .option("--all", "Install for all supported IDEs")
  .option("-l, --list", "List supported IDEs")
  .option("-f, --force", "Overwrite existing skill files")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options) => {
    // List supported IDEs
    if (options.list) {
      console.log(chalk.bold("\nSupported AI Coding Assistants:\n"));
      for (const [key, config] of Object.entries(IDE_CONFIGS)) {
        console.log(`  ${chalk.green(key.padEnd(12))} ${chalk.dim(config.description)}`);
        console.log(`  ${" ".repeat(12)} ${chalk.dim(`→ ${config.dir}/`)}`);
        printSkillFileTree(`  ${" ".repeat(12)}   `);
      }
      console.log();
      console.log(chalk.dim(`Install with: ${chalk.white("npx @webrenew/unicon skill --ide <name>")}`));
      console.log(chalk.dim(`Install all:  ${chalk.white("npx @webrenew/unicon skill --all")}`));
      console.log();
      return;
    }

    const cwd = process.cwd();
    let targetIDEs: string[] = [];
    let needsConfirmation = false;

    // Install all
    if (options.all) {
      targetIDEs = Object.keys(IDE_CONFIGS);
      needsConfirmation = true;
    }
    // Specific IDE
    else if (options.ide) {
      const ide = options.ide.toLowerCase();
      if (!IDE_CONFIGS[ide]) {
        console.log(chalk.red(`Unknown IDE: ${options.ide}`));
        console.log(chalk.dim(`Supported: ${Object.keys(IDE_CONFIGS).join(", ")}`));
        process.exit(1);
      }
      targetIDEs = [ide];
      // Single explicit IDE doesn't need confirmation
    }
    // Auto-detect or prompt
    else {
      const detected = detectIDEs();
      if (detected.length > 0) {
        targetIDEs = detected;
        needsConfirmation = true; // Auto-detected needs confirmation
      } else {
        // Default to common ones if nothing detected
        console.log(chalk.yellow("No IDE configuration detected. Installing for Claude Code by default."));
        console.log(chalk.dim(`Use --ide <name> or --all for other targets.`));
        targetIDEs = ["claude"];
      }
    }

    // Show what will be installed and ask for confirmation
    if (needsConfirmation && !options.yes) {
      console.log(chalk.bold("\nThe following skill directories will be created:\n"));
      for (const ideKey of targetIDEs) {
        const config = IDE_CONFIGS[ideKey];
        if (!config) continue;
        const skillFile = join(cwd, config.dir, config.filename);
        const exists = existsSync(skillFile);
        if (exists && !options.force) {
          console.log(chalk.dim(`  ⊘ ${config.name.padEnd(14)} ${config.dir}/ (already exists)`));
        } else {
          console.log(`  ${chalk.green("+")} ${config.name.padEnd(14)} ${chalk.cyan(config.dir + "/")}`);
          printSkillFileTree(`    ${" ".repeat(14)} `);
        }
      }
      console.log();

      const confirmed = await confirm("Proceed with installation?");
      if (!confirmed) {
        console.log(chalk.yellow("\nInstallation cancelled."));
        return;
      }
    }

    console.log(chalk.bold(`\nInstalling Unicon skill...\n`));

    let installed = 0;
    let skipped = 0;

    for (const ideKey of targetIDEs) {
      const config = IDE_CONFIGS[ideKey];
      if (!config) continue;

      const targetDir = join(cwd, config.dir);
      const skillFile = join(targetDir, config.filename);

      // Check if skill file exists
      if (existsSync(skillFile) && !options.force) {
        console.log(chalk.yellow(`  ⊘ ${config.name}: Already exists (use --force to overwrite)`));
        skipped++;
        continue;
      }

      // Create directory and write files
      try {
        for (const file of UNICON_SKILL_FILES) {
          const filePath = join(targetDir, file.path);
          mkdirSync(dirname(filePath), { recursive: true });
          writeFileSync(filePath, file.content, "utf-8");
        }

        console.log(chalk.green(`  ✓ ${config.name}: ${config.dir}/`));
        printSkillFileTree("      ");
        installed++;
      } catch (error) {
        console.log(chalk.red(`  ✗ ${config.name}: ${error instanceof Error ? error.message : "Failed"}`));
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

// ─────────────────────────────────────────────────────────────────────────────
// Favorites Commands
// ─────────────────────────────────────────────────────────────────────────────

// Star command - Add to favorites
program
  .command("star <name>")
  .description("Add an icon to favorites")
  .option("-s, --source <source>", "Prefer source (lucide, phosphor, simple-icons, ...; see `unicon sources`)")
  .action(async (name: string, options) => {
    const spinner = ora("Finding icon...").start();

    try {
      const { icons } = await fetchIcons({
        query: name,
        source: options.source,
        limit: 10,
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
        console.log(chalk.green(`★ Added ${chalk.bold(icon.normalizedName)} to favorites`));
      } else {
        console.log(chalk.yellow(`${icon.normalizedName} is already in favorites`));
      }
    } catch (error) {
      spinner.fail("Failed to add favorite");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });

// Unstar command - Remove from favorites
program
  .command("unstar <name>")
  .description("Remove an icon from favorites")
  .action((name: string) => {
    const removed = removeFavorite(name);
    if (removed) {
      console.log(chalk.green(`☆ Removed ${chalk.bold(name)} from favorites`));
    } else {
      console.log(chalk.yellow(`${name} is not in favorites`));
    }
  });

// Stars command - List favorites
program
  .command("stars")
  .description("List all favorited icons")
  .option("-j, --json", "Output as JSON")
  .action((options) => {
    const data = loadFavorites();

    if (data.favorites.length === 0) {
      console.log(chalk.yellow("No favorites yet. Use 'unicon star <name>' to add icons."));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(data.favorites, null, 2));
      return;
    }

    console.log(chalk.bold(`\nFavorites (${data.favorites.length}):\n`));

    for (const fav of data.favorites) {
      const date = new Date(fav.addedAt).toLocaleDateString();
      console.log(`  ${chalk.yellow("★")} ${chalk.green(fav.name)} ${chalk.dim(`[${fav.sourceId}]`)} ${chalk.dim(date)}`);
    }

    console.log();
    console.log(chalk.dim(`Bundle all: ${chalk.white("unicon bundle --stars")}`));
    console.log(chalk.dim(`Remove:     ${chalk.white("unicon unstar <name>")}`));
    console.log();
  });

// ─────────────────────────────────────────────────────────────────────────────
// Quick Add to Bundle
// ─────────────────────────────────────────────────────────────────────────────

program
  .command("bundle:add <bundle> <icons...>")
  .description("Add exact icons (name or source:name) to a bundle in .uniconrc.json")
  .option("--sync", "Sync the bundle afterwards without asking")
  .action(async (bundleName: string, iconNames: string[], options: { sync?: boolean }) => {
    const config = loadConfig();

    if (!config) {
      console.log(chalk.yellow(`No ${CONFIG_FILE} found. Run ${chalk.white("unicon init")} first.`));
      process.exit(1);
    }

    const bundle = config.bundles.find(b => b.name === bundleName);

    if (!bundle) {
      console.log(chalk.yellow(`Bundle "${bundleName}" not found.`));
      console.log(chalk.dim(`Available bundles: ${config.bundles.map(b => b.name).join(", ")}`));
      process.exit(1);
    }

    // Append exact icons; keep any existing query as is
    const refs = iconNames.flatMap(parseIconList);
    bundle.icons = [...new Set([...(bundle.icons ?? []), ...refs])];

    // Save updated config
    const configPath = resolve(process.cwd(), CONFIG_FILE);
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    console.log(chalk.green(`✓ Added ${iconNames.length} icon(s) to bundle "${bundleName}"`));
    console.log(chalk.dim(`  Icons: ${bundle.icons.join(", ")}`));
    console.log();

    // Re-sync the bundle. Only ask when someone can answer.
    const shouldSync = options.sync || (process.stdin.isTTY ? await confirm("Sync bundle now?") : false);
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
      spinner.succeed(`${bundleName}: ${chalk.green(result.count)} icons → ${chalk.cyan(result.written)}`);
      if (result.missing.length > 0) console.log(chalk.yellow(`  Not found: ${result.missing.join(", ")}`));
    } catch (error) {
      spinner.fail(`${bundleName}: ${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Browse
// ─────────────────────────────────────────────────────────────────────────────

program
  .command("browse")
  .description("Interactive icon browser with fuzzy search")
  .option("-s, --source <source>", "Filter by source")
  .option("-c, --category <category>", "Filter by category")
  .action(async (options) => {
    console.log();
    p.intro(chalk.cyan("Unicon Browser"));

    // Get search query
    const query = await p.text({
      message: "Search icons:",
      placeholder: "e.g., arrow, dashboard, notification",
    });

    if (p.isCancel(query)) {
      p.outro(chalk.dim("Cancelled."));
      return;
    }

    const spinner = ora("Searching...").start();

    try {
      const { icons } = await fetchIcons({
        query: query as string,
        source: options.source,
        category: options.category,
        limit: 50,
      });

      spinner.stop();

      if (icons.length === 0) {
        p.outro(chalk.yellow("No icons found."));
        return;
      }

      // Multi-select icons
      const selected = await p.multiselect({
        message: `Found ${icons.length} icons. Select to continue:`,
        options: icons.map(icon => ({
          value: icon,
          label: icon.normalizedName,
          hint: `${icon.sourceId}${icon.category ? ` / ${icon.category}` : ""}`,
        })),
      });

      if (p.isCancel(selected)) {
        p.outro(chalk.dim("Cancelled."));
        return;
      }

      const selectedIcons = selected as Icon[];
      if (selectedIcons.length === 0) {
        p.outro(chalk.yellow("No icons selected."));
        return;
      }

      // Ask what to do
      const action = await p.select({
        message: `What would you like to do with ${selectedIcons.length} icon(s)?`,
        options: [
          { value: "copy", label: "Copy to clipboard", hint: "Copy as React components" },
          { value: "save", label: "Save to files", hint: "Write individual files" },
          { value: "star", label: "Add to favorites", hint: "Star for later use" },
          { value: "preview", label: "Preview ASCII", hint: "Show ASCII art previews" },
        ],
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
          p.outro(success
            ? chalk.green(`✓ ${selectedIcons.length} icon(s) copied to clipboard`)
            : chalk.red("Failed to copy to clipboard")
          );
          break;
        }
        case "save": {
          const outputPath = await p.text({
            message: "Output directory:",
            placeholder: "./src/icons",
            defaultValue: "./src/icons",
          });
          if (p.isCancel(outputPath)) {
            p.outro(chalk.dim("Cancelled."));
            return;
          }

          const outDir = resolve(process.cwd(), outputPath as string);
          mkdirSync(outDir, { recursive: true });

          writeGeneratedFiles(outDir, generateSplitFiles(selectedIcons, getFormatForFramework(detectFramework().framework)));
          p.outro(chalk.green(`✓ ${selectedIcons.length} icon(s) saved to ${outputPath}`));
          break;
        }
        case "star": {
          let added = 0;
          for (const icon of selectedIcons) {
            if (addFavorite(icon)) added++;
          }
          p.outro(chalk.green(`✓ Added ${added} icon(s) to favorites`));
          break;
        }
        case "preview": {
          console.log();
          for (const icon of selectedIcons) {
            console.log(chalk.bold.cyan(icon.normalizedName) + chalk.dim(` (${icon.sourceId})`));
            console.log(chalk.dim("─".repeat(20)));
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

// ─────────────────────────────────────────────────────────────────────────────
// Icon Comparison
// ─────────────────────────────────────────────────────────────────────────────

program
  .command("compare <concept>")
  .description("Compare the same icon concept across different libraries")
  .option("-w, --width <number>", "Preview width", "16")
  .option("-h, --height <number>", "Preview height", "10")
  .action(async (concept: string, options) => {
    const spinner = ora(`Finding "${concept}" across libraries...`).start();

    const sources = ["lucide", "phosphor", "heroicons", "tabler", "feather", "iconoir"];
    const results: { source: string; icon: Icon | null }[] = [];

    try {
      // Fetch from each source
      for (const source of sources) {
        try {
          const { icons } = await fetchIcons({
            query: concept,
            source,
            limit: 1,
          });

          const match = icons.find(i =>
            i.normalizedName.includes(concept.toLowerCase()) ||
            concept.toLowerCase().includes(i.normalizedName)
          ) || icons[0] || null;

          results.push({ source, icon: match });
        } catch {
          results.push({ source, icon: null });
        }
      }

      spinner.stop();

      console.log();
      console.log(chalk.bold(`Comparison: "${concept}"\n`));

      const width = parseInt(options.width, 10);
      const height = parseInt(options.height, 10);

      // Display side by side
      for (const { source, icon } of results) {
        if (!icon) {
          console.log(chalk.dim(`${source.padEnd(12)} - not found`));
          continue;
        }

        console.log(chalk.cyan(source.padEnd(12)) + chalk.green(icon.normalizedName));
        console.log(chalk.dim("─".repeat(width)));

        const preview = renderAsciiPreview(icon, width, height);
        const lines = preview.split("\n");
        for (const line of lines) {
          console.log(chalk.yellow(line));
        }

        console.log();
      }

      console.log(chalk.dim("Get an icon:"));
      results
        .filter(r => r.icon)
        .slice(0, 3)
        .forEach(r => {
          console.log(chalk.dim(`  unicon get ${r.icon!.normalizedName} --source ${r.source}`));
        });
      console.log();
    } catch (error) {
      spinner.fail("Comparison failed");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Usage Audit
// ─────────────────────────────────────────────────────────────────────────────

program
  .command("audit")
  .description("Audit project for icon usage vs bundled icons")
  .option("-j, --json", "Output as JSON")
  .option("-v, --verbose", "Show file locations for each icon")
  .action(async (options) => {
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

      // Summary
      console.log(chalk.dim("─".repeat(50)));
      console.log(`  ${chalk.cyan("Bundled:")}  ${result.bundled.length} icons in config`);
      console.log(`  ${chalk.green("Used:")}     ${result.used.length} icons found in code`);
      console.log(`  ${chalk.yellow("Unused:")}   ${result.unused.length} bundled but not imported`);
      console.log(`  ${chalk.red("Missing:")}  ${result.missing.length} imported but not bundled`);
      console.log(chalk.dim("─".repeat(50)));
      console.log();

      // Unused icons (bundled but not used)
      if (result.unused.length > 0) {
        console.log(chalk.yellow.bold(`Unused Icons (${result.unused.length}):`));
        console.log(chalk.dim("These icons are bundled but not imported in your code:\n"));
        for (const name of result.unused.slice(0, 20)) {
          console.log(`  ${chalk.yellow("○")} ${name}`);
        }
        if (result.unused.length > 20) {
          console.log(chalk.dim(`  ... and ${result.unused.length - 20} more`));
        }
        console.log();
      }

      // Missing icons (used but not bundled)
      if (result.missing.length > 0) {
        console.log(chalk.red.bold(`Missing Icons (${result.missing.length}):`));
        console.log(chalk.dim("These icons are imported but not in your bundles:\n"));
        for (const name of result.missing.slice(0, 20)) {
          const locations = result.usageLocations[name] || [];
          console.log(`  ${chalk.red("✗")} ${name}`);
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

        // Suggest adding missing icons
        if (result.missing.length > 0 && result.missing.length <= 10) {
          console.log(chalk.dim("Add missing icons:"));
          console.log(chalk.dim(`  unicon bundle --query "${result.missing.join(" ")}" -o ./src/icons/`));
          console.log();
        }
      }

      // Used icons (verbose mode)
      if (options.verbose && result.used.length > 0) {
        console.log(chalk.green.bold(`Used Icons (${result.used.length}):`));
        for (const name of result.used.slice(0, 30)) {
          const locations = result.usageLocations[name] || [];
          console.log(`  ${chalk.green("✓")} ${name} ${chalk.dim(`(${locations.length} file${locations.length > 1 ? "s" : ""})`)}`);
        }
        if (result.used.length > 30) {
          console.log(chalk.dim(`  ... and ${result.used.length - 30} more`));
        }
        console.log();
      }

      // Final verdict
      if (result.unused.length === 0 && result.missing.length === 0) {
        console.log(chalk.green("✓ All bundled icons are used and all used icons are bundled!"));
      } else if (result.missing.length > 0) {
        console.log(chalk.yellow("⚠ Some icons need attention. See above for details."));
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

// ─────────────────────────────────────────────────────────────────────────────
// Auth Commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .command("login")
  .description("Authenticate to access your saved bundles for free")
  .action(async () => {
    // Check if already logged in
    const existingAuth = loadAuth();
    if (existingAuth) {
      const shouldContinue = await confirm("You are already logged in. Do you want to re-authenticate?");
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

      // Try to open the browser
      const { exec } = await import("child_process");
      const openCommand = process.platform === "darwin" ? "open" :
                         process.platform === "win32" ? "start" : "xdg-open";
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

program
  .command("logout")
  .description("Log out and remove saved credentials")
  .action(async () => {
    const auth = loadAuth();
    if (!auth) {
      console.log(chalk.dim("Not logged in."));
      return;
    }

    clearAuth();
    console.log(chalk.green("Logged out successfully."));
  });

program
  .command("whoami")
  .description("Show current authentication status")
  .action(async () => {
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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        spinner.fail(data.message || "Invalid or expired token");
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

program
  .command("bundles")
  .description("List your saved bundles (requires login)")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          spinner.fail("Session expired");
          console.log();
          console.log(`Run ${chalk.cyan("unicon login")} to re-authenticate.`);
          process.exit(1);
        }
        if (res.status === 403) {
          spinner.fail(data.message || "Authentication failed");
          process.exit(1);
        }
        throw new Error(data.message || "Failed to fetch bundles");
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

program
  .command("bundle:pull <bundleId>")
  .description("Download a bundle to your project (requires login)")
  .option("-o, --output <path>", "Output file path", "src/components/icons/bundle.tsx")
  .option("-f, --format <format>", "Output format (react, svg, json)", "react")
  .action(async (bundleId: string, options) => {
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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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
        throw new Error(data.message || "Failed to fetch bundle");
      }

      const data = await res.json();
      spinner.stop();

      if (!data.code) {
        console.log(chalk.yellow("Bundle is empty - no icons to export."));
        return;
      }

      // Ensure output directory exists
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
