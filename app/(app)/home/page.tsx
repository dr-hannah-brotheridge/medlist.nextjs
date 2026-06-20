import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  SearchIcon,
  PillIcon,
  ClipboardIcon,
  UserIcon,
  ChevronRightIcon,
} from "@/components/icons";

const CARDS = [
  {
    href: "/search",
    title: "Search Meds",
    desc: "Look up purpose, dosage, and side effects",
    Icon: SearchIcon,
    tint: "bg-brand-50 text-brand-600",
  },
  {
    href: "/my-meds",
    title: "My Medications",
    desc: "Track your current medications",
    Icon: PillIcon,
    tint: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/summary",
    title: "Doctor Summary",
    desc: "Generate a clear summary for an appointment",
    Icon: ClipboardIcon,
    tint: "bg-amber-50 text-amber-600",
  },
  {
    href: "/settings",
    title: "My Profile",
    desc: "Personal details, allergies, contacts",
    Icon: UserIcon,
    tint: "bg-indigo-50 text-indigo-600",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let firstName: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("patient_details")
      .select("first_name")
      .eq("id", user.id)
      .maybeSingle();
    firstName = data?.first_name ?? null;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">
          Welcome{firstName ? `, ${firstName}` : ""}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-brand-600">
          MedList
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          A simple way to track your medications and generate a clear list for
          your doctor.
        </p>
      </div>

      <div className="space-y-3">
        {CARDS.map(({ href, title, desc, Icon, tint }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-card p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tint}`}
            >
              <Icon width={22} height={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">
                {title}
              </span>
              <span className="block truncate text-sm text-slate-500">
                {desc}
              </span>
            </span>
            <ChevronRightIcon
              width={20}
              height={20}
              className="text-slate-300 transition group-hover:text-brand-400"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
