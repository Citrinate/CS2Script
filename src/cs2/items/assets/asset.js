import Script, { ERROR_LEVEL } from '@core/script.js';
import { GetSetting, SETTING_INSPECT_CACHE_TIME_HOURS } from '@core/settings.js';
import ASF from '@core/asf.js';
import { WEARS, STICKER_MAX_COUNT } from '@cs2/constants.js';
import Worker from '@utils/worker';
import Cache from '@utils/cache';

import { CreateElement, BindTooltip } from '@utils/helpers.js';

export default class Asset {
	_assetid;
	_type;
	_inspectLink;
	_inspectData;
	_wearData;

	static _inspectionWorker = new Worker({
		concurrentLimit: () => {
			return Script.AccountsConnected;
		}
	});

	static TYPE = {
		WEARABLE: 0,
		KEYCHAIN: 1,
		STORAGE_UNIT: 2,
		OTHER: 3
	};

	ShouldInspect() {
		return this._type == Asset.TYPE.WEARABLE && this._inspectLink != "undefined";
	}

	async _Inspect(options = {}) {
		if (!this.ShouldInspect() || !this._assetid) {
			return;
		}

		const cacheOnly = options.cacheOnly ?? false;

		const cache_id = `item_${this._assetid}`;
		const cache = await Cache.GetValue(cache_id, null);

		if (cache) {
			const ageHours = (+new Date() - cache.created) / 36e5;
			const maxAgeHours = GetSetting(SETTING_INSPECT_CACHE_TIME_HOURS);
			const cacheExpired = maxAgeHours >= 0 && ageHours >= maxAgeHours;

			if (!cacheExpired) {
				this._inspectData = cache;
			}
		}

		if (!this._inspectData) {
			if (cacheOnly) {
				return false;
			}

			let inspectData;

			for (let attempt = 0; attempt < 3; attempt++) {
				try {
					inspectData = await ASF.Send("CS2Interface", "InspectItem", "GET", "ASF", { url: this._inspectLink });

					break;
				} catch (e) {
					if (e.code === 504) {
						Script.ShowError({ level: ERROR_LEVEL.LOW }, e);
					} else {
						throw e;
					}
				}
			}

			if (!inspectData) {
				throw new Error(`Failed to inspect item: ${this._inspectLink}`);
			}

			if (!inspectData.iteminfo) {
				console.log(inspectData);
				throw new Error(`Invalid inspect data, check browser logs, ${this._inspectLink}`);
			}

			this._inspectData = {
				created: +new Date()
			};

			if (typeof inspectData.wear !== "undefined" && typeof inspectData.wear_min !== "undefined" && typeof inspectData.wear_max !== "undefined") {
				this._inspectData.wear = inspectData.wear;
				this._inspectData.wearMin = inspectData.wear_min;
				this._inspectData.wearMax = inspectData.wear_max;
			}

			if (typeof inspectData.iteminfo.paintseed !== "undefined") {
				this._inspectData.seed = inspectData.iteminfo.paintseed;
			}

			if (typeof inspectData.iteminfo.rarity !== "undefined") {
				this._inspectData.rarity = inspectData.iteminfo.rarity;
			}

			if (typeof inspectData.iteminfo.quality !== "undefined") {
				this._inspectData.quality = inspectData.iteminfo.quality;
			}

			if (inspectData.stattrak === true) {
				this._inspectData.stattrak = true;
			}

			if ((inspectData.iteminfo.stickers?.length ?? 0) > 0) {
				this._inspectData.stickers = inspectData.iteminfo.stickers.map((sticker) => sticker.wear ?? 0);
			}

			if ((inspectData.iteminfo.keychains?.length ?? 0) > 0) {
				this._inspectData.charm = inspectData.iteminfo.keychains[0].pattern;
			}

			Cache.SetValue(cache_id, this._inspectData);
		}

		if (typeof this._inspectData.wear !== "undefined") {
			this._wearData = Asset.GetWear(this._inspectData.wear);

			if (!this._wearData) {
				throw new Error(`Invalid item wear: ${this._inspectData.wear}, ${this._inspectLink}`);
			}
		}

		return true;
	}

	static GetWear(wearValue) {
		for (const wear of WEARS) {
			if (wearValue >= wear.min && wearValue <= wear.max) {
				return wear;
			}
		}
	}

	static GetPercentileElement(wear, wearValue, wearMin, wearMax, options = {}) {
		const showTooltip = options.showTooltip ?? false;
		const showRounded = options.rounded ?? true;

		const exteriorWearMin = Math.max(wearMin, wear.min);
		const exteriorWearMax = Math.min(wearMax, wear.max);
		const percentile = (1 - ((wearValue - exteriorWearMin) / (exteriorWearMax - exteriorWearMin))) * 100;
		const percentileRounded = Math.min(99, Math.round(percentile));
		const percentileFixed = Math.min(99.99, parseFloat(percentile.toFixed(2)));
		const bestWear = Asset.GetWear(wearMin);
		const worstWear = Asset.GetWear(wearMax);

		let rank;
		if (wear == bestWear) {
			if (percentileFixed >= 99.9) {
				rank = "gold";
			} else if (percentileFixed >= 99.5) {
				rank = "silver";
			} else if (percentileRounded >= 99) {
				rank = "bronze";
			}
		} else if (wear == worstWear && percentileRounded == 0) {
			rank = "rust";
		}

		const percentileElement = CreateElement("span", {
			text: showRounded ? `(${percentileRounded}%)` : `(${percentileFixed}%)`
		});

		if (rank) {
			percentileElement.classList.add(`cs2s_asset_rank_${rank}`);
		}

		if (showTooltip) {
			BindTooltip(percentileElement, `Better than ${percentileFixed}% of ${wear.nameLong} floats`)
		}

		return percentileElement;
	}

	static GetNumCosmetics(item) {
		if (typeof item.cosmetics !== "undefined") {
			return item.cosmetics;
		}

		let count = 0;

		if (item.keychains) {
			count++;
		}

		if (item.stickers) {
			for (let slotNum = 0; slotNum < STICKER_MAX_COUNT; slotNum++) {
				let stickerID = item.attributes[`sticker slot ${slotNum} id`];
				if (stickerID) {
					count++;
				}
			}
		}

		item.cosmetics = count;

		return item.cosmetics;
	}

	_GetPercentileElement(options = {}) {
		if (!this._inspectData || !this._wearData) {
			return;
		}

		return Asset.GetPercentileElement(this._wearData, this._inspectData.wear, this._inspectData.wearMin, this._inspectData.wearMax, options);
	}

	_GetWearRangeElement(highlightHalfwayPoint = false) {
		if (!this._inspectData.wear) {
			return;
		}

		const wearRangeElement = CreateElement("div", {
			class: "descriptor cs2s_asset_wear_range"
		});

		for (const wear of WEARS) {
			const { wearMin, wearMax, wear: actualWear } = this._inspectData;
			const range = wear.max - wear.min;

			const isMinWear = wearMin > 0 && wearMin >= wear.min && wearMin < wear.max;
			const isMaxWear = wearMax < 1 && wearMax > wear.min && wearMax <= wear.max;
			const isRollableWear = wearMax > wear.min && wearMin < wear.max;

			const wearGroupElement = CreateElement("div", {
				class: `cs2s_asset_wear_range_${wear.name.toLowerCase()}`
			});

			wearRangeElement.append(wearGroupElement);

			if (isMinWear) {
				const percentage = (1 - ((wearMin - wear.min) / range)) * 100;
				wearGroupElement.classList.add("cs2s_asset_wear_range_right");
				wearGroupElement.style.setProperty("--wear-percentage", `${percentage.toFixed(0)}%`);
				wearGroupElement.append(
					CreateElement("div", {
						class: "cs2s_asset_wear_range_low",
						wear_value: wearMin.toFixed(2),
						vars: {
							"wear-percentage": `${percentage.toFixed(0)}%`
						}
					})
				);
			}

			if (isMaxWear) {
				const percentage = ((wearMax - wear.min) / range) * 100;
				wearGroupElement.classList.add("cs2s_asset_wear_range_left");
				wearGroupElement.style.setProperty("--wear-percentage", `${percentage.toFixed(0)}%`);
				wearGroupElement.append(
					CreateElement("div", {
						class: "cs2s_asset_wear_range_high",
						wear_value: wearMax.toFixed(2),
						vars: {
							"wear-percentage": `${percentage.toFixed(0)}%`
						}
					})
				);
			}

			if (isRollableWear && !isMinWear && !isMaxWear) {
				wearGroupElement.classList.add("cs2s_asset_wear_range_full");
			}

			if (!isRollableWear) {
				wearGroupElement.classList.add("cs2s_asset_wear_range_empty");
			}

			if (this._wearData == wear) {
				let percentage;
				if (highlightHalfwayPoint) {
					const halfWayPoint = (Math.min(wear.max, wearMax) + Math.max(wear.min, wearMin)) / 2;
					percentage = ((halfWayPoint - wear.min) / range) * 100;
				} else {
					percentage = ((actualWear - wear.min) / range) * 100;
				}

				wearGroupElement.append(
					CreateElement("div", {
						class: "cs2s_asset_wear_range_marker",
						vars: {
							"wear-percentage": `${percentage.toFixed(0)}%`
						}
					})
				);
			}
		}

		return wearRangeElement;
	}
}
