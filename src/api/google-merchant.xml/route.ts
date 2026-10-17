import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type GoogleMerchantService from "../../modules/google-merchant/service"
import { feedEnabled } from "../../lib/options"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex")
  const service = req.scope.resolve<GoogleMerchantService>("googleMerchant")
  if (!feedEnabled(service.options)) return res.status(404).send("Merchant feed is disabled")
  try {
    return res.type("application/xml").send(await service.feed())
  } catch {
    return res.status(503).send("Merchant feed temporarily unavailable")
  }
}
