// Creates the clinic, one admin doctor, one receptionist and a Mon–Sat schedule.
// Safe to re-run: does nothing if a branch already exists.
//   ADMIN_EMAIL, ADMIN_PASSWORD, RECEPTION_EMAIL, RECEPTION_PASSWORD, CLINIC_NAME override the defaults.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, schema } from "../src/db";

async function main() {
  const existing = await db.select().from(schema.branches).limit(1);
  if (existing.length) {
    console.log("Already seeded, nothing to do.");
    process.exit(0);
  }
  const adminEmail = process.env.ADMIN_EMAIL ?? "doctor@clinic.test";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "doctor123";
  const recEmail = process.env.RECEPTION_EMAIL ?? "reception@clinic.test";
  const recPassword = process.env.RECEPTION_PASSWORD ?? "reception123";

  const [branch] = await db
    .insert(schema.branches)
    .values({ name: process.env.CLINIC_NAME ?? "Sunrise Clinic", slug: process.env.CLINIC_SLUG ?? "sunrise-clinic", address: "12 Main Road", phone: "044 0000 0000" })
    .returning();
  const [docStaff] = await db
    .insert(schema.staff)
    .values({ branchId: branch.id, name: "Dr. Priya Raman", email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 10), role: "doctor", isAdmin: true })
    .returning();
  const [doctor] = await db
    .insert(schema.doctors)
    .values({ staffId: docStaff.id, branchId: branch.id, displayName: "Dr. Priya Raman", specialty: "General Physician", qualifications: "MBBS, MD", registrationNo: "TN-00000", consultationFee: 300 })
    .returning();
  await db.insert(schema.staff).values({ branchId: branch.id, name: "Front Desk", email: recEmail, passwordHash: await bcrypt.hash(recPassword, 10), role: "receptionist" });

  const sessions = [];
  for (let wd = 1; wd <= 6; wd++) {
    sessions.push({ doctorId: doctor.id, weekday: wd, startMin: 9 * 60, endMin: 13 * 60, slotMinutes: 10 });
    if (wd !== 6) sessions.push({ doctorId: doctor.id, weekday: wd, startMin: 17 * 60, endMin: 20 * 60, slotMinutes: 10 });
  }
  await db.insert(schema.scheduleSessions).values(sessions);

  console.log(`Seeded "${branch.name}".`);
  console.log(`  Doctor (admin): ${adminEmail} / ${process.env.ADMIN_PASSWORD ? "(from ADMIN_PASSWORD)" : adminPassword}`);
  console.log(`  Receptionist:   ${recEmail} / ${process.env.RECEPTION_PASSWORD ? "(from RECEPTION_PASSWORD)" : recPassword}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
