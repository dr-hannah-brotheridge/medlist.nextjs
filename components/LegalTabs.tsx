"use client";

import { useState } from "react";

type TabKey = "disclaimer" | "terms" | "privacy";

const TABS: { key: TabKey; label: string }[] = [
  { key: "disclaimer", label: "Disclaimer" },
  { key: "terms", label: "Terms" },
  { key: "privacy", label: "Privacy" },
];

export function LegalTabs() {
  const [tab, setTab] = useState<TabKey>("disclaimer");

  return (
    <div>
      <div className="mb-4 flex rounded-lg border border-slate-200 bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition " +
              (tab === t.key
                ? "bg-brand-600 text-white"
                : "text-slate-500 hover:text-slate-800")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-card p-5">
        {tab === "disclaimer" ? <Disclaimer /> : null}
        {tab === "terms" ? <Terms /> : null}
        {tab === "privacy" ? <Privacy /> : null}
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 text-sm font-semibold text-brand-700 first:mt-0">
      {children}
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-slate-700">{children}</p>;
}
function UL({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  );
}

function Disclaimer() {
  return (
    <div>
      <H>1. Purpose of MedList</H>
      <P>
        MedList is a personal medication management application designed to help
        users record, organise, and collate information about their medications
        for their own reference and to facilitate communication with healthcare
        professionals. MedList is intended for educational and informational
        purposes only.
      </P>
      <H>2. Not a Medical or Prescribing Tool</H>
      <P>
        MedList is NOT a medical device, prescribing tool, or clinical decision
        support system. The application does not:
      </P>
      <UL
        items={[
          "Provide medical advice, diagnosis, or treatment recommendations",
          "Replace the advice, judgment, or expertise of a licensed healthcare professional",
          "Prescribe, recommend, or endorse any medication, dosage, or treatment plan",
          "Verify the clinical accuracy or appropriateness of any medication information entered by the user",
          "Provide real-time alerts for drug interactions, contraindications, or adverse effects",
        ]}
      />
      <P>
        Nothing contained within MedList should be interpreted as medical advice
        or used as a substitute for professional medical consultation, diagnosis,
        or treatment.
      </P>
      <H>3. Educational Medication Content</H>
      <P>
        Educational content has been generated with the assistance of artificial
        intelligence and reviewed and validated by Dr Hannah Brotheridge
        (MBChB). While every effort has been made to ensure clinical accuracy,
        this content is intended for general educational purposes only and may
        not reflect the most current clinical evidence or guidelines. It may not
        apply to your individual health circumstances and should not be used to
        self-diagnose or self-medicate. Always refer to the medication package
        insert and consult your prescribing clinician or pharmacist.
      </P>
      <P>
        While all clinical reference structures are subject to human-in-the-loop
        review protocols against local frameworks, the user acknowledges that
        AI-assisted translation modules can exhibit informational anomalies,
        localised discrepancies, or omissions. MedList and its operators make no
        guarantees regarding algorithmic perfection and accept no liability for
        data anomalies emerging from automated synthesis models.
      </P>
      <H>4. Medication Database and Brand Name Updates</H>
      <P>
        The MedList medication database, including brand names, is reviewed and
        updated approximately every three months in line with changes to the New
        Zealand Universal List of Medicines (NZULM) and Medsafe approvals.
        MedList cannot guarantee that all information is current at the time of
        viewing. Always confirm current brand name availability and prescribing
        information with your pharmacist or prescribing clinician.
      </P>
      <H>5. Emergency Situations</H>
      <P>
        MedList is not designed for use in medical emergencies. If you are
        experiencing a medical emergency, call 111 (New Zealand) or attend your
        nearest emergency department immediately. For urgent concerns, contact
        your doctor, pharmacist, or Healthline (0800 611 116).
      </P>
      <H>6. Limitation of Liability</H>
      <P>
        To the fullest extent permitted by New Zealand law, Dr Hannah Brotheridge
        and MedList accept no liability for any loss, harm, injury, or damage
        arising from your use of or reliance upon information within this
        application.
      </P>
    </div>
  );
}

function Terms() {
  return (
    <div>
      <H>1. Acceptance of Terms</H>
      <P>
        By registering for and using MedList, you confirm that you are 16 years
        of age or older (or using the App under parental/guardian supervision),
        that you have read and agree to these Terms, the Medical Disclaimer, and
        the Privacy Policy, that you understand MedList is not a medical device
        or prescribing tool, and that you accept full responsibility for how you
        use the information within the App.
      </P>
      <H>2. User Account</H>
      <P>
        You must create an account using a valid email address and password. You
        are responsible for maintaining the confidentiality of your credentials,
        all activity under your account, and notifying us of any unauthorised
        access.
      </P>
      <H>3. Acceptable Use</H>
      <P>You agree to use MedList only for personal medication management. You must not:</P>
      <UL
        items={[
          "Use the App for any unlawful or fraudulent purpose",
          "Enter false or misleading information into the App",
          "Attempt to gain unauthorised access to any other user's data",
          "Damage, disable, or impair the App's functionality",
          "Reverse engineer, copy, or reproduce any part of the App without permission",
          "Use the App as a substitute for professional medical advice, diagnosis, or treatment",
        ]}
      />
      <H>4. Accuracy of Information</H>
      <P>
        You are solely responsible for ensuring all information you enter is
        accurate and up to date. MedList does not verify user-entered data.
        Always review your summary with a qualified healthcare professional
        before using it for clinical purposes.
      </P>
      <H>5. Third-Party Services</H>
      <P>
        MedList is built with Next.js and hosted on Vercel (vercel.com); data
        storage and authentication are provided by Supabase (supabase.com). Your
        use of MedList is also subject to the terms of service and privacy
        policies of these providers.
      </P>
      <H>6. Educational Content & AI Assistance</H>
      <P>
        The educational medication content within MedList has been created with
        AI assistance and validated by Dr Hannah Brotheridge (MBChB). While all
        clinical reference structures are subject to human-in-the-loop review
        protocols against local frameworks, the user acknowledges that AI-assisted
        translation modules can exhibit informational anomalies, localised
        discrepancies, or omissions. MedList and its operators make no guarantees
        regarding algorithmic perfection and accept no liability for data
        anomalies emerging from automated synthesis models. We may update,
        modify, or remove educational content at any time without notice.
      </P>
      <H>7. Governing Law</H>
      <P>
        These Terms are governed by the laws of New Zealand and subject to the
        exclusive jurisdiction of the New Zealand courts.
      </P>
      <H>8. Contact</H>
      <P>
        Dr Hannah Brotheridge, Developer, MedList — Christchurch, New Zealand.
        Email: hannah.brotheridge@gmail.com
      </P>
    </div>
  );
}

function Privacy() {
  return (
    <div>
      <P>
        This Privacy Policy explains how MedList, developed by Dr Hannah
        Brotheridge, collects, stores, uses, and protects your personal
        information, in line with the New Zealand Privacy Act 2020 and the Health
        Information Privacy Code 2020.
      </P>
      <H>Information We Collect</H>
      <UL
        items={[
          "Personal details: first name, last name, date of birth, NHI number",
          "Health information: current medications, dosages, frequencies, start/end dates, instructions",
          "Contact information: emergency contact name and phone number",
          "Healthcare provider details: GP/doctor name, pharmacy name and phone number",
          "Allergy information and medication photos (if uploaded)",
          "Account credentials: email and encrypted password (managed by Supabase Auth)",
        ]}
      />
      <H>How We Use Your Information</H>
      <P>
        Your information is used solely to display and manage your medication
        summary, generate a Doctor Summary PDF, authenticate your identity, and
        let you store, edit, and delete your records. We do not use your
        information for marketing and do not sell or share it with third parties
        except as described.
      </P>
      <H>Data Storage and Security</H>
      <P>
        Data is stored on Supabase with Row Level Security (you can only access
        your own data), encrypted connections (HTTPS/TLS), and private storage
        buckets for images. Supabase may store data on servers outside New
        Zealand, including the United States. No method of storage is completely
        secure.
      </P>
      <H>Your Rights</H>
      <P>
        Under the Privacy Act 2020 you may access, correct, or request deletion
        of your information. To exercise these rights, contact
        hannah.brotheridge@gmail.com. If unsatisfied, you may contact the NZ
        Office of the Privacy Commissioner (www.privacy.org.nz, 0800 803 909).
      </P>
      <H>Data Retention</H>
      <P>
        Your data is retained while your account is active. If you delete your
        account, associated personal and health information is permanently
        deleted, though deletion may not be immediate due to backup cycles.
      </P>
    </div>
  );
}
