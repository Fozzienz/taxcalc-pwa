"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

const MIN_MS = 1700;
const LEAVE_MS = 450;

function hideInstantBootSplash() {
  const splash = document.getElementById("taxtrack-instant-boot-splash");
  if (!splash) return;
  splash.style.display = "none";
}

/** Keeps the opening splash up long enough to read, then fades it once records are ready. */
export function useBootSplash(ready: boolean): "show" | "leave" | "gone" {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");
  const started = useRef(0);

  useLayoutEffect(() => {
    started.current = Date.now();
    hideInstantBootSplash();
  }, []);

  useEffect(() => {
    if (!ready || phase !== "show") return;
    const remaining = Math.max(0, MIN_MS - (Date.now() - started.current));
    const leaveTimer = window.setTimeout(() => setPhase("leave"), remaining);
    return () => window.clearTimeout(leaveTimer);
  }, [ready, phase]);

  useEffect(() => {
    if (phase !== "leave") return;
    const goneTimer = window.setTimeout(() => setPhase("gone"), LEAVE_MS);
    return () => window.clearTimeout(goneTimer);
  }, [phase]);

  return phase;
}

/** Dark opening screen. It does not follow the light theme, so the wordmark stays readable. */
export function BootSplash({ leaving }: { leaving: boolean }) {
  return (
    <div
      className={leaving ? "taxtrack-splash taxtrack-splash-leave" : "taxtrack-splash"}
      role="status"
      aria-live="polite"
      aria-busy={leaving ? undefined : true}
      aria-label="Loading TaxTrack"
    >
      <div className="taxtrack-splash-glow" aria-hidden />
      <div className="relative flex h-full w-full max-w-lg flex-col items-center justify-between px-6 py-12 sm:py-20">
        <div className="taxtrack-splash-logo flex flex-1 flex-col items-center justify-center">
          <Image
            src="/taxtrack-logo-dark.png"
            alt="TaxTrack"
            width={1159}
            height={344}
            quality={92}
            priority
            className="h-16 w-auto sm:h-20"
          />
          <p className="taxtrack-splash-copy mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94a3b8]">
            Australian tax and EOFY
          </p>
        </div>

        <div className="taxtrack-splash-copy flex w-full flex-col items-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">
            <ShieldCheck size={14} className="text-[#38bdf8]" aria-hidden />
            Zero-knowledge encrypted
          </p>
          <div className="taxtrack-splash-track relative h-1 w-64 overflow-hidden rounded-full border border-[#243044] bg-[#0b1320] sm:w-72">
            <div className="taxtrack-splash-progress absolute inset-y-0 w-[42%] rounded-full" />
          </div>
          <p className="mt-4 text-center text-xs tracking-wider text-[#94a3b8]">Opening your records…</p>
        </div>
      </div>
    </div>
  );
}
