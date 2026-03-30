# Management API

The Management API provides CRUD operations for all TestLLM resources. It is used by the web UI and can be called directly. Management API endpoints require authentication via OIDC sessions or API tokens (see [Authentication](authentication.md)). Token management endpoints are session-only.

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

Returns organizations accessible to the caller. For session and personal token
auth, returns all organizations the user is a member of. For org tokens,
returns the single organization the token is scoped to.

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

## Personal Tokens

### Create Personal Token

```
POST /api/user/tokens
```

**Request:**

```json
{
  "name": "CI token",
  "expires_at": "2025-01-16T10:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Token display name |
| `expires_at` | string (datetime) | no | Optional expiration timestamp |

**Response:** `201 Created`

```json
{
  "id": "token-uuid",
  "name": "CI token",
  "token": "tlp_0123456789abcdef0123456789abcdef",
  "token_prefix": "tlp_0123",
  "expires_at": "2025-01-16T10:00:00Z",
  "created_at": "2025-01-15T10:00:00Z"
}
```

The raw token is returned only once.

**Authorization:** OIDC session required.

### List Personal Tokens

```
GET /api/user/tokens
```

**Response:** `200 OK`

```json
[
  {
    "id": "token-uuid",
    "name": "CI token",
    "token_prefix": "tlp_0123",
    "expires_at": "2025-01-16T10:00:00Z",
    "last_used_at": "2025-01-15T12:00:00Z",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

**Authorization:** OIDC session required.

### Delete Personal Token

```
DELETE /api/user/tokens/{tokenId}
```

**Response:** `204 No Content`

**Authorization:** OIDC session required.

---

## Organization Tokens

### Create Organization Token

```
POST /api/orgs/{orgId}/tokens
```

**Request:**

```json
{
  "name": "Terraform",
  "role": "admin",
  "expires_at": "2025-01-16T10:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Token display name |
| `role` | enum | yes | `admin` or `member` |
| `expires_at` | string (datetime) | no | Optional expiration timestamp |

**Response:** `201 Created`

```json
{
  "id": "token-uuid",
  "name": "Terraform",
  "role": "admin",
  "token": "tlo_0123456789abcdef0123456789abcdef",
  "token_prefix": "tlo_0123",
  "expires_at": "2025-01-16T10:00:00Z",
  "created_at": "2025-01-15T10:00:00Z"
}
```

The raw token is returned only once.

**Authorization:** OIDC session required (`admin` role).

### List Organization Tokens

```
GET /api/orgs/{orgId}/tokens
```

**Response:** `200 OK`

```json
[
  {
    "id": "token-uuid",
    "name": "Terraform",
    "role": "admin",
    "token_prefix": "tlo_0123",
    "expires_at": "2025-01-16T10:00:00Z",
    "last_used_at": "2025-01-15T12:00:00Z",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

**Authorization:** OIDC session required (`admin` role).

### Delete Organization Token

```
DELETE /api/orgs/{orgId}/tokens/{tokenId}
```

**Response:** `204 No Content`

**Authorization:** OIDC session required (`admin` role).

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

---

## Test Runs

Test runs are created lazily via the [run-tracking Responses API path](responses-api.md#run-tracking-path). The Management API provides read access and optional metadata updates.

### List Test Runs

```
GET /api/orgs/{orgId}/runs
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cursor` | string (UUID) | no | Cursor for pagination (run ID from previous page) |
| `limit` | integer | no | Page size, 1–100 (default: 20) |

**Response:** `200 OK`

```json
{
  "runs": [
    {
      "id": "run-uuid",
      "org_id": "org-uuid",
      "name": null,
      "commit_sha": null,
      "branch": null,
      "created_at": "2025-01-15T10:00:00Z",
      "tests_total": 50,
      "tests_passed": 48,
      "tests_failed": 2,
      "started_at": "2025-01-15T10:00:01Z",
      "finished_at": "2025-01-15T10:02:30Z"
    }
  ],
  "next_cursor": "run-uuid-2"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Run ID |
| `org_id` | UUID | Organization ID |
| `name` | string or null | Optional display name |
| `commit_sha` | string or null | Optional Git commit SHA |
| `branch` | string or null | Optional Git branch |
| `created_at` | string (datetime) | Run creation time |
| `tests_total` | integer | Count of distinct `client_test_name` values in the run |
| `tests_passed` | integer | Tests where all response logs have `status = 'success'` |
| `tests_failed` | integer | Tests where any response log has `status = 'error'` |
| `started_at` | string (datetime) or null | Earliest response log timestamp. `null` if no logs. |
| `finished_at` | string (datetime) or null | Latest response log timestamp. `null` if no logs. |
| `next_cursor` | string (UUID) or null | Cursor for the next page. `null` if no more results. |

Runs are ordered by `created_at` descending (most recent first).

### Get Test Run

```
GET /api/orgs/{orgId}/runs/{runId}
```

**Response:** `200 OK`

```json
{
  "id": "run-uuid",
  "org_id": "org-uuid",
  "name": "CI Run #1234",
  "commit_sha": "abc123def456",
  "branch": "main",
  "created_at": "2025-01-15T10:00:00Z",
  "tests_total": 50,
  "tests_passed": 48,
  "tests_failed": 2,
  "started_at": "2025-01-15T10:00:01Z",
  "finished_at": "2025-01-15T10:02:30Z",
  "test_executions": [
    {
      "client_test_name": "test_weather_agent_responds",
      "status": "passed",
      "call_count": 2,
      "suites_used": ["agent-weather"],
      "first_error": null,
      "started_at": "2025-01-15T10:00:01Z",
      "finished_at": "2025-01-15T10:00:03Z"
    },
    {
      "client_test_name": "test_weather_agent_unknown_city",
      "status": "failed",
      "call_count": 1,
      "suites_used": ["agent-weather"],
      "first_error": {
        "code": "input_mismatch",
        "message": "Input mismatch at position 1: expected message with role 'user'..."
      },
      "started_at": "2025-01-15T10:00:05Z",
      "finished_at": "2025-01-15T10:00:05Z"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `test_executions` | array | Grouped by `client_test_name`, ordered by `started_at` ascending |
| `test_executions[].client_test_name` | string | The client-side test identifier |
| `test_executions[].status` | string | `"passed"` or `"failed"` |
| `test_executions[].call_count` | integer | Number of Responses API calls made by this test |
| `test_executions[].suites_used` | array of strings | Distinct suite names referenced in the calls |
| `test_executions[].first_error` | object or null | First error encountered: `{ "code": "...", "message": "..." }`. `null` if passed. |
| `test_executions[].started_at` | string (datetime) | Earliest response log timestamp for this test |
| `test_executions[].finished_at` | string (datetime) | Latest response log timestamp for this test |

All other fields are the same as in the [list response](#list-test-runs).

### Update Test Run

```
PATCH /api/orgs/{orgId}/runs/{runId}
```

Sets optional metadata on a test run. Typically called by the CI runner after the run is created.

**Request:**

```json
{
  "name": "CI Run #1234",
  "commit_sha": "abc123def456",
  "branch": "main"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Display name (min 1 character) |
| `commit_sha` | string | no | Git commit SHA (min 1 character) |
| `branch` | string | no | Git branch name (min 1 character) |

**Response:** `200 OK`

```json
{
  "id": "run-uuid",
  "org_id": "org-uuid",
  "name": "CI Run #1234",
  "commit_sha": "abc123def456",
  "branch": "main",
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

## Response Logs

Response logs are created automatically by the [run-tracking Responses API path](responses-api.md#run-tracking-path). The Management API provides read-only access.

### List Response Logs

```
GET /api/orgs/{orgId}/runs/{runId}/logs
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cursor` | string (UUID) | no | Cursor for pagination (log ID from previous page) |
| `limit` | integer | no | Page size, 1–100 (default: 50) |
| `client_test_name` | string | no | Filter by client test name |
| `status` | enum | no | Filter by status: `success` or `error` |

**Response:** `200 OK`

```json
{
  "logs": [
    {
      "id": "log-uuid",
      "run_id": "run-uuid",
      "status": "success",
      "org_slug": "my-org",
      "suite_name": "agent-weather",
      "model": "happy-path",
      "client_test_name": "test_weather_agent_responds",
      "stream": false,
      "suite_id": "suite-uuid",
      "test_id": "test-uuid",
      "response_id": "resp_abc123",
      "error_code": null,
      "error_message": null,
      "duration_ms": 12,
      "created_at": "2025-01-15T10:00:01Z"
    }
  ],
  "next_cursor": "log-uuid-2"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Log ID |
| `run_id` | UUID | Parent test run ID |
| `status` | enum | `success` or `error` |
| `org_slug` | string | Organization slug from the request path |
| `suite_name` | string | Test suite name from the request path |
| `model` | string | Model (test name) from the request body |
| `client_test_name` | string | Client-side test identifier from the request path |
| `stream` | boolean | Whether streaming was requested |
| `suite_id` | UUID or null | Resolved test suite ID. `null` if suite was not found. |
| `test_id` | UUID or null | Resolved test ID. `null` if test was not found. |
| `response_id` | string or null | Response ID from the response payload. `null` on error. |
| `error_code` | string or null | Error code. `null` on success. |
| `error_message` | string or null | Error message. `null` on success. |
| `duration_ms` | integer | Matching duration in milliseconds |
| `created_at` | string (datetime) | Log creation time |
| `next_cursor` | string (UUID) or null | Cursor for the next page. `null` if no more results. |

The list endpoint omits `input` and `output` fields to keep payloads small. Use the [detail endpoint](#get-response-log) for full data.

Logs are ordered by `created_at` descending (most recent first).

### Get Response Log

```
GET /api/orgs/{orgId}/runs/{runId}/logs/{logId}
```

**Response:** `200 OK`

```json
{
  "id": "log-uuid",
  "run_id": "run-uuid",
  "status": "success",
  "org_slug": "my-org",
  "suite_name": "agent-weather",
  "model": "happy-path",
  "client_test_name": "test_weather_agent_responds",
  "input": [
    {
      "role": "system",
      "content": "You are a weather assistant."
    },
    {
      "role": "user",
      "content": "What is the weather in San Francisco?"
    }
  ],
  "stream": false,
  "suite_id": "suite-uuid",
  "test_id": "test-uuid",
  "output": {
    "id": "resp_abc123",
    "object": "response",
    "created_at": 1700000000,
    "model": "happy-path",
    "output": [
      {
        "id": "fc_def456",
        "type": "function_call",
        "call_id": "call_abc123",
        "name": "get_weather",
        "arguments": "{\"location\":\"San Francisco\"}",
        "status": "completed"
      }
    ],
    "status": "completed"
  },
  "response_id": "resp_abc123",
  "error_code": null,
  "error_message": null,
  "duration_ms": 12,
  "created_at": "2025-01-15T10:00:01Z"
}
```

The detail endpoint includes `input` and `output` fields — the full request input and response payload.

For error logs, `output` is `null` and `error_code`/`error_message` describe the failure:

```json
{
  "id": "log-uuid",
  "run_id": "run-uuid",
  "status": "error",
  "org_slug": "my-org",
  "suite_name": "agent-weather",
  "model": "wrong-test-name",
  "client_test_name": "test_weather_agent_responds",
  "input": [
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "stream": false,
  "suite_id": "suite-uuid",
  "test_id": null,
  "output": null,
  "response_id": null,
  "error_code": "model_not_found",
  "error_message": "Model 'wrong-test-name' not found in suite 'agent-weather'",
  "duration_ms": 3,
  "created_at": "2025-01-15T10:00:02Z"
}
```
