import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";

/**
 * Persistent authenticated shell: sticky top bar (wordmark + menu) and a fixed
 * bottom navigation. Rendered once by the (app) route-group layout.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/home" className="text-xl font-extrabold text-brand-600">
            MedList
          </Link>
          <HamburgerDrawer />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-5">{children}</main>

      <BottomNav />
    </div>
  );
}

/** Lightweight section header used at the top of each page's content. */
export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}
