import { beforeEach, afterAll } from "vitest";
import { prisma } from "./helpers/prisma";

beforeEach(async () => {
  await prisma.personalApiToken.deleteMany();
  await prisma.orgApiToken.deleteMany();
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
