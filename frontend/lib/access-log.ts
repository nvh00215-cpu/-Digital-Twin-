import { appendFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";

export async function logTwinView(doctor: string, patientId: string) {
  const line = JSON.stringify({
    doctor,
    patient_id: patientId,
    time: new Date().toISOString(),
  });

  // Always visible in Vercel's runtime logs.
  console.log("twin_view", line);

  // Also keep a local file, but never let logging break the page.
  try {
    const base = process.env.VERCEL ? os.tmpdir() : process.cwd();
    const dir = path.join(base, "logs");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "access.log"), line + "\n", "utf8");
  } catch (error) {
    console.error("access log write failed", error);
  }
}