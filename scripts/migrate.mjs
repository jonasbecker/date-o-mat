// Applies pending SQL migrations from ./drizzle. Runs before every `npm run build`
// (so Vercel deploys migrate automatically) and via `npm run db:migrate`.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local – rely on the process environment (e.g. Vercel).
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL is not set – skipping migrations.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Database is up to date.");
} finally {
  await pool.end();
}
