import { requireUser } from "@/lib/auth";
import { listDoctors } from "@/lib/booking";
import { BookingFlow } from "@/components/BookingFlow";
import { PageHeader } from "@/components/ui";
import { bookWalkIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function WalkInPage() {
  const user = await requireUser();
  const doctors = await listDoctors(user.branchId);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Walk-in booking" subtitle="Book for someone at the desk or on the phone. Walk-ins for today are marked as arrived." />
      <BookingFlow
        doctors={doctors.map((d) => ({ id: d.id, displayName: d.displayName, specialty: d.specialty, consultationFee: d.consultationFee }))}
        initialDoctorId={user.doctorId ?? undefined}
        action={bookWalkIn}
        staffMode
      />
    </div>
  );
}
