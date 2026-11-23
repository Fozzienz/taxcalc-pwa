"use client";

import { useEffect } from "react";
import { CHANGELOG_SEEN_KEY } from "@/lib/changelogSeen";

export function ChangelogSeen({ version }: { version: string | null }) {
  useEffect(() => {
    if (version) window.localStorage.setItem(CHANGELOG_SEEN_KEY, version);
  }, [version]);
  return null;
}
