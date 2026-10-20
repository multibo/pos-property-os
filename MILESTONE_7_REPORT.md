# pOS Query 7 — Verification and Repair Report

## Baseline inspected

- Continued from the supplied Milestone 6 ZIP; did not restart the app or replace prior migrations.
- `package.json` defines `build` as `tsc -b && vite build` and `test` as `vitest run`.
- The supplied archive contains **no `package-lock.json` or npm shrinkwrap**, so reproducible `npm ci` cannot run without first generating a lockfile. No lockfile was fabricated because registry access timed out.
- Existing migrations 001–005 and all existing SQL test files were retained.

## Defect fixed

The payment request fingerprint in migration 005 serialized `p_received_at` directly into JSONB. PostgreSQL formats `timestamptz` for JSON according to the session `TimeZone`; two clients submitting the same instant from sessions with different time zones could therefore generate different fingerprints and incorrectly reject a legitimate retry. Added migration `202610200006_idempotency_timezone_canonicalization.sql`, which uses epoch seconds in the fingerprint while semantically normalizing the old timestamp field on retries, preserving compatibility with records fingerprinted by migration 005. The migration is additive and redefines only the existing payment RPC; amounts remain integer paise and the accounting model is unchanged.

Expanded `supabase/tests/financial_workflows.test.sql` from 29 to 38 pgTAP assertions. New assertions cover changed reference, notes, received timestamp, tenant, and allocations for reused keys; a retry of the same instant across UTC and America/Los_Angeles session time zones; and compatibility with legacy fingerprints written by migration 005.

## Files changed

- `supabase/migrations/202610200006_idempotency_timezone_canonicalization.sql` — additive fix for time-zone-independent request fingerprinting.
- `supabase/tests/financial_workflows.test.sql` — 9 additional assertions (changed-payload coverage, timezone regression, and legacy-fingerprint compatibility); plan is 38.
- `README.md` — migration order and current test count / limitations.
- `MILESTONE_7_REPORT.md` — this report.

## Verification evidence

| Command/check | Result | Evidence / reason |
|---|---|---|
| `npm ci --no-audit --no-fund` | **FAILED (exit 1)** | npm reported no `package-lock.json`/shrinkwrap with a supported lockfile version. |
| `npm install --no-audit --no-fund` | **NOT COMPLETED (timed out at 120 seconds)** | Registry/dependency install did not finish; no lockfile produced. |
| `npm run build` | **FAILED (exit 1)** | TypeScript reported missing React JSX runtime/types and missing Vite/plugin modules, along with cascading JSX/implicit-any errors caused by absent dependencies. Build is not verified. |
| `npm test` | **FAILED (exit 127)** | `vitest: not found`. |
| `npm run lint` | **NOT CONFIGURED (exit 1)** | package has no `lint` script. |
| `npm run typecheck` | **NOT CONFIGURED (exit 1)** | package has no `typecheck` script; type checking is part of `npm run build`. |
| `command -v docker podman psql pg_ctl initdb supabase` | **NOT AVAILABLE** | None of these database/container executables was present. |
| SQL test assertion-count consistency | **PASSED (static check only)** | A script counted 38 pgTAP assertion calls, matching `select plan(38)`. This does not execute SQL. |
| ZIP integrity | **PASSED** | `unzip -t` completed successfully for the deliverable archive. |
| pgTAP suite / migration execution | **NOT EXECUTED** | No local PostgreSQL/Supabase runtime or CLI was available. |
| Real multi-session concurrency tests | **NOT EXECUTED** | No database runtime/client was available. Sequential SQL tests would not constitute concurrency proof. |
| Browser / runtime testing | **NOT EXECUTED** | Dependencies and browser test runtime were unavailable. |

## Security and accounting review status

Static inspection confirmed that migration 005 uses a transaction-scoped advisory lock keyed by workspace and idempotency key, checks the stored fingerprint before returning an existing payment, locks invoice rows in stable ID order, and retains the existing role check, `SECURITY DEFINER SET search_path=''`, and authenticated-only execute grant. Direct authenticated table writes remain revoked by migration 004. Migration 006 preserves these checks and changes only the timestamp representation in the fingerprint.

These are **static review findings**, not executed security proof. Unauthenticated/RLS isolation, owner/admin/member/viewer permissions, direct-write denial, cross-workspace isolation, transactional rollback, concurrent idempotency, invoice balance locking, and ledger reconciliation still require execution against a disposable Supabase/PostgreSQL database.

## Commands to run in a verification environment

From `pos/` with registry access:

```sh
npm install --no-audit --no-fund
npm run build
npm test
```

For database verification, start a disposable local Supabase instance, apply migrations 001–006 in order, then run the repository's SQL suites (including the new 38-assertion financial suite) with pgTAP. Add separate multi-session tests using two independent database connections for identical-key duplicates, same-key conflicting payloads, and distinct payments racing for the same invoice. Inspect final payment, allocation, ledger, and invoice-balance rows after each race.

## Remaining blockers / risks

- No SQL migration or pgTAP test was executed, and no actual concurrent database test was possible. Do not infer production readiness from static inspection.
- The project archive lacks a lockfile, so dependency installation is not reproducible until a package lock is generated in a network-enabled environment and committed.
- Full RLS, grants, function execute permissions, and rollback invariants need live database verification before deployment.
