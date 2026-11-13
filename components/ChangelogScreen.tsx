import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { formatChangelogDate, type ChangelogRelease } from "@/lib/changelog";

function ReleaseCard({ release }: { release: ChangelogRelease }) {
  const unreleased = release.version.toLowerCase() === "unreleased";
  const hasContent = release.subsections.some((subsection) => subsection.items.length > 0);
  const anchor = unreleased ? "unreleased" : release.version.replace(/\./g, "-");

  return (
    <section id={anchor} className="panel scroll-mt-24 rounded-2xl">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">{unreleased ? "Coming next" : release.version}</h2>
          {release.date ? (
            <time dateTime={release.date} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">
              {formatChangelogDate(release.date)}
            </time>
          ) : null}
          {unreleased && hasContent ? (
            <span className="rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mint">In progress</span>
          ) : null}
        </div>
        {unreleased ? (
          <p className="mt-2 text-sm leading-6 text-fog">
            {hasContent
              ? "These changes are in the app now and have not been folded into a numbered release yet."
              : "Nothing is queued. The next batch of work shows here first."}
          </p>
        ) : null}
      </div>
      {hasContent ? (
        <div className="space-y-5 px-5 py-5">
          {release.subsections.map((subsection) => (
            <div key={subsection.title}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-fog">{subsection.title}</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-fog marker:text-mint">
                {subsection.items.map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ChangelogScreen({ releases }: { releases: ChangelogRelease[] }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-mint">
        <ArrowLeft size={16} /> Back to TaxTrack
      </Link>
      <div className="mt-4 flex items-start gap-3">
        <ScrollText className="mt-1 text-mint" size={28} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-fog">
            What has shipped in TaxTrack. Coming next is the work in progress. A version number is a batch that has been published.
          </p>
        </div>
      </div>
      <div className="mt-8 space-y-6">
        {releases.map((release) => (
          <ReleaseCard key={release.version} release={release} />
        ))}
      </div>
    </main>
  );
}
