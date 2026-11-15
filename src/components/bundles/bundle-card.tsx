"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageIcon } from "@/components/icons/ui/package";
import { Trash2Icon } from "@/components/icons/ui/trash-2";
import { ExternalLinkIcon } from "@/components/icons/ui/external-link";
import { CopyIcon } from "@/components/icons/ui/copy";
import { CheckIcon } from "@/components/icons/ui/check";
import { GlobeIcon } from "@/components/icons/ui/globe";
import { Loader2Icon } from "@/components/icons/ui/loader-2";
import { generateRenderableSvg } from "@/lib/icon-utils";
import { toast } from "sonner";
import type { Bundle, BundleIcon } from "@/types/database";

interface BundleCardProps {
  bundle: Bundle;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean, updatedBundle?: Bundle) => void;
}

export function BundleCard({ bundle, onDelete, onTogglePublic }: BundleCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [copied, setCopied] = useState(false);

  // Safely parse icons array from bundle
  const icons = Array.isArray(bundle.icons) ? bundle.icons : [];
  const previewIcons = (icons as BundleIcon[]).slice(0, 6);
  const remainingCount = Math.max(0, bundle.icon_count - 6);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this bundle?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/bundles/${bundle.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      onDelete(bundle.id);
      toast.success("Bundle deleted");
    } catch {
      toast.error("Failed to delete bundle");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublic = async () => {
    setIsTogglingPublic(true);
    try {
      const response = await fetch(`/api/bundles/${bundle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !bundle.is_public }),
      });
      if (!response.ok) throw new Error("Failed to update");
      
      // Get the updated bundle from API response to avoid race conditions
      const data = await response.json();
      onTogglePublic(bundle.id, !bundle.is_public, data.bundle);
      toast.success(bundle.is_public ? "Bundle is now private" : "Bundle is now public");
    } catch {
      toast.error("Failed to update bundle");
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const handleCopyLink = async () => {
    if (!bundle.share_slug) return;
    const url = `${window.location.origin}/b/${bundle.share_slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Share link copied");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Render icon preview - SVG content is from trusted icon library data stored in database
  const renderIconPreview = (icon: BundleIcon) => {
    // Handle both old format (content) and new format (svg) for backwards compatibility
    const svgContent = icon.svg || (icon as unknown as { content?: string }).content;

    // Handle missing or empty SVG content
    if (!svgContent) {
      return { __html: "" };
    }

    // Determine correct viewBox based on icon source (Phosphor uses 256x256, all others use 24x24)
    const defaultViewBox = icon.sourceId === "phosphor" ? "0 0 256 256" : "0 0 24 24";

    // SECURITY NOTE: SVG content originates from curated icon libraries (Lucide, Phosphor, etc.)
    // and is stored in the database by authenticated users. This is not arbitrary user input.
    const svgHtml = generateRenderableSvg(
      {
        viewBox: icon.viewBox ?? defaultViewBox,
        content: svgContent,
        defaultStroke: icon.defaultStroke ?? true,
        defaultFill: icon.defaultFill ?? false,
        strokeWidth: icon.strokeWidth ?? "2",
      },
      {
        size: 20,
        ...(bundle.normalize_strokes && { strokeWidth: bundle.target_stroke_width ?? 2 }),
      }
    );
    return { __html: svgHtml };
  };

  // Check if icon has valid SVG content (supports both old and new format)
  const hasValidSvg = (icon: BundleIcon) => {
    return !!(icon.svg || (icon as unknown as { content?: string }).content);
  };

  return (
    <div className="group relative flex flex-col rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-black/20 dark:hover:border-white/20 transition-all overflow-hidden">
      {/* Icon Preview Grid */}
      <div className="p-4 border-b border-black/5 dark:border-white/5">
        <div className="grid grid-cols-6 gap-2">
          {previewIcons.map((icon, i) => (
            <div
              key={i}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-black/5 dark:bg-white/5"
            >
              {hasValidSvg(icon) ? (
                <div
                  className="w-5 h-5 text-black/70 dark:text-white/70 [&>svg]:w-full [&>svg]:h-full"
                  // SVG content is from trusted icon libraries, not user input
                  dangerouslySetInnerHTML={renderIconPreview(icon)}
                />
              ) : (
                <PackageIcon className="w-4 h-4 text-black/20 dark:text-white/20" />
              )}
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-black/5 dark:bg-white/5">
              <span className="text-xs font-mono text-muted-foreground">+{remainingCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-foreground line-clamp-1">{bundle.name}</h3>
          {bundle.is_public && (
            <GlobeIcon className="w-4 h-4 text-[var(--accent-aqua)] shrink-0" />
          )}
        </div>
        {bundle.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{bundle.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PackageIcon className="w-3.5 h-3.5" />
          <span>{bundle.icon_count} icons</span>
          <span className="text-black/20 dark:text-white/20">|</span>
          <span>{formatDate(bundle.updated_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-3 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
        <div className="flex items-center gap-1">
          <button
            onClick={handleTogglePublic}
            disabled={isTogglingPublic}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              bundle.is_public
                ? "bg-[var(--accent-aqua)]/10 text-[var(--accent-aqua)]"
                : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            title={bundle.is_public ? "Make private" : "Share publicly"}
          >
            {isTogglingPublic ? (
              <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <GlobeIcon className="w-3.5 h-3.5" />
            )}
            {bundle.is_public ? "Public" : "Private"}
          </button>

          {bundle.is_public && bundle.share_slug && (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Copy share link"
            >
              {copied ? (
                <CheckIcon className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <CopyIcon className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Link
            href={`/bundles/${bundle.id}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <ExternalLinkIcon className="w-3.5 h-3.5" />
            Open
          </Link>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-500/70 hover:text-red-500 hover:bg-red-500/5 transition-colors"
            title="Delete bundle"
          >
            {isDeleting ? (
              <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2Icon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
