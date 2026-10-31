# Steady

A React recovery companion with optional Supabase account sync, community moderation, and Gemini-powered support chat.

## Development and verification

Use Node.js 24 or later. Run `npm ci`, `npm test`, then `npm run dev`. `npm run build` creates the static production bundle. GitHub Actions runs the test suite, build, dependency audit, and whitespace check on pull requests and changes to main.

Copy `.env.example` to `.env.local` for a different Supabase project. Only the project URL and publishable key belong in frontend environment variables. Service-role and AI provider keys stay in Supabase Edge Function secrets.

Tests include mounted React flows with simulated HTTP responses, Edge Function authentication and failure handling, and actual PostgreSQL RLS, trigger, quota, and concurrency checks through PGlite. They never send real support requests, delete live accounts, or make paid AI calls.

## Database and function release

For a new database, apply `supabase/schema.sql`, which includes the current security updates. On an existing Steady database, apply only unapplied files in `supabase/migrations/` in filename order. The migration filenames match the verified live migration history. The bootstrap is transactional and ends with the same security guarantees as the migrations.

The privacy/reliability migration requires the existing Steady tables. It adds a sanitized public feed maintained by a database trigger, owner-only identity/recovery access, transactional moderation logs, revision-checked saves, and persistent chat quotas. It does not delete user recovery records.

Deploy both `chat` and `delete-account` Edge Functions with their relative dependencies. The functions authenticate the bearer token themselves, so the gateway's legacy JWT verification is disabled. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by Supabase. Set `GEMINI_API_KEY` as a function secret; `GEMINI_MODEL` optionally overrides the default `gemini-3.8-flash` model. No secondary provider receives conversations when Gemini fails.

The database migration and functions must be available before publishing this frontend. This frontend uses the `revision` column and `save_recovery_data` RPC; a partially deployed backend must not be treated as a passing release. Verify live policies, the save RPC, unauthenticated-function rejection, and an authenticated staging session before promoting.

## Privacy and account behavior

Guests can use recovery tools and local support without AI or an account. Guest recovery progress is imported when a new account has no saved progress. Account-scoped browser backups preserve pending changes after session expiry without showing another account's private posts in the active store. The browser stores recovery data locally; use a trusted device and browser profile.

Account saves use a server revision. A conflict asks the user to choose which snapshot to keep instead of silently overwriting newer progress. Failed saves remain pending and can retry while Steady is open and online. Sign-out waits for pending saves and reports failures.

Public posts show the chosen name. Private posts are account-visible only to their owner; moderators see public/anonymous community posts and reports, not private recovery data. Removing an account requires server confirmation and deletes its profile, recovery data, posts, avatar files and associated report snapshots. Messages already delivered to external support or an AI provider cannot be recalled.

Beacon requires sign-in and explains Google Gemini processing before chat. Support requests use FormSubmit; cancellation aborts the client request, but cannot recall a request the service has already received. Undelivered requests remain queued on this device and retry while Steady is open and online.
