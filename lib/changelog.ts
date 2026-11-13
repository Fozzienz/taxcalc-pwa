import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ChangelogItem {
  text: string;
  date?: string;
}

export interface ChangelogSubsection {
  title: string;
  items: ChangelogItem[];
}

export interface ChangelogRelease {
  version: string;
  date?: string;
  subsections: ChangelogSubsection[];
}

export interface ParsedChangelog {
  intro: string[];
  releases: ChangelogRelease[];
}

const VERSION_HEADER = /^## \[(.+?)\](?:\s*-\s*(.+))?$/;
const SUBSECTION_HEADER = /^### (.+)$/;
const LIST_ITEM = /^-\s+(.+)$/;
const DATED_ITEM_BODY = /^(?:\*\*)?(\d{4}-\d{2}-\d{2})(?:\*\*)?\s*[—–-]\s*(.+)$/;

function parseListItem(raw: string): ChangelogItem {
  const dated = raw.match(DATED_ITEM_BODY);
  if (dated) return { date: dated[1], text: dated[2].trim() };
  return { text: raw.trim() };
}

/** Keep a Changelog markdown: draft under [Unreleased], then numbered releases. */
export function parseChangelog(markdown: string): ParsedChangelog {
  const intro: string[] = [];
  const releases: ChangelogRelease[] = [];
  let currentRelease: ChangelogRelease | null = null;
  let currentSubsection: ChangelogSubsection | null = null;
  let inIntro = true;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) continue;

    const versionMatch = trimmed.match(VERSION_HEADER);
    if (versionMatch) {
      inIntro = false;
      currentRelease = { version: versionMatch[1], date: versionMatch[2]?.trim(), subsections: [] };
      releases.push(currentRelease);
      currentSubsection = null;
      continue;
    }

    const subsectionMatch = trimmed.match(SUBSECTION_HEADER);
    if (subsectionMatch && currentRelease) {
      currentSubsection = { title: subsectionMatch[1], items: [] };
      currentRelease.subsections.push(currentSubsection);
      continue;
    }

    const itemMatch = trimmed.match(LIST_ITEM);
    if (itemMatch && currentRelease) {
      if (!currentSubsection) {
        currentSubsection = { title: "Updates", items: [] };
        currentRelease.subsections.push(currentSubsection);
      }
      currentSubsection.items.push(parseListItem(itemMatch[1]));
      continue;
    }

    if (inIntro && trimmed && !trimmed.startsWith("##")) intro.push(trimmed);
  }

  return { intro, releases };
}

export function readChangelog(): ParsedChangelog {
  return parseChangelog(readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8"));
}

export function formatChangelogDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
