import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function CircleActionButton({
  href,
  label,
  selected = false,
}: {
  href: string;
  label: string;
  selected?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform hover:[&_svg]:translate-x-0.5",
        selected ? "bg-app text-accent" : "bg-accent text-on-accent",
      )}
    >
      <ArrowRight aria-hidden size={18} strokeWidth={1.75} />
    </Link>
  );
}
