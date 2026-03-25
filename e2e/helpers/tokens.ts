import type { User } from "@prisma/client";
import { authenticatedFetch } from "./auth";
import { jsonRequest, managementUrl } from "./api";

const defaultPersonalPayload = { name: "Personal token" };
const defaultOrgPayload = { name: "Org token", role: "admin" };

type PersonalTokenPayload = { name: string; expires_at?: string };
type OrgTokenPayload = {
  name: string;
  role: "admin" | "member";
  expires_at?: string;
};

type CreatePersonalTokenOptions = {
  payload?: Partial<PersonalTokenPayload>;
};

type CreateOrgTokenOptions = {
  payload?: Partial<OrgTokenPayload>;
};

export async function createPersonalToken(
  user: User,
  options: CreatePersonalTokenOptions = {}
) {
  const payload = { ...defaultPersonalPayload, ...options.payload };
  const response = await authenticatedFetch(
    managementUrl("/user/tokens"),
    {
      method: "POST",
      ...jsonRequest(payload),
    },
    user
  );
  const body = await response.json();
  return { response, body };
}

export async function createOrgToken(
  user: User,
  orgId: string,
  options: CreateOrgTokenOptions = {}
) {
  const payload = { ...defaultOrgPayload, ...options.payload };
  const response = await authenticatedFetch(
    managementUrl(`/orgs/${orgId}/tokens`),
    {
      method: "POST",
      ...jsonRequest(payload),
    },
    user
  );
  const body = await response.json();
  return { response, body };
}

export async function tokenFetch(
  url: string,
  rawToken: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${rawToken}`);

  return fetch(url, {
    ...init,
    headers,
  });
}
