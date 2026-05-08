import { ensureDatabase } from "@/src/lib/migrate";
import { seedIfNeeded } from "@/src/lib/repository";

async function main() {
  await ensureDatabase();
  await seedIfNeeded();
  console.log("B00ZZ FI SQLite database is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
