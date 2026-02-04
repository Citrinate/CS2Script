import Script, { ERROR_LEVEL, OPERATION_ERROR } from "@core/script.js";
import { GetSetting, SETTING_INSPECT_ITEMS } from "@core/settings.js";
import Asset from "@cs2/items/assets/asset.js";
import Inventory from "@cs2/items/inventory.js";
import ItemTable from "@components/item_table.js";
import LabelPopup from "@components/label_popup";
import { CreateElement } from "@utils/helpers.js";
import Worker from '@utils/worker';
import { QUALITIES, RARITIES } from "@cs2/constants";

export default class InventoryAsset extends Asset {
	_asset;
	#isTradeProtected;

	static #inventoryWorker = new Worker({
		concurrentLimit: 100
	});

	constructor(asset) {
		super();

		this._asset = asset;
		this._assetid = asset.assetid;
		this.#isTradeProtected = asset.contextid == 16;

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

		if (this._type == Asset.TYPE.WEARABLE) {
			for (const action of asset.description.actions) {
				if (action.link.includes("steam://rungame")) {
					this._inspectLink = action.link.replace("%owner_steamid%", unsafeWindow.g_ActiveUser.strSteamId).replace("%assetid%", asset.assetid);
					break;
				}
			}
		}
	}

	// Add additional information to each inventory item square
	async BuildInventoryUI() {
		// Weapon Skins
		if (this.ShouldInspect() && GetSetting(SETTING_INSPECT_ITEMS)) {
			const float = parseFloat(this.GetProperty(2)?.float_value);
			const seed = this.GetProperty(1)?.int_value;
			const rarity = RARITIES[this.GetTags("Rarity")[0]?.internal_name];
			const qualities = this.GetTags("Quality").map(tag => QUALITIES[tag.internal_name]);
			const unusual = qualities.includes(3);
			const stattrak = qualities.includes(9);
			const souvenir = qualities.includes(12);
			const keychainInfo = this.GetDescription("keychain_info");
			const stickerInfo = this.GetDescription("sticker_info");

			// Build elements
			let floatElement;
			if (float || float === 0) {
				floatElement = CreateElement("div", {
					class: `cs2s_asset_wear cs2s_asset_wear_${Asset.GetWear(float).name.toLowerCase()}`,
					text: float.toFixed(this.#isTradeProtected ? 7 : 11)
				});

				this._asset.element.append(floatElement);
			}

			if (seed || seed === 0) {
				this._asset.element.append(
					CreateElement("div", {
						class: "cs2s_asset_seed",
						text: seed
					})
				);
			}

			if (rarity || rarity === 0) {
				const rarityElement = CreateElement("div", {
					class: `cs2s_asset_rarity cs2s_asset_rarity_${rarity}`
				});

				if (unusual) {
					rarityElement.classList.add("cs2s_asset_unusual");
				}

				if (stattrak) {
					rarityElement.classList.add("cs2s_asset_stattrak");
				}

				if (souvenir) {
					rarityElement.classList.add("cs2s_asset_souvenir");
				}

				this._asset.element.append(rarityElement);
			}

			if (keychainInfo || stickerInfo) {
				const keychainElements = [];
				if (keychainInfo) {
					const parser = new DOMParser();
					const doc = parser.parseFromString(keychainInfo, 'text/html');

					for (const img of doc.querySelectorAll('img')) {
						keychainElements.push(CreateElement("img", {
							src: img.src
						}));
					}
				}

				const stickerElements = [];
				if (stickerInfo) {
					const parser = new DOMParser();
					const doc = parser.parseFromString(stickerInfo, 'text/html');

					for (const img of doc.querySelectorAll('img')) {
						stickerElements.push(CreateElement("img", {
							src: img.src
						}));
					}
				}

				if (keychainElements.length > 0 || stickerElements.length > 0) {
					this._asset.element.append(
						CreateElement("div", {
							class: "cs2s_asset_cosmetics" + (this.#isTradeProtected ? " cs2s_asset_trade_protected" : ""),
							children: [...keychainElements, ...stickerElements]
						})
					);
				}
			}

			// Inspect item
			{
				const build = () => {
					if (!this._inspectData) {
						return;
					}

					// Update float element with percentile info
					if (floatElement && this._inspectData.wear && this._wearData) {
						floatElement.innerText = this._inspectData.wear.toFixed(this.#isTradeProtected ? 2 : 6);
						floatElement.append(" ", this._GetPercentileElement());
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
			}
		}
		// Charms
		else if (this._type == Asset.TYPE.KEYCHAIN && GetSetting(SETTING_INSPECT_ITEMS)) {
			const template = this.GetProperty(3)?.int_value;

			if (template) {
				this._asset.element.append(
					CreateElement("div", {
						class: "cs2s_asset_seed",
						text: template
					})
				);
			}
		}
		// Storage Units
		else if (this._type == Asset.TYPE.STORAGE_UNIT) {
			const itemCount = this.GetDescription("attr: items count", /\d+/)?.[0]; // Matches digits in: Number of Items: 1000

			if (itemCount) {
				this._asset.element.append(
					CreateElement("div", {
						class: "cs2s_asset_quantity",
						text: itemCount
					})
				);
			}

			// Wait for inventory to load
			InventoryAsset.#inventoryWorker.Add(async () => {
				const inventory = await Script.GetInventory();
				if (!(inventory instanceof Inventory)) {
					return;
				}

				// Add name tag element
				const nameTag = inventory.items.find(x => x.iteminfo.id == this._assetid)?.attributes["custom name attr"];

				if (nameTag) {
					this._asset.element.append(
						CreateElement("div", {
							class: "cs2s_asset_name",
							text: nameTag
						})
					);
				}
			});

			InventoryAsset.#inventoryWorker.Run();
		}
	}

	// Add additional information the currently selected inventory item
	async BuildSelectedUI() {
		const selectedItem = unsafeWindow.iActiveSelectView;
		const descriptionsElement = unsafeWindow.document.getElementById(`iteminfo${selectedItem}`).querySelector(":scope > div > div > div:nth-child(5)");
		const stickerElements = descriptionsElement.getElementsBySelector("#sticker_info img");
		const charmElements = descriptionsElement.getElementsBySelector("#keychain_info img");
		const ownerActionsElement = unsafeWindow.document.getElementById(`iteminfo${selectedItem}`).querySelector(":scope > div > div > div:nth-child(7)");

		// Weapon skins
		if (this.ShouldInspect() && GetSetting(SETTING_INSPECT_ITEMS)) {
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
							class: "cs2s_descriptor cs2s_element",
							text: `Float: ${this._inspectData.wear.toFixed(14)}`,
							children: [
								" ",
								this._GetPercentileElement({ showTooltip: true, rounded: false })
							]
						}),
						CreateElement("div", {
							class: "cs2s_descriptor cs2s_element",
							text: `Seed: ${this._inspectData.seed}`
						}),
						CreateElement("div", {
							class: "cs2s_descriptor cs2s_element",
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
								class: "cs2s_asset_sticker_wear cs2s_element",
								wear: Math.round(this._inspectData.stickers[i] * 100)
							})
						);
					}
				}

				if (this._inspectData.charm) {
					if (typeof charmElements[0] != "undefined") {
						charmElements[0].wrap(
							CreateElement("span", {
								class: "cs2s_asset_charm_template cs2s_element",
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
		}
		// Storage units
		else if (this._type == Asset.TYPE.STORAGE_UNIT) {
			const isLabeled = !!this.GetDescription("attr: items count");
			if (isLabeled) {
				ownerActionsElement.classList.add("cs2s_button_row");
				ownerActionsElement.append(
					CreateElement("a", {
						class: "cs2s_small_grey_button cs2s_element",
						html: "<span>Retrieve Items</span>",
						onclick: async () => {
							const inventory = await Script.GetInventory({ showProgress: true });

							if (inventory === OPERATION_ERROR.INTERFACE_NOT_CONNECTED) {
								Script.ShowStartInterfacePrompt({
									message: "Inventory not cached.  Please start the interface",
									fade: false
								});

								return;
							}

							if (inventory === OPERATION_ERROR.FAILED_TO_LOAD) {
								Script.ShowError({ level: ERROR_LEVEL.HIGH }, new Error("Inventory failed to load, check error logs and refresh the page to try again"));

								return;
							}

							if (!(inventory instanceof Inventory)) {
								return;
							}

							const casket = inventory.items.find(x => x.iteminfo.id == this._assetid);

							if (!casket) {
								Script.ShowStartInterfacePrompt({
									message: "Storage unit not cached.  Please start the interface",
									autoClose: true,
									popoverMode: true,
									fade: false,
									onconnected: () => {
										window.location.reload();
									}
								});

								return;
							}

							const casketItems = inventory.storedItems.filter(x => x.casket_id == this._assetid);

							if (casketItems.length == 0) {
								Script.ShowMessage({}, "Storage Unit is empty");

								return;
							}

							const table = new ItemTable(casketItems, inventory, {
								mode: ItemTable.MODE.RETRIEVE,
								casket: casket,
								casketName: casket.attributes["custom name attr"]
							});

							table.Show();
						}
					}),
					CreateElement("a", {
						class: "cs2s_small_grey_button cs2s_element",
						html: "<span>Deposit Items</span>",
						onclick: async () => {
							const inventory = await Script.GetInventory({ showProgress: true });

							if (inventory === OPERATION_ERROR.INTERFACE_NOT_CONNECTED) {
								Script.ShowStartInterfacePrompt({
									message: "Inventory not cached.  Please start the interface"
								});

								return;
							}

							if (inventory === OPERATION_ERROR.FAILED_TO_LOAD) {
								Script.ShowError({ level: ERROR_LEVEL.HIGH }, new Error("Inventory failed to load, check error logs and refresh the page to try again"));

								return;
							}

							if (!(inventory instanceof Inventory)) {
								return;
							}

							const casket = inventory.items.find(x => x.iteminfo.id == this._assetid);

							if (!casket) {
								Script.ShowStartInterfacePrompt({
									message: "Storage unit not cached.  Please start the interface",
									autoClose: true,
									popoverMode: true,
									fade: false,
									onconnected: () => {
										window.location.reload();
									}
								});

								return;
							}

							const moveableItems = inventory.items.filter(x => x.moveable);

							if (moveableItems.length == 0) {
								Script.ShowMessage({}, "Inventory has no storable items");

								return;
							}

							const table = new ItemTable(moveableItems, inventory, {
								mode: ItemTable.MODE.STORE,
								casket: casket,
								casketName: casket.attributes["custom name attr"]
							});

							table.Show();
						}
					}),
					CreateElement("a", {
						class: "cs2s_small_grey_button cs2s_element",
						html: "<span>Change Label</span>",
						onclick: async () => {
							const inventory = await Script.GetInventory({ showProgress: true });

							if (inventory === OPERATION_ERROR.INTERFACE_NOT_CONNECTED) {
								Script.ShowStartInterfacePrompt({
									message: "Inventory not cached.  Please start the interface"
								});

								return;
							}

							if (inventory === OPERATION_ERROR.FAILED_TO_LOAD) {
								Script.ShowError({ level: ERROR_LEVEL.HIGH }, new Error("Inventory failed to load, check error logs and refresh the page to try again"));

								return;
							}

							if (!(inventory instanceof Inventory)) {
								return;
							}

							const casket = inventory.items.find(x => x.iteminfo.id == this._assetid);

							if (!casket) {
								Script.ShowStartInterfacePrompt({
									message: "Storage unit not cached.  Please start the interface",
									autoClose: true,
									popoverMode: true,
									fade: false,
									onconnected: () => {
										window.location.reload();
									}
								});

								return;
							}

							const nameForm = new LabelPopup(casket, inventory);

							nameForm.Show();
						}
					})
				);

				// Wait for inventory to load to display label
				InventoryAsset.#inventoryWorker.Add(async () => {
					const inventory = await Script.GetInventory();
					if (!(inventory instanceof Inventory)) {
						return;
					}

					if (selectedItem != unsafeWindow.iActiveSelectView
						|| this._asset != unsafeWindow.g_ActiveInventory.selectedItem
					) {
						return;
					}

					// Display storage unit name
					const nameTag = inventory.items.find(x => x.iteminfo.id == this._assetid)?.attributes["custom name attr"];
					if (nameTag) {
						descriptionsElement.prepend(
							CreateElement("div", {
								class: "cs2s_descriptor_blue cs2s_element",
								text: `Name Tag: "${nameTag}"`
							}),
							CreateElement("div", {
								class: "cs2s_descriptor cs2s_element",
								text: "\u00A0"
							})
						);
					}
				});

				InventoryAsset.#inventoryWorker.Run();
			} else {
				// New unlabeled storage unit (must be labeled before it can be used)
				ownerActionsElement.classList.add("cs2s_button_row");
				ownerActionsElement.append(
					CreateElement("a", {
						class: "cs2s_small_grey_button cs2s_element",
						html: "<span>Start Using This Unit</span>",
						onclick: async () => {
							const inventory = await Script.GetInventory({ showProgress: true });

							if (inventory === OPERATION_ERROR.INTERFACE_NOT_CONNECTED) {
								Script.ShowStartInterfacePrompt({
									message: "Inventory not cached.  Please start the interface"
								});

								return;
							}

							if (inventory === OPERATION_ERROR.FAILED_TO_LOAD) {
								Script.ShowError({ level: ERROR_LEVEL.HIGH }, new Error("Inventory failed to load, check error logs and refresh the page to try again"));

								return;
							}

							if (!(inventory instanceof Inventory)) {
								return;
							}

							const casket = inventory.items.find(x => x.iteminfo.id == this._assetid);

							if (!casket) {
								Script.ShowStartInterfacePrompt({
									message: "Storage unit not cached.  Please start the interface",
									autoClose: true,
									popoverMode: true,
									fade: false,
									onconnected: () => {
										window.location.reload();
									}
								});

								return;
							}

							const nameForm = new LabelPopup(casket, inventory);

							nameForm.Show();							
						}
					})
				);
			}
		}
	}

	GetDescription(name, regex = null) {
		if (!this._asset.description?.descriptions) {
			return;
		}

		for (const description of this._asset.description.descriptions) {
			if (description.name == name) {
				if (regex) {
					const matches = description.value.match(regex);
					if (!matches) {
						return null;
					}

					return matches;
				}

				return description.value;
			}
		}
	}

	GetProperty(id) {
		if (!this._asset.asset_properties) {
			return;
		}

		for (const property of this._asset.asset_properties) {
			if (property.propertyid == id) {
				return property;
			}
		}
	}

	GetTags(category) {
		if (!this._asset.description?.tags) {
			return;
		}

		let tags = [];
		for (const tag of this._asset.description.tags) {
			if (tag.category == category) {
				tags.push(tag);
			}
		}

		return tags;
	}
}
