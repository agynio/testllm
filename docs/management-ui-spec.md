# Management UI — Full Specification

## Table of Contents

1. [Component Library Decision](#1-component-library-decision)
2. [New Dependencies](#2-new-dependencies)
3. [Data Fetching Strategy](#3-data-fetching-strategy)
4. [Routing & Page Hierarchy](#4-routing--page-hierarchy)
5. [Shared UI Elements](#5-shared-ui-elements)
6. [Page Specifications](#6-page-specifications)
7. [Test Item Editor](#7-test-item-editor)
8. [Component Inventory](#8-component-inventory)
9. [Implementation Order](#9-implementation-order)

---

## 1. Component Library Decision

**Recommendation: Use shadcn/ui (Radix primitives + Tailwind).**

### Rationale

| Criterion | shadcn/ui | Plain Tailwind |
|-----------|-----------|----------------|
| Accessibility (ARIA, keyboard nav) | Built-in via Radix | Must implement manually |
| Dialogs, dropdowns, select, tooltips | Ready-made, correct | Weeks of work to get right |
| Dark mode | Theme tokens out of the box | Must wire manually |
| Code ownership | Copy-pasted into `src/components/ui/` — no runtime dep | N/A |
| Bundle size | Tree-shaken, only what you use | Equivalent |
| Tailwind v4 + React 19 | Fully supported (latest release) | N/A |
| Geist font | Compatible — override `--font-sans` variable | N/A |

The management UI needs dialogs (confirm-delete), dropdowns (user menu), selects (role picker), tabs (org sections), forms (inputs, labels, textareas), and toast notifications. Building these from scratch is low-value work. shadcn/ui provides them as copy-paste source files with full ownership and zero lock-in.

### Setup

Run from the project root:

```bash
npx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Neutral** (matches the existing slate palette)
- CSS variables: **Yes**

This creates:
- `components.json` — shadcn configuration
- `src/components/ui/` — component source files
- `src/lib/utils.ts` — `cn()` helper (Tailwind class merge utility)
- Updates `globals.css` with CSS variable theme tokens

After init, preserve the existing Geist font setup. In `globals.css`, the shadcn theme tokens will be added alongside the existing `@theme inline` block. The `--font-sans` variable should reference the Geist variable: `--font-sans: var(--font-geist-sans);` (already present).

### Components to Install

```bash
npx shadcn@latest add button input label textarea select \
  dialog alert-dialog dropdown-menu tabs badge separator \
  table card sonner skeleton tooltip
```

Each command copies component source into `src/components/ui/`. No external runtime dependency beyond `radix-ui` (single unified package).

---

## 2. New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `radix-ui` | `^1.0` | Installed automatically by shadcn — unified Radix primitives |
| `class-variance-authority` | `^0.7` | Installed by shadcn — variant utility for components |
| `clsx` | `^2.1` | Installed by shadcn — conditional classnames |
| `tailwind-merge` | `^3.0` | Installed by shadcn — deduplicates Tailwind classes |
| `tw-animate-css` | `^1.2` | Installed by shadcn — animation utilities |
| `lucide-react` | `^0.500` | Installed by shadcn — icon library |
| `sonner` | `^2.0` | Toast notification library (installed via `npx shadcn add sonner`) |

All packages above are installed automatically by the shadcn CLI during `init` and component `add` commands. **No additional manual npm installs are needed.**

No form library is required. The UI uses plain React server actions and controlled form inputs. The forms in this app are simple (1–3 fields each) and don't warrant the weight of react-hook-form.

---

## 3. Data Fetching Strategy

**Recommendation: Server Components calling Prisma directly.**

### Rationale

The existing API routes are boundary endpoints for external consumers. The management UI is a first-party consumer running in the same Next.js process. Calling HTTP endpoints from Server Components would add unnecessary network round-trips, serialization overhead, and error-handling duplication.

Instead, each Server Component page calls Prisma directly, reusing the auth helpers that already exist (`getAuthUser`, `getAuthWithMembership`, `requireRole`).

### Pattern

```tsx
// src/app/dashboard/orgs/page.tsx (Server Component)
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function OrgsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const memberships = await prisma.orgMembership.findMany({
    where: { userId: session.user.id },
    include: { org: true },
  });

  return <OrgList memberships={memberships} />;
}
```

### Mutations

Use **Next.js Server Actions** for all create/update/delete operations. Server Actions run on the server, have access to Prisma and auth, and integrate natively with the App Router for revalidation.

```tsx
// Server Action (defined in a separate file with "use server")
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createOrg(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  // validate with zod, create with prisma, revalidate
}
```

### When Client Components Are Needed

Client Components (`"use client"`) are used only for:
1. Interactive editors (Test Item Editor — reordering, adding, removing items)
2. Confirmation dialogs (delete confirmations need `useState` for open/close)
3. Copy-to-clipboard (invite URL)
4. Client-side form validation feedback (inline errors before submit)

Client Components that perform mutations call Server Actions via `useActionState` (React 19) or form `action` prop.

---

## 4. Routing & Page Hierarchy

```
src/app/
├── (auth)/                              # Route group for authenticated pages
│   ├── layout.tsx                       # Auth check + shell layout (header, nav)
│   ├── dashboard/
│   │   └── page.tsx                     # Org list (home for logged-in users)
│   ├── orgs/
│   │   └── new/
│   │       └── page.tsx                 # Create organization form
│   ├── orgs/
│   │   └── [orgId]/
│   │       ├── layout.tsx               # Org-scoped layout (org name in header, tabs)
│   │       ├── page.tsx                 # Org overview → redirects to suites
│   │       ├── suites/
│   │       │   ├── page.tsx             # Test suites list
│   │       │   ├── new/
│   │       │   │   └── page.tsx         # Create test suite form
│   │       │   └── [suiteId]/
│   │       │       ├── page.tsx         # Suite detail: tests list
│   │       │       ├── edit/
│   │       │       │   └── page.tsx     # Edit suite name/description
│   │       │       └── tests/
│   │       │           ├── new/
│   │       │           │   └── page.tsx # Create test with item editor
│   │       │           └── [testId]/
│   │       │               ├── page.tsx # Test detail: view items
│   │       │               └── edit/
│   │       │                   └── page.tsx # Edit test with item editor
│   │       ├── members/
│   │       │   └── page.tsx             # Members list + role management
│   │       ├── invites/
│   │       │   └── page.tsx             # Invites list + create
│   │       └── settings/
│   │           └── page.tsx             # Org settings (rename, delete)
│   └── invite/
│       └── [token]/
│           └── page.tsx                 # Accept invite page
├── layout.tsx                           # Root layout (fonts, globals — unchanged)
├── page.tsx                             # Landing page (unchanged)
└── globals.css                          # Updated with shadcn theme tokens
```

### URL Summary

| URL Pattern | Page | Description |
|-------------|------|-------------|
| `/dashboard` | Dashboard | List of user's organizations |
| `/orgs/new` | Create Org | Create organization form |
| `/orgs/[orgId]` | Org Root | Redirects to `/orgs/[orgId]/suites` |
| `/orgs/[orgId]/suites` | Suites List | All test suites in the org |
| `/orgs/[orgId]/suites/new` | Create Suite | Create test suite form |
| `/orgs/[orgId]/suites/[suiteId]` | Suite Detail | List of tests in the suite |
| `/orgs/[orgId]/suites/[suiteId]/edit` | Edit Suite | Edit suite name/description |
| `/orgs/[orgId]/suites/[suiteId]/tests/new` | Create Test | Create test + item editor |
| `/orgs/[orgId]/suites/[suiteId]/tests/[testId]` | Test Detail | View test items (read-only) |
| `/orgs/[orgId]/suites/[suiteId]/tests/[testId]/edit` | Edit Test | Edit test + item editor |
| `/orgs/[orgId]/members` | Members | Members list + role management |
| `/orgs/[orgId]/invites` | Invites | Invite list + create (admin only) |
| `/orgs/[orgId]/settings` | Settings | Rename org, delete org (admin only) |
| `/invite/[token]` | Accept Invite | Accept invite flow |

---

## 5. Shared UI Elements

### 5.1 Auth Layout — `src/app/(auth)/layout.tsx`

A Server Component that:
1. Calls `auth()` — if no session, `redirect("/")`
2. Renders the **AppShell**: header bar + main content area
3. Passes session data (user name, email, id) to the header via props

```
┌──────────────────────────────────────────────────────────┐
│  [TestLLM]          [Dashboard]              [User ▾]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                     {children}                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Header contents:**
- Left: "TestLLM" text logo (links to `/dashboard`)
- Center-left: "Dashboard" nav link
- Right: User dropdown menu (shadcn `DropdownMenu`)
  - Shows user name + email
  - "Sign out" item — triggers a Server Action calling `signOut()`

The header is a minimal horizontal bar. No sidebar. The content area is centered with `max-w-5xl` width.

### 5.2 Org Layout — `src/app/(auth)/orgs/[orgId]/layout.tsx`

A Server Component that:
1. Fetches the organization and the user's membership (for role check)
2. If user is not a member, show 404 page
3. Renders org name as a heading and a **tab bar** for navigation within the org
4. Passes `orgId` and `role` to children via React context or layout props

```
┌──────────────────────────────────────────────────────────┐
│  [TestLLM]          [Dashboard]              [User ▾]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  My Organization                                         │
│  ─────────────────────────────────────────────           │
│  [Suites]  [Members]  [Invites*]  [Settings*]           │
│                                                          │
│                     {children}                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Tab items:
- **Suites** → `/orgs/[orgId]/suites` — visible to all members
- **Members** → `/orgs/[orgId]/members` — visible to all members
- **Invites** → `/orgs/[orgId]/invites` — visible to **admin only**
- **Settings** → `/orgs/[orgId]/settings` — visible to **admin only**

Use shadcn `Tabs` component styled as a navigation bar (not as controlled state tabs — each tab is a `<Link>`). Use the URL path to determine the active tab.

The org layout is responsible for providing org context. Create a simple context:

```tsx
// src/lib/org-context.ts
type OrgContext = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: "admin" | "member";
};
```

Since layouts are Server Components, pass this data to a thin Client Component context provider that wraps `{children}`:

```tsx
// src/components/org-provider.tsx
"use client";
import { createContext, useContext } from "react";

type OrgContextValue = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: "admin" | "member";
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children, value }: { children: React.ReactNode; value: OrgContextValue }) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
```

### 5.3 Page Header Component

A reusable component for page titles with optional actions:

```tsx
// src/components/page-header.tsx
type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;  // e.g., "Create Suite" button
};
```

Renders:
```
Title                                        [Action Button]
Optional description text
───────────────────────────────────────────────────────────
```

### 5.4 Confirmation Dialog

A reusable Client Component wrapping shadcn `AlertDialog`:

```tsx
// src/components/confirm-dialog.tsx
"use client";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;       // default: "Delete"
  variant?: "destructive";     // red confirm button
  onConfirm: () => void;
  pending?: boolean;           // shows spinner on confirm button
};
```

Used for all delete operations (org, suite, test, member, invite).

### 5.5 Empty State Component

For lists with no items:

```tsx
// src/components/empty-state.tsx
type EmptyStateProps = {
  icon?: React.ReactNode;      // optional Lucide icon
  title: string;               // e.g., "No test suites"
  description: string;         // e.g., "Create your first test suite to get started."
  action?: React.ReactNode;    // optional CTA button
};
```

### 5.6 Toast Notifications

Use `sonner` (installed via shadcn). Add the `<Toaster />` component to the auth layout.

Toast is used for:
- Success after create/update/delete operations
- Copied invite URL to clipboard
- Error messages from failed Server Actions

### 5.7 Form Error Handling Pattern

Server Actions return a result object rather than throwing:

```tsx
type ActionResult =
  | { success: true }
  | { success: false; error: string };
```

Client Components use `useActionState` (React 19) to capture the result and display errors inline:

```tsx
"use client";
import { useActionState } from "react";

function CreateOrgForm() {
  const [state, formAction, pending] = useActionState(createOrgAction, null);

  return (
    <form action={formAction}>
      <input name="name" />
      <input name="slug" />
      {state?.success === false && <p className="text-sm text-red-500">{state.error}</p>}
      <button type="submit" disabled={pending}>Create</button>
    </form>
  );
}
```

### 5.8 Breadcrumb

Not a separate component — implemented as simple text links in the page header area. Pattern:

```
Dashboard / My Organization / agent-weather / happy-path
```

Each segment is a `<Link>`. Implemented inline in each page — no abstraction needed for this scale.

---

## 6. Page Specifications

### 6.1 Dashboard — `/dashboard`

**File:** `src/app/(auth)/dashboard/page.tsx`
**Type:** Server Component

**Data fetching:**
```ts
const session = await auth();
const memberships = await prisma.orgMembership.findMany({
  where: { userId: session.user.id },
  include: { org: true },
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Your Organizations                    [+ New Org]       │
│──────────────────────────────────────────────────────────│
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ My Team        │  │ Acme Corp      │                 │
│  │ my-team        │  │ acme-corp      │                 │
│  │ admin          │  │ member         │                 │
│  └────────────────┘  └────────────────┘                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- `PageHeader` with title "Your Organizations" and a "New Organization" `Button` linking to `/orgs/new`
- Grid of `Card` components (shadcn `Card`), one per organization
  - Card shows: org name (bold), slug (monospace, muted), role `Badge`
  - Entire card is a link to `/orgs/[orgId]/suites`
- If no memberships: `EmptyState` with "No organizations yet" + "Create Organization" CTA

**Actions:**
- Click org card → navigate to org
- Click "+ New Organization" → navigate to `/orgs/new`

---

### 6.2 Create Organization — `/orgs/new`

**File:** `src/app/(auth)/orgs/new/page.tsx`
**Type:** Server Component wrapping a Client Component form

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                    │
│                                                          │
│  Create Organization                                     │
│──────────────────────────────────────────────────────────│
│                                                          │
│  Name          [________________________]                │
│  Slug          [________________________]                │
│                                                          │
│                           [Cancel]  [Create]             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Form fields:**

| Field | Element | Validation | Notes |
|-------|---------|------------|-------|
| Name | `Input` | Required, min 1 char | Display name |
| Slug | `Input` | Required, regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` | Auto-generated from name (kebab-case), editable |

**Auto-slug behavior:** As the user types the name, auto-generate the slug (lowercase, replace spaces with hyphens, strip non-alphanumeric). The slug field is editable so the user can override.

**Server Action:** `createOrganization(prevState, formData)`
- Validates with the same `CreateOrgSchema` from `src/lib/schemas/` (extract shared schema)
- Creates org via Prisma with the user as admin
- On success: `redirect("/orgs/[newOrgId]/suites")`
- On conflict (duplicate slug): return `{ success: false, error: "An organization with this slug already exists" }`

**Components:**
- `CreateOrgForm` (Client Component) — uses `useActionState`
- shadcn `Input`, `Label`, `Button`

---

### 6.3 Org Root — `/orgs/[orgId]`

**File:** `src/app/(auth)/orgs/[orgId]/page.tsx`
**Type:** Server Component

Simply redirects to `/orgs/[orgId]/suites` using `redirect()`.

---

### 6.4 Test Suites List — `/orgs/[orgId]/suites`

**File:** `src/app/(auth)/orgs/[orgId]/suites/page.tsx`
**Type:** Server Component

**Data fetching:**
```ts
const suites = await prisma.testSuite.findMany({
  where: { orgId },
  orderBy: { createdAt: "desc" },
  include: { _count: { select: { tests: true } } },
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Test Suites                           [+ New Suite]     │
│──────────────────────────────────────────────────────────│
│                                                          │
│  Name              Description              Tests        │
│  ────────────────────────────────────────────────────    │
│  agent-weather     Weather agent scenarios   3           │
│  agent-booking     Booking flow tests        7           │
│  agent-support     Support bot tests         12          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- `PageHeader` with "Test Suites" title and "New Suite" `Button` → `/orgs/[orgId]/suites/new`
- shadcn `Table` with columns: Name, Description, Tests (count)
  - Name column: link to `/orgs/[orgId]/suites/[suiteId]`
  - Suite name displayed in monospace font (`font-mono`)
- Empty state if no suites

**Actions:**
- Click suite name → navigate to suite detail
- Click "+ New Suite" → navigate to create suite

---

### 6.5 Create Test Suite — `/orgs/[orgId]/suites/new`

**File:** `src/app/(auth)/orgs/[orgId]/suites/new/page.tsx`
**Type:** Server Component wrapping Client Component form

**Form fields:**

| Field | Element | Validation | Notes |
|-------|---------|------------|-------|
| Name | `Input` | Required, min 1 char | Unique within org |
| Description | `Textarea` | Optional | Free text |

**Server Action:** `createSuite(prevState, formData)`
- Creates suite via Prisma
- On success: `redirect("/orgs/[orgId]/suites/[newSuiteId]")`
- On conflict: return error

---

### 6.6 Suite Detail — `/orgs/[orgId]/suites/[suiteId]`

**File:** `src/app/(auth)/orgs/[orgId]/suites/[suiteId]/page.tsx`
**Type:** Server Component

**Data fetching:**
```ts
const suite = await prisma.testSuite.findUnique({
  where: { id: suiteId },
});
// Verify suite.orgId === orgId

const tests = await prisma.test.findMany({
  where: { testSuiteId: suiteId },
  orderBy: { createdAt: "desc" },
  include: { _count: { select: { items: true } } },
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  ← Suites                                               │
│                                                          │
│  agent-weather                    [Edit]  [Delete]       │
│  Weather agent test scenarios                            │
│──────────────────────────────────────────────────────────│
│                                                          │
│  Tests                                [+ New Test]       │
│                                                          │
│  Name              Description              Items        │
│  ────────────────────────────────────────────────────    │
│  happy-path        Agent reports weather     5           │
│  error-case        API failure scenario      3           │
│                                                          │
│  ┌─ Responses API Endpoint ─────────────────────────┐   │
│  │  POST /v1/org/{slug}/suite/{name}/responses      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- Breadcrumb: "Suites" link back to suites list
- `PageHeader` with suite name + description, actions: "Edit" (`Button` variant=outline → edit page), "Delete" (`Button` variant=destructive → opens `ConfirmDialog`)
- Tests `Table` with columns: Name (link), Description, Items (count)
  - Test name displayed in monospace font
- "New Test" `Button` → `/orgs/[orgId]/suites/[suiteId]/tests/new`
- **API Endpoint Card**: a read-only info card showing the Responses API URL for this suite:
  `POST /v1/org/{orgSlug}/suite/{suiteName}/responses`
  with a copy-to-clipboard button. This is crucial — users need to know the endpoint to configure their agents.
- Empty state if no tests

**Actions:**
- Click test name → navigate to test detail
- Edit suite → `/orgs/[orgId]/suites/[suiteId]/edit`
- Delete suite → `ConfirmDialog` → Server Action `deleteSuite` → redirect to suites list
- Click "+ New Test" → navigate to create test

---

### 6.7 Edit Suite — `/orgs/[orgId]/suites/[suiteId]/edit`

**File:** `src/app/(auth)/orgs/[orgId]/suites/[suiteId]/edit/page.tsx`
**Type:** Server Component wrapping Client Component form

Same form as Create Suite but pre-filled with current values.

**Server Action:** `updateSuite(prevState, formData)`
- Updates via Prisma
- On success: `redirect("/orgs/[orgId]/suites/[suiteId]")`

---

### 6.8 Test Detail — `/orgs/[orgId]/suites/[suiteId]/tests/[testId]`

**File:** `src/app/(auth)/orgs/[orgId]/suites/[suiteId]/tests/[testId]/page.tsx`
**Type:** Server Component

**Data fetching:**
```ts
const test = await prisma.test.findUnique({
  where: { id: testId },
  include: { testSuite: true },
});
// Verify test.testSuite.orgId === orgId && test.testSuiteId === suiteId

const items = await prisma.testItem.findMany({
  where: { testId },
  orderBy: { position: "asc" },
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  ← agent-weather                                        │
│                                                          │
│  happy-path                       [Edit]  [Delete]       │
│  Agent correctly reports weather                         │
│──────────────────────────────────────────────────────────│
│                                                          │
│  Conversation Sequence                                   │
│                                                          │
│  0  INPUT   message    system     You are a weather...   │
│  1  INPUT   message    user       What is the weather..  │
│  2  OUTPUT  fn_call    —          get_weather({...})     │
│  3  INPUT   fn_output  —          {"temperature":65,...} │
│  4  OUTPUT  message    assistant  The weather in SF...   │
│                                                          │
│  ┌─ Model Name ─────────────────────────────────────┐   │
│  │  Use "happy-path" as the model field in requests  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- Breadcrumb: suite name link back to suite detail
- `PageHeader` with test name + description, actions: "Edit" + "Delete"
- `TestItemList` — read-only display of the conversation sequence (see §7 for details)
- **Model Name Card**: info card explaining that this test's name is the `model` field value in API requests. Copy-to-clipboard for the test name.
- Delete → `ConfirmDialog` → Server Action → redirect to suite detail

**Test item display (read-only):**

Each item rendered as a horizontal row:

| Column | Content |
|--------|---------|
| Position | `0`, `1`, `2`... — muted, monospace |
| Direction | `Badge`: "INPUT" (blue) or "OUTPUT" (green) |
| Type | `Badge`: "message", "function_call", "function_call_output" |
| Role/Name | For messages: role. For function_call: function name. For function_call_output: "→ {call_id}" |
| Content preview | Truncated content string (first 100 chars). For function_call: `name(arguments)`. For function_call_output: output string. |

Clicking a row expands it to show full content (collapsible). For `function_call` items, show `arguments` as formatted JSON. For `function_call_output`, show `output` as formatted JSON (attempt parse, fall back to raw string).

---

### 6.9 Create Test — `/orgs/[orgId]/suites/[suiteId]/tests/new`

**File:** `src/app/(auth)/orgs/[orgId]/suites/[suiteId]/tests/new/page.tsx`
**Type:** Server Component wrapping Client Component

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  ← agent-weather                                        │
│                                                          │
│  Create Test                                             │
│──────────────────────────────────────────────────────────│
│                                                          │
│  Name          [________________________]                │
│  Description   [________________________]                │
│                                                          │
│  Conversation Items                      [+ Add Item]    │
│  ──────────────────────────────────────────────          │
│  [ Test Item Editor — see §7 ]                           │
│                                                          │
│                           [Cancel]  [Create]             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Form fields:**

| Field | Element | Validation | Notes |
|-------|---------|------------|-------|
| Name | `Input` | Required, min 1 char | Used as model name |
| Description | `Textarea` | Optional | |
| Items | `TestItemEditor` | Required, min 1 item | See §7 |

**Server Action:** `createTest(prevState, formData)`
- `formData` contains name, description, and items as a JSON string (hidden input)
- Validates with `CreateTestSchema`
- Creates test with items via Prisma
- On success: `redirect("/orgs/[orgId]/suites/[suiteId]/tests/[newTestId]")`

---

### 6.10 Edit Test — `/orgs/[orgId]/suites/[suiteId]/tests/[testId]/edit`

Same as Create Test but pre-filled. The `TestItemEditor` is initialized with existing items.

**Server Action:** `updateTest(prevState, formData)`
- Full replacement of items (matches API behavior — delete all, recreate)
- On success: `redirect` to test detail

---

### 6.11 Members — `/orgs/[orgId]/members`

**File:** `src/app/(auth)/orgs/[orgId]/members/page.tsx`
**Type:** Server Component with Client Component for role editing

**Data fetching:**
```ts
const memberships = await prisma.orgMembership.findMany({
  where: { orgId },
  include: { user: { select: { id: true, email: true, name: true } } },
  orderBy: { createdAt: "asc" },
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Members                                                 │
│──────────────────────────────────────────────────────────│
│                                                          │
│  Name            Email                Role      Actions  │
│  ────────────────────────────────────────────────────    │
│  Alice           alice@ex.com         [admin ▾]   [✕]   │
│  Bob             bob@ex.com           [member ▾]  [✕]   │
│  You (Carol)     carol@ex.com         admin       —     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- `PageHeader` with "Members" title
- shadcn `Table` with columns: Name, Email, Role, Actions
- **Role column (admin only):**
  - For other members: shadcn `Select` with options "admin" / "member"
  - Changing the select immediately triggers Server Action `updateMemberRole`
  - For the current user's own row: display role as plain text (no self-edit)
- **Actions column (admin only):**
  - Remove button (trash icon) → `ConfirmDialog` → Server Action `removeMember`
  - Not shown for the current user's own row
  - Not shown for the last admin (server validates this too, but hide the button proactively)
- **For non-admin users:** Role and Actions columns show read-only text, no controls

**Note on invite link:** The members page does not have an invite button. Invites are managed on the dedicated Invites page (admin-only tab).

---

### 6.12 Invites — `/orgs/[orgId]/invites`

**File:** `src/app/(auth)/orgs/[orgId]/invites/page.tsx`
**Type:** Server Component (admin only — layout tab hidden for non-admins, page also checks role)

**Data fetching:**
```ts
// Verify admin role first
const invites = await prisma.invite.findMany({
  where: { orgId },
  orderBy: { createdAt: "desc" },
});
```

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Invites                            [+ Create Invite]    │
│──────────────────────────────────────────────────────────│
│                                                          │
│  URL                        Expires           Actions    │
│  ────────────────────────────────────────────────────    │
│  /invite/abc123...  [📋]    in 23 hours         [✕]     │
│  /invite/def456...  [📋]    expired              [✕]    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- `PageHeader` with "Invites" title and "Create Invite" `Button`
- shadcn `Table` with columns: URL (truncated, with copy button), Expires (relative time + expired badge), Actions (delete)
- Copy button uses `navigator.clipboard.writeText()` and shows toast "Copied to clipboard"
- Expired invites shown with strikethrough text and red "Expired" `Badge`
- Delete → `ConfirmDialog` → Server Action `deleteInvite` → `revalidatePath`

**Create Invite flow:**
- "Create Invite" button triggers Server Action `createInvite` directly (no form — the API takes no body)
- On success: new invite appears in the list, toast shows "Invite created"
- The invite URL is immediately visible and copyable

---

### 6.13 Settings — `/orgs/[orgId]/settings`

**File:** `src/app/(auth)/orgs/[orgId]/settings/page.tsx`
**Type:** Server Component (admin only)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Settings                                                │
│──────────────────────────────────────────────────────────│
│                                                          │
│  Organization Name                                       │
│  [________________________]                              │
│                                        [Save Changes]    │
│                                                          │
│  ──────────────────────────────────────────────          │
│                                                          │
│  Danger Zone                                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Delete Organization                             │   │
│  │  This will permanently delete "My Team" and all  │   │
│  │  its test suites, tests, members, and invites.   │   │
│  │                                [Delete Org]      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Sections:**

1. **Rename Organization**
   - `Input` pre-filled with current name
   - "Save Changes" button — Server Action `updateOrganization`
   - Slug is immutable (display only, muted text below the input)

2. **Danger Zone** (visually separated with red border card)
   - "Delete Organization" with description of consequences
   - "Delete" `Button` (destructive variant) → `ConfirmDialog` with org name typed to confirm
   - The confirmation dialog requires typing the org slug to confirm: "Type **my-team** to confirm"
   - Server Action `deleteOrganization` → `redirect("/dashboard")`

---

### 6.14 Accept Invite — `/invite/[token]`

**File:** `src/app/(auth)/invite/[token]/page.tsx`
**Type:** Server Component

**Flow:**
1. Fetch the invite by token (with org included)
2. If invite not found: show error "Invite not found or has been revoked"
3. If invite expired: show error "This invite has expired"
4. If found and valid: show org name, "Join {orgName}" button
5. Button triggers Server Action that calls the same logic as `POST /api/invites/[token]/accept`:
   - Add user as member
   - Delete invite
   - `redirect("/orgs/[orgId]/suites")`
6. If already a member: show message "You're already a member" with link to the org

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  You've been invited to join                             │
│                                                          │
│  My Team                                                 │
│                                                          │
│              [Join Organization]                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Test Item Editor

The Test Item Editor is the most complex UI component. It is a **Client Component** used on both the Create Test and Edit Test pages.

### 7.1 File Location

```
src/components/test-item-editor/
├── test-item-editor.tsx        # Main editor component
├── test-item-row.tsx           # Single item row (editable)
├── item-content-fields.tsx     # Content fields per item type
└── types.ts                    # Client-side types
```

### 7.2 Types

```tsx
// src/components/test-item-editor/types.ts

type MessageContent = {
  role: "user" | "system" | "developer" | "assistant";
  content: string;
};

type FunctionCallContent = {
  call_id: string;
  name: string;
  arguments: string;
};

type FunctionCallOutputContent = {
  call_id: string;
  output: string;
};

type TestItemDraft =
  | { type: "message"; content: MessageContent; clientId: string }
  | { type: "function_call"; content: FunctionCallContent; clientId: string }
  | { type: "function_call_output"; content: FunctionCallOutputContent; clientId: string };
```

`clientId` is a temporary UUID generated on the client for React `key` props. It is not sent to the server.

### 7.3 Main Editor Component

```tsx
// src/components/test-item-editor/test-item-editor.tsx
"use client";

type TestItemEditorProps = {
  initialItems?: TestItemDraft[];  // For edit mode
  // Items are serialized to a hidden input for form submission
  inputName: string;               // Name of the hidden input (e.g., "items")
};
```

**State:** `items: TestItemDraft[]` managed with `useState`.

**Rendering:**
```
┌──────────────────────────────────────────────────────────┐
│  Conversation Items                                      │
│──────────────────────────────────────────────────────────│
│                                                          │
│  #0  [message ▾]  [user ▾]                    [↑][↓][✕] │
│      Content: [________________________________]         │
│                                                          │
│  #1  [message ▾]  [assistant ▾]               [↑][↓][✕] │
│      Content: [________________________________]         │
│                                                          │
│  #2  [function_call ▾]                        [↑][↓][✕] │
│      Call ID:    [____________]                          │
│      Name:       [____________]                          │
│      Arguments:  [________________________________]      │
│                  (JSON string)                           │
│                                                          │
│  #3  [function_call_output ▾]                 [↑][↓][✕] │
│      Call ID:    [____________]                          │
│      Output:     [________________________________]      │
│                  (JSON string)                           │
│                                                          │
│  [+ Add Message] [+ Add Function Call] [+ Add Output]   │
│                                                          │
│  <input type="hidden" name="items" value="{json}" />    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 7.4 Item Row Component

```tsx
type TestItemRowProps = {
  item: TestItemDraft;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (updated: TestItemDraft) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};
```

**Each row contains:**

1. **Position indicator**: `#0`, `#1`, etc. — muted, not editable
2. **Type selector**: shadcn `Select` with options:
   - `message`
   - `function_call`
   - `function_call_output`
   
   When type changes, the content resets to default values for the new type.

3. **Direction badge**: Computed from type + role:
   - message with role user/system/developer → "INPUT" badge (blue)
   - message with role assistant → "OUTPUT" badge (green)
   - function_call → "OUTPUT" badge (green)
   - function_call_output → "INPUT" badge (blue)

4. **Content fields** (vary by type — see §7.5)

5. **Action buttons** (right side):
   - Move up (↑) — disabled if first item
   - Move down (↓) — disabled if last item
   - Remove (✕) — always enabled, but if only 1 item, show tooltip "At least one item required"

### 7.5 Content Fields by Type

#### `message` type

| Field | Element | Options/Validation |
|-------|---------|-------------------|
| Role | `Select` | `user`, `system`, `developer`, `assistant` |
| Content | `Textarea` (auto-resize) | Required, min 1 char |

#### `function_call` type

| Field | Element | Validation |
|-------|---------|------------|
| Call ID | `Input` | Required |
| Function Name | `Input` | Required |
| Arguments | `Textarea` (monospace) | Required. Placeholder: `{"key": "value"}`. No JSON validation on client — server validates. |

#### `function_call_output` type

| Field | Element | Validation |
|-------|---------|------------|
| Call ID | `Input` | Required |
| Output | `Textarea` (monospace) | Required. Placeholder: `{"result": "value"}` |

### 7.6 Add Item Buttons

Three separate buttons at the bottom of the item list:

| Button | Creates |
|--------|---------|
| + Add Message | `{ type: "message", content: { role: "user", content: "" }, clientId: uuid() }` |
| + Add Function Call | `{ type: "function_call", content: { call_id: "", name: "", arguments: "" }, clientId: uuid() }` |
| + Add Output | `{ type: "function_call_output", content: { call_id: "", output: "" }, clientId: uuid() }` |

New items are appended to the end of the list.

### 7.7 Reordering

Move up/down buttons swap the item with its neighbor. No drag-and-drop — buttons are sufficient for this use case and avoid a drag library dependency.

### 7.8 Serialization for Form Submission

The editor maintains a hidden `<input>` element whose `value` is the JSON-serialized items array (without `clientId`):

```tsx
const serializedItems = items.map(({ clientId, ...rest }) => rest);

<input
  type="hidden"
  name={inputName}
  value={JSON.stringify(serializedItems)}
/>
```

The Server Action reads this:
```ts
const rawItems = formData.get("items") as string;
const items = JSON.parse(rawItems);
// Validate with CreateTestSchema or UpdateTestSchema
```

### 7.9 Visual Design

- Each item row has a light gray background (`bg-muted/50`) with a left border color-coded by direction:
  - Input items: `border-l-blue-500`
  - Output items: `border-l-green-500`
- Items are visually separated with small gap (`gap-3`)
- Monospace font for Call ID, Arguments, and Output fields
- The position number is subtle (small, muted) — not a primary visual element

---

## 8. Component Inventory

### shadcn/ui Components to Install

| Component | Where Used |
|-----------|-----------|
| `button` | Every page — CTAs, actions |
| `input` | All forms |
| `label` | All forms |
| `textarea` | Suite description, test content, function args |
| `select` | Role picker, item type picker, role selector |
| `dialog` | Not directly — but shadcn dependency for alert-dialog |
| `alert-dialog` | Delete confirmations |
| `dropdown-menu` | User menu in header |
| `tabs` | Org layout navigation |
| `badge` | Role badges, item type badges, direction badges, expired status |
| `separator` | Visual dividers |
| `table` | Suites list, tests list, members list, invites list |
| `card` | Org cards on dashboard, info cards (API endpoint, model name), danger zone |
| `sonner` | Toast notifications |
| `skeleton` | Loading states for async boundaries |
| `tooltip` | Action button hints |

### Custom Components to Build

| Component | File | Type |
|-----------|------|------|
| `AppShell` | `src/components/app-shell.tsx` | Server |
| `AppHeader` | `src/components/app-header.tsx` | Client (dropdown needs state) |
| `UserMenu` | `src/components/user-menu.tsx` | Client |
| `OrgProvider` / `useOrg` | `src/components/org-provider.tsx` | Client |
| `OrgNav` | `src/components/org-nav.tsx` | Client (reads pathname for active tab) |
| `PageHeader` | `src/components/page-header.tsx` | Server |
| `ConfirmDialog` | `src/components/confirm-dialog.tsx` | Client |
| `ConfirmDeleteDialog` | `src/components/confirm-delete-dialog.tsx` | Client (with type-to-confirm) |
| `EmptyState` | `src/components/empty-state.tsx` | Server |
| `CopyButton` | `src/components/copy-button.tsx` | Client |
| `RelativeTime` | `src/components/relative-time.tsx` | Client (hydration-safe) |
| `TestItemList` | `src/components/test-item-list.tsx` | Client (expandable rows) |
| `TestItemEditor` | `src/components/test-item-editor/test-item-editor.tsx` | Client |
| `TestItemRow` | `src/components/test-item-editor/test-item-row.tsx` | Client |
| `ItemContentFields` | `src/components/test-item-editor/item-content-fields.tsx` | Client |
| `CreateOrgForm` | `src/app/(auth)/orgs/new/form.tsx` | Client |
| `CreateSuiteForm` | `src/app/(auth)/orgs/[orgId]/suites/new/form.tsx` | Client |
| `EditSuiteForm` | `src/app/(auth)/orgs/[orgId]/suites/[suiteId]/edit/form.tsx` | Client |
| `CreateTestForm` | `src/app/(auth)/orgs/[orgId]/suites/[suiteId]/tests/new/form.tsx` | Client |
| `EditTestForm` | `src/app/(auth)/orgs/[orgId]/suites/[suiteId]/tests/[testId]/edit/form.tsx` | Client |
| `MemberRoleSelect` | `src/app/(auth)/orgs/[orgId]/members/role-select.tsx` | Client |
| `InviteActions` | `src/app/(auth)/orgs/[orgId]/invites/invite-actions.tsx` | Client |

### Server Actions

All Server Actions live in a dedicated file per resource:

| File | Actions |
|------|---------|
| `src/actions/orgs.ts` | `createOrganization`, `updateOrganization`, `deleteOrganization` |
| `src/actions/suites.ts` | `createSuite`, `updateSuite`, `deleteSuite` |
| `src/actions/tests.ts` | `createTest`, `updateTest`, `deleteTest` |
| `src/actions/members.ts` | `updateMemberRole`, `removeMember` |
| `src/actions/invites.ts` | `createInvite`, `deleteInvite`, `acceptInvite` |

Each file starts with `"use server";` and exports async functions.

**Common pattern for all actions:**

```tsx
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionResult = { success: true } | { success: false; error: string };

export async function createOrganization(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  // 1. Extract and validate form data
  // 2. Perform Prisma operation
  // 3. revalidatePath or redirect
}
```

---

## 9. Implementation Order

Recommended sequence for the engineer:

| Phase | Tasks |
|-------|-------|
| **1. Foundation** | Run `shadcn init`. Install components. Set up `(auth)` layout with auth check, `AppShell`, `AppHeader`, `UserMenu`. Verify sign-out works. |
| **2. Dashboard** | Build dashboard page (org list), `EmptyState`, org `Card`s. Wire up `PageHeader`. |
| **3. Org CRUD** | Create Org form + Server Action. Org layout with tabs. Settings page (rename + delete). `ConfirmDialog` and `ConfirmDeleteDialog`. |
| **4. Suites CRUD** | Suites list, create, edit, delete. API endpoint info card with `CopyButton`. |
| **5. Tests list + detail** | Tests table on suite page. Test detail page with `TestItemList` (read-only view). Model name info card. |
| **6. Test Item Editor** | Build `TestItemEditor`, `TestItemRow`, `ItemContentFields`. Wire up create/edit test pages. |
| **7. Members** | Members page with role editing, member removal. |
| **8. Invites** | Invites page (admin only). Create/delete invites. `CopyButton` for URLs. Accept invite page. |
| **9. Polish** | Loading states (`Skeleton`), error boundaries, toast notifications, responsive tweaks. |

---

## Appendix A: API Response Shapes Reference

The Server Actions use Prisma directly, but for reference, here are the shapes returned by the existing API (matching what Prisma returns after formatting):

### Organization
```ts
{ id: string; name: string; slug: string; created_at: string; updated_at: string }
```

### Organization (from list, includes role)
```ts
{ id: string; name: string; slug: string; role: "admin" | "member"; created_at: string; updated_at: string }
```

### Member
```ts
{ id: string; user: { id: string; email: string; name: string }; role: "admin" | "member"; created_at: string }
```

### Invite
```ts
{ id: string; token: string; url: string; expires_at: string; created_at: string }
```

### Test Suite
```ts
{ id: string; org_id: string; name: string; description: string | null; created_at: string; updated_at: string }
```

### Test (list — no items)
```ts
{ id: string; test_suite_id: string; name: string; description: string | null; created_at: string; updated_at: string }
```

### Test (detail — with items)
```ts
{
  id: string;
  test_suite_id: string;
  name: string;
  description: string | null;
  items: Array<{
    id: string;
    position: number;
    type: "message" | "function_call" | "function_call_output";
    content: MessageContent | FunctionCallContent | FunctionCallOutputContent;
  }>;
  created_at: string;
  updated_at: string;
}
```

### Content Shapes
```ts
// message (input)
{ role: "user" | "system" | "developer"; content: string }

// message (output)
{ role: "assistant"; content: string }

// function_call
{ call_id: string; name: string; arguments: string }

// function_call_output
{ call_id: string; output: string }
```

---

## Appendix B: Middleware Consideration

The existing `middleware.ts` only protects `/api/*` routes. The `(auth)` layout handles auth checks for UI pages by calling `auth()` and redirecting. This is the recommended pattern for App Router — middleware remains focused on API protection.

However, if desired, the middleware matcher could be extended to also protect `/dashboard`, `/orgs/*`, and `/invite/*` routes for a defense-in-depth approach:

```ts
export const config = {
  matcher: ["/api/((?!auth/).*)", "/dashboard/:path*", "/orgs/:path*", "/invite/:path*"],
};
```

This is optional — the layout-level `auth()` check is sufficient.
