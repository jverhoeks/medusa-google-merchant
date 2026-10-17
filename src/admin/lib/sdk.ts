import Medusa from "@medusajs/js-sdk"
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  auth: { type: "session" },
})
export type MerchantSettings = {
  enabled: boolean | null
  feed_managed_externally: boolean
  feed_url: string
  country: string
  currency: string
  locale: string
  selection_mode: "opt-in" | "opt-out"
  collection_handle: string | null
  bundles_only: boolean
}
