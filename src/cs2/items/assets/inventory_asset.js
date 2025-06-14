import Script, { ERROR_LEVEL, OPERATION_ERROR } from "@core/script.js";
import { GetSetting, SETTING_INSPECT_ITEMS } from "@core/settings.js";
import Asset from "@cs2/items/assets/asset.js";
import Inventory from "@cs2/items/inventory.js";
import Table from "@components/table.js";
import { CreateElement } from "@utils/helpers.js";

export default class InventoryAsset extends Asset {
	_asset;

	constructor(asset) {
		super();

		this._assetid = asset.assetid;
		this._asset = asset;

		if (asset.description.market_hash_name == "Storage Unit") {
			this._type = Asset.TYPE.STORAGE_UNIT;
		} else {
			for (const tag of asset.description.tags) {
				if (tag.category == "Weapon" || tag.internal_name == "Type_Hands") {
					this._type = Asset.TYPE.WEARABLE;
					break;
				} else if (tag.internal_name == "CSGO_Tool_Keychain") {
					this._type = Asset.TYPE.KEYCHAIN;
					break;
				}
			}
		}

		if (typeof this._type == "undefined") {
			this._type = Asset.TYPE.OTHER;
		}

		if (this._type == Asset.TYPE.WEARABLE) {
			for (const action of asset.description.actions) {
				if (action.link.includes("steam://rungame")) {
					this._inspectLink = action.link.replace("%owner_steamid%", unsafeWindow.g_ActiveUser.strSteamId).replace("%assetid%", asset.assetid);
					break;
				}
			}
		}
	}

	async BuildInventoryUI() {
		// Add UI elements overtop of each item in the inventory
		if (this.ShouldInspect() && GetSetting(SETTING_INSPECT_ITEMS)) {
			// Weapon skins
			const build = () => {
				if (!this._inspectData) {
					return;
				}

				if (this._inspectData.wear && this._wearData) {
					this._asset.element.append(
						CreateElement("div", {
							class: `cs2s_asset_wear cs2s_asset_wear_${this._wearData.name.toLowerCase()}`,
							text: this._inspectData.wear.toFixed(6),
							children: [
								" ",
								this._GetPercentileElement(),
								// createElement("div", {
								// 	class: "cs2s_asset_wear_name",
								// 	text: this._wearData.name
								// })
							]
						})
					);
				}

				if (this._inspectData.seed) {
					this._asset.element.append(
						CreateElement("div", {
							class: "cs2s_asset_seed",
							text: this._inspectData.seed
						})
					);
				}

				if (this._inspectData.rarity) {
					const el = CreateElement("div", {
						class: `cs2s_asset_rarity cs2s_asset_rarity_${this._inspectData.rarity} cs2s_asset_quality_${this._inspectData.quality}`
					});

					if (this._inspectData.stattrak) {
						el.classList.add("cs2s_asset_stattrak");
					}

					this._asset.element.append(el);
				}

				const cosmetics = [];

				for (const description of this._asset.description.descriptions) {
					if (description.name == "sticker_info" || description.name == "keychain_info") {
						const parser = new DOMParser();
						const doc = parser.parseFromString(description.value, 'text/html');

						for (const img of doc.querySelectorAll('img')) {
							cosmetics.push(CreateElement("img", {
								src: img.src
							}));
						}
					}
				}

				if (cosmetics.length > 0) {
					this._asset.element.append(
						CreateElement("div", {
							class: "cs2s_asset_cosmetics",
							children: cosmetics
						})
					);
				}
			}

			let cached;
			try {
				cached = await this._Inspect({ cacheOnly: true });
			} catch (e) {
				Script.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);

				return;
			}

			if (cached) {
				build();
			} else {
				Asset._inspectionWorker.Add(async () => {
					try {
						await this._Inspect();
					} catch (e) {
						Script.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);
	
						return;
					}

					build();
				});

				Asset._inspectionWorker.Run();
			}
		} else if (this._type == Asset.TYPE.KEYCHAIN && GetSetting(SETTING_INSPECT_ITEMS)) {
			// Key chains
			let template;

			for (const description of this._asset.description.descriptions) {
				if (description.name == "attr: keychain slot 0 seed") {
					const matches = description.value.match(/\d+/); // Matches digits in: Charm Template: 1234
					if (matches) {
						template = matches[0];
					}

					break;
				}
			}

			if (template) {
				this._asset.element.appendChild(
					CreateElement("div", {
						class: "cs2s_asset_seed",
						text: template
					})
				);
			}
		} else if (this._type == Asset.TYPE.STORAGE_UNIT) {
			// Storage units
			let nameTag;
			let itemCount;

			for (const description of this._asset.description.descriptions) {
				if (description.name == "nametag") {
					const matches = description.value.match(/.*?''(.*?)''/); // Matches name in: Name Tag: ''Name''

					if (matches) {
						nameTag = matches[1];
					}
				} else if (description.name == "attr: items count") {
					const matches = description.value.match(/\d+/); // Matches number in: Number of Items: 1000

					if (matches) {
						itemCount = matches[0];
					}
				}
			}

			if (nameTag) {
				this._asset.element.append(
					CreateElement("div", {
						class: "cs2s_asset_name",
						text: nameTag
					})
				);
			}

			if (itemCount) {
				this._asset.element.append(
					CreateElement("div", {
						class: "cs2s_asset_quantity",
						text: itemCount
					})
				);
			}
		}
	}

	async BuildSelectedUI() {
		// Add UI elements to the currently selected item in the inventory
		const selectedItem = unsafeWindow.iActiveSelectView;
		const descriptionsElement = unsafeWindow.document.getElementById(`iteminfo${selectedItem}_item_descriptors`);
		const stickerElements = descriptionsElement.getElementsBySelector("#sticker_info img");
		const charmElements = descriptionsElement.getElementsBySelector("#keychain_info img");
		const ownerActionsElement = unsafeWindow.document.getElementById(`iteminfo${selectedItem}_item_owner_actions`);

		if (this.ShouldInspect() && GetSetting(SETTING_INSPECT_ITEMS)) {
			// Weapon skins
			const build = () => {
				if (selectedItem != unsafeWindow.iActiveSelectView
					|| this._asset != unsafeWindow.g_ActiveInventory.selectedItem
					|| !this._inspectData
				) {
					return;
				}

				if (this._inspectData.wear && this._inspectData.seed) {
					descriptionsElement.prepend(
						this._GetWearRangeElement(),
						CreateElement("div", {
							class: "descriptor",
							text: `Float: ${this._inspectData.wear.toFixed(14)}`,
							children: [
								" ",
								this._GetPercentileElement({ showTooltip: true, rounded: false })
							]
						}),
						CreateElement("div", {
							class: "descriptor",
							text: `Seed: ${this._inspectData.seed}`
						}),
						CreateElement("div", {
							class: "descriptor",
							text: "\u00A0"
						})
					);
				}

				if (this._inspectData.stickers) {
					for (let i = 0; i < this._inspectData.stickers.length; i++) {
						if (typeof stickerElements[i] == "undefined") {
							break;
						}

						stickerElements[i].wrap(
							CreateElement("span", {
								class: "cs2s_asset_sticker_wear",
								wear: Math.round(this._inspectData.stickers[i] * 100)
							})
						);
					}
				}

				if (this._inspectData.charm) {
					if (typeof charmElements[0] != "undefined") {
						charmElements[0].wrap(
							CreateElement("span", {
								class: "cs2s_asset_charm_template",
								template: this._inspectData.charm
							})
						);
					}
				}
			}

			let cached;
			try {
				cached = await this._Inspect({ cacheOnly: true });
			} catch (e) {
				Script.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);

				return;
			}

			if (cached) {
				build();
			} else {
				Asset._inspectionWorker.Add(async () => {
					try {
						await this._Inspect();
					} catch (e) {
						Script.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);
	
						return;
					}

					build();
				}, {
					priority: true
				});

				Asset._inspectionWorker.Run();
			}
		} else if (this._type == Asset.TYPE.STORAGE_UNIT) {
			// Storage units
			ownerActionsElement.style.display = "block";
			ownerActionsElement.append(
				CreateElement("a", {
					class: "btn_small btn_grey_white_innerfade",
					html: "<span>Retrieve Items</span>",
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

						const casket = inventory.items.find(x => x.iteminfo.id == this._assetid);

						const table = new Table(inventory.storedItems.filter(x => x.casket_id == this._assetid), inventory, {
							mode: Table.MODE.RETRIEVE,
							casket: casket,
							casketName: casket.attributes["custom name attr"]
						});

						table.Show();
					}
				}),
				CreateElement("a", {
					class: "btn_small btn_grey_white_innerfade",
					html: "<span>Deposit Items</span>",
					onclick: async () => {
						const inventory = await Script.GetInventory({ showProgress: true });

						if (inventory === OPERATION_ERROR.INTERFACE_NOT_CONNECTED) {
							Script.ShowStartInterfacePrompt({
								message: "Interface must be running to fetch inventory items"
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

						const casket = inventory.items.find(x => x.iteminfo.id == this._assetid);

						const table = new Table(inventory.items.filter(x => x.moveable), inventory, {
							mode: Table.MODE.STORE,
							casket: casket,
							casketName: casket.attributes["custom name attr"]
						});

						table.Show();
					}
				})
			);
		}
	}
}