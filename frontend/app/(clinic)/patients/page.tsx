import { Suspense } from "react";
import { PatientList } from "@/components/patient-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <PatientList />
    </Suspense>
  );
}
