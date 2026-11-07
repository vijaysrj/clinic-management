import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { findReturningPatient, getBranchBySlug } from "@/lib/booking";
import { normalizePatientCode } from "@/lib/patientCode";

export const dynamic = "force-dynamic";

/** Confirms a returning patient before booking. The public gets only the first name. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const code = normalizePatientCode(sp.get("code") ?? "");
  const last4 = (sp.get("last4") ?? "").replace(/\D/g, "").slice(-4) || null;
  const user = await getSessionUser();
  const clinicSlug = sp.get("clinic");
  const branchId = clinicSlug ? (await getBranchBySlug(clinicSlug))?.id : user?.branchId;
  if (!branchId) return NextResponse.json({ found: false });
  // Staff skip the phone check only for their own clinic.
  const staff = user != null && user.branchId === branchId;
  const p = await findReturningPatient(branchId, code, last4, !staff);
  if (!p) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, code: p.patientCode, name: staff ? p.name : p.name.split(" ")[0] });
}
