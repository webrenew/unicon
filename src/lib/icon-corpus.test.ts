import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RETRY_COOLDOWN_MS,
  getLoadedIconCorpus,
  loadIconCorpus,
  resetIconCorpusForTests,
  shouldLoadIconCorpus,
} from "./icon-corpus";
import { searchIconIndex } from "./icon-search";
import type { IconCorpusRow } from "./icon-corpus-format";

const rows: IconCorpusRow[] = [
  ["lucide:arrow-left", "ArrowLeft", "arrow-left", "lucide", "arrows", '["back"]', "0 0 24 24", "<path/>", 1, "2", null],
  ["simple-icons:github", "GitHub", "github", "simple-icons", null, "not json", "0 0 24 24", "<path/>", 2, null, "#181717"],
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("loadIconCorpus", () => {
  beforeEach(() => {
    resetIconCorpusForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetIconCorpusForTests();
  });

  it("should load every chunk once and build a searchable index", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "https://unicon.sh");
      const chunk = url.searchParams.get("chunk");
      if (chunk === null) return json({ version: "v1", total: 2, chunkSize: 1, chunks: 2 });
      return json({ version: "v1", chunk: Number(chunk), rows: [rows[Number(chunk)]] });
    });

    const [index] = await Promise.all([loadIconCorpus(), loadIconCorpus()]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]![0])).toContain("v=v1");
    expect(getLoadedIconCorpus()).toBe(index);

    const github = searchIconIndex(index, { query: "git", limit: 10, offset: 0 }).icons[0]!;
    expect(github).toMatchObject({ id: "simple-icons:github", tags: [], defaultFill: true, defaultStroke: false });
    expect(searchIconIndex(index, { query: "back", limit: 10, offset: 0 }).icons[0]).toMatchObject({
      id: "lucide:arrow-left",
      tags: ["back"],
      defaultStroke: true,
      strokeWidth: "2",
    });
  });

  it("should fail when chunks keep belonging to a different version", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const chunk = new URL(String(input), "https://unicon.sh").searchParams.get("chunk");
      if (chunk === null) return json({ version: "v1", total: 1, chunkSize: 1, chunks: 1 });
      return json({ version: "v2", chunk: 0, rows: [rows[0]] });
    });

    await expect(loadIconCorpus()).rejects.toThrow(/version/);
    expect(getLoadedIconCorpus()).toBeNull();
    // One revalidated attempt, then give up: manifest + chunk, twice.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("should recover from a stale cached manifest without waiting for the cooldown", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input), "https://unicon.sh");
      const chunk = url.searchParams.get("chunk");
      if (chunk === null) {
        // The browser cache serves the old manifest until revalidated.
        const version = init?.cache === "no-cache" ? "v2" : "v1";
        return json({ version, total: 1, chunkSize: 1, chunks: 1 });
      }
      if (url.searchParams.get("v") !== "v2") return json({ error: "Icon corpus version changed", version: "v2" }, 409);
      return json({ version: "v2", chunk: 0, rows: [rows[0]] });
    });

    const index = await loadIconCorpus();

    expect(index.entries).toHaveLength(1);
    expect(getLoadedIconCorpus()).toBe(index);
    expect(shouldLoadIconCorpus()).toBe(true);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/icons/corpus",
      "/api/icons/corpus?chunk=0&v=v1",
      "/api/icons/corpus",
      "/api/icons/corpus?chunk=0&v=v2",
    ]);
  });

  it("should fail when the server returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(json({ error: "Rate limit exceeded" }, 429));

    await expect(loadIconCorpus()).rejects.toThrow(/429/);
  });

  it("should allow a retry after the cooldown and revalidate the manifest", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(json({ error: "Rate limit exceeded" }, 429));

    await expect(loadIconCorpus()).rejects.toThrow(/429/);
    expect(shouldLoadIconCorpus()).toBe(false);

    vi.setSystemTime(Date.now() + RETRY_COOLDOWN_MS + 1);
    expect(shouldLoadIconCorpus()).toBe(true);

    fetchMock.mockImplementation(async (input) => {
      const chunk = new URL(String(input), "https://unicon.sh").searchParams.get("chunk");
      if (chunk === null) return json({ version: "v1", total: 1, chunkSize: 1, chunks: 1 });
      return json({ version: "v1", chunk: 0, rows: [rows[0]] });
    });
    const index = await loadIconCorpus();

    expect(index.entries).toHaveLength(1);
    expect(fetchMock.mock.calls[1]![1]).toEqual({ cache: "no-cache" });
    expect(getLoadedIconCorpus()).toBe(index);
  });
});
