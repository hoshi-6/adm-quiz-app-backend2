"use client";

import { useEffect, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cx("min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    secondary: "border border-line bg-surface hover:bg-subtle",
    ghost: "hover:bg-subtle",
    danger: "text-danger hover:bg-danger/10",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

const fieldClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 md:text-sm";
/** 1行の入力欄（テキスト・数値・選択・日付）は同じ高さにそろえる */
const lineField = cx(fieldClass, "h-10");

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(lineField, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(lineField, "py-0", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, className)} {...props} />;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block min-w-0", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ tone = "neutral", wrap, children }: { tone?: "neutral" | "warn" | "danger" | "good"; wrap?: boolean; children: ReactNode }) {
  const tones = {
    neutral: "bg-subtle text-muted",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    good: "bg-brand/15 text-brand",
  };
  // wrap のときは長い名前でも折り返して全部見せる
  return (
    <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-medium", wrap ? "max-w-full break-words" : "shrink-0 whitespace-nowrap", tones[tone])}>{children}</span>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

/**
 * 数値入力。入力中は文字列のまま持つので、一度消してから打ち直せる。
 * 範囲内の数値になったときだけ onValueChange を呼び、フォーカスが外れたら範囲に収める。
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  integer,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  // 外から値が変わったとき（再計算・同期など）は表示を合わせる
  if (value !== prev) {
    setPrev(value);
    if (Number(text) !== value) setText(String(value));
  }
  const inRange = (n: number) => (min === undefined || n >= min) && (max === undefined || n <= max);

  return (
    <input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      className={cx(lineField, className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
        setText(t);
        const n = Number(t);
        if (t.trim() !== "" && Number.isFinite(n) && inRange(n) && (!integer || Number.isInteger(n))) onValueChange(n);
      }}
      onBlur={() => {
        let n = Number(text);
        if (text.trim() === "" || !Number.isFinite(n)) n = value;
        if (integer) n = Math.round(n);
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        setText(String(n));
        if (n !== value) onValueChange(n);
      }}
      {...props}
    />
  );
}

/**
 * 空欄にしておける数値入力。空のときは null を返し、勝手に値を入れない
 * （保存するときに、空欄なら初期値を入れるなどの扱いを呼び出し側で決める）。
 */
export function OptionalNumberInput({
  value,
  onValueChange,
  integer,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  integer?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    const shown = text.trim() === "" ? null : Number(text);
    if (shown !== value) setText(value === null ? "" : String(value));
  }
  return (
    <input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      className={cx(lineField, className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
        setText(t);
        if (t.trim() === "") return onValueChange(null);
        const n = Number(t);
        if (Number.isFinite(n) && (!integer || Number.isInteger(n))) onValueChange(n);
      }}
      {...props}
    />
  );
}

/**
 * 日付の入力欄。iPhone の Safari は日付入力の見た目が崩れやすいため、
 * 表示は普通の入力欄と同じ見た目で自前で描き、タップしたときだけ端末の日付選択を開く。
 */
export function DateField({
  value,
  onChange,
  placeholder = "日付を選ぶ",
  max,
  clearable,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  max?: string;
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  // 今年の日付は年を省いて短く見せる（狭い欄でも切れないように）
  const d = value ? new Date(`${value}T00:00:00`) : null;
  const label = d
    ? d.toLocaleDateString("ja-JP", {
        ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
        month: "numeric",
        day: "numeric",
        weekday: "short",
      })
    : placeholder;
  return (
    <div className={cx("relative min-w-0", className)}>
      <div className={cx(lineField, "flex items-center justify-between gap-2 py-0 pr-2", !value && "text-muted")} aria-hidden>
        <span className="truncate">{label}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      </div>
      {/* 実際の入力は透明にして上に重ね、タップで端末の日付選択を開く */}
      <input
        type="date"
        value={value}
        max={max}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
      />
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-8 top-1/2 z-10 -translate-y-1/2 rounded px-1.5 text-xs text-muted hover:text-fg"
          aria-label="日付を消す"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** 時間のかかる処理中に、今なにをしているかを段階的に表示する */
export function ProgressText({ steps, interval = 6000 }: { steps: string[]; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), interval);
    return () => clearInterval(t);
  }, [steps.length, interval]);
  return (
    <span className="flex items-center gap-2 text-sm text-muted" role="status">
      <Spinner /> {steps[i]}
    </span>
  );
}
