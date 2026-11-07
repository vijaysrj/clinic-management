import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { Stethoscope } from "lucide-react";
import { db, schema } from "@/db";
import { createSession, getSessionUser } from "@/lib/auth";
import { getBranchBySlug } from "@/lib/booking";
import { APP_NAME } from "@/lib/brand";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

export const dynamic = "force-dynamic";

const RESERVED = new Set(["admin", "api", "app", "book", "login", "new", "register", "setup", "staff", "status", "www"]);

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Anyone can register a clinic. They become its admin doctor and can add staff later.
async function register(formData: FormData) {
  "use server";
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const email = get("email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const slug = slugify(get("slug") || get("clinic"));
  const fail = (e: string) => redirect(`/register?e=${encodeURIComponent(e)}`);

  if (!get("clinic") || !get("name") || !email.includes("@")) fail("Please fill in the clinic name, your name and email.");
  if (slug.length < 3 || RESERVED.has(slug)) fail("Pick a web address of at least 3 letters or numbers.");
  if (password.length < 8) fail("Password must be at least 8 characters.");
  if (await getBranchBySlug(slug)) fail(`The address /c/${slug} is already taken. Please pick another.`);
  const [taken] = await db.select({ id: schema.staff.id }).from(schema.staff).where(sql`lower(${schema.staff.email}) = ${email}`).limit(1);
  if (taken) fail("That email already has an account. Sign in instead, or use another email.");

  let staffId: number;
  try {
    staffId = await db.transaction(async (tx) => {
      const [branch] = await tx
        .insert(schema.branches)
        .values({ name: get("clinic"), slug, address: get("address") || null, phone: get("phone") || null })
        .returning();
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
  } catch (e: unknown) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err.code === "23505" || err.cause?.code === "23505") fail("That web address or email was just taken. Please try another.");
    throw e;
  }
  await createSession(staffId!);
  redirect("/staff/schedules?welcome=1");
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getSessionUser()) redirect("/staff");
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white"><Stethoscope className="size-6" /></span>
        <div>
          <h1 className="text-xl font-semibold">Register your clinic</h1>
          <p className="text-sm text-muted">Free to start on {APP_NAME}. You&apos;ll be the admin doctor and can add others later.</p>
        </div>
      </Link>
      <Card className="p-5">
        <form action={register} className="space-y-4">
          <Field label="Clinic name"><Input name="clinic" required /></Field>
          <Field label="Web address for patients" hint="Letters, numbers and dashes. Leave blank to use the clinic name.">
            <div className="flex items-center gap-1">
              <span className="shrink-0 text-sm text-muted">/c/</span>
              <Input name="slug" placeholder="sunrise-clinic" pattern="[A-Za-z0-9-]*" maxLength={40} className="lowercase" />
            </div>
          </Field>
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
      <p className="mt-4 text-center text-sm text-muted">
        Already registered? <Link href="/login" className="font-medium text-brand-700">Sign in</Link>
      </p>
    </div>
  );
}
