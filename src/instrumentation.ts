import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";
import { SENTRY_TUNNEL_PATH } from "@/lib/sentry-tunnel";

// Mirror of the client-side filter (see instrumentation-client.ts). This is a
// browser-only DOM crash and won't fire server-side, but keeping the configs
// symmetric avoids surprises if these patterns ever surface in SSR.
const ignoreErrors = [
  /\.head\.insertBefore/,
  "(reading 'insertBefore')",
  "null is not an object (evaluating '(e=e.ownerDocument||e).head.insertBefore')",
];

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    registerOTel({
      serviceName: process.env.VERCEL_PROJECT_PRODUCTION_URL || "next-app",
      traceSampler: "traceidratio",
    });

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.VERCEL_ENV || "development",
      tracesSampleRate: 0,
      ignoreErrors,
      integrations: [Sentry.serveTunnelIntegration({ path: SENTRY_TUNNEL_PATH })],
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.VERCEL_ENV || "development",
      tracesSampleRate: 0,
      ignoreErrors,
      integrations: [Sentry.serveTunnelIntegration({ path: SENTRY_TUNNEL_PATH })],
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
