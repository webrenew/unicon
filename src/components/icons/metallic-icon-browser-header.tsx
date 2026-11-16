"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchIcon } from "@/components/icons/ui/search";
import { Loader2Icon } from "@/components/icons/ui/loader-2";
import { SparklesIcon } from "@/components/icons/ui/sparkles";
import { SlidersHorizontalIcon } from "@/components/icons/ui/sliders-horizontal";
import { FilterIcon } from "@/components/icons/ui/filter";
import { CheckIcon } from "@/components/icons/ui/check";
import { ChevronsUpDownIcon } from "@/components/icons/ui/chevrons-up-down";
import { PackagePlusIcon } from "@/components/icons/ui/package-plus";
import { Trash2Icon } from "@/components/icons/ui/trash-2";
import { CopyIcon } from "@/components/icons/ui/copy";
import { CursorIcon } from "@/components/icons/ui/cursor";
import { V0Icon } from "@/components/icons/ui/v0";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SIZE_PRESETS, STROKE_PRESETS, type SizePreset, type StrokePreset } from "./styled-icon";
import type { IconLibrary } from "@/types/icon";

interface MetallicIconBrowserHeaderProps {
  totalCount: number;
  countBySource: Record<string, number>;
  search: string;
  hasDebouncedSearch: boolean;
  onSearchChange: (value: string) => void;
  /** Called when the search input gains focus, to preload local search. */
  onSearchFocus?: (() => void) | undefined;
  isLoading: boolean;
  searchType: string;
  expandedQuery: string | null;
  selectedSource: IconLibrary | "all";
  onSelectSource: (source: IconLibrary | "all") => void;
  selectedCategory: string | "all";
  onSelectCategory: (category: string | "all") => void;
  categories: string[];
  categoryOpen: boolean;
  onCategoryOpenChange: (isOpen: boolean) => void;
  filtersExpanded: boolean;
  onFiltersExpandedChange: (expanded: boolean) => void;
  controlsExpanded: boolean;
  onControlsExpandedChange: (expanded: boolean) => void;
  sizePreset: SizePreset;
  onSizePresetChange: (preset: SizePreset) => void;
  strokePreset: StrokePreset;
  onStrokePresetChange: (preset: StrokePreset) => void;
  cartCount: number;
  onClearCart: () => void;
  canBundleAll: boolean;
  iconsNotInBundleCount: number;
  onBundleAll: () => void;
  hoveredSource?: string | null;
}

const SOURCE_COLORS: Record<string, string> = {
  lucide: "bg-orange-500",
  phosphor: "bg-emerald-500",
  hugeicons: "bg-violet-500",
  heroicons: "bg-blue-500",
  tabler: "bg-cyan-500",
  feather: "bg-pink-500",
  remix: "bg-red-500",
  "simple-icons": "bg-gray-500",
  iconoir: "bg-teal-500",
};

const SOURCE_COLORS_SELECTED: Record<string, string> = {
  lucide: "bg-orange-500/69",
  phosphor: "bg-emerald-500/69",
  hugeicons: "bg-violet-500/69",
  heroicons: "bg-blue-500/69",
  tabler: "bg-cyan-500/69",
  feather: "bg-pink-500/69",
  remix: "bg-red-500/69",
  "simple-icons": "bg-gray-500/69",
  iconoir: "bg-teal-500/69",
};

const SOURCE_COLORS_HOVER: Record<string, string> = {
  lucide: "bg-orange-500/30",
  phosphor: "bg-emerald-500/30",
  hugeicons: "bg-violet-500/30",
  heroicons: "bg-blue-500/30",
  tabler: "bg-cyan-500/30",
  feather: "bg-pink-500/30",
  remix: "bg-red-500/30",
  "simple-icons": "bg-gray-500/30",
  iconoir: "bg-teal-500/30",
};

const SOURCE_OPTIONS = [
  "all",
  "lucide",
  "phosphor",
  "hugeicons",
  "heroicons",
  "tabler",
  "feather",
  "remix",
  "simple-icons",
  "iconoir",
] as const;

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const SKILL_COMMAND = "npx @webrenew/unicon";

// Cursor MCP deeplink - base64 encoded config
// See: https://cursor.com/docs/context/mcp/install-links
const MCP_CONFIG = { url: "https://unicon.sh/api/mcp" };
const CURSOR_CONFIG_BASE64 = typeof window !== "undefined"
  ? btoa(JSON.stringify(MCP_CONFIG))
  : Buffer.from(JSON.stringify(MCP_CONFIG)).toString("base64");
const CURSOR_INSTALL_URL = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
  "unicon",
)}&config=${CURSOR_CONFIG_BASE64}`;

const SSE_ENDPOINT = MCP_CONFIG.url;

function TypingTerminal() {
  const [charIndex, setCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);

  const isComplete = charIndex >= SKILL_COMMAND.length;
  const displayedText = SKILL_COMMAND.slice(0, charIndex);

  useEffect(() => {
    // Delay before starting to type (after terminal fades in)
    const startDelay = setTimeout(() => {
      setIsTyping(true);
    }, 900);

    return () => clearTimeout(startDelay);
  }, []);

  useEffect(() => {
    if (!isTyping || isComplete) return;

    const timeout = setTimeout(() => {
      setCharIndex((prev) => prev + 1);
    }, 50);

    return () => clearTimeout(timeout);
  }, [isTyping, isComplete, charIndex]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SKILL_COMMAND);
      setCopied(true);
      toast.success("Command copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  return (
    <button
      onClick={handleCopy}
      aria-label={`Copy command: ${SKILL_COMMAND}`}
      className="hero-anim-up group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg bg-muted/30 border border-border font-mono text-sm text-left hover:border-[var(--accent-lavender)]/50 transition-colors w-full max-w-[40rem] overflow-hidden"
      style={{ animationDelay: "0.6s", animationDuration: "0.5s" }}
    >
      <span className="text-[var(--accent-mint)] select-none shrink-0">$</span>
      <span className="text-foreground/90 truncate">
        {displayedText}
        <span
          className={`inline-block w-[2px] h-[1.1em] bg-foreground/80 ml-[1px] align-middle ${isComplete ? "animate-blink" : ""}`}
          style={{
            animation: isComplete ? "blink 1s step-end infinite" : "none",
          }}
        />
      </span>
      <span className={`ml-auto shrink-0 transition-colors ${copied ? "text-[var(--accent-mint)]" : "text-muted-foreground group-hover:text-foreground/70"}`}>
        {copied ? (
          <CheckIcon className="w-4 h-4" />
        ) : (
          <CopyIcon className="w-4 h-4" />
        )}
      </span>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </button>
  );
}

function V0SSEButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SSE_ENDPOINT);
      setCopied(true);
      toast.success("SSE endpoint copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  return (
    <button
      onClick={handleCopy}
      className="hero-anim-up group flex items-center gap-3 px-4 py-2.5 rounded-lg bg-foreground/5 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/10 transition-colors text-sm"
      style={{ animationDelay: "0.8s", animationDuration: "0.5s" }}
    >
      <V0Icon className="w-5 h-5 text-foreground" />
      <span className="text-black/80 dark:text-white/80 font-medium">
        {copied ? "Copied!" : "Add to v0"}
      </span>
      <span className="text-black/40 dark:text-white/40 text-xs hidden sm:inline">MCP</span>
    </button>
  );
}

export function MetallicIconBrowserHeader({
  totalCount,
  countBySource,
  search,
  hasDebouncedSearch,
  onSearchChange,
  onSearchFocus,
  isLoading,
  searchType,
  expandedQuery,
  selectedSource,
  onSelectSource,
  selectedCategory,
  onSelectCategory,
  categories,
  categoryOpen,
  onCategoryOpenChange,
  filtersExpanded,
  onFiltersExpandedChange,
  controlsExpanded,
  onControlsExpandedChange,
  sizePreset,
  onSizePresetChange,
  strokePreset,
  onStrokePresetChange,
  cartCount,
  onClearCart,
  canBundleAll,
  iconsNotInBundleCount,
  onBundleAll,
  hoveredSource,
}: MetallicIconBrowserHeaderProps) {
  return (
    <>
      <style>{`
        @keyframes hero-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-fade-right {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .hero-anim-up {
          opacity: 0;
          animation-name: hero-fade-up;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
        .hero-anim-right {
          opacity: 0;
          animation-name: hero-fade-right;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
      `}</style>
      <h1
        className="hero-anim-right font-sans font-semibold text-3xl md:text-4xl lg:text-5xl mb-4 text-balance tracking-tighter leading-tight pt-8 md:pt-0 text-black dark:text-white"
        style={{ animationDuration: "0.6s" }}
      >
        Just the icons you need. Zero bloat.
      </h1>
      <p
        className="hero-anim-up text-black/60 dark:text-white/60 text-sm md:text-base max-w-xl mb-4"
        style={{ animationDuration: "0.6s", animationDelay: "0.3s" }}
      >
        Pick icons from popular libraries, preview styles, copy the code. Like shadcn, but for
        icons.
      </p>

      {/* Hero CTAs */}
      <div className="flex flex-col gap-3 mb-10 pb-8 border-b border-border">
        <TypingTerminal />
        {/* Second row: Cursor + v0 */}
        <div className="flex flex-row gap-3">
          {/* Cursor MCP Install Button */}
          <a
            href={CURSOR_INSTALL_URL}
            className="hero-anim-up group flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--accent-aqua)]/10 border border-[var(--accent-aqua)]/30 hover:border-[var(--accent-aqua)]/60 hover:bg-[var(--accent-aqua)]/20 transition-colors text-sm"
            style={{ animationDelay: "0.7s", animationDuration: "0.5s" }}
          >
            <CursorIcon className="w-5 h-5 text-[var(--accent-aqua)]" />
            <span className="text-black/80 dark:text-white/80 font-medium">Add to Cursor</span>
            <span className="text-black/40 dark:text-white/40 text-xs hidden sm:inline">MCP</span>
          </a>

          {/* v0 SSE Button */}
          <V0SSEButton />
        </div>
      </div>

      {/* Stats - Interactive Library Filters */}
      <div className="hidden md:flex flex-wrap items-center gap-2 text-xs mb-8">
        <button
          onClick={() => onSelectSource("all")}
          aria-label="Show all libraries"
          aria-pressed={selectedSource === "all"}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-[background-color,border-color,color,transform] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 ${
            selectedSource === "all"
              ? "bg-black/90 dark:bg-white/90 text-white dark:text-black border-2 border-black dark:border-white"
              : "bg-transparent border-2 border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:border-black/20 dark:hover:border-white/20 hover:text-black/80 dark:hover:text-white/80"
          }`}
        >
          <span className="font-medium">All Libraries</span>
          <span className="opacity-70">• {totalCount.toLocaleString("en-US")}</span>
        </button>
        {Object.entries(countBySource).map(([source, count]) => (
          <button
            key={source}
            onClick={() => onSelectSource(source as IconLibrary)}
            aria-label={`Filter by ${source} library`}
            aria-pressed={selectedSource === source}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 ${
              selectedSource === source
                ? `${SOURCE_COLORS_SELECTED[source]} text-white border-2 border-current shadow-sm`
                : hoveredSource === source
                  ? `${SOURCE_COLORS_HOVER[source]} border-2 border-black/20 dark:border-white/20 text-black/80 dark:text-white/80 shadow-sm`
                  : "bg-transparent border-2 border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:border-black/20 dark:hover:border-white/20 hover:text-black/80 dark:hover:text-white/80"
            }`}
          >
            <span className={`w-2 h-2 rounded-full transition-colors duration-300 ease-out ${selectedSource === source ? "bg-white" : SOURCE_COLORS[source]}`} />
            <span className="capitalize font-medium">{source}</span>
            <span className={selectedSource === source ? "opacity-90" : "opacity-70"}>
              {count?.toLocaleString("en-US")}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 w-full max-w-[40rem]">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40 z-10" />
        <label htmlFor="icon-search-main" className="sr-only">
          Search icons
        </label>

        {/* Gradient border wrapper - gradient grows on focus */}
        <div className="search-gradient-border rounded-lg p-[1px]">
          <input
            id="icon-search-main"
            type="text"
            placeholder="Try 'business icons' or 'celebration'…"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={onSearchFocus}
            className="w-full bg-white dark:bg-[hsl(0,0%,3%)] rounded-lg pl-10 pr-12 py-2.5 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 text-sm focus:outline-none focus:ring-0 focus:bg-gray-50 dark:focus:bg-[hsl(0,0%,5%)] transition-colors duration-500"
            autoComplete="off"
          />
        </div>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
          {isLoading && search && (
            <Loader2Icon className="w-4 h-4 text-black/40 dark:text-white/40 animate-spin" />
          )}
          {!isLoading && search && searchType === "semantic" && (
            <span title="AI-powered search" aria-hidden="true">
              <SparklesIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            </span>
          )}
        </div>
      </div>

      {/* AI Search Feedback */}
      {expandedQuery && hasDebouncedSearch && (
        <div className="mb-6 flex items-start gap-2 text-xs text-black/40 dark:text-white/40">
          <SparklesIcon className="w-3 h-3 text-purple-500 dark:text-purple-400 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            AI expanded to: <span className="text-black/60 dark:text-white/60">{expandedQuery}</span>
          </span>
        </div>
      )}

      {/* Filters & Controls */}
      <div className="flex flex-col gap-3 mb-8">
        {/* Row 1: Filters (collapsible) */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filters toggle button */}
            <button
              onClick={() => onFiltersExpandedChange(!filtersExpanded)}
              aria-expanded={filtersExpanded}
              className="flex items-center gap-1.5 text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 transition-colors"
            >
              <FilterIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-[10px] font-mono uppercase tracking-wider">
                Filters
              </span>
              <svg
                className={`w-3 h-3 transition-transform ${filtersExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {/* Show active filter count */}
              {(selectedSource !== "all" || selectedCategory !== "all") && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-black/10 dark:bg-white/10 rounded">
                  {(selectedSource !== "all" ? 1 : 0) + (selectedCategory !== "all" ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Filters content - visible when expanded */}
            {filtersExpanded && (
              <>
                {/* Library */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-black/50 dark:text-white/50 uppercase tracking-wider">
                    Library
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCE_OPTIONS.map((source) => (
                      <button
                        key={source}
                        onClick={() => onSelectSource(source)}
                        className={`px-2.5 py-1 rounded-full text-xs font-mono transition-all ${selectedSource === source
                          ? "bg-black/20 dark:bg-white/20 text-black dark:text-white"
                          : "bg-black/5 dark:bg-white/5 text-black/50 dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black/70 dark:hover:text-white/70"
                          }`}
                      >
                        {source === "all" ? "All" : source}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="hidden sm:block w-px h-5 bg-black/10 dark:bg-white/10" />

                {/* Category Combobox */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-black/50 dark:text-white/50 uppercase tracking-wider">
                    Category
                  </span>
                  <Popover open={categoryOpen} onOpenChange={onCategoryOpenChange}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={categoryOpen}
                        aria-controls="category-listbox"
                        className="flex h-7 items-center justify-between gap-2 rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 text-xs font-mono text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 transition-colors min-w-[140px]"
                      >
                        {selectedCategory === "all"
                          ? "All Categories"
                          : toTitleCase(selectedCategory)}
                        <ChevronsUpDownIcon className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search categories..." className="text-xs" />
                        <CommandList id="category-listbox">
                          <CommandEmpty>No category found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                onSelectCategory("all");
                                onCategoryOpenChange(false);
                              }}
                              className="text-xs font-mono"
                            >
                              <CheckIcon
                                className={`mr-2 h-3 w-3 ${selectedCategory === "all" ? "opacity-100" : "opacity-0"}`}
                              />
                              All Categories
                            </CommandItem>
                            {categories.map((cat) => (
                              <CommandItem
                                key={cat}
                                value={cat}
                                onSelect={() => {
                                  onSelectCategory(cat);
                                  onCategoryOpenChange(false);
                                }}
                                className="text-xs font-mono"
                              >
                                <CheckIcon
                                  className={`mr-2 h-3 w-3 ${selectedCategory === cat ? "opacity-100" : "opacity-0"}`}
                                />
                                {toTitleCase(cat)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>

          {/* Clear Bundle Button - visible when bundle has items and filters expanded - positioned on the right */}
          {filtersExpanded && cartCount > 0 && (
            <button
              onClick={onClearCart}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              Clear Bundle ({cartCount})
            </button>
          )}
        </div>

        {/* Actions when panel collapsed */}
        {!filtersExpanded && cartCount > 0 && (
          <div className="flex items-center justify-between gap-3 -mt-2 mb-2">
            {/* Clear Bundle action - positioned on the right */}
            <button
              onClick={onClearCart}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all ml-auto"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              Clear Bundle ({cartCount} icons)
            </button>
          </div>
        )}

        {/* Row 2: Display Controls (collapsible) */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-black/5 dark:border-white/5">
          {/* Controls toggle button */}
          <button
            onClick={() => onControlsExpandedChange(!controlsExpanded)}
            aria-expanded={controlsExpanded}
            className="flex items-center gap-1.5 text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 transition-colors"
          >
            <SlidersHorizontalIcon className={`w-3.5 h-3.5 transition-transform ${controlsExpanded ? "rotate-90" : ""}`} aria-hidden="true" />
            <span className="text-[10px] font-mono uppercase tracking-wider">
              Controls
            </span>
            <svg
              className={`w-3 h-3 transition-transform ${controlsExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Controls content - visible when expanded */}
          {controlsExpanded && (
            <>
              {/* Size Presets */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-black/50 dark:text-white/50 uppercase tracking-wider">
                  Size
                </span>
                <div className="flex rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onSizePresetChange(preset)}
                      title={SIZE_PRESETS[preset].px}
                      className={`relative px-2.5 py-1.5 text-xs font-mono transition-all ${sizePreset === preset
                        ? "bg-black dark:bg-white text-white dark:text-black"
                        : "text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                    >
                      {SIZE_PRESETS[preset].label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-mono text-black/50 dark:text-white/50">
                  {SIZE_PRESETS[sizePreset].px}
                </span>
              </div>

              {/* Separator */}
              <div className="hidden sm:block w-px h-5 bg-black/10 dark:bg-white/10" />

              {/* Stroke Weight Presets */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-black/50 dark:text-white/50 uppercase tracking-wider">
                  Weight
                </span>
                <div className="flex rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  {(Object.keys(STROKE_PRESETS) as StrokePreset[]).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onStrokePresetChange(preset)}
                      className={`relative px-3 py-1.5 text-xs font-mono transition-all ${strokePreset === preset
                        ? "bg-black dark:bg-white text-white dark:text-black"
                        : "text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                    >
                      {/* Visual stroke indicator */}
                      <span className="flex items-center gap-1.5">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={STROKE_PRESETS[preset].value * 1.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-70 hidden sm:block"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {STROKE_PRESETS[preset].label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bundle All Button - shown when there are icons to bundle */}
              {canBundleAll && (
                <>
                  <div className="hidden sm:block w-px h-5 bg-black/10 dark:bg-white/10" />
                  <button
                    onClick={onBundleAll}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--accent-mint)]/30 dark:bg-[var(--accent-mint)]/20 text-black/80 dark:text-[var(--accent-mint)] hover:bg-[var(--accent-mint)]/40 dark:hover:bg-[var(--accent-mint)]/30 border-2 border-[var(--accent-mint)]/50 dark:border-[var(--accent-mint)]/30 transition-all"
                  >
                    <PackagePlusIcon className="w-3.5 h-3.5" />
                    Bundle All on Page ({iconsNotInBundleCount})
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
