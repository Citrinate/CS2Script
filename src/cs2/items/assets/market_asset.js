import Script, { ERROR_LEVEL } from "@core/script.js";
import { GetSetting, SETTING_INSPECT_ITEMS } from "@core/settings.js";
import Asset from "@cs2/items/assets/asset.js";
import { CreateElement } from "@utils/helpers.js";

export default class MarketAsset extends Asset {
	_listingid;

	static #builtItemPageUI = false;

	constructor(asset, listing) {
		super();

		this._assetid = asset.id;
		this._listingid = listing?.listingid;

		for (const description of asset.descriptions) {
			if (description.name == "exterior_wear") {
				this._type = Asset.TYPE.WEARABLE;
				break;
			}
		}

		if (typeof this._type == "undefined") {
			this._type = Asset.TYPE.OTHER;
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

	async BuildListingUI() {
		if (this.ShouldInspect() && GetSetting(SETTING_INSPECT_ITEMS)) {
			const build = () => {
				if (!this._inspectData) {
					return;
				}

				const listingDetailsElement = unsafeWindow.document.getElementById(`listing_${this._listingid}_details`);
				
				if (!listingDetailsElement) {
					return;
				}

				if (listingDetailsElement.getElementsBySelector(".cs2s_listing_info").length != 0) {
					// Already built the UI for this listing
					return;
				}

				const stickerElements = listingDetailsElement.getElementsBySelector("#sticker_info img");
				const charmElements = listingDetailsElement.getElementsBySelector("#keychain_info img");

				if (this._inspectData.wear && this._inspectData.seed) {
					if (!MarketAsset.#builtItemPageUI) {
						MarketAsset.#builtItemPageUI = true;
						this.#BuiltItemPageUI();
					}

					listingDetailsElement.prepend(
						CreateElement("div", {
							class: "cs2s_listing_info",
							children: [
								CreateElement("div", {
									text: `Float: ${this._inspectData.wear.toFixed(14)}`,
									children: [
										" ",
										this._GetPercentileElement({ showTooltip: true, rounded: false })
									]
								}),
								CreateElement("div", {
									text: `Seed: ${this._inspectData.seed}`
								})
							]
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
								class: "cs2s_asset_sticker_wear cs2s_asset_cosmetic_small",
								wear: Math.round(this._inspectData.stickers[i] * 100)
							})
						);
					}
				}

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
					const listingDetailsElement = unsafeWindow.document.getElementById(`listing_${this._listingid}_details`);
				
					if (!listingDetailsElement) {
						// Listing is no longer visisble
						return;
					}

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

	#BuiltItemPageUI() {
		if (this._inspectData.wear && this._inspectData.seed) {
			const descriptionsElement = unsafeWindow.document.getElementById(`largeiteminfo_item_descriptors`);

			if (descriptionsElement) {
				descriptionsElement.prepend(this._GetWearRangeElement(true));
			}
		}
	}
}