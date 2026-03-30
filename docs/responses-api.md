# Responses API

The Responses API endpoint is the core of TestLLM. It implements the OpenAI Responses API protocol, accepting the same request format and returning the same response format — but backed by predefined test sequences instead of a real LLM.

## Endpoint

```
POST /v1/org/{orgSlug}/suite/{suiteName}/responses
```

| Path Parameter | Type | Description |
|---------------|------|-------------|
| `orgSlug` | string | Organization slug |
| `suiteName` | string | Test suite name |

**Authentication:** None. The Responses API is unauthenticated — callers (agents via the LLM service proxy) do not need credentials.

## Request

The request body follows the OpenAI Responses API `create` format. TestLLM uses two fields from the request:

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | The test name within the test suite. Used to look up the test. |
| `input` | string or array | Input items. A string is treated as a single user message. An array contains message, function_call, and function_call_output items. |

All other fields in the request (`tools`, `temperature`, `instructions`, `text`, etc.) are accepted but ignored. This ensures compatibility with any OpenAI client configuration — the service does not reject unknown fields.

### Example Request

```json
{
  "model": "weather-agent-happy-path",
  "input": [
    {
      "role": "system",
      "content": "You are a weather assistant."
    },
    {
      "role": "user",
      "content": "What is the weather in San Francisco?"
    }
  ]
}
```

## Matching Algorithm

On each request, the service:

1. **Resolves the test** — looks up the test by `model` (test name) within the specified organization and test suite (from the URL path).
2. **Normalizes input** — if `input` is a string, wraps it as `[{"role": "user", "content": "<string>"}]`.
3. **Loads the test sequence** — retrieves all test items ordered by `position`.
4. **Extracts the expected input prefix** — collects consecutive input items from the beginning of the sequence up to (but not including) the first output item that has not yet been matched by prior input.
5. **Compares** — performs exact match of the request input items against the expected input prefix. Comparison rules:
   - **Message items**: `role` and `content` must match exactly.
   - **Function call items**: `type`, `call_id`, `name`, and `arguments` must match exactly.
   - **Function call output items**: `type`, `call_id`, and `output` must match exactly.
6. **Returns output** — if the input matches, returns all consecutive output items immediately following the matched prefix.

### Matching Walk-Through

Given a test sequence:

| Pos | Type | Dir | Content |
|-----|------|-----|---------|
| 0 | `message` | input | `system`: "You are a weather assistant." |
| 1 | `message` | input | `user`: "What is the weather in SF?" |
| 2 | `function_call` | output | `get_weather({"location":"SF"})` |
| 3 | `function_call_output` | input | `{"temperature":65}` |
| 4 | `message` | output | `assistant`: "It's 65°F in SF." |

**Request 1** — input: `[system msg, user msg]`

- Expected input prefix: positions 0–1 (all input items before first output).
- Match: exact ✓
- Return: position 2 (`function_call`). Only position 2 is returned because position 3 is an input item (the next turn starts with caller-provided data).

**Request 2** — input: `[system msg, user msg, function_call, function_call_output]`

- Expected input prefix: positions 0–3 (all input items before the next unmatched output).
- Match: exact ✓
- Return: position 4 (`assistant message`).

### Multiple Output Items

A single turn may produce multiple output items. For example, the model may return a message and a function call together, or multiple function calls. All consecutive output items following the matched input prefix are returned in a single response.

## Response

The response follows the OpenAI Responses API response format.

### Success Response

```json
{
  "id": "resp_<generated-uuid>",
  "object": "response",
  "created_at": 1700000000,
  "model": "weather-agent-happy-path",
  "output": [
    {
      "id": "fc_<generated-uuid>",
      "type": "function_call",
      "call_id": "call_abc123",
      "name": "get_weather",
      "arguments": "{\"location\":\"San Francisco\"}",
      "status": "completed"
    }
  ],
  "status": "completed"
}
```

When output items are messages:

```json
{
  "id": "resp_<generated-uuid>",
  "object": "response",
  "created_at": 1700000000,
  "model": "weather-agent-happy-path",
  "output": [
    {
      "id": "msg_<generated-uuid>",
      "type": "message",
      "role": "assistant",
      "status": "completed",
      "content": [
        {
          "type": "output_text",
          "text": "The weather in San Francisco is 65°F and sunny.",
          "annotations": []
        }
      ]
    }
  ],
  "status": "completed"
}
```

### Output Item Formatting

TestItem content is stored in a simplified format (see [Data Model](data-model.md)). The Responses API endpoint transforms items into the full OpenAI response format:

| TestItem type | Response output format |
|--------------|----------------------|
| `message` (assistant) | `{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "..."}], "status": "completed"}` |
| `function_call` | `{"type": "function_call", "call_id": "...", "name": "...", "arguments": "...", "status": "completed"}` |

## Error Handling

All errors use the OpenAI error response format:

```json
{
  "error": {
    "message": "...",
    "type": "...",
    "code": "..."
  }
}
```

### Error Cases

| Condition | HTTP Status | Error Type | Error Code | Message |
|-----------|-------------|------------|------------|---------|
| Organization not found | 404 | `not_found_error` | `org_not_found` | `Organization '{orgSlug}' not found` |
| Test suite not found | 404 | `not_found_error` | `suite_not_found` | `Test suite '{suiteName}' not found in organization '{orgSlug}'` |
| Test (model) not found | 404 | `not_found_error` | `model_not_found` | `Model '{model}' not found in suite '{suiteName}'` |
| Input mismatch | 400 | `invalid_request_error` | `input_mismatch` | Detailed mismatch description (see below) |
| Input extends beyond test sequence | 400 | `invalid_request_error` | `sequence_exhausted` | `Input extends beyond the defined test sequence` |

### Mismatch Error Detail

When input does not match the expected prefix, the error message includes:
- The position where the mismatch occurred.
- The expected item at that position.
- The actual item received.

```json
{
  "error": {
    "message": "Input mismatch at position 1: expected message with role 'user' and content 'What is the weather in SF?', got message with role 'user' and content 'What is the weather in New York?'",
    "type": "invalid_request_error",
    "code": "input_mismatch"
  }
}
```

## Integration with Platform

TestLLM integrates with the Agyn platform through the standard LLM provider mechanism:

1. **Create an LLM Provider** in the platform with `endpoint` set to the TestLLM base URL (e.g., `https://testllm.example.com/v1/org/my-org/suite/my-suite`).
2. **Create a Model** with `remoteName` set to the test name (e.g., `weather-agent-happy-path`).
3. **Create or configure an Agent** to use the model.

The LLM service proxies the agent's Responses API request to TestLLM, replacing the model ID with the remote name. TestLLM matches the input and returns the scripted response. The agent behaves exactly as it would with a real LLM — but deterministically.

```mermaid
flowchart LR
    A[Agent] -->|"model: internal-id"| LLM[LLM Service]
    LLM -->|"model: weather-agent-happy-path"| TL[TestLLM<br/>/v1/org/.../suite/.../responses]
    TL -->|scripted response| LLM
    LLM -->|response| A
```

## Run-Tracking Path

TestLLM provides an alternative Responses API path that tracks calls within a test run. This path uses the same matching logic as the standard endpoint but additionally creates a test run (lazily) and records every call as a response log.

### Endpoint

```
POST /v1/org/{orgSlug}/suite/{suiteName}/run/{runId}/test/{clientTestName}/responses
```

| Path Parameter | Type | Description |
|---------------|------|-------------|
| `orgSlug` | string | Organization slug |
| `suiteName` | string | Test suite name |
| `runId` | string (UUID) | Client-generated run identifier. Must be a valid UUID. |
| `clientTestName` | string | Client-side test name. Identifies which test in the caller's test suite is making the call. URL-encoded. |

**Authentication:** None. Same as the standard Responses API path.

### Request

The request body is identical to the [standard Responses API request](#request). The `model` and `input` fields are used for matching; all other fields are accepted but ignored.

### Behavior

On each request, the run-tracking path:

1. **Validates path parameters** — `runId` must be a valid UUID; `clientTestName` must be non-empty after URL decoding. Invalid parameters return a `400` error in OpenAI format.
2. **Resolves the organization** — looks up the organization by `orgSlug`. If not found, returns `404` (no log is created).
3. **Ensures the test run exists** — attempts to create a `TestRun` with the given `runId` and the resolved `org_id`. If the run already exists (unique constraint conflict), verifies the existing run belongs to the same organization. If the org doesn't match, returns `404`.
4. **Executes standard matching** — the same matching algorithm as the standard path (resolve suite → resolve test → match input → return output).
5. **Records a response log** — after matching completes (success or failure), a `ResponseLog` is created via fire-and-forget (non-blocking, failures are logged to console but do not affect the response).
6. **Returns the response** — identical response format to the standard path.

### Lazy TestRun Creation

The TestRun record is created on the first Responses API call that references the `runId`. Subsequent calls with the same `runId` reuse the existing record. The caller generates the UUID — this allows the CI runner to generate a run ID upfront and pass it to all test cases.

The TestRun is created with only `id` and `org_id`. Optional metadata (`name`, `commit_sha`, `branch`) can be set later via the Management API `PATCH /api/orgs/{orgId}/runs/{runId}` endpoint.

### Recording Rules

A response log is created when **all** of the following conditions are met:

1. The request is on the run-tracking path.
2. `runId` is a valid UUID.
3. `clientTestName` is non-empty after URL decoding.
4. The organization exists.
5. The TestRun upsert succeeded (org matches).
6. The request body passes JSON and schema validation (valid `model` and `input`).

If any of these preconditions fail, no log is recorded — the endpoint returns an error directly.

### What Gets Recorded

| Outcome | Fields populated | Error fields |
|---------|-----------------|-------------|
| **Success** (input matched) | `suite_id`, `test_id`, `output`, `response_id` | `NULL` |
| **Suite not found** | `suite_id` = `NULL`, `test_id` = `NULL` | `error_code`, `error_message` set |
| **Model not found** | `suite_id` set, `test_id` = `NULL` | `error_code`, `error_message` set |
| **Input mismatch / sequence exhausted** | `suite_id` set, `test_id` set | `error_code`, `error_message` set |

### Response

The response format is identical to the [standard Responses API](#response) — both for success and error cases. The caller cannot distinguish between the two paths from the response alone.

### Backward Compatibility

The standard path (`POST /v1/org/{orgSlug}/suite/{suiteName}/responses`) is unchanged. It performs no logging and requires no run ID. Existing integrations are unaffected.

### Path-Specific Errors

In addition to the [standard error cases](#error-cases), the run-tracking path may return:

| Condition | HTTP Status | Error Type | Error Code | Message |
|-----------|-------------|------------|------------|---------|
| `runId` is not a valid UUID | 400 | `invalid_request_error` | `invalid_run_id` | `runId must be a valid UUID` |
| `clientTestName` is empty | 400 | `invalid_request_error` | `invalid_client_test_name` | `clientTestName must be provided` |
| Run exists but belongs to a different org | 404 | `not_found_error` | `run_not_found` | `Test run '{runId}' not found` |

### Integration with Platform

When using run tracking, configure the LLM Provider endpoint to include the run and test path segments:

```
https://testllm.example.com/v1/org/my-org/suite/my-suite/run/{runId}/test/{clientTestName}
```

The CI test runner generates a UUID for `runId` at the start of the test execution and uses the test's own name as `clientTestName`. All Responses API calls from all tests in the run share the same `runId`, allowing TestLLM to group them.
