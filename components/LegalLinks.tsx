import Link from "next/link";

const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/faq", label: "Help" },
] as const;

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold ${className}`}>
      {LINKS.map((item) => (
        <Link key={item.href} href={item.href} className="text-mint underline decoration-mint/30 underline-offset-2 hover:decoration-mint">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
