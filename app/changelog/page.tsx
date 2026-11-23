import type { Metadata } from "next";
import { ChangelogScreen } from "@/components/ChangelogScreen";
import { ChangelogSeen } from "@/components/ChangelogSeen";
import { latestPublishedVersion, readChangelog } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog — TaxTrack",
  description: "What has shipped in TaxTrack, and what is still in progress.",
};

export default function ChangelogPage() {
  const changelog = readChangelog();
  return (
    <>
      <ChangelogSeen version={latestPublishedVersion(changelog.releases)} />
      <ChangelogScreen releases={changelog.releases} />
    </>
  );
}
