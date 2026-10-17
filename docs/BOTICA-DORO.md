# Botica Doro adoption

The extraction is based on the application's reviewed Google Merchant serializer
and loader. The live application remains independent until an explicit adoption
PR and release. Creating this repository does not deploy or change live product
metadata. No production data or secret configuration is included.

1. Build/pack a reviewed plugin revision and pin the resulting package version in
   the application dependency lockfile. Archive/version the package for CI; do not
   rely on an untracked local tarball for deployment.
2. Register the plugin with Botica Doro's actual environment configuration: NL,
   EUR, Dutch, title/description, `collectionHandle: "cadeausets"`,
   `bundlesOnly: true`, `bundleEndpoint: "/store/bundle-products"`, and
   `selectionMode: "opt-out"` to preserve the current catalogue. Keep test disabled.
3. Remove the duplicate app-owned `/admin/google-merchant` route and Google
   Merchant admin page. Add the package's product widget through plugin loading.
4. Replace the storefront generator with a cookie-free proxy to the plugin XML
   endpoint. Keep the established public `/google-merchant.xml` URL and explicit
   storefront enable flag. Use a fixed configured backend URL, never a request
   query parameter or visitor-controlled destination. Keep preview protection.
5. Compare offer IDs/counts, prices, links, identifiers and component availability
   against the current generator using synthetic fixtures first. In test, verify
   authenticated product selection, metadata preservation, public mutation denial,
   feed failures, admin navigation and compiled widget rendering. The default
   smoke test must not place orders, charge cards or send customer emails.
6. Release to test first, then production on explicit release authorization with
   environment-specific storefront images and the normal backup/rollback process.
   No DB migration is required. The new dependency changes the release fingerprint;
   use the reviewed dependency-change release procedure, not a guard bypass.

Do not enable every product or change the shop to opt-in as an extraction side
effect. A later opt-in migration is a separately audited catalogue operation,
with before/after product selections and feed comparisons per environment.
