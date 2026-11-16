import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLoadedIconCorpus, loadIconCorpus, resetIconCorpusForTests } from "./icon-corpus";
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

  it("should fail when a chunk belongs to a different version", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const chunk = new URL(String(input), "https://unicon.sh").searchParams.get("chunk");
      if (chunk === null) return json({ version: "v1", total: 1, chunkSize: 1, chunks: 1 });
      return json({ version: "v2", chunk: 0, rows: [rows[0]] });
    });

    await expect(loadIconCorpus()).rejects.toThrow(/version/);
    expect(getLoadedIconCorpus()).toBeNull();
  });

  it("should fail when the server returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(json({ error: "Rate limit exceeded" }, 429));

    await expect(loadIconCorpus()).rejects.toThrow(/429/);
  });
});
