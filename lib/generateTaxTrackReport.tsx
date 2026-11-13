"use client";

import type { FinancialYear } from "@/lib/ato-rules";
import { buildYearReport } from "@/lib/report";
import type { DepreciatingAsset, RentalProperty, YearData } from "@/lib/types";

/** The browser build of pdfkit has no built-in Helvetica until these metrics are registered. */
async function registerPdfFonts(): Promise<void> {
  const [pdfkit, ...fonts] = await Promise.all([
    import("@react-pdf/pdfkit"),
    import("@react-pdf/pdfkit/standard-fonts/Courier"),
    import("@react-pdf/pdfkit/standard-fonts/CourierBold"),
    import("@react-pdf/pdfkit/standard-fonts/CourierBoldOblique"),
    import("@react-pdf/pdfkit/standard-fonts/CourierOblique"),
    import("@react-pdf/pdfkit/standard-fonts/Helvetica"),
    import("@react-pdf/pdfkit/standard-fonts/HelveticaBold"),
    import("@react-pdf/pdfkit/standard-fonts/HelveticaBoldOblique"),
    import("@react-pdf/pdfkit/standard-fonts/HelveticaOblique"),
    import("@react-pdf/pdfkit/standard-fonts/Symbol"),
    import("@react-pdf/pdfkit/standard-fonts/TimesBold"),
    import("@react-pdf/pdfkit/standard-fonts/TimesBoldItalic"),
    import("@react-pdf/pdfkit/standard-fonts/TimesItalic"),
    import("@react-pdf/pdfkit/standard-fonts/TimesRoman"),
    import("@react-pdf/pdfkit/standard-fonts/ZapfDingbats"),
  ]);
  const register = (pdfkit as { registerStdFonts?: (...data: unknown[]) => void }).registerStdFonts;
  if (register) register(...fonts.map((font) => ("default" in font ? font.default : font)));
}

async function readDataUrl(path: string): Promise<string> {
  const response = await fetch(path);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadTaxTrackPdf(
  year: FinancialYear,
  data: YearData,
  options: { rentals?: boolean; properties?: readonly RentalProperty[]; assets?: readonly DepreciatingAsset[] } = {},
): Promise<void> {
  const prepared = new Date();
  const report = buildYearReport(year, data, prepared, options);
  const [wordmarkDataUrl, markDataUrl] = await Promise.all([
    readDataUrl("/taxtrack-logo-light.png"),
    readDataUrl("/icons/mark.png"),
  ]);
  await registerPdfFonts();
  const [{ pdf }, { TaxTrackReportDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/TaxTrackReportPdf"),
  ]);
  const blob = await pdf(
    <TaxTrackReportDocument report={report} wordmarkDataUrl={wordmarkDataUrl} markDataUrl={markDataUrl} />,
  ).toBlob();
  saveBlob(`${report.filenameBase}.pdf`, blob);
}

export async function downloadTaxTrackWorkbook(
  year: FinancialYear,
  data: YearData,
  options: { rentals?: boolean; properties?: readonly RentalProperty[]; assets?: readonly DepreciatingAsset[] } = {},
): Promise<void> {
  const { buildTaxTrackWorkbook } = await import("@/lib/reportWorkbook");
  const prepared = new Date();
  const report = buildYearReport(year, data, prepared, options);
  const bytes = buildTaxTrackWorkbook(year, data, prepared, options);
  saveBlob(
    `${report.filenameBase}.xlsx`,
    new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
}
