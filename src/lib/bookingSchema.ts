import { z } from "zod";

export const bookingSchema = z.object({
  doctorId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.coerce.number().int().min(0).max(24 * 60),
  name: z.string().trim().min(2, "Please enter the patient's name").max(80),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, "").slice(-10))
    .refine((s) => /^[6-9]\d{9}$/.test(s), "Please enter a valid 10-digit mobile number"),
  age: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(120).nullable()),
  gender: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(["male", "female", "other"]).nullable()),
  patientCode: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().max(20).nullable()),
});

export type BookingForm = z.input<typeof bookingSchema>;
export type BookingResult = { ok: true; code: string; appointmentId: number } | { ok: false; error: string };
