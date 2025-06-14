import Script, { OPERATION_ERROR, ERROR_LEVEL } from '@core/script.js';
import { CS2_APPID } from '@cs2/constants.js';
import Inventory from '@cs2/items/inventory.js';
import InventoryAsset from '@cs2/items/assets/inventory_asset.js';
import MarketAsset from '@cs2/items/assets/market_asset.js';
import Table from '@components/table.js';
import { CreateElement } from '@utils/helpers.js';
import style from '@css/style.css';

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
				const inventoryAsset = new InventoryAsset(asset);
				inventoryAsset.BuildSelectedUI();
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