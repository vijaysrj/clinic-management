import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDaySlots } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const doctorId = Number(sp.get("doctorId"));
  const date = sp.get("date") ?? "";
  if (!Number.isInteger(doctorId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "doctorId and date required" }, { status: 400 });
  }
  return NextResponse.json({ slots: await getDaySlots(doctorId, date, sp.get("staff") === "1" && (await getSessionUser()) != null) });
}
