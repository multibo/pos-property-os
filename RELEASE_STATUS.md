# Release status — pOS Property OS

This is a deployment-configured source package, not a certified production release.

## Changes applied to the supplied build errors

- Explicitly typed the domain form defaults as `FormValues`.
- Narrowed dynamic `DomainRow` property reads to declared keys.
- Guarded the optional monthly-rent value before currency formatting.
- Used `defineConfig` from `vitest/config` so Vitest's `test` option is typed.
- Added explicit Testing Library cleanup after each Vitest test.

## Verification status

The supplied Termux log showed TypeScript build failures and 2 failing auth tests. In this packaging environment, npm registry access timed out, so dependencies could not be installed and I could not rerun `npm run build`, `npm test`, or the Supabase SQL tests. No passing status is claimed. `package-lock.json` is not included; do not use `npm ci` until a lockfile has been generated and committed.

## Must be completed before production

1. Generate and commit `package-lock.json` using Node 22.x and npm 10.x, with registry access.
2. Run `npm run build` and `npm test`, fix any remaining failures, and run the CI workflow.
3. Run `supabase db reset --local` and `supabase test db --local` against a disposable local Supabase stack.
4. Configure the real Supabase URL and publishable/anon key as hosting environment variables. Never expose a service-role key in frontend variables.
5. Review hosted database RLS policies, auth redirect URLs, email confirmation/SMTP, and two-user access isolation.
6. Replace or clearly label illustrative dashboard data and test every route/workflow before launch.

See `PUBLISH_CHECKLIST.md` for hosting instructions.
