import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { appointments, patients, visits, prescriptions, prescriptionItems, doctors, payments, medicines } = schema;

export type PadItem = {
  medicineId: number | null;
  name: string;
  composition: string | null;
  dose: string | null;
  timing: string | null;
  duration: string | null;
  quantity: string | null;
  instructions: string | null;
};

export type VisitRecord = {
  appointmentId: number;
  visitId: number | null;
  date: string;
  startMin: number;
  status: string;
  doctorName: string;
  complaint: string | null;
  diagnosis: string | null;
  notes: string | null;
  advice: string | null;
  followUpDate: string | null;
  items: PadItem[];
  payment: { amount: number; mode: string } | null;
};

/** Every appointment of a patient with its clinical record, newest first. */
export async function getPatientHistory(patientId: number, excludeAppointmentId?: number): Promise<VisitRecord[]> {
  const rows = await db
    .select({ a: appointments, v: visits, p: prescriptions, doctorName: doctors.displayName, pay: payments })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .leftJoin(visits, eq(visits.appointmentId, appointments.id))
    .leftJoin(prescriptions, eq(prescriptions.visitId, visits.id))
    .leftJoin(payments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.patientId, patientId),
        excludeAppointmentId ? ne(appointments.id, excludeAppointmentId) : undefined,
        inArray(appointments.status, ["completed", "in_consultation", "arrived", "booked", "no_show"]),
      ),
    )
    .orderBy(desc(appointments.date), desc(appointments.startMin));

  const prescIds = rows.map((r) => r.p?.id).filter((x): x is number => x != null);
  const items = prescIds.length
    ? await db.select().from(prescriptionItems).where(inArray(prescriptionItems.prescriptionId, prescIds)).orderBy(asc(prescriptionItems.position))
    : [];

  return rows.map((r) => ({
    appointmentId: r.a.id,
    visitId: r.v?.id ?? null,
    date: r.a.date,
    startMin: r.a.startMin,
    status: r.a.status,
    doctorName: r.doctorName,
    complaint: r.v?.complaint ?? null,
    diagnosis: r.v?.diagnosis ?? null,
    notes: r.v?.notes ?? null,
    advice: r.p?.advice ?? null,
    followUpDate: r.v?.followUpDate ?? null,
    items: items.filter((i) => i.prescriptionId === r.p?.id).map(toPadItem),
    payment: r.pay ? { amount: r.pay.amount, mode: r.pay.mode } : null,
  }));
}

function toPadItem(i: typeof prescriptionItems.$inferSelect): PadItem {
  return {
    medicineId: i.medicineId,
    name: i.name,
    composition: i.composition,
    dose: i.dose,
    timing: i.timing,
    duration: i.duration,
    quantity: i.quantity,
    instructions: i.instructions,
  };
}

export async function getPadData(appointmentId: number, branchId: number) {
  const [row] = await db
    .select({ a: appointments, patient: patients, doctor: doctors })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.branchId, branchId)))
    .limit(1);
  if (!row) return null;
  const all = await getPatientHistory(row.patient.id);
  const record = all.find((h) => h.appointmentId === appointmentId);
  const history = all.filter((h) => h.appointmentId !== appointmentId && (h.visitId != null || h.status === "completed"));
  return { appointment: row.a, patient: row.patient, doctor: row.doctor, record: record ?? null, history };
}

export type SavePadInput = {
  appointmentId: number;
  complaint: string;
  diagnosis: string;
  notes: string;
  advice: string;
  followUpDate: string | null;
  items: PadItem[];
};

/** Save the pad: one visit + one prescription per appointment; items are replaced as a whole. */
export async function savePad(input: SavePadInput, branchId: number) {
  return db.transaction(async (tx) => {
    const [appt] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, input.appointmentId), eq(appointments.branchId, branchId)))
      .limit(1);
    if (!appt) throw new Error("Appointment not found");

    const clean = (s: string | null | undefined) => (s ?? "").trim() || null;
    const [visit] = await tx
      .insert(visits)
      .values({
        appointmentId: appt.id,
        complaint: clean(input.complaint),
        diagnosis: clean(input.diagnosis),
        notes: clean(input.notes),
        followUpDate: input.followUpDate || null,
      })
      .onConflictDoUpdate({
        target: visits.appointmentId,
        set: {
          complaint: clean(input.complaint),
          diagnosis: clean(input.diagnosis),
          notes: clean(input.notes),
          followUpDate: input.followUpDate || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    const [presc] = await tx
      .insert(prescriptions)
      .values({ visitId: visit.id, advice: clean(input.advice) })
      .onConflictDoUpdate({ target: prescriptions.visitId, set: { advice: clean(input.advice) } })
      .returning();

    await tx.delete(prescriptionItems).where(eq(prescriptionItems.prescriptionId, presc.id));

    const items = input.items.filter((i) => i.name.trim());
    for (const [position, item] of items.entries()) {
      let medicineId = item.medicineId;
      if (!medicineId) {
        // A medicine typed freely is remembered for this clinic so it is suggested next time.
        const name = item.name.trim();
        const [found] = await tx
          .select({ id: medicines.id })
          .from(medicines)
          .where(and(sql`lower(${medicines.brandName}) = lower(${name})`, sql`(${medicines.branchId} IS NULL OR ${medicines.branchId} = ${branchId})`))
          .limit(1);
        medicineId =
          found?.id ??
          (await tx.insert(medicines).values({ brandName: name, composition: clean(item.composition), source: "custom", branchId }).returning({ id: medicines.id }))[0].id;
      }
      await tx.insert(prescriptionItems).values({
        prescriptionId: presc.id,
        position,
        medicineId,
        name: item.name.trim(),
        composition: clean(item.composition),
        dose: clean(item.dose),
        timing: clean(item.timing),
        duration: clean(item.duration),
        quantity: clean(item.quantity),
        instructions: clean(item.instructions),
      });
    }

    // Opening the pad means the patient is with the doctor.
    if (appt.status === "booked" || appt.status === "arrived") {
      await tx.update(appointments).set({ status: "in_consultation", inAt: new Date() }).where(eq(appointments.id, appt.id));
    }
    return { visitId: visit.id };
  });
}

export async function getPrintData(visitId: number, branchId: number) {
  const [row] = await db
    .select({ v: visits, a: appointments, patient: patients, doctor: doctors, p: prescriptions, branch: schema.branches })
    .from(visits)
    .innerJoin(appointments, eq(appointments.id, visits.appointmentId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(schema.branches, eq(schema.branches.id, appointments.branchId))
    .leftJoin(prescriptions, eq(prescriptions.visitId, visits.id))
    .where(and(eq(visits.id, visitId), eq(appointments.branchId, branchId)))
    .limit(1);
  if (!row) return null;
  const items = row.p
    ? await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, row.p.id)).orderBy(asc(prescriptionItems.position))
    : [];
  if (row.p && !row.p.printedAt) await db.update(prescriptions).set({ printedAt: new Date() }).where(eq(prescriptions.id, row.p.id));
  return { ...row, items: items.map(toPadItem) };
}
