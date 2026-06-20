import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DownloadSummaryButton } from "@/components/DownloadSummaryButton";
import { formatNZDate } from "@/lib/date";
import type {
  PatientDetails,
  PatientMedicationWithRef,
} from "@/lib/types";
import {
  UserIcon,
  AlertIcon,
  ShieldIcon,
  PillIcon,
  PencilIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SummaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: detailsData }, { data: medsData }] = await Promise.all([
    supabase.from("patient_details").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("patient_medications")
      .select("*, total_medications(medication_name, brands)")
      .order("created_at", { ascending: false }),
  ]);

  const d = (detailsData ?? null) as PatientDetails | null;
  const meds = (medsData ?? []) as PatientMedicationWithRef[];
  const fullName = [d?.first_name, d?.last_name].filter(Boolean).join(" ");

  return (
    <div>
      {/* Download banner */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-slate-200 bg-card p-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Medical Summary</h1>
          <p className="text-sm text-slate-500">
            Download to share with your doctor.
          </p>
        </div>
        <DownloadSummaryButton userId={user.id} />
      </div>

      <div className="space-y-4">
        <Card
          icon={<UserIcon width={18} height={18} />}
          title="Profile Information"
          editHref="/settings"
        >
          <Grid>
            <Item label="Full Name" value={fullName || null} />
            <Item label="Date of Birth" value={formatNZDateOrNull(d?.date_of_birth)} />
            <Item label="NHI Number" value={d?.nhi_number} />
          </Grid>
        </Card>

        <Card
          icon={<AlertIcon width={18} height={18} />}
          title="Emergency Contact"
          editHref="/settings"
        >
          <Grid>
            <Item label="Contact Name" value={d?.emergency_contact_name} />
            <Item label="Phone Number" value={d?.emergency_contact_phone} />
          </Grid>
        </Card>

        <Card
          icon={<AlertIcon width={18} height={18} />}
          title="Allergies"
          editHref="/settings"
        >
          <p className="text-slate-700">
            {d?.allergies || (
              <span className="text-slate-400">None recorded</span>
            )}
          </p>
        </Card>

        <Card
          icon={<ShieldIcon width={18} height={18} />}
          title="Healthcare Providers"
          editHref="/settings"
        >
          <Grid>
            <Item label="GP / Doctor" value={d?.primary_gp} />
            <Item label="Pharmacy" value={d?.pharmacy_name} />
            <Item label="Pharmacy Phone" value={d?.pharmacy_phone} />
          </Grid>
        </Card>

        <Card
          icon={<PillIcon width={18} height={18} />}
          title="Current Medications"
          editHref="/my-meds"
          badge={meds.length}
        >
          {meds.length === 0 ? (
            <p className="text-slate-400">No medications recorded.</p>
          ) : (
            <ul className="space-y-2">
              {meds.map((m) => {
                const name =
                  m.total_medications?.medication_name ?? "Medication";
                const dose = [m.dosage, m.frequency]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={m.id}
                    className="rounded-lg bg-slate-50 p-3"
                  >
                    <p className="font-semibold text-slate-900">{name}</p>
                    {dose ? (
                      <p className="text-sm text-slate-600">{dose}</p>
                    ) : null}
                    {m.instructions ? (
                      <p className="text-sm text-slate-500">
                        {m.instructions}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-slate-400">
                      Since {formatNZDate(m.start_date)}
                      {m.end_date
                        ? ` · Until ${formatNZDate(m.end_date)}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatNZDateOrNull(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatNZDate(iso);
}

function Card({
  icon,
  title,
  editHref,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  editHref: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icon}
          </span>
          {title}
          {typeof badge === "number" ? (
            <span className="ml-1 rounded-md bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
              {badge}
            </span>
          ) : null}
        </h2>
        <Link
          href={editHref}
          aria-label={`Edit ${title}`}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
        >
          <PencilIcon width={16} height={16} />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>;
}

function Item({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900">
        {value || <span className="font-normal text-slate-400">—</span>}
      </dd>
    </div>
  );
}
