import { Module } from "@medusajs/framework/utils"
import GoogleMerchantService from "./service"
export const GOOGLE_MERCHANT_MODULE = "googleMerchant"
export default Module(GOOGLE_MERCHANT_MODULE, { service: GoogleMerchantService })
