# TestLLM API Implementation Guide

> **Target audience:** Engineer implementing the API layer. This document is self-contained — no internet access required.
>
> **Prerequisites:** The project setup, Prisma schema, and Auth.js configuration from `implementation-guide.md` are already in place.

---

## Table of Contents

1. [Helpers and Middleware](#1-helpers-and-middleware)
2. [Management API — Organizations](#2-management-api--organizations)
3. [Management API — Members](#3-management-api--members)
4. [Management API — Invites](#4-management-api--invites)
5. [Management API — Test Suites](#5-management-api--test-suites)
6. [Management API — Tests](#6-management-api--tests)
7. [Responses API](#7-responses-api)

---

## 1. Helpers and Middleware

### 1.1 Error Response Helper — `src/lib/errors.ts`

Every error response across both API surfaces uses a consistent JSON shape. Define the builder once:

```typescript
import { NextResponse } from "next/server";

interface ApiError {
  message: string;
  type: string;
  code: string;
}

export function errorResponse(status: number, error: ApiError): NextResponse {
  return NextResponse.json({ error }, { status });
}

// ── Management API errors ──

export function unauthorizedError(): NextResponse {
  return errorResponse(401, {
    message: "Unauthorized",
    type: "auth_error",
    code: "unauthorized",
  });
}

export function forbiddenError(): NextResponse {
  return errorResponse(403, {
    message: "Forbidden: insufficient permissions",
    type: "auth_error",
    code: "forbidden",
  });
}

export function notFoundError(resource: string): NextResponse {
  return errorResponse(404, {
    message: `${resource} not found`,
    type: "not_found_error",
    code: "not_found",
  });
}

export function conflictError(message: string): NextResponse {
  return errorResponse(409, {
    message,
    type: "conflict_error",
    code: "conflict",
  });
}

export function validationError(message: string): NextResponse {
  return errorResponse(400, {
    message,
    type: "validation_error",
    code: "invalid_request",
  });
}

// ── Responses API errors (OpenAI format) ──

export function openaiError(
  status: number,
  message: string,
  type: string,
  code: string
): NextResponse {
  return errorResponse(status, { message, type, code });
}
```

### 1.2 Auth Helper — `src/lib/auth-helpers.ts`

This module provides the reusable `getAuthUser`, `getAuthWithMembership`, and `requireRole` functions. Every management API route handler calls one of these to get the current user and (optionally) verify org membership + role.

```typescript
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedError, forbiddenError, notFoundError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { OrgRole } from "@prisma/client";

// ── Return types ──

interface AuthUser {
  userId: string;
}

interface AuthWithMembership {
  userId: string;
  membership: {
    id: string;
    role: OrgRole;
    orgId: string;
    userId: string;
  };
}

type AuthResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: NextResponse };

// ── Get authenticated user (no org check) ──
// Use for endpoints that only require login: POST /api/orgs, GET /api/orgs,
// POST /api/invites/:token/accept.

export async function getAuthUser(): Promise<AuthResult<AuthUser>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: unauthorizedError() };
  }
  return { ok: true, value: { userId: session.user.id } };
}

// ── Get authenticated user + org membership ──
// Use for endpoints that require membership (any role):
// all suite/test CRUD, GET org, GET members.

export async function getAuthWithMembership(
  orgId: string
): Promise<AuthResult<AuthWithMembership>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: unauthorizedError() };
  }

  const membership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    // Return 404 "Organization not found" rather than 403 to avoid
    // leaking the existence of orgs the user doesn't belong to.
    return { ok: false, error: notFoundError("Organization") };
  }

  return {
    ok: true,
    value: {
      userId: session.user.id,
      membership: {
        id: membership.id,
        role: membership.role,
        orgId: membership.orgId,
        userId: membership.userId,
      },
    },
  };
}

// ── Require admin role ──
// Use for admin-only endpoints: PATCH/DELETE org, member management, invites.

export async function requireRole(
  orgId: string,
  requiredRole: "admin"
): Promise<AuthResult<AuthWithMembership>> {
  const result = await getAuthWithMembership(orgId);
  if (!result.ok) return result;

  if (result.value.membership.role !== requiredRole) {
    return { ok: false, error: forbiddenError() };
  }

  return result;
}
```

**Usage pattern in route handlers:**

```typescript
// Any authenticated member of the org:
const authResult = await getAuthWithMembership(orgId);
if (!authResult.ok) return authResult.error;
const { userId, membership } = authResult.value;

// Admin-only:
const authResult = await requireRole(orgId, "admin");
if (!authResult.ok) return authResult.error;
```

### 1.3 Validation Helper — `src/lib/validation.ts`

A small wrapper around Zod parsing to produce consistent validation error responses:

```typescript
import { z } from "zod";
import { NextResponse } from "next/server";
import { validationError } from "@/lib/errors";

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: NextResponse };

export function parseBody<T>(
  schema: z.ZodType<T>,
  data: unknown
): ParseResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path =
      firstIssue.path.length > 0
        ? firstIssue.path.join(".") + ": "
        : "";
    return {
      ok: false,
      error: validationError(`${path}${firstIssue.message}`),
    };
  }
  return { ok: true, data: result.data };
}
```

### 1.4 Date Serialization Convention

All timestamps in API responses are ISO 8601 strings. Use this pattern consistently:

```typescript
// In every response mapping:
created_at: entity.createdAt.toISOString(),
updated_at: entity.updatedAt.toISOString(),
```

### 1.5 Route Handler Signature Reference

Next.js 16 App Router route handlers receive `params` as a `Promise`. The canonical signature:

```typescript
import { NextRequest, NextResponse } from "next/server";

// Route with no dynamic segments:
export async function GET(request: NextRequest) { /* ... */ }

// Route with dynamic segments:
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  // ...
}

// Route with multiple dynamic segments:
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string; testId: string }> }
) {
  const { orgId, suiteId, testId } = await params;
  // ...
}
```

---

## 2. Management API — Organizations

### File: `src/app/api/orgs/route.ts`

Handles `POST /api/orgs` and `GET /api/orgs`.

#### Zod Schemas

```typescript
import { z } from "zod";

const CreateOrgSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  slug: z
    .string()
    .min(1, { error: "slug is required" })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      error: "slug must be lowercase alphanumeric with hyphens",
    }),
});
```

#### POST — Create Organization

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";
import { conflictError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const authResult = await getAuthUser();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  // 2. Validate body
  const body = await request.json();
  const parsed = parseBody(CreateOrgSchema, body);
  if (!parsed.ok) return parsed.error;
  const { name, slug } = parsed.data;

  // 3. Check slug uniqueness
  const existing = await prisma.organization.findUnique({
    where: { slug },
  });
  if (existing) {
    return conflictError("An organization with this slug already exists");
  }

  // 4. Create org + admin membership in a single nested create
  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      memberships: {
        create: {
          userId,
          role: "admin",
        },
      },
    },
  });

  // 5. Response
  return NextResponse.json(
    {
      id: org.id,
      name: org.name,
      slug: org.slug,
      created_at: org.createdAt.toISOString(),
      updated_at: org.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
```

#### GET — List Organizations

```typescript
export async function GET() {
  // 1. Authenticate
  const authResult = await getAuthUser();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  // 2. Query memberships with org data
  const memberships = await prisma.orgMembership.findMany({
    where: { userId },
    include: { org: true },
  });

  // 3. Map to response format (includes role per the spec)
  const orgs = memberships.map((m) => ({
    id: m.org.id,
    name: m.org.name,
    slug: m.org.slug,
    role: m.role,
    created_at: m.org.createdAt.toISOString(),
    updated_at: m.org.updatedAt.toISOString(),
  }));

  return NextResponse.json(orgs);
}
```

---

### File: `src/app/api/orgs/[orgId]/route.ts`

Handles `GET`, `PATCH`, `DELETE` on `/api/orgs/{orgId}`.

#### Zod Schemas

```typescript
import { z } from "zod";

const UpdateOrgSchema = z.object({
  name: z.string().min(1).optional(),
});
```

#### GET — Get Organization

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // 1. Auth + membership check (any role)
  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  // 2. Load org
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
  });
}
```

#### PATCH — Update Organization

```typescript
import { requireRole } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // 1. Auth — admin only
  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  // 2. Validate
  const body = await request.json();
  const parsed = parseBody(UpdateOrgSchema, body);
  if (!parsed.ok) return parsed.error;

  // 3. Update
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: parsed.data,
  });

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
  });
}
```

#### DELETE — Delete Organization

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // 1. Auth — admin only
  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  // 2. Delete (cascades to memberships, invites, suites, tests, items)
  await prisma.organization.delete({ where: { id: orgId } });

  return new NextResponse(null, { status: 204 });
}
```

---

## 3. Management API — Members

### File: `src/app/api/orgs/[orgId]/members/route.ts`

#### GET — List Members

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // Any member can list members
  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const memberships = await prisma.orgMembership.findMany({
    where: { orgId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  const members = memberships.map((m) => ({
    id: m.id,
    user: {
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
    },
    role: m.role,
    created_at: m.createdAt.toISOString(),
  }));

  return NextResponse.json(members);
}
```

---

### File: `src/app/api/orgs/[orgId]/members/[membershipId]/route.ts`

#### Zod Schemas

```typescript
import { z } from "zod";

const UpdateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});
```

#### PATCH — Update Member Role

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";
import { notFoundError } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;

  // 1. Admin only
  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  // 2. Validate
  const body = await request.json();
  const parsed = parseBody(UpdateMemberSchema, body);
  if (!parsed.ok) return parsed.error;

  // 3. Verify the membership exists and belongs to this org
  const existing = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Membership");
  }

  // 4. Update
  const updated = await prisma.orgMembership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    user: {
      id: updated.user.id,
      email: updated.user.email,
      name: updated.user.name,
    },
    role: updated.role,
    created_at: updated.createdAt.toISOString(),
  });
}
```

#### DELETE — Remove Member

```typescript
import { errorResponse } from "@/lib/errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;

  // 1. Admin only
  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  // 2. Verify the membership exists and belongs to this org
  const existing = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Membership");
  }

  // 3. Prevent removing the last admin
  if (existing.role === "admin") {
    const adminCount = await prisma.orgMembership.count({
      where: { orgId, role: "admin" },
    });
    if (adminCount <= 1) {
      return errorResponse(400, {
        message: "Cannot remove the last admin of the organization",
        type: "validation_error",
        code: "last_admin",
      });
    }
  }

  // 4. Delete
  await prisma.orgMembership.delete({ where: { id: membershipId } });

  return new NextResponse(null, { status: 204 });
}
```

---

## 4. Management API — Invites

### File: `src/app/api/orgs/[orgId]/invites/route.ts`

#### POST — Create Invite

```typescript
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // 1. Admin only
  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  // 2. Generate token and expiry (24 hours)
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 3. Create invite
  const invite = await prisma.invite.create({
    data: {
      orgId,
      token,
      expiresAt,
    },
  });

  // 4. Build invite URL
  const baseUrl = process.env.AUTH_URL ?? request.nextUrl.origin;
  const url = `${baseUrl}/invite/${invite.token}`;

  return NextResponse.json(
    {
      id: invite.id,
      token: invite.token,
      url,
      expires_at: invite.expiresAt.toISOString(),
      created_at: invite.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
```

#### GET — List Invites

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // Admin only
  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  const invites = await prisma.invite.findMany({
    where: { orgId },
  });

  const baseUrl = process.env.AUTH_URL ?? request.nextUrl.origin;

  return NextResponse.json(
    invites.map((inv) => ({
      id: inv.id,
      token: inv.token,
      url: `${baseUrl}/invite/${inv.token}`,
      expires_at: inv.expiresAt.toISOString(),
      created_at: inv.createdAt.toISOString(),
    }))
  );
}
```

---

### File: `src/app/api/orgs/[orgId]/invites/[inviteId]/route.ts`

#### DELETE — Delete Invite

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> }
) {
  const { orgId, inviteId } = await params;

  // 1. Admin only
  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  // 2. Verify invite exists and belongs to this org
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.orgId !== orgId) {
    return notFoundError("Invite");
  }

  // 3. Delete
  await prisma.invite.delete({ where: { id: inviteId } });

  return new NextResponse(null, { status: 204 });
}
```

---

### File: `src/app/api/invites/[token]/accept/route.ts`

This endpoint lives **outside** the `/api/orgs/{orgId}/...` hierarchy because the caller does not know the org ID — they only have the token.

#### POST — Accept Invite

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";
import { errorResponse, notFoundError, conflictError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // 1. Authenticate (any user)
  const authResult = await getAuthUser();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  // 2. Look up invite by token
  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite) {
    return notFoundError("Invite");
  }

  // 3. Check expiry
  if (invite.expiresAt < new Date()) {
    return errorResponse(410, {
      message: "Invite has expired",
      type: "gone_error",
      code: "invite_expired",
    });
  }

  // 4. Check if user is already a member
  const existingMembership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId: invite.orgId,
        userId,
      },
    },
  });
  if (existingMembership) {
    return conflictError("User is already a member of this organization");
  }

  // 5. Create membership + delete invite in a transaction
  await prisma.$transaction([
    prisma.orgMembership.create({
      data: {
        orgId: invite.orgId,
        userId,
        role: "member",
      },
    }),
    prisma.invite.delete({ where: { id: invite.id } }),
  ]);

  return NextResponse.json({
    org_id: invite.orgId,
    role: "member",
  });
}
```

---

## 5. Management API — Test Suites

### File: `src/app/api/orgs/[orgId]/suites/route.ts`

#### Zod Schemas

```typescript
import { z } from "zod";

const CreateSuiteSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().optional(),
});
```

#### POST — Create Test Suite

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";
import { conflictError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // 1. Any member can create suites
  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  // 2. Validate
  const body = await request.json();
  const parsed = parseBody(CreateSuiteSchema, body);
  if (!parsed.ok) return parsed.error;
  const { name, description } = parsed.data;

  // 3. Check name uniqueness within org
  const existing = await prisma.testSuite.findUnique({
    where: { orgId_name: { orgId, name } },
  });
  if (existing) {
    return conflictError(
      "A test suite with this name already exists in the organization"
    );
  }

  // 4. Create
  const suite = await prisma.testSuite.create({
    data: { orgId, name, description },
  });

  return NextResponse.json(
    {
      id: suite.id,
      org_id: suite.orgId,
      name: suite.name,
      description: suite.description,
      created_at: suite.createdAt.toISOString(),
      updated_at: suite.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
```

#### GET — List Test Suites

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suites = await prisma.testSuite.findMany({
    where: { orgId },
  });

  return NextResponse.json(
    suites.map((s) => ({
      id: s.id,
      org_id: s.orgId,
      name: s.name,
      description: s.description,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }))
  );
}
```

---

### File: `src/app/api/orgs/[orgId]/suites/[suiteId]/route.ts`

#### Zod Schemas

```typescript
import { z } from "zod";

const UpdateSuiteSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
```

#### GET — Get Test Suite

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suite = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!suite || suite.orgId !== orgId) {
    return notFoundError("Test suite");
  }

  return NextResponse.json({
    id: suite.id,
    org_id: suite.orgId,
    name: suite.name,
    description: suite.description,
    created_at: suite.createdAt.toISOString(),
    updated_at: suite.updatedAt.toISOString(),
  });
}
```

#### PATCH — Update Test Suite

```typescript
import { parseBody } from "@/lib/validation";
import { conflictError } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const body = await request.json();
  const parsed = parseBody(UpdateSuiteSchema, body);
  if (!parsed.ok) return parsed.error;

  // Verify suite belongs to this org
  const existing = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Test suite");
  }

  // If name is changing, check uniqueness
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const nameConflict = await prisma.testSuite.findUnique({
      where: { orgId_name: { orgId, name: parsed.data.name } },
    });
    if (nameConflict) {
      return conflictError(
        "A test suite with this name already exists in the organization"
      );
    }
  }

  const suite = await prisma.testSuite.update({
    where: { id: suiteId },
    data: parsed.data,
  });

  return NextResponse.json({
    id: suite.id,
    org_id: suite.orgId,
    name: suite.name,
    description: suite.description,
    created_at: suite.createdAt.toISOString(),
    updated_at: suite.updatedAt.toISOString(),
  });
}
```

#### DELETE — Delete Test Suite

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const existing = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Test suite");
  }

  // Cascades to tests and items
  await prisma.testSuite.delete({ where: { id: suiteId } });

  return new NextResponse(null, { status: 204 });
}
```

---

## 6. Management API — Tests

### Zod Schemas (shared across test route files)

Place these in the route files or in a shared `src/lib/schemas/test-items.ts`:

```typescript
import { z } from "zod";

// ── Item content schemas per type ──

const InputMessageContentSchema = z.object({
  role: z.enum(["user", "system", "developer"]),
  content: z.string(),
});

const OutputMessageContentSchema = z.object({
  role: z.literal("assistant"),
  content: z.string(),
});

const FunctionCallContentSchema = z.object({
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

const FunctionCallOutputContentSchema = z.object({
  call_id: z.string(),
  output: z.string(),
});

// ── Discriminated item schemas ──

const MessageItemSchema = z.object({
  type: z.literal("message"),
  content: z.union([InputMessageContentSchema, OutputMessageContentSchema]),
});

const FunctionCallItemSchema = z.object({
  type: z.literal("function_call"),
  content: FunctionCallContentSchema,
});

const FunctionCallOutputItemSchema = z.object({
  type: z.literal("function_call_output"),
  content: FunctionCallOutputContentSchema,
});

const TestItemSchema = z.union([
  MessageItemSchema,
  FunctionCallItemSchema,
  FunctionCallOutputItemSchema,
]);

// ── Top-level schemas ──

export const CreateTestSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().optional(),
  items: z.array(TestItemSchema).min(1, { error: "items must not be empty" }),
});

export const UpdateTestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  items: z.array(TestItemSchema).min(1).optional(),
});
```

### Helper: Verify Suite Belongs to Org

Used by all test endpoints:

```typescript
async function findSuiteOrNull(orgId: string, suiteId: string) {
  const suite = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!suite || suite.orgId !== orgId) return null;
  return suite;
}
```

### Helper: Load Test With Ownership Check

```typescript
async function findTestOrNull(
  orgId: string,
  suiteId: string,
  testId: string
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { testSuite: true },
  });
  if (!test) return null;
  if (test.testSuiteId !== suiteId) return null;
  if (test.testSuite.orgId !== orgId) return null;
  return test;
}
```

### Helper: Format Test Response

```typescript
function formatTestResponse(
  test: {
    id: string;
    testSuiteId: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  items?: {
    id: string;
    position: number;
    type: string;
    content: unknown;
  }[]
) {
  const response: Record<string, unknown> = {
    id: test.id,
    test_suite_id: test.testSuiteId,
    name: test.name,
    description: test.description,
    created_at: test.createdAt.toISOString(),
    updated_at: test.updatedAt.toISOString(),
  };
  if (items) {
    response.items = items.map((item) => ({
      id: item.id,
      position: item.position,
      type: item.type,
      content: item.content,
    }));
  }
  return response;
}
```

---

### File: `src/app/api/orgs/[orgId]/suites/[suiteId]/tests/route.ts`

#### POST — Create Test

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";
import { notFoundError, conflictError } from "@/lib/errors";
import { CreateTestSchema } from "@/lib/schemas/test-items";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  // 1. Auth
  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  // 2. Verify suite
  const suite = await findSuiteOrNull(orgId, suiteId);
  if (!suite) return notFoundError("Test suite");

  // 3. Validate body
  const body = await request.json();
  const parsed = parseBody(CreateTestSchema, body);
  if (!parsed.ok) return parsed.error;
  const { name, description, items } = parsed.data;

  // 4. Check name uniqueness within suite
  const existing = await prisma.test.findUnique({
    where: { testSuiteId_name: { testSuiteId: suiteId, name } },
  });
  if (existing) {
    return conflictError("A test with this name already exists in the suite");
  }

  // 5. Create test + items via nested create
  //    Items get position from their array index (0-based).
  const test = await prisma.test.create({
    data: {
      testSuiteId: suiteId,
      name,
      description,
      items: {
        create: items.map((item, index) => ({
          position: index,
          type: item.type,
          content: item.content,
        })),
      },
    },
    include: {
      items: {
        orderBy: { position: "asc" },
      },
    },
  });

  // 6. Format response
  return NextResponse.json(
    formatTestResponse(test, test.items),
    { status: 201 }
  );
}
```

#### GET — List Tests

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suite = await findSuiteOrNull(orgId, suiteId);
  if (!suite) return notFoundError("Test suite");

  // List tests WITHOUT items (per spec)
  const tests = await prisma.test.findMany({
    where: { testSuiteId: suiteId },
  });

  return NextResponse.json(
    tests.map((t) => formatTestResponse(t))
  );
}
```

---

### File: `src/app/api/orgs/[orgId]/suites/[suiteId]/tests/[testId]/route.ts`

#### GET — Get Test (with items)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string; testId: string }> }
) {
  const { orgId, suiteId, testId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) return notFoundError("Test");

  const items = await prisma.testItem.findMany({
    where: { testId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json(formatTestResponse(test, items));
}
```

#### PATCH — Update Test

```typescript
import { parseBody } from "@/lib/validation";
import { conflictError } from "@/lib/errors";
import { UpdateTestSchema } from "@/lib/schemas/test-items";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string; testId: string }> }
) {
  const { orgId, suiteId, testId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) return notFoundError("Test");

  const body = await request.json();
  const parsed = parseBody(UpdateTestSchema, body);
  if (!parsed.ok) return parsed.error;

  const { name, description, items } = parsed.data;

  // If name is changing, check uniqueness
  if (name !== undefined && name !== test.name) {
    const nameConflict = await prisma.test.findUnique({
      where: { testSuiteId_name: { testSuiteId: suiteId, name } },
    });
    if (nameConflict) {
      return conflictError("A test with this name already exists in the suite");
    }
  }

  // Build metadata update
  const metadataUpdate: Record<string, unknown> = {};
  if (name !== undefined) metadataUpdate.name = name;
  if (description !== undefined) metadataUpdate.description = description;

  if (items !== undefined) {
    // Full replacement: delete all existing items, create new ones.
    // Use an interactive transaction to ensure atomicity.
    const updatedTest = await prisma.$transaction(async (tx) => {
      await tx.testItem.deleteMany({ where: { testId } });

      return tx.test.update({
        where: { id: testId },
        data: {
          ...metadataUpdate,
          items: {
            create: items.map((item, index) => ({
              position: index,
              type: item.type,
              content: item.content,
            })),
          },
        },
        include: {
          items: { orderBy: { position: "asc" } },
        },
      });
    });

    return NextResponse.json(formatTestResponse(updatedTest, updatedTest.items));
  }

  // No items provided — metadata-only update
  const updatedTest = await prisma.test.update({
    where: { id: testId },
    data: metadataUpdate,
    include: {
      items: { orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json(formatTestResponse(updatedTest, updatedTest.items));
}
```

#### DELETE — Delete Test

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string; testId: string }> }
) {
  const { orgId, suiteId, testId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) return notFoundError("Test");

  // Cascades to test items
  await prisma.test.delete({ where: { id: testId } });

  return new NextResponse(null, { status: 204 });
}
```

---

## 7. Responses API

### File: `src/app/v1/org/[orgSlug]/suite/[suiteName]/responses/route.ts`

This is the core of TestLLM — the unauthenticated OpenAI-compatible endpoint.

### 7.1 Item Type Classification

Define how items are classified as input vs output:

```typescript
// An item is an "input item" if:
//   - type === "message" AND content.role is "user", "system", or "developer"
//   - type === "function_call_output"
//
// An item is an "output item" if:
//   - type === "message" AND content.role is "assistant"
//   - type === "function_call"

interface MessageContent {
  role: string;
  content: string;
}

interface FunctionCallContent {
  call_id: string;
  name: string;
  arguments: string;
}

interface FunctionCallOutputContent {
  call_id: string;
  output: string;
}

type ItemContent = MessageContent | FunctionCallContent | FunctionCallOutputContent;

interface TestItemRecord {
  id: string;
  position: number;
  type: string; // "message" | "function_call" | "function_call_output"
  content: ItemContent;
}

function isOutputItem(item: TestItemRecord): boolean {
  if (item.type === "function_call") return true;
  if (item.type === "message") {
    const content = item.content as MessageContent;
    return content.role === "assistant";
  }
  return false;
}
```

### 7.2 Input Normalization

The OpenAI Responses API accepts `input` as either a string or an array. Normalize both to a uniform array:

```typescript
interface NormalizedInputMessage {
  type: "message";
  role: string;
  content: string;
}

interface NormalizedInputFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

interface NormalizedInputFunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

type NormalizedInputItem =
  | NormalizedInputMessage
  | NormalizedInputFunctionCall
  | NormalizedInputFunctionCallOutput;

function normalizeInput(input: unknown): NormalizedInputItem[] {
  // String → single user message
  if (typeof input === "string") {
    return [{ type: "message", role: "user", content: input }];
  }

  // Array → map each item to normalized form
  const items = input as Array<Record<string, unknown>>;
  return items.map((item): NormalizedInputItem => {
    if (item.type === "function_call") {
      return {
        type: "function_call",
        call_id: item.call_id as string,
        name: item.name as string,
        arguments: item.arguments as string,
      };
    }

    if (item.type === "function_call_output") {
      return {
        type: "function_call_output",
        call_id: item.call_id as string,
        output: item.output as string,
      };
    }

    // Default: message.
    // Items with just "role" + "content" (no "type" field) are messages
    // in the OpenAI Responses API shorthand.
    return {
      type: "message",
      role: item.role as string,
      content: item.content as string,
    };
  });
}
```

### 7.3 Matching Algorithm — Step by Step

The algorithm walks the test sequence to find the expected input prefix, compares it to the request input, and returns the consecutive output items that follow.

**Key insight:** In the OpenAI Responses API protocol, each request includes ALL prior context — both the input items the caller originally sent AND the output items the model previously returned (which the caller sends back as part of the conversation history). So the caller's input array grows with each turn.

The matching algorithm identifies which "turn" the caller is on by counting how many items they sent, then verifies exact match against the expected prefix.

```typescript
interface MatchSuccess {
  outputItems: TestItemRecord[];
}

interface MatchError {
  status: number;
  message: string;
  type: string;
  code: string;
}

type MatchResult = MatchSuccess | MatchError;

function isMatchError(result: MatchResult): result is MatchError {
  return "status" in result;
}

function matchInput(
  sequence: TestItemRecord[],
  input: NormalizedInputItem[]
): MatchResult {
  // ── Step 1: Find the match boundary ──
  //
  // Walk the test sequence. Maintain a count of "expected input" items.
  // These are ALL items (both input and output) that the caller would
  // have in their input array at each turn boundary.
  //
  // When we hit an output item and the accumulated count equals the
  // caller's input length, we've found the turn boundary.

  const expectedItems: TestItemRecord[] = [];
  let matchBoundary = -1;

  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i];

    if (isOutputItem(item)) {
      // This is an output item. Check if the accumulated items so far
      // match the caller's input length — meaning the caller's input
      // corresponds to everything before this output.
      if (expectedItems.length === input.length) {
        matchBoundary = i;
        break;
      }
      // The caller has more input than we've accumulated so far.
      // This means the caller already received this output item in a
      // prior response and is now including it in their input (per the
      // OpenAI protocol where prior output is sent back as input context).
      expectedItems.push(item);
    } else {
      // Input item — accumulate it.
      expectedItems.push(item);
    }
  }

  // If we walked the entire sequence without finding a boundary:
  if (matchBoundary === -1) {
    if (expectedItems.length <= input.length) {
      // The caller sent input that reaches or goes past the end of the
      // sequence — there are no more output items to return.
      return {
        status: 400,
        message: "Input extends beyond the defined test sequence",
        type: "invalid_request_error",
        code: "sequence_exhausted",
      };
    }
    // The caller hasn't sent enough input yet — no turn boundary reached.
    return {
      status: 400,
      message:
        `Input mismatch: expected ${expectedItems.length} input items ` +
        `but got ${input.length}`,
      type: "invalid_request_error",
      code: "input_mismatch",
    };
  }

  // ── Step 2: Compare each expected item against actual input ──

  for (let i = 0; i < expectedItems.length; i++) {
    const expected = expectedItems[i];
    const actual = input[i];
    const mismatch = compareItems(expected, actual, i);
    if (mismatch) return mismatch;
  }

  // ── Step 3: Collect consecutive output items from the boundary ──

  const outputItems: TestItemRecord[] = [];
  for (let i = matchBoundary; i < sequence.length; i++) {
    if (isOutputItem(sequence[i])) {
      outputItems.push(sequence[i]);
    } else {
      break; // Hit the next input item — stop collecting
    }
  }

  return { outputItems };
}
```

### 7.4 Item Comparison

Exact-match rules for each item type:

```typescript
function compareItems(
  expected: TestItemRecord,
  actual: NormalizedInputItem,
  position: number
): MatchError | null {
  // ── Type mismatch ──
  if (expected.type !== actual.type) {
    return {
      status: 400,
      message:
        `Input mismatch at position ${position}: ` +
        `expected type '${expected.type}', got type '${actual.type}'`,
      type: "invalid_request_error",
      code: "input_mismatch",
    };
  }

  // ── Message comparison ──
  if (expected.type === "message" && actual.type === "message") {
    const exp = expected.content as MessageContent;
    if (exp.role !== actual.role || exp.content !== actual.content) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected message with role '${exp.role}' and content ` +
          `'${exp.content}', got message with role '${actual.role}' ` +
          `and content '${actual.content}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  // ── Function call comparison (output item sent back as input) ──
  if (expected.type === "function_call" && actual.type === "function_call") {
    const exp = expected.content as FunctionCallContent;
    if (
      exp.call_id !== actual.call_id ||
      exp.name !== actual.name ||
      exp.arguments !== actual.arguments
    ) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected function_call '${exp.name}' with call_id '${exp.call_id}', ` +
          `got function_call '${actual.name}' with call_id '${actual.call_id}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  // ── Function call output comparison ──
  if (
    expected.type === "function_call_output" &&
    actual.type === "function_call_output"
  ) {
    const exp = expected.content as FunctionCallOutputContent;
    if (exp.call_id !== actual.call_id || exp.output !== actual.output) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected function_call_output with call_id '${exp.call_id}', ` +
          `got function_call_output with call_id '${actual.call_id}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  // Unreachable if types are consistent — the type equality check above
  // ensures we always enter one of the branches. If a new type is added
  // to the system without updating this function, fail loudly.
  throw new Error(
    `Unhandled item type comparison: expected '${expected.type}', actual '${actual.type}'`
  );
}
```

### 7.5 Response Formatting

Transform internal `TestItem` records into the OpenAI Responses API output format:

```typescript
import { randomUUID } from "crypto";

interface OpenAIOutputMessage {
  id: string;
  type: "message";
  role: "assistant";
  status: "completed";
  content: Array<{
    type: "output_text";
    text: string;
    annotations: [];
  }>;
}

interface OpenAIOutputFunctionCall {
  id: string;
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
  status: "completed";
}

type OpenAIOutputItem = OpenAIOutputMessage | OpenAIOutputFunctionCall;

function formatOutputItem(item: TestItemRecord): OpenAIOutputItem {
  if (item.type === "message") {
    const content = item.content as MessageContent;
    return {
      id: `msg_${randomUUID()}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [
        {
          type: "output_text",
          text: content.content,
          annotations: [],
        },
      ],
    };
  }

  if (item.type === "function_call") {
    const content = item.content as FunctionCallContent;
    return {
      id: `fc_${randomUUID()}`,
      type: "function_call",
      call_id: content.call_id,
      name: content.name,
      arguments: content.arguments,
      status: "completed",
    };
  }

  // Output items are only assistant messages or function_calls.
  // If we reach here, the test data is malformed.
  throw new Error(
    `Unexpected output item type: ${item.type} at position ${item.position}`
  );
}

interface OpenAIResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: OpenAIOutputItem[];
  status: "completed";
}

function formatResponse(
  model: string,
  outputItems: TestItemRecord[]
): OpenAIResponse {
  return {
    id: `resp_${randomUUID()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model,
    output: outputItems.map(formatOutputItem),
    status: "completed",
  };
}
```

### 7.6 Full Route Handler

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openaiError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; suiteName: string }> }
) {
  const { orgSlug, suiteName } = await params;

  // No authentication — by design.
  // Any Authorization header is ignored.

  // ── 1. Parse request body ──
  const body = await request.json();
  const model = body.model as string | undefined;
  const rawInput = body.input;

  if (!model) {
    return openaiError(
      400,
      "Missing required field: model",
      "invalid_request_error",
      "missing_model"
    );
  }
  if (rawInput === undefined || rawInput === null) {
    return openaiError(
      400,
      "Missing required field: input",
      "invalid_request_error",
      "missing_input"
    );
  }

  // ── 2. Resolve organization ──
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) {
    return openaiError(
      404,
      `Organization '${orgSlug}' not found`,
      "not_found_error",
      "org_not_found"
    );
  }

  // ── 3. Resolve test suite ──
  const suite = await prisma.testSuite.findUnique({
    where: { orgId_name: { orgId: org.id, name: suiteName } },
  });
  if (!suite) {
    return openaiError(
      404,
      `Test suite '${suiteName}' not found in organization '${orgSlug}'`,
      "not_found_error",
      "suite_not_found"
    );
  }

  // ── 4. Resolve test (model name) ──
  const test = await prisma.test.findUnique({
    where: { testSuiteId_name: { testSuiteId: suite.id, name: model } },
  });
  if (!test) {
    return openaiError(
      404,
      `Model '${model}' not found in suite '${suiteName}'`,
      "not_found_error",
      "model_not_found"
    );
  }

  // ── 5. Load test sequence ──
  const sequence = await prisma.testItem.findMany({
    where: { testId: test.id },
    orderBy: { position: "asc" },
  });

  // ── 6. Normalize input ──
  const normalizedInput = normalizeInput(rawInput);

  // ── 7. Match ──
  const result = matchInput(
    sequence as unknown as TestItemRecord[],
    normalizedInput
  );

  if (isMatchError(result)) {
    return openaiError(result.status, result.message, result.type, result.code);
  }

  // ── 8. Format and return ──
  const response = formatResponse(model, result.outputItems);
  return NextResponse.json(response);
}
```

### 7.7 Matching Walk-Through Example

To verify understanding, here is a concrete trace using the weather agent example from the docs:

**Test sequence:**

| Pos | Type | Dir | Content |
|-----|------|-----|---------|
| 0 | `message` | input | `system`: "You are a weather assistant." |
| 1 | `message` | input | `user`: "What is the weather in SF?" |
| 2 | `function_call` | output | `get_weather({"location":"SF"})` with `call_id: "call_abc123"` |
| 3 | `function_call_output` | input | `call_id: "call_abc123"`, `output: "{\"temperature\":65}"` |
| 4 | `message` | output | `assistant`: "It's 65°F in SF." |

**Request 1:** `input: [system msg, user msg]` (2 items)

1. Walk sequence:
   - pos 0 is input → expectedItems = [pos0]
   - pos 1 is input → expectedItems = [pos0, pos1]
   - pos 2 is output → check: `expectedItems.length (2) === input.length (2)` → **yes** → matchBoundary = 2
2. Compare: pos0 system msg ✓, pos1 user msg ✓
3. Collect output from pos 2: pos 2 is `function_call` (output) → collect. Pos 3 is `function_call_output` (input) → stop.
4. **Return:** `[function_call at pos 2]`

Formatted response:

```json
{
  "id": "resp_<uuid>",
  "object": "response",
  "created_at": 1700000000,
  "model": "weather-agent-happy-path",
  "output": [
    {
      "id": "fc_<uuid>",
      "type": "function_call",
      "call_id": "call_abc123",
      "name": "get_weather",
      "arguments": "{\"location\":\"SF\"}",
      "status": "completed"
    }
  ],
  "status": "completed"
}
```

**Request 2:** `input: [system msg, user msg, function_call, function_call_output]` (4 items)

1. Walk sequence:
   - pos 0 is input → expectedItems = [pos0]
   - pos 1 is input → expectedItems = [pos0, pos1]
   - pos 2 is output → check: `2 === 4`? **No** → push pos2 → expectedItems = [pos0, pos1, pos2]
   - pos 3 is input → expectedItems = [pos0, pos1, pos2, pos3]
   - pos 4 is output → check: `4 === 4`? **Yes** → matchBoundary = 4
2. Compare all 4: system msg ✓, user msg ✓, function_call ✓, function_call_output ✓
3. Collect output from pos 4: pos 4 is `message` (assistant, output) → collect. End of sequence → stop.
4. **Return:** `[assistant message at pos 4]`

Formatted response:

```json
{
  "id": "resp_<uuid>",
  "object": "response",
  "created_at": 1700000000,
  "model": "weather-agent-happy-path",
  "output": [
    {
      "id": "msg_<uuid>",
      "type": "message",
      "role": "assistant",
      "status": "completed",
      "content": [
        {
          "type": "output_text",
          "text": "It's 65°F in SF.",
          "annotations": []
        }
      ]
    }
  ],
  "status": "completed"
}
```

### 7.8 Error Response Summary

All errors use the OpenAI error envelope:

```json
{
  "error": {
    "message": "...",
    "type": "...",
    "code": "..."
  }
}
```

| Condition | HTTP | `type` | `code` | `message` |
|-----------|------|--------|--------|-----------|
| Missing `model` field | 400 | `invalid_request_error` | `missing_model` | `Missing required field: model` |
| Missing `input` field | 400 | `invalid_request_error` | `missing_input` | `Missing required field: input` |
| Org not found | 404 | `not_found_error` | `org_not_found` | `Organization '{orgSlug}' not found` |
| Suite not found | 404 | `not_found_error` | `suite_not_found` | `Test suite '{suiteName}' not found in organization '{orgSlug}'` |
| Model (test) not found | 404 | `not_found_error` | `model_not_found` | `Model '{model}' not found in suite '{suiteName}'` |
| Input mismatch at position N | 400 | `invalid_request_error` | `input_mismatch` | `Input mismatch at position N: expected ... got ...` |
| Input exhausts sequence | 400 | `invalid_request_error` | `sequence_exhausted` | `Input extends beyond the defined test sequence` |

---

## Appendix A: Complete File Index

| File | Methods | Auth | Description |
|------|---------|------|-------------|
| `src/lib/errors.ts` | — | — | Error response builders |
| `src/lib/auth-helpers.ts` | — | — | `getAuthUser`, `getAuthWithMembership`, `requireRole` |
| `src/lib/validation.ts` | — | — | `parseBody` Zod wrapper |
| `src/lib/schemas/test-items.ts` | — | — | Zod schemas for test items |
| `src/app/api/orgs/route.ts` | POST, GET | user | Create org, list user's orgs |
| `src/app/api/orgs/[orgId]/route.ts` | GET, PATCH, DELETE | member / admin | Get, update, delete org |
| `src/app/api/orgs/[orgId]/members/route.ts` | GET | member | List members |
| `src/app/api/orgs/[orgId]/members/[membershipId]/route.ts` | PATCH, DELETE | admin | Update role, remove member |
| `src/app/api/orgs/[orgId]/invites/route.ts` | POST, GET | admin | Create invite, list invites |
| `src/app/api/orgs/[orgId]/invites/[inviteId]/route.ts` | DELETE | admin | Delete invite |
| `src/app/api/invites/[token]/accept/route.ts` | POST | user | Accept invite (join org) |
| `src/app/api/orgs/[orgId]/suites/route.ts` | POST, GET | member | Create suite, list suites |
| `src/app/api/orgs/[orgId]/suites/[suiteId]/route.ts` | GET, PATCH, DELETE | member | Get, update, delete suite |
| `src/app/api/orgs/[orgId]/suites/[suiteId]/tests/route.ts` | POST, GET | member | Create test, list tests |
| `src/app/api/orgs/[orgId]/suites/[suiteId]/tests/[testId]/route.ts` | GET, PATCH, DELETE | member | Get, update, delete test |
| `src/app/v1/org/[orgSlug]/suite/[suiteName]/responses/route.ts` | POST | none | Responses API |

## Appendix B: Authorization Matrix

| Endpoint | Any Authenticated | Member | Admin |
|----------|:-:|:-:|:-:|
| `POST /api/orgs` | ✅ | — | — |
| `GET /api/orgs` | ✅ | — | — |
| `GET /api/orgs/:id` | — | ✅ | ✅ |
| `PATCH /api/orgs/:id` | — | — | ✅ |
| `DELETE /api/orgs/:id` | — | — | ✅ |
| `GET .../members` | — | ✅ | ✅ |
| `PATCH .../members/:id` | — | — | ✅ |
| `DELETE .../members/:id` | — | — | ✅ |
| `POST .../invites` | — | — | ✅ |
| `GET .../invites` | — | — | ✅ |
| `DELETE .../invites/:id` | — | — | ✅ |
| `POST /api/invites/:token/accept` | ✅ | — | — |
| `POST/GET .../suites` | — | ✅ | ✅ |
| `GET/PATCH/DELETE .../suites/:id` | — | ✅ | ✅ |
| `POST/GET .../tests` | — | ✅ | ✅ |
| `GET/PATCH/DELETE .../tests/:id` | — | ✅ | ✅ |
| `POST /v1/org/:slug/suite/:name/responses` | 🔓 No auth | 🔓 | 🔓 |

## Appendix C: Zod Version Notes

This project uses **Zod 4** (`zod@^4.3.6`). Key API differences from Zod 3 relevant to this guide:

| Zod 3 | Zod 4 | Used in this guide |
|-------|-------|-------------------|
| `import { z } from "zod"` | `import { z } from "zod"` (same default import) | ✅ |
| `z.nativeEnum(MyEnum)` | `z.enum(MyEnum)` — `nativeEnum` deprecated | Not needed — we use `z.enum(["a", "b"])` string arrays |
| `z.string().email()` | `z.email()` — method form deprecated | Not used |
| `z.record(valueSchema)` | `z.record(keySchema, valueSchema)` — single-arg dropped | Not used |
| `{ message: "..." }` error param | `{ error: "..." }` — `message` deprecated | ✅ Used for `.min()`, `.regex()` error messages |
| `.merge()` | `.extend()` or spread `...shape` | Not used |
| `z.ZodType<T>` generics | `z.ZodType<Output, Input>` — `Def` removed | Used in `parseBody<T>` generic |

All schemas in this guide use APIs stable across Zod 3 and 4: `z.object()`, `z.string()`, `z.enum()`, `z.literal()`, `z.union()`, `z.array()`, `.optional()`, `.min()`, `.regex()`, `.safeParse()`. The one Zod 4-specific pattern is using `{ error: "..." }` instead of `{ message: "..." }` for error customization.
