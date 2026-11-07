import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type MedicineHit = { id: number; brandName: string; composition: string | null; form: string | null; uses: number };

/**
 * Suggestions while the doctor types: this doctor's most-prescribed medicines first,
 * then names that start with the text, then fuzzy matches on name or composition.
 */
export async function searchMedicines(q: string, doctorId: number | null, branchId: number, limit = 10): Promise<MedicineHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = term.replace(/[%_\\]/g, (c) => `\\${c}`);
  const rows = await db.execute(sql`
    WITH fav AS (
      SELECT pi.medicine_id, count(*)::int AS uses
      FROM prescription_items pi
      JOIN prescriptions p ON p.id = pi.prescription_id
      JOIN visits v ON v.id = p.visit_id
      JOIN appointments a ON a.id = v.appointment_id
      WHERE pi.medicine_id IS NOT NULL AND a.doctor_id = ${doctorId ?? -1}
      GROUP BY pi.medicine_id
    )
    SELECT m.id, m.brand_name AS "brandName", m.composition, m.form, coalesce(f.uses, 0) AS uses
    FROM medicines m
    LEFT JOIN fav f ON f.medicine_id = m.id
    WHERE (m.branch_id IS NULL OR m.branch_id = ${branchId})
      AND (m.brand_name ILIKE ${like + "%"} OR m.brand_name ILIKE ${"% " + like + "%"}
           OR m.composition ILIKE ${"%" + like + "%"} OR m.brand_name % ${term})
    ORDER BY coalesce(f.uses, 0) DESC,
             (m.brand_name ILIKE ${like + "%"}) DESC,
             similarity(m.brand_name, ${term}) DESC,
             length(m.brand_name)
    LIMIT ${limit}
  `);
  return rows as unknown as MedicineHit[];
}
