import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DataRow({
  initials,
  title,
  subtitle,
  values,
  chip,
  action,
}: {
  initials: string;
  title: string;
  subtitle: string;
  values?: ReactNode;
  chip?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="flex min-h-16 items-center gap-3 rounded-3xl border border-[var(--border-subtle)] bg-raised px-3 py-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-xs font-medium text-ink">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <p className="truncate text-xs text-secondary">{subtitle}</p>
      </div>
      {values ? <div className="hidden items-center gap-6 md:flex">{values}</div> : null}
      {chip}
      {action}
    </article>
  );
}

export function RowValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-16 text-right">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("font-mono text-sm tabular-nums text-ink")}>{value}</p>
    </div>
  );
}
