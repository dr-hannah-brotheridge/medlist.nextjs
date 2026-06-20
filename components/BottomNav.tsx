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
              className={
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition " +
                (active
                  ? "text-brand-600"
                  : "text-slate-400 hover:text-slate-600")
              }
            >
              <Icon width={22} height={22} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
