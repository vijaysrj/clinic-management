import { z } from "zod";

const blankToNull = (v: unknown) => (v === "" || v == null ? null : v);

export const bookingSchema = z
  .object({
    doctorId: z.coerce.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startMin: z.coerce.number().int().min(0).max(24 * 60),
    name: z.preprocess(blankToNull, z.string().trim().max(80).nullable()),
    phone: z.preprocess(blankToNull, z.string().transform((s) => s.replace(/\D/g, "").slice(-10)).nullable()),
    age: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(120).nullable()),
    gender: z.preprocess(blankToNull, z.enum(["male", "female", "other"]).nullable()),
    patientCode: z.preprocess(blankToNull, z.string().max(20).nullable()),
    phoneLast4: z.preprocess(blankToNull, z.string().regex(/^\d{4}$/, "Enter the last 4 digits of your mobile number").nullable()),
  })
  .superRefine((d, ctx) => {
    if (d.patientCode) return;
    if (!d.name || d.name.length < 2) ctx.addIssue({ code: "custom", message: "Please enter the patient's name", path: ["name"] });
    if (!d.phone || !/^[6-9]\d{9}$/.test(d.phone)) ctx.addIssue({ code: "custom", message: "Please enter a valid 10-digit mobile number", path: ["phone"] });
  });

export type BookingForm = z.input<typeof bookingSchema>;
export type BookingResult = { ok: true; code: string; appointmentId: number } | { ok: false; error: string };
