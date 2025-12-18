import Script from '@core/script.js';
import * as Constant from '@cs2/constants.js';
import ASF from '@core/asf.js';
import Icons from './icons';

export default class Store {
	items;
	inventoryLoaded = false;
	inventoryLoadedFromCache;

	#storeData;
	#tournamentData;
	#walletCurrencyData = null;
	#walletCurrencyCode;
	#walletCountry;

	constructor(storeData, tournamentData) {
		this.items = [];
		this.#storeData = storeData;
		this.#tournamentData = tournamentData;
		this.#walletCountry = unsafeWindow.g_rgWalletInfo.wallet_country;
	}

	async LoadStoreContents(progressCallback) {
		// Figure out what currency the store should be in
		let wallet_currency_id = unsafeWindow.g_rgWalletInfo.wallet_currency;
		if (!wallet_currency_id) {
			throw new Error(`Undefined wallet currency`);
		}

		for (const code in unsafeWindow.g_rgCurrencyData) {
			if (unsafeWindow.g_rgCurrencyData[code].eCurrencyCode == wallet_currency_id) {
				this.#walletCurrencyData = unsafeWindow.g_rgCurrencyData[code];
				this.#walletCurrencyCode = this.#walletCurrencyData.strCode;
				break;
			}
		}

		if (!this.#walletCurrencyData) {			
			throw new Error(`Invalid wallet currency: ${wallet_currency_id}`);
		}

		if (!this.#storeData.price_sheet.currencies[this.#walletCurrencyCode]) {
			throw new Error(`Currency not supported by the Counter-Strike 2 store: ${this.#walletCurrencyCode}`);
		}

		// Build items array
		await Icons.LoadCachedIcons();

		const storeItemsToGetIconsFor = {};
		const marketItemsToGetIconsFor = new Set();

		// Items older than this should be marketable
		const marketableCutoffTime = (Date.now() / 1000) - (8 * 24 * 60 * 60);
		// The first tournament section ID to have highlight souvenir packages
		const highlightSectionIDStart = this.#tournamentData?.tournamentinfo.sections[this.#tournamentData.tournamentinfo.sections.length - 3].sectionid;
		// Highlight souvenir packages are usually released at the same time as champion capsules
		const highlightsReleased = !!Object.values(this.#storeData.price_sheet_items).find(item => item.tournament_id && item.name_id.includes("_champions"));

		for (const key in this.#storeData.price_sheet.entries) {
			const entry = this.#storeData.price_sheet.entries[key];
			const item = this.#storeData.price_sheet_items[entry.item_link];
			const hash_name = this.#GetHashName(item);
			const type = item.loot_list?.[0]?.type_name ?? item.type_name;

			if (!Icons.URLs[hash_name]) { // Allow for null values, attempt to re-fetch icons that failed previously
				storeItemsToGetIconsFor[item.def_index] = hash_name;
			}

			if (!item.requires_supplemental_data) {
				this.items.push({
					id: item.def_index,
					name: item.item_name,
					name_normalized: item.item_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
					image_name: hash_name,
					hash_name: hash_name,
					type: type,
					price: entry.sale_prices?.[this.#walletCurrencyCode] ?? entry.prices[this.#walletCurrencyCode],
					original_price: entry.prices[this.#walletCurrencyCode],
					discount: entry.sale_prices?.[this.#walletCurrencyCode] ? Math.round((1 - entry.sale_prices[this.#walletCurrencyCode] / entry.prices[this.#walletCurrencyCode]) * 100) : null,
					layout_format: this.#storeData.price_sheet.store_banner_layout[item.def_index]?.custom_format,
					layout_weight: this.#storeData.price_sheet.store_banner_layout[item.def_index]?.w,
					tournament_id: item.tournament_id,
					requires_supplemental_data: item.requires_supplemental_data
				});
			} 
			// Souvenir packages need extra details
			else if (this.#tournamentData) {
				for (const match of this.#tournamentData.matches) {
					const map_name = Constant.TOURNAMENT_MAPS[match.roundstats_legacy.map_id];
					const stage_id = match.roundstats_legacy.reservation.tournament_event.event_stage_id;
					const section = this.#tournamentData.tournamentinfo.sections.find(section => section.groups.find(group => group.stage_ids.includes(stage_id)));
					const team_1 = match.roundstats_legacy.reservation.tournament_teams[0];
					const team_2 = match.roundstats_legacy.reservation.tournament_teams[1];
					const is_highlight = section.sectionid >= highlightSectionIDStart;
					const souvenir_hash_name = this.#GetHashName(item, map_name, is_highlight);
					const souvenir_non_highlight_hash_name = this.#GetHashName(item, map_name); // Highlight packages use the same icons as non-highlight packages

					if (is_highlight && !highlightsReleased) {
						continue;
					}

					// Must get souvenir icons from the market
					if (souvenir_non_highlight_hash_name) {
						if (!Icons.URLs[souvenir_non_highlight_hash_name] && !marketItemsToGetIconsFor.has(souvenir_non_highlight_hash_name)) {
							// Wait until it's possible for this item to appear on the market before we try to fetch its icon
							if (match.matchtime < marketableCutoffTime) {
								marketItemsToGetIconsFor.add(souvenir_non_highlight_hash_name);
							}
						}
					}

					this.items.push({
						id: item.def_index,
						supplemental_data: match.matchid,
						name: souvenir_hash_name,
						name_normalized: souvenir_hash_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
						image_name: hash_name, // A default image will be shown when we don't have the true image (because the item isn't on the market yet)
						alt_image_name: souvenir_non_highlight_hash_name,
						hash_name: souvenir_hash_name,
						type: type,
						price: entry.sale_prices?.[this.#walletCurrencyCode] ?? entry.prices[this.#walletCurrencyCode],
						original_price: entry.prices[this.#walletCurrencyCode],
						discount: entry.sale_prices?.[this.#walletCurrencyCode] ? Math.round((1 - entry.sale_prices[this.#walletCurrencyCode] / entry.prices[this.#walletCurrencyCode]) * 100) : null,
						layout_format: this.#storeData.price_sheet.store_banner_layout[item.def_index]?.custom_format,
						layout_weight: this.#storeData.price_sheet.store_banner_layout[item.def_index]?.w,
						tournament_id: item.tournament_id,
						requires_supplemental_data: item.requires_supplemental_data,
						stage_id: stage_id,
						section_id: section.sectionid,
						section_name: section.name,
						team_1: team_1.team_name,
						team_1_id: team_1.team_id,
						team_1_score: match.roundstats_legacy.team_scores[0],
						team_2: team_2.team_name,
						team_2_id: team_2.team_id,
						team_2_score: match.roundstats_legacy.team_scores[1],
						teams_normalized: `${team_1.team_name} ${team_2.team_name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
						match_result: match.roundstats_legacy.match_result
					});
				}
			}
		}

		await Icons.FetchStoreIcons(storeItemsToGetIconsFor, progressCallback);

		// Try to get icons from the market if FetchStoreIcons fails
		const commodityMarketItemsToGetIconsFor = new Set();
		for (const hash_name of Object.values(storeItemsToGetIconsFor)) {
			// Anything with an existing null value will be because the items are unmarketable
			if (Icons.URLs[hash_name] == null) {
				commodityMarketItemsToGetIconsFor.add(hash_name);
			}
		}

		await Icons.FetchMarketCommodityIcons(commodityMarketItemsToGetIconsFor, progressCallback);
		await Icons.FetchMarketIcons(new Set([...commodityMarketItemsToGetIconsFor, ...marketItemsToGetIconsFor]), progressCallback);
	}

	LoadInventory(inventory) {
		for (const item of this.items) {
			item.owned = [...inventory.items, ...inventory.storedItems].filter(x => {
				if (x.iteminfo.def_index == item.id) {
					return true;
				}

				// Coupon items
				if (!item.requires_supplemental_data && item.hash_name && x.full_name == item.hash_name) {
					return true;
				}

				// Souvenir packages
				if (item.requires_supplemental_data
					&& x.full_name == item.hash_name
					&& x.attributes["tournament event stage id"] == item.stage_id
					&& x.attributes["tournament event team0 id"] == item.team_1_id
					&& x.attributes["tournament event team1 id"] == item.team_2_id
				) {
					return true;
				}

				return false;
			}).length;
		}

		this.inventoryLoaded = true;
		this.inventoryLoadedFromCache = inventory.loadedFromCache;
	}

	FormatCurrency(valueInCents) {
		let currencyFormat = (valueInCents / 100).toFixed(2);

		if (this.#walletCurrencyData.bWholeUnitsOnly) {
			currencyFormat = currencyFormat.replace('.00', '');
		}

		if (this.#walletCurrencyData.strDecimalSymbol != '.') {
			currencyFormat = currencyFormat.replace('.', this.#walletCurrencyData.strDecimalSymbol);
		}

		var currencyReturn = this.#walletCurrencyData.bSymbolIsPrefix
			? this.#walletCurrencyData.strSymbol + this.#walletCurrencyData.strSymbolAndNumberSeparator + currencyFormat
			: currencyFormat + this.#walletCurrencyData.strSymbolAndNumberSeparator + this.#walletCurrencyData.strSymbol;

		if (this.#walletCurrencyCode == 'USD' && typeof(this.#walletCountry) != 'undefined' && this.#walletCountry != 'US') {
			return currencyReturn + ' USD';
		} else if (this.#walletCurrencyCode == 'EUR') {
			return currencyReturn.replace(',00', ',--');
		} else {
			return currencyReturn;
		}
	}

	// Get market hash name for item (if the item exists on the market)
	#GetHashName(item, mapName = null, isHighlight = false) {
		if (item.loot_list?.[0]?.full_name) {
			return item.loot_list?.[0]?.full_name;
		}

		// Tournament sticker capsules and viewer passes
		if (item.tournament_id && !item.requires_supplemental_data) {
			return item.item_name;
		}

		// Tournament souvenir packages
		if (item.requires_supplemental_data && mapName) {
			let hash_name = item.item_name;
			hash_name = hash_name.replace("Souvenir Package", `${mapName} Souvenir Package`);

			if (isHighlight) {
				hash_name = hash_name.replace("Souvenir Package", "Souvenir Highlight Package");
			}

			return hash_name;
		}

		return item.item_name;
	}

	async InitializePurchase(item, quantity) {
		const params = { 
			itemID: item.id, 
			quantity: quantity, 
			cost: item.price * quantity
		};

		if (item.supplemental_data) {
			params.supplementalData = item.supplemental_data;
		}

		const result = await ASF.Send("CS2Interface", `InitializePurchase`, "GET", Script.Bot.ASF.BotName, params);

		if (!result.PurchaseUrl) {
			throw new Error(`Failed to get purchase URL`);
		}

		return result.PurchaseUrl;
	}
}
