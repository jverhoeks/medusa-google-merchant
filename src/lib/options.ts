import type { HttpTypes } from "@medusajs/types"

export type FeedOptions = {
  enabled: boolean
  /** Admin/product selection only; a separate storefront imports the feed generator. */
  externalFeed?: boolean
  storefrontUrl: string
  backendUrl: string
  publishableKey: string
  title: string
  description: string
  country: string
  currency: string
  locale: string
  selectionMode: "opt-in" | "opt-out"
  collectionHandle?: string
  bundlesOnly: boolean
  /** Optional public Store API extension returning { bundle_products, is_bundle }. */
  bundleEndpoint?: string
  productPathPrefix?: string
}

export function selected(product: HttpTypes.StoreProduct, options: FeedOptions) {
  const metadata = product.metadata ?? {}
  if (metadata.google_merchant_exclude === true || metadata.google_merchant_enabled === false) return false
  if (options.collectionHandle && product.collection?.handle !== options.collectionHandle) return false
  return metadata.google_merchant_enabled === true || options.selectionMode === "opt-out"
}

export function parseOptions(input: Partial<FeedOptions>): FeedOptions {
  const options: FeedOptions = {
    enabled: false, externalFeed: false, storefrontUrl: "", backendUrl: "", publishableKey: "",
    title: "Product catalogue", description: "Products available from our store",
    country: "nl", currency: "eur", locale: "nl", selectionMode: "opt-in",
    bundlesOnly: false, ...input,
  }
  for (const name of ["storefrontUrl", "backendUrl"] as const) {
    if (name === "backendUrl" && options.externalFeed) continue
    const url = new URL(options[name])
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error(`Invalid Google Merchant ${name}`)
    }
    options[name] = url.origin
  }
  if ((!options.externalFeed && !options.publishableKey) || !/^[a-z]{2}$/.test(options.country) || !/^[a-z]{3}$/.test(options.currency)) {
    throw new Error("Google Merchant requires a publishable key, lowercase country and currency")
  }
  if (!["opt-in", "opt-out"].includes(options.selectionMode)) throw new Error("Invalid selection mode")
  if (typeof options.enabled !== "boolean" || typeof options.externalFeed !== "boolean" || typeof options.bundlesOnly !== "boolean") throw new Error("Invalid feed flag")
  if (options.bundlesOnly && !options.bundleEndpoint) throw new Error("Bundle-only feeds require a bundle endpoint")
  for (const path of [options.bundleEndpoint, options.productPathPrefix]) {
    if (path && (!path.startsWith("/") || path.startsWith("//") || /[\\?#\s]/.test(path))) throw new Error("Invalid Google Merchant path")
  }
  return options
}

export function feedEnabled(options: FeedOptions) {
  const url = new URL(options.storefrontUrl)
  // An explicit enable flag alone cannot publish a local/test catalogue.
  return !options.externalFeed && options.enabled && url.protocol === "https:" &&
    !/^(localhost$|127\.|0\.|\[::1\]$|test\.|staging\.)/i.test(url.hostname)
}
