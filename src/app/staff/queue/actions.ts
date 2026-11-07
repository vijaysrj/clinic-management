"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

const { appointments, payments } = schema;
type Status = (typeof schema.apptStatus.enumValues)[number];

const ALLOWED: Record<Status, Status[]> = {
  booked: ["arrived", "in_consultation", "no_show", "cancelled"],
  arrived: ["in_consultation", "booked", "no_show", "cancelled"],
  in_consultation: ["arrived"], // "completed" goes through completeVisit
  completed: [],
  no_show: ["booked"],
  cancelled: [],
};

export async function setStatus(appointmentId: number, next: Status) {
  const user = await requireUser();
  const from = (Object.keys(ALLOWED) as Status[]).filter((s) => ALLOWED[s].includes(next));
  const now = new Date();
  const stamp =
    next === "arrived" ? { arrivedAt: now } :
    next === "in_consultation" ? { inAt: now } :
    next === "cancelled" ? { cancelledAt: now } : {};
  await db
    .update(appointments)
    .set({ status: next, ...stamp })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.branchId, user.branchId), inArray(appointments.status, from)));
  revalidatePath("/staff/queue");
}

const paymentSchema = z.object({
  appointmentId: z.coerce.number().int().positive(),
  amount: z.coerce.number().int().min(0).max(1_000_000),
  mode: z.enum(["cash", "upi", "card", "other"]),
});

/** Mark a visit completed and record what was collected. Also used to correct a payment later. */
export async function completeVisit(input: z.input<typeof paymentSchema>) {
  const user = await requireUser();
  const p = paymentSchema.parse(input);
  await db.transaction(async (tx) => {
    const [appt] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, p.appointmentId), eq(appointments.branchId, user.branchId)))
      .limit(1);
    if (!appt || !["booked", "arrived", "in_consultation", "completed"].includes(appt.status)) {
      throw new Error("This visit can't be completed.");
    }
    if (appt.status !== "completed") {
      await tx.update(appointments).set({ status: "completed", completedAt: new Date() }).where(eq(appointments.id, appt.id));
    }
    await tx
      .insert(payments)
      .values({ appointmentId: appt.id, amount: p.amount, mode: p.mode, receivedBy: user.staffId })
      .onConflictDoUpdate({ target: payments.appointmentId, set: { amount: p.amount, mode: p.mode, receivedBy: user.staffId } });
  });
  revalidatePath("/staff/queue");
}
