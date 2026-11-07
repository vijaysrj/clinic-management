import Link from "next/link";
import { Printer } from "lucide-react";
import type { VisitRecord } from "@/lib/visits";
import { fmtDate, fmtMinutes } from "@/lib/time";
import { Card, StatusBadge } from "./ui";

const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", other: "Other" };

export function VisitHistory({ visits, compact = false }: { visits: VisitRecord[]; compact?: boolean }) {
  if (!visits.length) return <Card className="p-4 text-sm text-muted">No earlier visits.</Card>;
  return (
    <ol className="relative space-y-3 border-l-2 border-line pl-4">
      {visits.map((v) => (
        <li key={v.appointmentId} className="relative">
          <span className="absolute top-4 -left-[23px] size-3 rounded-full border-2 border-white bg-brand-500" />
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{fmtDate(v.date, { day: "numeric", month: "short", year: "numeric" })}</span>
              {!compact && <span className="text-muted">{fmtMinutes(v.startMin)} · {v.doctorName}</span>}
              <StatusBadge status={v.status} />
              {v.payment && <span className="text-xs text-muted">₹{v.payment.amount} {MODE[v.payment.mode]}</span>}
              {v.visitId && (
                <Link href={`/print/${v.visitId}`} className="ml-auto inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"><Printer className="size-3.5" /> Reprint</Link>
              )}
            </div>
            {(v.complaint || v.diagnosis) && (
              <div className="mt-1.5 text-sm">
                {v.complaint && <div><span className="text-muted">Complaint: </span>{v.complaint}</div>}
                {v.diagnosis && <div><span className="text-muted">Diagnosis: </span>{v.diagnosis}</div>}
              </div>
            )}
            {v.notes && !compact && <div className="mt-1 text-sm"><span className="text-muted">Notes: </span>{v.notes}</div>}
            {v.items.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-sm">
                {v.items.map((it, i) => (
                  <li key={i}>
                    <span className="font-medium">{it.name}</span>
                    <span className="text-muted"> {[it.dose, it.timing, it.duration].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            )}
            {v.advice && !compact && <div className="mt-1 text-sm"><span className="text-muted">Advice: </span>{v.advice}</div>}
          </Card>
        </li>
      ))}
    </ol>
  );
}
