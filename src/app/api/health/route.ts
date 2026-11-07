import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Where the server runs, where the database is, and how long one round trip takes. No secrets. */
export async function GET() {
  let dbHostRegion: string | null = null;
  try {
    const host = new URL(process.env.DATABASE_URL ?? "").hostname;
    dbHostRegion = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws\.neon\.tech$/)?.[1] ?? host.split(".").slice(-4, -3)[0] ?? null;
  } catch {}
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    await db.execute(sql`select 1`);
    times.push(Math.round(performance.now() - t));
  }
  return NextResponse.json({ serverRegion: process.env.VERCEL_REGION ?? "local", dbRegion: dbHostRegion, dbRoundTripMs: times });
}
