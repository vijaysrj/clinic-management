import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Phone } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { listDoctors } from "@/lib/booking";
import { addDays, fmtDate, fmtMinutes, todayISO } from "@/lib/time";
import { AutoRefresh } from "@/components/AutoRefresh";
import { QueueActions } from "@/components/QueueActions";
import { Badge, Card, PageHeader, StatusBadge, buttonClass, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

const { appointments, patients, payments } = schema;

const MODE_LABEL: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", other: "Other" };

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ date?: string; doctor?: string; highlight?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const doctors = await listDoctors(user.branchId);
  const doctorId = sp.doctor ? Number(sp.doctor) : user.doctorId ?? doctors[0]?.id;
  const doctor = doctors.find((d) => d.id === doctorId);

  const rows = doctorId
    ? await db
        .select({ a: appointments, p: patients, pay: payments })
        .from(appointments)
        .innerJoin(patients, eq(patients.id, appointments.patientId))
        .leftJoin(payments, eq(payments.appointmentId, appointments.id))
        .where(and(eq(appointments.branchId, user.branchId), eq(appointments.doctorId, doctorId), eq(appointments.date, date)))
        .orderBy(asc(appointments.startMin))
    : [];

  const waiting = rows.filter((r) => r.a.status === "booked" || r.a.status === "arrived");
  const inside = rows.filter((r) => r.a.status === "in_consultation");
  const done = rows.filter((r) => ["completed", "no_show", "cancelled"].includes(r.a.status));
  const collected = rows.reduce((s, r) => s + (r.pay?.amount ?? 0), 0);
  const highlight = Number(sp.highlight);

  const qs = (o: Record<string, string | number | undefined>) =>
    "?" + new URLSearchParams(Object.entries({ date, doctor: doctorId, ...o }).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString();

  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0", r.a.id === highlight && "bg-brand-50")}>
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-canvas text-lg font-semibold">{r.a.tokenNo}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{r.p.name}</span>
          <span className="text-xs text-muted">{[r.p.age && `${r.p.age}y`, r.p.gender?.[0]?.toUpperCase()].filter(Boolean).join(" ")}</span>
          <StatusBadge status={r.a.status} />
          {r.a.source === "walk_in" && <Badge tone="gray">Walk-in</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>{fmtMinutes(r.a.startMin)}</span>
          <span className="font-mono text-xs">{r.p.patientCode}</span>
          <a href={`tel:${r.p.phone}`} className="inline-flex items-center gap-1 hover:text-ink"><Phone className="size-3.5" />{r.p.phone}</a>
          {r.pay && <span className="font-medium text-brand-700">₹{r.pay.amount} · {MODE_LABEL[r.pay.mode]}</span>}
        </div>
      </div>
      <QueueActions
        id={r.a.id}
        status={r.a.status}
        defaultFee={doctor?.consultationFee ?? null}
        payment={r.pay ? { amount: r.pay.amount, mode: r.pay.mode } : null}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      {date === today && <AutoRefresh seconds={20} />}
      <PageHeader
        title={date === today ? "Today's queue" : `Queue for ${fmtDate(date)}`}
        subtitle={fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <>
            <Link href={qs({ date: addDays(date, -1) })} className={buttonClass("secondary", "sm")}>Previous day</Link>
            {date !== today && <Link href={qs({ date: today })} className={buttonClass("secondary", "sm")}>Today</Link>}
            <Link href={qs({ date: addDays(date, 1) })} className={buttonClass("secondary", "sm")}>Next day</Link>
          </>
        }
      />

      {doctors.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {doctors.map((d) => (
            <Link key={d.id} href={qs({ doctor: d.id })} className={cx("rounded-full border px-3 py-1.5 text-sm", d.id === doctorId ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-brand-50")}>
              {d.displayName}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Waiting", waiting.length],
          ["With doctor", inside.length],
          ["Seen", rows.filter((r) => r.a.status === "completed").length],
          ["Collected", `₹${collected.toLocaleString("en-IN")}`],
        ].map(([label, v]) => (
          <Card key={label} className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{v}</div>
          </Card>
        ))}
      </div>

      {!doctorId ? (
        <Card className="p-6 text-sm text-muted">Add a doctor under Team to start taking bookings.</Card>
      ) : (
        <div className="space-y-6">
          {inside.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-violet-700">With doctor</h2>
              <Card className="border-violet-200">{inside.map((r) => <Row key={r.a.id} r={r} />)}</Card>
            </section>
          )}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Waiting ({waiting.length})</h2>
            <Card>
              {waiting.length ? waiting.map((r) => <Row key={r.a.id} r={r} />) : <p className="p-4 text-sm text-muted">Nobody waiting.</p>}
            </Card>
          </section>
          {done.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Done ({done.length})</h2>
              <Card>{done.map((r) => <Row key={r.a.id} r={r} />)}</Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
