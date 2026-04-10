# Messages API (Anthropic-compatible)

## Overview

The Messages API provides an Anthropic-compatible endpoint for deterministic message replay. Each request is matched against a predefined test sequence stored in TestLLM. When inputs match, the next assistant message in the sequence is returned.

## Endpoints

```
POST /v1/org/{orgSlug}/suite/{suiteName}/messages
POST /v1/org/{orgSlug}/suite/{suiteName}/run/{runId}/test/{clientTestName}/messages
```

The run-tracking path behaves identically but records a response log for observability.

## Request Format

The request body mirrors the Anthropic Messages API shape. Only the fields below are required for matching; additional fields are accepted and ignored.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | yes | Test name within the suite |
| `max_tokens` | number | yes | Maximum tokens for the response |
| `system` | string \| array | no | System prompt (string or content blocks) |
| `messages` | array | yes | User/assistant message history |
| `stream` | boolean | no | Enable SSE streaming |

Message content may be a string or a list of content blocks. Supported content block types are `text`, `tool_use`, and `tool_result`.

## Matching Algorithm

Test suites configured with the `anthropic` protocol use two item types:

- `anthropic_system`: a system prompt stored as `{ "text": "..." }` or `{ "blocks": [ ... ] }`.
- `anthropic_message`: a message with `role` (`user` or `assistant`) and `content` (string or content blocks).

Matching rules:

1. Iterate the stored test items in order.
2. `anthropic_system` items must match the request `system` prompt exactly.
3. `anthropic_message` items with `role: user` must match the next request message.
4. `anthropic_message` items with `role: assistant`:
   - If the request has no remaining messages, this is the output boundary and the assistant message is returned.
   - If the request includes a matching assistant message, matching continues (multi-turn history).

If the input diverges, the request returns an error.

## Response Format

On success, TestLLM returns a Message object with a deterministic `id` and zeroed token usage:

```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "model": "weather-test",
  "content": [
    { "type": "text", "text": "It is 65F." }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": { "input_tokens": 0, "output_tokens": 0 }
}
```

`stop_reason` is `tool_use` whenever the response includes a `tool_use` block; otherwise it is `end_turn`.

## Streaming

When `stream: true`, the endpoint returns `text/event-stream` with the Anthropic event sequence:

```
message_start -> content_block_start -> content_block_delta -> content_block_stop -> message_delta -> message_stop
```

Each event payload includes a `type` field matching the event name. Text blocks emit `text_delta` updates. Tool-use blocks emit `input_json_delta` updates containing the serialized tool input.

## Error Handling

Errors return Anthropic-style payloads:

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Missing required field: model"
  }
}
```

Error types and status codes:

| Condition | Status | Error Type | Example Message |
|-----------|--------|------------|-----------------|
| Organization not found | 404 | `not_found_error` | `Organization '{orgSlug}' not found` |
| Suite not found | 404 | `not_found_error` | `Test suite '{suiteName}' not found in organization '{orgSlug}'` |
| Model not found | 404 | `not_found_error` | `Model '{model}' not found in suite '{suiteName}'` |
| Invalid JSON | 400 | `invalid_request_error` | `Invalid JSON body` |
| Missing required field | 400 | `invalid_request_error` | `Missing required field: model` |
| Input mismatch | 400 | `invalid_request_error` | `Input mismatch at position 2: expected role 'user', got 'assistant'` |
| Sequence exhausted | 400 | `invalid_request_error` | `Input extends beyond the defined test sequence` |

## Run Tracking

The run-tracking endpoint (`/run/{runId}/test/{clientTestName}/messages`) records a response log for every call. Logs include the input payload, output payload, timing, and error metadata, and can be inspected via the Management API.
