# BatchGuard — Lot & Expiry Tracking

BatchGuard is a Shopify embedded app MVP for merchants selling food, cosmetics, and supplements. It tracks multiple lots per variant, expiration dates, FIFO order deductions, expiry alerts, CSV imports, and compliance webhooks.

## Local Setup

```bash
npm install --cache ./work/npm-cache
npx prisma generate
sqlite3 prisma/dev.sqlite < prisma/migrations/20260709140000_init_batchguard/migration.sql
sqlite3 prisma/dev.sqlite < prisma/migrations/20260709173000_add_untracked_stock_sales/migration.sql
npm run db:seed
npm run dev -- --port 3000
```

Open `http://127.0.0.1:3000/app`.

## Verification

```bash
npx tsc --noEmit
npm test
npm run build
```

Current verification status: all 10 tests pass, type check passes, and production build passes.

## Implemented MVP

- Prisma schema, migrations, and seed data.
- Lot list, add, edit, quantity adjustment, discard, and audit trail.
- Expiry dashboard with summary cards, action-needed table, value at risk, and untracked stock sold.
- `orders/create` webhook FIFO deduction with idempotency.
- CSV import with dry-run preview and commit.
- Alert digest job, nightly maintenance job, dev scheduler, and settings page.
- Shopify Billing API mutation shape, billing gate, local test subscription, GDPR webhooks, uninstall cleanup, and Shopify app config scopes.

## Shopify Template Integration Notes

This workspace did not include the official Shopify Remix template. The app is structured so these local placeholders can be replaced by template plumbing:

- Replace demo shop lookup in `app/shop.server.ts` with the template authenticated session/admin loader.
- Replace webhook header parsing with `authenticate.webhook(request)`.
- Execute `appSubscriptionCreate` through the authenticated Shopify Admin GraphQL client.
- Move scheduled jobs from `node-cron` to production cron or queue workers.
- Resolve CSV unknown SKUs/variant IDs through Admin GraphQL before failing rows.
- Mirror nearest expiry metafields through Admin GraphQL in the nightly job.

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
