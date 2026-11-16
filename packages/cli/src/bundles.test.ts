// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { hasSelection, resolveBundleIcons, usesSearch, type IconFetchers } from "./bundles";

type TestIcon = { id: string };

function fetchers(exact: TestIcon[], missing: string[], searched: TestIcon[]) {
  return {
    byRefs: vi.fn<IconFetchers<TestIcon>["byRefs"]>(async () => ({ icons: exact, missing })),
    search: vi.fn<IconFetchers<TestIcon>["search"]>(async () => searched),
  };
}

describe("hasSelection", () => {
  it("should require icons, a query, a category, or a source", () => {
    expect(hasSelection({})).toBe(false);
    expect(hasSelection({ icons: [] })).toBe(false);
    expect(hasSelection({ icons: ["home"] })).toBe(true);
    expect(hasSelection({ source: "lucide" })).toBe(true);
  });
});

describe("usesSearch", () => {
  it("should treat source next to icons as the library for bare names, not a search", () => {
    expect(usesSearch({ icons: ["home"], source: "lucide" })).toBe(false);
    expect(usesSearch({ source: "lucide" })).toBe(true);
    expect(usesSearch({ icons: ["home"], query: "arrow" })).toBe(true);
  });
});

describe("resolveBundleIcons", () => {
  it("should look up exact icons without searching when only icons and source are set", async () => {
    const f = fetchers([{ id: "lucide:home" }], ["settigns"], []);
    const result = await resolveBundleIcons({ icons: ["home", "settigns"], source: "lucide" }, f);

    expect(result).toEqual({ icons: [{ id: "lucide:home" }], missing: ["settigns"] });
    expect(f.byRefs).toHaveBeenCalledWith(["home", "settigns"], "lucide");
    expect(f.search).not.toHaveBeenCalled();
  });

  it("should put exact icons first and add search results that are not duplicates", async () => {
    const f = fetchers([{ id: "lucide:home" }], [], [{ id: "lucide:home" }, { id: "lucide:arrow-up" }]);
    const result = await resolveBundleIcons({ icons: ["home"], query: "arrow", source: "lucide", limit: 5 }, f);

    expect(result.icons.map((icon) => icon.id)).toEqual(["lucide:home", "lucide:arrow-up"]);
    expect(f.search).toHaveBeenCalledWith({ query: "arrow", category: undefined, source: "lucide", limit: 5 });
  });

  it("should default the search limit to 100", async () => {
    const f = fetchers([], [], []);
    await resolveBundleIcons({ category: "Arrows" }, f);
    expect(f.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    expect(f.byRefs).not.toHaveBeenCalled();
  });
});
