"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { savePad } from "@/lib/visits";

const item = z.object({
  medicineId: z.number().int().positive().nullable(),
  name: z.string().max(200),
  composition: z.string().max(500).nullable(),
  dose: z.string().max(50).nullable(),
  timing: z.string().max(50).nullable(),
  duration: z.string().max(50).nullable(),
  quantity: z.string().max(50).nullable(),
  instructions: z.string().max(300).nullable(),
});
const schema = z.object({
  appointmentId: z.number().int().positive(),
  complaint: z.string().max(2000),
  diagnosis: z.string().max(2000),
  notes: z.string().max(4000),
  advice: z.string().max(2000),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  items: z.array(item).max(30),
});

export async function savePadAction(input: z.input<typeof schema>): Promise<{ ok: true; visitId: number } | { ok: false; error: string }> {
  const user = await requireUser({ role: "doctor" });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the prescription details." };
  try {
    const { visitId } = await savePad(parsed.data, user.branchId);
    revalidatePath("/staff/pad");
    revalidatePath("/staff/queue");
    return { ok: true, visitId };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not save. Please try again." };
  }
}
