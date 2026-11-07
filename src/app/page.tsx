import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck2, ChartColumn, MapPin, NotebookPen, Search, Stethoscope, Users } from "lucide-react";
import { Button, Card, ErrorNote, Input, buttonClass } from "@/components/ui";
import { clinicSlugForPatient, searchClinics } from "@/lib/booking";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { normalizePatientCode } from "@/lib/patientCode";

export const dynamic = "force-dynamic";

async function checkStatus(formData: FormData) {
  "use server";
  const code = normalizePatientCode(String(formData.get("code") ?? ""));
  const slug = code.length >= 9 ? await clinicSlugForPatient(code) : null;
  if (!slug) redirect(`/?id=${encodeURIComponent(code)}&e=1#status`);
  redirect(`/c/${slug}/status/${code}`);
}

const FEATURES = [
  { icon: CalendarCheck2, title: "Online booking", text: "Patients pick a slot from your timings. No calls, no double bookings." },
  { icon: Users, title: "Live queue", text: "Patients see how many are ahead of them. Reception marks arrivals, consults and payments." },
  { icon: NotebookPen, title: "Doctor's pad", text: "Type Indian medicine names with autocomplete, then print a clean A5 prescription." },
  { icon: ChartColumn, title: "Reports", text: "Visits and collections by day, week, month and year, per doctor." },
];

const STEPS = [
  ["Register your clinic", "Takes two minutes. You get your own patient booking page."],
  ["Set your timings", "Add sessions and slot length for each doctor, plus leave days."],
  ["Share your link", "Put it on WhatsApp, Google Maps or a poster at the desk."],
];

export default async function Landing({ searchParams }: { searchParams: Promise<{ q?: string; id?: string; e?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const clinics = q ? await searchClinics(q) : [];

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white"><Stethoscope className="size-5" /></span>
          <span className="text-[17px] font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-1.5 text-muted hover:bg-white hover:text-ink">Staff sign in</Link>
          <Link href="/register" className={buttonClass("primary", "sm")}>Register clinic</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-5xl gap-10 px-4 pt-8 pb-14 md:grid-cols-[1.2fr_1fr] md:items-center md:pt-14">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">Run your clinic&apos;s day from one simple screen.</h1>
          <p className="mt-4 max-w-lg text-lg text-muted">{APP_TAGLINE} Patients book online and watch the queue from home. You see who&apos;s next.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className={buttonClass("primary", "lg")}>Register your clinic</Link>
            <a href="#find" className={buttonClass("secondary", "lg")}>I&apos;m a patient</a>
          </div>
        </div>

        <div className="space-y-4" id="find">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand-600" /> Find your clinic</h2>
            <form className="mt-3 flex gap-2" action="/#find">
              <Input name="q" defaultValue={q} placeholder="Clinic name or area" minLength={2} required />
              <Button type="submit" aria-label="Search"><Search className="size-4" /></Button>
            </form>
            {q && (
              <div className="mt-3 divide-y divide-line">
                {clinics.length === 0 && <p className="py-2 text-sm text-muted">No clinic matches &ldquo;{q}&rdquo;. Ask your clinic for their booking link.</p>}
                {clinics.map((c) => (
                  <Link key={c.slug} href={`/c/${c.slug}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-700">
                    <span className="min-w-0">
                      <span className="block font-medium">{c.name}</span>
                      {c.address && <span className="block truncate text-sm text-muted">{c.address}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-brand-700">Book</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <div id="status"><Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-brand-600" /> Check appointment status</h2>
            <form action={checkStatus} className="mt-3 flex gap-2">
              <Input name="code" defaultValue={sp.id} required placeholder="PT-XXXXXX" className="font-mono uppercase tracking-widest" />
              <Button type="submit">Check</Button>
            </form>
            {sp.e && <div className="mt-3"><ErrorNote>We couldn&apos;t find that Patient ID. It starts with PT- and has 6 letters or numbers.</ErrorNote></div>}
          </Card></div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><f.icon className="size-5" /></span>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <Card key={title} className="p-5">
              <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </Card>
          ))}
        </ol>
        <div className="mt-8 text-center">
          <Link href="/register" className={buttonClass("primary", "lg")}>Register your clinic</Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-muted">{APP_NAME} · Made for clinics in India</footer>
    </div>
  );
}
