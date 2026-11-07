import { PublicShell } from "@/components/PublicShell";
import { BookingFlow } from "@/components/BookingFlow";
import { listDoctors } from "@/lib/booking";
import { bookAppointment } from "./actions";

export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ doctor?: string }> }) {
  const sp = await searchParams;
  const doctors = await listDoctors();
  return (
    <PublicShell>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Book an appointment</h1>
      <p className="mb-6 text-sm text-muted">No sign-up needed. You&apos;ll get a patient ID to track your place in the queue.</p>
      <BookingFlow
        doctors={doctors.map((d) => ({ id: d.id, displayName: d.displayName, specialty: d.specialty, consultationFee: d.consultationFee }))}
        initialDoctorId={sp.doctor ? Number(sp.doctor) : undefined}
        action={bookAppointment}
      />
    </PublicShell>
  );
}

