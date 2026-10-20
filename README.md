# pOS — Property Operating System

pOS is a React + TypeScript + Vite application. The original sage-and-stone dashboard is preserved as the signed-in shell. This milestone adds a Supabase authentication gate and the first shared-workspace security foundation. **Dashboard amounts and resident/payment rows remain illustrative sample data, not cloud records.**

## Architecture and trust boundaries

- **Authentication:** Supabase Auth manages sign-up, email confirmation (depending on project settings), sign-in, password-reset email, session persistence/refresh, and sign-out.
- **Cloud persistence:** PostgreSQL in Supabase is the intended authoritative store for real property-management data. Each new auth user receives a private profile, workspace, and `owner` membership through a database trigger.
- **Authorization:** PostgreSQL Row Level Security is the security boundary. UI-selected workspace IDs are not trusted. Queries must remain scoped by RLS and future domain tables must have workspace ownership and membership policies before use.
- **Data access:** `src/lib/data/repositories.ts` exposes typed repository interfaces; React views should call repositories rather than embed Supabase query details. `src/lib/data/database.types.ts` is the minimal initial schema typing and should be regenerated with Supabase CLI as schema changes.
- **Client configuration:** the browser only receives the Supabase URL and publishable/anon key. These are public client configuration values; database access remains protected by RLS. Never use a service-role key in `VITE_*` variables or browser code.
- **No false sync promise:** authentication and the workspace schema are wired to Supabase only after configuration. The dashboard is still sample-only. Realtime subscriptions, offline mutation queue/cache, merge/conflict UX, and domain repositories are not implemented in this milestone.

## Setup Supabase

Requires Node.js 20.19+ or 22.12+, npm, and a Supabase project. For local database development, install the Supabase CLI separately.

1. Create a Supabase project.
2. In **Authentication → URL Configuration**, set the site URL to your development origin (usually `http://localhost:5173`) and configure allowed redirect URLs for your development and production origins.
3. In **Project Settings → API**, copy the project URL and the publishable key (or legacy anon key). Do not copy the service-role key.
4. Copy `.env.example` to `.env.local`, then replace the placeholders:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

5. Apply `supabase/migrations/202610200001_initial_workspace_auth.sql` using the Supabase SQL editor, or install the Supabase CLI, run `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase db push` from the project root. The repository includes `supabase/config.toml` and the migration directory.
6. Configure email confirmation and SMTP according to your deployment policy. With confirmation enabled, sign-up will ask the user to check email before signing in.
7. Start the app. If environment values are absent or placeholders, pOS deliberately shows the setup-required state instead of pretending authentication works.

```bash
npm install
npm run dev
npm run build
npm test
```

`.env.local` is local-only and must not be committed. `.env.example` contains placeholders only.

## Initial schema and access model

- `profiles`: each authenticated user may read/update their own profile only.
- `workspaces`: workspace members may read a workspace; only its owner may update/delete it. Creation must set `owner_id = auth.uid()`.
- `workspace_memberships`: a user may read their own membership; workspace owners can inspect and administer membership rows. Client policy currently prevents granting the `owner` role through membership inserts/updates.
- `handle_new_user()`: trusted database trigger creates the profile, a personal workspace, and its owner membership at sign-up.
- `is_workspace_member()` / `is_workspace_owner()`: narrowly scoped security-definer predicates avoid recursive membership-table RLS checks. Their execution is revoked from `public` and granted to authenticated users.

When domain tables arrive, include a non-null `workspace_id`, enable RLS, and write `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies using membership checks. Prefer explicit role/operation rules. Do not rely on hiding workspace IDs, filtering only in React, or a client-side role check. Review every migration and run cross-user isolation tests before production.

An optional database integration test is in `supabase/tests/workspace_rls.test.sql`. Run it against a disposable Supabase local database with pgTAP available. It has **not** been run in this environment; UI/repository unit tests do not prove deployed RLS behavior.

## Multi-device synchronization plan

1. **Now:** Supabase Auth restores a session on each browser/device; the same account can sign in from multiple devices. Initial workspace/profile tables are cloud-backed once the project and migration are configured.
2. **Domain persistence milestone:** repositories write/read PostgreSQL rows and treat the server as the source of truth. The sample dashboard is replaced only after real domain data and loading/error states exist.
3. **Realtime (future):** subscribe to Postgres changes scoped to an authorized workspace, refresh or reconcile affected repository queries, and unsubscribe on workspace/session changes. Realtime is a notification/update channel, not an authorization substitute.
4. **Offline (future):** add IndexedDB as a local read cache and an explicit queued-mutation outbox. Show offline/queued/synced status; never imply a queued write has reached the server.
5. **Conflicts (future):** use server timestamps/version fields and optimistic concurrency (for example, update only where the expected version matches); surface conflicts for user resolution instead of silent last-write-wins for financial records. Ledger/payment events should be append-oriented and idempotent.

## Commands and tests

- `npm run dev` — local development server.
- `npm run build` — TypeScript project build and Vite production bundle.
- `npm test` — Vitest and React Testing Library unit/component tests.
- `npm run test:e2e` — Playwright script entry is reserved; no end-to-end suite exists yet.

Current tests cover auth form configuration/validation/mode behavior and repository error/empty-membership handling. They mock the data client and do not prove network connectivity, email delivery, live session restoration, or real PostgreSQL RLS.

## Current limitations

- A live Supabase project and credentials have not been supplied or verified.
- The dashboard still contains sample figures and payments. The authentication shell does not imply these figures belong to the signed-in user.
- Workspace selection/sharing UI and domain CRUD are not included yet.
- Realtime subscriptions, offline cache/queue, conflict handling, MFA, and automated production policy verification remain future work.
- For production, add rate-limit/abuse protections, appropriate email/SMTP settings, monitoring, backup/recovery procedures, and a reviewed policy test suite.

## Milestone 3 — property, tenant, and maintenance workflows

Apply the additive migration `supabase/migrations/202610200002_property_management.sql` **after** the initial workspace/auth migration; do not edit or replay the initial migration as a new schema. The three domain screens use typed repository factories and Zod schemas, refetch from PostgreSQL after writes, and rely on RLS for authorization. Properties referenced by tenants/requests are protected by foreign keys. Remove linked maintenance requests before deleting a tenant, and remove dependent records before deleting a property. A single unambiguous authorized workspace is required; this build deliberately refuses writes when there are zero or multiple workspaces rather than silently choosing one.

Roles: owner/admin/member can create and edit domain records; only owner/admin can delete; viewer is read-only. RLS is the enforcement layer, not UI visibility. Workspace composite foreign keys prevent cross-workspace property/tenant assignments. Realtime and offline editing are not implemented.

### Added tests / verification

- `src/lib/data/__tests__/schemas.test.ts` tests schema validation.
- `supabase/tests/property_management_rls.test.sql` adds PostgreSQL isolation and cross-workspace relationship integration assertions.
- Run `npm test`, `npm run build`, and (with local Supabase + pgTAP) `psql "$SUPABASE_DB_URL" -f supabase/tests/property_management_rls.test.sql`.
- These tests are authored but must be run in an environment with dependencies and a disposable Supabase database. No live Supabase credentials were supplied.

## Milestone 5 — Financial workflows (additive)

Apply `supabase/migrations/202610200004_financial_workflows.sql`, then `supabase/migrations/202610200005_financial_integrity_hardening.sql`, then `supabase/migrations/202610200006_idempotency_timezone_canonicalization.sql` after migrations `001`, `002`, and `003`. Do not edit or replay the already-applied migrations. This migration adds invoices, reported payments, payment allocations, a derived invoice-balance view, and an append-oriented financial ledger. It also adds atomic RPCs for invoice creation, payment recording, and audited voids.

### Money and accounting conventions

- INR is the initial currency. All new financial amounts are **integer paise** (`100 paise = ₹1`). `src/lib/data/money.ts` is the form/display boundary; no float amounts are stored in the financial tables. Existing `tenants.monthly_rent` remains `numeric(12,2)` rupees for compatibility. Invoice form defaults read that legacy rupee value and convert it to paise only when submitting.
- Invoice: debit `accounts_receivable`, credit `rent_income`.
- Payment: debit `cash`; credit `accounts_receivable` for allocations and `unapplied_receipts` for any remainder. Allocations may be partial and may span multiple invoices for one tenant. Unallocated receipts remain visible and are not silently applied.
- Outstanding balance is calculated in `rent_invoice_balances` as invoice amount less allocations for non-void payments. Status is derived from that balance and due date; it is not a mutable label.
- Each invoice is manually created; recurring rent generation is not implemented. A partial unique index prevents a duplicate active `rent_charge` for the same tenant and billing period.
- Payment submissions carry a caller-generated idempotency UUID. A repeated request with the same workspace/key returns the existing payment. Keep the same key when retrying an uncertain submission; the UI retains it until a successful response.
- Finalized invoices and payments are not directly editable/deletable by authenticated clients. Owner/admin void functions require a reason and append equal-and-opposite ledger rows. Allocated payments must be voided before an invoice can be voided. This records user-reported payments only; there is no payment processor or electronic transfer integration.
- Ledger accounts are a focused rent subledger, not a complete general ledger or tax/accounting system. No interest, fees, refunds to bank, write-offs, currency conversion, or period close are implemented.

### Financial setup and checks

```sh
npm install
npm run build
npm test
supabase start
supabase db reset
psql "$SUPABASE_DB_URL" -f supabase/tests/financial_workflows.test.sql
```

The SQL integration test requires a disposable local Supabase database with pgTAP installed. It is authored but not run in this environment. The financial RPCs perform role checks and row-level work atomically; direct authenticated insert/update/delete is revoked and RLS remains the read boundary. Validate migrations and policies against your Supabase/Postgres version before production use.


## Milestone 6 — Financial integrity hardening

Migration `202610200005_financial_integrity_hardening.sql` binds payment idempotency keys to the normalized request payload, serializes duplicate-key retries, and locks invoice rows in a stable order while checking outstanding balances. The 38-assertion `supabase/tests/financial_workflows.test.sql` includes regression cases for changed payload fields, time-zone-independent retries, unallocated receipts, oversized amounts, viewer restrictions, and direct-table-write denial. These tests have not been executed in this environment; run them against a disposable local Supabase database after installing the CLI. A true multi-session concurrency run remains required before production use.


### Query 7 verification note

Migration `202610200006_idempotency_timezone_canonicalization.sql` fixes a retry-stability defect: `timestamptz` values serialized directly into JSON fingerprints depend on the session time zone. The fingerprint now uses epoch seconds, with a pgTAP regression for the same instant expressed in UTC and America/Los_Angeles. The financial test suite now declares 38 assertions and covers legacy fingerprint compatibility. In this packaged environment no PostgreSQL, Docker/Podman, or Supabase CLI executable was available, and npm dependency installation timed out; therefore SQL and application test results remain unverified. See `MILESTONE_7_REPORT.md` for exact command outcomes.

## Query 8 verification and CI

The GitHub Actions workflow at `.github/workflows/ci.yml` runs on pushes, pull requests, and manual dispatch. It targets Node.js 22.16.0 / npm 10.x, performs a clean `npm ci`, runs the TypeScript-backed production build and Vitest suite, then starts disposable local Supabase, resets the database (applying migrations in filename order), runs the full pgTAP suite, and stops the local stack. The database job requires Docker, which is available on the GitHub-hosted Ubuntu runner.

The supplied Milestone 7 archive did not contain `package-lock.json`. This environment could not reach `registry.npmjs.org`, so it was not possible to generate and validate a lockfile locally. Until a lockfile is committed, the app CI job bootstraps one from the pinned package metadata and uploads it as a short-lived artifact for review; this is a migration aid, not a substitute for committing the lockfile. Download the artifact from a successful workflow run, review and commit it, then subsequent CI runs will use `npm ci` without the bootstrap step.

Local verification commands (from the project root):

```sh
npm ci --no-audit --no-fund
npm run build
npm test
supabase start
supabase db reset --local
supabase test db --local
supabase stop --no-backup
```

Do not treat static SQL inspection or assertion-count checks as proof of database behavior. The local database and concurrency checks must complete successfully before deployment; the Query 8 environment did not have Docker, PostgreSQL utilities, Supabase CLI, or npm registry connectivity.

## Query 9: reproducible verification

The application CI job intentionally requires a committed `package-lock.json` and runs `npm ci` with Node.js `22.16.0` / npm `10.9.2`. The supplied Milestone 8 archive did not include a lockfile, and the implementation environment could not resolve `registry.npmjs.org`, so no lockfile is fabricated or committed here.

One-time lockfile bootstrap in GitHub Actions:

1. Push this repository to GitHub and open **Actions → Bootstrap npm lockfile (one-time setup) → Run workflow**.
2. Wait for the workflow to complete. It generates `package-lock.json` from the current `package.json` and validates it with a clean `npm ci`.
3. Download the `pos-package-lock-npm-10.9.2-node-22.16.0` artifact from that run, inspect it, and commit the resulting `package-lock.json` to the repository root.
4. Push the commit. The regular **CI** application job will then use only the committed lockfile and will fail if it is absent.

Local verification commands, after registry access is available and the lockfile is committed:

```sh
node --version                 # v22.16.x
npm --version                  # 10.9.2
npm ci --no-audit --no-fund
npm run build
npm test
supabase start
supabase db reset --local      # applies migrations 001–006 in filename order
supabase test db --local       # runs every SQL test file under supabase/tests
supabase stop --no-backup
```

The database CI job uses the GitHub-hosted Ubuntu runner's Docker service and Supabase CLI `2.72.7`; it resets only the disposable local Supabase database. CI has not been executed from this archive environment. A successful YAML parse is not evidence of a successful GitHub Actions run, and SQL concurrency behavior still requires independent-session tests and post-operation row/balance inspection.
