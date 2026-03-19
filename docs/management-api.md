# Management API

The Management API provides CRUD operations for all TestLLM resources. It is used by the web UI and can be called directly. All Management API endpoints require OIDC authentication (see [Authentication](authentication.md)).

## Base URL

```
/api
```

## Organizations

### Create Organization

```
POST /api/orgs
```

**Request:**

```json
{
  "name": "My Team",
  "slug": "my-team"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `slug` | string | yes | URL-safe identifier, unique globally |

**Response:** `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Team",
  "slug": "my-team",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

The authenticated user becomes the `admin` of the new organization.

### List Organizations

Returns organizations the authenticated user is a member of.

```
GET /api/orgs
```

**Response:** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Team",
    "slug": "my-team",
    "role": "admin",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
]
```

### Get Organization

```
GET /api/orgs/{orgId}
```

**Response:** `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Team",
  "slug": "my-team",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### Update Organization

```
PATCH /api/orgs/{orgId}
```

**Request:**

```json
{
  "name": "My Renamed Team"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | New display name |

**Response:** `200 OK` — updated organization.

**Authorization:** `admin` role required.

### Delete Organization

```
DELETE /api/orgs/{orgId}
```

**Response:** `204 No Content`

Deletes the organization and all its test suites, tests, memberships, and invites.

**Authorization:** `admin` role required.

---

## Members

### List Members

```
GET /api/orgs/{orgId}/members
```

**Response:** `200 OK`

```json
[
  {
    "id": "membership-uuid",
    "user": {
      "id": "user-uuid",
      "email": "alice@example.com",
      "name": "Alice"
    },
    "role": "admin",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

### Update Member Role

```
PATCH /api/orgs/{orgId}/members/{membershipId}
```

**Request:**

```json
{
  "role": "admin"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | enum | yes | `admin` or `member` |

**Response:** `200 OK` — updated membership.

**Authorization:** `admin` role required.

### Remove Member

```
DELETE /api/orgs/{orgId}/members/{membershipId}
```

**Response:** `204 No Content`

**Authorization:** `admin` role required. An admin cannot remove themselves if they are the last admin.

---

## Invites

### Create Invite

```
POST /api/orgs/{orgId}/invites
```

**Request:** Empty body.

**Response:** `201 Created`

```json
{
  "id": "invite-uuid",
  "token": "random-token-string",
  "url": "https://testllm.example.com/invite/random-token-string",
  "expires_at": "2025-01-16T10:00:00Z",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Authorization:** `admin` role required.

### Accept Invite

```
POST /api/invites/{token}/accept
```

The authenticated user is added to the organization as a `member`. The invite is deleted.

**Response:** `200 OK`

```json
{
  "org_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "member"
}
```

**Errors:**

| Condition | HTTP Status | Description |
|-----------|-------------|-------------|
| Token not found | 404 | Invite does not exist |
| Token expired | 410 | Invite has expired |
| Already a member | 409 | User is already a member of the organization |

### List Invites

```
GET /api/orgs/{orgId}/invites
```

**Response:** `200 OK`

```json
[
  {
    "id": "invite-uuid",
    "token": "random-token-string",
    "url": "https://testllm.example.com/invite/random-token-string",
    "expires_at": "2025-01-16T10:00:00Z",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

**Authorization:** `admin` role required.

### Delete Invite

```
DELETE /api/orgs/{orgId}/invites/{inviteId}
```

**Response:** `204 No Content`

**Authorization:** `admin` role required.

---

## Test Suites

### Create Test Suite

```
POST /api/orgs/{orgId}/suites
```

**Request:**

```json
{
  "name": "agent-weather",
  "description": "Weather agent test scenarios"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name, unique within the organization |
| `description` | string | no | Optional description |

**Response:** `201 Created`

```json
{
  "id": "suite-uuid",
  "org_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "agent-weather",
  "description": "Weather agent test scenarios",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### List Test Suites

```
GET /api/orgs/{orgId}/suites
```

**Response:** `200 OK` — array of test suites.

### Get Test Suite

```
GET /api/orgs/{orgId}/suites/{suiteId}
```

**Response:** `200 OK`

### Update Test Suite

```
PATCH /api/orgs/{orgId}/suites/{suiteId}
```

**Request:**

```json
{
  "name": "agent-weather-v2",
  "description": "Updated description"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | New name |
| `description` | string | no | New description |

**Response:** `200 OK` — updated test suite.

### Delete Test Suite

```
DELETE /api/orgs/{orgId}/suites/{suiteId}
```

**Response:** `204 No Content`

Deletes the test suite and all its tests.

---

## Tests

### Create Test

```
POST /api/orgs/{orgId}/suites/{suiteId}/tests
```

**Request:**

```json
{
  "name": "happy-path",
  "description": "Agent correctly reports weather",
  "items": [
    {
      "type": "message",
      "content": {
        "role": "system",
        "content": "You are a weather assistant."
      }
    },
    {
      "type": "message",
      "content": {
        "role": "user",
        "content": "What is the weather in San Francisco?"
      }
    },
    {
      "type": "function_call",
      "content": {
        "call_id": "call_abc123",
        "name": "get_weather",
        "arguments": "{\"location\":\"San Francisco\"}"
      }
    },
    {
      "type": "function_call_output",
      "content": {
        "call_id": "call_abc123",
        "output": "{\"temperature\":65,\"condition\":\"sunny\"}"
      }
    },
    {
      "type": "message",
      "content": {
        "role": "assistant",
        "content": "The weather in San Francisco is 65°F and sunny."
      }
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Test name, unique within the test suite. Used as model name in Responses API requests. |
| `description` | string | no | Optional description |
| `items` | array | yes | Ordered sequence of test items |
| `items[].type` | enum | yes | `message`, `function_call`, or `function_call_output` |
| `items[].content` | object | yes | Item content, structure depends on type (see [Data Model](data-model.md#item-types)) |

Items are stored with `position` assigned from their array index (0-based).

**Response:** `201 Created`

```json
{
  "id": "test-uuid",
  "test_suite_id": "suite-uuid",
  "name": "happy-path",
  "description": "Agent correctly reports weather",
  "items": [
    {
      "id": "item-uuid-0",
      "position": 0,
      "type": "message",
      "content": {
        "role": "system",
        "content": "You are a weather assistant."
      }
    },
    {
      "id": "item-uuid-1",
      "position": 1,
      "type": "message",
      "content": {
        "role": "user",
        "content": "What is the weather in San Francisco?"
      }
    },
    {
      "id": "item-uuid-2",
      "position": 2,
      "type": "function_call",
      "content": {
        "call_id": "call_abc123",
        "name": "get_weather",
        "arguments": "{\"location\":\"San Francisco\"}"
      }
    },
    {
      "id": "item-uuid-3",
      "position": 3,
      "type": "function_call_output",
      "content": {
        "call_id": "call_abc123",
        "output": "{\"temperature\":65,\"condition\":\"sunny\"}"
      }
    },
    {
      "id": "item-uuid-4",
      "position": 4,
      "type": "message",
      "content": {
        "role": "assistant",
        "content": "The weather in San Francisco is 65°F and sunny."
      }
    }
  ],
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### List Tests

```
GET /api/orgs/{orgId}/suites/{suiteId}/tests
```

**Response:** `200 OK` — array of tests (without items).

```json
[
  {
    "id": "test-uuid",
    "test_suite_id": "suite-uuid",
    "name": "happy-path",
    "description": "Agent correctly reports weather",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
]
```

### Get Test

```
GET /api/orgs/{orgId}/suites/{suiteId}/tests/{testId}
```

**Response:** `200 OK` — test with items included.

### Update Test

```
PATCH /api/orgs/{orgId}/suites/{suiteId}/tests/{testId}
```

**Request:**

```json
{
  "name": "happy-path-v2",
  "description": "Updated description",
  "items": [...]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | New test name |
| `description` | string | no | New description |
| `items` | array | no | Full replacement of the item sequence. If provided, all existing items are deleted and replaced. |

When `items` is provided, it is a full replacement — not a partial update. This avoids complexity of position reordering and partial item edits.

**Response:** `200 OK` — updated test with items.

### Delete Test

```
DELETE /api/orgs/{orgId}/suites/{suiteId}/tests/{testId}
```

**Response:** `204 No Content`

Deletes the test and all its items.
