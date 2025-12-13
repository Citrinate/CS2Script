import Script, { ERROR_LEVEL } from '@core/script.js';
import ASF from '@core/asf.js';
import { CS2_APPID } from '@cs2/constants.js';
import { Request, Sleep, Random } from '@utils/helpers.js';
import Cache from "@utils/cache";

export default class Icons {
	static URLs = {};
	static #cacheID = "icon_urls";

	static async LoadCachedIcons() {
		if (Object.keys(Icons.URLs).length != 0) {
			return;
		}

		this.URLs = await Cache.GetValue(this.#cacheID, {});
	}

	static SetIcon(hash, icon_url) {
		this.URLs[hash] = icon_url;
		Cache.SetValue(this.#cacheID, this.URLs);
	}

	static GetIconURL(hash, size) {
		if (!this.URLs[hash]) {
			return null;
		}

		return `https://community.fastly.steamstatic.com/economy/image/${this.URLs[hash]}/${size}`;
	}

	// Scrape icon urls from market listing pages
	static async FetchMarketIcons(hashes, progressCallback) {
		if (hashes.size == 0) {
			return;
		}

		const iconsToFetch = hashes.size;
		let iconsFetched = 0;

		progressCallback("Fetching Item Icons", 0);

		for (const hash of hashes) {
			let success = false;

			const url = `${window.location.origin}/market/listings/${CS2_APPID}/${encodeURIComponent(hash)}`;

			for (let attempt = 0; attempt < 5; attempt++) {
				try {
					const listingPage = await Request(url);

					if (listingPage.includes("g_rgAssets = []")) {
						// Error page
						if (!listingPage.includes("Market_LoadOrderSpread")) {
							// Item does not exist: "There are no listings for this item." error page
							success = true;
							this.SetIcon(hash, null);
							hashes.delete(hash);

							continue;
						}
						
						await Sleep(Random(1000, 2000));
						continue;
					}

					const matches = listingPage.match(/g_rgAssets\s*=\s*({.*?});/);

					if (!matches) {
						Script.ShowError({ level: ERROR_LEVEL.LOW }, new Error(`Failed to find g_rgAssets at ${url}`));
						console.log(listingPage);

						return;
					}

					if (matches.length > 1) {
						let assets;
						try {
							assets = JSON.parse(matches[1]);
						} catch {
							Script.ShowError({ level: ERROR_LEVEL.LOW }, new Error(`Failed to parse g_rgAssets at ${url}`));
							console.log(matches);

							return;
						}

						const asset = Object.values(assets?.[CS2_APPID]?.[2] ?? assets?.[CS2_APPID]?.[0] ?? {})?.[0];

						if (asset?.icon_url) {
							success = true;
							this.SetIcon(hash, asset?.icon_url);
							hashes.delete(hash);
						}
					}

					break;
				} catch (e) {
					Script.ShowError({ level: ERROR_LEVEL.LOW }, e);
					await Sleep(Random(1000, 2000));
				}
			}

			if (!success) {
				Script.ShowError({ level: ERROR_LEVEL.LOW }, new Error(`Failed to get item icon at ${url}`));
			}

			iconsFetched++;
			progressCallback(`Fetching Item Icons (${iconsFetched}/${iconsToFetch})`, iconsFetched / iconsToFetch);
		}
	}

	// Scrape icon urls in batches from the multisell page (only works with commodity items)
	static async FetchMarketCommodityIcons(hashes, progressCallback) {
		if (hashes.size == 0) {
			return;
		}

		const itemLimit = 25; // Can go up to 100, but the higher this number is the more often the page will return an error

		const chunkedHashes = Array.from(
			{ length: Math.ceil(hashes.size / itemLimit) },
			(_, index) => [...hashes].slice(index * itemLimit, (index + 1) * itemLimit)
		);

		const iconsToFetch = hashes.size;
		let iconsFetched = 0;

		progressCallback("Fetching Commodity Item Icons", 0);

		for (const chunk of chunkedHashes) {
			const query = new URLSearchParams({
				appid: String(CS2_APPID),
				contextid: "2"
			});

			for (const hash of chunk) {
				query.append("items[]", hash);
			}

			const url = `${window.location.origin}/market/multisell?${query.toString()}`;

			let success = false;

			// This page returns errors very frequently
			for (let attempt = 0; attempt < 5; attempt++) {
				try {
					const multiSellPage = await Request(url);

					if (multiSellPage.includes("error_ctn")) {
						continue;
					}

					const matches = multiSellPage.match(/g_rgAssets\s*=\s*({.*?});/)

					if (!matches) {
						Script.ShowError({ level: ERROR_LEVEL.LOW }, new Error(`Failed to find g_rgAssets at ${url}`));
						console.log(multiSellPage);

						return;
					}

					if (matches.length > 1) {
						let assets;
						try {
							assets = JSON.parse(matches[1]);
						} catch (e) {
							Script.ShowError({ level: ERROR_LEVEL.LOW }, e, new Error(`Failed to parse g_rgAssets at ${url}`));
							console.log(matches);

							return;
						}

						for (const asset of Object.values(assets?.[CS2_APPID]?.[2])) {
							for (const hash of chunk) {
								if (asset?.description?.market_hash_name == hash && asset?.description?.icon_url) {
									this.SetIcon(hash, asset.description.icon_url);
									hashes.delete(hash);
									break;
								}
							}
						}

						success = true;
					}

					break;
				} catch (e) {
					Script.ShowError({ level: ERROR_LEVEL.LOW }, e);
					await Sleep(Random(1000, 2000));
				}
			}

			if (!success) {
				Script.ShowError({ level: ERROR_LEVEL.LOW }, new Error(`Failed to get item icons at ${url}`));
			}

			iconsFetched += chunk.length;
			progressCallback(`Fetching Commodity Item Icons (${iconsFetched}/${iconsToFetch})`, iconsFetched / iconsToFetch);
		}
	}

	static async FetchStoreIcons(hashes, hashToDefIDMap, progressCallback) {
		if (hashes.size == 0) {
			return;
		}

		progressCallback("Fetching Store Item Icons", 0);

		// Convert def_indexes to classIDs
		const classIDsToGetIconsFor = new Set();
		{
			let assets;
			try {
				const assetPrices = await ASF.Send("CS2Interface", `GetAssetPrices`, "GET", "ASF");

				if (!assetPrices?.result?.success || !assetPrices?.result?.assets) {
					console.log(assetPrices);
					throw new Error(`Failed to get store asset data`);
				}

				assets = assetPrices.result.assets;
			} catch (e) {
				Script.ShowError({ level: ERROR_LEVEL.LOW }, e);

				return;
			}

			const defIDs = new Set(Object.values(hashToDefIDMap));			
			
			for (const asset of assets) {
				const defID = Number(asset.class.find(x => x.name == "def_index").value);
				if (!defID || !defIDs.has(defID)) {
					continue;
				}

				classIDsToGetIconsFor.add(asset.classid);
			}
		}

		// Get the icon for each classID
		if (classIDsToGetIconsFor.size == 0) {
			return;
		}

		const sizeLimit = 100;

		const chunkedClassIDs = Array.from(
			{ length: Math.ceil(classIDsToGetIconsFor.size / sizeLimit) },
			(_, index) => [...classIDsToGetIconsFor].slice(index * sizeLimit, (index + 1) * sizeLimit)
		);

		const iconsToFetch = classIDsToGetIconsFor.size;
		let iconsFetched = 0;

		for (const chunk of chunkedClassIDs) {
			let assets;
			try {
				const assetClassInfo = await ASF.Send("CS2Interface", `GetAssetClassInfo`, "GET", "ASF", { classIDs: chunk.join(',') });

				if (!assetClassInfo.result.success) {
					// API success is false for partial success.  Should still attempt to process this response
					Script.ShowError({ level: ERROR_LEVEL.LOW }, assets.error);
				}

				assets = assetClassInfo.result;
			} catch (e) {
				Script.ShowError({ level: ERROR_LEVEL.LOW }, e);

				continue;
			}

			for (const classID of chunk) {
				const iconUrl = assets[classID]?.icon_url;
				const hash = assets[classID]?.market_hash_name;
				if (iconUrl && hash) {
					this.SetIcon(hash, iconUrl);
					hashes.delete(hash);
				}
			}

			iconsFetched += chunk.length;
			progressCallback(`Fetching Store Item Icons (${iconsFetched}/${iconsToFetch})`, iconsFetched / iconsToFetch);
		}
	}
}
