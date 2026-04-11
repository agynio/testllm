import { randomUUID } from "crypto";
import type { User } from "@prisma/client";
import { authenticatedFetch } from "./auth";
import { jsonRequest, managementUrl } from "./api";

export const defaultOrgPayload = { name: "Acme", slug: "acme" };
export const defaultSuitePayload = { name: "suite-alpha", description: "Alpha" };

type OrgPayload = { name: string; slug: string };
type CreateOrgOptions = {
  payload?: Partial<OrgPayload>;
  uniqueSlug?: boolean;
};

export async function createOrg(user: User, options: CreateOrgOptions = {}) {
  const basePayload = { ...defaultOrgPayload, ...options.payload };
  const slug = options.uniqueSlug
    ? `${basePayload.slug}-${randomUUID()}`
    : basePayload.slug;

  const response = await authenticatedFetch(
    managementUrl("/orgs"),
    {
      method: "POST",
      ...jsonRequest({ ...basePayload, slug }),
    },
    user
  );
  const body = await response.json();
  return { response, body };
}

type SuitePayload = {
  name: string;
  description?: string;
  protocol?: "openai" | "anthropic";
};

export async function createSuite(
  user: User,
  orgId: string,
  payload: SuitePayload = defaultSuitePayload
) {
  const response = await authenticatedFetch(
    managementUrl(`/orgs/${orgId}/suites`),
    {
      method: "POST",
      ...jsonRequest(payload),
    },
    user
  );
  const body = await response.json();
  return { response, body };
}
