import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { Stethoscope } from "lucide-react";
import { db, schema } from "@/db";
import { createSession, getSessionUser } from "@/lib/auth";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [user] = await db.select().from(schema.staff).where(sql`lower(${schema.staff.email}) = ${email}`).limit(1);
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) redirect("/login?e=1");
  await createSession(user.id);
  redirect("/staff");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getSessionUser()) redirect("/staff");
  const sp = await searchParams;
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid size-11 place-items-center rounded-xl bg-brand-600 text-white"><Stethoscope className="size-6" /></span>
          <h1 className="text-xl font-semibold">Staff sign in</h1>
          <p className="text-sm text-muted">For doctors and reception</p>
        </div>
        <form action={login} className="space-y-4">
          <Field label="Email"><Input name="email" type="email" required autoComplete="username" autoFocus /></Field>
          <Field label="Password"><Input name="password" type="password" required autoComplete="current-password" /></Field>
          {sp.e && <ErrorNote>Email or password is incorrect.</ErrorNote>}
          <Button type="submit" size="lg" className="w-full">Sign in</Button>
        </form>
      </Card>
    </div>
  );
}
