import { test } from "node:test"
import assert from "node:assert/strict"
import { merchantFeed as renderFeed } from "../src/lib/feed.ts"
import { loadMerchantFeed } from "../src/lib/loader.ts"
import { parseOptions } from "../src/lib/options.ts"
const options = parseOptions({
  storefrontUrl: "https://shop.example", backendUrl: "https://api.example",
  publishableKey: "pk_fixture", collectionHandle: "cadeausets", bundlesOnly: true,
  bundleEndpoint: "/store/bundle-products", selectionMode: "opt-out",
  title: "Example Shop", description: "Example products",
})
const merchantFeed = (products, bundles, base) => renderFeed(products, bundles, base, options)
const base = "https://shop.example"
const variant = (id, quantity = 5) => ({
  id, manage_inventory: true, allow_backorder: false, inventory_quantity: quantity,
  calculated_price: { calculated_amount: 25, currency_code: "eur" },
})
const product = (id, overrides = {}) => ({
  id, handle: id, title: "Cadeau & bloemen", description: "Een <b>mooi</b> cadeau",
  thumbnail: "/images/gift.jpg", collection: { handle: "cadeausets" }, metadata: {}, variants: [variant(`${id}-v`)], ...overrides,
})

const singleSetFeed = (inputs) => merchantFeed(
  [...inputs, product("stock", { collection: null })],
  new Map(inputs.map((input) => [input.id, { items: [{ quantity: 1, product: { id: "stock" } }] }])),
  base,
)

test("exports escaped XML, real decimal prices, absolute links and explicit identifiers only", () => {
  const input = product("gift", { metadata: { google_merchant_brand: "Rex London", google_merchant_mpn: "A&B", internal_cost: "SECRET" } })
  const output = singleSetFeed([input])
  assert.match(output, /<g:id>gift-v<\/g:id>/)
  assert.match(output, /Cadeau &amp; bloemen/)
  assert.match(output, /<g:description>Een mooi cadeau<\/g:description>/)
  assert.match(output, /<g:price>25.00 EUR<\/g:price>/)
  assert.match(output, /https:\/\/shop.example\/images\/gift.jpg/)
  assert.match(output, /<g:mpn>A&amp;B<\/g:mpn>/)
  assert.doesNotMatch(output, /SECRET|sale_price|identifier_exists/)
})

test("excludes incomplete, opted-out, zero-priced, wrong-currency and multi-variant offers", () => {
  const bad = [
    product("hidden", { metadata: { google_merchant_exclude: true } }),
    product("choices", { variants: [variant("a"), variant("b")] }),
    product("image", { thumbnail: "javascript:alert(1)" }),
    product("description", { description: "" }),
    product("price", { variants: [{ ...variant("a"), calculated_price: { calculated_amount: 0, currency_code: "eur" } }] }),
    product("currency", { variants: [{ ...variant("a"), calculated_price: { calculated_amount: 25, currency_code: "usd" } }] }),
  ]
  assert.doesNotMatch(singleSetFeed(bad), /<item>/)
})

test("bundle uses its fixed price and aggregates component quantities instead of trusting parent stock", () => {
  const set = product("set", { variants: [{ ...variant("set-v"), manage_inventory: false }] })
  const component = product("component", { variants: [variant("component-v", 2)] })
  const bundles = new Map([["set", { items: [
    { product: { id: "component" }, quantity: 2 },
    { product: { id: "component" }, quantity: 1 },
  ] }]])
  const output = merchantFeed([set, component], bundles, base)
  const setXml = output.match(/<item><g:id>set-v[\s\S]*?<\/item>/)[0]
  assert.match(setXml, /<g:price>25.00 EUR/)
  assert.match(setXml, /<g:is_bundle>yes/)
  assert.match(setXml, /<g:availability>out_of_stock/)
  component.variants[0].inventory_quantity = 3
  assert.match(merchantFeed([set, component], bundles, base), /<g:id>set-v[\s\S]*?<g:availability>in_stock/)
  assert.doesNotMatch(merchantFeed([set], bundles, base), /<item>/)
})

test("unknown stock and backorders without stock are not advertised as in stock", () => {
  const input = product("backorder", { collection: null, variants: [{ ...variant("v", 0), allow_backorder: true }] })
  assert.match(merchantFeed([product("set"), input], new Map([["set", { items: [{ quantity: 1, product: { id: "backorder" } }] }]]), base), /out_of_stock/)
  delete input.variants[0].inventory_quantity
  assert.match(merchantFeed([product("set"), input], new Map([["set", { items: [{ quantity: 1, product: { id: "backorder" } }] }]]), base), /out_of_stock/)
})

test("identifier_exists=no is opt-in and cannot contradict a supplied manufacturer ID", () => {
  const input = product("own", { metadata: { google_merchant_identifier_exists: false } })
  assert.match(singleSetFeed([input]), /<g:identifier_exists>no/)
  input.metadata.google_merchant_gtin = "1234567890123"
  assert.doesNotMatch(singleSetFeed([input]), /identifier_exists/)
})

test("exports only actual linked cadeauboxes, never individual products or unlinked collection entries", () => {
  const set = product("set")
  const loose = product("loose", { collection: null, metadata: { is_bundle: true } })
  const unlinked = product("unlinked")
  const outside = product("outside", { collection: { handle: "other" } })
  const bundles = new Map([
    ["set", { items: [{ quantity: 1, product: { id: "loose" } }] }],
    ["outside", { items: [{ quantity: 1, product: { id: "loose" } }] }],
  ])
  const result = merchantFeed([set, loose, unlinked, outside], bundles, base)
  assert.equal((result.match(/<item>/g) ?? []).length, 1)
  assert.match(result, /<g:id>set-v/)
  assert.doesNotMatch(result, /<g:id>(loose|unlinked|outside)-v/)
})
