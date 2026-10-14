import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SESSION_COOKIE, readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const jar = await cookies();
  const session = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (session) redirect("/patients");
  return (
    <main className="grid min-h-screen place-items-center bg-app p-4">
      <LoginForm />
    </main>
  );
}
