# TestLLM Implementation Guide

> **Target audience:** Engineer implementing the project. This document is self-contained — no internet access required.

---

## Table of Contents

1. [Package Manifest](#1-package-manifest)
2. [Project Initialization & Folder Structure](#2-project-initialization--folder-structure)
3. [Database — Prisma](#3-database--prisma)
4. [Authentication — Auth.js v5 (next-auth)](#4-authentication--authjs-v5-next-auth)
5. [Environment Variables](#5-environment-variables)

---

## 1. Package Manifest

Install everything in one shot:

```bash
npx create-next-app@latest testllm --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd testllm

# Core
npm install next-auth@beta @prisma/client zod

# Dev / tooling
npm install -D prisma typescript @types/node @types/react
```

| Package | Version (as of writing) | Purpose |
|---|---|---|
| `next` | `16.2.0` | React framework (App Router) |
| `react` / `react-dom` | `19.x` (bundled with Next 16) | UI runtime |
| `next-auth` | `5.0.0-beta.30` (`@beta` tag) | Auth.js v5 — OIDC authentication |
| `@prisma/client` | `7.5.0` | Generated Prisma query client |
| `prisma` | `7.5.0` (dev) | Prisma CLI — migrations, generate |
| `zod` | `4.3.6` | Request body / param validation |
| `typescript` | `5.9.x` | Type checking |

> **Note on `@auth/prisma-adapter`:** We do **not** use the Auth.js database adapter. TestLLM uses **JWT sessions with manual user provisioning** — our `User` table has a different schema from Auth.js's default. See §4 for rationale.

---

## 2. Project Initialization & Folder Structure

### 2.1 Create the project

```bash
npx create-next-app@latest testllm \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

### 2.2 Recommended folder layout

```
testllm/
├── auth.config.ts              # Edge-safe Auth.js config (providers only, no Prisma)
├── auth.ts                     # Full Auth.js config (callbacks, events — imports Prisma)
├── middleware.ts                # Next.js middleware — protects /api/**, skips /v1/**
├── prisma/
│   └── schema.prisma           # Prisma schema
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   │
│   │   ├── api/                          # ── Management API (authed) ──
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts          # Auth.js route handler
│   │   │   ├── orgs/
│   │   │   │   ├── route.ts              # POST /api/orgs, GET /api/orgs
│   │   │   │   └── [orgId]/
│   │   │   │       ├── route.ts          # GET/PATCH/DELETE /api/orgs/:orgId
│   │   │   │       ├── members/
│   │   │   │       │   ├── route.ts      # GET /api/orgs/:orgId/members
│   │   │   │       │   └── [membershipId]/
│   │   │   │       │       └── route.ts  # PATCH/DELETE
│   │   │   │       ├── invites/
│   │   │   │       │   ├── route.ts      # POST/GET /api/orgs/:orgId/invites
│   │   │   │       │   └── [inviteId]/
│   │   │   │       │       └── route.ts  # DELETE
│   │   │   │       └── suites/
│   │   │   │           ├── route.ts      # POST/GET /api/orgs/:orgId/suites
│   │   │   │           └── [suiteId]/
│   │   │   │               ├── route.ts  # GET/PATCH/DELETE
│   │   │   │               └── tests/
│   │   │   │                   ├── route.ts      # POST/GET
│   │   │   │                   └── [testId]/
│   │   │   │                       └── route.ts  # GET/PATCH/DELETE
│   │   │   └── invites/
│   │   │       └── [token]/
│   │   │           └── accept/
│   │   │               └── route.ts      # POST /api/invites/:token/accept
│   │   │
│   │   └── v1/                            # ── Responses API (unauthenticated) ──
│   │       └── org/
│   │           └── [orgSlug]/
│   │               └── suite/
│   │                   └── [suiteName]/
│   │                       └── responses/
│   │                           └── route.ts  # POST /v1/org/:orgSlug/suite/:suiteName/responses
│   │
│   └── lib/
│       ├── prisma.ts           # Prisma client singleton
│       └── errors.ts           # Shared error response builders
│
├── types/
│   └── next-auth.d.ts          # Module augmentation for Auth.js types
├── .env.local                  # Local environment variables (not committed)
├── package.json
└── tsconfig.json
```

### 2.3 Key conventions

| Convention | Detail |
|---|---|
| **`/api/**`** | Management API. All routes under here require OIDC authentication (enforced by middleware + per-handler check). |
| **`/v1/**`** | Responses API. **No authentication.** Middleware explicitly skips this path. |
| **`/api/auth/[...nextauth]`** | Auth.js catch-all route handler. Handles `/api/auth/signin`, `/api/auth/callback/*`, `/api/auth/signout`, `/api/auth/session`. |
| **`auth.config.ts`** | Edge-compatible subset of Auth.js config (providers only). Used by middleware. |
| **`auth.ts`** | Full Auth.js config with callbacks and Prisma access. Used everywhere except middleware. |
| **Route params** | Next.js App Router dynamic segments: `[orgId]`, `[suiteId]`, `[testId]`, `[orgSlug]`, `[suiteName]`, `[token]`, `[membershipId]`, `[inviteId]`. |

---

## 3. Database — Prisma

### 3.1 Initialize Prisma

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

### 3.2 Full Prisma Schema

Replace the contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────

enum OrgRole {
  admin
  member
}

enum TestItemType {
  message
  function_call
  function_call_output
}

// ─── Models ──────────────────────────────────────────────

model Organization {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  memberships OrgMembership[]
  invites     Invite[]
  testSuites  TestSuite[]

  @@map("organizations")
}

model User {
  id          String   @id @default(uuid()) @db.Uuid
  oidcSubject String   @unique @map("oidc_subject")
  email       String
  name        String
  createdAt   DateTime @default(now()) @map("created_at")

  memberships OrgMembership[]

  @@map("users")
}

model OrgMembership {
  id        String   @id @default(uuid()) @db.Uuid
  orgId     String   @map("org_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  role      OrgRole
  createdAt DateTime @default(now()) @map("created_at")

  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([orgId, userId])
  @@map("org_memberships")
}

model Invite {
  id        String   @id @default(uuid()) @db.Uuid
  orgId     String   @map("org_id") @db.Uuid
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@map("invites")
}

model TestSuite {
  id          String   @id @default(uuid()) @db.Uuid
  orgId       String   @map("org_id") @db.Uuid
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  org   Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  tests Test[]

  @@unique([orgId, name])
  @@map("test_suites")
}

model Test {
  id          String   @id @default(uuid()) @db.Uuid
  testSuiteId String   @map("test_suite_id") @db.Uuid
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  testSuite TestSuite  @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  items     TestItem[]

  @@unique([testSuiteId, name])
  @@map("tests")
}

model TestItem {
  id        String       @id @default(uuid()) @db.Uuid
  testId    String       @map("test_id") @db.Uuid
  position  Int
  type      TestItemType
  content   Json
  createdAt DateTime     @default(now()) @map("created_at")

  test Test @relation(fields: [testId], references: [id], onDelete: Cascade)

  @@unique([testId, position])
  @@index([testId, position])
  @@map("test_items")
}
```

### 3.3 Schema design decisions

| Decision | Rationale |
|---|---|
| `@db.Uuid` on all IDs | PostgreSQL native UUID type; `@default(uuid())` generates v4 UUIDs. |
| `@@map("snake_case")` on models | Keep DB table/column names in snake_case (PostgreSQL convention) while using camelCase in TypeScript. |
| `@map("snake_case")` on fields | Same — maps camelCase fields to snake_case columns. |
| `onDelete: Cascade` everywhere | Matches documented behavior: deleting an org cascades to memberships, invites, suites; deleting a suite cascades to tests; deleting a test cascades to items. |
| `@@unique([orgId, userId])` on `OrgMembership` | "A user has one role per organization." |
| `@@unique([orgId, name])` on `TestSuite` | "Test suite name unique within the organization." |
| `@@unique([testSuiteId, name])` on `Test` | "Test name unique within the test suite." |
| `@@unique([testId, position])` on `TestItem` | "No duplicate positions within a test." |
| `@@index([testId, position])` on `TestItem` | Query pattern: load all items for a test ordered by position. The unique constraint creates an index, but an explicit composite index ensures ordered scans are efficient. |
| `content Json` on `TestItem` | JSONB column. Structure depends on `type` (see data-model.md). |
| `description String?` | Optional fields per spec are nullable. |
| No Auth.js adapter tables | We use JWT sessions and manual user provisioning — no `Account`, `Session`, or `VerificationToken` tables needed. |

### 3.4 Run migrations

```bash
# Create and apply the initial migration
npx prisma migrate dev --name init

# Regenerate the Prisma client (also done automatically by migrate dev)
npx prisma generate
```

### 3.5 Prisma Client Singleton

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why:** During Next.js development, hot module reloading re-executes module-level code. Without the singleton, each reload creates a new `PrismaClient` instance with its own connection pool, eventually exhausting the database's connection limit. Storing the instance on `globalThis` persists it across reloads. In production (serverless), each cold start gets a fresh instance — which is correct.

**Usage:** Import from anywhere:

```typescript
import { prisma } from "@/lib/prisma";
```

---

## 4. Authentication — Auth.js v5 (next-auth)

### 4.1 Architecture overview

```
┌─────────────────────────────────────────────────────┐
│  middleware.ts                                       │
│  (edge runtime — no Prisma)                         │
│  imports auth.config.ts                             │
│  • Runs on every request matching the matcher       │
│  • Checks session for /api/** (except /api/auth/**)│
│  • Skips /v1/** entirely                            │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  auth.ts                                            │
│  (Node.js runtime — has Prisma)                     │
│  • Full NextAuth() config                           │
│  • jwt callback: persist userId + oidcSubject       │
│  • session callback: expose userId in session       │
│  • signIn callback: auto-provision User record      │
│  Exports: auth, handlers, signIn, signOut           │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  app/api/auth/[...nextauth]/route.ts                │
│  Re-exports GET and POST from handlers              │
└─────────────────────────────────────────────────────┘
```

**Why split into two files?**

Prisma's client is **not edge-compatible**. Next.js middleware runs on the edge runtime. Auth.js needs to be initialized in middleware to check sessions, but it cannot import Prisma there. The split:

- `auth.config.ts` — providers only, edge-safe. Used by middleware.
- `auth.ts` — full config with Prisma-dependent callbacks. Used by API route handlers and server components.

### 4.2 Session strategy: JWT (not database sessions)

| Strategy | Pros | Cons |
|---|---|---|
| **JWT** ✅ | Edge-compatible; no DB round-trip per request; works with middleware; simpler setup | Token size grows with payload; revocation requires extra logic |
| Database | Revocable sessions; smaller cookies | Requires DB query per request; not edge-compatible with Prisma; needs Auth.js adapter tables |

**Decision:** Use **JWT sessions**. TestLLM manages its own `User` table (with `oidc_subject`) and does not use Auth.js's database adapter. User provisioning is done manually in the `signIn` callback, not through the adapter's `createUser` flow.

### 4.3 File: `auth.config.ts` (edge-safe providers)

```typescript
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [
    {
      id: "oidc",
      name: "OIDC Provider",
      type: "oidc",
      issuer: process.env.OIDC_ISSUER!,
      clientId: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
      // Request the claims we need for user provisioning.
      // "openid" is implicit for type: "oidc".
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    },
  ],
} satisfies NextAuthConfig;
```

**Key points:**

- `type: "oidc"` tells Auth.js to auto-discover endpoints via `{issuer}/.well-known/openid-configuration`.
- `id: "oidc"` — the provider identifier. The Auth.js callback URL will be `/api/auth/callback/oidc`. Register this in the OIDC provider's dashboard.
- No `profile` callback here — that goes in `auth.ts` where Prisma is available.

### 4.4 File: `auth.ts` (full config)

```typescript
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,

  // JWT sessions (no database adapter)
  session: { strategy: "jwt" },

  callbacks: {
    /**
     * signIn — called after OIDC authentication succeeds, before the session
     * is created. Use this to auto-provision the User record.
     *
     * Return `true` to allow sign-in, `false` to deny.
     *
     * `profile` contains the raw OIDC ID token claims.
     * `account` contains token data (access_token, id_token, etc.).
     * `user` is the normalized user object from the provider's default
     *   profile() mapping: { id: profile.sub, name: profile.name, email: profile.email }.
     */
    async signIn({ profile }) {
      if (!profile?.sub) return false;

      // Upsert: create if not exists, update email/name if changed.
      await prisma.user.upsert({
        where: { oidcSubject: profile.sub },
        create: {
          oidcSubject: profile.sub,
          email: (profile.email as string) ?? "",
          name: (profile.name as string) ?? "",
        },
        update: {
          email: (profile.email as string) ?? "",
          name: (profile.name as string) ?? "",
        },
      });

      return true;
    },

    /**
     * jwt — called when the JWT is created (sign-in) and on every session
     * access. On initial sign-in, `profile` and `account` are present.
     *
     * We persist the OIDC `sub` and the internal `userId` in the token so
     * we can retrieve them in the session callback without a DB query.
     */
    async jwt({ token, profile }) {
      // On first sign-in, look up the user we just provisioned and store the ID.
      if (profile?.sub) {
        const user = await prisma.user.findUniqueOrThrow({
          where: { oidcSubject: profile.sub },
          select: { id: true },
        });
        token.userId = user.id;
        token.oidcSubject = profile.sub;
      }
      return token;
    },

    /**
     * session — controls what is exposed to the client via `auth()` /
     * `useSession()`. We inject our internal userId.
     */
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
```

### 4.5 File: `types/next-auth.d.ts` (type augmentation)

Auth.js's default `Session` type has `user.id?: string`. We augment it to carry our internal `userId` and ensure type safety:

```typescript
import "next-auth";
import "next-auth/jwt";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Internal database user ID (UUID) */
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Internal database user ID (UUID) */
    userId?: string;
    /** OIDC subject claim */
    oidcSubject?: string;
  }
}
```

Make sure `tsconfig.json` includes the `types/` directory:

```json
{
  "compilerOptions": {
    // ...
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "types/**/*.d.ts"]
}
```

### 4.6 File: `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

This single file handles all Auth.js HTTP routes:
- `GET  /api/auth/signin` — sign-in page
- `GET  /api/auth/signout` — sign-out page
- `POST /api/auth/signin/oidc` — initiate OIDC flow
- `GET  /api/auth/callback/oidc` — OIDC callback
- `GET  /api/auth/session` — get current session (JSON)
- `POST /api/auth/signout` — destroy session

> **Note on `@/auth`:** This imports from `auth.ts` at the project root. The default `create-next-app --src-dir` sets `@/*` → `./src/*`. Since `auth.ts` is at the project root (not inside `src/`), you have two options:
> 1. Move `auth.ts` and `auth.config.ts` into `src/` (then `@/auth` works).
> 2. Keep them at root and use a relative import: `import { handlers } from "../../../auth"` (ugly).
>
> **Recommended:** Place `auth.ts` and `auth.config.ts` inside `src/` so that `@/auth` resolves correctly. The middleware file stays at project root regardless.

### 4.7 File: `middleware.ts` (request-level auth gate)

```typescript
import NextAuth from "next-auth";
import authConfig from "./src/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // For all matched /api/** routes (excluding /api/auth/**), require a session.
  if (!req.auth) {
    return Response.json(
      { error: { message: "Unauthorized", type: "auth_error", code: "unauthorized" } },
      { status: 401 }
    );
  }

  // Authenticated — continue to route handler.
});

export const config = {
  // Run middleware on /api/** routes, but NOT on:
  //   - /api/auth/** (Auth.js handlers — must be public for the login flow)
  //   - /v1/** (Responses API — unauthenticated by design)
  //   - /_next/static/**, /_next/image/**, /favicon.ico (static assets)
  matcher: ["/api/((?!auth/).*)"],
};
```

**How the `matcher` regex works:**

- `"/api/((?!auth/).*)"` — matches any path starting with `/api/` **except** paths that continue with `auth/`.
- `/v1/**` is **not** in the matcher at all, so middleware never runs for Responses API requests.
- Static assets (`/_next/static`, etc.) are also not matched.

**What happens at the edge:**

1. Request arrives for `POST /api/orgs`.
2. Middleware regex matches → middleware runs.
3. Auth.js (edge-safe config) decodes the JWT session cookie.
4. If `req.auth` is null → return 401 JSON immediately (route handler never invoked).
5. If `req.auth` exists → request continues to the route handler.

### 4.8 Getting the current user in API route handlers

In management API route handlers, use the `auth()` function exported from `auth.ts`:

```typescript
// src/app/api/orgs/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  // Middleware already rejected unauthenticated requests, but defense-in-depth:
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { message: "Unauthorized", type: "auth_error", code: "unauthorized" } },
      { status: 401 }
    );
  }

  const userId = session.user.id; // Internal DB UUID

  const memberships = await prisma.orgMembership.findMany({
    where: { userId },
    include: { org: true },
  });

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

**Alternative pattern — `auth()` as a route handler wrapper:**

Auth.js v5 also supports wrapping the entire handler, which attaches `req.auth`:

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const GET = auth(function GET(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json(
      { error: { message: "Unauthorized", type: "auth_error", code: "unauthorized" } },
      { status: 401 }
    );
  }

  const userId = req.auth.user.id;
  // ... business logic
});
```

Both patterns work. The `await auth()` call is more explicit and doesn't change the function signature. **Pick one pattern and use it consistently.**

### 4.9 Responses API route — no auth

The route handler at `src/app/v1/org/[orgSlug]/suite/[suiteName]/responses/route.ts` does **not** call `auth()`. Middleware never runs for `/v1/**`. The handler reads path params and processes the request directly:

```typescript
// src/app/v1/org/[orgSlug]/suite/[suiteName]/responses/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; suiteName: string }> }
) {
  const { orgSlug, suiteName } = await params;

  // No authentication — by design.
  // Any Authorization header is ignored.

  const body = await request.json();
  const model = body.model as string;
  // ... matching logic per responses-api.md
}
```

> **Note on `params`:** In Next.js 15+, the `params` prop in route handlers is a `Promise`. You must `await` it before accessing the values.

### 4.10 User auto-provisioning flow (summary)

```
User clicks "Sign in"
  → /api/auth/signin/oidc
  → Redirect to OIDC provider
  → User authenticates at OIDC provider
  → Redirect to /api/auth/callback/oidc with authorization code
  → Auth.js exchanges code for tokens
  → Auth.js calls signIn({ profile, account, user })
     → profile.sub = "oidc-subject-123"
     → profile.email = "alice@example.com"
     → profile.name = "Alice"
     → prisma.user.upsert({ where: { oidcSubject: "oidc-subject-123" }, ... })
     → return true (allow sign-in)
  → Auth.js calls jwt({ token, profile })
     → prisma.user.findUniqueOrThrow({ where: { oidcSubject: "oidc-subject-123" } })
     → token.userId = "<internal-uuid>"
     → token.oidcSubject = "oidc-subject-123"
  → Auth.js creates encrypted JWT cookie
  → User is signed in
```

On subsequent requests:

```
Request arrives with JWT cookie
  → Middleware decodes JWT (edge)
  → req.auth.user.id is available
  → Route handler calls auth()
  → session.user.id = "<internal-uuid>"
  → Handler uses userId for DB queries
```

---

## 5. Environment Variables

Create `.env.local` (never committed):

```bash
# ── Database ──
DATABASE_URL="postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres"

# ── Auth.js ──
# Required. Secret used to encrypt JWTs and cookies.
# Generate with: openssl rand -base64 32
AUTH_SECRET="your-random-secret-at-least-32-chars"

# Optional. Auto-detected from request headers in most environments.
# Set explicitly if behind a proxy or in local dev:
# AUTH_URL="http://localhost:3000"

# Set to "true" when running behind a reverse proxy (Vercel sets this automatically):
# AUTH_TRUST_HOST="true"

# ── OIDC Provider ──
OIDC_ISSUER="https://auth.example.com"
OIDC_CLIENT_ID="your-client-id"
OIDC_CLIENT_SECRET="your-client-secret"
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase). |
| `AUTH_SECRET` | Yes | Encryption key for JWT cookies. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | No* | Base URL of the app. Auto-detected on Vercel. Set for local dev if needed. |
| `AUTH_TRUST_HOST` | No* | Set to `"true"` when behind a proxy. Vercel sets this automatically. |
| `OIDC_ISSUER` | Yes | OIDC provider's issuer URL. Auth.js fetches `{OIDC_ISSUER}/.well-known/openid-configuration` to discover endpoints. |
| `OIDC_CLIENT_ID` | Yes | OAuth client ID registered with the OIDC provider. |
| `OIDC_CLIENT_SECRET` | Yes | OAuth client secret. |

**OIDC provider configuration:**

Register the following callback URL with your OIDC provider:

```
{AUTH_URL}/api/auth/callback/oidc
```

For local development: `http://localhost:3000/api/auth/callback/oidc`
