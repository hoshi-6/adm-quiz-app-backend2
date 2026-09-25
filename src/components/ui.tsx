"use client";

import { useState } from "react";
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
    <section className={cx("rounded-2xl border border-line bg-surface p-4 shadow-sm", className)}>
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

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, className)} {...props} />;
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

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "warn" | "danger" | "good"; children: ReactNode }) {
  const tones = {
    neutral: "bg-subtle text-muted",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    good: "bg-brand/15 text-brand",
  };
  return <span className={cx("inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
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
      className={cx(fieldClass, className)}
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
      className={cx(fieldClass, className)}
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
