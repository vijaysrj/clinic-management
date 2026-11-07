import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Stethoscope } from "lucide-react";
import { db, schema } from "@/db";
import { createSession } from "@/lib/auth";
import { getDefaultBranch } from "@/lib/booking";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

export const dynamic = "force-dynamic";

// First-run setup: only works while the database has no clinic yet.
async function setup(formData: FormData) {
  "use server";
  if (await getDefaultBranch()) redirect("/login");
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const email = get("email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!get("clinic") || !get("name") || !email.includes("@")) redirect("/setup?e=Please fill in the clinic name, your name and email.");
  if (password.length < 8) redirect("/setup?e=Password must be at least 8 characters.");

  const staffId = await db.transaction(async (tx) => {
    const [branch] = await tx.insert(schema.branches).values({ name: get("clinic"), address: get("address") || null, phone: get("phone") || null }).returning();
    const [s] = await tx
      .insert(schema.staff)
      .values({ branchId: branch.id, name: get("name"), email, passwordHash: await bcrypt.hash(password, 10), role: "doctor", isAdmin: true })
      .returning();
    const fee = Number(get("fee"));
    const [doctor] = await tx
      .insert(schema.doctors)
      .values({
        staffId: s.id,
        branchId: branch.id,
        displayName: get("name"),
        specialty: get("specialty") || null,
        qualifications: get("qualifications") || null,
        registrationNo: get("registrationNo") || null,
        consultationFee: fee > 0 ? fee : null,
      })
      .returning();
    // A starting schedule (Mon–Sat 9 AM–1 PM, 10-minute slots) that can be changed under Schedules.
    await tx.insert(schema.scheduleSessions).values([1, 2, 3, 4, 5, 6].map((weekday) => ({ doctorId: doctor.id, weekday, startMin: 540, endMin: 780, slotMinutes: 10 })));
    return s.id;
  });
  await createSession(staffId);
  redirect("/staff/schedules");
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getDefaultBranch()) redirect("/login");
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white"><Stethoscope className="size-6" /></span>
        <div>
          <h1 className="text-xl font-semibold">Set up your clinic</h1>
          <p className="text-sm text-muted">This runs once. You&apos;ll be the admin doctor and can add others later.</p>
        </div>
      </div>
      <Card className="p-5">
        <form action={setup} className="space-y-4">
          <Field label="Clinic name"><Input name="clinic" required /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address"><Input name="address" /></Field>
            <Field label="Phone"><Input name="phone" /></Field>
          </div>
          <hr className="border-line" />
          <Field label="Your name (as shown to patients)"><Input name="name" required placeholder="Dr. …" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Specialty"><Input name="specialty" placeholder="General Physician" /></Field>
            <Field label="Qualifications"><Input name="qualifications" placeholder="MBBS" /></Field>
            <Field label="Registration no."><Input name="registrationNo" /></Field>
            <Field label="Consultation fee (₹)"><Input name="fee" inputMode="numeric" /></Field>
          </div>
          <Field label="Email (to sign in)"><Input name="email" type="email" required /></Field>
          <Field label="Password" hint="At least 8 characters"><Input name="password" type="password" required minLength={8} /></Field>
          {sp.e && <ErrorNote>{sp.e}</ErrorNote>}
          <Button type="submit" size="lg" className="w-full">Create clinic</Button>
        </form>
      </Card>
    </div>
  );
}
