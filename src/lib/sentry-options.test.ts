import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createClientBeforeSend,
  dropSentryLog,
  SENTRY_DATA_COLLECTION,
  SENTRY_TUNNEL_PATH,
  UNHANDLED_REJECTION_MECHANISM,
} from "./sentry-options";

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
    expect(server.match(/serveTunnelIntegration\(\s*\{\s*path:\s*SENTRY_TUNNEL_PATH/g)).toHaveLength(2);
    expect(server.match(/dataCollection:\s*SENTRY_DATA_COLLECTION/g)).toHaveLength(2);
    expect(client).toMatch(/tunnel:\s*\{\s*path:\s*SENTRY_TUNNEL_PATH/);
    expect(client).toMatch(/dataCollection:\s*SENTRY_DATA_COLLECTION/);
    expect(server.match(/beforeSendLog:\s*dropSentryLog/g)).toHaveLength(2);
    expect(client).toMatch(/beforeSendLog:\s*dropSentryLog/);
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
    expect(SENTRY_DATA_COLLECTION.httpHeaders).toEqual({
      request: { allow: ["accept", "content-type", "user-agent"] },
      response: { allow: ["content-type"] },
    });
    const headers = JSON.stringify(SENTRY_DATA_COLLECTION.httpHeaders).toLowerCase();
    for (const credential of ["authorization", "cookie", "apikey", "x-api-key", "referer"]) {
      expect(headers).not.toContain(credential);
    }
  });

  it("should drop every log event", () => {
    expect(dropSentryLog()).toBeNull();
  });
});

const PROD_412 =
  "Minified React error #412; visit https://react.dev/errors/412 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";

function errorEvent(value: string, mechanismType = UNHANDLED_REJECTION_MECHANISM) {
  return { exception: { values: [{ type: "Error", value, mechanism: { type: mechanismType, handled: false } }] } };
}

describe("client beforeSend", () => {
  const productionBeforeSend = createClientBeforeSend(true);
  const developmentBeforeSend = createClientBeforeSend(false);

  it("should drop React #412 when an abandoned RSC prefetch rejects unhandled", () => {
    expect(productionBeforeSend(errorEvent(PROD_412))).toBeNull();
    expect(developmentBeforeSend(errorEvent("Connection closed."))).toBeNull();
  });

  it("should keep React #412 when an error boundary reports a cut navigation", () => {
    const event = errorEvent(PROD_412, "generic");
    expect(productionBeforeSend(event)).toBe(event);
  });

  it("should keep an exact \"Connection closed.\" from other code in production", () => {
    const event = errorEvent("Connection closed.");
    expect(productionBeforeSend(event)).toBe(event);
  });

  it("should keep other React errors and other connection messages", () => {
    for (const value of [
      "Minified React error #418; visit https://react.dev/errors/418",
      "Minified React error #4120; visit https://react.dev/errors/4120",
      "Realtime connection closed.",
      "Connection closed. Retrying in 5s",
    ]) {
      const event = errorEvent(value);
      expect(productionBeforeSend(event)).toBe(event);
      expect(developmentBeforeSend(event)).toBe(event);
    }
  });

  it("should keep #412 from the global onerror handler", () => {
    const event = errorEvent(PROD_412, "auto.browser.global_handlers.onerror");
    expect(productionBeforeSend(event)).toBe(event);
  });

  it("should keep events without an exception", () => {
    const event = { message: "hello", exception: undefined };
    expect(productionBeforeSend(event)).toBe(event);
    const empty = { exception: { values: [] } };
    expect(productionBeforeSend(empty)).toBe(empty);
  });
});

describe("Sentry SDK contract", () => {
  it("should match the mechanism the installed browser SDK sets for unhandled rejections", () => {
    const require = createRequire(import.meta.url);
    const nextjsEntry = require.resolve("@sentry/nextjs");
    const browserPackage = require.resolve("@sentry/browser/package.json", { paths: [nextjsEntry] });
    const globalHandlers = join(dirname(browserPackage), "build/npm/esm/prod/integrations/globalhandlers.js");

    expect(readFileSync(globalHandlers, "utf8")).toContain(`"${UNHANDLED_REJECTION_MECHANISM}"`);
  });
});

describe("error boundaries", () => {
  // The client beforeSend drops #412 only for unhandled rejections. A cut
  // navigation lands in a boundary instead, and a caught error reaches Sentry
  // only if the boundary reports it.
  const boundaries = (readdirSync(join(root, "src/app"), { recursive: true }) as string[])
    .filter((file) => /(^|\/)(global-)?error\.tsx$/.test(file))
    .map((file) => join("src/app", file));

  it("should find the app's boundaries", () => {
    expect(boundaries).toEqual(expect.arrayContaining(["src/app/global-error.tsx", "src/app/bundles/error.tsx"]));
  });

  it.each(boundaries)("should report caught errors from %s with captureException", (file) => {
    expect(read(file)).toMatch(/Sentry\.captureException\(error\)/);
  });
});
