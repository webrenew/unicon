import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dropSentryLog, SENTRY_DATA_COLLECTION, SENTRY_TUNNEL_PATH } from "./sentry-options";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Sentry instrumentation files", () => {
  // With a src/ app directory Next only loads instrumentation files from src/.
  // They sat at the repo root before, and Sentry silently never initialized.
  it("should live in src/ next to the app directory", () => {
    expect(existsSync(join(root, "src/app"))).toBe(true);
    expect(existsSync(join(root, "src/instrumentation.ts"))).toBe(true);
    expect(existsSync(join(root, "src/instrumentation-client.ts"))).toBe(true);
    expect(existsSync(join(root, "instrumentation.ts"))).toBe(false);
    expect(existsSync(join(root, "instrumentation-client.ts"))).toBe(false);
  });

  it("should export the hooks Next calls", () => {
    expect(read("src/instrumentation.ts")).toMatch(/export async function register\(/);
    expect(read("src/instrumentation.ts")).toMatch(/export const onRequestError = /);
    expect(read("src/instrumentation-client.ts")).toMatch(/export const onRouterTransitionStart = /);
  });

  it("should use the shared tunnel path and data collection in every init", () => {
    const server = read("src/instrumentation.ts");
    const client = read("src/instrumentation-client.ts");
    const serverInits = server.match(/Sentry\.init\(/g) ?? [];
    expect(serverInits).toHaveLength(2);
    expect(server.match(/serveTunnelIntegration\(\{ path: SENTRY_TUNNEL_PATH \}\)/g)).toHaveLength(2);
    expect(server.match(/dataCollection: SENTRY_DATA_COLLECTION/g)).toHaveLength(2);
    expect(client).toContain("tunnel: { path: SENTRY_TUNNEL_PATH }");
    expect(client).toContain("dataCollection: SENTRY_DATA_COLLECTION");
    expect(SENTRY_TUNNEL_PATH).toBe("/monitoring");
  });
});

describe("SENTRY_DATA_COLLECTION", () => {
  it("should not collect credentials, bodies or user data", () => {
    expect(SENTRY_DATA_COLLECTION).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    });
    const headers = JSON.stringify(SENTRY_DATA_COLLECTION.httpHeaders).toLowerCase();
    for (const credential of ["authorization", "cookie", "apikey", "x-api-key"]) {
      expect(headers).not.toContain(credential);
    }
  });

  it("should drop every log event", () => {
    expect(dropSentryLog()).toBeNull();
  });
});
