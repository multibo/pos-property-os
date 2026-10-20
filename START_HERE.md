# pOS Property OS — Start here

## Publish this beta

See `PUBLISH_CHECKLIST.md` for Netlify and Vercel deployment steps, Supabase configuration, and pre-launch checks.

## Run locally

Requirements: Node.js 22.x and npm 10.x.

```bash
npm install
npm run build
npm test
npm run dev -- --host 0.0.0.0
```

Open `http://127.0.0.1:5173/` in the same device's browser.

## Supabase

Copy `.env.example` to `.env.local`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with your Supabase project URL and publishable/anon key, apply the migrations in `supabase/migrations/` in filename order, then restart the app. Never put a service-role key in browser environment variables.

## Important

This is a publish-configured beta, not a fully feature-complete production release: the overview still shows sample dashboard data, and some launcher actions are placeholders. Run the build and tests and complete `PUBLISH_CHECKLIST.md` before public launch.
