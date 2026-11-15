"use client";

import { SiteHeader } from "@/components/site-header";

export default function BundlesError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-xl font-medium text-foreground">Unable to load bundles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your bundles could not be retrieved. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
