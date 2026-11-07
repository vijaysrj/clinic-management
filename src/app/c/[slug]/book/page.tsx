import { PublicShell } from "@/components/PublicShell";
import { BookingFlow } from "@/components/BookingFlow";
import { listDoctors } from "@/lib/booking";
import { clinicFromParams } from "../clinic";
import { bookAppointment } from "./actions";

export const dynamic = "force-dynamic";

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ doctor?: string; id?: string }> }) {
  const clinic = await clinicFromParams(params);
  const sp = await searchParams;
  const doctors = await listDoctors(clinic.id);
  return (
    <PublicShell clinic={clinic}>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Book an appointment</h1>
      <p className="mb-6 text-sm text-muted">No sign-up needed. Been here before? Just pick a time and enter your Patient ID.</p>
      <BookingFlow
        doctors={doctors.map((d) => ({ id: d.id, displayName: d.displayName, specialty: d.specialty, consultationFee: d.consultationFee }))}
        initialDoctorId={sp.doctor ? Number(sp.doctor) : undefined}
        initialPatientCode={sp.id}
        clinicSlug={clinic.slug}
        action={bookAppointment.bind(null, clinic.slug)}
      />
    </PublicShell>
  );
}
