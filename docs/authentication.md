# Authentication

TestLLM has two API surfaces with different authentication requirements.

## Management API and UI

The Management API (`/api/...`) and the web UI require authentication via OIDC.

### OIDC Configuration

TestLLM is configured with an independent OIDC provider. The following environment variables configure the OIDC integration:

| Variable | Description |
|----------|-------------|
| `OIDC_ISSUER` | OIDC issuer URL (e.g., `https://auth.example.com`) |
| `OIDC_CLIENT_ID` | Client ID registered with the OIDC provider |
| `OIDC_CLIENT_SECRET` | Client secret |

### Authentication Flow

1. User accesses the web UI or Management API.
2. Unauthenticated requests are redirected to the OIDC provider's authorization endpoint.
3. After successful authentication, the provider redirects back with an authorization code.
4. TestLLM exchanges the code for ID and access tokens.
5. The `sub` claim from the ID token is used to identify the user. If no User record exists, one is created automatically (auto-provisioning).
6. A session is established.

### User Auto-Provisioning

On first OIDC login, TestLLM creates a User record from the ID token claims:

| ID Token Claim | User Field |
|---------------|------------|
| `sub` | `oidc_subject` |
| `email` | `email` |
| `name` | `name` |

### Authorization

After authentication, authorization is based on organization membership and role:

| Action | Required Role |
|--------|--------------|
| Create organization | Any authenticated user |
| Manage members and invites | `admin` |
| Update/delete organization | `admin` |
| CRUD test suites and tests | `admin` or `member` |
| Read test suites and tests | `admin` or `member` |

Users who are not members of an organization cannot access any of its resources.

## Responses API

The Responses API (`/v1/org/{orgSlug}/suite/{suiteName}/responses`) requires **no authentication**. It is designed to be called by agents through the LLM service proxy, which injects a Bearer token from the LLM Provider configuration. TestLLM ignores any `Authorization` header on this endpoint.

This simplifies integration — the LLM Provider resource can be configured with any token value (or an empty string), and TestLLM will accept the request regardless.
