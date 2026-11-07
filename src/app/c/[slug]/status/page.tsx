import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { Button, Card, ErrorNote, Input } from "@/components/ui";
import { normalizePatientCode } from "@/lib/patientCode";
import { clinicFromParams } from "../clinic";

async function lookup(slug: string, formData: FormData) {
  "use server";
  const code = normalizePatientCode(String(formData.get("code") ?? ""));
  if (code.length < 9) redirect(`/c/${slug}/status?e=1`);
  redirect(`/c/${slug}/status/${code}`);
}

export default async function StatusLookup({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ e?: string }> }) {
  const clinic = await clinicFromParams(params);
  const sp = await searchParams;
  return (
    <PublicShell clinic={clinic}>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Check your status</h1>
      <p className="mb-6 text-sm text-muted">Enter the patient ID you got when you booked.</p>
      <Card className="p-4">
        <form action={lookup.bind(null, clinic.slug)} className="space-y-3">
          <Input name="code" required autoFocus placeholder="PT-XXXXXX" className="text-center font-mono text-lg tracking-widest uppercase" />
          {sp.e && <ErrorNote>That doesn&apos;t look like a patient ID. It starts with PT- and has 6 letters or numbers.</ErrorNote>}
          <Button type="submit" size="lg" className="w-full"><Search className="size-5" /> Check status</Button>
        </form>
      </Card>
    </PublicShell>
  );
}
