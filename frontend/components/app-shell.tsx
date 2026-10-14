"use client";

import { Info, Menu, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const items = [
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/model", label: "Model notes", icon: Info },
];

function activePath(pathname: string, href: string) {
  if (href === "/patients") return pathname === "/patients" || pathname.startsWith("/patients/");
  return pathname === href;
}

export function AppShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = query.trim();
    router.push(next ? `/patients?q=${encodeURIComponent(next)}` : "/patients");
    setOpen(false);
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "relative flex h-11 items-center gap-3 rounded-2xl px-4 text-sm",
              active ? "text-accent" : "text-secondary hover:bg-raised hover:text-ink",
            )}
          >
            {active ? <span className="absolute left-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
            <Icon aria-hidden size={20} strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[232px] shrink-0 flex-col rounded-panel border border-[var(--border-subtle)] bg-frame p-4 shadow-panel lg:flex">
          <p className="px-4 pb-6 pt-2 text-lg font-semibold">GlycoTwin</p>
          {nav}
          <SignOutButton />
        </aside>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="absolute inset-x-4 bottom-4 top-4 flex flex-col rounded-panel border border-[var(--border-subtle)] bg-frame p-4 shadow-floating">
              <div className="mb-4 flex items-center justify-between px-2">
                <p className="text-lg font-semibold">GlycoTwin</p>
                <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-raised">
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
              {nav}
              <SignOutButton />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[72px] items-center gap-3">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full bg-raised lg:hidden"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>
            <form onSubmit={submitSearch} className="relative min-w-0 flex-1" role="search">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} strokeWidth={1.75} />
              <label htmlFor="patient-search" className="sr-only">
                Search by patient id
              </label>
              <input
                id="patient-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by patient id"
                className="h-11 w-full rounded-full border border-[var(--border-default)] bg-raised pl-11 pr-4 text-sm text-ink placeholder:text-muted"
              />
            </form>
            <DropdownMenu>
              <DropdownMenuTrigger className="h-11 rounded-full border border-[var(--border-default)] px-4 text-sm text-ink">
                {username}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{username}</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => {
                    void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                      router.push("/login");
                      router.refresh();
                    });
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="py-4 text-xs text-secondary">Synthetic data, not clinically validated.</footer>
        </div>
      </div>
    </div>
  );
}
