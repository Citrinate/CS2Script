import Script, { OPERATION_ERROR, ERROR_LEVEL } from '@core/script.js';
import { CS2_APPID } from '@cs2/constants.js';
import Inventory from '@cs2/items/inventory.js';
import InventoryAsset from '@cs2/items/assets/inventory_asset.js';
import Table from '@components/table.js';
import { CreateElement, WaitForElm } from '@utils/helpers.js';

export function HandleShowItemInventory() {
	const initInventory = () => {
		if (initInventory.initialized) {
			return;
		}

		initInventory.initialized = true;
		Script.GetInventory();
	};

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

	const handler = (appid) => {
		if (appid == CS2_APPID) {
			// Preload inventory from interface
			initInventory();

			// Show "open all storage units" button
			!allCratesButton.isConnected && unsafeWindow.document.getElementsByClassName("inventory_rightnav")[0].prepend(allCratesButton);
		} else {
			allCratesButton.isConnected && allCratesButton.remove();
		}
	}

	// Trigger when user switches to a new game's inventory tab
	const originalShowItemInventory = unsafeWindow.ShowItemInventory;
	unsafeWindow.ShowItemInventory = function (appid) {
		const result = originalShowItemInventory.call(this, ...arguments);

		handler(appid);

		return result;
	};

	handler(unsafeWindow.g_ActiveInventory.appid);
}

export function HandleAddInventoryData() {
	const handler = () => {
		if (!handler.handledAssetIDs) {
			handler.handledAssetIDs = new Set();
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
			if (handler.handledAssetIDs.has(assetid)) {
				continue;
			}

			// Add custom elements to the inventory item squares
			handler.handledAssetIDs.add(assetid);
			const inventoryAsset = new InventoryAsset(asset);
			inventoryAsset.BuildInventoryUI();
		}
	};

	// Trigger whenever new items are loaded into the inventory view
	const originalAddInventoryData = unsafeWindow.CInventory.prototype.AddInventoryData;
	unsafeWindow.CInventory.prototype.AddInventoryData = function (data) {
		const result = originalAddInventoryData.call(this, ...arguments);

		if (data?.assets?.[0]?.appid == CS2_APPID) {
			handler();
		}

		return result;
	};

	handler();
}

export function HandleSelectItem() {
	const handler = (asset) => {
		WaitForElm(`#iteminfo${unsafeWindow.iActiveSelectView} > div`).then((element) => {
			// Add custom elements to the selected inventory item
			element.querySelectorAll(`.cs2s_element`).forEach(e => e.remove());
			const inventoryAsset = new InventoryAsset(asset);
			inventoryAsset.BuildSelectedUI();
		});
	};

	// Trigger when user clicks on an inventory item
	const originalSelectItem = unsafeWindow.CInventory.prototype.SelectItem;
	unsafeWindow.CInventory.prototype.SelectItem = function (a, b, asset) {
		const result = originalSelectItem.call(this, ...arguments);

		if (asset.appid == CS2_APPID) {
			handler(asset);
		}

		return result;
	};

	if (unsafeWindow.g_ActiveInventory.selectedItem?.appid == CS2_APPID) {
		handler(unsafeWindow.g_ActiveInventory.selectedItem);
	}
}
