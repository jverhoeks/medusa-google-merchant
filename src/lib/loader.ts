import type { HttpTypes } from "@medusajs/framework/types"
import { merchantFeed, type MerchantBundle } from "./feed"
import { selected, type FeedOptions } from "./options"

/** Anonymous Store API only: never forward visitor cookies, authorization or query context. */
export async function loadMerchantFeed(options: FeedOptions, fetcher: typeof fetch = fetch) {
  async function read<T>(path: string, query: Record<string, string>): Promise<T> {
    const url = new URL(path, options.backendUrl)
    url.search = new URLSearchParams(query).toString()
    const response = await fetcher(url, {
      headers: { "x-publishable-api-key": options.publishableKey, "x-medusa-locale": options.locale },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error("Merchant catalogue is unavailable")
    return response.json()
  }
  const { regions } = await read<{ regions: HttpTypes.StoreRegion[] }>("/store/regions", {})
  const region = regions.find((entry) => entry.currency_code === options.currency &&
    entry.countries?.some((country) => country.iso_2 === options.country))
  if (!region) throw new Error("Merchant region is unavailable")
  const products: HttpTypes.StoreProduct[] = []
  const ids = new Set<string>()
  for (let offset = 0; ; ) {
    const page = await read<{ products: HttpTypes.StoreProduct[]; count: number }>("/store/products", {
      region_id: region.id, limit: "100", offset: String(offset),
      fields: "id,title,description,handle,thumbnail,*images,*collection,+metadata,*variants.calculated_price,+variants.inventory_quantity",
    })
    if (!Number.isSafeInteger(page.count) || page.count < 0 || !Array.isArray(page.products)) throw new Error("Invalid merchant catalogue")
    for (const product of page.products) {
      if (ids.has(product.id)) throw new Error("Merchant catalogue changed during pagination")
      ids.add(product.id)
      products.push(product)
    }
    offset += page.products.length
    if (offset >= page.count) break
    if (!page.products.length) throw new Error("Merchant catalogue pagination is incomplete")
  }
  const bundles = new Map<string, MerchantBundle | null>()
  if (options.bundleEndpoint) {
    const candidates = products.filter((product) => selected(product, options) && product.variants?.length === 1)
    for (let offset = 0; offset < candidates.length; offset += 5) {
      await Promise.all(candidates.slice(offset, offset + 5).map(async (product) => {
        const result = await read<{ bundle_products: MerchantBundle[]; is_bundle?: boolean }>(options.bundleEndpoint!, {
          product_id: product.id, region_id: region.id, currency_code: options.currency,
        })
        bundles.set(product.id, result.bundle_products[0] ?? null)
        if (result.is_bundle && !result.bundle_products.length) {
          product.metadata = { ...product.metadata, google_merchant_exclude: true }
        }
      }))
    }
  }
  return merchantFeed(products, bundles, options.storefrontUrl, options)
}
