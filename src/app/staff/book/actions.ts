"use server";

import { requireUser } from "@/lib/auth";
import { BookingError, createBooking } from "@/lib/booking";
import { bookingSchema, type BookingForm, type BookingResult } from "@/lib/bookingSchema";
import { normalizePatientCode } from "@/lib/patientCode";

export async function bookWalkIn(form: BookingForm): Promise<BookingResult> {
  const user = await requireUser();
  const parsed = bookingSchema.safeParse(form);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  const d = parsed.data;
  try {
    const { appointment, patient } = await createBooking({
      ...d,
      branchId: user.branchId,
      patientCode: d.patientCode ? normalizePatientCode(d.patientCode) : null,
      source: "walk_in",
    });
    return { ok: true, code: patient.patientCode, appointmentId: appointment.id };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
