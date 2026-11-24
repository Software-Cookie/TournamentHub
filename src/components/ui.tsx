import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "outline-light" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-700 shadow-[0_6px_14px_-8px_rgb(45_90_184/0.5)]",
  // Navy text on orange keeps WCAG contrast (white on this orange does not).
  accent: "bg-accent text-navy hover:bg-accent-400 shadow-[0_6px_14px_-8px_rgb(217_120_63/0.5)]",
  secondary: "bg-white text-ink border border-line hover:border-brand/40 hover:text-brand",
  ghost: "text-ink hover:bg-navy/5",
  danger: "bg-danger text-white hover:bg-red-700",
  success: "bg-success text-white hover:bg-green-700",
  "outline-light": "border border-white/35 bg-white/5 text-white hover:bg-white/15 hover:border-white/60",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.95rem] gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string, slant = false) {
  return cn(
    "inline-flex items-center justify-center font-bold whitespace-nowrap select-none touch-manipulation",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97]",
    "disabled:opacity-55 disabled:pointer-events-none",
    slant ? "slant rounded-lg" : "rounded-xl",
    variants[variant],
    sizes[size],
    className,
  );
}

function Inner({ slant, children }: { slant?: boolean; children: React.ReactNode }) {
  return slant ? <span className="inline-flex items-center gap-[inherit]">{children}</span> : <>{children}</>;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  slant,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; slant?: boolean }) {
  return (
    <button type={type} className={buttonClass(variant, size, className, slant)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <Inner slant={slant}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </Inner>
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", slant, className, children, ...rest }: { href: string; variant?: Variant; size?: Size; slant?: boolean; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className, slant)} {...rest}>
      <Inner slant={slant}>{children}</Inner>
    </Link>
  );
}

const badgeTones = {
  gray: "bg-navy/5 text-navy-700 ring-navy/10",
  blue: "bg-brand-50 text-brand-700 ring-brand/15",
  orange: "bg-accent-50 text-accent-600 ring-accent/20",
  green: "bg-green-50 text-green-700 ring-green-600/15",
  yellow: "bg-amber-50 text-amber-700 ring-amber-500/20",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/15",
  dark: "bg-navy text-white ring-navy",
} as const;
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "gray", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap", badgeTones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS: Record<string, [string, Tone]> = {
  // registration
  PENDING_PAYMENT: ["Payment pending", "yellow"],
  PENDING_APPROVAL: ["Awaiting approval", "purple"],
  CONFIRMED: ["Confirmed", "green"],
  REJECTED: ["Rejected", "red"],
  CANCELLED: ["Cancelled", "red"],
  EXPIRED: ["Expired", "gray"],
  // payment
  CREATED: ["Initiated", "gray"],
  PENDING: ["Pending", "yellow"],
  PAID: ["Paid", "green"],
  FAILED: ["Failed", "red"],
  REFUND_PENDING: ["Refund pending", "purple"],
  PARTIALLY_REFUNDED: ["Part refunded", "purple"],
  REFUNDED: ["Refunded", "purple"],
  // match
  SCHEDULED: ["Scheduled", "gray"],
  UPCOMING: ["Upcoming", "blue"],
  READY: ["Ready", "orange"],
  ONGOING: ["Live", "red"],
  COMPLETED: ["Completed", "green"],
  POSTPONED: ["Postponed", "yellow"],
  // tournament
  DRAFT: ["Draft", "gray"],
  PUBLISHED: ["Published", "blue"],
  ARCHIVED: ["Archived", "gray"],
  // category
  OPEN: ["Open", "green"],
  CLOSED: ["Closed", "gray"],
  DRAWN: ["Draw ready", "blue"],
  IN_PROGRESS: ["In progress", "orange"],
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const [label, tone] = STATUS[status] ?? [status, "gray"];
  return (
    <Badge tone={tone} dot={status === "ONGOING"} className={cn(status === "ONGOING" && "[&>span]:animate-pulse", className)}>
      {label}
    </Badge>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...props}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, error, hint, required, children, className }: { label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="eyebrow mb-1 text-accent">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "blue", sub }: { label: string; value: React.ReactNode; icon?: React.ReactNode; tone?: "blue" | "orange" | "green" | "red" | "purple" | "gray"; sub?: React.ReactNode }) {
  const toneCls = { blue: "bg-brand-50 text-brand", orange: "bg-accent-50 text-accent", green: "bg-green-50 text-success", red: "bg-red-50 text-danger", purple: "bg-violet-50 text-violet-600", gray: "bg-navy/5 text-navy-700" }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight tabular-nums break-words sm:text-2xl">{value}</p>
          {sub && <p className="mt-1 text-xs text-subtle">{sub}</p>}
        </div>
        {icon && <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", toneCls)}>{icon}</div>}
      </div>
    </Card>
  );
}
