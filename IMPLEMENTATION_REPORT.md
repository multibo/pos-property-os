# pOS Query 6 — Financial Integrity and Security Hardening

## Summary

Continued from the Milestone 5 project without replacing prior migrations or removing existing workflows. Added the additive migration `supabase/migrations/202610200005_financial_integrity_hardening.sql` and expanded `supabase/tests/financial_workflows.test.sql` to 29 pgTAP assertions.

## Bugs reviewed and fixes

- **Idempotency key payload mismatch:** previously, `record_rent_payment` returned an existing payment for any retry with the same workspace/key, even if amount, tenant, date, method, reference, notes, or allocations differed. The new function stores a canonical JSON representation of the normalized request and returns the existing payment only when that exact payload matches; otherwise it raises SQLSTATE `23505` with a clear error.
- **Concurrent duplicate requests:** transaction-scoped advisory locks serialize requests by workspace and idempotency key. The existing unique `(workspace_id, idempotency_key)` constraint remains a second line of defense.
- **Concurrent allocation races:** target invoice rows are locked in stable UUID order before outstanding balances are checked. The transaction retains atomicity for payment, allocation, and ledger inserts. Duplicate invoice entries within one allocation payload are rejected.
- **Malformed/oversized paise:** amount bounds and allocation format/amount checks are applied in the database function in addition to client validation.
- **TypeScript result narrowing:** corrected two domain repository return sites to narrow validated non-null rows to `DomainRow`; the build still cannot be considered successful because dependencies were unavailable.
- **Regression tests:** added changed-amount and changed-method idempotency retries, unallocated receipt ledger behavior, oversized amount rejection, viewer payment denial, and denial of direct authenticated writes to the payments table.

## Financial model retained

- Amounts remain integer paise; 100 paise = ₹1.
- Invoice balance remains derived from non-void allocations.
- Unallocated payment amounts are credited to `unapplied_receipts`.
- Voids remain append-only ledger reversals and are owner/admin-only.
- Members can record payments but cannot void finalized transactions; viewers remain read-only.
- No processor integration or recurring-rent automation was added.

The new `request_fingerprint` column stores canonical normalized JSON text, not a cryptographic hash. This avoids relying on hash collision resistance for equality. Existing payments created before this migration have a NULL fingerprint; retries using those legacy keys fail safely with an instruction to use a new key rather than guessing whether the request matches.

## Files changed

- `supabase/migrations/202610200005_financial_integrity_hardening.sql` — additive payment idempotency and row-locking hardening.
- `supabase/tests/financial_workflows.test.sql` — expanded to 29 assertions.
- `src/lib/data/domain-repositories.ts` — explicit row return narrowing in create/update.
- `IMPLEMENTATION_REPORT.md` — this report.
- `MILESTONE_6_REPORT.md` — concise milestone report.
- `README.md` — migration and verification instructions updated.

## Checks actually run

- `unzip -t /mnt/data/pos-milestone-6.zip`: **passed** (archive integrity check).
- `npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000`: **timed out**; dependency installation could not complete.
- `npm run build`: **failed/unverified due to absent dependencies** (`react`, Supabase, Vite, etc. unavailable). The output also surfaced repository type errors, two of which were corrected; a dependency-backed build must be rerun to confirm no remaining errors.
- `npm test`: **blocked**, `vitest: not found`.
- `supabase test db`: **blocked**, Supabase CLI is not installed.
- Browser testing: **not performed**.
- SQL integration tests and concurrent transaction tests: **written/revised but not executed**. No local PostgreSQL server, Docker, or Supabase CLI was available in this environment.

## Security review performed (static only)

- Financial table mutations remain revoked from `anon` and `authenticated`; authorized writes go through security-definer RPCs.
- The payment RPC keeps `search_path=''`, explicit workspace-role checks, workspace/tenant validation, and transaction atomicity.
- RLS remains the read boundary; client workspace IDs are not authorization proof.
- Added tests cover viewer write denial, direct table-write denial, forged workspace IDs, cross-workspace tenant links, and payload mismatch.

## Remaining risks / manual setup

1. Apply migrations 001–005 in order to a **disposable** Supabase database, then run `supabase test db` when the Supabase CLI is installed.
2. Add a real multi-session concurrency test (same idempotency key / changed payload, and two payments competing for the same invoice balance). Advisory locking and row locking are implemented but have not been verified under PostgreSQL concurrency here.
3. Review the migration against the exact deployed PostgreSQL/Supabase version before production use. This is static code review, not a live security audit.
4. Reinstall dependencies and rerun `npm run build` and `npm test`; the build result remains unverified.
5. For pre-migration payments whose idempotency fingerprint is NULL, clients must use a new idempotency key if they need to retry. No historical payload can be reconstructed reliably.
