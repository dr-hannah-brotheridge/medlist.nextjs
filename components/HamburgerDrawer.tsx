"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MenuIcon,
  CloseIcon,
  UserIcon,
  ClipboardIcon,
  ShieldIcon,
  AlertIcon,
} from "@/components/icons";

const LINKS = [
  { href: "/settings", label: "My Settings", Icon: UserIcon },
  { href: "/account", label: "Account", Icon: ShieldIcon },
  { href: "/legal", label: "Legal Information", Icon: ClipboardIcon },
  { href: "/about", label: "About MedList", Icon: AlertIcon },
];

export function HamburgerDrawer() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100"
      >
        <MenuIcon />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <span className="text-lg font-bold text-brand-600">MedList</span>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {LINKS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
                >
                  <Icon width={20} height={20} />
                  <span className="font-medium">{label}</span>
                </Link>
              ))}
            </nav>
            <div className="border-t border-slate-200 p-3">
              <button
                onClick={signOut}
                className="w-full rounded-lg border border-red-200 px-4 py-2.5 font-semibold text-red-600 transition hover:bg-red-50"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
