"use server";

import { BookingError, createBooking } from "@/lib/booking";
import { bookingSchema, type BookingForm, type BookingResult } from "@/lib/bookingSchema";
import { normalizePatientCode } from "@/lib/patientCode";

export async function bookAppointment(form: BookingForm): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(form);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  const d = parsed.data;
  try {
    const { appointment, patient } = await createBooking({
      ...d,
      patientCode: d.patientCode ? normalizePatientCode(d.patientCode) : null,
      source: "online",
    });
    return { ok: true, code: patient.patientCode, appointmentId: appointment.id };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
