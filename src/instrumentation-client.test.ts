import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

const UNHANDLED_REJECTION = "auto.browser.global_handlers.onunhandledrejection";
const PROD_412 = "Minified React error #412; visit https://react.dev/errors/412";

const event = (value: string, mechanismType: string) => ({
  exception: { values: [{ type: "Error", value, mechanism: { type: mechanismType, handled: false } }] },
});

async function initOptions() {
  await import("./instrumentation-client");
  const [[options]] = sentry.init.mock.calls as [[{ beforeSend: (event: unknown) => unknown }]];
  return options;
}

describe("client Sentry init", () => {
  beforeEach(() => {
    vi.resetModules();
    sentry.init.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should drop an abandoned RSC prefetch and keep boundary reports in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { beforeSend } = await initOptions();

    const prefetch412 = event(PROD_412, UNHANDLED_REJECTION);
    const boundary412 = event(PROD_412, "generic");
    const otherClosed = event("Connection closed.", UNHANDLED_REJECTION);

    expect(beforeSend(prefetch412)).toBeNull();
    expect(beforeSend(boundary412)).toBe(boundary412);
    expect(beforeSend(otherClosed)).toBe(otherClosed);
  });

  it("should drop the unminified prefetch message in a development build", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { beforeSend } = await initOptions();

    expect(beforeSend(event("Connection closed.", UNHANDLED_REJECTION))).toBeNull();
  });
});
