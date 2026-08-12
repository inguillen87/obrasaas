import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis;

function s92DisposablePgOptions(connectionString, environment = process.env) {
  if (environment.S92_E2E_DISPOSABLE !== "1") return null;
  if (
    environment.NODE_ENV === "production"
    || ["preview", "production"].includes(environment.VERCEL_ENV)
  ) {
    return null;
  }
  if (environment.NODE_ENV !== "development") {
    throw new Error("S9.2 disposable TCP runtime is restricted to local development.");
  }

  let target;
  try {
    target = new URL(connectionString);
  } catch {
    throw new Error("S9.2 disposable runtime requires a valid PostgreSQL DATABASE_URL.");
  }

  if (target.protocol !== "postgresql:") {
    throw new Error("S9.2 disposable runtime requires the exact postgresql protocol.");
  }
  if (target.hostname.toLowerCase() !== "127.0.0.1") {
    throw new Error("S9.2 disposable runtime requires the exact loopback PostgreSQL host.");
  }
  if (target.port !== "5432") {
    throw new Error("S9.2 disposable runtime requires the exact PostgreSQL TCP port.");
  }
  if (target.hash) {
    throw new Error("S9.2 disposable runtime DATABASE_URL must not include a fragment.");
  }

  if (!target.username || !target.password) {
    throw new Error("S9.2 disposable runtime requires explicit database credentials.");
  }

  if (target.pathname !== "/obrasaas_e2e") {
    throw new Error("S9.2 disposable runtime requires the exact obrasaas_e2e database.");
  }

  const query = [...target.searchParams.entries()];
  if (
    query.length !== 1
    || query[0][0] !== "schema"
    || query[0][1] !== "public"
  ) {
    throw new Error("S9.2 disposable runtime requires the exact schema=public option.");
  }

  return { schema: "public" };
}

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for durable ObraSaaS storage.");
  }

  if (!globalForPrisma.__obraSaasPrisma) {
    const disposablePgOptions = s92DisposablePgOptions(connectionString);
    const adapter = disposablePgOptions
      ? new PrismaPg({ connectionString }, disposablePgOptions)
      : new PrismaNeon({ connectionString });
    globalForPrisma.__obraSaasPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.__obraSaasPrisma;
}
