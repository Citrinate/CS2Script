import Script, { OPERATION_ERROR, ERROR_LEVEL } from '@core/script.js';
import { CS2_APPID } from '@cs2/constants.js';
import Inventory from '@cs2/items/inventory.js';
import InventoryAsset from '@cs2/items/assets/inventory_asset.js';
import MarketAsset from '@cs2/items/assets/market_asset.js';
import Table from '@components/table.js';
import { CreateElement } from '@utils/helpers.js';
import style from '@css/style.css';

//#region Workaround for Tampermonkey issue: "All GM_xmlhttpRequest requests are serialized"
// https://github.com/Tampermonkey/tampermonkey/issues/2215
// https://github.com/Tampermonkey/utils/blob/main/requires/gh_2215_make_GM_xhr_more_parallel_again.js
{
	/* global GM_info, GM: writable */

	const HAS_GM = typeof GM !== 'undefined';
	const NEW_GM = ((scope, GM) => {
		// Check if running in Tampermonkey and if version supports redirect control
		if (GM_info.scriptHandler !== "Tampermonkey" || compareVersions(GM_info.version, "5.3.2") < 0) return;

		// Backup original functions
		const GM_xmlhttpRequestOrig = GM_xmlhttpRequest;
		const GM_xmlHttpRequestOrig = GM.xmlHttpRequest;

		function compareVersions(v1, v2) {
			const parts1 = v1.split('.').map(Number);
			const parts2 = v2.split('.').map(Number);
			const length = Math.max(parts1.length, parts2.length);

			for (let i = 0; i < length; i++) {
				const num1 = parts1[i] || 0;
				const num2 = parts2[i] || 0;

				if (num1 > num2) return 1;
				if (num1 < num2) return -1;
			}
			return 0;
		}

		// Wrapper for GM_xmlhttpRequest
		function GM_xmlhttpRequestWrapper(odetails) {
			// If redirect is manually set, simply pass odetails to the original function
			if (odetails.redirect !== undefined) {
				return GM_xmlhttpRequestOrig(odetails);
			}

			// Warn if onprogress is used with settings incompatible with fetch mode used in background
			if (odetails.onprogress || odetails.fetch === false) {
				console.warn("Fetch mode does not support onprogress in the background.");
			}

			const {
				onload,
				onloadend,
				onerror,
				onabort,
				ontimeout,
				...details
			} = odetails;

			// Set redirect to manual and handle redirects
			const handleRedirects = (initialDetails) => {
				const request = GM_xmlhttpRequestOrig({
					...initialDetails,
					redirect: 'manual',
					onload: function(response) {
						if (response.status >= 300 && response.status < 400) {
							const m = response.responseHeaders.match(/Location:\s*(\S+)/i);
							// Follow redirect manually
							const redirectUrl = m && m[1];
							if (redirectUrl) {
								const absoluteUrl = new URL(redirectUrl, initialDetails.url).href;
								handleRedirects({ ...initialDetails, url: absoluteUrl });
								return;
							}
						}

						if (onload) onload.call(this, response);
						if (onloadend) onloadend.call(this, response);
					},
					onerror: function(response) {
						if (onerror) onerror.call(this, response);
						if (onloadend) onloadend.call(this, response);
					},
					onabort: function(response) {
						if (onabort) onabort.call(this, response);
						if (onloadend) onloadend.call(this, response);
					},
					ontimeout: function(response) {
						if (ontimeout) ontimeout.call(this, response);
						if (onloadend) onloadend.call(this, response);
					}
				});
				return request;
			};

			return handleRedirects(details);
		}

		// Wrapper for GM.xmlHttpRequest
		function GM_xmlHttpRequestWrapper(odetails) {
			let abort;

			const p = new Promise((resolve, reject) => {
				const { onload, ontimeout, onerror, ...send } = odetails;

				send.onerror = function(r) {
					if (onerror) {
						resolve(r);
						onerror.call(this, r);
					} else {
						reject(r);
					}
				};
				send.ontimeout = function(r) {
					if (ontimeout) {
						// See comment above
						resolve(r);
						ontimeout.call(this, r);
					} else {
						reject(r);
					}
				};
				send.onload = function(r) {
					resolve(r);
					if (onload) onload.call(this, r);
				};

				const a = GM_xmlhttpRequestWrapper(send).abort;
				if (abort === true) {
					a();
				} else {
					abort = a;
				}
			});

			p.abort =  () => {
				if (typeof abort === 'function') {
					abort();
				} else {
					abort = true;
				}
			};

			return p;
		}

		// Export wrappers
		GM_xmlhttpRequest = GM_xmlhttpRequestWrapper;
		scope.GM_xmlhttpRequestOrig = GM_xmlhttpRequestOrig;

		const gopd = Object.getOwnPropertyDescriptor(GM, 'xmlHttpRequest');
		if (gopd && gopd.configurable === false) {
			return {
				__proto__: GM,
				xmlHttpRequest: GM_xmlHttpRequestWrapper,
				xmlHttpRequestOrig: GM_xmlHttpRequestOrig
			};
		} else {
			GM.xmlHttpRequest = GM_xmlHttpRequestWrapper;
			GM.xmlHttpRequestOrig = GM_xmlHttpRequestOrig;
		}
	})(window, HAS_GM ? GM : {});

	if (HAS_GM && NEW_GM) GM = NEW_GM;
}
//#endregion

(async function () {
	GM_addStyle(style);

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
		//#region Inventory Page
		const IS_OWN_INVENTORY = unsafeWindow.g_ActiveUser.strSteamId == unsafeWindow.g_steamID;

		if (IS_OWN_INVENTORY) {
			// Preload inventory from interface
			const initInventory = () => {
				if (initInventory.initialized) {
					return;
				}

				initInventory.initialized = true;
				Script.GetInventory();
			};

			// Show "open all storage units" button
			const allCratesButton = CreateElement("a", {
				class: "btn_darkblue_white_innerfade btn_medium",
				style: {
					marginRight: "12px"
				},
				html: "<span>Retrieve All Stored Items</span>",
				onclick: async () => {
					const inventory = await Script.GetInventory({ showProgress: true });

					if (inventory === OPERATION_ERROR.INTERFACE_NOT_CONNECTED) {
						Script.ShowStartInterfacePrompt({
							message: "Interface must be running to fetch stored items",
							fade: false
						});

						return;
					}

					if (inventory === OPERATION_ERROR.INVENTORY_FAILED_TO_LOAD) {
						Script.ShowError({ level: ERROR_LEVEL.HIGH }, new Error("Inventory failed to load, check error logs and refresh the page to try again"));

						return;
					}

					if (!(inventory instanceof Inventory)) {
						return;
					}

					const table = new Table(inventory.storedItems.slice(), inventory, {
						mode: Table.MODE.RETRIEVE,
						casketName: "All Storage Units",
						multiCasket: true,
					});

					table.Show();
				}
			});

			const originalShowItemInventory = unsafeWindow.ShowItemInventory;
			unsafeWindow.ShowItemInventory = function (appid) {
				const result = originalShowItemInventory.call(this, ...arguments);

				if (appid == CS2_APPID) {
					initInventory();
					!allCratesButton.isConnected && unsafeWindow.document.getElementsByClassName("inventory_rightnav")[0].prepend(allCratesButton);
				} else {
					allCratesButton.isConnected && allCratesButton.remove();
				}

				return result;
			};

			if (unsafeWindow.g_ActiveInventory.appid == CS2_APPID) {
				initInventory();
				unsafeWindow.document.getElementsByClassName("inventory_rightnav")[0].prepend(allCratesButton);
			}
		}

		{ // Add elements to the inventory item squares
			const handleInventoryAssets = () => {
				if (!handleInventoryAssets.handledAssetIDs) {
					handleInventoryAssets.handledAssetIDs = new Set();
				}

				if (!unsafeWindow.g_rgAppContextData[CS2_APPID].rgContexts[2].inventory?.m_rgAssets) {
					return;
				}

				for (const element of unsafeWindow.g_rgAppContextData[CS2_APPID].rgContexts[2].inventory.m_rgItemElements) {
					const asset = element?.[0]?.rgItem;
					if (!asset) {
						continue;
					}

					const assetid = asset.assetid;
					if (handleInventoryAssets.handledAssetIDs.has(assetid)) {
						continue;
					}

					handleInventoryAssets.handledAssetIDs.add(assetid);
					const inventoryAsset = new InventoryAsset(asset);
					inventoryAsset.BuildInventoryUI();
				}
			};

			const originalAddInventoryData = unsafeWindow.CInventory.prototype.AddInventoryData;
			unsafeWindow.CInventory.prototype.AddInventoryData = function (data) {
				const result = originalAddInventoryData.call(this, ...arguments);

				if (data?.assets?.[0]?.appid == CS2_APPID) {
					handleInventoryAssets();
				}

				return result;
			};

			handleInventoryAssets();
		}

		{ // Add elements to the selected inventory item
			const handleSelectedAsset = (asset) => {
				requestAnimationFrame(() => {
					const inventoryAsset = new InventoryAsset(asset);
					inventoryAsset.BuildSelectedUI();
				});
			};

			const originalSelectItem = unsafeWindow.CInventory.prototype.SelectItem;
			unsafeWindow.CInventory.prototype.SelectItem = function (a, b, asset) {
				const result = originalSelectItem.call(this, ...arguments);

				if (asset.appid == CS2_APPID) {
					handleSelectedAsset(asset);
				}

				return result;
			};

			if (unsafeWindow.g_ActiveInventory.selectedItem?.appid == CS2_APPID) {
				handleSelectedAsset(unsafeWindow.g_ActiveInventory.selectedItem);
			}
		}
		//#endregion
	} else if (currentPage == PAGE_MARKET_LISTING) {
		//#region Market Listings Page
		const IS_CS2_ITEM = !!unsafeWindow.g_rgAppContextData?.[CS2_APPID];
		const HAS_INDIVIDUAL_LISTINGS = Object.values(unsafeWindow.g_rgAssets?.[CS2_APPID]?.[2])[0]?.commodity == 0;

		if (!IS_CS2_ITEM || !HAS_INDIVIDUAL_LISTINGS) {
			return;
		}
		
		{ // Add elements to market listings
			const handleMarketAssets = () => {
				if (!unsafeWindow.g_rgAssets?.[CS2_APPID]?.[2] || !unsafeWindow.g_rgListingInfo) {
					return;
				}

				for (const listing of Object.values(unsafeWindow.g_rgListingInfo)) {
					const asset = unsafeWindow.g_rgAssets[CS2_APPID][2][listing.asset?.id];
					if (!asset) {
						continue;
					}

					const marketAsset = new MarketAsset(asset, listing);
					marketAsset.BuildListingUI();
				}
			};

			const originalOnResponseRenderResults = unsafeWindow.CAjaxPagingControls.prototype.OnResponseRenderResults;
			unsafeWindow.CAjaxPagingControls.prototype.OnResponseRenderResults = function () {
				const result = originalOnResponseRenderResults.call(this, ...arguments);

				handleMarketAssets();

				return result;
			};

			handleMarketAssets();
		}
		//#endregion
	}
})();