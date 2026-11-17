/**
 * Same-origin path that browser Sentry events go through, so ad blockers
 * don't drop them. The browser sends to it (`tunnel` in
 * instrumentation-client.ts) and the server answers it
 * (`serveTunnelIntegration` in instrumentation.ts); both must agree.
 */
export const SENTRY_TUNNEL_PATH = "/monitoring";
