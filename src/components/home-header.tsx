"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { GithubIcon } from "@/components/icons/ui/github";
import { TerminalIcon } from "@/components/icons/ui/terminal";
import { FileTextIcon } from "@/components/icons/ui/file-text";
import { PackageIcon } from "@/components/icons/ui/package";
import { UserIcon } from "@/components/icons/ui/user";
import { FigmaIcon } from "@/components/icons/ui/figma";
import { ThemeToggle } from "@/components/theme-toggle";
import { MCPIcon } from "@/components/icons/mcp-icon";
import { MobileNav, MobileNavTrigger } from "@/components/mobile-nav";
import { LoginDialog } from "@/components/auth/login-dialog";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/hooks/use-auth";
import type { IconData } from "@/types/icon";
import { logger } from "@/lib/logger";

function getStoredCartCount(): number {
  if (typeof window === "undefined") return 0;

  try {
    const savedCart = localStorage.getItem("unicon-bundle");
    if (!savedCart) return 0;

    const parsed = JSON.parse(savedCart) as IconData[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (error) {
    logger.error("Failed to read bundle from localStorage:", error);
    return 0;
  }
}

function getServerCartCount(): number {
  return 0;
}

function subscribeToCartUpdates(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  function handleUpdate() {
    onStoreChange();
  }

  window.addEventListener("storage", handleUpdate);
  window.addEventListener("cartUpdate", handleUpdate);

  return () => {
    window.removeEventListener("storage", handleUpdate);
    window.removeEventListener("cartUpdate", handleUpdate);
  };
}

export function HomeHeader() {
  const cartCount = useSyncExternalStore(
    subscribeToCartUpdates,
    getStoredCartCount,
    getServerCartCount
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, profile, isLoading } = useAuth();

  // Detect invite token from URL on mount — auto-open login dialog
  const [inviteRedirect] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const token = new URLSearchParams(window.location.search).get("invite");
    return token ? `/invite/${token}` : undefined;
  });
  const [loginDialogOpen, setLoginDialogOpen] = useState(
    () => !!inviteRedirect && !user
  );

  const handleBundleClick = () => {
    // Dispatch event to open cart in MetallicIconBrowser
    window.dispatchEvent(new CustomEvent("openCart"));
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white dark:bg-background/95 dark:backdrop-blur dark:supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 lg:px-20 xl:px-40">
          <div className="flex items-center gap-4 md:gap-6">
            <MobileNavTrigger
              isOpen={mobileNavOpen}
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            />

            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl" aria-hidden="true">🦄</span>
              <span className="font-mono text-muted-foreground text-xs tracking-widest uppercase">
                UNICON
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link
                href="/docs"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-[var(--accent-lavender)] hover:bg-[var(--accent-lavender)]/5 transition-colors"
              >
                <FileTextIcon className="w-3.5 h-3.5" />
                Docs
              </Link>
              <Link
                href="/docs/cli"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-[var(--accent-aqua)] hover:bg-[var(--accent-aqua)]/5 transition-colors"
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                CLI
              </Link>
              <a
                href="https://www.figma.com/community/plugin/1601964333135836232/unicon"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-[var(--accent-lavender)] hover:bg-[var(--accent-lavender)]/5 transition-colors"
              >
                <FigmaIcon className="w-3.5 h-3.5" />
                Figma
              </a>
              <Link
                href="/docs/mcp"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-[var(--accent-lavender)] hover:bg-[var(--accent-lavender)]/5 transition-colors"
              >
                <MCPIcon className="w-3.5 h-3.5" size={14} />
                MCP
              </Link>
              <Link
                href="/packs"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-[var(--accent-mint)] hover:bg-[var(--accent-mint)]/5 transition-colors"
              >
                <PackageIcon className="w-3.5 h-3.5" />
                Packs
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleBundleClick}
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--accent-mint)]/30 dark:bg-[var(--accent-mint)]/20 text-black/80 dark:text-[var(--accent-mint)] hover:bg-[var(--accent-mint)]/40 dark:hover:bg-[var(--accent-mint)]/30 border-2 border-[var(--accent-mint)]/50 dark:border-[var(--accent-mint)]/30 transition-all text-sm font-medium"
            >
              <PackageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Bundle</span>
              {cartCount > 0 && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1.5 bg-[var(--accent-mint)] text-black text-xs rounded-full font-semibold">
                  {cartCount}
                </span>
              )}
            </button>
            <ThemeToggle />

            {/* Auth: Login button or User menu */}
            {!isLoading && (
              user && profile ? (
                <UserMenu profile={profile} />
              ) : (
                <button
                  onClick={() => setLoginDialogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </button>
              )
            )}

            {/* GitHub link - hide when logged in to save header space */}
            {!user && (
              <a
                href="https://github.com/WebRenew/unicon"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <GithubIcon className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </header>

      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        redirectPath={inviteRedirect}
        message={inviteRedirect ? "Sign in to accept your team invite." : undefined}
      />
    </>
  );
}
