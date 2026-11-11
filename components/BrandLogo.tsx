import Image from "next/image";

/** Transparent wordmark. “Tax” is ink on a light page and white on a dark page. */
export function BrandLogo({ className = "h-10 w-auto sm:h-12" }: { className?: string }) {
  return (
    <span className="inline-flex">
      <span className="brand-logo-light">
        <Image src="/taxtrack-logo-light.png" alt="TaxTrack" width={314} height={99} priority className={className} />
      </span>
      <span className="brand-logo-dark">
        <Image src="/taxtrack-logo-dark.png" alt="TaxTrack" width={314} height={99} priority className={className} />
      </span>
    </span>
  );
}
