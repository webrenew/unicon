"use client";

import { useState } from "react";
import Link from "next/link";
import { GithubIcon } from "@/components/icons/ui/github";
import { TerminalIcon } from "@/components/icons/ui/terminal";
import { FileTextIcon } from "@/components/icons/ui/file-text";
import { UserIcon } from "@/components/icons/ui/user";
import { PackageIcon } from "@/components/icons/ui/package";
import { FigmaIcon } from "@/components/icons/ui/figma";
import { ThemeToggle } from "@/components/theme-toggle";
import { MCPIcon } from "@/components/icons/mcp-icon";
import { MobileNav, MobileNavTrigger } from "@/components/mobile-nav";
import { LoginDialog } from "@/components/auth/login-dialog";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  variant?: "default" | "docs";
}

export function SiteHeader({ variant = "default" }: SiteHeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const { user, profile, isLoading } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className={cn(
          "flex h-14 items-center justify-between",
          variant === "docs" ? "px-4" : "px-4 lg:px-20 xl:px-40"
        )}>
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
      <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
    </>
  );
}
