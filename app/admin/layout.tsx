import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  // Hide the admin area entirely from non-admins.
  if (!user) notFound();

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-bold">MedList Admin</span>
            <span className="rounded bg-slate-700 px-2 py-0.5 text-xs">
              {user.email}
            </span>
          </div>
          <Link href="/home" className="text-sm text-slate-300 hover:text-white">
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
