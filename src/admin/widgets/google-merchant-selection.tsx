import * as React from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading, Label, Switch, Text } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk, type MerchantSettings } from "../lib/sdk"

const GoogleMerchantSelection = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()
  const settings = useQuery<MerchantSettings>({
    queryKey: ["google-merchant"], queryFn: () => sdk.client.fetch("/admin/google-merchant"),
  })
  const update = useMutation({
    mutationFn: (enabled: boolean) => sdk.client.fetch(`/admin/google-merchant/products/${encodeURIComponent(product.id)}`, {
      method: "POST", body: { enabled },
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["products"] }) },
  })
  const explicit = product.metadata?.google_merchant_enabled
  const [override, setOverride] = React.useState<boolean | null>(null)
  React.useEffect(() => { setOverride(null) }, [product.id, explicit])
  const enabled = override ?? (typeof explicit === "boolean" ? explicit : settings.data?.selection_mode === "opt-out")
  return <Container className="space-y-3">
    <Heading level="h2">Google Merchant</Heading>
    <div className="flex items-center gap-3">
      <Switch id={`merchant-${product.id}`} checked={enabled} disabled={!settings.data || update.isPending}
        onCheckedChange={(value) => update.mutate(value, { onSuccess: () => setOverride(value) })} />
      <Label htmlFor={`merchant-${product.id}`}>Include in Google Merchant</Label>
    </div>
    <Text>Selection does not guarantee export or Google approval. Published availability, price, identifiers, collection restrictions and feed validation still apply.</Text>
    {product.metadata?.google_merchant_exclude === true && <Text>The legacy google_merchant_exclude flag blocks this product. Remove that flag in product metadata before enabling it.</Text>}
    {settings.data && settings.data.enabled === false && <Text>The feed is disabled for this environment.</Text>}
    {(settings.error || update.error) && <Text role="alert">Could not load or save Google Merchant selection. Please retry.</Text>}
  </Container>
}

export const config = defineWidgetConfig({ zone: "product.details.before" })
export default GoogleMerchantSelection
