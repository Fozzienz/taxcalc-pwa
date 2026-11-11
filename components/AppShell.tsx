"use client";

import { useMemo, useState } from "react";
import { CalendarDays, DatabaseBackup, LayoutDashboard, Receipt, ShieldCheck } from "lucide-react";
import { DISCLAIMER } from "@/lib/ato-rules";
import { visibleFinancialYears } from "@/lib/dates";
import { buildSummary } from "@/lib/summary";
import { useDisplay } from "@/hooks/useDisplay";
import { useTaxStore } from "@/hooks/useTaxStore";
import type { YearId } from "@/lib/types";
import { BackupModal } from "@/components/BackupModal";
import { BrandLogo } from "@/components/BrandLogo";
import { CalendarView } from "@/components/CalendarView";
import { Dashboard } from "@/components/Dashboard";
import { DayLogModal } from "@/components/DayLogModal";
import { DisplayApplier } from "@/components/DisplayApplier";
import { ExpenseManager } from "@/components/ExpenseManager";
import { MenuButton, MenuDrawer } from "@/components/MenuDrawer";
import { cx } from "@/components/ui";

type Tab = "dashboard" | "calendar" | "expenses";
type Overlay = { type: "none" } | { type: "backup" } | { type: "menu" } | { type: "day"; date: string };

const TABS = [
  { id: "dashboard", label: "Summary", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "expenses", label: "Expenses", icon: Receipt },
] as const;

export function AppShell() {
  const store = useTaxStore();
  const display = useDisplay();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [overlay, setOverlay] = useState<Overlay>({ type: "none" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [formToken, setFormToken] = useState(0);

  const summary = useMemo(() => {
    if (!store.ready) return null;
    return buildSummary(store.year, store.yearData);
  }, [store]);

  if (!store.ready || !summary) {
    return (
      <>
        <DisplayApplier theme={display.theme} textScale={display.textScale} />
        <Loading />
      </>
    );
  }

  const logs = store.yearData.dayLogs;
  const expenses = store.yearData.expenses;

  function openTab(next: Tab) {
    setTab(next);
    setOverlay({ type: "none" });
  }

  return (
    <div className="flex min-h-full flex-col">
      <DisplayApplier theme={display.theme} textScale={display.textScale} />
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-mint focus:px-4 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] w-full max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
          <div className="min-w-0">
            <h1 className="sr-only">Australian Tax and EOFY Calculator</h1>
            <BrandLogo />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="sr-only" htmlFor="income-year">
              Income year
            </label>
            <select
              id="income-year"
              className="min-h-10 rounded-lg border border-line bg-panel px-3 text-sm"
              value={store.year.id}
              onChange={(event) => store.setYear(event.target.value as YearId)}
            >
              {visibleFinancialYears().map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
            <MenuButton onClick={() => setOverlay({ type: "menu" })} />
          </div>
        </div>
        <div className="mx-auto hidden w-full max-w-6xl items-center justify-between gap-3 px-6 pb-3 sm:flex">
          <nav className="flex gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Sections">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx(
                  "focus-ring min-h-10 rounded-md px-4 text-sm font-semibold",
                  tab === item.id ? "bg-mint text-ink" : "text-fog hover:text-paper",
                )}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => openTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <p className="flex items-center gap-1.5 text-xs text-fog">
            <ShieldCheck size={14} /> Independent of the ATO · on this device only
          </p>
        </div>
      </header>

      {store.notice ? (
        <p className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6">
          <span className="block rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
          {store.notice}{" "}
          <button type="button" className="underline" onClick={store.dismissNotice}>
            Dismiss
          </button>
          </span>
        </p>
      ) : null}

      <main id="content" className="mx-auto mt-6 w-full max-w-6xl flex-1 px-4 sm:px-6">
        {tab === "dashboard" ? (
          <Dashboard
            year={store.year}
            summary={summary}
            logs={Object.values(logs)}
            expenses={expenses}
            onOpenDay={(date) => setOverlay({ type: "day", date })}
            onEditExpense={(id) => {
              setDraftDate(null);
              setEditingId(id);
              setFormToken((token) => token + 1);
              openTab("expenses");
            }}
            onBrowse={openTab}
          />
        ) : null}
        {tab === "calendar" ? (
          <CalendarView year={store.year} logs={logs} expenses={expenses} onOpenDay={(date) => setOverlay({ type: "day", date })} />
        ) : null}
        {tab === "expenses" ? (
          <ExpenseManager
            key={`${store.year.id}:${formToken}`}
            year={store.year}
            expenses={expenses}
            draftDate={draftDate}
            editingId={editingId}
            onSave={(expense) => store.saveExpense(store.year.id, expense)}
            onDelete={(id) => store.deleteExpense(store.year.id, id)}
          />
        ) : null}
      </main>

      <footer className="mx-auto mt-8 w-full max-w-6xl px-4 pb-28 text-xs leading-5 text-fog sm:px-6 lg:pb-10">{DISCLAIMER}</footer>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur sm:hidden" aria-label="Sections">
        <div className="grid grid-cols-4">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={cx("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]", tab === item.id ? "text-mint" : "text-fog")}
                onClick={() => openTab(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
          <button type="button" className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-fog" onClick={() => setOverlay({ type: "backup" })}>
            <DatabaseBackup size={18} />
            Backup
          </button>
        </div>
      </nav>

      {overlay.type === "menu" ? (
        <MenuDrawer
          theme={display.theme}
          textScale={display.textScale}
          onTheme={display.setTheme}
          onTextScale={display.setTextScale}
          onClose={() => setOverlay({ type: "none" })}
          onBackup={() => setOverlay({ type: "backup" })}
        />
      ) : null}
      {overlay.type === "backup" ? (
        <BackupModal
          state={store.state}
          notice={store.notice}
          onClose={() => setOverlay({ type: "none" })}
          onMerge={(file) => store.mergeIn(file)}
          onReplace={(file) => store.replaceAll(file)}
          onReset={() => {
            store.reset();
            setOverlay({ type: "none" });
          }}
          onDefaultHours={store.setDefaultHours}
          onDismissNotice={store.dismissNotice}
        />
      ) : null}
      {overlay.type === "day" ? (
        <DayLogModal
          key={overlay.date}
          date={overlay.date}
          existing={logs[overlay.date]}
          expenses={expenses.filter((expense) => expense.date === overlay.date)}
          defaultHours={store.state.settings.defaultWfhHours}
          onClose={() => setOverlay({ type: "none" })}
          onSave={(log) => {
            store.saveDay(store.year.id, log);
            setOverlay({ type: "none" });
          }}
          onClear={() => {
            store.clearDay(store.year.id, overlay.date);
            setOverlay({ type: "none" });
          }}
          onAddExpense={() => {
            setEditingId(null);
            setDraftDate(overlay.date);
            setFormToken((token) => token + 1);
            setTab("expenses");
            setOverlay({ type: "none" });
          }}
        />
      ) : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="mx-auto min-h-full max-w-6xl px-4 py-8">
      <div className="h-12 w-56 animate-pulse rounded-2xl bg-paper/5" />
      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-paper/5" />
    </div>
  );
}
