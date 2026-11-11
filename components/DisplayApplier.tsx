"use client";

import { useEffect } from "react";
import { prefersDark, TEXT_SCALE_PX, type TextScale, type ThemePreference } from "@/lib/display";

export function DisplayApplier({ theme, textScale }: { theme: ThemePreference; textScale: TextScale }) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = prefersDark(theme);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      document.documentElement.style.fontSize = TEXT_SCALE_PX[textScale];
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#070c18" : "#f8fafc");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, textScale]);
  return null;
}
