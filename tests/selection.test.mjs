import { test } from "node:test"
import assert from "node:assert/strict"
import { merchantFeed } from "../src/lib/feed.ts"
import { parseOptions, selected, feedEnabled } from "../src/lib/options.ts"
import { loadMerchantFeed } from "../src/lib/loader.ts"
import { GET } from "../src/api/google-merchant.xml/route.ts"
const config = (override = {}) => parseOptions({
  storefrontUrl: "https://shop.example", backendUrl: "https://api.example",
  publishableKey: "pk_fixture", ...override,
})
const product = (id, metadata = {}) => ({
  id, title: "Example", description: "Useful product", handle: id,
  thumbnail: "/image.jpg", metadata,
  variants: [{ id: `v_${id}`, manage_inventory: false,
    calculated_price: { calculated_amount: 10, currency_code: "eur" } }],
})

test("new installations require explicit product selection; exclusion always wins", () => {
  const options = config()
  assert.equal(selected(product("a"), options), false)
  assert.equal(selected(product("a", { google_merchant_enabled: true }), options), true)
  assert.equal(selected(product("a", { google_merchant_enabled: true, google_merchant_exclude: true }), options), false)
  assert.equal(selected(product("a", { google_merchant_enabled: false }), config({ selectionMode: "opt-out" })), false)
  assert.equal(selected(product("a"), config({ selectionMode: "opt-out" })), true)
  assert.equal(selected(product("a", { google_merchant_enabled: true }), config({ collectionHandle: "gifts" })), false)
})

test("regular products work without the application-specific bundle module", () => {
  const output = merchantFeed([product("yes", { google_merchant_enabled: true }), product("no")], new Map(), "https://shop.example", config({ title: "Other & Shop" }))
  assert.equal((output.match(/<item>/g) || []).length, 1)
  assert.match(output, /Other &amp; Shop/)
  assert.match(output, /<g:id>v_yes/)
  assert.doesNotMatch(output, /is_bundle|Botica|v_no/)
})

test("preview catalogues cannot be published by the enabled flag alone", () => {
  assert.equal(feedEnabled(config()), false)
  assert.equal(feedEnabled(config({ enabled: true })), true)
  for (const storefrontUrl of ["https://test.shop.example", "https://staging.shop.example", "http://localhost:8000", "http://127.0.0.1", "https://[::1]"]) {
    assert.equal(feedEnabled(config({ enabled: true, storefrontUrl })), false)
  }
})

test("configuration rejects credential-bearing URLs, invalid flags and external bundle paths", () => {
  for (const changes of [
    { backendUrl: "https://secret@api.example" }, { bundleEndpoint: "//evil.example/x" },
    { bundleEndpoint: "/\\evil.example/x" }, { selectionMode: "all" },
    { enabled: "true" }, { bundlesOnly: true }, { currency: "EUR" },
  ]) assert.throws(() => config(changes))
})

test("loader paginates with anonymous fixed market headers and optional bundle adapter", async () => {
  const requests = []
  const fetcher = async (url, options) => {
    requests.push({ url, options })
    if (url.pathname === "/store/regions") return Response.json({ regions: [{ id: "r_nl", currency_code: "eur", countries: [{ iso_2: "nl" }] }] })
    const offset = Number(url.searchParams.get("offset"))
    return Response.json({ products: offset === 0 ? Array.from({ length: 100 }, (_, i) => product(String(i))) : [product("selected", { google_merchant_enabled: true })], count: 101 })
  }
  const result = await loadMerchantFeed(config(), fetcher)
  assert.equal((result.match(/<item>/g) || []).length, 1)
  assert.deepEqual(requests.filter(({url}) => url.pathname === "/store/products").map(({url}) => url.searchParams.get("offset")), ["0", "100"])
  for (const { options } of requests) {
    assert.equal(options.headers["x-medusa-locale"], "nl")
    assert.equal(options.headers.authorization, undefined)
    assert.equal(options.headers.cookie, undefined)
    assert.equal(options.redirect, "error")
    assert.equal(options.cache, "no-store")
  }
  await assert.rejects(loadMerchantFeed(config(), async () => new Response("no", {status: 500})), /unavailable/)
})

test("loader fails instead of silently exporting a truncated or repeated page", async () => {
  const regions = { regions: [{ id: "r", currency_code: "eur", countries: [{ iso_2: "nl" }] }] }
  await assert.rejects(loadMerchantFeed(config(), async url => Response.json(url.pathname.endsWith("regions") ? regions : { products: [], count: 1 })), /incomplete/)
  await assert.rejects(loadMerchantFeed(config(), async url => Response.json(url.pathname.endsWith("regions") ? regions : { products: [product("same")], count: 2 })), /changed during pagination/)
})

test("public endpoint returns disabled 404 and failure 503 without internal details", async () => {
  const service = { options: config(), feed: async () => { throw new Error("private database details") } }
  const req = { scope: { resolve: () => service } }
  const headers = {}
  const res = { statusCode: 200, setHeader(k,v) { headers[k]=v }, status(n) { this.statusCode=n;return this }, type() { return this }, send(s) { this.body=s;return this } }
  await GET(req,res)
  assert.equal(res.statusCode,404)
  service.options = config({enabled:true})
  await GET(req,res)
  assert.equal(res.statusCode,503)
  assert.doesNotMatch(res.body,/private/)
  assert.equal(headers["Cache-Control"],"no-store")
  service.feed = async () => "<rss/>"
  res.statusCode=200
  await GET(req,res)
  assert.equal(res.body,"<rss/>")
})

test("bundle adapter resolves actual links and never falls back when components are hidden", async () => {
  const options = config({ bundlesOnly: true, bundleEndpoint: "/store/bundle-products" })
  const requests = []
  const set = product("set", { google_merchant_enabled: true })
  const component = product("part")
  let hidden = false
  const fetcher = async (url, request) => {
    requests.push(url)
    if (url.pathname.endsWith("regions")) return Response.json({ regions: [{ id: "r", currency_code: "eur", countries: [{ iso_2: "nl" }] }] })
    if (url.pathname.endsWith("products") && url.pathname !== options.bundleEndpoint) return Response.json({ products: [set, component], count: 2 })
    assert.equal(url.pathname, "/store/bundle-products")
    assert.equal(url.searchParams.get("product_id"), "set")
    assert.equal(url.searchParams.get("region_id"), "r")
    assert.equal(request.headers.authorization, undefined)
    return Response.json({ is_bundle: true, bundle_products: hidden ? [] : [{ items: [{ quantity: 1, product: { id: "part" } }] }] })
  }
  assert.match(await loadMerchantFeed(options, fetcher), /<g:is_bundle>yes/)
  hidden = true
  assert.doesNotMatch(await loadMerchantFeed(options, fetcher), /<item>/)
  assert.equal(requests.filter(url => url.pathname === options.bundleEndpoint).length, 2)
})

test("external storefront mode needs no backend key and never hosts a second feed", () => {
  const options = parseOptions({ externalFeed: true, enabled: true, storefrontUrl: "https://shop.example" })
  assert.equal(options.publishableKey, "")
  assert.equal(feedEnabled(options), false)
  assert.throws(() => parseOptions({ externalFeed: "true", storefrontUrl: "https://shop.example" }))
})
