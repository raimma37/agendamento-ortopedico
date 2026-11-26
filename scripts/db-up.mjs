import { execSync, spawn } from "node:child_process";
import net from "node:net";

const port = Number(process.env.POSTGRES_PORT || 5432);

function isPortOpen(p, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(p, host);
  });
}

function hasDocker() {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function waitForPort(p, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(p)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  if (await isPortOpen(port)) {
    console.log(`>> PostgreSQL local já está rodando na porta ${port}.`);
    return;
  }

  if (hasDocker()) {
    console.log(">> Subindo container PostgreSQL local via Docker Compose...");
    execSync("docker compose up -d db", { stdio: "inherit" });
    const ready = await waitForPort(port, 30000);
    if (!ready) {
      throw new Error(`Timeout aguardando PostgreSQL na porta ${port}.`);
    }
    console.log(">> Container PostgreSQL pronto.");
    return;
  }

  console.log(">> Docker não detectado. Iniciando PostgreSQL 16 local (modo nativo persistente em .pgdata)...");
  const child = spawn(process.execPath, ["scripts/db-local-pg.mjs"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  const ready = await waitForPort(port, 40000);
  if (!ready) {
    throw new Error(`Timeout aguardando PostgreSQL local iniciar na porta ${port}.`);
  }
  console.log(`>> PostgreSQL local iniciado em background na porta ${port}.`);
}

main().catch((err) => {
  console.error("Erro em db:up:", err.message);
  process.exit(1);
});
