import Link from "next/link";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { NotebookPen } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getPadData } from "@/lib/visits";
import { fmtDate, fmtMinutes, todayISO } from "@/lib/time";
import { PadEditor } from "@/components/PadEditor";
import { VisitHistory } from "@/components/VisitHistory";
import { Badge, Card, PageHeader, StatusBadge, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PadPage({ searchParams }: { searchParams: Promise<{ appointment?: string }> }) {
  const user = await requireUser({ role: "doctor" });
  const sp = await searchParams;

  if (!sp.appointment) {
    // Pick a patient from today's list: the one inside first, then those waiting.
    const rows = user.doctorId
      ? await db
          .select({ a: schema.appointments, p: schema.patients })
          .from(schema.appointments)
          .innerJoin(schema.patients, eq(schema.patients.id, schema.appointments.patientId))
          .where(
            and(
              eq(schema.appointments.doctorId, user.doctorId),
              eq(schema.appointments.date, todayISO()),
              inArray(schema.appointments.status, ["in_consultation", "arrived", "booked", "completed"]),
            ),
          )
          .orderBy(asc(schema.appointments.startMin))
      : [];
    const upcoming = user.doctorId
      ? await db
          .select({ a: schema.appointments, p: schema.patients })
          .from(schema.appointments)
          .innerJoin(schema.patients, eq(schema.patients.id, schema.appointments.patientId))
          .where(
            and(
              eq(schema.appointments.doctorId, user.doctorId),
              gt(schema.appointments.date, todayISO()),
              inArray(schema.appointments.status, ["booked", "arrived"]),
            ),
          )
          .orderBy(asc(schema.appointments.date), asc(schema.appointments.startMin))
          .limit(20)
      : [];
    const order = { in_consultation: 0, arrived: 1, booked: 2, completed: 3 } as Record<string, number>;
    rows.sort((x, y) => order[x.a.status] - order[y.a.status] || x.a.startMin - y.a.startMin);
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Doctor's pad" subtitle="Pick a patient from today's list, or search for one under Patients." />
        <Card>
          {rows.length === 0 && <p className="p-4 text-sm text-muted">No patients today yet.</p>}
          {rows.map(({ a, p }) => (
            <Link key={a.id} href={`/staff/pad?appointment=${a.id}`} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas">
              <span className="grid size-10 place-items-center rounded-xl bg-canvas font-semibold">{a.tokenNo}</span>
              <span className="flex-1">
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-sm text-muted">{fmtMinutes(a.startMin)} · {p.patientCode}</span>
              </span>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </Card>
        {upcoming.length > 0 && (
          <>
            <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Coming up</h2>
            <Card>
              {upcoming.map(({ a, p }) => (
                <Link key={a.id} href={`/staff/patients/${p.patientCode}`} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas">
                  <span className="grid size-10 place-items-center rounded-xl bg-canvas font-semibold">{a.tokenNo}</span>
                  <span className="flex-1">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-sm text-muted">{fmtDate(a.date)} · {fmtMinutes(a.startMin)} · {p.patientCode}</span>
                  </span>
                  {a.source === "walk_in" && <Badge tone="gray">Walk-in</Badge>}
                </Link>
              ))}
            </Card>
          </>
        )}
      </div>
    );
  }

  const data = await getPadData(Number(sp.appointment), user.branchId);
  if (!data) notFound();
  const { appointment: a, patient: p, record, history } = data;
  const last = history.find((h) => h.items.length);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white"><NotebookPen className="size-6" /></span>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>{[p.age && `${p.age} yrs`, p.gender && p.gender[0].toUpperCase() + p.gender.slice(1)].filter(Boolean).join(", ")}</span>
            <span className="font-mono">{p.patientCode}</span>
            <span>{p.phone}</span>
            <span>Token {a.tokenNo} · {fmtMinutes(a.startMin)}</span>
            <StatusBadge status={a.status} />
            {history.length > 0 ? <Badge tone="blue">{history.length} earlier visit{history.length > 1 ? "s" : ""}</Badge> : <Badge tone="green">First visit</Badge>}
          </div>
        </div>
        <Link href={`/staff/patients/${p.patientCode}`} className={buttonClass("secondary", "sm")}>Full history</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <PadEditor
          appointmentId={a.id}
          initial={{
            complaint: record?.complaint ?? "",
            diagnosis: record?.diagnosis ?? "",
            notes: record?.notes ?? "",
            advice: record?.advice ?? "",
            followUpDate: record?.followUpDate ?? null,
            items: record?.items ?? [],
          }}
          lastItems={last?.items ?? null}
        />
        <aside>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">History</h2>
          <VisitHistory visits={history.slice(0, 10)} compact />
        </aside>
      </div>
    </div>
  );
}
