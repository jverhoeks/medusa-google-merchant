# Initial validation

Validated locally in isolated Linux ARM64 with Node 22.23.3, npm 11.19.0,
Medusa 2.21.2 and PostgreSQL 16. No live application data or external emails,
Google account access, orders or payments were used.

- 14 focused tests: XML escaping, prices/identifiers, opt-in/opt-out selection,
  exclusions, fixed-bundle stock aggregation, anonymous pagination, preview
  guards, failure responses and the optional bundle adapter.
- Backend and admin TypeScript checks passed.
- Official `medusa plugin:build` compiled the backend and admin extensions.
- `npm pack` archive inspection verified compiled routes, module and admin entry
  points, and excluded dependencies/environment files.
- `scripts/smoke-plugin.cjs` loaded the extracted package in a new Medusa app on
  an isolated database. Both admin configuration and mutation routes rejected
  anonymous requests with 401. A real fixture product was excluded initially,
  appeared in XML after authenticated enablement, and disappeared after disabling.
  Invalid toggle input returned 400; unrelated product metadata and published
  status were preserved. The public XML had the expected content type/no-store.

The admin extension compiled; a visual browser review of the product widget has
not been performed. CI repeats tests, typechecks, packaging and the full HTTP
fixture against PostgreSQL on Linux x64. This is pre-release evidence, not Google
Merchant approval or a Botica Doro production deployment.
