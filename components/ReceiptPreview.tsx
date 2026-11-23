"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { formatReceiptSize, receiptBytes, receiptDownloadName, receiptKind, receiptLabel } from "@/lib/receiptImage";

const ReceiptPdfViewer = dynamic(() => import("@/components/ReceiptPdfViewer").then((mod) => mod.ReceiptPdfViewer), {
  ssr: false,
  loading: () => <div className="flex min-h-[60vh] items-center justify-center text-sm text-fog">Opening invoice…</div>,
});

export function ReceiptPreview({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const kind = receiptKind(src);
  const label = receiptLabel(src);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-6" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-[11px] text-fog">
              {label} · {formatReceiptSize(receiptBytes(src))}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={src} download={receiptDownloadName(src)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-mint/40">
              <Download className="size-3.5" /> Download
            </a>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-fog transition hover:bg-ink hover:text-paper" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-ink/40 p-3">
          {kind === "pdf" ? (
            <ReceiptPdfViewer dataUrl={src} title={title} />
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={title} className="mx-auto max-h-[78vh] w-full rounded-lg bg-white object-contain" />
          ) : (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-fog">Word invoices download to open. TaxTrack does not draw them on the page.</p>
              <a href={src} download={receiptDownloadName(src)} className="inline-flex items-center gap-1.5 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-ink">
                <Download className="size-4" /> Download {label.toLowerCase()}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
