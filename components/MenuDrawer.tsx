"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Clock, MapPin, Menu, Palette, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { isValidHours } from "@/lib/dates";
import { HOLIDAY_STATES, type AustralianState } from "@/lib/holidays";
import type { TextScale, ThemePreference } from "@/lib/display";
import { formatHours } from "@/lib/money";
import { buttonClass, Field, inputClass, TextBox } from "@/components/ui";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

const USUAL_DAYS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
] as const;

const SCALES: { value: TextScale; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring rounded-lg border border-line bg-panel p-2 text-fog transition hover:border-mint/40 hover:text-mint"
      aria-label="Open menu"
    >
      <Menu className="size-4" />
    </button>
  );
}

export function MenuDrawer({
  theme,
  textScale,
  onTheme,
  onTextScale,
  onClose,
  onBackup,
  onAccount,
  onDeleteAccount,
  rentalsEnabled,
  onRentals,
  standardHours,
  yearLabel,
  yearWfhDays,
  onStandardHours,
  workDays,
  onWorkDays,
  holidayState,
  onHolidayState,
}: {
  theme: ThemePreference;
  textScale: TextScale;
  onTheme: (theme: ThemePreference) => void;
  onTextScale: (scale: TextScale) => void;
  onClose: () => void;
  onBackup: () => void;
  onAccount: () => void;
  onDeleteAccount: () => void;
  rentalsEnabled: boolean;
  onRentals: (enabled: boolean) => void;
  standardHours: number;
  yearLabel: string;
  yearWfhDays: number;
  onStandardHours: (hours: number, scope: "forward" | "year") => void;
  workDays: readonly number[];
  onWorkDays: (days: number[]) => void;
  holidayState: AustralianState;
  onHolidayState: (state: AustralianState) => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const [hours, setHours] = useState(String(standardHours));
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [hoursNote, setHoursNote] = useState<string | null>(null);
  const [daysNote, setDaysNote] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold tracking-wide">
              Menu
            </h2>
            <p className="text-xs text-fog">On this device</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg p-2 text-fog transition hover:bg-paper/10 hover:text-paper"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <MenuSection icon={Palette} title="Display">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-fog">Theme</p>
              <Segmented options={THEMES} value={theme} onChange={onTheme} label="Theme" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-fog">Text size</p>
              <Segmented options={SCALES} value={textScale} onChange={onTextScale} label="Text size" />
            </div>
            <p className="text-xs leading-5 text-fog">Theme and text size apply across TaxTrack on this device.</p>
          </MenuSection>
          <MenuSection icon={Clock} title="Standard day">
            <Field label="Hours per work-from-home day" hint="New days start with this. A single day can still be different.">
              <TextBox
                type="number"
                inputMode="decimal"
                min={0.1}
                max={24}
                step={0.1}
                value={hours}
                onChange={(event) => {
                  setHours(event.target.value);
                  setConfirming(false);
                  setHoursNote(null);
                }}
              />
            </Field>
            {hoursError ? <p className="text-sm text-rose">{hoursError}</p> : null}
            {hoursNote ? <p className="text-sm text-fog">{hoursNote}</p> : null}
            {confirming ? (
              <div className="space-y-2">
                <p className="text-sm leading-6 text-fog">
                  Use {formatHours(Number(hours))} hours for new days, or rewrite the work-from-home days already logged in {yearLabel}?
                </p>
                <button
                  type="button"
                  className={`${buttonClass.primary} w-full`}
                  onClick={() => {
                    onStandardHours(Number(hours), "forward");
                    setConfirming(false);
                    setHoursNote("New days use this. Days already logged stay as they are.");
                  }}
                >
                  Moving forward
                </button>
                <button
                  type="button"
                  className={`${buttonClass.ghost} w-full`}
                  onClick={() => {
                    onStandardHours(Number(hours), "year");
                    setConfirming(false);
                    setHoursNote(`Work-from-home days in ${yearLabel} now use this. Office, leave, RDO, and not working stay.`);
                  }}
                >
                  This tax year
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${buttonClass.ghost} w-full`}
                onClick={() => {
                  const parsed = Number(hours);
                  if (!isValidHours(parsed) || parsed <= 0) {
                    setHoursError("Use 0.1 to 24 hours, in tenths.");
                    setConfirming(false);
                    return;
                  }
                  setHoursError(null);
                  if (parsed === standardHours) {
                    setHoursNote("That is already the standard day.");
                    return;
                  }
                  if (yearWfhDays === 0) {
                    onStandardHours(parsed, "forward");
                    setHoursNote("New days use this. No work-from-home days are logged in this year yet.");
                    return;
                  }
                  setHoursNote(null);
                  setConfirming(true);
                }}
              >
                Save standard day
              </button>
            )}
          </MenuSection>
          <MenuSection icon={CalendarDays} title="Usual days">
            <p className="text-xs leading-5 text-fog">These days start as office days. The others are shaded. Open any day to log what you actually did.</p>
            <div className="grid grid-cols-4 gap-2">
              {USUAL_DAYS.map((item) => {
                const on = workDays.includes(item.day);
                return (
                  <button
                    key={item.day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      if (on && workDays.length === 1) {
                        setDaysNote("Keep at least one usual day.");
                        return;
                      }
                      setDaysNote(null);
                      const next = on ? workDays.filter((day) => day !== item.day) : [...workDays, item.day];
                      onWorkDays(next);
                    }}
                    className={on ? "focus-ring rounded-lg bg-mint px-2 py-2 text-sm font-semibold text-ink" : "focus-ring rounded-lg border border-line px-2 py-2 text-sm font-semibold text-fog"}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {daysNote ? <p className="text-xs text-gold">{daysNote}</p> : null}
          </MenuSection>
          <MenuSection icon={MapPin} title="Public holidays">
            <Field label="State or territory" hint="National holidays, plus the holidays for this place. A show day that only covers part of the state is still marked.">
              <select className={inputClass} value={holidayState} onChange={(event) => onHolidayState(event.target.value as AustralianState)}>
                {HOLIDAY_STATES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </MenuSection>
          <MenuSection icon={SlidersHorizontal} title="Features">
            <button
              type="button"
              aria-pressed={rentalsEnabled}
              onClick={() => onRentals(!rentalsEnabled)}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-mint/40"
            >
              <span>
                <span className="block text-sm font-semibold">Enable Rental Properties</span>
                <span className="mt-0.5 block text-xs text-fog">
                  {rentalsEnabled ? "Rentals is in the menu. Totals and reports include them." : "Hidden. The records stay saved."}
                </span>
              </span>
              <span className={rentalsEnabled ? "text-xs font-bold uppercase tracking-wider text-mint" : "text-xs font-bold uppercase tracking-wider text-fog"}>
                {rentalsEnabled ? "On" : "Off"}
              </span>
            </button>
          </MenuSection>
          <button
            type="button"
            onClick={onAccount}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-mint/40"
          >
            <span>
              <span className="block text-sm font-semibold">Account</span>
              <span className="mt-0.5 block text-xs text-fog">Change the password</span>
            </span>
            <span className="text-mint" aria-hidden>
              ›
            </span>
          </button>
          <Link
            href="/changelog"
            onClick={(event) => {
              event.preventDefault();
              onClose();
              router.push("/changelog");
            }}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-mint/40"
          >
            <span>
              <span className="block text-sm font-semibold">Changelog</span>
              <span className="mt-0.5 block text-xs text-fog">What has shipped, and what is in progress</span>
            </span>
            <span className="text-mint" aria-hidden>
              ›
            </span>
          </Link>
          <Link
            href="/faq"
            onClick={(event) => {
              event.preventDefault();
              onClose();
              router.push("/faq");
            }}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-mint/40"
          >
            <span>
              <span className="block text-sm font-semibold">Help and disclaimers</span>
              <span className="mt-0.5 block text-xs text-fog">How to use TaxTrack, and what it does not do</span>
            </span>
            <span className="text-mint" aria-hidden>
              ›
            </span>
          </Link>
          <Link
            href="/terms"
            onClick={(event) => {
              event.preventDefault();
              onClose();
              router.push("/terms");
            }}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-mint/40"
          >
            <span>
              <span className="block text-sm font-semibold">Terms and privacy</span>
              <span className="mt-0.5 block text-xs text-fog">The rules for the organiser, and what is stored</span>
            </span>
            <span className="text-mint" aria-hidden>
              ›
            </span>
          </Link>
          <button
            type="button"
            onClick={onBackup}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-mint/40"
          >
            <span>
              <span className="block text-sm font-semibold">Data and backup</span>
              <span className="mt-0.5 block text-xs text-fog">A year zip, or just the Excel or PDF</span>
            </span>
            <span className="text-mint" aria-hidden>
              ›
            </span>
          </button>
          <button
            type="button"
            onClick={onDeleteAccount}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-rose/40"
          >
            <span>
              <span className="block text-sm font-semibold">Delete account and data</span>
              <span className="mt-0.5 block text-xs text-fog">Remove the sign-in and the encrypted records</span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

function MenuSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-b border-line pb-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left"
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-mint" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
        </span>
        <ChevronDown className={open ? "size-4 shrink-0 rotate-180 text-fog" : "size-4 shrink-0 text-fog"} aria-hidden />
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={
              selected
                ? "rounded-lg border border-mint/60 bg-mint/10 px-2 py-2 text-xs font-semibold text-mint"
                : "rounded-lg border border-line px-2 py-2 text-xs font-semibold text-fog transition hover:border-paper/20 hover:text-paper"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
