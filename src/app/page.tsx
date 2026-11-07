import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Search, UserRound } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { Card, buttonClass } from "@/components/ui";
import { getDefaultBranch, listDoctors } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await getDefaultBranch())) redirect("/setup");
  const doctors = await listDoctors();
  return (
    <PublicShell>
      <section className="pt-6 pb-8">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">Book a visit in under a minute.</h1>
        <p className="mt-3 text-muted">Pick a time that suits you, then track how many people are ahead of you before you leave home.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/book" className={buttonClass("primary", "lg")}>
            <CalendarPlus className="size-5" /> Book appointment
          </Link>
          <Link href="/status" className={buttonClass("secondary", "lg")}>
            <Search className="size-5" /> Check my status
          </Link>
        </div>
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Our doctors</h2>
      <div className="space-y-3">
        {doctors.length === 0 && <Card className="p-5 text-sm text-muted">No doctors are listed yet.</Card>}
        {doctors.map((d) => (
          <Card key={d.id} className="flex items-center gap-4 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <UserRound className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{d.displayName}</div>
              <div className="truncate text-sm text-muted">{[d.qualifications, d.specialty].filter(Boolean).join(" · ")}</div>
            </div>
            <Link href={`/book?doctor=${d.id}`} className={buttonClass("secondary", "sm")}>Book</Link>
          </Card>
        ))}
      </div>
    </PublicShell>
  );
}
