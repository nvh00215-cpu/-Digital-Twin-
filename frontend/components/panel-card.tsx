import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PanelCard({
  title,
  icon,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-panel border border-[var(--border-subtle)] p-5 shadow-panel",
        className,
      )}
      style={{ background: "linear-gradient(145deg, var(--surface-glass-from), var(--surface-glass-to))" }}
    >
      {title ? (
        <header className="mb-4 flex items-center gap-3">
          {icon ? (
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-raised text-secondary">{icon}</span>
          ) : null}
          <h2 className="text-base font-medium text-ink">{title}</h2>
          {action ? <div className="ml-auto">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
