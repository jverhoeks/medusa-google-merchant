import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type GoogleMerchantService from "../../../modules/google-merchant/service"
import { feedEnabled } from "../../../lib/options"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { options } = req.scope.resolve<GoogleMerchantService>("googleMerchant")
  res.setHeader("Cache-Control", "private, no-store")
  res.json({
    enabled: options.externalFeed ? null : feedEnabled(options),
    feed_managed_externally: options.externalFeed,
    feed_url: new URL("/google-merchant.xml", options.externalFeed ? options.storefrontUrl : options.backendUrl).href,
    country: options.country, currency: options.currency, locale: options.locale,
    selection_mode: options.selectionMode, collection_handle: options.collectionHandle || null,
    bundles_only: options.bundlesOnly,
  })
}
