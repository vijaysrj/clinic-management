import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { listDoctors } from "@/lib/booking";
import { todayISO } from "@/lib/time";
import { Card, PageHeader, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month" | "year";
const PERIODS: { v: Period; label: string; count: number }[] = [
  { v: "day", label: "Daily", count: 30 },
  { v: "week", label: "Weekly", count: 12 },
  { v: "month", label: "Monthly", count: 12 },
  { v: "year", label: "Yearly", count: 5 },
];

/** Start of the bucket containing `iso`, matching Postgres date_trunc (weeks start Monday). */
function bucketStart(iso: string, p: Period): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (p === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (p === "month") d.setUTCDate(1);
  if (p === "year") { d.setUTCMonth(0); d.setUTCDate(1); }
  return d.toISOString().slice(0, 10);
}
function prevBucket(iso: string, p: Period): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (p === "day") d.setUTCDate(d.getUTCDate() - 1);
  if (p === "week") d.setUTCDate(d.getUTCDate() - 7);
  if (p === "month") d.setUTCMonth(d.getUTCMonth() - 1);
  if (p === "year") d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
function label(iso: string, p: Period, short = true): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const o: Intl.DateTimeFormatOptions =
    p === "day" ? { day: "numeric", month: "short" } :
    p === "week" ? { day: "numeric", month: "short" } :
    p === "month" ? { month: "short", year: short ? "2-digit" : "numeric" } : { year: "numeric" };
  return (p === "week" && !short ? "Week of " : "") + d.toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
}

function BarChart({ data, period, format, tone }: { data: { key: string; value: number }[]; period: Period; format: (n: number) => string; tone: string }) {
  const W = 720, H = 200, padL = 48, padB = 26, padT = 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const nice = Math.ceil(max / step) * step;
  const ticks = [0, nice / 2, nice];
  const bw = (W - padL - 8) / data.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / nice);
  const every = Math.ceil(data.length / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{format(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = padL + i * bw;
        return (
          <g key={d.key}>
            <rect x={x + bw * 0.18} y={y(d.value)} width={bw * 0.64} height={Math.max(0, y(0) - y(d.value))} rx="3" fill={tone}>
              <title>{`${label(d.key, period, false)}: ${format(d.value)}`}</title>
            </rect>
            {i % every === 0 && (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--color-muted)">{label(d.key, period)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; doctor?: string }> }) {
  const user = await requireUser({ role: "doctor" });
  const sp = await searchParams;
  const period: Period = (PERIODS.find((p) => p.v === sp.period)?.v ?? "day");
  const count = PERIODS.find((p) => p.v === period)!.count;
  const doctors = await listDoctors(user.branchId);
  const doctorId = sp.doctor === "all" || !sp.doctor ? null : Number(sp.doctor);

  // Buckets from oldest to newest, ending with the current one.
  const keys: string[] = [];
  let k = bucketStart(todayISO(), period);
  for (let i = 0; i < count; i++) { keys.unshift(k); k = prevBucket(k, period); }
  const from = keys[0];
  const to = todayISO();
  const doctorFilter = doctorId ? sql`AND a.doctor_id = ${doctorId}` : sql``;
  const trunc = sql.raw(`'${period}'`);

  const rows = (await db.execute(sql`
    WITH firsts AS (
      SELECT patient_id, min(date) AS first_date FROM appointments WHERE status = 'completed' GROUP BY patient_id
    )
    SELECT to_char(date_trunc(${trunc}, a.date::timestamp), 'YYYY-MM-DD') AS bucket,
           count(*) FILTER (WHERE a.status = 'completed')::int AS seen,
           count(*) FILTER (WHERE a.status = 'completed' AND f.first_date = a.date)::int AS new_patients,
           count(*) FILTER (WHERE a.status = 'no_show')::int AS no_shows,
           coalesce(sum(p.amount), 0)::int AS collected,
           coalesce(sum(p.amount) FILTER (WHERE p.mode = 'cash'), 0)::int AS cash,
           coalesce(sum(p.amount) FILTER (WHERE p.mode = 'upi'), 0)::int AS upi,
           coalesce(sum(p.amount) FILTER (WHERE p.mode = 'card'), 0)::int AS card,
           coalesce(sum(p.amount) FILTER (WHERE p.mode = 'other'), 0)::int AS other
    FROM appointments a
    LEFT JOIN payments p ON p.appointment_id = a.id
    LEFT JOIN firsts f ON f.patient_id = a.patient_id
    WHERE a.branch_id = ${user.branchId} AND a.date BETWEEN ${from} AND ${to} ${doctorFilter}
    GROUP BY 1
  `)) as unknown as { bucket: string; seen: number; new_patients: number; no_shows: number; collected: number; cash: number; upi: number; card: number; other: number }[];

  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const series = keys.map((key) => ({ key, ...(byKey.get(key) ?? { seen: 0, new_patients: 0, no_shows: 0, collected: 0, cash: 0, upi: 0, card: 0, other: 0 }) }));
  const sum = (f: (r: (typeof series)[number]) => number) => series.reduce((s, r) => s + f(r), 0);
  const total = {
    seen: sum((r) => r.seen),
    newP: sum((r) => r.new_patients),
    noShows: sum((r) => r.no_shows),
    collected: sum((r) => r.collected),
    modes: [
      ["Cash", sum((r) => r.cash)],
      ["UPI", sum((r) => r.upi)],
      ["Card", sum((r) => r.card)],
      ["Other", sum((r) => r.other)],
    ] as [string, number][],
  };
  const current = series.at(-1)!;
  const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ period, doctor: doctorId ? String(doctorId) : "all", ...o }).toString();
  const rangeLabel = `${label(from, period, false)} to ${period === "day" ? "today" : "now"}`;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Reports" subtitle={rangeLabel} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-line bg-white p-1">
          {PERIODS.map((p) => (
            <Link key={p.v} href={qs({ period: p.v })} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", p.v === period ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>
              {p.label}
            </Link>
          ))}
        </div>
        {doctors.length > 1 && (
          <div className="inline-flex flex-wrap rounded-xl border border-line bg-white p-1">
            <Link href={qs({ doctor: "all" })} className={cx("rounded-lg px-3 py-1.5 text-sm", !doctorId ? "bg-ink text-white" : "text-muted")}>All doctors</Link>
            {doctors.map((d) => (
              <Link key={d.id} href={qs({ doctor: String(d.id) })} className={cx("rounded-lg px-3 py-1.5 text-sm", d.id === doctorId ? "bg-ink text-white" : "text-muted")}>{d.displayName}</Link>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Patients seen", total.seen.toLocaleString("en-IN"), `${current.seen} ${period === "day" ? "today" : `this ${period}`}`],
          ["New patients", total.newP.toLocaleString("en-IN"), total.seen ? `${Math.round((100 * total.newP) / total.seen)}% of visits` : "—"],
          ["Collected", rupee(total.collected), `${rupee(current.collected)} ${period === "day" ? "today" : `this ${period}`}`],
          ["No-shows", total.noShows.toLocaleString("en-IN"), total.seen + total.noShows ? `${Math.round((100 * total.noShows) / (total.seen + total.noShows))}% of bookings` : "—"],
        ].map(([t, v, s]) => (
          <Card key={t} className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{t}</div>
            <div className="mt-1 text-2xl font-semibold">{v}</div>
            <div className="mt-0.5 text-xs text-muted">{s}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <Card className="p-4">
            <div className="mb-2 font-semibold">Patients seen</div>
            <BarChart data={series.map((r) => ({ key: r.key, value: r.seen }))} period={period} format={(n) => String(Math.round(n))} tone="var(--color-brand-500)" />
          </Card>
          <Card className="p-4">
            <div className="mb-2 font-semibold">Amount collected</div>
            <BarChart data={series.map((r) => ({ key: r.key, value: r.collected }))} period={period} format={(n) => (n >= 1000 ? `₹${(n / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}k` : `₹${Math.round(n)}`)} tone="#0f766e" />
          </Card>
        </div>
        <Card className="h-fit p-4">
          <div className="mb-3 font-semibold">By payment mode</div>
          <div className="space-y-3">
            {total.modes.map(([m, v]) => (
              <div key={m}>
                <div className="flex justify-between text-sm"><span>{m}</span><span className="font-medium">{rupee(v)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${total.collected ? (100 * v) / total.collected : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">{period === "day" ? "Date" : period[0].toUpperCase() + period.slice(1)}</th>
              <th className="px-4 py-2 text-right font-medium">Seen</th>
              <th className="px-4 py-2 text-right font-medium">New</th>
              <th className="px-4 py-2 text-right font-medium">No-shows</th>
              <th className="px-4 py-2 text-right font-medium">Collected</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((r) => (
              <tr key={r.key} className="border-b border-line last:border-0">
                <td className="px-4 py-2">{label(r.key, period, false)}</td>
                <td className="px-4 py-2 text-right">{r.seen}</td>
                <td className="px-4 py-2 text-right">{r.new_patients}</td>
                <td className="px-4 py-2 text-right">{r.no_shows}</td>
                <td className="px-4 py-2 text-right font-medium">{rupee(r.collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted">Counts use the appointment date. Amounts are what reception recorded at checkout.</p>
    </div>
  );
}
