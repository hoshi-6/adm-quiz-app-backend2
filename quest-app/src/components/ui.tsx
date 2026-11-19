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
    <section className={cx("sys-window p-4", danger && "danger", className)}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2
            className={cx(
              "px-2 py-0.5 text-sm tracking-[0.15em]",
              danger ? "bg-danger/20 text-danger" : "bg-glow/15 text-glow-strong glow-text",
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
        "pixel-btn px-3 py-2 text-sm disabled:opacity-40",
        variant === "primary" && "bg-glow/20 text-glow-strong hover:bg-glow/30",
        variant === "ghost" && "bg-bg/40 text-muted hover:text-fg",
        variant === "danger" && "bg-danger/15 text-danger hover:bg-danger/25",
        className,
      )}
    />
  );
}

export function Bar({ value, ok, className }: { value: number; ok?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cx("h-3 overflow-hidden border-2 border-black bg-subtle", className)}>
      <div className={cx("bar-fill h-full transition-[width] duration-300", ok && "ok")} style={{ width: `${pct}%` }} />
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
