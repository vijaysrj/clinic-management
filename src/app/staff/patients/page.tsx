import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { Search } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { normalizePatientCode } from "@/lib/patientCode";
import { fmtDate } from "@/lib/time";
import { Button, Card, Input, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const { patients, appointments } = schema;

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser({ role: "doctor" });
  const q = ((await searchParams).q ?? "").trim();
  let results: { id: number; patientCode: string; name: string; phone: string; age: number | null; lastVisit: string | null; visits: number }[] = [];

  {
    const digits = q.replace(/\D/g, "");
    const looksLikeCode = !!q && /^(pt)?[-\s]?[a-z0-9]{6}$/i.test(q) && /[a-z]/i.test(q.replace(/^pt/i, ""));
    if (looksLikeCode) {
      const [hit] = await db.select({ code: patients.patientCode }).from(patients).where(and(eq(patients.branchId, user.branchId), eq(patients.patientCode, normalizePatientCode(q)))).limit(1);
      if (hit) redirect(`/staff/patients/${hit.code}`);
    }
    // No search: the most recently booked patients.
    const where = !q
      ? undefined
      : digits.length >= 4 && digits.length === q.replace(/[\s+-]/g, "").length
        ? like(patients.phone, `%${digits.slice(-10)}%`)
        : or(ilike(patients.name, `%${q}%`), ilike(patients.patientCode, `%${q}%`));
    results = await db
      .select({
        id: patients.id,
        patientCode: patients.patientCode,
        name: patients.name,
        phone: patients.phone,
        age: patients.age,
        lastVisit: sql<string | null>`max(${appointments.date}) filter (where ${appointments.status} = 'completed')`,
        visits: sql<number>`count(${appointments.id}) filter (where ${appointments.status} = 'completed')::int`,
      })
      .from(patients)
      .leftJoin(appointments, eq(appointments.patientId, patients.id))
      .where(and(eq(patients.branchId, user.branchId), where))
      .groupBy(patients.id)
      .orderBy(sql`max(${appointments.createdAt}) desc nulls last`, desc(patients.createdAt))
      .limit(50);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Patients" subtitle="Search by patient ID, phone number or name." />
      <form className="mb-6 flex gap-2">
        <Input name="q" defaultValue={q} autoFocus placeholder="PT-7K3M9Q, 98765 43210 or name" />
        <Button type="submit"><Search className="size-4" /> Search</Button>
      </form>
      {!q && <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Recent patients</h2>}
      {(
        <Card>
          {results.length === 0 && <p className="p-4 text-sm text-muted">{q ? <>No patients found for “{q}”.</> : "No patients yet."}</p>}
          {results.map((r) => (
            <Link key={r.id} href={`/staff/patients/${r.patientCode}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas">
              <span className="min-w-40 flex-1">
                <span className="font-medium">{r.name}</span>
                {r.age != null && <span className="ml-2 text-sm text-muted">{r.age}y</span>}
              </span>
              <span className="font-mono text-sm">{r.patientCode}</span>
              <span className="text-sm text-muted">{r.phone}</span>
              <span className="w-36 text-right text-sm text-muted">{r.lastVisit ? `${r.visits} visit${r.visits === 1 ? "" : "s"} · ${fmtDate(r.lastVisit, { day: "numeric", month: "short" })}` : "No visits yet"}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
