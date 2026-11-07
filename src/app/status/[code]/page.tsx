import { redirect } from "next/navigation";
import { clinicSlugForPatient } from "@/lib/booking";
import { normalizePatientCode } from "@/lib/patientCode";

export const dynamic = "force-dynamic";

// Old links (printed before clinics had their own address) still work.
export default async function OldStatusCode({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizePatientCode(decodeURIComponent((await params).code));
  const slug = await clinicSlugForPatient(code);
  redirect(slug ? `/c/${slug}/status/${code}` : `/?id=${encodeURIComponent(code)}&e=1#status`);
}
