import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStamp(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

export function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
