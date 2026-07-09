# BatchGuard — Lot & Expiry Tracking

BatchGuard is a Shopify embedded app for merchants selling food, cosmetics, and supplements. It tracks multiple lots per variant, expiration dates, FIFO order deductions, expiry alerts, CSV imports, and compliance webhooks.

## Production Branch Setup

```bash
npm install --cache ./work/npm-cache
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev -- --port 3000
```

Run through Shopify CLI or an app tunnel for embedded auth flows. Direct local browsing without a Shopify session is not supported on this branch.

## Verification

```bash
npx tsc --noEmit
npm test
npm run build
```

Current verification status: type check passes and production build passes. Database integration tests require a Postgres `DATABASE_URL`.

## Render Production Deploy

This branch is a Node Remix server app backed by Postgres. Do not deploy it as a Cloudflare Worker/static assets app.

1. Create the Render blueprint from `render.yaml`.
2. Set `SHOPIFY_API_SECRET` as a secret environment variable.
3. Set `SHOPIFY_APP_URL` to the final Render URL.
4. Keep `BATCHGUARD_BILLING_TEST_MODE=false`.
5. Use `SHOPIFY_BILLING_TEST_MODE=true` only for dev store billing tests.
6. Run `shopify app deploy` after app config URLs match Render.

Render build/start commands are:

```bash
npm ci && npm run build
npm run start:prod
```

## Production Integration Status

- Postgres Prisma schema and clean production migration.
- Shopify Remix authentication/session storage.
- Authenticated shop context for `/app/*` routes.
- Authenticated webhook routes for orders, uninstall, and GDPR.
- Shopify Billing redirect flow.
- Admin GraphQL-backed CSV variant lookup.
- Optional nearest-expiry metafield mirroring hook.
- Lot list, add, edit, quantity adjustment, discard, and audit trail.
- Expiry dashboard with summary cards, action-needed table, value at risk, and untracked stock sold.
- `orders/create` webhook FIFO deduction with idempotency.
- CSV import with dry-run preview and commit.
- Alert digest job, nightly maintenance job, dev scheduler, and settings page.
- GDPR webhooks, uninstall cleanup, and Shopify app config scopes.

## Required Shopify Scopes

Configured in `shopify.app.toml`:

```text
read_products,write_products,read_orders
```

## Development Billing

`.env` enables local browsing with:

```text
BATCHGUARD_BILLING_TEST_MODE="true"
```

Turn this off in production.
