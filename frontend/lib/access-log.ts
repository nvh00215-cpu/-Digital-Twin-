import { appendFile, mkdir } from "fs/promises";
import path from "path";

export async function logTwinView(doctor: string, patientId: string) {
  const dir = path.join(process.cwd(), "logs");
  await mkdir(dir, { recursive: true });
  const line =
    JSON.stringify({
      doctor,
      patient_id: patientId,
      time: new Date().toISOString(),
    }) + "\n";
  await appendFile(path.join(dir, "access.log"), line, "utf8");
}
