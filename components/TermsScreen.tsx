import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";

const CONTENTS = [
  { id: "acceptance", label: "Acceptance" },
  { id: "service", label: "The service" },
  { id: "not-advice", label: "Not advice" },
  { id: "vault", label: "Password and recovery" },
  { id: "records", label: "Your records" },
  { id: "use", label: "Acceptable use" },
  { id: "ip", label: "Intellectual property" },
  { id: "availability", label: "Availability" },
  { id: "liability", label: "Liability" },
  { id: "acl", label: "Consumer law" },
  { id: "law", label: "Governing law" },
] as const;

export function TermsScreen() {
  return (
    <LegalDocument
      title="Terms"
      subtitle="Rules for using TaxTrack. By creating an account you agree to these terms and the privacy policy."
      lastUpdated="23 November 2026"
      contents={CONTENTS}
    >
      <LegalSection id="acceptance" title="1. Acceptance">
        <p>
          By accessing or using TaxTrack, you agree to these terms and the{" "}
          <Link href="/privacy" className="font-semibold text-mint hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not create an account and do not use the service.
        </p>
        <p>These terms are the whole agreement about the service. A screen label, a help page, or a figure in the app does not add a promise that is not written here.</p>
      </LegalSection>

      <LegalSection id="service" title="2. The service">
        <p>
          TaxTrack is a private record-keeping organiser for Australian income years. You can log working-from-home hours, work expenses, car kilometres, depreciating assets, and rental income and expenses, then export a copy.
        </p>
        <p>
          TaxTrack is a utility for organising what you type in. It is not a registered tax agent, it is not a financial adviser, and it is not part of the Australian Taxation Office, myTax, or myDeductions. It does not prepare a notice of assessment and it does not lodge a return.
        </p>
        <p>The operator of TaxTrack is an individual publishing a software tool. There is no support desk, no review of your records, and no person checking that a claim is allowed.</p>
      </LegalSection>

      <LegalSection id="not-advice" title="3. Not tax or financial advice">
        <p>
          Nothing in TaxTrack is tax advice, financial advice, or a statement of what you are allowed to claim. Totals are estimates made from the dates, amounts, hours, percentages, and categories you enter, using rates stored in the app for that income year.
        </p>
        <p>You must check the rate, your eligibility, and the figures with the ATO or a registered tax agent before you lodge. You are responsible for the return you lodge and for any penalty, interest, or amended assessment that follows from it.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Working from home uses one method for the whole income year, fixed rate or actual costs. The fixed-rate hours and the 70 cent rate are a calculation of what you logged. They are not a decision that the method is available to you. Actual costs do not turn hours into dollars. A work-use percentage is a figure you choose.</li>
          <li>Car expenses use either the cents-per-kilometre rate, up to 5,000 km for each car, or a logbook percentage of the running costs after 12 continuous weeks and a closing odometer. The app does not decide that a trip is work-related. Travel between home and your regular workplace is not included.</li>
          <li>Assets use the cost, the date you first used the item, the work-use percentage, and the effective life you enter. A result under the $300 test, or a decline-in-value amount, is arithmetic. It is not advice that the item is deductible.</li>
          <li>Rental schedules list the rent and expenses you enter for an address. TaxTrack does not split private use, decide whether a cost is a repair or an improvement, or work out capital gains.</li>
          <li>Rates stored in the app can be wrong for a later year, or can change after an ATO update. The rate published by the ATO for the year you are lodging is the one that matters.</li>
        </ul>
      </LegalSection>

      <LegalSection id="vault" title="4. Password, recovery key, and unrecoverable records">
        <p>An account is required. TaxTrack encrypts your records in the browser, on your device, before anything is stored or synced. The server stores unreadable text. This is deliberate.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You are responsible for the password, the recovery key, and the security of your devices.</li>
          <li>The recovery key is shown once. TaxTrack does not keep a readable copy of it, and it cannot be looked up later.</li>
          <li>A sign-in reset changes the login only. It does not unlock records that are already encrypted. Setting a new password that can open those records requires the recovery key.</li>
          <li>If you lose both the password and the recovery key, the encrypted records cannot be decrypted. Not by you, not by TaxTrack, and not by the operator. There is no back door and no reset that restores them.</li>
          <li>One person uses one account. You are responsible for everything you enter, import, attach, or export.</li>
        </ul>
      </LegalSection>

      <LegalSection id="records" title="5. ATO records and your own backups">
        <p>
          You remain responsible for keeping records the ATO can ask for. For many work expenses that period is five years after you lodge. Records for an asset you still hold, or for a capital gains event, can be needed for longer. TaxTrack does not count that period for you and does not store a copy the ATO will accept in place of your own records.
        </p>
        <p>
          Export a zip for an income year while you can still open the account. It holds that year's records, the Excel workbook, the PDF, and each receipt or invoice. Those files are your accessible copy. A receipt photo inside the app is not a substitute for a copy you can open if the password and the recovery key are lost, or if the service is unavailable.
        </p>
        <p>Deleting the account removes the sign-in, the encrypted records, and the copy on that device. A zip you have already saved is the only copy left. Deletion cannot be undone.</p>
      </LegalSection>

      <LegalSection id="use" title="6. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Break into the service, probe it, or try to read another person’s records</li>
          <li>Use the service to store or send malware, or for anything that is a crime</li>
          <li>Upload a file you have no right to store, including a receipt or photo that belongs to someone else</li>
          <li>Scrape the app, or copy its screens and calculations, to build a competing product</li>
          <li>Create accounts in bulk, or attack the sign-in service</li>
        </ul>
        <p>
          Because records are encrypted before they leave the device, TaxTrack cannot read a file to check it. You are still responsible for what you store. To the extent the law allows, you will cover the operator for a claim that comes from your misuse of the service, the content you store, or a return you lodge from these figures. This does not limit a right the Australian Consumer Law says cannot be limited.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="7. Intellectual property">
        <p>The TaxTrack name, logo, software, layout, and help text belong to the operator. These terms do not give you ownership of them.</p>
        <p>You receive a personal, non-exclusive, non-transferable licence to use the app for your own records while you follow these terms. You may not sell access to it.</p>
        <p>You keep ownership of the records you enter. You allow the service to hold the encrypted copy only so it can sync that copy back to you.</p>
        <p>Describing the encryption so you can understand it is not permission to copy the product. A right the law does not let you give up, such as a right to reverse-engineer for interoperability, still applies.</p>
      </LegalSection>

      <LegalSection id="availability" title="8. Availability">
        <p>
          TaxTrack is provided as is and as available. It is a best-effort tool run by one person. It can be slow, wrong, interrupted, or withdrawn. Features can change. A figure, a rate, or a help sentence can be out of date.
        </p>
        <p>
          Sign-in and encrypted storage depend on other companies. Their outages are outside TaxTrack’s control. To the extent the law allows, there is no promise of uninterrupted access, of error-free calculations, or that the service will suit a particular return.
        </p>
        <p>
          If the whole service is going to close, the aim is to say so in the app at least 30 days before it closes, and by email where the account email still works, so you can export. That notice does not apply when an account has to be closed immediately for abuse or for a legal requirement. After the service closes, encrypted records and the account can be deleted.
        </p>
        <p>You can stop using TaxTrack at any time. Export first. The account can be deleted from the menu.</p>
      </LegalSection>

      <LegalSection id="liability" title="9. Limit of liability">
        <p>
          To the maximum extent the law allows, the operator is not liable for indirect or consequential loss, or for lost profit, lost tax refunds, ATO penalties, interest, amended assessments, or records that cannot be decrypted because a password or recovery key was lost.
        </p>
        <p>
          Subject to the next section, the operator’s total liability for all claims in any 12-month period is limited to the fees you paid for TaxTrack in the 12 months before the event. If you paid no fee in that period, that cap is zero.
        </p>
      </LegalSection>

      <LegalSection id="acl" title="10. Australian Consumer Law">
        <p>
          The service comes with guarantees that cannot be excluded under the Australian Consumer Law. Nothing in these terms excludes, restricts, or changes a consumer guarantee, or any other right, that the law does not allow a contract to take away.
        </p>
        <p>
          Where the law does allow liability for a failure to meet a consumer guarantee to be limited, and it is fair to do so, liability is limited to supplying the service again or paying the cost of having the service supplied again.
        </p>
        <p>If you use TaxTrack from outside Australia, a mandatory right in the place you live still applies where that place does not allow you to give it up.</p>
      </LegalSection>

      <LegalSection id="law" title="11. Governing law, privacy, and changes">
        <p>
          These terms are governed by the laws of Queensland, Australia. The courts of Queensland have non-exclusive jurisdiction. A mandatory consumer protection where you live still applies where it cannot be given up.
        </p>
        <p>
          The{" "}
          <Link href="/privacy" className="font-semibold text-mint hover:underline">
            Privacy Policy
          </Link>{" "}
          explains the email address, the encrypted records, and the companies that host them. TaxTrack does not collect a tax file number.
        </p>
        <p>These terms can be updated. A material change will show on this page with a new date. Using the service after that date means you accept the change, where the law allows that.</p>
        <p>If a sentence in these terms cannot be enforced, it is read down or removed only as far as needed. The rest stays in force. The sections on advice, lost passwords, liability, consumer law, and governing law still apply after an account ends.</p>
      </LegalSection>
    </LegalDocument>
  );
}
