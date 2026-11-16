"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { CalendarDays, LayoutDashboard, LogOut, Receipt, ShieldCheck, Building2, Laptop } from "lucide-react";
import { DISCLAIMER } from "@/lib/ato-rules";
import { visibleFinancialYears, workDaysOrDefault } from "@/lib/dates";
import { buildSummary } from "@/lib/summary";
import { useDisplay } from "@/hooks/useDisplay";
import { startAccountSync, stopAccountSync, useTaxStore } from "@/hooks/useTaxStore";
import type { YearId } from "@/lib/types";
import { AccountModal } from "@/components/AccountModal";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { AuthScreen } from "@/components/AuthScreen";
import { AssetManager } from "@/components/AssetManager";
import { BackupModal } from "@/components/BackupModal";
import { BootSplash, useBootSplash } from "@/components/BootSplash";
import { BrandLogo } from "@/components/BrandLogo";
import { CalendarView } from "@/components/CalendarView";
import { Dashboard } from "@/components/Dashboard";
import { DayLogModal } from "@/components/DayLogModal";
import { DisplayApplier } from "@/components/DisplayApplier";
import { ExpenseManager } from "@/components/ExpenseManager";
import { MenuButton, MenuDrawer } from "@/components/MenuDrawer";
import { RentalManager } from "@/components/RentalManager";
import { cx } from "@/components/ui";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { signOutAccount } from "@/lib/account";
import { getVaultKey, markPasswordRecovery, passwordRecoveryPending, recoveryHoldActive, setVaultKey, subscribeVault } from "@/lib/vaultSession";

type Tab = "dashboard" | "calendar" | "expenses" | "assets" | "rentals";
type Overlay = { type: "none" } | { type: "backup" } | { type: "menu" } | { type: "account" } | { type: "delete" } | { type: "day"; date: string };

const TABS = [
  { id: "dashboard", label: "Summary", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "assets", label: "Assets", icon: Laptop },
] as const;

export function AppShell() {
  const store = useTaxStore();
  const display = useDisplay();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [overlay, setOverlay] = useState<Overlay>({ type: "none" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [formToken, setFormToken] = useState(0);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [held, setHeld] = useState(false);

  const summary = useMemo(() => {
    if (!store.ready) return null;
    return buildSummary(store.year, store.yearData, {
      rentals: store.state.settings.rentalProperties === true,
      properties: store.state.properties ?? [],
      assets: store.state.assets ?? [],
    });
  }, [store]);
  const rentalsOn = store.ready && store.state.settings.rentalProperties === true;
  const wfhMethod = store.ready && store.yearData.wfhMethod === "actual" ? "actual" : "fixed";
  const yearWfhDays = store.ready ? Object.values(store.yearData.dayLogs).filter((log) => log.mode === "wfh").length : 0;
  const workDays = workDaysOrDefault(store.ready ? store.state.settings.workDays : undefined);
  useEffect(() => {
    if (!rentalsOn && tab === "rentals") setTab("dashboard");
  }, [rentalsOn, tab]);
  const tabs = rentalsOn ? [...TABS, { id: "rentals" as const, label: "Rentals", icon: Building2 }] : TABS;

  useEffect(() => {
    const sync = () => {
      setUnlocked(getVaultKey() !== null);
      setHeld(recoveryHoldActive() || passwordRecoveryPending());
    };
    sync();
    return subscribeVault(sync);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionEmail(session?.user.email ?? null);
      if (event === "SIGNED_OUT") setVaultKey(null);
      if (event === "PASSWORD_RECOVERY") markPasswordRecovery();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const entered = supabaseConfigured && authReady && Boolean(sessionEmail) && unlocked && !held;
  const recordsReady = Boolean(store.ready && summary);
  const splash = useBootSplash(recordsReady);
  useEffect(() => {
    if (!entered || !supabase) {
      stopAccountSync();
      return;
    }
    let cancel = false;
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancel || error || !data.user) return;
      await startAccountSync(data.user.id);
    })();
    return () => {
      cancel = true;
      stopAccountSync();
    };
  }, [entered]);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);
  if (splash !== "gone") {
    return (
      <>
        <DisplayApplier theme={display.theme} textScale={display.textScale} />
        <BootSplash leaving={splash === "leave"} />
      </>
    );
  }

  if (!store.ready || !entered || !summary) {
    return (
      <>
        <DisplayApplier theme={display.theme} textScale={display.textScale} />
        <AuthScreen />
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
          <div className="shrink-0">
            <h1 className="sr-only">Australian Tax and EOFY Calculator</h1>
            <BrandLogo className="h-9 w-auto max-w-none sm:h-12" />
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
            <button
              type="button"
              onClick={() => void signOutAccount()}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-2 text-xs font-semibold text-fog transition hover:border-rose/40 hover:text-rose"
              aria-label="Log off"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Log off</span>
            </button>
          </div>
        </div>
        <div className="mx-auto hidden w-full max-w-6xl items-center justify-between gap-3 px-6 pb-3 sm:flex">
          <nav className="flex gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Sections">
            {tabs.map((item) => (
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
            <ShieldCheck size={14} /> Independent of the ATO
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
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Working from home</p>
            <p className="mt-1 max-w-xl text-xs leading-5 text-fog">
              {wfhMethod === "actual"
                ? "Hours stay as a record. Claim the work share of energy, phone, internet, and stationery instead of 70 cents an hour."
                : "Hours on the calendar use the 70 cent rate. Energy, phone, internet, and stationery stay out of the claim."}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-line bg-ink p-1 sm:w-72 sm:shrink-0" role="group" aria-label="Working from home method">
            {(
              [
                ["fixed", "Fixed rate"],
                ["actual", "Actual costs"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={wfhMethod === value}
                className={wfhMethod === value ? "focus-ring w-full rounded-md bg-mint px-3 py-2 text-center text-sm font-semibold text-ink" : "focus-ring w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-fog"}
                onClick={() => store.ready && store.setWfhMethod(store.year.id, value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {tab === "dashboard" ? (
          <Dashboard
            year={store.year}
            summary={summary}
            logs={Object.values(logs)}
            expenses={expenses}
            rentals={{
              enabled: rentalsOn,
              properties: store.state.properties ?? [],
              expenses: store.yearData.rentalExpenses ?? [],
            }}
            assets={store.state.assets ?? []}
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
          <CalendarView year={store.year} logs={logs} expenses={expenses} wfhMethod={wfhMethod} workDays={workDays} onOpenDay={(date) => setOverlay({ type: "day", date })} />
        ) : null}
        {tab === "expenses" ? (
          <ExpenseManager
            key={`${store.year.id}:${formToken}`}
            year={store.year}
            wfhMethod={wfhMethod}
            expenses={expenses}
            draftDate={draftDate}
            editingId={editingId}
            onSave={(expense) => store.saveExpense(store.year.id, expense)}
            onDelete={(id) => store.deleteExpense(store.year.id, id)}
          />
        ) : null}
        {tab === "assets" ? (
          <AssetManager year={store.year} assets={store.state.assets ?? []} onSave={store.saveAsset} onDelete={store.deleteAsset} />
        ) : null}
        {tab === "rentals" && rentalsOn ? (
          <RentalManager
            key={store.year.id}
            year={store.year}
            properties={store.state.properties ?? []}
            expenses={store.yearData.rentalExpenses ?? []}
            onAddProperty={store.addProperty}
            onRenameProperty={store.renameProperty}
            onRemoveProperty={store.removeProperty}
            onSave={(expense) => store.saveRentalExpense(store.year.id, expense)}
            onDelete={(id) => store.deleteRentalExpense(store.year.id, id)}
          />
        ) : null}
      </main>

      <footer className="mx-auto mt-8 w-full max-w-6xl px-4 pb-28 text-xs leading-5 text-fog sm:px-6 lg:pb-10">{DISCLAIMER}</footer>

      <nav className="taxtrack-tabbar pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur sm:hidden" aria-label="Sections">
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cx("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2", active ? "text-mint" : "text-fog")}
                aria-current={active ? "page" : undefined}
                onClick={() => openTab(item.id)}
              >
                <Icon size={18} className="shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
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
          onAccount={() => setOverlay({ type: "account" })}
          onDeleteAccount={() => setOverlay({ type: "delete" })}
          rentalsEnabled={rentalsOn}
          onRentals={store.setRentalProperties}
          standardHours={store.state.settings.defaultWfhHours}
          yearLabel={store.year.label}
          yearWfhDays={yearWfhDays}
          onStandardHours={(hours, scope) => store.setStandardHours(store.year.id, hours, scope)}
          workDays={workDays}
          onWorkDays={store.setWorkDays}
        />
      ) : null}
      {overlay.type === "account" ? (
        <AccountModal onClose={() => setOverlay({ type: "none" })} />
      ) : null}
      {overlay.type === "delete" ? <DeleteAccountModal onClose={() => setOverlay({ type: "none" })} /> : null}
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
          wfhMethod={wfhMethod}
          workDays={workDays}
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

