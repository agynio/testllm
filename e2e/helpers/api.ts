const fallbackBaseUrl = "http://localhost:3000";

export function baseUrl() {
  return process.env.AUTH_URL ?? fallbackBaseUrl;
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

export function jsonRequest(body: unknown): RequestInit {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
