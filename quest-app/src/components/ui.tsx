import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Window({
  title,
  children,
  danger,
  className,
  right,
}: {
  title?: ReactNode;
  children: ReactNode;
  danger?: boolean;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <section className={cx("sys-window rounded-md p-4", danger && "danger", className)}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2
            className={cx(
              "border px-3 py-0.5 text-sm font-bold tracking-[0.2em]",
              danger ? "border-danger/70 text-danger" : "border-glow/60 text-glow-strong glow-text",
            )}
          >
            {title}
          </h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "rounded border px-3 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:active:scale-100",
        variant === "primary" && "border-glow/70 bg-glow/15 text-glow-strong hover:bg-glow/25",
        variant === "ghost" && "border-line bg-transparent text-muted hover:border-glow/50 hover:text-fg",
        variant === "danger" && "border-danger/60 bg-danger/10 text-danger hover:bg-danger/20",
        className,
      )}
    />
  );
}

export function Bar({ value, ok, className }: { value: number; ok?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-subtle", className)}>
      <div className={cx("bar-fill h-full rounded-full transition-[width] duration-500", ok && "ok")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const inputCls =
  "w-full min-w-0 rounded border border-line bg-bg/70 px-3 py-2 text-fg outline-none placeholder:text-muted/60 focus:border-glow";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted/80">{hint}</span>}
    </label>
  );
}
