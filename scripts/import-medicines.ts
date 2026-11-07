// Import medicines from a CSV into the medicines table.
//
//   npm run medicines:import                      # the bundled starter list (data/medicines-starter.csv)
//   npm run medicines:import -- path/to/file.csv  # a larger dataset
//   npm run medicines:import -- file.csv --replace  # drop old dataset rows first (custom and used rows are kept)
//
// Understands our own columns (brand_name, composition, form, manufacturer, pack_size) and the
// columns of the "A-Z medicine dataset of India" CSV (name, manufacturer_name, pack_size_label,
// short_composition1, short_composition2, Is_discontinued).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db, schema } from "../src/db";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const FORMS = ["tablet", "capsule", "syrup", "suspension", "injection", "cream", "ointment", "gel", "drops", "inhaler", "respules", "sachet", "powder", "lotion", "spray", "solution"];
function formFromPack(label: string | undefined): string | null {
  const l = (label ?? "").toLowerCase();
  const f = FORMS.find((x) => l.includes(x));
  return f ? f[0].toUpperCase() + f.slice(1) : null;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--")) ?? "data/medicines-starter.csv";
  const replace = args.includes("--replace");
  const [header, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const col = (...names: string[]) => names.map((n) => header.findIndex((h) => h.trim().toLowerCase() === n.toLowerCase())).find((i) => i >= 0) ?? -1;
  const iBrand = col("brand_name", "name"), iComp = col("composition", "short_composition1"), iComp2 = col("short_composition2");
  const iForm = col("form", "dosage_form"), iMaker = col("manufacturer", "manufacturer_name"), iPack = col("pack_size", "pack_size_label");
  const iDisc = col("is_discontinued");
  if (iBrand < 0) throw new Error(`No brand_name/name column in ${file}`);

  const seen = new Set<string>();
  const values: (typeof schema.medicines.$inferInsert)[] = [];
  for (const r of rows) {
    if (iDisc >= 0 && /^true$/i.test(r[iDisc] ?? "")) continue;
    const brandName = (r[iBrand] ?? "").trim();
    if (!brandName || seen.has(brandName.toLowerCase())) continue;
    seen.add(brandName.toLowerCase());
    const composition = [r[iComp], iComp2 >= 0 ? r[iComp2] : ""].map((s) => (s ?? "").trim()).filter(Boolean).join(" + ") || null;
    const packSize = iPack >= 0 ? (r[iPack] ?? "").trim() || null : null;
    values.push({
      brandName,
      composition,
      form: (iForm >= 0 ? (r[iForm] ?? "").trim() : "") || formFromPack(packSize ?? undefined),
      manufacturer: iMaker >= 0 ? (r[iMaker] ?? "").trim() || null : null,
      packSize,
      source: "dataset",
    });
  }

  if (replace) {
    await db.execute(sql`DELETE FROM medicines WHERE source = 'dataset' AND id NOT IN (SELECT medicine_id FROM prescription_items WHERE medicine_id IS NOT NULL)`);
  }
  const existing = new Set(
    (await db.select({ b: schema.medicines.brandName }).from(schema.medicines)).map((r) => r.b.toLowerCase()),
  );
  const fresh = values.filter((v) => !existing.has(v.brandName.toLowerCase()));
  for (let i = 0; i < fresh.length; i += 1000) {
    await db.insert(schema.medicines).values(fresh.slice(i, i + 1000));
  }
  console.log(`Imported ${fresh.length} medicines from ${file} (${values.length - fresh.length} already present).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
