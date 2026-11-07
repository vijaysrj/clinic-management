// Fills the last 90 days with sample visits and payments so reports have something to show.
// For local testing only: npm run db:demo
import "dotenv/config";
import { db, schema } from "../src/db";
import { generatePatientCode } from "../src/lib/patientCode";
import { addDays, todayISO } from "../src/lib/time";

const NAMES = ["Arjun", "Divya", "Karthik", "Lakshmi", "Mohan", "Nisha", "Pooja", "Rahul", "Sanjay", "Tara", "Vikram", "Anitha", "Bala", "Geetha", "Hari"];

async function main() {
  const [doctor] = await db.select().from(schema.doctors).limit(1);
  if (!doctor) throw new Error("Run npm run db:seed first");
  const pts = [];
  for (let i = 0; i < 60; i++) {
    const [p] = await db.insert(schema.patients).values({
      patientCode: generatePatientCode(), name: `${NAMES[i % NAMES.length]} ${String.fromCharCode(65 + (i % 26))}`,
      phone: `9${String(800000000 + i * 7919).slice(0, 9)}`, age: 5 + ((i * 13) % 70), gender: i % 2 ? "female" : "male",
    }).returning();
    pts.push(p);
  }
  const today = todayISO();
  let n = 0;
  for (let d = 90; d >= 1; d--) {
    const date = addDays(today, -d);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
    const count = 4 + ((d * 7) % 9);
    for (let s = 0; s < count; s++) {
      const p = pts[(d * 5 + s * 3) % pts.length];
      const noShow = (d + s) % 11 === 0;
      const [a] = await db.insert(schema.appointments).values({
        branchId: doctor.branchId, doctorId: doctor.id, patientId: p.id, date, startMin: 540 + s * 10, endMin: 550 + s * 10,
        tokenNo: s + 1, status: noShow ? "no_show" : "completed", source: s % 4 ? "online" : "walk_in",
      }).returning();
      if (!noShow) {
        await db.insert(schema.payments).values({ appointmentId: a.id, amount: s % 5 === 0 ? 0 : 300, mode: (["cash", "upi", "upi", "card"] as const)[s % 4] });
        n++;
      }
    }
  }
  console.log(`Added ${n} sample visits.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
