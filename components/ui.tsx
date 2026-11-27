"use client";

import { useEffect, useId, useRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-paper outline-none placeholder:text-fog/70 focus-visible:border-mint";

export const buttonClass = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-semibold text-ink shadow-sm transition hover:brightness-110 focus-ring disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-panel px-4 text-sm font-semibold text-paper shadow-sm transition hover:border-mint/40 focus-ring disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose/40 px-4 text-sm font-semibold text-rose transition hover:bg-rose/10 focus-ring",
};

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("panel rounded-2xl p-4 sm:p-5", className)}>{children}</section>;
}

function emptyChange(): ChangeEvent<HTMLInputElement> {
  return { target: { value: "" }, currentTarget: { value: "" } } as ChangeEvent<HTMLInputElement>;
}

function emptyAreaChange(): ChangeEvent<HTMLTextAreaElement> {
  return { target: { value: "" }, currentTarget: { value: "" } } as ChangeEvent<HTMLTextAreaElement>;
}

function ClearControl({ label, onClick, tall = false }: { label: string; onClick: () => void; tall?: boolean }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      className={cx(
        "focus-ring absolute right-1 flex size-8 items-center justify-center rounded-lg text-fog hover:text-paper",
        tall ? "top-1.5" : "top-1/2 -translate-y-1/2",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <X size={14} />
    </button>
  );
}

export function TextBox({
  value,
  onChange,
  onClear,
  className,
  type,
  clearLabel = "Clear",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void; clearLabel?: string }) {
  const text = value == null ? "" : String(value);
  const show = text.length > 0 && type !== "date" && type !== "file" && type !== "checkbox" && type !== "radio";
  return (
    <div className="relative">
      <input
        {...props}
        type={type}
        value={value}
        onChange={onChange}
        className={cx(inputClass, type === "number" && "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", show && "pr-10", className)}
      />
      {show ? (
        <ClearControl
          label={clearLabel}
          onClick={() => {
            if (onClear) onClear();
            else onChange?.(emptyChange());
          }}
        />
      ) : null}
    </div>
  );
}

export function TextArea({
  value,
  onChange,
  onClear,
  className,
  clearLabel = "Clear",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { onClear?: () => void; clearLabel?: string }) {
  const text = value == null ? "" : String(value);
  return (
    <div className="relative">
      <textarea {...props} value={value} onChange={onChange} className={cx(inputClass, "min-h-24 py-2", text.length > 0 && "pr-10", className)} />
      {text.length > 0 ? (
        <ClearControl
          tall
          label={clearLabel}
          onClick={() => {
            if (onClear) onClear();
            else onChange?.(emptyAreaChange());
          }}
        />
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-fog">
        {label}
        {required ? <span className="text-mint"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-fog">{hint}</span> : null}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "panel max-h-[92vh] w-full overflow-y-auto rounded-b-none p-4 outline-none sm:rounded-2xl sm:p-5",
          wide ? "sm:max-w-xl" : "sm:max-w-lg",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button type="button" className={cx(buttonClass.ghost, "min-h-10 px-3")} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
