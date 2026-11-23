import { AppShell } from "@/components/AppShell";
import { InstantBootSplash } from "@/components/InstantBootSplash";
import { latestPublishedVersion, readChangelog } from "@/lib/changelog";

export default function Home() {
  const changelogVersion = latestPublishedVersion(readChangelog().releases);
  return (
    <>
      <InstantBootSplash />
      <AppShell changelogVersion={changelogVersion} />
    </>
  );
}
