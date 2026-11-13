import type { Metadata } from "next";
import { ChangelogScreen } from "@/components/ChangelogScreen";
import { readChangelog } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog — TaxTrack",
  description: "What has shipped in TaxTrack, and what is still in progress.",
};

export default function ChangelogPage() {
  const changelog = readChangelog();
  return <ChangelogScreen releases={changelog.releases} />;
}
