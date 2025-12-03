import Script from '@core/script.js';
import { CS2_APPID } from '@cs2/constants.js';
import Style from '@css/style.css';
import { HandleAddInventoryData, HandleSelectItem, HandleShowItemInventory } from './handlers/inventory_handlers';
import { HandleOnResponseRenderResults } from './handlers/market_listing_handlers';
import { TamperMonkeyConcurrentRequestsFix } from '@utils/tampermonkey_fix';

TamperMonkeyConcurrentRequestsFix();

(async function () {
	GM_addStyle(Style);

	await Script.VerifyConnection();

	const PAGE_INVENTORY = 0;
	const PAGE_MARKET_LISTING = 1;

	let currentPage = null;
	if (window.location.href.includes('/market/listings')) {
		currentPage = PAGE_MARKET_LISTING;
	} else if (window.location.href.includes('/inventory')) {
		currentPage = PAGE_INVENTORY;
	}

	if (currentPage == PAGE_INVENTORY) {
		const IS_OWN_INVENTORY = unsafeWindow.g_ActiveUser.strSteamId == unsafeWindow.g_steamID;
		if (IS_OWN_INVENTORY) {
			HandleShowItemInventory();
		}

		HandleAddInventoryData();
		HandleSelectItem();
	}
	else if (currentPage == PAGE_MARKET_LISTING) {
		const IS_CS2_ITEM = !!unsafeWindow.g_rgAppContextData?.[CS2_APPID];
		const HAS_INDIVIDUAL_LISTINGS = Object.values(unsafeWindow.g_rgAssets?.[CS2_APPID]?.[2])[0]?.commodity == 0;
		if (!IS_CS2_ITEM || !HAS_INDIVIDUAL_LISTINGS) {
			return;
		}
		
		HandleOnResponseRenderResults();
	}
})();
