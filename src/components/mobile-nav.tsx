"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileTextIcon } from "@/components/icons/ui/file-text";
import { TerminalIcon } from "@/components/icons/ui/terminal";
import { PackageIcon } from "@/components/icons/ui/package";
import { FigmaIcon } from "@/components/icons/ui/figma";
import { MCPIcon } from "@/components/icons/mcp-icon";
import { XIcon } from "@/components/icons/ui/x";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    href: "/docs",
    label: "Docs",
    icon: FileTextIcon,
    color: "text-[var(--accent-lavender)]",
    hoverBg: "hover:bg-[var(--accent-lavender)]/10",
  },
  {
    href: "/docs/cli",
    label: "CLI",
    icon: TerminalIcon,
    color: "text-[var(--accent-aqua)]",
    hoverBg: "hover:bg-[var(--accent-aqua)]/10",
  },
  {
    href: "https://www.figma.com/community/plugin/1601964333135836232/unicon",
    label: "Figma Plugin",
    icon: FigmaIcon,
    color: "text-[var(--accent-lavender)]",
    hoverBg: "hover:bg-[var(--accent-lavender)]/10",
    external: true,
  },
  {
    href: "/docs/mcp",
    label: "MCP",
    icon: MCPIcon,
    color: "text-[var(--accent-lavender)]",
    hoverBg: "hover:bg-[var(--accent-lavender)]/10",
  },
  {
    href: "/packs",
    label: "Packs",
    icon: PackageIcon,
    color: "text-[var(--accent-mint)]",
    hoverBg: "hover:bg-[var(--accent-mint)]/10",
  },
];

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        className="fixed inset-0 bg-black/60 z-40 md:hidden"
        onClick={onClose}
        aria-label="Close navigation menu"
      />

      {/* Menu Panel */}
      <div
        role="dialog"
        aria-label="Navigation menu"
        aria-modal="true"
        className="fixed top-14 left-0 right-0 bg-white dark:bg-background border-b border-border z-50 md:hidden animate-in slide-in-from-top-2 duration-200"
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isExternal = "external" in item && item.external;
            const isActive = !isExternal && (pathname === item.href || pathname.startsWith(item.href + "/"));

            const className = cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              item.hoverBg,
              isActive ? item.color : "text-muted-foreground"
            );

            const content = (
              <>
                {item.label === "MCP" ? (
                  <Icon className="w-5 h-5" size={20} />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
                <span className="font-medium">{item.label}</span>
              </>
            );

            if (isExternal) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className={className}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={className}
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

// Hamburger button component
export function MobileNavTrigger({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <XIcon className="w-5 h-5" />
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      )}
    </button>
  );
}
