export const CS2_APPID = 730;
export const INVENTORY_ITEM_LIMIT = 1000;
export const STORAGE_UNIT_ITEM_LIMIT = 1000;
export const MAX_PURCHASE_QUANTITY = 20;
export const STICKER_MAX_COUNT = 5;
export const KEYCHAIN_MAX_COUNT = 1;
export const SEED_RANGE = { min: 0, max: 100000 }
export const FLOAT_RANGE = { min: 0, max: 1 };
export const WEARS = [
	{ min: 0.00, max: 0.07, name: "FN", nameLong: "Factory New" },
	{ min: 0.07, max: 0.15, name: "MW", nameLong: "Minimum Wear" },
	{ min: 0.15, max: 0.38, name: "FT", nameLong: "Field-Tested" },
	{ min: 0.38, max: 0.45, name: "WW", nameLong: "Well-Worn" },
	{ min: 0.45, max: 1.00, name: "BS", nameLong: "Battle-Scarred" },
];
export const QUALITIES = {
	"normal": 0,
	"genuine": 1,
	"vintage": 2,
	"unusual": 3,
	"unique": 4,
	"community": 5,
	"developer": 6,
	"selfmade": 7,
	"customized": 8,
	"strange": 9,
	"completed": 10,
	"haunted": 11,
	"tournament": 12,
	"highlight": 13,
	"volatile": 14
};
export const RARITIES = {
	"Rarity_Default": 0,
	"Rarity_Default_Weapon": 0,
	"Rarity_Default_Character": 0,
	"Rarity_Common": 1,
	"Rarity_Common_Weapon": 1,
	"Rarity_Common_Character": 1,
	"Rarity_Uncommon": 2,
	"Rarity_Uncommon_Weapon": 2,
	"Rarity_Uncommon_Character": 2,
	"Rarity_Rare": 3,
	"Rarity_Rare_Weapon": 3,
	"Rarity_Rare_Character": 3,
	"Rarity_Mythical": 4,
	"Rarity_Mythical_Weapon": 4,
	"Rarity_Mythical_Character": 4,
	"Rarity_Legendary": 5,
	"Rarity_Legendary_Weapon": 5,
	"Rarity_Legendary_Character": 5,
	"Rarity_Ancient": 6,
	"Rarity_Ancient_Weapon": 6,
	"Rarity_Ancient_Character": 6,
	"Rarity_Contraband": 7,
	"Rarity_Contraband_Weapon": 7,
	"Rarity_Contraband_Character": 7,
	"Unusual": 99,
	"Rarity_Unusual": 99
};
export const TOURNAMENT_MAPS = {
	2: "Dust II",
	3: "Train",
	5: "Inferno",
	6: "Nuke",
	7: "Vertigo",
	23: "Mirage",
	32: "Overpass",
	91: "Anubis",
	101: "Ancient"
}
