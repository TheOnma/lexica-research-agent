"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppNav({
  active,
  right,
}: {
  active: "search" | "library";
  right?: React.ReactNode;
}) {
  const tab = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      className={
        "px-3.5 h-8 rounded-lg inline-flex items-center gap-1.5 font-semibold text-[13px] no-underline transition-colors " +
        (isActive
          ? "bg-ink text-bg"
          : "text-muted hover:text-ink")
      }
    >
      {label === "Search" ? <Icon.Search className="icon-sm" /> : <Icon.Stack className="icon-sm" />}
      {label}
    </Link>
  );

  return (
    <div className="app-top">
      <Link href="/" className="icon-btn" title="Back to landing">
        <Icon.ArrowRight className="icon" style={{ transform: "rotate(180deg)" }} />
      </Link>
      <Link
        href="/"
        className="flex items-center gap-2.5 font-semibold text-[15px] tracking-tight text-ink no-underline"
      >
        <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-ink text-bg font-bold text-[14px] tracking-[-0.04em]">L</span>
        <span>Lexica</span>
      </Link>
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-line-2">
          {tab("/search", "Search", active === "search")}
          {tab("/library", "Library", active === "library")}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {right}
        <ThemeToggle />
      </div>
    </div>
  );
}
