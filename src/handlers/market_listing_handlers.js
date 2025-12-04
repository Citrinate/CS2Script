import { CS2_APPID } from "@cs2/constants";
import MarketAsset from "@cs2/items/assets/market_asset";
import { WaitForElm } from "@utils/helpers";

export function HandleOnResponseRenderResults() {
	const handler = () => {
		if (!unsafeWindow.g_rgAssets?.[CS2_APPID]?.[2] || !unsafeWindow.g_rgListingInfo) {
			return;
		}

		for (const listing of Object.values(unsafeWindow.g_rgListingInfo)) {
			const asset = unsafeWindow.g_rgAssets[CS2_APPID][2][listing.asset?.id];
			if (!asset) {
				continue;
			}

			// Add custom elements to a market listing
			WaitForElm(`.largeiteminfo_react_placeholder > div`).then(() => {
				const marketAsset = new MarketAsset(asset, listing);
				marketAsset.BuildListingUI();
			});
		}
	};

	// Trigger when a new page of market listings is loaded
	const originalOnResponseRenderResults = unsafeWindow.CAjaxPagingControls.prototype.OnResponseRenderResults;
	unsafeWindow.CAjaxPagingControls.prototype.OnResponseRenderResults = function () {
		const result = originalOnResponseRenderResults.call(this, ...arguments);

		handler();

		return result;
	};

	handler();
}
