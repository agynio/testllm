import path from "path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@/lib/prisma";

loadEnv({ path: path.resolve(__dirname, "..", "..", ".env.test") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for E2E tests");
}

export { prisma };
