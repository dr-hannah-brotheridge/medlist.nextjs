import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  PatientDetails,
  PatientMedicationWithRef,
} from "@/lib/types";
import { formatNZDate } from "@/lib/date";

/**
 * A clean, well-spaced Medical Summary PDF.
 *
 * react-pdf's layout engine handles word-wrapping and vertical flow, so
 * lines never overlap and text never bunches regardless of content length.
 */

const COLORS = {
  brand: "#0d9488", // brand-600
  brandLight: "#f0fdfa", // brand-50
  ink: "#0f172a", // slate-900
  body: "#334155", // slate-700
  muted: "#64748b", // slate-500
  faint: "#94a3b8", // slate-400
  border: "#e2e8f0", // slate-200
  surface: "#f8fafc", // slate-50
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: COLORS.body,
    lineHeight: 1.6,
  },
  header: {
    paddingBottom: 16,
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.brand,
    borderBottomStyle: "solid",
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.muted,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: COLORS.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: "solid",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    width: "48%",
    marginBottom: 8,
  },
  gridItemFull: {
    width: "100%",
    marginBottom: 8,
  },
  label: {
    fontSize: 9,
    color: COLORS.faint,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  value: {
    fontSize: 11,
    color: COLORS.ink,
    fontFamily: "Helvetica",
  },
  valueMuted: {
    fontSize: 11,
    color: COLORS.faint,
  },
  paragraph: {
    fontSize: 11,
    color: COLORS.body,
    marginBottom: 4,
  },
  medCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "solid",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
  },
  medName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 2,
  },
  medDose: {
    fontSize: 11,
    color: COLORS.body,
    marginBottom: 2,
  },
  medInstructions: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 2,
  },
  medDates: {
    fontSize: 9,
    color: COLORS.faint,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderTopStyle: "solid",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: COLORS.faint,
  },
});

function Field({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string | null | undefined;
  full?: boolean;
}) {
  return (
    <View style={full ? styles.gridItemFull : styles.gridItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={value ? styles.value : styles.valueMuted}>
        {value || "—"}
      </Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function DoctorSummaryPdf({
  details,
  medications,
  generatedAt = new Date(),
}: {
  details: PatientDetails | null;
  medications: PatientMedicationWithRef[];
  generatedAt?: Date;
}) {
  const fullName =
    [details?.first_name, details?.last_name].filter(Boolean).join(" ") ||
    "Unknown patient";

  const generatedLabel = generatedAt.toLocaleString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
    timeZoneName: "short",
  });

  return (
    <Document
      title={`Medical Summary — ${fullName}`}
      author="ScriptPal NZ"
      subject="Patient medical summary"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Medical Summary</Text>
          <Text style={styles.subtitle}>
            {fullName} · Generated {generatedLabel}
          </Text>
        </View>

        {/* Profile */}
        <Section title="Profile Information">
          <View style={styles.grid}>
            <Field label="Full Name" value={fullName} />
            <Field
              label="Date of Birth"
              value={
                details?.date_of_birth
                  ? formatNZDate(details.date_of_birth)
                  : null
              }
            />
            <Field label="NHI Number" value={details?.nhi_number} />
          </View>
        </Section>

        {/* Emergency contact */}
        <Section title="Emergency Contact">
          <View style={styles.grid}>
            <Field
              label="Contact Name"
              value={details?.emergency_contact_name}
            />
            <Field
              label="Phone Number"
              value={details?.emergency_contact_phone}
            />
          </View>
        </Section>

        {/* Allergies */}
        <Section title="Allergies">
          <Text style={styles.paragraph}>
            {details?.allergies || "None recorded"}
          </Text>
        </Section>

        {/* Healthcare providers */}
        <Section title="Healthcare Providers">
          <View style={styles.grid}>
            <Field label="GP / Doctor" value={details?.primary_gp} />
            <Field label="Pharmacy" value={details?.pharmacy_name} />
            <Field
              label="Pharmacy Phone"
              value={details?.pharmacy_phone}
            />
          </View>
        </Section>

        {/* Medications */}
        <Section title={`Current Medications (${medications.length})`}>
          {medications.length === 0 ? (
            <Text style={styles.paragraph}>No medications recorded.</Text>
          ) : (
            medications.map((m) => {
              const name =
                m.total_medications?.medication_name ?? "Medication";
              const dose =
                [m.dosage, m.frequency].filter(Boolean).join(" · ") || null;
              const dateLine = [
                `Since ${formatNZDate(m.start_date)}`,
                m.end_date ? `Until ${formatNZDate(m.end_date)}` : "",
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <View key={m.id} style={styles.medCard}>
                  <Text style={styles.medName}>{name}</Text>
                  {dose ? <Text style={styles.medDose}>{dose}</Text> : null}
                  {m.instructions ? (
                    <Text style={styles.medInstructions}>
                      {m.instructions}
                    </Text>
                  ) : null}
                  {dateLine ? (
                    <Text style={styles.medDates}>{dateLine}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </Section>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>ScriptPal NZ · Medical Summary</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}