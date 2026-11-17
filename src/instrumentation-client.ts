import * as Sentry from "@sentry/nextjs";
import {
  createClientBeforeSend,
  dropSentryLog,
  SENTRY_DATA_COLLECTION,
  SENTRY_TUNNEL_PATH,
} from "@/lib/sentry-options";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
  tracesSampleRate: 0,
  // Send events through this app (served by serveTunnelIntegration in
  // instrumentation.ts) so ad blockers don't drop them.
  tunnel: { path: SENTRY_TUNNEL_PATH },
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeSendLog: dropSentryLog,
  // Drops React #412 from abandoned RSC prefetches (UNICON-D); boundary
  // reports of a cut navigation still go through.
  beforeSend: createClientBeforeSend(process.env.NODE_ENV === "production"),
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  ignoreErrors: [
    // React 19 hoistable crash: external tools (translation extensions,
    // in-app webviews, ad blockers) detach document.head, so React's
    // mountHoistable hits `head.insertBefore` on a null head. Not an app bug
    // and not fixable in app code — suppress the non-actionable noise.
    /\.head\.insertBefore/,
    "(reading 'insertBefore')",
    "null is not an object (evaluating '(e=e.ownerDocument||e).head.insertBefore')",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
