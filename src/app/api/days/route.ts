import { NextResponse } from "next/server";
import { getAvailableDays } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const doctorId = Number(new URL(req.url).searchParams.get("doctorId"));
  if (!Number.isInteger(doctorId) || doctorId <= 0) return NextResponse.json({ error: "doctorId required" }, { status: 400 });
  return NextResponse.json({ days: await getAvailableDays(doctorId) });
}
