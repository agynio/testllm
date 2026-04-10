export function baseUrl() {
  const url = process.env.AUTH_URL;
  if (!url) {
    throw new Error("AUTH_URL is required for E2E tests");
  }
  return url;
}

export function apiUrl(path: string) {
  return new URL(path, baseUrl()).toString();
}

export function managementUrl(path: string) {
  return apiUrl(`/api${path}`);
}

export function responsesUrl(orgSlug: string, suiteName: string) {
  return apiUrl(`/v1/org/${orgSlug}/suite/${suiteName}/responses`);
}

export function responsesRunUrl(
  orgSlug: string,
  suiteName: string,
  runId: string,
  clientTestName: string
) {
  return apiUrl(
    `/v1/org/${orgSlug}/suite/${suiteName}/run/${runId}/test/${encodeURIComponent(
      clientTestName
    )}/responses`
  );
}

export function messagesUrl(orgSlug: string, suiteName: string) {
  return apiUrl(`/v1/org/${orgSlug}/suite/${suiteName}/messages`);
}

export function messagesRunUrl(
  orgSlug: string,
  suiteName: string,
  runId: string,
  clientTestName: string
) {
  return apiUrl(
    `/v1/org/${orgSlug}/suite/${suiteName}/run/${runId}/test/${encodeURIComponent(
      clientTestName
    )}/messages`
  );
}

export function jsonRequest(body: unknown): RequestInit {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
