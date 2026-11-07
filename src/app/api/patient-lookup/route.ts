import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { findReturningPatient } from "@/lib/booking";
import { normalizePatientCode } from "@/lib/patientCode";

export const dynamic = "force-dynamic";

/** Confirms a returning patient before booking. Returns only the first name for the public. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const code = normalizePatientCode(sp.get("code") ?? "");
  const last4 = (sp.get("last4") ?? "").replace(/\D/g, "").slice(-4) || null;
  const staff = await getSessionUser();
  const p = await findReturningPatient(code, last4, !staff);
  if (!p) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, code: p.patientCode, name: staff ? p.name : p.name.split(" ")[0], phone: staff ? p.phone : null });
}
