import path from "path";
import { config as loadEnv } from "dotenv";
import { beforeEach, afterAll } from "vitest";
import { prisma } from "./helpers/prisma";

loadEnv({ path: path.resolve(__dirname, "..", ".env.test") });

beforeEach(async () => {
  await prisma.testItem.deleteMany();
  await prisma.test.deleteMany();
  await prisma.testSuite.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
