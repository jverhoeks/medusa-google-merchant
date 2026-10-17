import type { HttpTypes } from "@medusajs/types"
import type { FeedOptions } from "./options"
import { selected } from "./options"

type Product = HttpTypes.StoreProduct
type Variant = HttpTypes.StoreProductVariant
export type MerchantBundle = {
  items: { quantity: number; product: { id: string } }[]
}

function xml(value: unknown) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function text(value: string | null | undefined) {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function publicUrl(value: string | null | undefined, base: string) {
  if (!value) return null
  try {
    const url = new URL(value, base)
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

function price(variant: Variant, currency: string) {
  const calculated = variant.calculated_price
  const amount = calculated?.calculated_amount
  return calculated?.currency_code?.toLowerCase() === currency.toLowerCase() &&
    typeof amount === "number" && Number.isFinite(amount) && amount > 0
    ? amount : null
}

function available(variant: Variant, quantity: number) {
  // Do not advertise backorders as in stock without a verified availability date.
  return variant.manage_inventory === false ||
    (typeof variant.inventory_quantity === "number" && variant.inventory_quantity >= quantity)
}

/** Public single-variant offers. Multi-variant landing pages are excluded until
 * the storefront can reliably preselect and display the exact submitted offer. */
export function merchantFeed(
  products: Product[],
  bundles: Map<string, MerchantBundle | null>,
  base: string,
  options: FeedOptions,
) {
  const catalog = new Map(products.map((product) => [product.id, product]))
  const items: string[] = []
  for (const product of products) {
    const metadata = product.metadata ?? {}
    const bundle = bundles.get(product.id)
    // Selection never bypasses validation. Bundle-only mode requires a real relationship.
    if (!selected(product, options)) continue
    if (options.bundlesOnly && !bundle?.items.length) continue
    if (metadata.google_merchant_exclude === true || !product.handle || product.variants?.length !== 1) continue
    const variant = product.variants[0]
    const amount = price(variant, options.currency)
    const title = text(product.title).slice(0, 150)
    const description = text(product.description).slice(0, 5000)
    const image = publicUrl(product.thumbnail || product.images?.[0]?.url, base)
    if (amount === null || !title || !description || !image) continue

    let inStock = available(variant, 1)
    if (bundle) {
      // Checkout sells component lines; the parent variant is only its price.
      inStock = true
      // One fixed component variant per item: quantities are aggregated so a
      // repeated component cannot accidentally make an unavailable set sellable.
      const quantities = new Map<string, number>()
      let complete = true
      for (const item of bundle.items) {
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) { complete = false; break }
        quantities.set(item.product.id, (quantities.get(item.product.id) ?? 0) + item.quantity)
      }
      for (const [id, quantity] of Array.from(quantities)) {
        const component = catalog.get(id)
        if (component?.variants?.length !== 1 || price(component.variants[0], options.currency) === null) {
          complete = false
          break
        }
        inStock = inStock && available(component.variants[0], quantity)
      }
      if (!complete || !quantities.size) continue
    }

    const tag = (name: string, value: unknown) => `<g:${name}>${xml(value)}</g:${name}>`
    const fields = [
      tag("id", variant.id), tag("title", title), tag("description", description),
      tag("link", new URL(`${options.productPathPrefix || "/products/"}${encodeURIComponent(product.handle)}`, base).href),
      tag("image_link", image), tag("price", `${amount.toFixed(2)} ${options.currency.toUpperCase()}`),
      tag("availability", inStock ? "in_stock" : "out_of_stock"),
      tag("condition", "new"),
    ]
    if (bundle) fields.push(tag("is_bundle", "yes"))
    // Only explicitly supplied identifiers. A set must never inherit an unrelated
    // component's GTIN, and the shop name is not necessarily the manufacturer.
    for (const name of ["brand", "gtin", "mpn"] as const) {
      const value = metadata[`google_merchant_${name}`]
      if (typeof value === "string" && value.trim()) fields.push(tag(name, value.trim()))
    }
    if (metadata.google_merchant_identifier_exists === false &&
      !metadata.google_merchant_gtin && !metadata.google_merchant_mpn) {
      fields.push(tag("identifier_exists", "no"))
    }
    items.push(`<item>${fields.join("")}</item>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${xml(options.title)}</title><link>${xml(base)}</link><description>${xml(options.description)}</description>${items.join("\n")}</channel></rss>`
}
