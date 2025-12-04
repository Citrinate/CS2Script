import Script, { ERROR_LEVEL } from '@core/script.js';
import * as Constant from '@cs2/constants.js';
import Inventory from '@cs2/items/inventory.js';
import Asset from '@cs2/items/assets/asset.js';
import Popup from '@components/popup.js';
import Worker from '@utils/worker';
import { CreateElement, BindTooltip, Sleep, Random } from '@utils/helpers.js';

export default class ItemTable {
	#mode;
	#casket;
	#multiCasket;

	#data;
	#filteredData;
	#inventory;
	#selectionLimit;
	#rowElements = [];
	#selectedRows = new Set();
	#selectedRowsSaved = new Set();
	#lastStartRow;
	#lastRowClicked = null;
	#lastRowSelected = null;
	#inventoryChanged = false;
	#sortColumns = null;
	#sortDirection = null;
	#filterables = null;
	#filter = null;
	#searchQuery = null;

	static ROW_HEIGHT = 69;
	static BUFFER_ROWS = 3;
	#VISIBLE_ROWS;
	get #NUM_ROW_ELEMENTS() { return this.#VISIBLE_ROWS + ItemTable.BUFFER_ROWS * 2; };

	#popup;

	#tableContainer;
	#table;
	#tableBody;
	#spacer;
	#selectionLimitCount
	#selectionCount;
	#clearSelectionButton;
	#filterCount;
	#actionButton;

	static MODE = {
		STORE: 0,
		RETRIEVE: 1
	};

	static SORT_DIRECTION = {
		ASC: 0,
		DESC: 1
	}

	constructor(data, inventory, options) {
		this.#data = data;
		this.#filteredData = data;
		this.#inventory = inventory;
		this.#mode = options.mode;
		this.#casket = options.casket ?? null;
		this.#multiCasket = options.multiCasket ?? false;

		this.#VISIBLE_ROWS = Math.max(1, Math.floor((unsafeWindow.innerHeight * .66) / ItemTable.ROW_HEIGHT));

		this.#data.map(item => delete item.element);

		// Build Table Elements

		this.#tableBody = CreateElement("tbody");

		this.#spacer = CreateElement("div");

		this.#table = CreateElement("table", {
			class: "cs2s_table",
			children: [
				CreateElement("thead", {
					children: [
						CreateElement("tr", {
							children: [
								CreateElement("th", {
									class: "cs2s_table_image_column"
								}),
								CreateElement("th", {
									class: "cs2s_table_name_column",
									children: [
										CreateElement("span", {
											class: "cs2s_table_column",
											text: "Name",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["name", "wear"] });
											}
										}),
										CreateElement("span", {
											class: "cs2s_table_column_search cs2s_resizable_input",
											children: [
												CreateElement("input", {
													type: "search",
													placeholder: "Search",
													oninput: (event) => {
														// auto resize input box to input size
														event.target.style.width = "0px";
														event.target.parentNode.dataset.value = event.target.value || event.target.placeholder;
														event.target.style.width = `${event.target.parentNode.clientWidth}px`;

														this.#searchQuery = event.currentTarget.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

														this.#FilterRows(false);
													}
												})
											]
										})
									]
								}),
								CreateElement("th", {
									class: "cs2s_table_collection_column",
									children: [
										CreateElement("span", {
											class: "cs2s_table_column",
											text: "Quality",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["rarity", "quality", "collection", "name", "wear"] });
											}
										}),
										CreateElement("span", {
											class: "cs2s_table_column",
											text: "Collection",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["collection", "rarity", "quality", "name", "wear"] });
											}
										})
									]
								}),
								CreateElement("th", {
									class: "cs2s_table_float_column",
									children: [
										CreateElement("span", {
											class: "cs2s_table_column",
											text: "Float",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["wear"] });
											}
										})
									]
								}),
								CreateElement("th", {
									class: "cs2s_table_seed_column",
									children: [
										CreateElement("span", {
											class: "cs2s_table_column",
											text: "Seed",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["seed"] });
											}
										})
									]
								}),
								this.#multiCasket && CreateElement("th", {
									class: "cs2s_table_crate_column",
									children: [
										CreateElement("span", {
											class: "cs2s_table_column",
											text: "Storage Unit",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["casket_name", "id"] });
											}
										})
									]
								}),
							]
						})
					]
				}),
				this.#tableBody,
				this.#spacer
			]
		});

		this.#tableContainer = CreateElement("div", {
			class: "cs2s_table_container",
			style: {
				height: `${(this.#VISIBLE_ROWS + 1) * ItemTable.ROW_HEIGHT}px`
			},
			onscroll: () => { this.#UpdateRows(); },
			children: [this.#table]
		});

		// Build Footer Elements

		if (this.#mode === ItemTable.MODE.RETRIEVE) {
			this.#selectionLimit = Constant.INVENTORY_ITEM_LIMIT - inventory.items.filter(x => typeof x.attributes["trade protected escrow date"] === "undefined").length;
		} else {
			this.#selectionLimit = Constant.STORAGE_UNIT_ITEM_LIMIT - inventory.storedItems.filter(x => x.casket_id == this.#casket.iteminfo.id).length;
		}

		const onStatusUpdate = (status) => {
			if (this.#mode !== ItemTable.MODE.RETRIEVE || typeof status.Plugin?.UnprotectedInventorySize === "undefined") {
				return;
			}

			this.#selectionLimit = Constant.INVENTORY_ITEM_LIMIT - status.Plugin.UnprotectedInventorySize;
			this.#UpdateFooter();
		};

		this.#filterCount = CreateElement("span", {
			class: "cs2s_table_footer_selection_count",
			text: this.#data.length.toLocaleString()
		});

		this.#selectionLimitCount = CreateElement("span", {
			class: "cs2s_table_footer_selection_count",
			text: this.#selectionLimit.toLocaleString()
		});

		this.#selectionCount = CreateElement("span", {
			class: "cs2s_table_footer_selection_count",
			text: 0
		});

		this.#clearSelectionButton = CreateElement("a", {
			class: "cs2s_table_footer_action_link",
			// text: "Clear",
			onclick: () => {
				this.#DeselectAll();
				this.#tableContainer.focus();
			},
			children: [
				CreateElement("span", {
					htmlChildren: [ /*html*/`
						<svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true" stroke="none" fill="currentColor">
							<path d="m 15.5,29.5 c -7.18,0 -13,-5.82 -13,-13 0,-7.18 5.82,-13 13,-13 7.18,0 13,5.82 13,13 0,7.18 -5.82,13 -13,13 z m 6.438,-13.562 c 0,-0.552 -0.448,-1 -1,-1 h -11 c -0.553,0 -1,0.448 -1,1 v 1 c 0,0.553 0.447,1 1,1 h 11 c 0.552,0 1,-0.447 1,-1 z"></path>
						</svg>
					`],
					children: [
						"Clear"
					]
				})
			]
		});

		this.#actionButton = CreateElement("a", {
			class: "cs2s_green_button cs2s_button_disabled",
			html: "<span>Proceed...</span>",
			onclick: () => {
				if (this.#actionButton.classList.contains("cs2s_button_disabled")) {
					return;
				}

				if (!Script.Bot?.Plugin?.Connected) {
					Script.ShowStartInterfacePrompt({
						message: this.#mode === ItemTable.MODE.RETRIEVE
							? "Interface must be running to retrieve items"
							: "Interface must be running to store items",
						autoClose: true,
						popoverMode: true,
						fade: false,
						onclose: () => {
							this.#tableContainer.focus();
						},
						onconnected: () => {
							this.#inventoryChanged = true; // force page reload
							this.#ProcessSelected();
						}
					});

					return;
				}

				this.#ProcessSelected();
			}
		});

		const footerContainer = CreateElement("div", {
			class: "cs2s_table_footer cs2s_popup_footer",
			children: [
				CreateElement("div", {
					class: "cs2s_table_footer_element_left",
					children: [
						CreateElement("span", {
							children: [
								CreateElement("a", {
									class: "cs2s_table_footer_action_link",
									onclick: (event) => {
										this.#ShowFilters(event.currentTarget);
									},
									children: [
										CreateElement("span", {
											htmlChildren: [ /*html*/`
												<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
													<path d="m 3,5 h 18 a 1,1 0 1 1 0,2 H 3 A 1,1 0 1 1 3,5 Z m 3,6 h 12 a 1,1 0 1 1 0,2 H 6 a 1,1 0 1 1 0,-2 z m 3,6 h 6 a 1,1 0 1 1 0,2 H 9 a 1,1 0 1 1 0,-2 z"/>
												</svg>
											`],
											children: [
												"Filter"
											]
										})
									]
								}),
								this.#filterCount,
								" Item(s)"
							]
						}),
						CreateElement("span", {
							children: [
								CreateElement("form", {
									style: {
										display: "inline-block"
									},
									onsubmit: (event) => {
										event.preventDefault();

										const countInput = event.target.elements["count"];
										const count = parseInt(countInput.value || countInput.placeholder);

										this.#SelectFirst(count);
									},
									children: [
										CreateElement("button", {
											class: "cs2s_table_footer_action_link",
											children: [
												CreateElement("span", {
													htmlChildren: [ /*html*/`
														<svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true" stroke="none" fill="currentColor">
															<path d="M15.5 29.5c-7.18 0-13-5.82-13-13s5.82-13 13-13 13 5.82 13 13-5.82 13-13 13zM21.938 15.938c0-0.552-0.448-1-1-1h-4v-4c0-0.552-0.447-1-1-1h-1c-0.553 0-1 0.448-1 1v4h-4c-0.553 0-1 0.448-1 1v1c0 0.553 0.447 1 1 1h4v4c0 0.553 0.447 1 1 1h1c0.553 0 1-0.447 1-1v-4h4c0.552 0 1-0.447 1-1v-1z"></path>
														</svg>
													`],
													children: [
														"Select"
													]
												})
											]
										}),
										CreateElement("span", {
											onclick: (event) => {
												const input = event.target.querySelector("input");
												input && input.focus();
											},
											children: [
												"First ",
												CreateElement("span", {
													class: "cs2s_table_footer_input cs2s_resizable_input",
													children: [
														CreateElement("input", {
															type: "number",
															name: "count",
															min: 0,
															placeholder: 0,
															style: {
																width: "10px"
															},
															oninput: (event) => {
																// auto resize input box to input size
																event.target.style.width = "0px";
																event.target.parentNode.dataset.value = event.target.value || event.target.placeholder;
																event.target.style.width = `${event.target.parentNode.clientWidth}px`;
															}
														})
													]
												}),
												" Item(s)"
											]
										})
									]
								})
							]
						})

					]
				}),
				CreateElement("div", {
					class: "cs2s_table_footer_element_right",
					children: [
						CreateElement("span", {
							children: [
								this.#selectionLimitCount,
								" Space(s) Available"
							]
						}),
						CreateElement("span", {
							children: [
								this.#clearSelectionButton,
								this.#selectionCount,
								" Item(s) Selected",
							]
						}),
						this.#actionButton
					]
				})
			]
		});

		// Build Popup Elements

		const popupTitle = this.#mode === ItemTable.MODE.RETRIEVE
			? "Select items to retrieve from "
			: "Select items to move into ";

		const cachedNotification = CreateElement("span", {
			text: "(Cached)"
		});

		BindTooltip(cachedNotification, "The information below was loaded from cache and may no longer be accurate.");

		const popupTitleCrateName = CreateElement("span", {
			class: "cs2s_table_title_casket",
			text: this.#multiCasket ? options.casketName : `"${options.casketName}"`,
			children: [
				this.#inventory.loadedFromCache && " ",
				this.#inventory.loadedFromCache && cachedNotification
			]
		});

		if (this.#multiCasket) {
			popupTitleCrateName.classList.add("cs2s_table_title_casket_multiple");
		}

		Script.AddStatusUpdateListener(onStatusUpdate);

		this.#popup = new Popup({
			title: popupTitle,
			titleChildren: [
				popupTitleCrateName
			],
			body: [this.#tableContainer, footerContainer],
			onclose: () => {
				Script.RemovetatusUpdateListener(onStatusUpdate);

				if (this.#inventoryChanged) {
					window.location.reload();
				}
			}
		});
	}

	Show() {
		this.#popup.Show();
		this.#UpdateTable();
		this.#tableContainer.focus();
		this.#tableContainer.style.width = `${this.#tableContainer.offsetWidth}px`;
		this.#tableContainer.querySelectorAll('thead th').forEach(th => {
			th.style.width = getComputedStyle(th).width; //`${th.offsetWidth}px`;
		});
	}

	#GetRowElement(item, buildIfDoesntExist = true) {
		if (item.element) {
			return item.element;
		}

		if (!buildIfDoesntExist) {
			return;
		}

		const cosmetics = CreateElement("div", {
			class: "cs2s_table_image_column_cosmetics"
		});

		if (item.keychains) {
			let keychainID = item.attributes[`keychain slot 0 id`];
			if (keychainID) {
				const keychain = item.keychains[keychainID];
				const keychainSeed = item.attributes[`keychain slot 0 seed`];

				const keychainIMG = CreateElement("img", {
					src: `https://community.fastly.steamstatic.com/economy/image/${Inventory.iconURLs[keychain.full_name]}/25fx19f`
				});
				if (typeof keychainSeed !== "undefined") {
					BindTooltip(keychainIMG, `${keychain.full_name} (${keychainSeed})`, { showStyle: false });
				} else {
					BindTooltip(keychainIMG, keychain.full_name, { showStyle: false });
				}

				cosmetics.append(keychainIMG);
			}
		}

		if (item.stickers) {
			for (let slotNum = 0; slotNum < Constant.STICKER_MAX_COUNT; slotNum++) {
				let stickerID = item.attributes[`sticker slot ${slotNum} id`];
				if (stickerID) {
					const sticker = item.stickers[stickerID];

					const stickerIMG = CreateElement("img", {
						src: `https://community.fastly.steamstatic.com/economy/image/${Inventory.iconURLs[sticker.full_name]}/25fx19f`
					});
					BindTooltip(stickerIMG, sticker.full_name, { showStyle: false });

					cosmetics.append(stickerIMG);
				}
			}
		}

		const imageTD = CreateElement("td", {
			class: "cs2s_table_image_column",
			children: [
				CreateElement("img", {
					src: `https://community.fastly.steamstatic.com/economy/image/${Inventory.iconURLs[item.full_name]}/93fx62f`
				}),
				cosmetics
			]
		});

		// Build Name Element

		const nameTD = CreateElement("td", {
			class: "cs2s_table_name_column",
			text: item.name,
			children: [
				CreateElement("a", {
					href: `https://steamcommunity.com/market/listings/${Constant.CS2_APPID}/${encodeURIComponent(item.full_name)}`,
					target: "_blank",
					html: /*html*/`
						<svg viewBox="0 0 64 64" stroke-width="3" stroke="currentColor" fill="none">
							<path d="M55.4,32V53.58a1.81,1.81,0,0,1-1.82,1.82H10.42A1.81,1.81,0,0,1,8.6,53.58V10.42A1.81,1.81,0,0,1,10.42,8.6H32"/>
							<polyline points="40.32 8.6 55.4 8.6 55.4 24.18"/>
							<line x1="19.32" y1="45.72" x2="54.61" y2="8.91"/>
						</svg>
					`
				})
			]
		});

		// Build Rarity / Collection Element

		const collectionTD = CreateElement("td", {
			class: "cs2s_table_collection_column",
		});

		if (item.collection) {
			collectionTD.innerText = item.collection;
		}

		if (item.collection || item.rarity > 1) {
			collectionTD.classList.add("cs2s_table_collection_column_has_rarity");
			collectionTD.classList.add(`cs2s_table_collection_column_rarity_${item.rarity}`);
			collectionTD.classList.add(`cs2s_table_collection_column_quality_${item.iteminfo.quality}`);

			if (item.stattrak) {
				collectionTD.classList.add(`cs2s_table_collection_column_stattrak`);
			}
		}

		// Build Float Element

		const floatTD = CreateElement("td", {
			class: "cs2s_table_float_column",
		});

		if (typeof item.wear !== "undefined") {
			const wearData = Asset.GetWear(item.wear);
			floatTD.classList.add("cs2s_table_float_column_has_float");
			floatTD.classList.add(`cs2s_table_float_column_float_${wearData.name.toLowerCase()}`);
			floatTD.innerText = item.wear.toFixed(14);
			floatTD.append(" ");
			floatTD.append(Asset.GetPercentileElement(wearData, item.wear, item.wear_min, item.wear_max));
		}

		// Build Seed Element

		const seedTD = CreateElement("td", {
			class: "cs2s_table_seed_column",
			text: item.seed ?? ""
		});

		// Build Crate Element

		const casketTD = this.#multiCasket && CreateElement("td", {
			class: "cs2s_table_crate_column",
			text: item.casket_name
		});

		// Build Row Element

		item.element = CreateElement("tr", {
			onmousedown: (event) => {
				if (event.target.nodeName === "A" || event.target.parentElement.nodeName === "A" // Ignore clicks on the market page link
					|| event.button !== 0
				) {
					return;
				}

				this.#SelectItem(event, item);
			},
			children: [
				imageTD,
				nameTD,
				collectionTD,
				floatTD,
				seedTD,
				casketTD
			]
		});

		if (this.#selectedRows.has(item.iteminfo.id)) {
			item.element.classList.add("cs2s_table_row_selected");
		}

		return item.element;
	}

	#UpdateTable() {
		// this.#filteredData = this.#data;
		this.#lastStartRow = Number.POSITIVE_INFINITY;

		for (let i = 0; i < this.#rowElements.length; i++) {
			this.#rowElements[i].remove();
		}

		this.#rowElements = [];

		for (let i = 0; i < this.#NUM_ROW_ELEMENTS; i++) {
			if (i >= this.#filteredData.length) {
				break;
			}

			const rowElement = this.#GetRowElement(this.#filteredData[i]);
			this.#rowElements.push(rowElement);
			this.#tableBody.append(rowElement);
		}

		this.#spacer.style.height = "0px"
		this.#spacer.style.height = `${(this.#filteredData.length * ItemTable.ROW_HEIGHT) - this.#table.clientHeight + 31}px`;

		this.#UpdateRows();
		this.#UpdateFooter();

		if (this.#data.length == 0) {
			this.#tableBody.append(CreateElement("tr", {
				children: [
					CreateElement("td", {
						class: "cs2s_table_empty",
						colspan: 6,
						text: this.#mode == ItemTable.MODE.RETRIEVE ? "Storage Unit is empty" : "Inventory has no storable items"
					})
				]
			}));
		}
	}

	#UpdateRows() {
		const startRow = Math.max(
			0,
			Math.min(
				this.#filteredData.length - this.#NUM_ROW_ELEMENTS,
				Math.floor(this.#tableContainer.scrollTop / ItemTable.ROW_HEIGHT) - ItemTable.BUFFER_ROWS
			)
		);

		if (startRow == this.#lastStartRow) {
			return;
		}

		const diff = Math.max(
			-this.#NUM_ROW_ELEMENTS,
			Math.min(
				this.#NUM_ROW_ELEMENTS,
				startRow - this.#lastStartRow
			)
		);

		this.#lastStartRow = startRow;

		if (diff > 0) {
			// Scrolling down
			for (let i = 0; i < diff; i++) {
				const dataIndex = startRow + this.#NUM_ROW_ELEMENTS - diff + i;

				if (dataIndex >= this.#filteredData.length || dataIndex < 0) {
					continue;
				}

				// Delete a rendered row from the top
				const oldRow = this.#rowElements.shift();
				oldRow.remove();

				// Render a new row at the bottom
				const newRow = this.#GetRowElement(this.#filteredData[dataIndex]);
				this.#rowElements.push(newRow);
				this.#tableBody.append(newRow);
			}
		} else {
			// Scrolling up
			for (let i = 0; i < Math.abs(diff); i++) {
				const dataIndex = startRow - diff - i - 1;

				if (dataIndex >= this.#filteredData.length || dataIndex < 0) {
					continue;
				}

				// Delete a rendered row from the bottom
				const oldRow = this.#rowElements.pop();
				oldRow.remove();

				// Render a new row at the top
				const newRow = this.#GetRowElement(this.#filteredData[dataIndex]);
				this.#rowElements.unshift(newRow);
				this.#tableBody.prepend(newRow);
			}
		}

		this.#tableBody.style.transform = `translate3d(0, ${startRow * ItemTable.ROW_HEIGHT}px, 0)`;
	}

	#UpdateFooter() {
		this.#selectionLimitCount.innerText = this.#selectionLimit.toLocaleString();
		this.#selectionCount.innerText = this.#selectedRows.size.toLocaleString();
		this.#filterCount.innerText = this.#filteredData.length.toLocaleString();

		if (this.#selectedRows.size <= 0) {
			this.#actionButton.classList.add("cs2s_button_disabled");
			if (!this.#actionButton.tooltip) {
				this.#actionButton.tooltip = BindTooltip(this.#actionButton, "No items selected");
			} else {
				this.#actionButton.tooltip.innerText = "No items selected";
			}
		} else if (this.#selectedRows.size > this.#selectionLimit) {
			this.#actionButton.classList.add("cs2s_button_disabled");
			if (!this.#actionButton.tooltip) {
				this.#actionButton.tooltip = BindTooltip(this.#actionButton, "Too many items selected");
			} else {
				this.#actionButton.tooltip.innerText = "Too many items selected";
			}
		} else {
			this.#actionButton.classList.remove("cs2s_button_disabled");
			this.#actionButton.unbindTooltip && this.#actionButton.unbindTooltip();
			this.#actionButton.tooltip = null;
		}

		if (this.#selectedRows.size > 0) {
			this.#clearSelectionButton.show();
		} else {
			this.#clearSelectionButton.hide();
		}
	}

	#SelectItem(event, item) {
		if (event.shiftKey) {
			// Shift click multi-select
			if (!this.#lastRowClicked || this.#lastRowClicked == item || this.#lastRowSelected === null) {
				return;
			}

			const start = this.#filteredData.indexOf(this.#lastRowClicked);
			const end = this.#filteredData.indexOf(item);

			if (start < 0 || end < 0) {
				return;
			}

			const from = Math.min(start, end);
			const to = Math.max(start, end);

			for (let i = from; i <= to; i++) {
				const rowItem = this.#filteredData[i];
				const row = this.#GetRowElement(rowItem, false);
				const assetID = rowItem.iteminfo.id;

				if (!this.#lastRowSelected && this.#selectedRows.has(assetID)) {
					this.#selectedRows.delete(assetID);
					row && row.classList.remove("cs2s_table_row_selected");
				} else if (this.#lastRowSelected) {
					this.#selectedRows.add(assetID);
					row && row.classList.add("cs2s_table_row_selected");
				}
			}
		} else {
			// Single select
			const row = this.#GetRowElement(item);
			const assetID = item.iteminfo.id;

			if (this.#selectedRows.has(assetID)) {
				this.#lastRowSelected = false;
				this.#selectedRows.delete(assetID);
				row.classList.remove("cs2s_table_row_selected");
			} else {
				this.#lastRowSelected = true;
				this.#selectedRows.add(assetID);
				row.classList.add("cs2s_table_row_selected");
			}
		}

		this.#lastRowClicked = item;

		this.#UpdateFooter();
	}

	#SelectFirst(count) {
		for (let i = 0; i < count; i++) {
			if (i >= this.#filteredData.length) {
				break;
			}

			const rowItem = this.#filteredData[i];
			const row = this.#GetRowElement(rowItem, false);
			const assetID = rowItem.iteminfo.id;

			if (!this.#selectedRows.has(assetID)) {
				this.#selectedRows.add(assetID);
				row && row.classList.add("cs2s_table_row_selected");
			}
		}

		this.#lastRowClicked = null;

		this.#UpdateFooter();
	}

	#DeselectAll() {
		for (const item of this.#data) {
			const assetID = item.iteminfo.id;

			if (!this.#selectedRows.has(assetID)) {
				continue;
			}

			this.#selectedRows.delete(assetID);
			const row = this.#GetRowElement(item, false);
			row && row.classList.remove("cs2s_table_row_selected");
		}

		this.#lastRowClicked = null;

		this.#UpdateFooter();
	}

	#SortRows(options = {}) {
		if (this.#data.length == 0) {
			return;
		}

		if (options.columns) {
			if (this.#sortDirection != null && this.#sortColumns[0] != options.columns[0]) {
				this.#sortDirection = null;
			}

			this.#sortColumns = options.columns;
		}

		let resetSort = false;

		if (options.event) {
			if (this.#sortDirection === ItemTable.SORT_DIRECTION.DESC) {
				this.#sortColumns = ["casket_id", "id"];
				this.#sortDirection = ItemTable.SORT_DIRECTION.DESC;
				resetSort = true;
			} else if (this.#sortDirection === ItemTable.SORT_DIRECTION.ASC) {
				this.#sortDirection = ItemTable.SORT_DIRECTION.DESC;
			}
		}

		if (!this.#sortColumns) {
			return;
		}

		if (!this.#sortDirection) {
			this.#sortDirection = ItemTable.SORT_DIRECTION.ASC;
		}

		const asc = this.#sortDirection === ItemTable.SORT_DIRECTION.ASC;

		this.#filteredData.sort((a, b) => {
			for (const column of this.#sortColumns) {
				let valueA = a[column];
				let valueB = b[column];

				if (valueA === valueB) {
					continue;
				}

				if (typeof valueA === "undefined") {
					return 1;
				}

				if (typeof valueB === "undefined") {
					return -1;
				}

				if (typeof valueA === "string") {
					// return asc ? valueA.localeCompare(valueB, undefined, { numeric: true }) : valueB.localeCompare(valueA, undefined, { numeric: true });
					return asc ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
				}

				return asc ? valueA - valueB : valueB - valueA;
			}

			return 0;
		});

		if (options.event) {
			document.querySelectorAll('.cs2s_table_column_sort_asc').forEach(el => { el.classList.remove('cs2s_table_column_sort_asc'); });
			document.querySelectorAll('.cs2s_table_column_sort_desc').forEach(el => { el.classList.remove('cs2s_table_column_sort_desc'); });

			if (!resetSort) {
				if (asc) {
					options.event.target.querySelector(".cs2s_table_column_sort").classList.add("cs2s_table_column_sort_asc");
				} else {
					options.event.target.querySelector(".cs2s_table_column_sort").classList.add("cs2s_table_column_sort_desc");
				}
			}
		}

		this.#UpdateTable();
	}

	#FilterRows(updateSelected = true) {
		if (this.#data.length == 0) {
			return;
		}

		const inRange = (value, { min, max }) => {
			return !(
				typeof value === "undefined"
				|| (min != null && value < min)
				|| (max != null && value > max)
			);
		};

		const matches = item => {
			if (this.#filter?.selected && !this.#selectedRowsSaved.has(item.iteminfo.id)) {
				return false;
			}

			if (this.#filter?.float && !inRange(item.wear, this.#filter.float)) {
				return false;
			}

			if (this.#filter?.seed && !inRange(item.seed, this.#filter.seed)) {
				return false;
			}

			if (this.#filter?.cosmetics && !inRange(item.cosmetics, this.#filter.cosmetics)) {
				return false;
			}
	
			if (this.#filter?.quality != null && item.quality !== this.#filter.quality) {
				return false;
			}
	
			if (this.#filter?.rarity) {
				switch (this.#filter.rarity.key) {
					case "weapons":
						if (typeof item.wear === "undefined" || item.type_name === "Gloves") {
							return false;
						}
						break;

					case "agents":
						if (item.type_name !== "Agent") {
							return false;
						}
						break;

					case "other":
						if ((typeof item.wear !== "undefined" && item.type_name !== "Gloves") || item.type_name === "Agent") {
							return false;
						}
						break;
				}

				if (item.iteminfo.rarity !== this.#filter.rarity.value) {
					return false;
				}
			}
	
			if (this.#filter?.type) {
				switch (this.#filter.type.key) {
					case "weapons":
						if (item.weapon_name !== this.#filter.type.value) {
							return false;
						}
						break;

					case "other":
						if (item.type_name !== this.#filter.type.value) {
							return false;
						}
						break;
				}
			}
	
			if (this.#filter?.collection && item.collection_name !== this.#filter.collection) {
				return false;
			}
	
			if (this.#searchQuery && !item.name_normalized.includes(this.#searchQuery)) {
				return false;
			}
	
			return true;
		};

		if (updateSelected) {
			this.#selectedRowsSaved = new Set(this.#selectedRows);
		}

		if (!this.#searchQuery && !this.#filter) {
			this.#filteredData = this.#data;
		} else {
			this.#filteredData = this.#data.filter(matches);
		}

		this.#tableContainer.scrollTop = 0;
		this.#SortRows();
		this.#UpdateTable();
	}

	#ShowFilters(button) {
		// Determine all of the options for the filters
		if (this.#filterables == null) {
			this.#filterables = {
				types: {
					weapons: new Set(),
					other: new Set()
				},
				qualities: {},
				rarities: {
					weapons: {},
					agents: {},
					other: {}
				},
				float: {
					min: Number.POSITIVE_INFINITY,
					max: Number.NEGATIVE_INFINITY,
					wears: {}
				},
				seed: {
					min: Number.POSITIVE_INFINITY,
					max: Number.NEGATIVE_INFINITY
				},
				cosmetics: {
					min: Number.POSITIVE_INFINITY,
					max: Number.NEGATIVE_INFINITY
				},
				collections: {
					empty_exists: false,
					weapons: new Set(),
					stickers: new Set(),
					charms: new Set(),
					agents: new Set(),
					patches: new Set(),
					graffiti: new Set(),
					other: new Set()
				}
			};

			for (const item of this.#data) {
				if (item.type_name) {
					this.#filterables.types.other.add(item.type_name);
				}

				if (item.weapon_name) {
					this.#filterables.types.weapons.add(item.weapon_name);
				}

				if (item.quality_name) {
					this.#filterables.qualities[item.quality_name] = item.quality;
				}

				if (item.rarity_name) {
					if (typeof item.wear !== "undefined" && item.type_name !== "Gloves") {
						this.#filterables.rarities.weapons[item.rarity_name] = item.iteminfo.rarity;
					} else if (item.type_name === "Agent") {
						this.#filterables.rarities.agents[item.rarity_name] = item.iteminfo.rarity;
					} else {
						this.#filterables.rarities.other[item.rarity_name] = item.iteminfo.rarity;
					}
				}

				if (typeof item.wear != "undefined") {
					this.#filterables.float.min = Math.min(this.#filterables.float.min, item.wear);
					this.#filterables.float.max = Math.max(this.#filterables.float.max, item.wear);
					this.#filterables.float.wears[Asset.GetWear(item.wear).name] = true;
				}

				if (typeof item.seed != "undefined") {
					this.#filterables.seed.min = Math.min(this.#filterables.seed.min, item.seed);
					this.#filterables.seed.max = Math.max(this.#filterables.seed.max, item.seed);
				}

				{
					const count = Asset.GetNumCosmetics(item);
					this.#filterables.cosmetics.min = Math.min(this.#filterables.cosmetics.min, count);
					this.#filterables.cosmetics.max = Math.max(this.#filterables.cosmetics.max, count);
				}

				if (item.collection_name) {
					if (typeof item.wear !== "undefined") {
						this.#filterables.collections.weapons.add(item.collection_name);
					} else if (item.type_name === "Sticker") {
						this.#filterables.collections.stickers.add(item.collection_name);
					} else if (item.type_name === "Charm") {
						this.#filterables.collections.charms.add(item.collection_name);
					} else if (item.type_name === "Agent") {
						this.#filterables.collections.agents.add(item.collection_name);
					} else if (item.type_name === "Patch") {
						this.#filterables.collections.patches.add(item.collection_name);
					} else if (item.type_name === "Graffiti") {
						this.#filterables.collections.graffiti.add(item.collection_name);
					} else {
						this.#filterables.collections.other.add(item.collection_name);
					}
				} else {
					this.#filterables.collections.empty_exists = true;
				}
			}

			this.#filterables.float.min = Math.floor(this.#filterables.float.min * 100) / 100;
			this.#filterables.float.max = Math.ceil(this.#filterables.float.max * 100) / 100;
		}

		// Build Filter UI

		const floatMinValue = Constant.FLOAT_RANGE.min;
		const floatMaxValue = Constant.FLOAT_RANGE.max;
		const seedMinValue = Constant.SEED_RANGE.min;
		const seedMaxValue = Constant.SEED_RANGE.max;
		const cosmeticsMinValue = 0;
		const cosmeticsMaxValue = Constant.STICKER_MAX_COUNT + Constant.KEYCHAIN_MAX_COUNT;

		const type = CreateElement("select", {
			id: "type",
			disabled: Object.values(this.#filterables.types).reduce((sum, set) => sum + (set.size ?? 0), 0) < 2,
			children: [
				CreateElement("option", {
					value: ""
				}),
				...[
					{ key: "other", label: "Base Types" },
					{ key: "weapons", label: "Weapon Types" }
				].filter(({ key }) => this.#filterables.types[key].size > 0).map(({ key, label }) =>
					CreateElement("optgroup", {
						label,
						children: [...this.#filterables.types[key]].sort().map(name =>
							CreateElement("option", {
								text: name,
								value: name,
								selected: this.#filter?.type?.key === key && this.#filter?.type?.value === name,
								dataset: {
									key: key
								}
							})
						)
					})
				)
			]
		});

		if (type.disabled) {
			type.selectedIndex = type.options.length - 1;
		}

		const quality = CreateElement("select", {
			id: "quality",
			disabled: Object.keys(this.#filterables.qualities).length < 2,
			children: [
				CreateElement("option", { 
					value: ""
				}),
				...Object.entries(this.#filterables.qualities).sort(([, v1], [, v2]) => v1 - v2).map(([qualityName, qualityValue]) => 
					CreateElement("option", {
						text: qualityValue == 0 ? "Normal" : qualityName,
						value: qualityValue,
						selected: this.#filter?.quality === qualityValue,
						class: `cs2s_color_quality_${qualityValue}`
					})
				)
			]
		});

		if (quality.disabled) {
			quality.selectedIndex = quality.options.length - 1;
		}

		const rarity = CreateElement("select", {
			id: "rarity",
			disabled: Object.values(this.#filterables.rarities).reduce((sum, obj) => sum + Object.keys(obj).length, 0)  < 2,
			children: [
				CreateElement("option", { 
					value: ""
				}),
				...[
					{ key: "weapons", label: "Weapon Qualities" },
					{ key: "agents", label: "Agent Qualities" },
					{ key: "other", label: "Base Qualities" }
				].filter(({ key }) => Object.keys(this.#filterables.rarities[key]).length > 0).map(({ key, label }) =>
					CreateElement("optgroup", {
						label,
						children: Object.entries(this.#filterables.rarities[key]).sort(([, v1], [, v2]) => v1 - v2).map(([rarityName, rarityValue]) =>
							CreateElement("option", {
								text: rarityName,
								value: rarityValue,
								selected: this.#filter?.rarity?.key === key && this.#filter?.rarity?.value === rarityValue,
								class: `cs2s_color_rarity_${rarityValue}`,
								dataset: {
									key: key
								}
							})
						)
					})
				)
			]
		});

		if (rarity.disabled) {
			rarity.selectedIndex = rarity.options.length - 1;
		}

		const collection = CreateElement("select", {
			id: "collection",
			disabled: Object.values(this.#filterables.collections).reduce((sum, set) => sum + (set.size ?? 0), 0) < (2 - this.#filterables.collections.empty_exists),
			children: [
				CreateElement("option", {
					value: ""
				}),
				...[
					{ key: "weapons", label: "Weapon Collections" },
					{ key: "agents", label: "Agent Collections" },
					{ key: "stickers", label: "Sticker Collections" },
					{ key: "patches", label: "Patch Collections" },
					{ key: "charms", label: "Charm Collections" },
					{ key: "graffiti", label: "Graffiti Collections" },
					{ key: "other", label: "Other Collections" }
				].filter(({ key }) => this.#filterables.collections[key].size > 0).map(({ key, label }) =>
					CreateElement("optgroup", {
						label,
						children: [...this.#filterables.collections[key]].sort().map(name =>
							CreateElement("option", {
								text: name,
								value: name,
								selected: this.#filter?.collection === name,
							})
						)
					})
				)
			]
		});

		if (collection.disabled) {
			collection.selectedIndex = collection.options.length - 1;
		}

		const floatMin = CreateElement("input", {
			id: "float_min",
			type: "number",
			step: 0.01,
			min: floatMinValue,
			max: floatMaxValue,
			placeholder: this.#filterables.float.min === Number.POSITIVE_INFINITY ? "" : this.#filterables.float.min,
			disabled: this.#filterables.float.min === Number.POSITIVE_INFINITY,
			oninput: () => {
				float.value = "custom";
				const value = floatMin.value;

				if (floatMin.checkValidity()) {
					if (value === "") {
						floatMax.min = floatMinValue;
					} else {
						floatMax.min = value;
					}
				}
			}
		});

		const floatMax = CreateElement("input", {
			id: "float_max",
			type: "number",
			step: 0.01,
			min: floatMinValue,
			max: floatMaxValue,
			placeholder: this.#filterables.float.max === Number.NEGATIVE_INFINITY ? "" : this.#filterables.float.max,
			disabled: this.#filterables.float.max === Number.NEGATIVE_INFINITY,
			oninput: () => {
				float.value = "custom";
				const value = floatMax.value;

				if (floatMax.checkValidity()) {
					if (value === "") {
						floatMin.max = floatMaxValue;
					} else {
						floatMin.max = value;
					}
				}
			}
		});

		if (typeof this.#filter?.float?.min !== "undefined" && this.#filter.float.min !== null) {
			floatMin.value = floatMax.min = this.#filter.float.min;
		}

		if (typeof this.#filter?.float?.max !== "undefined" && this.#filter.float.max !== null) {
			floatMax.value = floatMin.max = this.#filter.float.max;
		}

		const float = CreateElement("select", {
			id: "float",
			disabled: this.#filterables.float.max === Number.NEGATIVE_INFINITY,
			children: [
				CreateElement("option", { 
					value: "",
				}),
				CreateElement("option", {
					hidden: true,
					value: "custom",
				}),
				...Constant.WEARS.filter(wear => this.#filterables.float.wears[wear.name] === true).map(wear => CreateElement("option", {
					value: wear.name,
					text: wear.nameLong,
					selected: this.#filter?.wear === wear.name,
					class: `cs2s_color_wear_${wear.name.toLowerCase()}`
				}))
			], onchange: (event) => {
				const value = event.target.value;
				
				if (value === "") {
					floatMin.value = "";
					floatMax.value = "";
					floatMin.max = floatMaxValue;
					floatMax.min = floatMinValue;

					return;
				}

				for (const wear of Constant.WEARS) {
					if (wear.name === value) {
						floatMin.value = wear.min;
						floatMax.value = wear.max;
						floatMin.max = floatMax.value;
						floatMax.min = floatMin.value;

						return;
					}
				}
			}
		});

		const seedMin = CreateElement("input", {
			id: "seed_min",
			type: "number",
			step: 1,
			min: seedMinValue,
			max: seedMaxValue,
			placeholder: this.#filterables.seed.min === Number.POSITIVE_INFINITY ? "" : this.#filterables.seed.min,
			disabled: this.#filterables.seed.min === Number.POSITIVE_INFINITY,
			oninput: () => {
				const value = seedMin.value;

				if (seedMin.checkValidity()) {
					if (value === "") {
						seedMax.min = seedMinValue;
					} else {
						seedMax.min = value;
					}
				}
			}
		});

		const seedMax = CreateElement("input", {
			id: "seed_max",
			type: "number",
			step: 1,
			min: seedMinValue,
			max: seedMaxValue,
			placeholder: this.#filterables.seed.max === Number.NEGATIVE_INFINITY ? "" : this.#filterables.seed.max,
			disabled: this.#filterables.seed.max === Number.NEGATIVE_INFINITY,
			oninput: () => {
				const value = seedMax.value;

				if (seedMax.checkValidity()) {
					if (value === "") {
						seedMin.max = seedMaxValue;
					} else {
						seedMin.max = value;
					}
				}
			}
		});

		if (typeof this.#filter?.seed?.min !== "undefined" && this.#filter.seed.min !== null) {
			seedMin.value = seedMax.min = this.#filter.seed.min;
		}

		if (typeof this.#filter?.seed?.max !== "undefined" && this.#filter.seed.max !== null) {
			seedMax.value = seedMin.max = this.#filter.seed.max;
		}

		const cosmeticsMin = CreateElement("input", {
			id: "cosmetics_min",
			type: "number",
			step: 1,
			min: cosmeticsMinValue,
			max: cosmeticsMaxValue,
			placeholder: this.#filterables.cosmetics.max === Number.NEGATIVE_INFINITY || this.#filterables.cosmetics.max === 0 ? "" : this.#filterables.cosmetics.min,
			disabled: this.#filterables.cosmetics.max === Number.NEGATIVE_INFINITY || this.#filterables.cosmetics.max === 0,
			oninput: () => {
				const value = cosmeticsMin.value;

				if (cosmeticsMin.checkValidity()) {
					if (value === "") {
						cosmeticsMax.min = cosmeticsMinValue;
					} else {
						cosmeticsMax.min = value;
					}
				}
			}
		});

		const cosmeticsMax = CreateElement("input", {
			id: "cosmetics_max",
			type: "number",
			step: 1,
			min: cosmeticsMinValue,
			max: cosmeticsMaxValue,
			placeholder: this.#filterables.cosmetics.max === Number.NEGATIVE_INFINITY || this.#filterables.cosmetics.max === 0 ? "" : this.#filterables.cosmetics.max,
			disabled: this.#filterables.cosmetics.max === Number.NEGATIVE_INFINITY || this.#filterables.cosmetics.max === 0,
			oninput: () => {
				const value = cosmeticsMax.value;

				if (cosmeticsMax.checkValidity()) {
					if (value === "") {
						cosmeticsMin.max = cosmeticsMaxValue;
					} else {
						cosmeticsMin.max = value;
					}
				}
			}
		});

		if (typeof this.#filter?.cosmetics?.min !== "undefined" && this.#filter.cosmetics.min !== null) {
			cosmeticsMin.value = cosmeticsMax.min = this.#filter.cosmetics.min;
		}

		if (typeof this.#filter?.cosmetics?.max !== "undefined" && this.#filter.cosmetics.max !== null) {
			cosmeticsMax.value = cosmeticsMin.max = this.#filter.cosmetics.max;
		}

		const selected = CreateElement("input", {
			id: "selected",
			type: "checkbox",
			disabled: this.#selectedRows.size == 0
		});

		if (this.#filter?.selected && this.#selectedRows.size > 0) {
			selected.checked = true;
		}

		const form = CreateElement("form", {
			class: "cs2s_settings_form cs2s_settings_filter",
			onreset: () => {
				floatMin.max = floatMaxValue;
				floatMax.min = floatMinValue;
				seedMin.max = seedMaxValue;
				seedMax.min = seedMinValue;
				cosmeticsMin.max = cosmeticsMaxValue;
				cosmeticsMax.min = cosmeticsMinValue;
			},
			children: [
				CreateElement("div", {
					class: "cs2s_settings_form_group_title" + (type.disabled && quality.disabled && rarity.disabled ? " cs2s_settings_form_disabled" : ""),
					text: "Base Filters",
				}),
				CreateElement("div", {
					class: "cs2s_settings_form_group",
					children: [
						CreateElement("div", {
							class: "cs2s_settings_form_group_row",
							children: [
								CreateElement("div", {
									class: "cs2s_settings_form_group_item" + (type.disabled ? " cs2s_settings_form_disabled" : ""),
									children: [
										CreateElement("label", {
											text: "Type",
											for: "type"
										}),
										type
									]
								}),
								CreateElement("div", {
									class: "cs2s_settings_form_group_item" + (quality.disabled ? " cs2s_settings_form_disabled" : ""),
									children: [
										CreateElement("label", {
											text: "Category",
											for: "quality"
										}),
										quality
									]
								}),
								CreateElement("div", {
									class: "cs2s_settings_form_group_item" + (rarity.disabled ? " cs2s_settings_form_disabled" : ""),
									children: [
										CreateElement("label", {
											text: "Quality",
											for: "rarity"
										}),
										rarity
									]
								})
							]
						})
					]
				}),
				CreateElement("div", {
					class: "cs2s_settings_form_group_title" + (floatMax.disabled && seedMax.disabled && cosmeticsMax.disabled ? " cs2s_settings_form_disabled" : ""),
					text: "Skin Filters",
				}),
				CreateElement("div", {
					class: "cs2s_settings_form_group",
					children: [
						CreateElement("div", {
							class: "cs2s_settings_form_group_row cs2s_settings_form_group_collection" + (floatMax.disabled ? " cs2s_settings_form_disabled" : ""),
							children: [
								CreateElement("div", {
									class: "cs2s_settings_form_group_item",
									children: [
										CreateElement("label", {
											text: "Exterior",
											for: "float"
										}),
										float
									]
								}),
								CreateElement("div", {
									class: "cs2s_settings_form_group_item",
									children: [
										CreateElement("label", {
											text: "Float Min",
											for: "float_min"
										}),
										floatMin
									]
								}),
								CreateElement("div", {
									class: "cs2s_settings_form_separator",
									text: "—"
								}),
								CreateElement("div", {
									class: "cs2s_settings_form_group_item",
									children: [
										CreateElement("label", {
											text: "Float Max",
											for: "float_max"
										}),
										floatMax
									]
								})
							]
						}),
						CreateElement("div", {
							class: "cs2s_settings_form_group_row",
							children: [
								CreateElement("div", {
									class: "cs2s_settings_form_group_row cs2s_settings_form_group_collection" + (seedMax.disabled ? " cs2s_settings_form_disabled" : ""),
									children: [
										CreateElement("div", {
											class: "cs2s_settings_form_group_item",
											children: [
												CreateElement("label", {
													text: "Seed Min",
													for: "seed_min"
												}),
												seedMin
											]
										}),
										CreateElement("div", {
											class: "cs2s_settings_form_separator",
											text: "—"
										}),
										CreateElement("div", {
											class: "cs2s_settings_form_group_item",
											children: [
												CreateElement("label", {
													text: "Seed Max",
													for: "seed_max"
												}),
												seedMax
											]
										})
									]
								}),
								CreateElement("div", {
									class: "cs2s_settings_form_separator",
									text: " "
								}),
								CreateElement("div", {
									class: "cs2s_settings_form_group_row cs2s_settings_form_group_collection" + (cosmeticsMax.disabled ? " cs2s_settings_form_disabled" : ""),
									children: [
										CreateElement("div", {
											class: "cs2s_settings_form_group_item",
											children: [
												CreateElement("label", {
													text: "Num Cosmetics Min",
													for: "cosmetics_min"
												}),
												cosmeticsMin
											]
										}),
										CreateElement("div", {
											class: "cs2s_settings_form_separator",
											text: "—"
										}),
										CreateElement("div", {
											class: "cs2s_settings_form_group_item",
											children: [
												CreateElement("label", {
													text: "Num Cosmetics Max",
													for: "cosmetics_max"
												}),
												cosmeticsMax
											]
										})
									]
								})
							]
						})
					]
				}),
				CreateElement("div", {
					class: "cs2s_settings_form_group_title" + (collection.disabled && selected.disabled ? " cs2s_settings_form_disabled" : ""),
					text: "Group Filters",
				}),
				CreateElement("div", {
					class: "cs2s_settings_form_group",
					children: [
						CreateElement("div", {
							class: "cs2s_settings_form_group_item" + (collection.disabled ? " cs2s_settings_form_disabled" : ""),
							children: [
								CreateElement("label", {
									text: "Collection",
									for: "collection"
								}),
								collection
							]
						}),
						CreateElement("div", {
							class: "cs2s_settings_form_group_item cs2s_settings_form_group_item_checkbox" + (selected.disabled ? " cs2s_settings_form_disabled" : ""),
							children: [
								selected,
								CreateElement("label", {
									text: "Show only selected items",
									for: "selected"
								})
							]
						})
					]
				}),
				CreateElement("div", {
					class: "cs2s_settings_form_submit_group",
					children: [
						CreateElement("button", {
							class: "cs2s_blue_long_button",
							type: "submit",
							text: "Filter"
						}),
						CreateElement("button", {
							class: "cs2s_grey_long_button",
							type: "reset",
							text: "Reset"
						}),
						CreateElement("button", {
							class: "cs2s_grey_long_button",
							id: "form_cancel",
							text: "Cancel"
						})
					]
				})
			]
		});

		const popup = new Popup({
			title: "Filter Items",
			body: [form],
			popoverMode: true,
			onclose: () => {
				this.#tableContainer.focus();
			}
		});

		form.querySelector("#form_cancel").onclick = () => { popup.Hide(); };

		form.onsubmit = (event) => {
			event.preventDefault();

			this.#filter = {
				type: type.disabled || type.selectedIndex == 0 ? null : { 
					key: type.selectedOptions[0].dataset.key, 
					value: type.value 
				},
				quality: quality.disabled || quality.selectedIndex == 0 ? null : parseInt(quality.value),
				rarity: rarity.disabled || rarity.selectedIndex == 0 ? null : { 
					key: rarity.selectedOptions[0].dataset.key, 
					value: parseInt(rarity.value) 
				},
				wear: float.value == "" ? null : float.value,
				float: floatMin.value == "" && floatMax.value == "" ? null : { 
					min: floatMin.value == "" ? null : parseFloat(floatMin.value), 
					max: floatMax.value == "" ? null : parseFloat(floatMax.value)
				},
				seed: seedMin.value == "" && seedMax.value == "" ? null : { 
					min: seedMin.value == "" ? null : parseInt(seedMin.value), 
					max: seedMax.value == "" ? null : parseInt(seedMax.value)
				},
				cosmetics: cosmeticsMin.value == "" && cosmeticsMax.value == "" ? null : { 
					min: cosmeticsMin.value == "" ? null : parseInt(cosmeticsMin.value), 
					max: cosmeticsMax.value == "" ? null : parseInt(cosmeticsMax.value)
				},
				collection: collection.disabled || collection.selectedIndex == 0 ? null : collection.value,
				selected: selected.checked ? true : null
			}

			if (Object.values(this.#filter).every(value => value === null)) {
				this.#filter = null;
			}

			if (this.#filter === null) {
				button.classList.remove("cs2s_table_footer_action_link_active");
			} else {
				button.classList.add("cs2s_table_footer_action_link_active");
			}

			popup.Hide();

			this.#FilterRows();
		};

		popup.Show();
	}

	async #ProcessSelected() {
		if (this.#selectedRows.size == 0) {
			return;
		}

		const numItemsToProcess = this.#selectedRows.size;

		const itemWindow = CreateElement("div", {
			class: "cs2s_action_item_window"
		});

		const progressMessage = CreateElement("div", {
			class: "cs2s_action_message",
			text: this.#mode == ItemTable.MODE.RETRIEVE ? "Retrieving Items" : "Storing Items"
		});

		const progressBar = CreateElement("div", {
			class: "cs2s_action_progress_bar",
			vars: {
				"percentage": "0%"
			}
		});

		const closeButton = CreateElement("div", {
			class: "cs2s_grey_long_button",
			text: "Cancel"
		});

		const popupBody = CreateElement("div", {
			class: "cs2s_action_body",
			children: [
				itemWindow,
				progressMessage,
				progressBar,
				closeButton
			]
		});

		const worker = new Worker({
			concurrentLimit: 6,
			delay: 1000 / 6
		});

		const popup = new Popup({
			title: this.#mode == ItemTable.MODE.RETRIEVE
				? "Retrieving From Storage Unit"
				: "Moving To Storage Unit",
			body: [popupBody],
			simpleMode: true,
			popoverMode: true,
			onclose: () => {
				this.#tableContainer.focus();

				worker.Cancel();
			}
		});

		closeButton.onclick = () => { popup.Hide(); };

		popup.Show();

		let numItemsProcessed = 0;

		for (const assetID of this.#selectedRows) {
			worker.Add(async () => {
				const item = this.#data.find(item => item.iteminfo.id == assetID);

				const itemImage = CreateElement("div", {
					class: "cs2s_action_item_window_image",
					html: this.#GetRowElement(item).children[0].innerHTML,
				});

				const maxAttempts = 3;

				for (let attempt = 1; attempt <= maxAttempts; attempt++) {
					if (worker.cancelled) {
						return;
					}

					try {
						if (this.#mode == ItemTable.MODE.RETRIEVE) {
							await this.#inventory.RetrieveItem(item);
						} else {
							await this.#inventory.StoreItem(item, this.#casket);
						}

						break;
					} catch (e) {
						if (worker.cancelled || (e.code === 504 && attempt < maxAttempts)) {
							// timeout
							Script.ShowError({ level: ERROR_LEVEL.LOW }, e);

							await Sleep(Random(1000, 2000));
							continue;
						}

						worker.Cancel();
						popup.Hide();
						Script.ShowError({ level: ERROR_LEVEL.HIGH }, e, new Error(`Failed to ${this.#mode == ItemTable.MODE.RETRIEVE ? "retrieve" : "store"} "${item.full_name}".  If errors persist, reload the page and try again.`));

						return;
					}
				}

				const dataIndex = this.#data.findIndex(item => item.iteminfo.id == assetID);
				this.#data.splice(dataIndex, 1);
				const filteredDataIndex = this.#filteredData.findIndex(item => item.iteminfo.id == assetID);
				filteredDataIndex != -1 && this.#filteredData.splice(filteredDataIndex, 1);
				this.#selectedRows.delete(assetID);
				this.#selectionLimit--;
				this.#inventoryChanged = true;

				this.#UpdateTable();

				numItemsProcessed++;
				progressMessage.innerText = (this.#mode == ItemTable.MODE.RETRIEVE ? "Retrieving Items" : "Storing Items") + ` (${numItemsProcessed}/${numItemsToProcess})`;
				progressBar.style.setProperty("--percentage", `${((numItemsProcessed / numItemsToProcess) * 100).toFixed(2)}%`);

				itemWindow.append(itemImage);

				const transform = getComputedStyle(itemImage).transform;
				itemImage.style.transformOrigin = "50% 700%";

				const rotateStart = Random(-20, -10);
				const rotateEnd = Random(10, 20);
				const scaleEnd = Random(0.7, 0.8);
				const translateYEnd = Random(-215, -165);
				const duration = Random(700, 800);

				const itemAnimationIn = itemImage.animate([
					{ transform: `${transform} rotate(${rotateStart}deg)`, opacity: 0.75, offset: 0 },
					{ opacity: 1, filter: 'brightness(1)', offset: 0.5 },
					{ transform: `${transform} rotate(${rotateEnd}deg) scale(${scaleEnd}) translateY(${translateYEnd}%)`, opacity: 0.5, filter: 'brightness(0.1)', offset: 1 }
				], {
					duration,
					easing: "cubic-bezier(.15, .50, .85, .50)",
				});

				itemAnimationIn.onfinish = () => {
					itemImage.remove();
				}
			});
		}

		worker.Run();
		await worker.Finish();

		// wait for the final animation to finish
		await Sleep(1000);

		popup.Hide();
	}
}
