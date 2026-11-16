import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iconSearchCache } from "@/lib/search-cache";
import { getLoadedIconCorpus, loadIconCorpus, shouldLoadIconCorpus } from "@/lib/icon-corpus";
import { createIconSearchEntry, createIconSearchIndex, type IconSearchIndex } from "@/lib/icon-search";
import type { IconData } from "@/types/icon";
import { useIconBrowser } from "./use-icon-browser";

vi.mock("@/lib/icon-corpus", () => ({
  getLoadedIconCorpus: vi.fn(() => null),
  loadIconCorpus: vi.fn(() => new Promise(() => {})),
  shouldLoadIconCorpus: vi.fn(() => false),
}));

function makeIcon(id: string, sourceId: string): IconData {
  return {
    id,
    name: id,
    normalizedName: id,
    sourceId,
    category: null,
    tags: [],
    viewBox: "0 0 24 24",
    content: "",
    pathData: null,
    defaultStroke: false,
    defaultFill: false,
    strokeWidth: null,
    brandColor: null,
  };
}

interface PendingRequest {
  url: string;
  resolve: (
    icons: IconData[],
    metadata?: { hasMore?: boolean; total?: number },
  ) => void;
  reject: (error: unknown) => void;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("useIconBrowser request sequencing", () => {
  let pending: PendingRequest[];

  beforeEach(() => {
    iconSearchCache.clear();
    pending = [];
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.toString();
      return new Promise<Response>((resolveResponse, rejectResponse) => {
        pending.push({
          url,
          resolve: (icons, metadata = {}) =>
            resolveResponse(
              new Response(
                JSON.stringify({
                  icons,
                  searchType: "text",
                  hasMore: metadata.hasMore ?? false,
                  ...(metadata.total === undefined ? {} : { total: metadata.total }),
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            ),
          reject: rejectResponse,
        });
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    iconSearchCache.clear();
  });

  it("does not download the corpus when the browser opts out", async () => {
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSearch("arrow");
    });

    await waitFor(() => expect(pending).toHaveLength(1));
    expect(loadIconCorpus).not.toHaveBeenCalled();
  });

  it("uses the server-rendered first page without a duplicate fetch", async () => {
    const initialIcons = [makeIcon("lucide-a", "lucide"), makeIcon("tabler-b", "tabler")];

    const { result, rerender } = renderHook(
      ({ icons, totalCount }) => useIconBrowser({ initialIcons: icons, totalCount }),
      {
        initialProps: { icons: initialIcons, totalCount: initialIcons.length },
      },
    );

    expect(result.current.icons.map((icon) => icon.id)).toEqual(["lucide-a", "tabler-b"]);

    await act(async () => {
      await tick();
    });

    rerender({ icons: [...initialIcons], totalCount: initialIcons.length });

    await act(async () => {
      await tick();
    });

    expect(result.current.icons.map((icon) => icon.id)).toEqual(["lucide-a", "tabler-b"]);
    expect(pending).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("requests fast text mode for typed searches", async () => {
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSearch("arrow");
    });

    await waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0]!.url).toContain("q=arrow");
    expect(pending[0]!.url).toContain("ai=false");

    await act(async () => {
      pending[0]!.resolve([makeIcon("arrow", "lucide")]);
    });
  });

  it("uses the filtered result total to keep pagination enabled after a zero-result state", async () => {
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSelectedSource("tabler");
    });
    await waitFor(() => expect(pending).toHaveLength(1));

    const firstPage = Array.from({ length: 160 }, (_, index) =>
      makeIcon(`tabler-${index}`, "tabler"),
    );
    await act(async () => {
      pending[0]!.resolve(firstPage, { hasMore: true, total: 4_985 });
    });

    await waitFor(() => expect(result.current.totalResults).toBe(4_985));
    expect(result.current.totalPages).toBe(32);

    act(() => {
      result.current.goToPage(1);
    });
    expect(result.current.page).toBe(1);
  });

  it("ignores a stale filtered response that resolves after a newer filtered one", async () => {
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSelectedSource("remix");
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    const staleRequest = pending[0]!;
    expect(staleRequest.url).toContain("source=remix");

    await act(async () => {
      result.current.setSelectedSource("lucide");
    });
    await waitFor(() => expect(pending).toHaveLength(2));
    const lucideRequest = pending[1]!;
    expect(lucideRequest.url).toContain("source=lucide");

    // The newer (filtered) request resolves first.
    await act(async () => {
      lucideRequest.resolve([makeIcon("lucide-a", "lucide"), makeIcon("lucide-b", "lucide")]);
    });
    await waitFor(() =>
      expect(result.current.icons.map((icon) => icon.id)).toEqual(["lucide-a", "lucide-b"]),
    );

    // The older filtered request resolves afterwards — it must not clobber state.
    await act(async () => {
      staleRequest.resolve([makeIcon("remix-x", "remix"), makeIcon("remix-y", "remix")]);
      await tick();
    });

    expect(result.current.icons.map((icon) => icon.id)).toEqual(["lucide-a", "lucide-b"]);
    expect(result.current.icons.every((icon) => icon.sourceId === "lucide")).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("swallows AbortError from a superseded request and applies the current one", async () => {
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSelectedSource("remix");
    });
    await waitFor(() => expect(pending).toHaveLength(1));

    await act(async () => {
      result.current.setSelectedSource("lucide");
    });
    await waitFor(() => expect(pending).toHaveLength(2));

    // The superseded first request rejects with an AbortError (as a real abort would).
    await act(async () => {
      pending[0]!.reject(new DOMException("Aborted", "AbortError"));
      await tick();
    });

    // The current request still resolves and updates state normally.
    await act(async () => {
      pending[1]!.resolve([makeIcon("lucide-a", "lucide")]);
    });
    await waitFor(() => expect(result.current.icons.map((icon) => icon.id)).toEqual(["lucide-a"]));
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useIconBrowser local corpus search", () => {
  let corpus: IconSearchIndex;

  beforeEach(() => {
    iconSearchCache.clear();
    corpus = createIconSearchIndex([
      createIconSearchEntry(makeIcon("lucide:arrow-left", "lucide")),
      createIconSearchEntry(makeIcon("tabler:arrow-right", "tabler")),
      createIconSearchEntry(makeIcon("lucide:house", "lucide")),
      ...Array.from({ length: 170 }, (_, index) =>
        createIconSearchEntry(makeIcon(`tabler:shape-${String(index).padStart(3, "0")}`, "tabler")),
      ),
    ]);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network should not be used"));
  });

  afterEach(() => {
    vi.mocked(getLoadedIconCorpus).mockReset().mockReturnValue(null);
    vi.mocked(loadIconCorpus).mockReset().mockImplementation(() => new Promise(() => {}));
    vi.mocked(shouldLoadIconCorpus).mockReset().mockReturnValue(false);
    vi.restoreAllMocks();
  });

  it("should start loading the corpus when the search input is focused", () => {
    vi.mocked(shouldLoadIconCorpus).mockReturnValue(true);
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    act(() => {
      result.current.warmSearch();
      result.current.warmSearch();
    });

    expect(loadIconCorpus).toHaveBeenCalledTimes(1);
  });

  it("should answer searches from the loaded corpus without a network request", async () => {
    vi.mocked(getLoadedIconCorpus).mockReturnValue(corpus);
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSearch("arrow");
      await tick();
    });

    await waitFor(() =>
      expect(result.current.icons.map((icon) => icon.id)).toEqual([
        "lucide:arrow-left",
        "tabler:arrow-right",
      ]),
    );
    expect(result.current.totalResults).toBe(2);
    expect(result.current.isLoading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should filter and paginate locally when the corpus is loaded", async () => {
    vi.mocked(getLoadedIconCorpus).mockReturnValue(corpus);
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSelectedSource("tabler");
    });
    await waitFor(() => expect(result.current.totalResults).toBe(171));
    expect(result.current.icons).toHaveLength(160);
    expect(result.current.icons[0]!.id).toBe("tabler:arrow-right");

    await act(async () => {
      result.current.goToPage(1);
    });
    await waitFor(() =>
      expect(result.current.icons.map((icon) => icon.id)).toEqual(
        Array.from({ length: 11 }, (_, index) => `tabler:shape-${String(159 + index).padStart(3, "0")}`),
      ),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should switch to local search once the corpus finishes loading", async () => {
    let finishLoading: (index: IconSearchIndex) => void = () => {};
    vi.mocked(shouldLoadIconCorpus).mockReturnValue(true);
    vi.mocked(loadIconCorpus).mockImplementation(
      () => new Promise<IconSearchIndex>((resolve) => { finishLoading = resolve; }),
    );
    vi.mocked(global.fetch).mockImplementation(async () =>
      new Response(JSON.stringify({ icons: [makeIcon("lucide:arrow-left", "lucide")], hasMore: false, total: 1 })),
    );
    const { result } = renderHook(() => useIconBrowser({ initialIcons: [], totalCount: 0 }));

    await act(async () => {
      result.current.setSearch("arr");
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(loadIconCorpus).toHaveBeenCalledTimes(1);

    vi.mocked(getLoadedIconCorpus).mockReturnValue(corpus);
    await act(async () => {
      finishLoading(corpus);
      await tick();
    });

    await act(async () => {
      result.current.setSearch("house");
      await tick();
    });
    await waitFor(() => expect(result.current.icons.map((icon) => icon.id)).toEqual(["lucide:house"]));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
