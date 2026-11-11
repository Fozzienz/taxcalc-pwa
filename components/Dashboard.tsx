"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { DISCLAIMER, FIXED_RATE_INCLUDES, type FinancialYear } from "@/lib/ato-rules";
import { daysLeftInYear, formatMediumDate, formatPeriod, yearStatus } from "@/lib/dates";
import { formatCents, formatHours, formatWholeDollars, toCents } from "@/lib/money";
import type { SummaryModel } from "@/lib/summary";
import { modeById, type DayLog, type Expense } from "@/lib/types";
import { buttonClass, cx, Panel } from "@/components/ui";

export function Dashboard({
  year,
  summary,
  logs,
  expenses,
  onOpenDay,
  onEditExpense,
  onBrowse,
}: {
  year: FinancialYear;
  summary: SummaryModel;
  logs: DayLog[];
  expenses: Expense[];
  onOpenDay: (date: string) => void;
  onEditExpense: (id: string) => void;
  onBrowse: (tab: "calendar" | "expenses") => void;
}) {
  const figures = summary.figures;
  const status = yearStatus(year);
  const remaining = daysLeftInYear(year);
  const maxCents = Math.max(
    figures.wfhCents,
    figures.clothing.cents,
    figures.laundry.cents,
    figures.donations.cents,
    figures.selfEducation.cents,
    figures.tools.cents,
    figures.subscriptions.cents,
    figures.other.cents,
    figures.taxAffairs.cents,
    1,
  );
  const rows = [
    ["Working from home", figures.wfhCents],
    ["Clothing / uniforms", figures.clothing.cents],
    ["Laundry", figures.laundry.cents],
    ["Donations", figures.donations.cents],
    ["Self-education", figures.selfEducation.cents],
    ["Tools and equipment", figures.tools.cents],
    ["Subscriptions", figures.subscriptions.cents],
    ["Other work expenses", figures.other.cents],
    ["Tax agent fees", figures.taxAffairs.cents],
  ] as const;
  const heldCents =
    figures.depreciating.reduce((sum, expense) => sum + toCents(expense.amount), 0) +
    figures.heldDonations.reduce((sum, expense) => sum + toCents(expense.amount), 0) +
    figures.smallDonations.reduce((sum, expense) => sum + toCents(expense.amount), 0);
  const activity = [
    ...logs.map((log) => ({ kind: "day" as const, date: log.date, log })),
    ...expenses.map((expense) => ({ kind: "expense" as const, date: expense.date, expense })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-mint">{year.label} income year</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Ready when you are</h2>
          <p className="mt-1 text-sm text-fog">{formatPeriod(year.start, year.end)}</p>
        </div>
        <p className="text-sm text-fog">
          {status === "current" && remaining !== null ? `${remaining} days left in this income year` : null}
          {status === "ended" ? "This income year has ended. These figures are for that return." : null}
          {status === "upcoming" ? "This income year has not started." : null}
        </p>
      </div>

      <Panel>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Working from home"
            value={formatWholeDollars(figures.wfhDollars)}
            detail={`${formatHours(figures.wfhHours)} h × ${formatCents(year.wfhCentsPerHour)} = ${formatCents(figures.wfhCents)}`}
          />
          <Stat
            label="Receipts logged"
            value={formatCents(figures.receiptsCents)}
            detail={`${figures.receiptCount} item${figures.receiptCount === 1 ? "" : "s"} · full amounts`}
          />
          <Stat
            label="Estimated claim"
            value={formatWholeDollars(summary.totalDollars)}
            detail="Whole dollars to type into myTax"
          />
        </div>
        <div className="mt-6 space-y-3">
          {rows.map(([label, cents]) => (
            <div key={label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className={cents > 0 ? "text-paper" : "text-fog"}>{label}</span>
                <span className="font-mono text-fog">{formatCents(cents)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-paper/10">
                <div className="h-full rounded-full bg-mint" style={{ width: cents > 0 ? `${Math.max(4, (cents / maxCents) * 100)}%` : "0%" }} />
              </div>
            </div>
          ))}
        </div>
        {heldCents > 0 ? (
          <p className="mt-4 text-sm text-gold">
            {formatCents(heldCents)} is logged but held out of the estimate. Depreciating assets, unconfirmed gifts, and gifts under $2 are listed in the myTax summary.
          </p>
        ) : (
          <p className="mt-4 text-sm text-fog">Nothing over $300 is waiting on decline in value.</p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SummaryCard summary={summary} />
        <div className="space-y-4">
          <Panel>
            <h3 className="font-semibold">Already inside the 70 cent rate</h3>
            <ul className="mt-3 space-y-2 text-sm text-fog">
              {FIXED_RATE_INCLUDES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-fog">Do not also enter these as separate expenses.</p>
          </Panel>
          <Panel>
            <h3 className="font-semibold">Latest entries</h3>
            {activity.length === 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-fog">Log a working-from-home day or a receipt to build the estimate.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass.primary} onClick={() => onBrowse("calendar")}>
                    Open calendar
                  </button>
                  <button type="button" className={buttonClass.ghost} onClick={() => onBrowse("expenses")}>
                    Add a receipt
                  </button>
                </div>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {activity.map((item) =>
                  item.kind === "day" ? (
                    <li key={`day-${item.date}`}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 text-left text-sm" onClick={() => onOpenDay(item.date)}>
                        <span>
                          {formatMediumDate(item.date)} · {modeById(item.log.mode).label}
                        </span>
                        <span className="font-mono text-fog">{item.log.mode === "wfh" ? `${formatHours(item.log.hours)} h` : "—"}</span>
                      </button>
                    </li>
                  ) : (
                    <li key={item.expense.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 text-left text-sm" onClick={() => onEditExpense(item.expense.id)}>
                        <span className="truncate">
                          {formatMediumDate(item.date)} · {item.expense.description}
                        </span>
                        <span className="shrink-0 font-mono text-fog">{formatCents(toCents(item.expense.amount))}</span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel>
        <h3 className="font-semibold">Before you lodge</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-fog">
          <li>Keep this diary for the whole income year. The ATO does not accept an estimate of your hours.</li>
          <li>Keep at least one bill or receipt for each running expense the 70 cent rate covers.</li>
          <li>
            {figures.workExpensesNeedEvidence
              ? "Work-related expenses are over $300, so written evidence is required."
              : "Once work-related expenses go over $300, written evidence is required."}
          </li>
          <li>Confirm every gift is to a deductible gift recipient.</li>
        </ul>
        <p className="mt-4 text-xs leading-5 text-fog">
          {DISCLAIMER}{" "}
          <a className="text-mint underline decoration-mint/40 underline-offset-2" href="https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method" target="_blank" rel="noopener noreferrer">
            ATO fixed rate method
          </a>
          {" · "}
          <a className="text-mint underline decoration-mint/40 underline-offset-2" href="https://www.qld.gov.au/recreation/travel/holidays/public" target="_blank" rel="noopener noreferrer">
            Queensland public holidays
          </a>
        </p>
      </Panel>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-fog">{label}</p>
      <p className="mt-1 font-mono text-3xl tracking-tight text-paper">{value}</p>
      <p className="mt-1 text-xs leading-5 text-fog">{detail}</p>
    </div>
  );
}

function SummaryCard({ summary }: { summary: SummaryModel }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary.text);
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }

  return (
    <Panel className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-mint">Ready for myTax</p>
          <h3 className="mt-1 text-lg font-semibold">Copy these figures</h3>
        </div>
        <button type="button" className={buttonClass.primary} onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy summary"}
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {summary.blocks.map((block) => (
          <section key={block.id}>
            <h4 className="font-medium">{block.title}</h4>
            <p className="text-xs text-fog">{block.kicker}</p>
            <dl className="mt-2 space-y-1">
              {block.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className={row.strong ? "text-paper" : "text-fog"}>{row.label}</dt>
                  <dd className={cx("font-mono", row.strong && "text-mint")}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-fog">Total to enter</p>
          <p className="font-mono text-2xl">{formatWholeDollars(summary.totalDollars)}</p>
        </div>
        <p className="mt-3 text-sm font-medium">{summary.exclusionTitle}</p>
        {summary.exclusionRows.length === 0 ? (
          <p className="mt-1 text-sm text-fog">Nothing is held out of the estimate.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs leading-5 text-gold">
            {summary.exclusionRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-xs leading-5 text-fog" aria-live="polite">
        {copied ? "Summary copied. Paste it beside myTax while you type." : "Cents are dropped on each figure, the way the return asks for whole dollars."}
        {failed ? " Copy was blocked. Select the text below instead." : ""}
      </p>
      {failed ? (
        <textarea readOnly className="mt-3 h-48 w-full rounded-2xl border border-line bg-ink p-3 font-mono text-xs" value={summary.text} />
      ) : null}
    </Panel>
  );
}
