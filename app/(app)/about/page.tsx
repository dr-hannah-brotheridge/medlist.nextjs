import { PageTitle } from "@/components/AppChrome";

const PARAGRAPHS = [
  "I am genuinely surprised by how many patients cannot tell me what medications they take — or why they take them. And it isn't a small minority.",
  "It's a very large cohort of people. This has always baffled me because these medications are not trivial. They are taken to protect vital organs, prevent heart attacks, control diabetes, prevent psychosis, and essentially, keep people alive.",
  "Yet many patients take them without really knowing what they do. Listening to a doctor does not necessarily equal understanding or engagement. Considering the potential side effects, cost, daily effort and the fact that these are chemicals entering one's body, you might expect more curiosity.",
  "There are many reasons this happens — patient factors, system factors, and doctor factors. Some patients place full trust in their doctor and feel no need to understand the treatment themselves. Time pressures in consultations mean medication discussions are often brief. Sometimes we assume the patient already knows.",
  "But here is the bigger issue. If patients truly understood what medications they were taking, why they mattered, and what the risks were — I genuinely believe the system would function far better.",
  "Lack of understanding contributes to medication non-adherence. It contributes to overdoses, to polypharmacy and accidental duplication, and to prescribing errors when we rely partly on records and partly on patient recollection — which often don't match.",
  "But there's also a human element. People are far more engaged when they understand what is happening in their own bodies. Understanding treatment makes people more interested in their health, more motivated to care for it, and more capable of managing it.",
  "Patients don't just need prescriptions. They need knowledge. Because the most sustainable healthcare system is one where patients understand their treatment well enough to help manage it themselves.",
];

export default function AboutPage() {
  return (
    <div>
      <PageTitle title="About MedList" />
      <div className="space-y-4 rounded-xl border border-slate-200 bg-card p-5">
        {PARAGRAPHS.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
        <p className="border-t border-slate-100 pt-4 text-sm font-medium text-brand-700">
          — Dr Hannah Brotheridge (MBChB), Christchurch, New Zealand
        </p>
      </div>
    </div>
  );
}
