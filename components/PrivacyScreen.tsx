import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";

const CONTENTS = [
  { id: "who", label: "Who we are" },
  { id: "collect", label: "What is collected" },
  { id: "use", label: "How it is used" },
  { id: "vault", label: "Zero-knowledge" },
  { id: "processors", label: "Hosting" },
  { id: "retention", label: "Retention" },
  { id: "rights", label: "Your rights" },
  { id: "children", label: "Children" },
] as const;

export function PrivacyScreen() {
  return (
    <LegalDocument
      title="Privacy"
      subtitle="What TaxTrack holds about you, and what it cannot read."
      lastUpdated="23 November 2026"
      contents={CONTENTS}
    >
      <LegalSection id="who" title="1. Who we are">
        <p>
          TaxTrack is a record-keeping app for Australian income years, operated by an individual. In this policy, “we” means the operator of TaxTrack. The app is not the Australian Taxation Office and it is not a registered tax agent.
        </p>
        <p>
          This policy sits with the{" "}
          <Link href="/terms" className="font-semibold text-mint hover:underline">
            Terms
          </Link>
          . It describes personal information. It does not describe the tax treatment of the figures you enter.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="2. What is collected">
        <p>
          <strong className="text-paper">Account.</strong> An email address, the sign-in record, and the times you sign in. The password is handled by the sign-in service. TaxTrack does not keep a readable copy of it.
        </p>
        <p>
          <strong className="text-paper">Encrypted records.</strong> Income years, hours, expenses, assets, rentals, settings, and receipt files are encrypted in your browser before they are stored. We receive ciphertext, plus the wrapped key material needed for the app to open it on a device where you have the password or the recovery key. We do not receive the password, the recovery key, or the records in a form anyone can read.
        </p>
        <p>
          <strong className="text-paper">On this device.</strong> The browser keeps a local copy so the organiser can open. That copy is also encrypted. Clearing the site data, or deleting the account, removes it from the device.
        </p>
        <p>
          <strong className="text-paper">What we do not collect.</strong> TaxTrack does not ask for a tax file number, a date of birth, or a bank account. It does not take card details. It does not sell personal information, and it does not build an advertising profile from your records.
        </p>
        <p>
          <strong className="text-paper">Technical logs.</strong> The host and the sign-in service keep ordinary operational logs, such as a request time or an error. Those logs are not your decrypted records.
        </p>
      </LegalSection>

      <LegalSection id="use" title="3. How it is used">
        <ul className="list-disc space-y-2 pl-5">
          <li>To create the account and let you sign in</li>
          <li>To store the encrypted copy and return it to a device you unlock</li>
          <li>To send a sign-in email, including a password-reset email you ask for</li>
          <li>To delete the account when you ask, or to close it if the terms require that</li>
          <li>To keep the service secure and to meet a legal duty</li>
        </ul>
        <p>A password-reset email lets you set a new login. It does not decrypt existing records. The recovery key is still required for that, as the terms explain.</p>
      </LegalSection>

      <LegalSection id="vault" title="4. Zero-knowledge">
        <p>The records are encrypted on the device, with keys that come from secrets only you hold.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>The stored copy is unreadable without the password or the recovery key.</li>
          <li>We cannot open, search, or export your hours, expenses, assets, rentals, or receipts.</li>
          <li>We cannot reset a lost password in a way that unlocks existing records.</li>
          <li>If both the password and the recovery key are lost, the records cannot be recovered. That is the design, not a support delay.</li>
        </ul>
        <p>
          <strong className="text-paper">What can still be seen</strong> is the account email, the fact that an encrypted blob exists, its size, and the sign-in timestamps. That metadata is personal information. It is not the contents of the vault.
        </p>
      </LegalSection>

      <LegalSection id="processors" title="5. Who else handles it">
        <p>
          Sign-in and the encrypted store are provided by Supabase. The website is hosted on Vercel. Those providers process the account email, authentication data, and ciphertext on our behalf. They may store that data outside Australia.
        </p>
        <p>They do not receive your password, your recovery key, or a readable copy of the records. Their own outages can stop sign-in or sync. Export a copy of your own while you can.</p>
        <p>We do not give your information to advertisers, and we do not give the encrypted records to the ATO. A report leaves the app only when you download it or copy it yourself.</p>
      </LegalSection>

      <LegalSection id="retention" title="6. How long it is kept">
        <p>The account email and the encrypted records stay while the account exists. Delete account and data, in the menu, removes the sign-in and the stored records. That deletion is permanent.</p>
        <p>A JSON, Excel, or PDF file you have already downloaded stays wherever you saved it. TaxTrack cannot delete a copy on your computer.</p>
        <p>Operational logs are kept only as long as the host and the sign-in service keep them for security.</p>
      </LegalSection>

      <LegalSection id="rights" title="7. Your rights">
        <p>
          You can see the email on the account, and you can delete the account yourself. Because the records are encrypted with keys we do not have, we cannot decrypt them to send you a copy. Export from inside the app while it is unlocked.
        </p>
        <p>
          A small operator under the Privacy Act’s turnover threshold is not always an APP entity. This policy is published anyway. Access and deletion of the account are the tools in the app. If you believe the email or the account metadata has been mishandled, you can complain to the Office of the Australian Information Commissioner.
        </p>
      </LegalSection>

      <LegalSection id="children" title="8. Children and changes">
        <p>TaxTrack is not directed at children under 16. We do not knowingly collect an account for a child. A parent who believes a child has created an account can delete it from that account’s menu.</p>
        <p>This policy can change. A material change will show on this page with a new date.</p>
      </LegalSection>
    </LegalDocument>
  );
}
