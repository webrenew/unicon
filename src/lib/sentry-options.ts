import type * as Sentry from "@sentry/nextjs";

type DataCollection = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"]>;

/**
 * Same-origin path that browser Sentry events go through, so ad blockers
 * don't drop them. The browser sends to it (`tunnel` in
 * instrumentation-client.ts) and the server answers it
 * (`serveTunnelIntegration` in instrumentation.ts); both must agree.
 */
export const SENTRY_TUNNEL_PATH = "/monitoring";

/**
 * What Sentry may attach to events. v11 collects everything when this is
 * unset (cookies, request/response bodies, user IP, query data), and this app
 * authenticates with Supabase session cookies and API tokens. Collect only
 * what debugging needs: no cookies, bodies, user info, query data or
 * variables, and only request headers that carry no credentials or URLs
 * (referer would bring back query strings such as the PKCE `code`).
 *
 * `satisfies Required<...>` makes a category added by a future SDK minor a
 * type error here instead of a new default that collects everything.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { allow: ["accept", "content-type", "user-agent"] },
    response: { allow: ["content-type"] },
  },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  // Lines of our own source around each stack frame; no runtime data.
  frameContextLines: 5,
} satisfies Required<DataCollection>;

/**
 * v11 sends logs by default, including `console.*` on the server. The app only
 * reports errors to Sentry, so drop every log event.
 */
export const dropSentryLog = (): null => null;

/**
 * Mechanism `@sentry/browser`'s globalHandlersIntegration sets on unhandled
 * promise rejections. sentry-options.test.ts reads the installed SDK, so an
 * upstream rename fails CI instead of silently disabling the filter below.
 */
export const UNHANDLED_REJECTION_MECHANISM = "auto.browser.global_handlers.onunhandledrejection";
const MINIFIED_CONNECTION_CLOSED = /^Minified React error #412;/;
const DEV_CONNECTION_CLOSED = /^Connection closed\.$/;

interface ExceptionLike {
  value?: string | undefined;
  mechanism?: { type?: string | undefined } | undefined;
}

interface ErrorEventLike {
  exception?: { values?: ExceptionLike[] | undefined } | undefined;
}

/**
 * True for an RSC stream that closed early and surfaced as an unhandled rejection.
 *
 * React error #412 ("Connection closed.") is thrown by Next's RSC client when a
 * response stream ends before all chunks arrive. As an unhandled rejection it
 * comes from a prefetch the visitor (or a bot) abandoned, which nobody sees.
 * A cut navigation stream reaches an error boundary instead, and the
 * boundaries report through `captureException` (a different mechanism), so
 * that case still reaches Sentry (vercel/next.js#97337).
 *
 * Production React ships the minified message; the full "Connection closed."
 * text exists only in development builds, so it is matched only there. In
 * production an exact "Connection closed." from other code still reports.
 *
 * Only the last exception is read: Sentry lists a chain innermost first and the
 * global handler puts its mechanism on the outermost (last) entry. React throws
 * #412 without a `cause`, so these events carry a single value.
 */
export function isAbortedRscStreamRejection(event: ErrorEventLike, isProduction: boolean): boolean {
  const exceptions = event.exception?.values;
  const lastException = exceptions?.[exceptions.length - 1];
  if (lastException?.mechanism?.type !== UNHANDLED_REJECTION_MECHANISM) return false;

  const message = lastException.value ?? "";
  if (MINIFIED_CONNECTION_CLOSED.test(message)) return true;
  return !isProduction && DEV_CONNECTION_CLOSED.test(message);
}

/** Browser `beforeSend`: drop abandoned RSC prefetch streams, keep everything else. */
export function createClientBeforeSend(isProduction: boolean) {
  return <TEvent extends ErrorEventLike>(event: TEvent): TEvent | null =>
    isAbortedRscStreamRejection(event, isProduction) ? null : event;
}
