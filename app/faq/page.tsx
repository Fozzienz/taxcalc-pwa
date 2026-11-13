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
    body: "Sign in before the summary. TaxTrack encrypts the income years, hours, expenses, assets, rentals, and receipt files on this device, then stores only unreadable text. That is the zero-knowledge model: the server cannot read the records or the recovery key. Signing in on another device opens the same records. Log off returns to the sign-in page.",
  },
  {
    title: "Recovery key",
    body: "The recovery key is shown once, on the first sign-in. TaxTrack does not keep a readable copy. Save it somewhere you can still open. A password reset asks for that key. Without it, the new password cannot open the records.",
  },
  {
    title: "Change password",
    body: "Menu, Account, then Change password. Enter the current password and the new one. TaxTrack wraps the records with the new password on this device. The recovery key stays the same. Forgot password is for when you cannot sign in, and that path asks for the recovery key.",
  },
  {
    title: "Another device",
    body: "Sign in with the same email and password. TaxTrack opens that account's records on this device. Changes are encrypted here and stored with the account, so the next sign-in opens the latest save. Data and backup still exports a JSON file you can keep yourself.",
  },
  {
    title: "Working from home",
    body: "Mark the days you actually worked from home. The calendar fills 7.6 hours for a standard day and leaves weekends, national public holidays, and Queensland public holidays empty, including the Brisbane Ekka holiday. Change any day to the hours you worked. The fixed rate is 70 cents an hour. TaxTrack drops the cents and shows a whole-dollar amount, which is what you enter in myTax. Do not also claim the phone, internet, or stationery costs that the fixed rate already covers. For 2027–28, confirm the rate with the ATO before you lodge. That year appears in the list from 1 July 2027.",
  },
  {
    title: "Receipts and invoices",
    body: "On Expenses, attach a photo, a PDF, or a Word document (.doc or .docx). On a computer you can drop the file onto the receipt box. Photos are reduced to a readable JPEG. PDF and Word files are kept as the original file. The file is encrypted with your records before upload, and it is included in a JSON backup. Open a saved invoice from the expense to view a photo or PDF, or to download a Word document.",
  },
  {
    title: "Car kilometres",
    body: "On Expenses, choose Car (cents per km). Enter the work kilometres and TaxTrack multiplies them by the ATO rate for that income year: 88 cents in 2025–26 and 91 cents in 2026–27. The claim stops at 5,000 km for each car. The rate already covers fuel, registration, insurance, servicing, and decline in value. Keep a note of how you worked out the kilometres. Trips between home and your regular workplace are not included.",
  },
  {
    title: "What the totals leave out",
    body: "Equipment and tools over $300 are marked as depreciating assets and are not included in the immediate deduction total. Add them under Assets. TaxTrack works out prime cost or diminishing value for each income year, using the days you held the item divided by 365, and drops the cents. An item of $300 or less, used mainly for work, is an immediate deduction in the year you first used it. Donations under $2 are not deductible, and a donation of $2 or more stays out of the total until you confirm it was to a deductible gift recipient. Laundry uses $1 a work-only load and 50 cents a mixed load. If that claim is more than $150, keep written evidence. Occupation-specific clothing and protective items are not the laundry shortcut.",
  },
  {
    title: "Copying figures into myTax",
    body: "The Summary tab is the list to transcribe. Working-from-home hours and the whole-dollar amount sit with the other categories. If rental properties are enabled, their expenses are a separate total. Copy summary puts that text on the clipboard. Excel report and PDF report, on the summary and under Data and backup, download the hours, expenses, and totals for the selected income year. Type the figures into ATO myTax yourself. TaxTrack does not lodge a return.",
  },
  {
    title: "Rental properties",
    body: "Turn on Enable Rental Properties in the menu. For each address, log the rent you were paid and the expenses you paid: advertising, body corporate, borrowing costs, cleaning, council rates, gardening, insurance, loan interest, land tax, legal costs, pest control, agent fees, repairs, phone and postage, and water. Rent is income. The expense total is separate, and the cents are dropped. The summary and the Excel and PDF reports include them while the switch is on. Turn it off and the section hides. The records stay saved and travel in the encrypted copy. TaxTrack does not split private use, work out decline in value, or decide if a cost is a repair or a capital improvement.",
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
