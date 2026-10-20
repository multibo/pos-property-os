# pOS publish checklist (beta)

This archive is configured for static deployment to Netlify or Vercel. A live release still requires your own Supabase project and production verification. Do not describe the dashboard sample figures as live data.

## 1. Configure Supabase

1. Create a Supabase project and set the production Site URL and allowed redirect URLs in Authentication → URL Configuration.
2. Set these environment variables in your hosting provider's project settings:
   - `VITE_SUPABASE_URL` — your project URL
   - `VITE_SUPABASE_ANON_KEY` — publishable/anon client key
3. Apply the SQL migrations in `supabase/migrations/` in filename order, or use the Supabase CLI and `supabase db push` after linking the correct project.
4. Review Authentication email-confirmation and SMTP settings.
5. Never set a service-role key in a `VITE_*` variable. Browser-exposed variables are public.

## 2. Publish on Netlify

1. Import this project repository into Netlify, or upload a built `dist/` directory after running the build locally.
2. Netlify uses `netlify.toml`: build command `npm run build`, publish directory `dist`.
3. Add the two Supabase environment variables above and redeploy.

## 3. Publish on Vercel

1. Import the repository into Vercel.
2. Vercel uses `vercel.json` and the Vite build output `dist/`.
3. Add the two Supabase environment variables and deploy.

## 4. Verify before public launch

Run with Node.js 22.x and npm 10.x:

```bash
npm install
npm run build
npm test
```

Then test sign-up, email confirmation, sign-in, password reset, sign-out, and access from two separate users. Verify row-level security against the actual deployed Supabase project and check browser console/network errors.

## Known release limitations

- The overview dashboard contains illustrative/sample figures and sample resident/payment rows; they are not live database data.
- Some launcher/help/calendar actions explicitly indicate planned functionality.
- Production readiness requires a real Supabase project, applied/reviewed migrations, configured environment variables, and a successful build/test run. These cannot be completed inside a source-only ZIP without your project credentials and deployment account.
