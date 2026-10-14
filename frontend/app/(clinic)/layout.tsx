import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { SESSION_COOKIE, readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const session = await readSession(jar.get(SESSION_COOKIE)?.value);
  return <AppShell username={session?.username ?? "Doctor"}>{children}</AppShell>;
}
