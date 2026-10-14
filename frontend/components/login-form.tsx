"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Sign-in failed. Check the doctor id and password.");
      return;
    }
    router.push("/patients");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-panel border border-[var(--border-subtle)] p-6 shadow-panel"
      style={{ background: "linear-gradient(145deg, var(--surface-glass-from), var(--surface-glass-to))" }}
    >
      <p className="text-sm text-secondary">GlycoTwin</p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight">Doctor sign in</h1>
      <label className="mt-6 block text-xs text-secondary" htmlFor="username">
        Doctor id
      </label>
      <Input
        id="username"
        name="username"
        autoComplete="username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        className="mt-2"
        required
      />
      <label className="mt-4 block text-xs text-secondary" htmlFor="password">
        Password
      </label>
      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2"
        required
      />
      {error ? (
        <p className="mt-4 text-sm text-[var(--status-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
