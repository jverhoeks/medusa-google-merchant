import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk, type MerchantSettings } from "../../lib/sdk"

const GoogleMerchantPage = () => {
  const { data, error, isPending } = useQuery<MerchantSettings>({
    queryKey: ["google-merchant"], queryFn: () => sdk.client.fetch("/admin/google-merchant"),
  })
  return <Container className="space-y-4">
    <Heading>Google Merchant Center</Heading>
    <Text>Publish a hosted XML product file for Google's free listings. This plugin does not create ads or submit products through Google's API.</Text>
    {isPending && <Text>Loading configuration…</Text>}
    {error && <Text role="alert">Could not load feed configuration.</Text>}
    {data && <>
      <Text>Feed: {data.enabled ? "enabled" : "disabled"}. Market: {data.country.toUpperCase()}, {data.currency.toUpperCase()}, language {data.locale}.</Text>
      <a className="text-ui-fg-interactive break-all" href={data.feed_url} target="_blank" rel="noreferrer">{data.feed_url}</a>
      <Text>Open a product and use its Google Merchant switch to select it. Selection mode: {data.selection_mode}. {data.collection_handle ? `Collection restriction: ${data.collection_handle}.` : ""} {data.bundles_only ? "Only linked fixed bundles are exported." : "Only single-variant offers are supported in this release."}</Text>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Verify your storefront domain in Merchant Center.</li>
        <li>Add a product file from the feed URL using the configured market and currency.</li>
        <li>Configure shipping and returns to match the store, and schedule daily retrieval.</li>
        <li>Review diagnostics and verify prices, tax treatment, images and stock against landing pages and checkout.</li>
      </ol>
    </>}
    <Text>Manufacturer identifiers must be genuine. Configure metadata google_merchant_brand, google_merchant_gtin and google_merchant_mpn. Use google_merchant_identifier_exists=false only for products genuinely without assigned identifiers.</Text>
  </Container>
}
export const config = defineRouteConfig({ label: "Google Merchant", icon: ShoppingBag })
export default GoogleMerchantPage
