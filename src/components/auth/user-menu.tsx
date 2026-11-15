"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LogOutIcon } from "@/components/icons/ui/log-out";
import { PackageIcon } from "@/components/icons/ui/package";
import { SettingsIcon } from "@/components/icons/ui/settings";
import { Loader2Icon } from "@/components/icons/ui/loader-2";
import { signOut } from "@/lib/auth/actions";
import type { Profile } from "@/types/database";

interface UserMenuProps {
  profile: Profile;
}

export function UserMenu({ profile }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      // Next's server-action redirect sentinel has a `digest` prefixed
      // with NEXT_REDIRECT. Re-throw so the framework can handle it;
      // reset local state only for genuine failures.
      if (
        typeof error === "object" &&
        error !== null &&
        "digest" in error &&
        typeof (error as { digest: unknown }).digest === "string" &&
        (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
      ) {
        throw error;
      }
      setIsSigningOut(false);
      throw error;
    }
  };

  const avatarUrl = profile.avatar_url;
  const displayName = profile.full_name ?? profile.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 hover:ring-2 hover:ring-black/20 dark:hover:ring-white/20 transition-all"
          aria-label="User menu"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={32}
              height={32}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-xs font-medium text-black/70 dark:text-white/70">
              {initials}
            </span>
          )}

        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="px-3 py-2 border-b border-black/5 dark:border-white/5">
          <p className="text-sm font-medium text-black dark:text-white truncate">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {profile.email}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/5 text-muted-foreground">
              Free
            </span>
          </div>
        </div>

        <div className="py-1">
          <Link
            href="/bundles"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
          >
            <PackageIcon className="w-4 h-4" />
            My Bundles
          </Link>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </Link>
        </div>

        <div className="pt-1 border-t border-black/5 dark:border-white/5">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <LogOutIcon className="w-4 h-4" />
            )}
            Sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
