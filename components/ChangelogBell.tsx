"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { CHANGELOG_SEEN_KEY } from "@/lib/changelogSeen";

export function ChangelogBell({ version }: { version: string | null }) {
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setSeen(window.localStorage.getItem(CHANGELOG_SEEN_KEY));
  }, []);

  if (!version) return null;
  const unread = seen !== undefined && seen !== version;

  return (
    <Link
      href="/changelog"
      className={
        unread
          ? "taxtrack-changelog-bell-unread focus-ring relative rounded-lg border border-mint/50 bg-panel p-2 text-mint transition hover:border-mint hover:text-mint"
          : "focus-ring relative rounded-lg border border-line bg-panel p-2 text-fog transition hover:border-mint/40 hover:text-mint"
      }
      aria-label={unread ? `Changelog, ${version} is new` : "Changelog"}
    >
      <Bell className="size-4" strokeWidth={unread ? 2.25 : 2} aria-hidden />
      {unread ? <span className="taxtrack-changelog-dot pointer-events-none absolute right-1 top-1 size-2 rounded-full bg-mint ring-2 ring-ink" /> : null}
    </Link>
  );
}
