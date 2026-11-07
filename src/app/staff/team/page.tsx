import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { UserPlus } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

const { staff, doctors, branches } = schema;

async function addStaff(formData: FormData) {
  "use server";
  const admin = await requireUser({ admin: true });
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role")) === "doctor" ? "doctor" : "receptionist";
  if (name.length < 2 || !email.includes("@")) redirect("/staff/team?e=Enter a name and a valid email.");
  if (password.length < 8) redirect("/staff/team?e=Password must be at least 8 characters.");
  const [exists] = await db.select({ id: staff.id }).from(staff).where(sql`lower(${staff.email}) = ${email}`).limit(1);
  if (exists) redirect("/staff/team?e=That email is already in use.");

  await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(staff)
      .values({ branchId: admin.branchId, name, email, passwordHash: await bcrypt.hash(password, 10), role, isAdmin: formData.get("isAdmin") === "on" })
      .returning();
    if (role === "doctor") {
      const fee = Number(formData.get("fee"));
      await tx.insert(doctors).values({
        staffId: s.id,
        branchId: admin.branchId,
        displayName: String(formData.get("displayName") || "").trim() || name,
        specialty: String(formData.get("specialty") || "") || null,
        qualifications: String(formData.get("qualifications") || "") || null,
        registrationNo: String(formData.get("registrationNo") || "") || null,
        consultationFee: Number.isFinite(fee) && fee > 0 ? fee : null,
      });
    }
  });
  revalidatePath("/staff/team");
  redirect("/staff/team");
}

async function toggleActive(formData: FormData) {
  "use server";
  const admin = await requireUser({ admin: true });
  const id = Number(formData.get("id"));
  if (id === admin.staffId) redirect("/staff/team?e=You can't deactivate yourself.");
  const active = formData.get("active") === "true";
  await db.update(staff).set({ active }).where(and(eq(staff.id, id), eq(staff.branchId, admin.branchId)));
  await db.update(doctors).set({ active }).where(eq(doctors.staffId, id));
  revalidatePath("/staff/team");
}

async function updateDoctor(formData: FormData) {
  "use server";
  const admin = await requireUser({ admin: true });
  const fee = Number(formData.get("fee"));
  await db
    .update(doctors)
    .set({
      displayName: String(formData.get("displayName") ?? "").trim(),
      specialty: String(formData.get("specialty") || "") || null,
      qualifications: String(formData.get("qualifications") || "") || null,
      registrationNo: String(formData.get("registrationNo") || "") || null,
      consultationFee: Number.isFinite(fee) && fee > 0 ? fee : null,
    })
    .where(and(eq(doctors.id, Number(formData.get("id"))), eq(doctors.branchId, admin.branchId)));
  revalidatePath("/staff/team");
}

async function updateClinic(formData: FormData) {
  "use server";
  const admin = await requireUser({ admin: true });
  await db
    .update(branches)
    .set({
      name: String(formData.get("name") ?? "").trim() || "Clinic",
      address: String(formData.get("address") || "") || null,
      phone: String(formData.get("phone") || "") || null,
    })
    .where(eq(branches.id, admin.branchId));
  revalidatePath("/", "layout");
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const user = await requireUser({ admin: true });
  const sp = await searchParams;
  const [members, [branch]] = await Promise.all([
    db.select({ s: staff, d: doctors }).from(staff).leftJoin(doctors, eq(doctors.staffId, staff.id)).where(eq(staff.branchId, user.branchId)).orderBy(asc(staff.name)),
    db.select().from(branches).where(eq(branches.id, user.branchId)),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="Team and clinic" subtitle="Add doctors and receptionists, and set the details shown to patients and on prescriptions." />
      {sp.e && <ErrorNote>{sp.e}</ErrorNote>}

      <Card className="p-4">
        <div className="mb-3 font-semibold">Clinic details</div>
        <form action={updateClinic} className="grid gap-3 sm:grid-cols-3">
          <Field label="Clinic name"><Input name="name" defaultValue={branch.name} required /></Field>
          <Field label="Address"><Input name="address" defaultValue={branch.address ?? ""} /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={branch.phone ?? ""} /></Field>
          <div className="sm:col-span-3"><Button type="submit" variant="secondary">Save clinic details</Button></div>
        </form>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Team</h2>
        <Card>
          {members.map(({ s, d }) => (
            <div key={s.id} className="border-b border-line px-4 py-3 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <Badge tone={s.role === "doctor" ? "blue" : "gray"}>{s.role === "doctor" ? "Doctor" : "Receptionist"}</Badge>
                {s.isAdmin && <Badge tone="violet">Admin</Badge>}
                {!s.active && <Badge tone="red">Inactive</Badge>}
                <span className="text-sm text-muted">{s.email}</span>
                <form action={toggleActive} className="ml-auto">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={String(!s.active)} />
                  {s.id !== user.staffId && <Button size="sm" variant={s.active ? "ghost" : "secondary"}>{s.active ? "Deactivate" : "Reactivate"}</Button>}
                </form>
              </div>
              {d && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-brand-700">Doctor profile</summary>
                  <form action={updateDoctor} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={d.id} />
                    <Field label="Name shown to patients"><Input name="displayName" defaultValue={d.displayName} required /></Field>
                    <Field label="Specialty"><Input name="specialty" defaultValue={d.specialty ?? ""} /></Field>
                    <Field label="Qualifications"><Input name="qualifications" defaultValue={d.qualifications ?? ""} placeholder="MBBS, MD" /></Field>
                    <Field label="Registration no."><Input name="registrationNo" defaultValue={d.registrationNo ?? ""} /></Field>
                    <Field label="Consultation fee (₹)"><Input name="fee" inputMode="numeric" defaultValue={d.consultationFee ?? ""} /></Field>
                    <div className="flex items-end"><Button type="submit" variant="secondary">Save profile</Button></div>
                  </form>
                </details>
              )}
            </div>
          ))}
        </Card>
      </section>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold"><UserPlus className="size-5" /> Add a team member</div>
        <form action={addStaff} className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input name="name" required /></Field>
          <Field label="Role">
            <Select name="role" defaultValue="receptionist">
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
            </Select>
          </Field>
          <Field label="Email (used to sign in)"><Input name="email" type="email" required /></Field>
          <Field label="Temporary password" hint="At least 8 characters"><Input name="password" type="text" required minLength={8} /></Field>
          <div className="sm:col-span-2 rounded-xl bg-canvas p-3">
            <div className="mb-2 text-sm font-medium">For doctors</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name shown to patients"><Input name="displayName" placeholder="Dr. …" /></Field>
              <Field label="Specialty"><Input name="specialty" placeholder="General Physician" /></Field>
              <Field label="Qualifications"><Input name="qualifications" placeholder="MBBS" /></Field>
              <Field label="Registration no."><Input name="registrationNo" /></Field>
              <Field label="Consultation fee (₹)"><Input name="fee" inputMode="numeric" /></Field>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAdmin" className="size-4 accent-brand-600" /> Can manage team (admin)</label>
          <div className="sm:col-span-2"><Button type="submit">Add member</Button></div>
        </form>
      </Card>
    </div>
  );
}
