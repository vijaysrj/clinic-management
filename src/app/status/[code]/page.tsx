import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, CircleCheck, Users } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyButton } from "@/components/CopyButton";
import { Badge, Button, Card, StatusBadge, buttonClass } from "@/components/ui";
import { cancelByPatient, getPatientStatus } from "@/lib/booking";
import { normalizePatientCode } from "@/lib/patientCode";
import { fmtDate, fmtMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";

async function cancel(formData: FormData) {
  "use server";
  const code = String(formData.get("code"));
  await cancelByPatient(Number(formData.get("id")), code);
  redirect(`/status/${code}`);
}

export default async function StatusPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ booked?: string }> }) {
  const { code: raw } = await params;
  const sp = await searchParams;
  const code = normalizePatientCode(decodeURIComponent(raw));
  if (code !== raw) redirect(`/status/${code}`);
  const status = await getPatientStatus(code);
  if (!status) notFound();
  const justBooked = sp.booked ? status.upcoming.find((a) => a.id === Number(sp.booked)) : undefined;

  return (
    <PublicShell>
      <AutoRefresh seconds={30} />
      {justBooked && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-brand-600 p-4 text-white">
          <CircleCheck className="mt-0.5 size-6 shrink-0" />
          <div>
            <div className="font-semibold">You&apos;re booked!</div>
            <div className="text-sm text-white/85">Save your patient ID below. You&apos;ll need it to check your status.</div>
          </div>
        </div>
      )}

      <Card className="mb-5 p-5 text-center">
        <div className="text-sm text-muted">Patient ID for {status.patient.name}</div>
        <div className="my-1 font-mono text-3xl font-semibold tracking-widest">{status.patient.code}</div>
        <CopyButton text={status.patient.code} />
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Upcoming appointments</h2>
      {status.upcoming.length === 0 && (
        <Card className="p-5 text-sm text-muted">
          No upcoming appointments. <Link href="/book" className="font-medium text-brand-700">Book one</Link>
        </Card>
      )}
      <div className="space-y-3">
        {status.upcoming.map((a) => {
          const live = a.ahead != null;
          return (
            <Card key={a.id} className="overflow-hidden">
              {live && (
                <div className="grid grid-cols-2 divide-x divide-line border-b border-line bg-brand-50">
                  <div className="p-4 text-center">
                    <div className="text-4xl font-semibold text-brand-700">{a.status === "in_consultation" ? "—" : a.ahead}</div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted"><Users className="size-3.5" /> waiting before you</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-4xl font-semibold text-brand-700">{a.nowServing ?? "—"}</div>
                    <div className="mt-1 text-xs text-muted">token with doctor now</div>
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold">{a.doctorName}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                    <CalendarDays className="size-4" /> {a.isToday ? "Today" : fmtDate(a.date)} · {fmtMinutes(a.startMin)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="gray">Token {a.tokenNo}</Badge>
                    <StatusBadge status={a.status} />
                  </div>
                  {live && a.status !== "in_consultation" && a.estWaitMin != null && a.estWaitMin > 0 && (
                    <p className="mt-2 text-sm text-muted">Estimated wait about {a.estWaitMin} minutes.</p>
                  )}
                  {a.status === "in_consultation" && <p className="mt-2 text-sm font-medium text-brand-700">It&apos;s your turn. Please go in.</p>}
                </div>
                {a.status === "booked" && (
                  <form action={cancel}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="code" value={status.patient.code} />
                    <Button variant="ghost" size="sm" type="submit">Cancel</Button>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 text-center">
        <Link href="/book" className={buttonClass("secondary")}>Book another appointment</Link>
      </div>
      <p className="mt-4 text-center text-xs text-muted">This page updates every 30 seconds.</p>
    </PublicShell>
  );
}
