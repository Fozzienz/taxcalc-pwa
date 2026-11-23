import type { LucideIcon } from "lucide-react";
import { Building2, CalendarDays, Laptop, LayoutDashboard, Receipt } from "lucide-react";

export type SectionId = "dashboard" | "calendar" | "expenses" | "assets" | "rentals";

export const SECTIONS: Record<
  SectionId,
  { label: string; icon: LucideIcon; active: string; idle: string; iconClass: string }
> = {
  dashboard: {
    label: "Summary",
    icon: LayoutDashboard,
    active: "border-mint/55 bg-mint/10 text-mint shadow-[0_0_18px_color-mix(in_srgb,var(--mint)_55%,transparent)]",
    idle: "border-transparent text-fog shadow-[0_0_12px_color-mix(in_srgb,var(--mint)_18%,transparent)] hover:border-mint/30 hover:text-paper",
    iconClass: "text-mint",
  },
  calendar: {
    label: "Calendar",
    icon: CalendarDays,
    active: "border-emerald-700/50 bg-emerald-500/10 text-emerald-700 shadow-[0_0_18px_rgba(16,185,129,0.45)] dark:border-emerald-300/70 dark:text-emerald-300 dark:shadow-[0_0_18px_rgba(52,211,153,0.55)]",
    idle: "border-transparent text-fog shadow-[0_0_12px_rgba(16,185,129,0.12)] hover:border-emerald-400/30 hover:text-paper",
    iconClass: "text-emerald-700 dark:text-emerald-300",
  },
  expenses: {
    label: "Expenses",
    icon: Receipt,
    active: "border-amber-700/50 bg-amber-500/10 text-amber-700 shadow-[0_0_18px_rgba(217,119,6,0.4)] dark:border-amber-300/70 dark:text-amber-300 dark:shadow-[0_0_18px_rgba(252,211,77,0.55)]",
    idle: "border-transparent text-fog shadow-[0_0_12px_rgba(217,119,6,0.12)] hover:border-amber-400/30 hover:text-paper",
    iconClass: "text-amber-700 dark:text-amber-300",
  },
  assets: {
    label: "Assets",
    icon: Laptop,
    active: "border-rose-700/50 bg-rose-500/10 text-rose-700 shadow-[0_0_18px_rgba(225,29,72,0.4)] dark:border-rose-300/70 dark:text-rose-300 dark:shadow-[0_0_18px_rgba(253,164,175,0.55)]",
    idle: "border-transparent text-fog shadow-[0_0_12px_rgba(225,29,72,0.12)] hover:border-rose-400/30 hover:text-paper",
    iconClass: "text-rose-700 dark:text-rose-300",
  },
  rentals: {
    label: "Rentals",
    icon: Building2,
    active: "border-violet-700/50 bg-violet-500/10 text-violet-700 shadow-[0_0_18px_rgba(124,58,237,0.4)] dark:border-violet-300/70 dark:text-violet-300 dark:shadow-[0_0_18px_rgba(196,181,253,0.55)]",
    idle: "border-transparent text-fog shadow-[0_0_12px_rgba(124,58,237,0.12)] hover:border-violet-400/30 hover:text-paper",
    iconClass: "text-violet-700 dark:text-violet-300",
  },
};
