"use client";

import { useSyncExternalStore } from "react";
import { parseTextScale, parseTheme, TEXT_SCALE_KEY, THEME_KEY, type TextScale, type ThemePreference } from "@/lib/display";

type Snapshot = { theme: ThemePreference; textScale: TextScale };

const serverSnapshot: Snapshot = { theme: "system", textScale: "medium" };
let snapshot: Snapshot = serverSnapshot;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function read(): Snapshot {
  try {
    return {
      theme: parseTheme(localStorage.getItem(THEME_KEY)),
      textScale: parseTextScale(localStorage.getItem(TEXT_SCALE_KEY)),
    };
  } catch {
    return serverSnapshot;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getClientSnapshot(): Snapshot {
  if (snapshot === serverSnapshot && typeof window !== "undefined") snapshot = read();
  return snapshot;
}

export function useDisplay() {
  const current = useSyncExternalStore(subscribe, getClientSnapshot, () => serverSnapshot);
  return {
    theme: current.theme,
    textScale: current.textScale,
    setTheme(theme: ThemePreference) {
      localStorage.setItem(THEME_KEY, theme);
      snapshot = { ...getClientSnapshot(), theme };
      emit();
    },
    setTextScale(textScale: TextScale) {
      localStorage.setItem(TEXT_SCALE_KEY, textScale);
      snapshot = { ...getClientSnapshot(), textScale };
      emit();
    },
  };
}
