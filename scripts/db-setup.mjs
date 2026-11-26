import { execSync } from "node:child_process";
import pg from "pg";

const port = Number(process.env.POSTGRES_PORT || 5432);
const user = process.env.POSTGRES_USER || "postgres";
const password = process.env.POSTGRES_PASSWORD || "postgres";
const dbName = process.env.POSTGRES_DB || "agendamento_db";

async function ensureDatabase() {
  const client = new pg.Client({
    host: "127.0.0.1",
    port,
    user,
    password,
    database: "postgres",
  });
  await client.connect();
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`>> Banco "${dbName}" criado automaticamente.`);
  } else {
    console.log(`>> Banco "${dbName}" já existe.`);
  }
  await client.end();
}

async function main() {
  execSync("node scripts/db-up.mjs", { stdio: "inherit" });
  await ensureDatabase();

  console.log(">> Gerando Prisma Client...");
  execSync("npx prisma generate", { stdio: "inherit" });

  console.log(">> Aplicando migrations do banco de dados...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  } catch {
    execSync("npx prisma db push", { stdio: "inherit" });
  }

  console.log(">> Executando seed inicial...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });

  console.log(">> Setup completo do banco de dados local concluído!");
}

main().catch((err) => {
  console.error("Erro no db:setup:", err);
  process.exit(1);
});
