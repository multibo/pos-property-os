# pOS Milestone 5 — Financial workflows report

## Summary

Extended the existing Milestone 4 project in place. Existing auth, workspace selection, Properties, Tenants, Maintenance, design tokens, and themes are retained. Added the additive migration `supabase/migrations/202610200004_financial_workflows.sql` only; migrations `001`, `002`, and `003` are unchanged.

## Financial model

- `rent_invoices`: invoice identity, workspace/tenant/property, source (`manual` or `rent_charge`), billing period, due date, amount in paise, and void audit fields. Composite foreign keys ensure the invoice tenant is assigned to its property in the same workspace. A partial unique index prevents duplicate active `rent_charge` invoices for the same tenant and billing period.
- `payments`: user-reported money received, unique receipt number, idempotency key, method/reference, and void audit fields. Payments are not processor-confirmed transfers.
- `payment_allocations`: positive integer-paise links from one payment to one or more invoices. Composite foreign keys enforce same workspace and same tenant on both sides. Unique payment/invoice allocation pairs prevent duplicate lines.
- `rent_invoice_balances`: read-only, security-invoker view deriving paid amount, outstanding amount, and status from allocations belonging to non-void payments. No mutable invoice status is treated as accounting truth.
- `financial_ledger`: append-oriented balanced debit/credit entries. Invoice: Dr accounts receivable / Cr rent income. Payment: Dr cash / Cr accounts receivable for allocated amount, plus Cr unapplied receipts for the unallocated remainder. Voids append opposite entries.

Financial write tables have authenticated direct insert/update/delete revoked. Authenticated users read only rows allowed by membership RLS; security-definer RPCs check the current user's workspace role and perform invoice/payment/void operations atomically. Members can create invoices and record payments; owner/admin alone can void finalized financial records. Void reasons are mandatory. Allocated payments must be voided before their invoice can be voided.

All financial amounts are integer paise. `src/lib/data/money.ts` converts INR rupees at input/display boundaries and rejects zero, negative, excessive-precision, and unsafe values. Existing `tenants.monthly_rent` remains numeric rupees for compatibility; the invoice form prefills from it, then converts to paise on submission. Overpayments remain as unapplied receipts and are not silently allocated. Formal credit notes, refunds, recurring automation, taxes, interest, and full general-ledger accounting are not implemented.

## UI and source files

- `src/App.tsx` — routes the existing Rent & payments, Invoices, and Ledger navigation entries to financial workflows.
- `src/components/FinancialWorkspace.tsx` — workspace-scoped invoice/payment/ledger screens, search and filters, create forms, allocations, receipt printing, void/reversal controls, loading/error/success states, and stale-request cleanup.
- `src/lib/data/financial-repositories.ts` — typed repository methods, Zod input validation, Supabase RPC use, and financial read operations.
- `src/lib/data/money.ts` — integer-paise conversion and INR display.
- `src/lib/data/database.types.ts` — finance tables, view, relationships, and RPC types.
- `src/lib/data/__tests__/money.test.ts` — money boundary tests.
- `src/lib/data/__tests__/financial-repositories.test.ts` — invoice/payment schema tests.
- `src/styles.css` — responsive financial workflow styles in the existing design system.
- `supabase/migrations/202610200004_financial_workflows.sql` — additive financial schema, constraints, RLS, and atomic RPCs.
- `supabase/tests/financial_workflows.test.sql` — pgTAP integration tests for role checks, paise persistence, partial/multi-invoice allocation, duplicate submission idempotency, invalid allocation prevention, reversals, and ledger reconciliation.
- `README.md` — setup and model documentation.

## Checks actually performed

- `npm install --no-audit --no-fund` — attempted; timed out (registry/dependency access unavailable in this environment).
- `npm test` — attempted; failed to start because `vitest` is not installed.
- `npm run build` — attempted; blocked because `react`, `vite`, and other package dependencies/types are not installed. TypeScript emitted cascading missing-module/JSX diagnostics, so no successful build is claimed.
- `tsc -b` — attempted; same dependency-blocked result.
- TypeScript parser syntax pass using the globally installed TypeScript parser — passed for changed TS/TSX files (syntax parsing only, not type checking).
- SQL integration test execution — not performed. `psql`, Supabase CLI, and Docker are unavailable in this environment; the pgTAP file is written but not run. No live RLS or database behavior is claimed as verified.

## Setup and remaining limitations

1. Configure `.env.local` from `.env.example` with the Supabase URL and publishable/anon key. Do not use a service-role key in browser code.
2. Apply migrations `001` → `002` → `003` → `004`, or use `supabase db reset` against a disposable local database.
3. Install dependencies, then run `npm run build` and `npm test`.
4. Run `supabase/tests/financial_workflows.test.sql` against a disposable local Supabase database with pgTAP.
5. Review SQL behavior on the target Supabase/Postgres version before production deployment.

Unverified items: full TypeScript build, browser behavior/accessibility, migration execution, SQL concurrency tests, deployed RLS, and print rendering across browsers. The receipt is a printable acknowledgement of a user-reported payment, not proof of bank settlement. This is an initial rent subledger, not a production-ready accounting system.
