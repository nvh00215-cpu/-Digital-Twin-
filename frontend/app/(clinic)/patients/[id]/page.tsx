import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PatientTwin } from "@/components/patient-twin";
import { logTwinView } from "@/lib/access-log";
import { SESSION_COOKIE, readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const session = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  await logTwinView(session.username, id);
  return <PatientTwin id={id} />;
}
