"use client";

import { useState, useCallback } from "react";
import { BundleCard } from "./bundle-card";
import { PackageIcon } from "@/components/icons/ui/package";
import { Loader2Icon } from "@/components/icons/ui/loader-2";
import { PlusIcon } from "@/components/icons/ui/plus";
import Link from "next/link";
import type { Bundle } from "@/types/database";

interface BundlesListProps {
  initialBundles: Bundle[];
}

export function BundlesList({ initialBundles }: BundlesListProps) {
  const [bundles, setBundles] = useState<Bundle[]>(initialBundles);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBundles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/bundles");
      if (!response.ok) throw new Error("Failed to fetch bundles");
      const data = await response.json();
      setBundles(data.bundles);
    } catch {
      setError("Failed to load bundles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDelete = (id: string) => {
    setBundles((prev) => prev.filter((b) => b.id !== id));
  };

  // Use response data from PATCH instead of refetching to avoid race conditions
  // The bundle-card component passes the updated bundle data from the API response
  const handleTogglePublic = useCallback((id: string, isPublic: boolean, updatedBundle?: Bundle) => {
    setBundles((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        // If we have the full updated bundle from API response, use it
        if (updatedBundle) return updatedBundle;
        // Fallback to optimistic update
        return { ...b, is_public: isPublic, share_slug: isPublic ? b.share_slug : null };
      })
    );
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchBundles}
          className="mt-4 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const bundleCount = bundles.length;

  return (
    <div className="space-y-6">
      {/* Header with count and limit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-foreground">Your Bundles</h2>
          <span className="text-sm text-muted-foreground">{bundleCount}</span>
        </div>

      </div>

      {bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
            <PackageIcon className="w-8 h-8 text-black/30 dark:text-white/30" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No saved bundles yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Build an icon bundle and save it to the cloud for easy access anywhere.
          </p>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-mint)] text-black text-sm font-medium hover:bg-[var(--accent-mint)]/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Browse icons
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              onDelete={handleDelete}
              onTogglePublic={handleTogglePublic}
            />
          ))}

          {/* Create new bundle card */}
          {(
            <Link
              href="/"
              className="flex flex-col items-center justify-center min-h-[200px] rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[var(--accent-mint)]/50 hover:bg-[var(--accent-mint)]/5 transition-all group"
            >
              <div className="w-12 h-12 mb-3 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 group-hover:bg-[var(--accent-mint)]/10 transition-colors">
                <PlusIcon className="w-6 h-6 text-black/30 dark:text-white/30 group-hover:text-[var(--accent-mint)] transition-colors" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Create new bundle
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
