"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

function cancelled(error: unknown): boolean {
  return error instanceof Error && /cancel|abort/i.test(error.message);
}

function pdfBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const binary = atob(dataUrl.slice(comma + 1).replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function ReceiptPdfViewer({ dataUrl, title }: { dataUrl: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderGeneration = useRef(0);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [ready, setReady] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const renderPage = useCallback(async (pdf: PDFDocumentProxy, pageNum: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const generation = ++renderGeneration.current;
    const page = await pdf.getPage(pageNum);
    if (generation !== renderGeneration.current) return;
    const base = page.getViewport({ scale: 1 });
    const cssWidth = Math.max(280, container.clientWidth - 16);
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * pixelRatio });
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
    await page.render({ canvasContext: context, canvas, viewport }).promise;
  }, []);

  useEffect(() => {
    const bytes = pdfBytes(dataUrl);
    if (!bytes) {
      setError("Could not read this PDF. Download it instead.");
      setReady(false);
      setRendering(false);
      return;
    }
    let cancelledLoad = false;
    setError(null);
    setReady(false);
    setRendering(true);
    setNumPages(0);
    setPageNumber(1);
    void (async () => {
      try {
        const { getDocument } = await loadPdfjs();
        const pdf = await getDocument({ data: bytes }).promise;
        if (cancelledLoad) {
          await pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setReady(true);
      } catch (caught) {
        if (!cancelledLoad) {
          setError(caught instanceof Error ? caught.message : "Could not open this PDF.");
          setRendering(false);
        }
      }
    })();
    return () => {
      cancelledLoad = true;
      renderGeneration.current += 1;
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [dataUrl]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!ready || !pdf || error) return;
    let stopped = false;
    setRendering(true);
    void renderPage(pdf, pageNumber)
      .catch((caught) => {
        if (!stopped && !cancelled(caught)) setError("Could not draw this page. Download it instead.");
      })
      .finally(() => {
        if (!stopped) setRendering(false);
      });
    return () => {
      stopped = true;
    };
  }, [ready, pageNumber, error, renderPage]);

  useEffect(() => {
    const container = containerRef.current;
    const pdf = pdfRef.current;
    if (!container || !ready || !pdf || error) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void renderPage(pdf, pageNumber).catch((caught) => {
          if (!cancelled(caught)) setError("Could not draw this page. Download it instead.");
        });
      }, 120);
    });
    observer.observe(container);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ready, pageNumber, error, renderPage]);

  if (error) return <p className="py-8 text-center text-sm text-fog">{error}</p>;

  return (
    <div className="flex min-h-[60vh] flex-col">
      {numPages > 1 ? (
        <div className="mb-3 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={rendering || pageNumber <= 1}
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" /> Prev
          </button>
          <span className="text-xs tabular-nums text-fog">
            Page {pageNumber} of {numPages}
          </span>
          <button
            type="button"
            disabled={rendering || pageNumber >= numPages}
            onClick={() => setPageNumber((page) => Math.min(numPages, page + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
            aria-label="Next page"
          >
            Next <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
      <div ref={containerRef} className="relative flex min-h-[60vh] flex-1 items-start justify-center overflow-auto rounded-xl bg-white p-2">
        {rendering ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/80 text-sm text-fog">
            <Loader2 className="size-5 animate-spin" aria-hidden /> Opening invoice…
          </div>
        ) : null}
        <canvas ref={canvasRef} className="max-w-full" aria-label={title} />
      </div>
    </div>
  );
}
