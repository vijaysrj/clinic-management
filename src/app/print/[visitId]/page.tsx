import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrintData } from "@/lib/visits";
import { fmtDate } from "@/lib/time";
import { PrintControls } from "@/components/PrintControls";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params, searchParams }: { params: Promise<{ visitId: string }>; searchParams: Promise<{ auto?: string }> }) {
  const user = await requireUser({ role: "doctor" });
  const { visitId } = await params;
  const sp = await searchParams;
  const d = await getPrintData(Number(visitId), user.branchId);
  if (!d) notFound();
  const { patient: p, doctor, branch, v, a, items } = d;

  return (
    <div className="min-h-dvh bg-canvas py-6 print:bg-white print:py-0">
      <style>{`@page { size: A5; margin: 10mm; }`}</style>
      <PrintControls auto={sp.auto === "1"} />
      <article className="mx-auto flex min-h-[190mm] max-w-[148mm] flex-col bg-white p-[8mm] text-[12px] leading-relaxed text-black shadow-sm print:min-h-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-brand-600 pb-3">
          <div>
            <div className="text-[18px] font-bold text-brand-700">{branch.name}</div>
            <div className="text-[11px] text-gray-600">{[branch.address, branch.phone].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{doctor.displayName}</div>
            <div className="text-[11px] text-gray-600">{[doctor.qualifications, doctor.specialty].filter(Boolean).join(", ")}</div>
            {doctor.registrationNo && <div className="text-[11px] text-gray-600">Reg. No. {doctor.registrationNo}</div>}
          </div>
        </header>

        <section className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-gray-200 py-2">
          <div>
            <span className="font-semibold">{p.name}</span>
            <span className="text-gray-600"> {[p.age && `${p.age} yrs`, p.gender && p.gender[0].toUpperCase()].filter(Boolean).join(" / ")}</span>
          </div>
          <div className="text-right">{fmtDate(a.date, { day: "numeric", month: "short", year: "numeric" })}</div>
          <div className="text-gray-600">ID {p.patientCode} · {p.phone}</div>
          <div className="text-right text-gray-600">Token {a.tokenNo}</div>
        </section>

        {(v.complaint || v.diagnosis) && (
          <section className="space-y-0.5 border-b border-gray-200 py-2">
            {v.complaint && <div><span className="font-semibold">C/o: </span>{v.complaint}</div>}
            {v.diagnosis && <div><span className="font-semibold">Diagnosis: </span>{v.diagnosis}</div>}
          </section>
        )}

        <section className="flex-1 py-3">
          <div className="mb-2 font-serif text-[22px] font-bold text-brand-700">℞</div>
          {items.length === 0 ? (
            <p className="text-gray-500">No medicines prescribed.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left text-[11px] uppercase text-gray-600">
                  <th className="w-5 py-1">#</th>
                  <th className="py-1">Medicine</th>
                  <th className="py-1">Dose</th>
                  <th className="py-1">When</th>
                  <th className="py-1">Days</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      <div className="font-semibold">{it.name}</div>
                      {it.composition && <div className="text-[10.5px] text-gray-600">{it.composition}</div>}
                      {it.instructions && <div className="text-[10.5px] italic">{it.instructions}</div>}
                    </td>
                    <td className="py-1.5 font-medium whitespace-nowrap">{it.dose}</td>
                    <td className="py-1.5 pr-1">{it.timing}</td>
                    <td className="py-1.5 whitespace-nowrap">{it.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.p?.advice && (
            <div className="mt-4"><span className="font-semibold">Advice: </span>{d.p.advice}</div>
          )}
          {v.followUpDate && (
            <div className="mt-2"><span className="font-semibold">Follow-up: </span>{fmtDate(v.followUpDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
          )}
        </section>

        <footer className="mt-6 flex items-end justify-between pt-6">
          <div className="text-[10px] text-gray-500">Check your appointment status with ID {p.patientCode}</div>
          <div className="text-center">
            <div className="w-40 border-t border-gray-400 pt-1 text-[11px]">{doctor.displayName}</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
