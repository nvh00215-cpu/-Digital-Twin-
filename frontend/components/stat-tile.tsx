export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border-subtle)] bg-raised/70 px-4 py-3">
      <p className="text-xs text-secondary">{label}</p>
      <p className="mt-1 font-mono text-[28px] font-semibold leading-tight tabular-nums text-ink">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}
