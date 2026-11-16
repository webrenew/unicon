/**
 * Which icons a `.uniconrc.json` bundle selects. Network access is passed in,
 * so `sync`, `bundle:add`, and `audit` share this logic and tests can stub it.
 */

export interface BundleSelection {
  /** Exact icons: `name` (from `source`) or `source:name`. */
  icons?: string[] | undefined;
  query?: string | undefined;
  category?: string | undefined;
  source?: string | undefined;
  limit?: number | undefined;
}

export interface IconFetchers<T extends { id: string }> {
  /** Exact lookup; returns the matches and the references that matched nothing. */
  byRefs(refs: readonly string[], defaultSource: string | undefined): Promise<{ icons: T[]; missing: string[] }>;
  /** Search; returns up to `limit` icons. */
  search(params: { query?: string | undefined; category?: string | undefined; source?: string | undefined; limit: number }): Promise<T[]>;
}

export const DEFAULT_BUNDLE_LIMIT = 100;

/** Whether a bundle selects anything at all. */
export function hasSelection(bundle: BundleSelection): boolean {
  return Boolean(bundle.icons?.length || bundle.query || bundle.category || bundle.source);
}

/**
 * Whether a bundle runs a search. `source` on its own selects the first
 * `limit` icons of that library, but next to `icons` it only says which
 * library bare names come from.
 */
export function usesSearch(bundle: BundleSelection): boolean {
  return Boolean(bundle.query || bundle.category || (!bundle.icons?.length && bundle.source));
}

/**
 * Resolve a bundle to icons: the exact `icons` first, in order, then search
 * results that are not already in the list.
 */
export async function resolveBundleIcons<T extends { id: string }>(
  bundle: BundleSelection,
  fetchers: IconFetchers<T>
): Promise<{ icons: T[]; missing: string[] }> {
  const exact = bundle.icons?.length ? await fetchers.byRefs(bundle.icons, bundle.source) : { icons: [], missing: [] };
  if (!usesSearch(bundle)) return exact;

  const found = await fetchers.search({
    query: bundle.query,
    category: bundle.category,
    source: bundle.source,
    limit: bundle.limit || DEFAULT_BUNDLE_LIMIT,
  });
  const seen = new Set(exact.icons.map((icon) => icon.id));
  return { icons: [...exact.icons, ...found.filter((icon) => !seen.has(icon.id))], missing: exact.missing };
}
