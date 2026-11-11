"use client";

import { useEffect, useId, useRef } from "react";
import { Menu, X } from "lucide-react";
import type { TextScale, ThemePreference } from "@/lib/display";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

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
}: {
  theme: ThemePreference;
  textScale: TextScale;
  onTheme: (theme: ThemePreference) => void;
  onTextScale: (scale: TextScale) => void;
  onClose: () => void;
  onBackup: () => void;
}) {
  const titleId = useId();
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
            <p className="text-xs text-fog">Display on this device</p>
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
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-fog">Display</h3>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-fog">Theme</p>
              <Segmented options={THEMES} value={theme} onChange={onTheme} label="Theme" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-fog">Text size</p>
              <Segmented options={SCALES} value={textScale} onChange={onTextScale} label="Text size" />
            </div>
            <p className="text-xs leading-5 text-fog">Theme and text size apply across TaxTrack on this device.</p>
          </section>
          <button
            type="button"
            onClick={onBackup}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-left transition hover:border-mint/40"
          >
            <span>
              <span className="block text-sm font-semibold">Data and backup</span>
              <span className="mt-0.5 block text-xs text-fog">Export or import this browser</span>
            </span>
            <span className="text-mint" aria-hidden>
              ›
            </span>
          </button>
        </div>
      </aside>
    </>
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
