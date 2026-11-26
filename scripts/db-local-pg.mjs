import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";
import pg from "pg";

const dataDir = path.resolve(process.cwd(), ".pgdata");
const port = Number(process.env.POSTGRES_PORT || 5432);
const user = process.env.POSTGRES_USER || "postgres";
const password = process.env.POSTGRES_PASSWORD || "postgres";
const dbName = process.env.POSTGRES_DB || "agendamento_db";

async function ensureDatabaseExists() {
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
    console.log(`>> Banco "${dbName}" criado com sucesso.`);
  }
  await client.end();
}

async function run() {
  const isNew = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
  const pgServer = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: true,
    onLog: () => {},
    onError: (msg) => console.error("[postgres]", msg),
  });

  if (isNew) {
    console.log(`>> Inicializando cluster PostgreSQL local em ${dataDir}...`);
    await pgServer.initialise();
  }

  console.log(`>> Iniciando PostgreSQL 16 local na porta ${port}...`);
  await pgServer.start();
  await ensureDatabaseExists();
  console.log(`>> PostgreSQL local pronto em postgresql://${user}:****@localhost:${port}/${dbName}`);

  const shutdown = async () => {
    console.log("\n>> Encerrando PostgreSQL local com segurança...");
    try {
      await pgServer.stop();
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

run().catch((err) => {
  console.error("Falha ao iniciar PostgreSQL local:", err);
  process.exit(1);
});
