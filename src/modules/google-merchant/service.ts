import { parseOptions, type FeedOptions } from "../../lib/options"
import { loadMerchantFeed } from "../../lib/loader"

export default class GoogleMerchantService {
  readonly options: FeedOptions
  constructor(_container: Record<string, unknown>, options: Partial<FeedOptions> = {}) {
    this.options = parseOptions(options)
  }
  feed() { return loadMerchantFeed(this.options) }
}
