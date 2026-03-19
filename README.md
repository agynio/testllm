# TestLLM

Deterministic LLM service for end-to-end testing of AI agents.

TestLLM exposes an OpenAI-compatible Responses API backed by predefined conversation sequences. Point your agents at TestLLM instead of a real LLM provider to make agent behavior fully deterministic and assertable in E2E tests.

## Documentation

- [Overview](docs/overview.md) — problem, solution, architecture
- [Data Model](docs/data-model.md) — database entities, relationships, item types
- [Responses API](docs/responses-api.md) — OpenAI-compatible endpoint, matching algorithm, error handling
- [Management API](docs/management-api.md) — CRUD for organizations, test suites, tests, user management
- [Authentication](docs/authentication.md) — OIDC for management, no auth for Responses API
