"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm text-secondary hover:bg-raised hover:text-ink disabled:opacity-50"
    >
      <LogOut aria-hidden size={20} strokeWidth={1.75} />
      {collapsed ? <span className="sr-only">Sign out</span> : "Sign out"}
    </button>
  );
}
