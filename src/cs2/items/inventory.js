import Script, { ERROR_LEVEL, OPERATION_ERROR } from '@core/script.js';
import ASF from '@core/asf.js';
import { CS2_APPID } from '@cs2/constants.js';
import Cache from '@utils/cache';
import { Sleep } from '@utils/helpers.js';
import Icons from './icons';

export default class Inventory {
	items;
	storedItems;
	loadedFromCache;

	constructor(items, loadedFromCache = false) {
		this.items = items;
		this.storedItems = [];
		this.loadedFromCache = loadedFromCache;
	}

	async LoadCrateContents(progressCallback) {
		let cratesOpened = 0;
		const numCrates = this.items.filter(item => item.iteminfo.def_index === 1201).length;

		progressCallback(`Loading Storage Unit Contents (${cratesOpened}/${numCrates})`, cratesOpened / numCrates);

		await Icons.LoadCachedIcons();

		for (const item of this.items) {
			// Get crate contents
			if (item.iteminfo.def_index == 1201) {
				const storedItems = await this.#OpenCrate(item);

				if (storedItems) {
					this.storedItems = this.storedItems.concat(storedItems);
				}

				cratesOpened++;
				progressCallback(`Loading Storage Unit Contents (${cratesOpened}/${numCrates})`, cratesOpened / numCrates);
			}

			// Cache icons for items already in our inventory
			if (!Icons.URLs[item.full_name]) {
				const asset = unsafeWindow.g_rgAppContextData[CS2_APPID].rgContexts[2].inventory.m_rgAssets[item.iteminfo.id];

				if (asset) {
					Icons.SetIcon(item.full_name, asset.description.icon_url);
				}
			}
		}

		// Build a list of all the items we need to get icons for
		const itemsToGetIconsFor = new Set();
		const commodityItemsToGetIconsFor = new Set();

		for (const item of [...this.items, ...this.storedItems]) {
			item.id = item.iteminfo.id;
			item.name = !!item.wear_name && item.full_name.includes(item.wear_name) ? item.full_name.slice(0, -(item.wear_name.length + 3)) : item.full_name;
			item.name_normalized = !item.name ? undefined : item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
			item.collection_name = item.set_name ?? item.crate_name?.replace(/( Autograph Capsule)$/, " Autographs").replace(/( Capsule)$/, "");
			item.collection = item.collection_name?.replace(/^(The )/, "").replace(/( Collection)$/, "").replace(/^(Operation )/, "").replace(/( Autographs)$/, "");
			item.rarity = item.collection || item.iteminfo.rarity > 1 ? item.iteminfo.rarity : undefined; // leave rarity undefined for crates and such items for sorting purposes
			item.seed = item.attributes["set item texture seed"] ? Math.floor(item.attributes["set item texture seed"]) : item.attributes["keychain slot 0 seed"];

			// Correct for item qualities having wierd unsortable values
			if (item.iteminfo.quality == 3) {
				// ★ items
				item.quality = 4 + Number(item.stattrak === true); // 4 for ★, 5 for ★ StatTrak
			} else if (item.iteminfo.quality == 12) {
				// Souvenir items
				item.quality = 1;
			} else if (item.iteminfo.quality == 13) {
				// Highlight items
				item.quality = 3;
			} else {
				item.quality = Number(item.stattrak === true) * 2; // 0 for Normal, 2 for StatTrak
			}

			if (item.casket_id) {
				item.casket_name = this.items.find(x => x.iteminfo.id == item.casket_id)?.attributes["custom name attr"] ?? item.casket_id;
			}

			if (item.stickers) {
				for (const sticker of Object.values(item.stickers)) {
					if (Icons.URLs[sticker.full_name] || Icons.URLs[sticker.full_name] === null) {
						continue;
					}

					commodityItemsToGetIconsFor.add(sticker.full_name);
				}
			}

			if (item.keychains) {
				for (const keychain of Object.values(item.keychains)) {
					if (Icons.URLs[keychain.full_name] || Icons.URLs[keychain.full_name] === null) {
						continue;
					}

					itemsToGetIconsFor.add(keychain.full_name);
				}
			}

			if (!item.moveable || Icons.URLs[item.full_name] || Icons.URLs[item.full_name] === null) {
				continue;
			}

			if (item.commodity) {
				commodityItemsToGetIconsFor.add(item.full_name);
			} else {
				itemsToGetIconsFor.add(item.full_name);
			}
		}

		// Attempt to get commodity icons in batches from the multisell page
		await Icons.FetchMarketCommodityIcons(commodityItemsToGetIconsFor, progressCallback);

		// Get everything else individually from market listing pages, including failed commodity fetches
		await Icons.FetchMarketIcons(new Set([...itemsToGetIconsFor, ...commodityItemsToGetIconsFor]), progressCallback);
	}

	async #OpenCrate(item) {
		if (item.iteminfo.def_index != 1201) {
			return;
		}

		const assetID = item.iteminfo.id
		const attributes = item.attributes;

		const cache_id = `crate_${assetID}`;
		const cache = await Cache.GetValue(cache_id, null);

		if (cache) {
			if (this.loadedFromCache 
				|| (
					cache.attributes["modification date"] >= attributes["modification date"] 
					&& cache.attributes["items count"] == attributes["items count"]
				)
			) {
				// the cached casket contents are still fresh
				return cache.items;
			}
		}

		if (this.loadedFromCache) {
			const error = new Error(`Failed to load crate ${assetID} from cache`);
			error.OPERATION_ERROR = OPERATION_ERROR.INTERFACE_NOT_CONNECTED;

			throw error;
		}

		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const storedItems = await ASF.Send("CS2Interface", `GetCrateContents/${assetID}`, "GET", Script.Bot.ASF.BotName);

				if (!storedItems) {
					break;
				}

				const crate = {
					attributes: attributes,
					items: storedItems
				};

				Cache.SetValue(cache_id, crate);

				await Sleep(2000); // Delay the next GetCrateContents request

				return storedItems;
			} catch (e) {
				Script.ShowError({ level: ERROR_LEVEL.LOW }, e);

				if (e.code === 504) {
					Script.ShowError({ level: ERROR_LEVEL.LOW }, new Error("Timed out while opening storage unit, reconnecting to interface"));

					if (!await Script.RestartInterface({ showProgress: false, errorLevel: ERROR_LEVEL.LOW })) {
						break;
					}
				}
			}
		}

		const error = new Error(`Failed to open crate ${assetID}`);
		error.OPERATION_ERROR = OPERATION_ERROR.FAILED_TO_LOAD;

		throw error;
	}

	async StoreItem(asset, crateAsset) {
		const result = await ASF.Send("CS2Interface", `StoreItem/${crateAsset.iteminfo.id}/${asset.iteminfo.id}`, "GET", Script.Bot.ASF.BotName);

		// Update cached data now to avoid having to request the full contents of the storage unit on next reload
		if (result.Success) {
			const casket_cache_id = `crate_${crateAsset.iteminfo.id}`;
			const casket_cache = await Cache.GetValue(casket_cache_id, null);
			const inventory_cache_id = `inventory_${unsafeWindow.g_steamID}`;
			const inventory_cache = await Cache.GetValue(inventory_cache_id, null);

			if (!casket_cache || !inventory_cache) {
				return;
			}

			// Update cached storage unit data
			asset.casket_id = crateAsset.iteminfo.id;
			casket_cache.items.push(asset);
			casket_cache.items.sort((a, b) => b.iteminfo.id - a.iteminfo.id);
			casket_cache.attributes["items count"]++;
			casket_cache.attributes["modification date"] = Math.floor(Date.now() / 1000);
			Cache.SetValue(casket_cache_id, casket_cache);

			// Update cached inventory data
			const index = inventory_cache.findIndex(obj => obj.iteminfo.id === asset.iteminfo.id);
			inventory_cache.splice(index, 1);
			Cache.SetValue(inventory_cache_id, inventory_cache);
		}
	}

	async RetrieveItem(asset) {
		const result = await ASF.Send("CS2Interface", `RetrieveItem/${asset.casket_id}/${asset.iteminfo.id}`, "GET", Script.Bot.ASF.BotName);

		// Update cached data now to avoid having to request the full contents of the storage unit on next reload
		if (result.Success) {
			const casket_cache_id = `crate_${asset.casket_id}`;
			const casket_cache = await Cache.GetValue(casket_cache_id, null);
			const inventory_cache_id = `inventory_${unsafeWindow.g_steamID}`;
			const inventory_cache = await Cache.GetValue(inventory_cache_id, null);

			if (!casket_cache || !inventory_cache) {
				return;
			}

			// Update cached storage unit data
			const index = casket_cache.items.findIndex(obj => obj.iteminfo.id === asset.iteminfo.id);
			casket_cache.items.splice(index, 1);
			casket_cache.attributes["items count"]--;
			casket_cache.attributes["modification date"] = Math.floor(Date.now() / 1000);
			Cache.SetValue(casket_cache_id, casket_cache);

			// Update cached inventory data
			delete asset.casket_id;
			inventory_cache.push(asset);
			inventory_cache.sort((a, b) => b.iteminfo.id - a.iteminfo.id);
			Cache.SetValue(inventory_cache_id, inventory_cache);
		}
	}

	async LabelStorageUnit(casket, name) {
		const result = await ASF.Send("CS2Interface", `NameItem`, "GET", Script.Bot.ASF.BotName, { itemID: casket.iteminfo.id, name: name });

		// Update cached data now to avoid having to request the full contents of the storage unit on next reload
		if (result.Success) {
			const casket_cache_id = `crate_${casket.iteminfo.id}`;
			const casket_cache = await Cache.GetValue(casket_cache_id, null);

			if (!casket_cache) {
				return;
			}

			// Update cached storage unit data
			casket_cache.attributes["modification date"] = Math.floor(Date.now() / 1000);
			Cache.SetValue(casket_cache_id, casket_cache);
		}
	}
}
