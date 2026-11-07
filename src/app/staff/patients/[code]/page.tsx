import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { UserRound } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getPatientHistory } from "@/lib/visits";
import { normalizePatientCode } from "@/lib/patientCode";
import { todayISO } from "@/lib/time";
import { VisitHistory } from "@/components/VisitHistory";
import { Card, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser({ role: "doctor" });
  const code = normalizePatientCode(decodeURIComponent((await params).code));
  const [p] = await db.select().from(schema.patients).where(and(eq(schema.patients.branchId, user.branchId), eq(schema.patients.patientCode, code))).limit(1);
  if (!p) notFound();
  const history = await getPatientHistory(p.id);
  const seen = history.filter((h) => h.status === "completed");
  const spent = history.reduce((s, h) => s + (h.payment?.amount ?? 0), 0);
  const [todayAppt] = user.doctorId
    ? await db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.patientId, p.id),
            eq(schema.appointments.doctorId, user.doctorId),
            eq(schema.appointments.date, todayISO()),
            inArray(schema.appointments.status, ["booked", "arrived", "in_consultation", "completed"]),
          ),
        )
        .limit(1)
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={p.name}
        subtitle={<span className="font-mono">{p.patientCode}</span>}
        actions={todayAppt && <Link href={`/staff/pad?appointment=${todayAppt.id}`} className={buttonClass("primary", "sm")}>Open today&apos;s pad</Link>}
      />
      <Card className="mb-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
          <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-700"><UserRound className="size-5" /></span>
          <div className="text-sm">
            <div>{[p.age && `${p.age} yrs`, p.gender].filter(Boolean).join(", ") || "—"}</div>
            <div className="text-muted">{p.phone}</div>
          </div>
        </div>
        <div><div className="text-xs uppercase text-muted">Visits</div><div className="text-xl font-semibold">{seen.length}</div></div>
        <div><div className="text-xs uppercase text-muted">First seen</div><div className="text-sm font-medium">{seen.at(-1)?.date ?? "—"}</div></div>
        <div><div className="text-xs uppercase text-muted">Total paid</div><div className="text-xl font-semibold">₹{spent.toLocaleString("en-IN")}</div></div>
      </Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Visit history</h2>
      <VisitHistory visits={history} />
    </div>
  );
}
