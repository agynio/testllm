-- CreateEnum
CREATE TYPE "ResponseLogStatus" AS ENUM ('success', 'error');

-- CreateTable
CREATE TABLE "test_runs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT,
    "commit_sha" TEXT,
    "branch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_logs" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "status" "ResponseLogStatus" NOT NULL,
    "org_slug" TEXT NOT NULL,
    "suite_name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "client_test_name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "stream" BOOLEAN NOT NULL DEFAULT false,
    "suite_id" UUID,
    "test_id" UUID,
    "output" JSONB,
    "response_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_runs_org_id_created_at_idx" ON "test_runs"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "response_logs_run_id_created_at_idx" ON "response_logs"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "response_logs_run_id_client_test_name_idx" ON "response_logs"("run_id", "client_test_name");

-- CreateIndex
CREATE INDEX "response_logs_run_id_test_id_idx" ON "response_logs"("run_id", "test_id");

-- CreateIndex
CREATE INDEX "response_logs_suite_id_created_at_idx" ON "response_logs"("suite_id", "created_at");

-- CreateIndex
CREATE INDEX "response_logs_test_id_created_at_idx" ON "response_logs"("test_id", "created_at");

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_logs" ADD CONSTRAINT "response_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_logs" ADD CONSTRAINT "response_logs_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_logs" ADD CONSTRAINT "response_logs_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
