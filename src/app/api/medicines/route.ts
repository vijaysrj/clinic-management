import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchMedicines } from "@/lib/medicines";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchMedicines(q, user.doctorId, user.branchId) });
}
