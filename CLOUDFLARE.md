# Cloudflare Pages deployment

BatchGuard deploys as a Cloudflare Pages app with a separate Worker for the
nightly maintenance and daily alert jobs. The Pages Function and the cron
Worker both use the same Postgres database through a Hyperdrive binding.

## Cloudflare setup

1. Create a Hyperdrive configuration that points to the production Postgres
   database.
2. Create a Pages project named `batchguard-lot-expiry-tracking` from this
   repository and select the `production-shopify` branch after the migration is
   merged.
3. In Pages > Settings > Variables and Secrets, add:
   `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`,
   `NODE_ENV=production`, and `BATCHGUARD_BILLING_TEST_MODE=false`.
4. In Pages > Settings > Bindings, add the Hyperdrive configuration as
   `HYPERDRIVE`.
5. Deploy Pages with `npm run cloudflare:deploy` or connect the GitHub branch
   with build command `npm run cloudflare:build` and output directory
   `build/client`.
6. Copy `workers/wrangler.cron.example.toml` to
   `workers/wrangler.cron.toml`, replace `replace-with-hyperdrive-id` with the
   Hyperdrive configuration ID, then deploy the `batchguard-maintenance`
   Worker with `npm run cloudflare:cron:deploy`. The production cron config is
   ignored by Git so its account-specific binding cannot be committed.
7. Set `SHOPIFY_APP_URL` to the Pages production URL, then release the Shopify
   configuration with that new App URL and `/auth/callback` redirect URL.

## Database migrations

Run Prisma migrations from a trusted Node environment against the direct
Postgres `DATABASE_URL` before deploying new application code. Do not run
`prisma migrate deploy` inside Pages Functions or a Worker.
