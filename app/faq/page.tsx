"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DISCLAIMER } from "@/lib/ato-rules";
import { BrandLogo } from "@/components/BrandLogo";

const TOPICS: { id: string; title: string; body: string[] }[] = [
  {
    id: "what-taxtrack-is",
    title: "What TaxTrack is",
    body: [DISCLAIMER],
  },
  {
    id: "records",
    title: "Where your records live",
    body: [
      "Sign in before the summary. TaxTrack encrypts the income years, hours, expenses, assets, rentals, and receipt files on this device, then stores only unreadable text. That is the zero-knowledge model: the server cannot read the records or the recovery key. Signing in on another device opens the same records. Log off, beside the menu, returns to the sign-in page. Data and backup exports a zip of one income year, with the records, the Excel workbook, the PDF, and each receipt or invoice.",
      "Delete account and data, in the menu, asks for your password and the words DELETE MY TAXTRACK. It then removes the sign-in, the encrypted records, and the copy on this device. A zip you already saved is the only copy left. This cannot be undone.",
    ],
  },
  {
    id: "recovery-key",
    title: "Recovery key",
    body: ["The recovery key is shown once, on the first sign-in. TaxTrack does not keep a readable copy. Save it somewhere you can still open. A password reset asks for that key. Without it, the new password cannot open the records."],
  },
  {
    id: "change-password",
    title: "Change password",
    body: ["Menu, Account, then Change password. Enter the current password and the new one. TaxTrack wraps the records with the new password on this device. The recovery key stays the same. Forgot password is for when you cannot sign in, and that path asks for the recovery key."],
  },
  {
    id: "another-device",
    title: "Another device",
    body: ["Sign in with the same email and password. TaxTrack opens that account's records on this device. Changes are encrypted here and stored with the account, so the next sign-in opens the latest save. Data and backup can also save a zip of one income year, with the Excel workbook, the PDF, and the receipts. That file is yours to keep. Signing in is how the records move to another device."],
  },
  {
    id: "working-from-home",
    title: "Working from home",
    body: [
      "The ATO lets you use one method for an income year. Fixed rate, or actual costs. Use the switch at the top of TaxTrack. Do not add 70 cents an hour on top of the same power, phone, internet, or stationery bills.",
      "Fixed rate. The ATO allows 70 cents for each hour you actually worked from home. TaxTrack multiplies the hours on the calendar by 70 cents, then drops the cents. Ten hours is $7. That rate is allowed to stand in for electricity and gas, phone, internet, and stationery and computer consumables. Keep at least one of those bills. Leave the bills out of Expenses, because the rate already covers them. The hours must be hours you worked, not a guess. A desk, computer, or other asset is still claimed on its own, under Assets.",
      "Actual costs. The ATO allows the work share of what you actually paid, instead of 70 cents an hour. The hours on the calendar are only the record that you worked from home. They do not become dollars. On Expenses, add each bill under Electricity and gas, Phone, Internet, or Stationery and consumables, and set Work use %. A $420 power bill at 15% work use is a $63 claim. Phone, internet, and stationery use the same step. A four-week pattern of your work calls and data is a common way to choose the phone and internet percentage. Keep each bill.",
      "TaxTrack does not include rent, mortgage interest, or council rates on your own home in either method. Usual working days are set in the menu. A usual day with nothing logged is an office day, and it does not add hours. Other days are shaded, and any day can still be changed. Mark Not working for a day you were not employed, such as between jobs. A standard day is set in the menu. Saving a new standard asks whether it applies to new days, or to work-from-home days already logged in that year. National public holidays and Queensland public holidays stay empty, including the Brisbane Ekka holiday. For 2027–28, confirm the hourly rate with the ATO before you lodge. That year appears in the list from 1 July 2027.",
    ],
  },
  {
    id: "receipts",
    title: "Receipts and invoices",
    body: ["On Expenses, attach a photo, a PDF, or a Word document (.doc or .docx). On a computer you can drop the file onto the receipt box. A photo is reduced to a smaller JPEG that still reads when you open it. PDF and Word files are kept as the original file. The file is encrypted with your records before upload. The zip backup includes it as its own file. Open a saved invoice and it fills the screen. A Word invoice downloads instead."],
  },
  {
    id: "car-kilometres",
    title: "Car kilometres",
    body: ["On Expenses, choose Car (cents per km). Enter the work kilometres and TaxTrack multiplies them by the ATO rate for that income year: 88 cents in 2025–26 and 91 cents in 2026–27. The claim stops at 5,000 km for each car. The rate already covers fuel, registration, insurance, servicing, and decline in value. Keep a note of how you worked out the kilometres. Trips between home and your regular workplace are not included."],
  },
  {
    id: "totals",
    title: "What the totals leave out",
    body: ["Equipment and tools over $300 are marked as depreciating assets and are not included in the immediate deduction total. Add them under Assets. TaxTrack works out prime cost or diminishing value for each income year, using the days you held the item divided by 365, and drops the cents. An item of $300 or less, used mainly for work, is an immediate deduction in the year you first used it. Donations under $2 are not deductible, and a donation of $2 or more stays out of the total until you confirm it was to a deductible gift recipient. Laundry uses $1 a work-only load and 50 cents a mixed load. If that claim is more than $150, keep written evidence. Occupation-specific clothing and protective items are not the laundry shortcut."],
  },
  {
    id: "mytax",
    title: "Copying figures into myTax",
    body: ["The Summary tab is the list to transcribe. Working-from-home hours and the whole-dollar amount sit with the other categories. If rental properties are enabled, their expenses are a separate total. Copy summary puts that text on the clipboard. Excel report and PDF report, on the summary and under Data and backup, download the hours, expenses, and totals for the selected income year. Type the figures into ATO myTax yourself. TaxTrack does not lodge a return."],
  },
  {
    id: "rentals",
    title: "Rental properties",
    body: ["Turn on Enable Rental Properties in the menu. For each address, log the rent you were paid and the expenses you paid: advertising, body corporate, borrowing costs, cleaning, council rates, gardening, insurance, loan interest, land tax, legal costs, pest control, agent fees, repairs, phone and postage, and water. Rent is income. The expense total is separate, and the cents are dropped. The summary and the Excel and PDF reports include them while the switch is on. Turn it off and the section hides. The records stay saved and travel in the encrypted copy. TaxTrack does not split private use, work out decline in value, or decide if a cost is a repair or a capital improvement."],
  },
];

const SCROLL_OFFSET = 120;

function activeTopic(): string {
  let current = TOPICS[0].id;
  for (const topic of TOPICS) {
    const section = document.getElementById(topic.id);
    if (section && section.getBoundingClientRect().top <= SCROLL_OFFSET) current = topic.id;
  }
  return current;
}

export default function FaqPage() {
  const listRef = useRef<HTMLUListElement>(null);
  const [activeId, setActiveId] = useState(TOPICS[0].id);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (TOPICS.some((topic) => topic.id === hash)) {
      document.getElementById(hash)?.scrollIntoView();
    }
    const sync = () => setActiveId(activeTopic());
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("hashchange", sync);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector(`a[href="#${activeId}"]`);
    if (!list || !(link instanceof HTMLElement)) return;
    const listRect = list.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top < listRect.top) list.scrollTop -= listRect.top - linkRect.top;
    else if (linkRect.bottom > listRect.bottom) list.scrollTop += linkRect.bottom - listRect.bottom;
    if (linkRect.left < listRect.left) list.scrollLeft -= listRect.left - linkRect.left;
    else if (linkRect.right > listRect.right) list.scrollLeft += linkRect.right - listRect.right;
  }, [activeId]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
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
      <p className="mt-3 text-sm font-semibold">
        <Link href="/terms" className="text-mint hover:underline">
          Terms
        </Link>
        <span className="px-2 font-normal text-fog">·</span>
        <Link href="/privacy" className="text-mint hover:underline">
          Privacy
        </Link>
      </p>
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(11.5rem,15rem)_1fr] lg:items-start lg:gap-8">
        <nav
          aria-label="Help topics"
          className="sticky top-4 z-30 mb-6 rounded-xl border border-line bg-panel/95 p-3 backdrop-blur lg:top-6 lg:mb-0 lg:max-h-[calc(100vh-3rem)] lg:self-start"
        >
          <p className="mb-2 hidden text-[10px] font-bold uppercase tracking-[0.16em] text-fog lg:block">On this page</p>
          <ul ref={listRef} className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[calc(100vh-6rem)] lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
            {TOPICS.map((topic) => {
              const active = activeId === topic.id;
              return (
                <li key={topic.id} className="shrink-0 lg:shrink">
                  <a
                    href={`#${topic.id}`}
                    aria-current={active ? "location" : undefined}
                    className={
                      active
                        ? "block rounded-lg border border-mint/40 bg-mint/10 px-3 py-1.5 text-xs font-semibold text-mint lg:border-transparent lg:border-l-2 lg:border-l-mint lg:py-2 lg:pl-[calc(0.75rem-2px)] lg:text-[13px]"
                        : "block rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-fog transition hover:border-line hover:bg-ink/40 hover:text-paper lg:border-0 lg:py-2 lg:text-[13px]"
                    }
                  >
                    {topic.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0 space-y-3">
          {TOPICS.map((topic) => (
            <section key={topic.id} id={topic.id} className="panel scroll-mt-28 rounded-2xl p-4 sm:p-5 lg:scroll-mt-6">
              <h2 className="font-semibold">{topic.title}</h2>
              <div className="mt-2 space-y-3">
                {topic.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-6 text-fog">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
