# pOS Query 8 — Reproducible Build, CI, and Database Verification Report

## Scope and preservation

Started from the supplied Milestone 7 ZIP and retained an untouched copy at `pos-milestone-7-untouched-backup.zip` (also provided separately). Existing application source, tests, and migrations `202610200001` through `202610200006` remain in place. No new financial behavior or database migration was added because this environment could not execute PostgreSQL tests to establish a justified financial code change.

## Changes made

- Added `.github/workflows/ci.yml` with an application job (Node.js 22.16.0, clean npm install, build, unit tests) and a disposable local Supabase job (start, apply migrations in order via `supabase db reset`, execute all pgTAP suites, stop).
- Added `packageManager: npm@10.9.2` and Node/npm engine constraints to `package.json`.
- Replaced floating `@vitejs/plugin-react: latest` with the explicit compatible version `4.3.4` to remove an uncontrolled major-version input.
- Added `db:reset` and `test:db` npm scripts.
- Documented CI, lockfile recovery, and local verification commands in `README.md`.
- Preserved all migrations 001–006 and all existing tests. The SQL suites statically declare 64 assertions total: workspace RLS 4, stabilization 12, role permissions 3, financial workflows 38, and property management RLS 7. This count is a static check only, not test execution.

## Verification evidence

Commands were attempted from `pos/` on Node `v22.16.0` and npm `10.9.2`.

| Check | Result | Exact evidence |
|---|---|---|
| Untouched Milestone 7 backup | **PASSED** | Copied `/mnt/data/pos-milestone-7.zip` byte-for-byte to `/mnt/data/pos-milestone-7-untouched-backup.zip` before edits. |
| `npm ci --no-audit --no-fund` | **FAILED — exit 1** | npm `EUSAGE`: no `package-lock.json` or `npm-shrinkwrap.json` exists. |
| `timeout 15s npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000` | **BLOCKED — exit 124** | Command timed out before generating a lockfile. `curl -I --max-time 5 https://registry.npmjs.org/react` failed with `curl: (6) Could not resolve host: registry.npmjs.org`. |
| `npm run build` | **FAILED — exit 1** | `tsc -b && vite build` stopped with missing dependency errors, including `Cannot find module 'react'`, `motion/react`, and `lucide-react`; no `node_modules` was installed. These errors do not establish whether source compiles once dependencies are installed. |
| `npm test` | **FAILED — exit 127** | `sh: 1: vitest: not found`; dependencies unavailable. |
| `npm run lint` | **NOT CONFIGURED** | No lint script exists in `package.json`. |
| `tsc -b --pretty false` using globally installed TypeScript 5.8.3 | **FAILED — exit 2** | Dependencies/types were absent, producing cascading JSX and module-resolution errors; this is not a clean source-only type check. |
| `supabase db reset --local` | **NOT EXECUTABLE — exit 127** | `supabase: command not found`. |
| `supabase test db --local` | **NOT EXECUTED** | Supabase CLI unavailable. |
| `docker --version`, `podman --version`, `psql --version`, `supabase --version` | **NOT AVAILABLE** | All commands were missing from the environment. |
| Static pgTAP plan/assertion consistency | **PASSED (static only)** | Each SQL test file's declared `plan(n)` matched counted assertion calls; total 64. |
| CI workflow YAML parse | **PASSED (syntax parse only)** | Python PyYAML loaded `.github/workflows/ci.yml`. No GitHub Actions runner executed it. |
| ZIP integrity | **PASSED** | `unzip -t /mnt/data/pos-milestone-8.zip` completed with `No errors detected`; untouched Milestone 7 backup ZIP also passed `unzip -t`. |

## Passed / failed / not executed summary

### Passed

- CI workflow YAML parses successfully.
- Static pgTAP assertion count and plan values match across all five SQL test files (64 assertions total).
- Original Milestone 7 ZIP backup retained.

### Failed or blocked

- Lockfile-based clean install failed because no lockfile was supplied.
- Lockfile generation timed out due unavailable registry DNS.
- Production build and unit tests could not run because packages were not installed; the commands returned nonzero exit codes.

### Not executed

- Actual migrations 001–006 against PostgreSQL/Supabase.
- pgTAP assertions against a database.
- Time-zone retry regression against PostgreSQL.
- Real concurrent identical/conflicting idempotency requests, competing invoice allocations, reversed multi-invoice locking, rollback atomicity, and final row/balance/ledger inspection.
- Executed RLS, grants, RPC authorization, browser testing, and linting (no lint script configured).

## CI behavior and lockfile limitation

The workflow runs all required application and database checks and does not suppress failing build/test/database commands. Because the project arrived without a lockfile and this environment cannot reach npm, the application job has a temporary bootstrap step that creates a lockfile from `package.json`, runs `npm ci`, and uploads the generated lockfile artifact for review. This is explicitly a migration aid; builds are not fully reproducible across separate workflow runs until that generated `package-lock.json` is reviewed and committed. No lockfile was fabricated in this environment.

The database job uses `supabase/setup-cli@v1` (CLI `2.72.7`) and a GitHub-hosted Ubuntu runner with Docker. It starts a disposable Supabase stack, applies migrations 001–006 through `supabase db reset --local`, runs `supabase test db --local`, and always attempts to stop the stack. It has not yet run in this environment.

## Remaining blockers and risks

1. Generate/review/commit `package-lock.json` from a network-enabled environment; then remove the bootstrap step and require `npm ci` directly.
2. Run the GitHub Actions workflow and fix any genuine build, unit-test, migration, or pgTAP failures it finds.
3. Add/run independent-session concurrency scenarios if existing SQL tests do not cover them sufficiently; inspect payment, allocation, invoice balance, and ledger rows after each race.
4. Do not claim production readiness until application CI and database/concurrency/security verification pass. No production database was accessed or modified during this milestone.
