import { describe, expect, it } from "vitest";
import { createIconSearchEntry, createIconSearchIndex, searchIconIndex } from "./icon-search";
import type { IconData } from "@/types/icon";

function makeIcon(overrides: Partial<IconData> & Pick<IconData, "id">): IconData {
  const normalizedName = overrides.normalizedName ?? overrides.id.split(":")[1] ?? overrides.id;
  return {
    name: normalizedName,
    normalizedName,
    sourceId: overrides.id.split(":")[0] ?? "lucide",
    category: null,
    tags: [],
    viewBox: "0 0 24 24",
    content: "",
    pathData: null,
    defaultStroke: false,
    defaultFill: false,
    strokeWidth: null,
    brandColor: null,
    ...overrides,
  };
}

const index = createIconSearchIndex([
  createIconSearchEntry(makeIcon({ id: "tabler:settings", category: "system" })),
  createIconSearchEntry(makeIcon({ id: "lucide:arrow-left", category: "arrows" }), '["direction", "back"]'),
  createIconSearchEntry(makeIcon({ id: "phosphor:arrow-left", name: "ArrowLeft" })),
  createIconSearchEntry(makeIcon({ id: "lucide:check", tags: ["done", "tick"] })),
  createIconSearchEntry(makeIcon({ id: "heroicons:home", name: "HomeModern" })),
  createIconSearchEntry(makeIcon({ id: "lucide:zap", tags: ["lightning"] })),
]);

const ids = (query: string, extra: Partial<Parameters<typeof searchIconIndex>[1]> = {}) =>
  searchIconIndex(index, { query, limit: 50, offset: 0, ...extra }).icons.map((icon) => icon.id);

describe("searchIconIndex", () => {
  it("should order matches by normalized name, then id", () => {
    expect(ids("arrow")).toEqual(["lucide:arrow-left", "phosphor:arrow-left"]);
  });

  it("should match names, normalized names and raw tags case-insensitively", () => {
    expect(ids("homemodern")).toEqual(["heroicons:home"]);
    expect(ids("DIRECTION")).toEqual(["lucide:arrow-left"]);
    expect(ids("lightning")).toEqual(["lucide:zap"]);
  });

  it("should match against the raw JSON tags string like SQL LIKE does", () => {
    expect(ids('direction", "back')).toEqual(["lucide:arrow-left"]);
  });

  it("should expand aliases", () => {
    expect(ids("checkmark")).toEqual(["lucide:check"]);
    expect(ids("cog")).toEqual(["tabler:settings"]);
  });

  it("should treat % and _ as LIKE wildcards", () => {
    expect(ids("arrow_left")).toEqual(["lucide:arrow-left", "phosphor:arrow-left"]);
    expect(ids("a%left")).toEqual(["lucide:arrow-left", "phosphor:arrow-left"]);
  });

  it("should not treat regex characters as patterns", () => {
    expect(ids("arrow.left")).toEqual([]);
    expect(ids("(")).toEqual([]);
  });

  it("should apply source and category filters", () => {
    expect(ids("arrow", { sourceId: "phosphor" })).toEqual(["phosphor:arrow-left"]);
    expect(ids("", { category: "system" })).toEqual(["tabler:settings"]);
  });

  it("should return every icon for a blank query", () => {
    expect(searchIconIndex(index, { query: "   ", limit: 50, offset: 0 }).total).toBe(6);
  });

  it("should paginate and report total and hasMore", () => {
    const first = searchIconIndex(index, { limit: 4, offset: 0 });
    const second = searchIconIndex(index, { limit: 4, offset: 4 });

    expect(first).toMatchObject({ total: 6, hasMore: true });
    expect(first.icons).toHaveLength(4);
    expect(second).toMatchObject({ total: 6, hasMore: false });
    expect(first.icons.map((icon) => icon.id)).toEqual([
      "lucide:arrow-left",
      "phosphor:arrow-left",
      "lucide:check",
      "heroicons:home",
    ]);
    expect(second.icons.map((icon) => icon.id)).toEqual(["tabler:settings", "lucide:zap"]);
  });

  it("should deduplicate entries by id", () => {
    const duplicated = createIconSearchIndex([
      createIconSearchEntry(makeIcon({ id: "lucide:zap" })),
      createIconSearchEntry(makeIcon({ id: "lucide:zap" })),
    ]);
    expect(duplicated.entries).toHaveLength(1);
  });
});
