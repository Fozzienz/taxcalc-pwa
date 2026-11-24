"use client";

import { useState } from "react";
import { DISCLAIMER, FIXED_RATE_INCLUDES, type FinancialYear } from "@/lib/ato-rules";
import { daysLeftInYear, formatMediumDate, formatPeriod, yearStatus } from "@/lib/dates";
import { formatCents, formatHours, formatWholeDollars, toCents, wholeDollarsFromCents } from "@/lib/money";
import { nothingEnteredLine, type SummaryBlock, type SummaryModel } from "@/lib/summary";
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
  const homeCents = summary.wfhMethod === "actual" ? figures.runningCents : figures.wfhCents;
  const maxCents = Math.max(
    homeCents,
    figures.clothing.cents,
    figures.laundry.cents,
    figures.donations.cents,
    figures.selfEducation.cents,
    figures.tools.cents,
    figures.subscriptions.cents,
    figures.other.cents,
    figures.car.cents,
    figures.taxAffairs.cents,
    1,
  );
  const rows = [
    ["Working from home", homeCents],
    ["Clothing / uniforms", figures.clothing.cents],
    ["Laundry", figures.laundry.cents],
    ["Donations", figures.donations.cents],
    ["Self-education", figures.selfEducation.cents],
    ["Tools and equipment", figures.tools.cents],
    ["Subscriptions", figures.subscriptions.cents],
    ["Other work expenses", figures.other.cents],
    ["Car", figures.car.cents],
    ["Tax agent fees", figures.taxAffairs.cents],
  ] as const;
  const heldCents =
    figures.depreciating.reduce((sum, expense) => sum + toCents(expense.amount), 0) +
    figures.heldDonations.reduce((sum, expense) => sum + toCents(expense.amount), 0) +
    figures.smallDonations.reduce((sum, expense) => sum + toCents(expense.amount), 0);
  const [showZeros, setShowZeros] = useState(false);
  const visibleBars = showZeros ? rows : rows.filter(([, cents]) => cents > 0);
  const activity = [
    ...logs.map((log) => ({ kind: "day" as const, date: log.date, log })),
    ...expenses.map((expense) => ({ kind: "expense" as const, date: expense.date, expense })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 text-center md:flex-row md:items-end md:justify-between md:text-left">
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
        <div className="grid gap-4 text-center md:grid-cols-3 md:text-left">
          <Stat
            label="Working from home"
            value={formatWholeDollars(summary.wfhMethod === "actual" ? wholeDollarsFromCents(figures.runningCents) : figures.wfhDollars)}
            detail={
              summary.wfhMethod === "actual"
                ? `${formatHours(figures.wfhHours)} h recorded · ${formatCents(figures.runningCents)} from bills`
                : `${formatHours(figures.wfhHours)} h × ${formatCents(year.wfhCentsPerHour)} = ${formatCents(figures.wfhCents)}`
            }
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
        {visibleBars.length > 0 ? (
        <div className="mt-6 space-y-2">
          {visibleBars.map(([label, cents]) => (
            <div key={label}>
              <div className="mb-1 text-center text-sm md:flex md:items-baseline md:justify-between md:text-left">
                <span className={cents > 0 ? "text-paper" : "text-fog"}>{label}</span>
                <span className="font-mono text-fog md:shrink-0"> {formatCents(cents)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-paper/10">
                <div className="h-full rounded-full bg-mint" style={{ width: cents > 0 ? `${Math.max(4, (cents / maxCents) * 100)}%` : "0%" }} />
              </div>
            </div>
          ))}
        </div>
        ) : null}
        {heldCents > 0 ? (
          <p className="mt-4 text-center text-sm text-gold md:text-left">
            {formatCents(heldCents)} is logged but held out of the estimate. Depreciating assets, unconfirmed gifts, and gifts under $2 are listed in the myTax summary.
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-fog md:text-left">Nothing over $300 is waiting on decline in value.</p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SummaryCard summary={summary} showZeros={showZeros} onShowZeros={setShowZeros} />
        <div className="space-y-4">
          <Panel>
            <h3 className="text-center font-semibold md:text-left">{summary.wfhMethod === "actual" ? "Actual running costs" : "Already inside the 70 cent rate"}</h3>
            {summary.wfhMethod === "actual" ? (
              <p className="mt-3 text-center text-sm leading-6 text-fog md:text-left">
                Enter electricity and gas, phone, internet, and stationery on Expenses, with the work share of each bill. The calendar hours stay as the record. Rent, mortgage interest, and council rates on your own home are not part of this.
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2 text-center text-sm text-fog md:text-left">
                  {FIXED_RATE_INCLUDES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-3 text-center text-xs leading-5 text-fog md:text-left">Do not also enter these as separate expenses.</p>
              </>
            )}
          </Panel>
          <Panel>
            <h3 className="text-center font-semibold md:text-left">Latest entries</h3>
            {activity.length === 0 ? (
              <div className="mt-3 space-y-2 text-center md:text-left">
                <p className="text-sm text-fog">Log a working-from-home day or a receipt to build the estimate.</p>
                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
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
                      <button type="button" className="block w-full text-center text-sm md:flex md:items-center md:justify-between md:text-left" onClick={() => onOpenDay(item.date)}>
                        <span>
                          {formatMediumDate(item.date)} · {modeById(item.log.mode).label}
                        </span>
                        <span className="font-mono text-fog md:shrink-0"> {item.log.mode === "wfh" ? `${formatHours(item.log.hours)} h` : "—"}</span>
                      </button>
                    </li>
                  ) : (
                    <li key={item.expense.id}>
                      <button type="button" className="block w-full text-center text-sm md:flex md:items-center md:justify-between md:text-left" onClick={() => onEditExpense(item.expense.id)}>
                        <span className="md:truncate">
                          {formatMediumDate(item.date)} · {item.expense.description}
                        </span>
                        <span className="font-mono text-fog md:shrink-0"> {formatCents(toCents(item.expense.amount))}</span>
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
        <h3 className="text-center font-semibold md:text-left">Before you lodge</h3>
        <ul className="mt-3 space-y-2 text-center text-sm leading-6 text-fog md:text-left">
          <li>Keep this diary for the whole income year. The ATO does not accept an estimate of your hours.</li>
          <li>
            {summary.wfhMethod === "actual"
              ? "Keep the bill for each running cost, and a note of how you set the work share."
              : "Keep at least one bill or receipt for each running expense the 70 cent rate covers."}
          </li>
          <li>
            {figures.workExpensesNeedEvidence
              ? "Work-related expenses are over $300, so written evidence is required."
              : "Once work-related expenses go over $300, written evidence is required."}
          </li>
          <li>Confirm every gift is to a deductible gift recipient.</li>
        </ul>
        <p className="mt-4 text-center text-xs leading-5 text-fog md:text-left">
          {DISCLAIMER}{" "}
          <a
            className="text-mint underline decoration-mint/40 underline-offset-2"
            href={
              summary.wfhMethod === "actual"
                ? "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/actual-cost-method"
                : "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {summary.wfhMethod === "actual" ? "ATO actual cost method" : "ATO fixed rate method"}
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

function metaLine(block: SummaryBlock): string {
  const folded = block.rows.filter((row) => row.fold);
  if (block.id === "wfh") {
    const days = folded.find((row) => row.label === "Days logged")?.value;
    const hours = folded.find((row) => row.label === "Hours logged")?.value;
    const rate = folded.find((row) => row.label === "Fixed rate")?.value;
    return [days ? `${days} ${days === "1" ? "day" : "days"}` : "", hours ? `${hours} h` : "", rate ?? ""].filter(Boolean).join(" · ");
  }
  if (block.id === "car") {
    const kilometres = folded.find((row) => row.label === "Kilometres logged")?.value;
    const rate = folded.find((row) => row.label === "Rate")?.value;
    return [kilometres, rate].filter(Boolean).join(" · ");
  }
  return folded.map((row) => `${row.label} ${row.value}`).join(" · ");
}

function SummaryBlockView({ block, showZeros }: { block: SummaryBlock; showZeros: boolean }) {
  const enter = block.rows.find((row) => row.label === "Enter");
  const meta = metaLine(block);
  const details = block.rows.filter((row) => row.label !== "Enter" && !row.fold && (showZeros || row.cents !== 0));

  return (
    <section className="text-center md:text-left">
      <div className="md:flex md:items-baseline md:justify-between md:gap-3">
        <h4 className="font-medium">{block.title}</h4>
        <p className="font-mono text-mint md:shrink-0">{enter?.value}</p>
      </div>
      <p className="text-xs text-fog">{block.kicker}</p>
      {meta ? <p className="mt-1 text-xs text-fog">{meta}</p> : null}
      {details.length > 0 ? (
        <dl className="mt-1 space-y-1">
          {details.map((row) => (
            <div key={row.label} className="text-sm md:flex md:items-baseline md:justify-between md:gap-3">
              <dt className="text-fog">{row.label}</dt>
              <dd className="font-mono md:shrink-0"> {row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
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

function SummaryCard({
  summary,
  showZeros,
  onShowZeros,
}: {
  summary: SummaryModel;
  showZeros: boolean;
  onShowZeros: (show: boolean) => void;
}) {
  const hiddenLine = nothingEnteredLine(summary.blocks);

  return (
    <Panel className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="text-center md:text-left">
        <p className="text-xs uppercase tracking-[0.14em] text-mint">Ready for myTax</p>
        <h3 className="mt-1 text-lg font-semibold">Figures to enter</h3>
        <p className="mt-2 text-sm leading-6 text-fog">Excel, a PDF, and a zip of the receipts are in the menu, under Data and backup.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={showZeros}
        className="focus-ring mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-line px-3 py-2 text-center md:justify-between md:text-left"
        onClick={() => onShowZeros(!showZeros)}
      >
        <span>
          <span className="block text-sm font-medium">Zero categories</span>
          <span className="block text-xs text-fog">{showZeros ? "Showing categories with nothing to enter" : "Hidden. Turn on to see them."}</span>
        </span>
        <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition", showZeros ? "bg-mint" : "bg-paper/15")} aria-hidden>
          <span className={cx("absolute top-0.5 size-5 rounded-full bg-ink transition", showZeros ? "left-5" : "left-0.5")} />
        </span>
      </button>
      <div className="mt-4 space-y-3">
        {summary.blocks.filter((block) => showZeros || block.shown).map((block) => (
          <SummaryBlockView key={block.id} block={block} showZeros={showZeros} />
        ))}
        {!showZeros && hiddenLine ? <p className="text-center text-xs leading-5 text-fog md:text-left">{hiddenLine}</p> : null}
      </div>
      <div className="mt-4 border-t border-line pt-4 text-center md:text-left">
        <div className="md:flex md:items-baseline md:justify-between md:gap-3">
          <p className="text-sm text-fog">Total to enter</p>
          <p className="font-mono text-2xl">{formatWholeDollars(summary.totalDollars)}</p>
        </div>
        <p className="mt-3 text-sm font-medium">{summary.exclusionTitle}</p>
        {summary.exclusionRows.length === 0 ? (
          <p className="mt-1 text-sm text-fog">Nothing is held out of the estimate.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-center text-xs leading-5 text-gold md:text-left">
            {summary.exclusionRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-fog md:text-left">Cents are dropped on each figure, the way the return asks for whole dollars.</p>
    </Panel>
  );
}
