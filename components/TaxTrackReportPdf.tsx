"use client";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_PRINT } from "@/lib/pdfPrintTheme";
import type { YearReport } from "@/lib/report";

const WORDMARK_WIDTH = 220;
const WORDMARK_HEIGHT = WORDMARK_WIDTH / (1159 / 344);

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    paddingTop: 46,
    paddingBottom: 52,
    paddingHorizontal: 32,
    backgroundColor: PDF_PRINT.page,
    color: PDF_PRINT.text,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: -16,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: PDF_PRINT.borderLight,
  },
  reportTitle: {
    marginTop: 6,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: PDF_PRINT.textMuted,
  },
  reportMeta: {
    textAlign: "right",
    fontSize: 8,
    color: PDF_PRINT.textSecondary,
    lineHeight: 1.4,
  },
  banner: {
    borderWidth: 1,
    borderColor: PDF_PRINT.warningBorder,
    backgroundColor: PDF_PRINT.warningBg,
    color: PDF_PRINT.warningText,
    padding: 8,
    marginBottom: 10,
  },
  section: { marginTop: 8, marginBottom: 4 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderBottomColor: PDF_PRINT.borderLight,
    alignItems: "flex-start",
  },
  head: { backgroundColor: PDF_PRINT.surface },
  cell: { paddingVertical: 3, paddingHorizontal: 3 },
  headerCell: { fontFamily: "Helvetica-Bold", color: PDF_PRINT.textSecondary },
  right: { textAlign: "right" },
  note: { marginTop: 3, fontSize: 7, color: PDF_PRINT.textMuted, lineHeight: 1.35 },
  total: { marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 9 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: PDF_PRINT.borderLight,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: PDF_PRINT.textMuted, lineHeight: 1.35 },
});

function Logo({ wordmarkDataUrl, markDataUrl, variant }: { wordmarkDataUrl?: string | null; markDataUrl?: string | null; variant: "header" | "continued" }) {
  if (variant === "continued") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {markDataUrl ? <Image src={markDataUrl} style={{ width: 16, height: 16, marginRight: 5 }} /> : null}
        <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: PDF_PRINT.text }}>Tax</Text>
        <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: PDF_PRINT.accent }}>Track</Text>
      </View>
    );
  }
  if (wordmarkDataUrl) {
    return <Image src={wordmarkDataUrl} style={{ width: WORDMARK_WIDTH, height: WORDMARK_HEIGHT }} />;
  }
  return (
    <View style={{ flexDirection: "row" }}>
      <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold" }}>Tax</Text>
      <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: PDF_PRINT.accent }}>Track</Text>
    </View>
  );
}

function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>TaxTrack estimates only. Not an ATO assessment and not tax advice. Check the figures before you lodge.</Text>
      <Text style={[styles.footerText, { textAlign: "right", marginTop: 3 }]} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export function TaxTrackReportDocument({
  report,
  wordmarkDataUrl,
  markDataUrl,
}: {
  report: YearReport;
  wordmarkDataUrl?: string | null;
  markDataUrl?: string | null;
}) {
  const disclaimer = report.footnotes[report.footnotes.length - 1] ?? "";

  return (
    <Document title={`TaxTrack ${report.yearLabel}`} author="TaxTrack" subject="Income year record">
      <Page size="A4" style={styles.page}>
        <View
          fixed
          style={{ position: "absolute", top: 16, left: 32 }}
          render={({ pageNumber }) =>
            pageNumber > 1 ? <Logo markDataUrl={markDataUrl} variant="continued" /> : null
          }
        />

        <View style={styles.header}>
          <View>
            <Logo wordmarkDataUrl={wordmarkDataUrl} variant="header" />
            <Text style={styles.reportTitle}>Income year record</Text>
          </View>
          <View style={styles.reportMeta}>
            <Text>FY {report.yearLabel}</Text>
            <Text>{report.period}</Text>
            <Text>Generated {report.prepared}</Text>
          </View>
        </View>

        <View style={styles.banner}>
          <Text>{disclaimer}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          {report.summaryRows.map((row) => (
            <View key={row.item} style={styles.row}>
              <Text style={[styles.cell, { width: "62%" }]}>{row.item}</Text>
              <Text style={[styles.cell, styles.right, { width: "38%" }]}>{row.enter}</Text>
            </View>
          ))}
          <Text style={styles.total}>Total to enter {report.totalEnter}</Text>
          <Text style={styles.note}>{report.hourNote}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work from home — fixed rate</Text>
          <View style={[styles.row, styles.head]} wrap={false}>
            {["Date", "Mode", "Hours", "Counts", "Notes"].map((cell, index) => (
              <Text key={cell} style={[styles.cell, styles.headerCell, { width: index === 4 ? "34%" : index === 1 ? "22%" : "14%" }]}>
                {cell}
              </Text>
            ))}
          </View>
          {report.hourRows.length === 0 ? (
            <Text style={styles.note}>No days logged.</Text>
          ) : (
            report.hourRows.map((row) => (
              <View key={`${row.date}-${row.mode}`} style={styles.row} wrap={false}>
                <Text style={[styles.cell, { width: "14%" }]}>{row.date}</Text>
                <Text style={[styles.cell, { width: "22%" }]}>{row.mode}</Text>
                <Text style={[styles.cell, { width: "14%" }]}>{row.hours}</Text>
                <Text style={[styles.cell, { width: "16%" }]}>{row.counts}</Text>
                <Text style={[styles.cell, { width: "34%" }]}>{row.notes || "—"}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <View style={[styles.row, styles.head]} wrap={false}>
            <Text style={[styles.cell, styles.headerCell, { flex: 1.2 }]}>Date</Text>
            <Text style={[styles.cell, styles.headerCell, { flex: 2.1 }]}>Description</Text>
            <Text style={[styles.cell, styles.headerCell, { flex: 1.8 }]}>Category</Text>
            <Text style={[styles.cell, styles.headerCell, styles.right, { flex: 1.1 }]}>Amount</Text>
            <Text style={[styles.cell, styles.headerCell, styles.right, { flex: 1.1 }]}>Claim</Text>
          </View>
          {report.expenseRows.length === 0 ? (
            <Text style={styles.note}>No expenses logged.</Text>
          ) : (
            report.expenseRows.map((row, index) => (
              <View key={`${row.date}-${row.description}-${index}`} wrap={false}>
                <View style={styles.row}>
                  <Text style={[styles.cell, { flex: 1.2 }]}>{row.date}</Text>
                  <Text style={[styles.cell, { flex: 2.1 }]}>{row.description}</Text>
                  <Text style={[styles.cell, { flex: 1.8 }]}>{row.category}</Text>
                  <Text style={[styles.cell, styles.right, { flex: 1.1 }]}>{row.amountLabel}</Text>
                  <Text style={[styles.cell, styles.right, { flex: 1.1 }]}>{row.claimLabel}</Text>
                </View>
                {row.included !== "Yes" || row.merchant || row.notes ? (
                  <Text style={[styles.note, { marginTop: 0, marginBottom: 2 }]}>
                    {[row.merchant, row.included !== "Yes" ? row.included : "", row.notes].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {report.assetRows ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Decline in value</Text>
            <View style={[styles.row, styles.head]} wrap={false}>
              <Text style={[styles.cell, styles.headerCell, { flex: 2.2 }]}>Asset</Text>
              <Text style={[styles.cell, styles.headerCell, { flex: 1.6 }]}>Method</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { flex: 0.8 }]}>Days</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { flex: 1.1 }]}>Claim</Text>
            </View>
            {report.assetRows.map((row, index) => (
              <View key={`${row.description}-${index}`} wrap={false}>
                <View style={styles.row}>
                  <Text style={[styles.cell, { flex: 2.2 }]}>{row.description}</Text>
                  <Text style={[styles.cell, { flex: 1.6 }]}>{row.method}</Text>
                  <Text style={[styles.cell, styles.right, { flex: 0.8 }]}>{row.daysHeld}</Text>
                  <Text style={[styles.cell, styles.right, { flex: 1.1 }]}>{row.claimLabel}</Text>
                </View>
                <Text style={[styles.note, { marginTop: 0, marginBottom: 2 }]}>
                  First used {row.purchased}
                  {row.life === "" ? "" : ` · ${row.life} years`} · {row.workUse}% work use
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {report.rentalRows ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental properties</Text>
            <View style={[styles.row, styles.head]} wrap={false}>
              <Text style={[styles.cell, styles.headerCell, { flex: 1.2 }]}>Date</Text>
              <Text style={[styles.cell, styles.headerCell, { flex: 2.2 }]}>Address</Text>
              <Text style={[styles.cell, styles.headerCell, { flex: 1.6 }]}>Category</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { flex: 1.1 }]}>Amount</Text>
            </View>
            {report.rentalRows.length === 0 ? (
              <Text style={styles.note}>No rent or rental expenses logged.</Text>
            ) : (
              report.rentalRows.map((row, index) => (
                <View key={`${row.date}-${row.description}-${index}`} wrap={false}>
                  <View style={styles.row}>
                    <Text style={[styles.cell, { flex: 1.2 }]}>{row.date}</Text>
                    <Text style={[styles.cell, { flex: 2.2 }]}>{row.address}</Text>
                    <Text style={[styles.cell, { flex: 1.6 }]}>{row.category}</Text>
                    <Text style={[styles.cell, styles.right, { flex: 1.1 }]}>{row.amountLabel}</Text>
                  </View>
                  {row.description || row.notes ? (
                    <Text style={[styles.note, { marginTop: 0, marginBottom: 2 }]}>
                      {[row.description, row.notes].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Not in the total</Text>
          {report.exclusions.map((line) => (
            <Text key={line} style={{ marginBottom: 2, lineHeight: 1.35 }}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          {report.footnotes.slice(0, -1).map((line) => (
            <Text key={line} style={styles.note}>
              {line}
            </Text>
          ))}
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
