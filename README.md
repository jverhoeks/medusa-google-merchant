# Medusa Google Merchant

A Medusa v2 plugin for hosted Google Merchant Center XML feeds, with a product
selection switch inside Medusa Admin. No Google API credentials or paid connector
are required. It does not create ads, submit products automatically, or guarantee
Google approval.

Built and tested against **Medusa 2.21.2**, Node.js 22 and npm 11.19.0. Initial
version 0.1.0 is pre-release; support for other Medusa versions is not claimed.

## Install

This repository is the source distribution. An npm release is not yet published.
Build a reviewed revision and create a package:

```sh
npm ci
npm test
npm run typecheck
npm pack
# Optional integration check against a fresh isolated PostgreSQL database:
# MERCHANT_TEST_DATABASE_URL=postgres://postgres:fixture_only@localhost:5432/merchant_plugin_test?sslmode=disable node scripts/smoke-plugin.cjs
```

In the Medusa backend project, install the resulting tarball (or an eventual
published version), then register it:

```sh
npm install /path/to/jverhoeks-medusa-google-merchant-0.1.0.tgz
```

```ts
// medusa-config.ts, inside defineConfig({...})
plugins: [{
  resolve: "@jverhoeks/medusa-google-merchant",
  options: {
    enabled: process.env.GOOGLE_MERCHANT_FEED_ENABLED === "true",
    storefrontUrl: process.env.STOREFRONT_URL,
    backendUrl: process.env.MERCHANT_BACKEND_URL,
    publishableKey: process.env.MERCHANT_PUBLISHABLE_KEY,
    title: "Your shop",
    description: "Your public product catalogue",
    country: "nl",
    currency: "eur",
    locale: "nl",
    selectionMode: "opt-in",
  },
}],
```

Use a public Store API publishable key scoped to the intended sales channel.
`backendUrl` is the reachable API origin; use a public HTTPS origin when using the
admin feed link directly. It is never a private Admin API key. Keep real runtime
values outside Git. Configuration requires valid origins and a publishable key,
even when the feed is disabled, so mistakes fail at startup.

Build/restart through your application's normal release process. No database
migration or catalogue rewrite is required. Do not configure a second module
registration for the same plugin module. Remove any old local API/admin routes
with the same paths before adopting the plugin; see [Botica Doro migration](docs/BOTICA-DORO.md).

## Select products

Open **Products → a product**. The Google Merchant widget provides an **Include
in Google Merchant** switch. It persists the boolean metadata field
`google_merchant_enabled` through Medusa's authenticated product-update workflow.
It preserves other metadata and does not change prices, stock or publication.
The default `opt-in` mode excludes products without an explicit true value.

An optional `collectionHandle` further restricts eligibility. The legacy
`google_merchant_exclude=true` flag always wins; remove it explicitly in product
metadata if needed. Selection does not bypass validation or force Google approval.
`opt-out` mode includes eligible products unless explicitly disabled, for existing
feeds that need compatibility. There is no automatic bulk enablement.

The **Google Merchant** admin page shows the configured market and feed URL.
The public endpoint is **`GET /google-merchant.xml` on the backend origin**.
An enabled feed returns XML; disabled feeds return 404. Unexpected upstream errors
return 503, never a successful empty feed. Local/test/staging storefront hosts
are blocked; for other preview hostnames always keep `enabled: false`.

For a Next.js storefront origin, use a thin server-side proxy at the same path
if required. Forward no visitor cookies/authorization and preserve failure
statuses, no-store and XML content type. Alternatively, register the backend XML
URL directly in Merchant Center. The backend plugin cannot install routes into
an independently deployed storefront.

## Feed rules

- Fetches anonymous Store API products using one fixed country/currency/locale
  and publishable-key sales channel. Customer cookies, groups and query parameters
  never change the feed's pricing context.
- Only published, API-visible **single-variant**, new-condition offers with title,
  description, image and positive calculated price in the configured currency
  are exported. Ensure those calculated amounts match landing-page/checkout tax
  treatment; the plugin does not calculate or guess additional tax.
- Uses stable variant IDs, absolute HTTP(S) links and escaped XML. Optional
  `productPathPrefix` defaults to `/products/`; configure it for your storefront's
  public product URLs, including a language prefix when needed.
- Unknown inventory and backorders without sufficient stock are represented as
  out of stock. Multi-variant landing-page selection is deliberately unsupported.
- Manufacturer brand, GTIN and MPN are never invented or borrowed from components.
  Supply `google_merchant_brand`, `google_merchant_gtin`, `google_merchant_mpn` in
  product metadata. Preserve GTIN leading zeros. Set
  `google_merchant_identifier_exists=false` only when genuinely appropriate.
- Pagination detects incomplete/repeated pages and fails rather than silently
  truncating a feed. XML responses are no-store and regenerated on each request.
- Google Merchant shipping, returns, domain verification and product diagnostics
  remain merchant responsibilities. A 404 does not immediately remove Google's
  previously ingested listings; pause the data source when disabling listings.

## Optional bundle adapter

Medusa installations have different bundle implementations. This plugin does not
require Botica Doro's custom module. For a compatible public Store API extension:

```ts
collectionHandle: "cadeausets",
bundlesOnly: true,
bundleEndpoint: "/store/bundle-products",
selectionMode: "opt-out", // migration compatibility only
```

The endpoint receives `product_id`, `region_id`, `currency_code` and returns:

```json
{
  "is_bundle": true,
  "bundle_products": [{
    "items": [{ "quantity": 2, "product": { "id": "prod_component" } }]
  }]
}
```

Only one fixed component variant per product is supported. Repeated components
are aggregated; incomplete or ambiguous components omit the offer. Bundle price
comes from the parent's calculated fixed price, stock comes from every component.
An actual linked bundle with hidden components cannot fall back to a regular
product. In `bundlesOnly` mode unlinked products never appear as offers.

## Scope and roadmap

This release provides an XML feed and manual per-product selection. It does not
include Merchant API synchronization, arbitrary multi-variant export, Google
account authentication, agent authentication, ACP/UCP checkout or MPP/x402
payments. Those can be separate, optional integrations later.

See [Google's product file specification](https://support.google.com/merchants/answer/7052112)
and [Medusa plugins](https://docs.medusajs.com/learn/fundamentals/plugins).
