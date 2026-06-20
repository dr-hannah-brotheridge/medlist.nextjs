import { PageTitle } from "@/components/AppChrome";
import { LegalTabs } from "@/components/LegalTabs";

export default function LegalPage() {
  return (
    <div>
      <PageTitle
        title="Legal Documentation"
        subtitle="Effective 13 May 2026 · Dr Hannah Brotheridge (MBChB), Christchurch, NZ"
      />
      <LegalTabs />
    </div>
  );
}
