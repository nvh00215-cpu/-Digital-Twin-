import { AlertTriangle, Check, Info, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  success: "text-[var(--status-success)]",
  warning: "text-[var(--status-warning)]",
  danger: "text-[var(--status-danger)]",
  info: "text-[var(--status-info)]",
  neutral: "text-secondary",
} as const;

const icons = {
  success: Check,
  warning: AlertTriangle,
  danger: AlertTriangle,
  info: Info,
  neutral: Minus,
} as const;

export function StatusChip({
  label,
  variant,
}: {
  label: string;
  variant: keyof typeof styles;
}) {
  const Icon = icons[variant];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full bg-black/20 px-2.5 text-xs",
        styles[variant],
      )}
    >
      <Icon aria-hidden size={12} strokeWidth={1.75} />
      {label}
    </span>
  );
}
