import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

const client =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    prepare: false, // works with pooled connections (Neon, PgBouncer)
  });
if (process.env.NODE_ENV !== "production") globalForDb.sql = client;

export const db = drizzle(client, { schema });
export { schema };
