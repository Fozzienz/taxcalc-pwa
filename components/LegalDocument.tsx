import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function LegalDocument({
  title,
  subtitle,
  lastUpdated,
  contents,
  children,
}: {
  title: string;
  subtitle: string;
  lastUpdated: string;
  contents: readonly { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-mint transition hover:text-sky">
        <ArrowLeft className="size-4" aria-hidden />
        Back to TaxTrack
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-fog">{subtitle}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fog/80">Last updated {lastUpdated}</p>

      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
        {contents.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-fog transition hover:border-mint/40 hover:text-paper"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-fog">{children}</div>

      <p className="mt-12 rounded-2xl border border-line bg-panel/80 px-4 py-3 text-[11px] leading-relaxed text-fog">
        This page explains how TaxTrack works. It is not legal advice, and it is not personal tax advice. If you need advice about your own obligations, ask a lawyer or a registered tax agent.{" "}
        <Link href="/privacy" className="font-semibold text-mint hover:underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="font-semibold text-mint hover:underline">
          Terms
        </Link>
        {" · "}
        <Link href="/faq" className="font-semibold text-mint hover:underline">
          Help
        </Link>
      </p>
    </main>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-paper">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
