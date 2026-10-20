# pOS Milestone 6 — Financial Integrity

- Added migration `202610200005_financial_integrity_hardening.sql` without modifying migrations 001–004.
- Payment retries now compare canonical request payloads; changed payloads fail explicitly. Advisory transaction locks serialize duplicate keys, and invoice rows lock in stable order during allocation checks.
- Added duplicate-allocation, malformed/oversized amount checks and pgTAP regressions for changed-key payload, unallocated receipts, viewer writes, and direct table-write bypass attempts.
- Preserved integer-paise amounts, existing accounting conventions, append-only void reversals, and workspace-role restrictions.
- Fixed two TypeScript repository return narrowing issues found during build inspection.
- `npm install` timed out; `npm run build` could not complete because dependencies were absent; `npm test` was blocked because Vitest was unavailable; `supabase test db` was blocked because Supabase CLI was not installed. SQL tests and concurrency behavior have not been executed against PostgreSQL. No browser testing was performed.
- Before production: install dependencies, run build/unit tests, apply migrations to a disposable Supabase DB, execute pgTAP, and run real multi-session concurrency tests.
