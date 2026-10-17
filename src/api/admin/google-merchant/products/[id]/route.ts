import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

// Medusa's /admin authentication protects this route; no public mutation endpoint.
export async function POST(req: MedusaRequest<{ enabled: boolean }>, res: MedusaResponse) {
  if (!req.body || typeof req.body.enabled !== "boolean" || Object.keys(req.body).some((key) => key !== "enabled")) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Only enabled (boolean) is accepted")
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: req.params.id } })
  if (!data.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  await updateProductsWorkflow(req.scope).run({ input: { products: [{
    id: req.params.id,
    metadata: { ...data[0].metadata, google_merchant_enabled: req.body.enabled },
  }] } })
  res.setHeader("Cache-Control", "private, no-store")
  res.json({ product_id: req.params.id, google_merchant_enabled: req.body.enabled })
}
