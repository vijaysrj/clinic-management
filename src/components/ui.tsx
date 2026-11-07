import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-brand-50",
  ghost: "text-muted hover:bg-brand-50 hover:text-ink",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-base",
    variants[variant],
  );
}

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...rest} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,40,35,0.04)]", className)}>{children}</div>;
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(inputClass, "pr-8", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, "h-auto min-h-20 py-2", className)} {...rest} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const badgeTones = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-brand-100 text-brand-700",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  violet: "bg-violet-100 text-violet-800",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone])}>{children}</span>;
}

export const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  arrived: "Arrived",
  in_consultation: "With doctor",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
export const STATUS_TONE: Record<string, keyof typeof badgeTones> = {
  booked: "gray",
  arrived: "blue",
  in_consultation: "violet",
  completed: "green",
  cancelled: "red",
  no_show: "amber",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}
