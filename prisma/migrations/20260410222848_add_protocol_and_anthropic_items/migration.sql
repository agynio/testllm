-- CreateEnum
CREATE TYPE "Protocol" AS ENUM ('openai', 'anthropic');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TestItemType" ADD VALUE 'anthropic_system';
ALTER TYPE "TestItemType" ADD VALUE 'anthropic_message';

-- AlterTable
ALTER TABLE "test_suites" ADD COLUMN     "protocol" "Protocol" NOT NULL DEFAULT 'openai';
