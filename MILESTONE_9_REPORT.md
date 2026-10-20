# pOS Query 9 — Reproducible Build and CI Verification Report

## Summary

Started from the supplied Milestone 8 ZIP. Preserved the application, all migrations `202610200001` through `202610200006`, and all five SQL test files. No product features, financial behavior, migrations, or test assertions were changed. No production database was accessed.

The environment cannot resolve `registry.npmjs.org` and has no Docker/Podman, PostgreSQL client, pgTAP runner, or Supabase CLI. Therefore a valid dependency lockfile could not be generated here, and actual application/database CI results are unavailable. To avoid fabricating a lockfile or pretending the build is reproducible, regular CI now fails clearly if `package-lock.json` is missing. A separate manually triggered GitHub Actions workflow generates a real lockfile on a network-enabled runner, verifies `npm ci`, and uploads it for review and commit.

## Files changed

- `.github/workflows/ci.yml` — removed per-run lockfile bootstrap; requires a committed lockfile, pins Node.js `22.16.0`, checks npm `10.9.2`, uses `npm ci`, runs build and unit tests; retains a disposable Supabase job that resets the local database and runs all pgTAP files.
- `.github/workflows/bootstrap-lockfile.yml` — new one-time manual workflow to generate and validate a lockfile on a network-enabled GitHub runner and upload it as an artifact.
- `README.md` — adds exact lockfile bootstrap, commit, local application and database verification instructions.
- `MILESTONE_9_REPORT.md` — this report.

No migration or test file changed. Static byte comparisons against the supplied Milestone 8 archive confirmed migrations 001–006 and all five SQL test files are unchanged.

## Exact checks and evidence

Commands were run from `/mnt/data/posq9/pos` on Node.js `v22.16.0` and npm `10.9.2` unless otherwise noted.

| Check / command | Exit | Result / evidence |
|---|---:|---|
| `npm ci --no-audit --no-fund` | 1 | **FAILED / blocked by repository state**. npm `EUSAGE`: no `package-lock.json` or `npm-shrinkwrap.json` exists. |
| `timeout 20s npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000` | 124 | **BLOCKED**. Timed out before lockfile generation. |
| `curl -I --max-time 5 https://registry.npmjs.org/react` | 6 | **FAILED / network blocker**. `curl: (6) Could not resolve host: registry.npmjs.org`. |
| `npm run build` | 1 | **FAILED / dependencies unavailable**. `tsc -b && vite build` emitted missing-module/type cascades, including `react`, `motion/react`, and `lucide-react`. This is not a valid source-build verdict with dependencies absent. |
| `npm test` | 127 | **FAILED / dependencies unavailable**. `sh: 1: vitest: not found`. |
| `npm run lint` | 1 | **NOT CONFIGURED**. npm reported missing `lint` script. |
| `npm run typecheck` | 1 | **NOT CONFIGURED**. npm reported missing `typecheck` script. TypeScript project checks are included in `npm run build`. |
| Python PyYAML parse of `.github/workflows/ci.yml` and `.github/workflows/bootstrap-lockfile.yml` | 0 | **PASSED (syntax parse only)**. PyYAML 6.0.3 loaded both files. This does not prove GitHub Actions execution. |
| Static pgTAP plan/assertion scan | 0 | **PASSED (static only)**. Financial workflow: 38/38; property management RLS: 7/7; role permissions: 3/3; workspace RLS: 4/4; workspace stabilization: 12/12. Total 64 declared assertions match 64 counted assertion calls. No SQL assertion was executed. |
| `command -v docker podman psql pg_prove supabase` | n/a | **NOT AVAILABLE**. None of the executables was installed. |
| Migration/test preservation `cmp -s` against extracted Milestone 8 source | 0 per file | **PASSED**. All six migration files and all five SQL test files were byte-identical. |
| GitHub Actions CI run | n/a | **NOT EXECUTED**. This environment cannot trigger a hosted GitHub Actions run or report its result. |
| `unzip -t` on final project ZIP | 0 | **PASSED**. Archive integrity verified. |

## Passed

- Both workflow files parse as YAML.
- All five SQL test files have matching declared plans and statically counted assertion calls (64 total).
- Migrations 001–006 and the existing SQL tests are preserved byte-for-byte from Milestone 8.
- Final project archive passes `unzip -t`.

## Failed / blocked

- `npm ci`: no committed lockfile.
- Lockfile generation: timed out due unavailable registry DNS; no `package-lock.json` was created.
- Build: exit 1 because packages and their type declarations are absent.
- Unit tests: exit 127 because Vitest is absent.
- Lint and separate typecheck scripts are not configured.

## Not executed

- Hosted GitHub Actions workflow.
- Clean install using a committed lockfile.
- Successful production build and Vitest suite.
- Supabase startup, migrations 001–006 against PostgreSQL, and pgTAP execution.
- Timezone-canonicalization database regression against actual PostgreSQL.
- Independent-session concurrency tests for duplicate requests, competing invoice allocations, deadlocks, rollback atomicity, and post-race row/balance/ledger inspection.
- Runtime/browser tests and actual RLS/grant verification.

## Exact steps to finish in a network-enabled GitHub environment

1. Push this project to GitHub.
2. Open **Actions → Bootstrap npm lockfile (one-time setup) → Run workflow**.
3. Wait for `npm install --package-lock-only` and `npm ci` to complete. Download artifact `pos-package-lock-npm-10.9.2-node-22.16.0`, inspect `package-lock.json`, and commit it at the repository root.
4. Push the lockfile commit. The regular CI app job now requires the committed lockfile and runs `npm ci`, `npm run build`, and `npm test` without bootstrapping dependencies.
5. Review the regular CI database job. It uses Supabase CLI `2.72.7` and a GitHub-hosted Ubuntu runner, starts a disposable local Supabase stack, runs `supabase db reset --local` (which applies migrations in filename order), executes `supabase test db --local`, and stops the stack.
6. Before release, add/run an independent-session concurrency harness against that disposable database and inspect actual payment, allocation, invoice-balance, and ledger rows after each race. Existing pgTAP suites are transaction-oriented and do not by themselves prove concurrent behavior.

## Release status

**Not production verified.** The CI setup is prepared but has not been run. There is no lockfile in this deliverable because a genuine lockfile could not be generated without registry access. Application build/test, SQL integration, authorization, and concurrency behavior remain unverified until the above commands actually pass in a suitable environment.
