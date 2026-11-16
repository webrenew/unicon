/**
 * Browser-side reporting for searches answered from the local icon corpus.
 */
import { logger } from "@/lib/logger";

const SEARCH_ANALYTICS_ENDPOINT = "/api/search/analytics";

export interface LocalSearchReport {
  query: string;
  sourceFilter?: string | undefined;
  resultCount: number;
  responseTimeMs?: number | undefined;
}

/**
 * Send a fire-and-forget analytics event for a local search. Uses
 * `navigator.sendBeacon` so the event survives navigation, and falls back to
 * a `keepalive` fetch. Never throws.
 */
export function reportLocalSearch(report: LocalSearchReport): void {
  try {
    const body = JSON.stringify(report);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(
        SEARCH_ANALYTICS_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (queued) return;
    }
    void fetch(SEARCH_ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch((error: unknown) => {
      logger.error("Failed to report local search:", error);
    });
  } catch (error) {
    logger.error("Failed to report local search:", error);
  }
}
