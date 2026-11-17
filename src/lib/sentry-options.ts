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
