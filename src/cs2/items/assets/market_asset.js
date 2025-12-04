import Script, { ERROR_LEVEL } from "@core/script.js";
import { GetSetting, SETTING_INSPECT_ITEMS } from "@core/settings.js";
import Asset from "@cs2/items/assets/asset.js";
import { CreateElement } from "@utils/helpers.js";

export default class MarketAsset extends Asset {
	_asset;
	_listingid;

	static #builtItemPageUI = false;

	constructor(asset, listing) {
		super();

		this._asset = asset;
		this._assetid = asset.id;
		this._listingid = listing?.listingid;

		for (const description of asset.descriptions) {
			if (description.name == "exterior_wear") {
				this._type = Asset.TYPE.WEARABLE;
				break;
			}
		}

		if (this._type == Asset.TYPE.WEARABLE) {
			for (const action of asset.market_actions) {
				if (action.link.includes("steam://rungame")) {
					this._inspectLink = action.link.replace("%assetid%", this._assetid);
					break;
				}
			}
		}
	}

	// Add additional information to each individual listing
	async BuildListingUI() {
		const listingDetailsElement = unsafeWindow.document.getElementById(`listing_${this._listingid}_details`);
		const stickerElements = listingDetailsElement.getElementsBySelector("#sticker_info img");
		const charmElements = listingDetailsElement.getElementsBySelector("#keychain_info img");

		// Weapon skins
		if (this.ShouldInspect() && GetSetting(SETTING_INSPECT_ITEMS)) {				
			const float = parseFloat(this.GetProperty(2)?.float_value);
			const seed = this.GetProperty(1)?.int_value;

			// Build elements
			let floatElement;
			if ((float || float === 0) && (seed || seed === 0)) {
				floatElement = CreateElement("div", {
					text: `Float: ${float.toFixed(14)}`
				});

				listingDetailsElement.prepend(
					CreateElement("div", {
						class: "cs2s_listing_info",
						children: [
							floatElement,
							CreateElement("div", {
								text: `Seed: ${seed}`
							})
						]
					})
				);
			}

			// Inspect item
			const build = () => {
				if (!this._inspectData) {
					return;
				}

				this.#BuildItemPageUI();

				if (!listingDetailsElement.isConnected) {
					// Listing is no longer visible
					return;
				}

				// Update float element with percentile info
				if (floatElement && this._inspectData.wear && this._inspectData.seed) {
					if (floatElement && this._inspectData.wear && this._wearData) {
						floatElement.innerText = `Float: ${this._inspectData.wear.toFixed(14)}`;
						floatElement.append(" ", this._GetPercentileElement({ showTooltip: true, rounded: false }));
					}
				}

				// Add wear % to stickers
				if (this._inspectData.stickers) {
					for (let i = 0; i < this._inspectData.stickers.length; i++) {
						if (typeof stickerElements[i] == "undefined") {
							break;
						}

						stickerElements[i].wrap(
							CreateElement("span", {
								class: "cs2s_asset_sticker_wear cs2s_asset_cosmetic_small",
								wear: Math.round(this._inspectData.stickers[i] * 100)
							})
						);
					}
				}

				// Add template # to charm
				if (this._inspectData.charm) {
					if (typeof charmElements[0] != "undefined") {
						charmElements[0].wrap(
							CreateElement("span", {
								class: "cs2s_asset_charm_template cs2s_asset_cosmetic_small",
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
				});

				Asset._inspectionWorker.Run();
			}
		}
	}

	// Add general item information to the top of the page
	#BuildItemPageUI() {
		if (MarketAsset.#builtItemPageUI) {
			return;
		}

		MarketAsset.#builtItemPageUI = true;

		if (this._inspectData.wear && this._inspectData.seed) {
			const descriptionsElement = unsafeWindow.document.querySelector(".largeiteminfo_react_placeholder > div > div > div > div > div:nth-child(2) > div:nth-child(3)");

			if (descriptionsElement) {
				descriptionsElement.prepend(this._GetWearRangeElement(true));
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
}
