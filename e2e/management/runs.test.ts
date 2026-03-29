import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { setTimeout as delay } from "timers/promises";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import {
  jsonRequest,
  managementUrl,
  responsesRunUrl,
} from "../helpers/api";
import { createOrg, createSuite } from "../helpers/management";
import { prisma } from "../helpers/prisma";
import { simpleMessageSequence, withPositions } from "../helpers/fixtures";

async function seedTestSuite(suiteId: string, testName: string) {
  const test = await prisma.test.create({
    data: { testSuiteId: suiteId, name: testName },
  });

  await prisma.testItem.createMany({
    data: withPositions(simpleMessageSequence).map((item) => ({
      ...item,
      testId: test.id,
    })),
  });

  return test;
}

async function waitForResponseLogs(runId: string, expectedCount: number) {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const count = await prisma.responseLog.count({ where: { runId } });
    if (count >= expectedCount) return;
    await delay(50);
  }

  throw new Error("Timed out waiting for response logs");
}

describe("management api runs", () => {
  it("records response logs and summarizes test runs", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: suite } = await createSuite(admin, org.id, {
      name: "suite-runs",
    });

    const test = await seedTestSuite(suite.id, "run-test");
    const runId = randomUUID();

    const successResponse = await fetch(
      responsesRunUrl(org.slug, suite.name, runId, "client-success"),
      {
        method: "POST",
        ...jsonRequest({ model: test.name, input: "Hello there" }),
      }
    );
    expect(successResponse.status).toBe(200);

    const successResponseRepeat = await fetch(
      responsesRunUrl(org.slug, suite.name, runId, "client-success"),
      {
        method: "POST",
        ...jsonRequest({ model: test.name, input: "Hello there" }),
      }
    );
    expect(successResponseRepeat.status).toBe(200);

    const errorResponse = await fetch(
      responsesRunUrl(org.slug, suite.name, runId, "client-failure"),
      {
        method: "POST",
        ...jsonRequest({ model: test.name, input: "Wrong input" }),
      }
    );
    expect(errorResponse.status).toBe(400);
    const errorBody = await errorResponse.json();
    expect(errorBody.error).toMatchObject({ code: "input_mismatch" });

    await waitForResponseLogs(runId, 3);

    const listResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/runs`),
      {},
      admin
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.runs).toHaveLength(1);
    expect(listBody.runs[0]).toMatchObject({
      id: runId,
      tests_total: 2,
      tests_passed: 1,
      tests_failed: 1,
    });
    expect(listBody.runs[0].started_at).not.toBeNull();
    expect(listBody.runs[0].finished_at).not.toBeNull();

    const detailResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/runs/${runId}`),
      {},
      admin
    );
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.test_executions).toHaveLength(2);

    const successExecution = detailBody.test_executions.find(
      (item: { client_test_name: string }) =>
        item.client_test_name === "client-success"
    );
    const failureExecution = detailBody.test_executions.find(
      (item: { client_test_name: string }) =>
        item.client_test_name === "client-failure"
    );

    expect(successExecution).toMatchObject({
      status: "passed",
      call_count: 2,
      suites_used: [suite.name],
      first_error: null,
    });
    expect(failureExecution).toMatchObject({
      status: "failed",
      call_count: 1,
    });
    expect(failureExecution.first_error).toMatchObject({
      code: "input_mismatch",
    });

    const patchResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/runs/${runId}`),
      {
        method: "PATCH",
        ...jsonRequest({
          name: "CI Run",
          commit_sha: "abc123",
          branch: "main",
        }),
      },
      admin
    );
    expect(patchResponse.status).toBe(200);
    const patchBody = await patchResponse.json();
    expect(patchBody).toMatchObject({
      id: runId,
      name: "CI Run",
      commit_sha: "abc123",
      branch: "main",
    });

    const logsResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/runs/${runId}/logs`),
      {},
      admin
    );
    expect(logsResponse.status).toBe(200);
    const logsBody = await logsResponse.json();
    expect(logsBody.logs).toHaveLength(3);
    expect(logsBody.logs[0].input).toBeUndefined();
    expect(logsBody.logs[0].output).toBeUndefined();

    const successLog = logsBody.logs.find(
      (log: { status: string }) => log.status === "success"
    );
    expect(successLog).toBeTruthy();

    const filteredResponse = await authenticatedFetch(
      managementUrl(
        `/orgs/${org.id}/runs/${runId}/logs?client_test_name=client-success`
      ),
      {},
      admin
    );
    expect(filteredResponse.status).toBe(200);
    const filteredBody = await filteredResponse.json();
    expect(filteredBody.logs).toHaveLength(2);

    const errorLogsResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/runs/${runId}/logs?status=error`),
      {},
      admin
    );
    expect(errorLogsResponse.status).toBe(200);
    const errorLogsBody = await errorLogsResponse.json();
    expect(errorLogsBody.logs).toHaveLength(1);

    const detailLogResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/runs/${runId}/logs/${successLog.id}`),
      {},
      admin
    );
    expect(detailLogResponse.status).toBe(200);
    const detailLogBody = await detailLogResponse.json();
    expect(detailLogBody.input).toBeTruthy();
    expect(detailLogBody.output).toBeTruthy();
  });
});
