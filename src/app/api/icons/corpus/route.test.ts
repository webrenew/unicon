import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getIconCorpusChunk, getIconCorpusManifest } from "@/lib/queries";
import { resetIconCorpusMemoForTests } from "@/lib/icon-corpus-server";
import { checkPublicRateLimit } from "@/lib/rate-limit";
import type { IconCorpusRow } from "@/lib/icon-corpus-format";

vi.mock("@/lib/queries", () => ({
  getIconCorpusManifest: vi.fn(),
  getIconCorpusChunk: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkPublicRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/request-ip", () => ({
  getTrustedClientIp: vi.fn().mockReturnValue("203.0.113.10"),
}));

const manifest = { version: "19457-1700000000", total: 4, chunkSize: 3000, chunks: 2 };
const row: IconCorpusRow = [
  "lucide:zap", "Zap", "zap", "lucide", null, '["lightning"]', "0 0 24 24", "<path/>", 1, "2", null,
];

const request = (query = "") => new NextRequest(`https://unicon.sh/api/icons/corpus${query}`);

describe("GET /api/icons/corpus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIconCorpusMemoForTests();
    vi.mocked(checkPublicRateLimit).mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 });
    vi.mocked(getIconCorpusManifest).mockResolvedValue(manifest);
    vi.mocked(getIconCorpusChunk).mockResolvedValue({ version: manifest.version, rows: [row] });
  });

  it("should return the manifest with a short CDN cache", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(manifest);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("should return a chunk with a long CDN cache", async () => {
    const response = await GET(request("?chunk=1&v=19457-1700000000"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: manifest.version, chunk: 1, rows: [row] });
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=86400");
    expect(getIconCorpusChunk).toHaveBeenCalledWith(1);
  });

  it("should memoize chunks and the manifest within an instance", async () => {
    await GET(request("?chunk=0"));
    await GET(request("?chunk=0"));
    await GET(request());

    expect(getIconCorpusChunk).toHaveBeenCalledTimes(1);
    expect(getIconCorpusManifest).toHaveBeenCalledTimes(1);
  });

  it("should return 409 without caching when the client's version is outdated", async () => {
    const response = await GET(request("?chunk=0&v=19000-1600000000"));

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ version: manifest.version });
    // The memoized manifest is re-read before rejecting the client's version.
    expect(getIconCorpusManifest).toHaveBeenCalledTimes(2);
    expect(getIconCorpusChunk).not.toHaveBeenCalled();
  });

  it("should accept a newer client version once the fresh manifest confirms it", async () => {
    await GET(request());
    const newer = { ...manifest, version: "19500-1800000000" };
    vi.mocked(getIconCorpusManifest).mockResolvedValue(newer);
    vi.mocked(getIconCorpusChunk).mockResolvedValue({ version: newer.version, rows: [row] });

    const response = await GET(request(`?chunk=0&v=${newer.version}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: newer.version });
  });

  it("should return 409 and not cache a chunk when the data changes mid-request", async () => {
    vi.mocked(getIconCorpusChunk).mockResolvedValueOnce({ version: "19458-1800000000", rows: [row] });

    const stale = await GET(request(`?chunk=0&v=${manifest.version}`));
    expect(stale.status).toBe(409);
    expect(stale.headers.get("Cache-Control")).toBe("no-store");
    expect(await stale.json()).toMatchObject({ version: "19458-1800000000" });

    // The mismatch also invalidated the memoized manifest and chunk.
    await GET(request("?chunk=0"));
    expect(getIconCorpusManifest).toHaveBeenCalledTimes(2);
    expect(getIconCorpusChunk).toHaveBeenCalledTimes(2);
  });

  it.each(["2", "-1", "abc", "1.5", ""])("should reject invalid chunk %j", async (chunk) => {
    const response = await GET(request(`?chunk=${chunk}`));

    expect(response.status).toBe(400);
    expect(getIconCorpusChunk).not.toHaveBeenCalled();
  });

  it("should return 429 when rate limited", async () => {
    vi.mocked(checkPublicRateLimit).mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: 0 });

    const response = await GET(request());

    expect(response.status).toBe(429);
    expect(getIconCorpusManifest).not.toHaveBeenCalled();
  });

  it("should return 500 and retry later when the database fails", async () => {
    vi.mocked(getIconCorpusChunk).mockRejectedValueOnce(new Error("db down"));

    expect((await GET(request("?chunk=0"))).status).toBe(500);
    expect((await GET(request("?chunk=0"))).status).toBe(200);
  });
});
