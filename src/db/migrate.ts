/**
 * Migration Runner - Standalone Script
 *
 * Run with: npm run migrate
 * Connects to the database and runs all SQL migrations in db/migrations/.
 * Use this when setting up a new database or after pulling new migration files.
 */

import "dotenv/config";
import { initDb, closeDb } from "./postgres.js";

async function main(): Promise<void> {
  try {
    await initDb();
    console.log("Migrations completed successfully.");
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
