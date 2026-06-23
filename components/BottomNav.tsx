"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  SearchIcon,
  PillIcon,
  ClipboardIcon,
} from "@/components/icons";

const TABS = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/search", label: "Search Meds", Icon: SearchIcon },
  { href: "/my-meds", label: "My Meds", Icon: PillIcon },
  { href: "/summary", label: "Summary", Icon: ClipboardIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-card/95 backdrop-blur">
      <div className="pb-safe mx-auto flex max-w-lg">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition " +
                (active
                  ? "text-brand-600"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              <Icon width={24} height={24} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
