import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const COOKIE = "clinic_session";
const MAX_AGE = 60 * 60 * 12; // one working day

export type SessionUser = {
  staffId: number;
  branchId: number;
  name: string;
  role: "doctor" | "receptionist";
  isAdmin: boolean;
  doctorId: number | null;
};

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(secret);
}

export async function createSession(staffId: number) {
  const token = await new SignJWT({ sid: staffId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in staff member, re-read from the database so deactivation takes effect at once. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let staffId: number;
  try {
    const { payload } = await jwtVerify(token, key());
    staffId = Number(payload.sid);
  } catch {
    return null;
  }
  const row = await db
    .select({ s: schema.staff, doctorId: schema.doctors.id })
    .from(schema.staff)
    .leftJoin(schema.doctors, eq(schema.doctors.staffId, schema.staff.id))
    .where(eq(schema.staff.id, staffId))
    .limit(1);
  const r = row[0];
  if (!r || !r.s.active) return null;
  return {
    staffId: r.s.id,
    branchId: r.s.branchId,
    name: r.s.name,
    role: r.s.role,
    isAdmin: r.s.isAdmin,
    doctorId: r.doctorId,
  };
}

export async function requireUser(opts?: { role?: SessionUser["role"]; admin?: boolean }): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (opts?.role && user.role !== opts.role) redirect("/staff");
  if (opts?.admin && !user.isAdmin) redirect("/staff");
  return user;
}
