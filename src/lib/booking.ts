import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildSlots, markSlots, sessionsForDate, type SlotView } from "./slots";
import { addDays, nowMinutes, todayISO, weekdayOf } from "./time";
import { generatePatientCode, normalizePhone } from "./patientCode";

const { appointments, doctors, patients, scheduleSessions, scheduleExceptions, branches } = schema;

export const BOOKING_DAYS_AHEAD = 14;
export const ACTIVE_STATUSES = ["booked", "arrived", "in_consultation"] as const;

export const getBranchBySlug = cache(async (slug: string) => {
  const [b] = await db.select().from(branches).where(eq(branches.slug, slug.toLowerCase())).limit(1);
  return b ?? null;
});

export const getBranch = cache(async (id: number) => {
  const [b] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return b ?? null;
});

/** Clinics for the "find your clinic" search on the landing page. */
export async function searchClinics(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  return db
    .select({ slug: branches.slug, name: branches.name, address: branches.address })
    .from(branches)
    .where(sql`${branches.name} ilike ${"%" + term + "%"} or ${branches.address} ilike ${"%" + term + "%"}`)
    .orderBy(asc(branches.name))
    .limit(10);
}

/** Which clinic a patient ID belongs to (IDs are unique across clinics). */
export async function clinicSlugForPatient(code: string) {
  const [r] = await db
    .select({ slug: branches.slug })
    .from(patients)
    .innerJoin(branches, eq(branches.id, patients.branchId))
    .where(eq(patients.patientCode, code))
    .limit(1);
  return r?.slug ?? null;
}

export async function listDoctors(branchId: number) {
  return db
    .select()
    .from(doctors)
    .where(and(eq(doctors.active, true), eq(doctors.branchId, branchId)))
    .orderBy(asc(doctors.displayName));
}

export async function getDoctor(id: number) {
  const [d] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
  return d ?? null;
}

/** All slots for a doctor on a date, marked available / taken / past. */
export async function getDaySlots(doctorId: number, date: string): Promise<SlotView[]> {
  const [weekly, exceptions, taken] = await Promise.all([
    db.select().from(scheduleSessions).where(and(eq(scheduleSessions.doctorId, doctorId), eq(scheduleSessions.weekday, weekdayOf(date)))),
    db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.doctorId, doctorId), eq(scheduleExceptions.date, date))),
    db
      .select({ startMin: appointments.startMin })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date), ne(appointments.status, "cancelled"))),
  ]);
  const slots = buildSlots(sessionsForDate(weekly, exceptions));
  const today = todayISO();
  const nowMin = date === today ? nowMinutes() : date < today ? 24 * 60 : null;
  return markSlots(slots, new Set(taken.map((t) => t.startMin)), nowMin);
}

/** For the date strip: which of the next N days have any free slot. Three queries in total. */
export async function getAvailableDays(doctorId: number, days = BOOKING_DAYS_AHEAD) {
  const today = todayISO();
  const last = addDays(today, days - 1);
  const [weekly, exceptions, taken] = await Promise.all([
    db.select().from(scheduleSessions).where(eq(scheduleSessions.doctorId, doctorId)),
    db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.doctorId, doctorId), sql`${scheduleExceptions.date} between ${today} and ${last}`)),
    db
      .select({ date: appointments.date, startMin: appointments.startMin })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), sql`${appointments.date} between ${today} and ${last}`, ne(appointments.status, "cancelled"))),
  ]);
  const nowMin = nowMinutes();
  const out: { date: string; free: number; total: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const wd = weekdayOf(date);
    const slots = buildSlots(sessionsForDate(weekly.filter((s) => s.weekday === wd), exceptions.filter((e) => e.date === date)));
    const takenSet = new Set(taken.filter((t) => t.date === date).map((t) => t.startMin));
    const marked = markSlots(slots, takenSet, date === today ? nowMin : null);
    out.push({ date, free: marked.filter((s) => s.available).length, total: slots.length });
  }
  return out;
}

export class BookingError extends Error {}

export type BookingInput = {
  branchId: number;
  doctorId: number;
  date: string;
  startMin: number;
  name: string | null;
  phone: string | null;
  age: number | null;
  gender: "male" | "female" | "other" | null;
  /** Returning patient: their ID. Online bookings must also give the last 4 digits of the phone on file. */
  patientCode?: string | null;
  phoneLast4?: string | null;
  source: "online" | "walk_in";
};

/** Look up a returning patient by ID; online callers must also match the last 4 phone digits. */
export async function findReturningPatient(branchId: number, code: string, phoneLast4: string | null, requireLast4: boolean) {
  const [p] = await db.select().from(patients).where(and(eq(patients.branchId, branchId), eq(patients.patientCode, code))).limit(1);
  if (!p) return null;
  if (requireLast4 && (!phoneLast4 || !p.phone.endsWith(phoneLast4))) return null;
  return p;
}

/**
 * Find or create the patient, then take the slot.
 * A returning patient is matched by patient ID, or by the same phone + name.
 */
export async function createBooking(input: BookingInput) {
  const doctor = await getDoctor(input.doctorId);
  if (!doctor || !doctor.active || doctor.branchId !== input.branchId) throw new BookingError("This doctor is not taking bookings.");

  const today = todayISO();
  if (input.date < today || input.date > addDays(today, BOOKING_DAYS_AHEAD)) {
    throw new BookingError("Please pick a date within the next two weeks.");
  }
  const slots = await getDaySlots(input.doctorId, input.date);
  const slot = slots.find((s) => s.startMin === input.startMin);
  if (!slot) throw new BookingError("That time is not in the doctor's schedule.");
  if (!slot.available) throw new BookingError("Sorry, that slot was just taken. Please pick another.");

  const phone = normalizePhone(input.phone ?? "");
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");

  let returning: typeof patients.$inferSelect | null = null;
  if (input.patientCode) {
    returning = await findReturningPatient(input.branchId, input.patientCode, input.phoneLast4 ?? null, input.source === "online");
    if (!returning) throw new BookingError("That Patient ID and phone number don't match our records. Please check, or book as a new patient.");
  } else if (!name || phone.length !== 10) {
    throw new BookingError("Please enter the patient's name and mobile number.");
  }

  return db.transaction(async (tx) => {
    let patient: typeof patients.$inferSelect | undefined = returning ?? undefined;
    if (!patient) {
      [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.branchId, input.branchId), eq(patients.phone, phone), sql`lower(${patients.name}) = lower(${name})`))
        .limit(1);
    }
    if (patient) {
      if (input.age != null || input.gender) {
        await tx
          .update(patients)
          .set({ age: input.age ?? patient.age, gender: input.gender ?? patient.gender })
          .where(eq(patients.id, patient.id));
      }
    } else {
      for (let attempt = 0; attempt < 5 && !patient; attempt++) {
        const rows = await tx
          .insert(patients)
          .values({ branchId: input.branchId, patientCode: generatePatientCode(), name, phone, age: input.age, gender: input.gender })
          .onConflictDoNothing({ target: patients.patientCode })
          .returning();
        patient = rows[0];
      }
      if (!patient) throw new BookingError("Could not create a patient ID. Please try again.");
    }

    // One active booking per patient per doctor per day.
    const dup = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patient.id),
          eq(appointments.doctorId, input.doctorId),
          eq(appointments.date, input.date),
          inArray(appointments.status, [...ACTIVE_STATUSES]),
        ),
      )
      .limit(1);
    if (dup.length) throw new BookingError(`${patient.name} already has a booking with this doctor on that day.`);

    try {
      const [appt] = await tx
        .insert(appointments)
        .values({
          branchId: doctor.branchId,
          doctorId: input.doctorId,
          patientId: patient.id,
          date: input.date,
          startMin: slot.startMin,
          endMin: slot.endMin,
          tokenNo: slot.tokenNo,
          source: input.source,
          arrivedAt: input.source === "walk_in" && input.date === today ? new Date() : null,
          status: input.source === "walk_in" && input.date === today ? "arrived" : "booked",
        })
        .returning();
      return { appointment: appt, patient };
    } catch (e: unknown) {
      const err = e as { code?: string; cause?: { code?: string } };
      if (err.code === "23505" || err.cause?.code === "23505") {
        throw new BookingError("Sorry, that slot was just taken. Please pick another.");
      }
      throw e;
    }
  });
}

/** How many patients are still ahead of this appointment in the doctor's queue. */
export async function patientsAhead(appt: { doctorId: number; date: string; startMin: number }) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, appt.doctorId),
        eq(appointments.date, appt.date),
        lt(appointments.startMin, appt.startMin),
        inArray(appointments.status, [...ACTIVE_STATUSES]),
      ),
    );
  return r?.n ?? 0;
}

/** Everything the public status page shows for a patient ID. */
export async function getPatientStatus(branchId: number, code: string) {
  const [patient] = await db.select().from(patients).where(and(eq(patients.branchId, branchId), eq(patients.patientCode, code))).limit(1);
  if (!patient) return null;
  const today = todayISO();
  const rows = await db
    .select({ a: appointments, doctorName: doctors.displayName, slotMinutes: sql<number>`(${appointments.endMin} - ${appointments.startMin})::int` })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(and(eq(appointments.patientId, patient.id), sql`${appointments.date} >= ${today}`))
    .orderBy(asc(appointments.date), asc(appointments.startMin));

  const upcoming = await Promise.all(
    rows.map(async (r) => {
      const isToday = r.a.date === today;
      const live = isToday && (ACTIVE_STATUSES as readonly string[]).includes(r.a.status);
      const ahead = live ? await patientsAhead(r.a) : null;
      const current = live ? await nowServing(r.a.doctorId, today) : null;
      return { ...r.a, doctorName: r.doctorName, isToday, ahead, estWaitMin: ahead != null ? ahead * r.slotMinutes : null, nowServing: current };
    }),
  );
  return { patient: { name: patient.name, code: patient.patientCode }, upcoming };
}

/** Token currently with the doctor, if any. */
export async function nowServing(doctorId: number, date: string) {
  const [r] = await db
    .select({ tokenNo: appointments.tokenNo })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date), eq(appointments.status, "in_consultation")))
    .orderBy(asc(appointments.startMin))
    .limit(1);
  return r?.tokenNo ?? null;
}

export async function cancelByPatient(branchId: number, appointmentId: number, code: string) {
  const [p] = await db.select({ id: patients.id }).from(patients).where(and(eq(patients.branchId, branchId), eq(patients.patientCode, code))).limit(1);
  if (!p) return false;
  const res = await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.patientId, p.id), eq(appointments.status, "booked")))
    .returning({ id: appointments.id });
  return res.length > 0;
}
