"use client";

import Link from "next/link";

export default function BundlesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-xl font-medium text-foreground">Unable to load bundle data</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The requested bundle data could not be retrieved. Please try again.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">Error reference: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Try again
      </button>
      <Link
        href="/"
        className="mt-3 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Back to icons
      </Link>
    </div>
  );
}
