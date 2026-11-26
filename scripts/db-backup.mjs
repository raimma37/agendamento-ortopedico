import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const backupDir = path.resolve(process.cwd(), "backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(backupDir, `agendamento_db_${stamp}.sql`);

const user = process.env.POSTGRES_USER || "postgres";
const dbName = process.env.POSTGRES_DB || "agendamento_db";

try {
  execSync(`docker exec agendamento_postgres pg_dump -U ${user} ${dbName} > "${file}"`, {
    stdio: "inherit",
    shell: true,
  });
  console.log(`>> Backup salvo em: ${file}`);
} catch {
  try {
    execSync(`pg_dump -h localhost -U ${user} ${dbName} -f "${file}"`, {
      stdio: "inherit",
    });
    console.log(`>> Backup salvo em: ${file}`);
  } catch (err) {
    console.error("Não foi possível executar pg_dump via Docker ou local:", err.message);
    process.exit(1);
  }
}
