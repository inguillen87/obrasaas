import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis;

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for durable ObraSaaS storage.");
  }

  if (!globalForPrisma.__obraSaasPrisma) {
    const adapter = new PrismaNeon({ connectionString });
    globalForPrisma.__obraSaasPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.__obraSaasPrisma;
}
