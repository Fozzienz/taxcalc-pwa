import Link from "next/link";
import { DISCLAIMER } from "@/lib/ato-rules";
import { BrandLogo } from "@/components/BrandLogo";

const TOPICS: { title: string; body: string }[] = [
  {
    title: "What TaxTrack is",
    body: DISCLAIMER,
  },
  {
    title: "Where your records live",
    body: "Income years, working-from-home hours, expenses, and attached files stay in this browser. TaxTrack has no account and does not send your records to a server. Use Data and backup in the menu to export a JSON file before you clear the browser, and import that file on another device. A backup is the only copy if this browser is wiped.",
  },
  {
    title: "Working from home",
    body: "Mark the days you actually worked from home. The calendar fills 7.6 hours for a standard day and leaves weekends, national public holidays, and Queensland public holidays empty, including the Brisbane Ekka holiday. Change any day to the hours you worked. The fixed rate is 70 cents an hour. TaxTrack drops the cents and shows a whole-dollar amount, which is what you enter in myTax. Do not also claim the phone, internet, or stationery costs that the fixed rate already covers. For 2027–28, confirm the rate with the ATO before you lodge. That year appears in the list from 1 July 2027.",
  },
  {
    title: "Receipts and invoices",
    body: "On Receipts, attach a photo, a PDF, or a Word document (.doc or .docx). On a computer you can drop the file onto the receipt box. Photos are reduced to a readable JPEG. PDF and Word files are kept as the original file. The same file is included when you export a backup. Open a saved invoice from the expense to view a photo or PDF, or to download a Word document.",
  },
  {
    title: "What the totals leave out",
    body: "Equipment and tools over $300 are marked as depreciating assets and are not included in the immediate deduction total. TaxTrack does not calculate decline in value. Donations under $2 are not deductible, and a donation of $2 or more stays out of the total until you confirm it was to a deductible gift recipient. Laundry uses $1 a work-only load and 50 cents a mixed load. If that claim is more than $150, keep written evidence. Occupation-specific clothing and protective items are not the laundry shortcut.",
  },
  {
    title: "Copying figures into myTax",
    body: "The Summary tab is the list to transcribe. Working-from-home hours and the whole-dollar amount sit with the other categories. Copy summary puts that text on the clipboard. Type the figures into ATO myTax yourself. TaxTrack does not lodge a return.",
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/" className="text-sm font-semibold text-mint">
        ← Back to TaxTrack
      </Link>
      <div className="mt-4">
        <BrandLogo />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Help and disclaimers</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-fog">
        A short guide to the organiser. The rules below are the ones TaxTrack applies. They are not personal tax advice.
      </p>
      <div className="mt-6 space-y-3">
        {TOPICS.map((topic) => (
          <section key={topic.title} className="panel rounded-2xl p-4 sm:p-5">
            <h2 className="font-semibold">{topic.title}</h2>
            <p className="mt-2 text-sm leading-6 text-fog">{topic.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
