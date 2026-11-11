export type ThemePreference = "dark" | "light" | "system";
export type TextScale = "small" | "medium" | "large";

export const THEME_KEY = "taxtrack_theme";
export const TEXT_SCALE_KEY = "taxtrack_text_scale";

export const TEXT_SCALE_PX: Record<TextScale, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

export function parseTheme(value: string | null): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function parseTextScale(value: string | null): TextScale {
  if (value === "small" || value === "large") return value;
  return "medium";
}

export function prefersDark(theme: ThemePreference): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
