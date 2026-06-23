export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-600">
            MedList
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Your medications, clearly organised.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm font-medium text-slate-700">{subtitle}</p>
          ) : null}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}

export const fieldClass =
  "min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200";

export const labelClass = "block text-sm font-semibold text-slate-800 mb-1.5";

export const primaryButtonClass =
  "min-h-[52px] w-full rounded-lg bg-brand-600 px-4 py-3.5 font-bold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-60";
