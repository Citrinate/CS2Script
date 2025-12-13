import Script, { ERROR_LEVEL } from '@core/script.js';
import * as Constant from '@cs2/constants.js';
import Popup from '@components/popup.js';
import { CreateElement, BindTooltip } from '@utils/helpers.js';
import Icons from '@cs2/items/icons';

export default class StoreTable {
	#tab;
	#store;

	#data;
	#filteredData;
	#rowElements = [];
	#selectedItem = null;
	#lastStartRow;
	#inventoryChanged = false;
	#sortColumns = null;
	#sortDirection = null;
	#searchQuery = null;
	#teamsSearchQuery = null;

	static ROW_HEIGHT = 69;
	static BUFFER_ROWS = 3;
	#VISIBLE_ROWS;
	get #NUM_ROW_ELEMENTS() { return this.#VISIBLE_ROWS + StoreTable.BUFFER_ROWS * 2; };

	#popup;

	#tableContainer;
	#table;
	#tableBody;
	#spacer;
	#actionButton;

	static TAB = {
		GENERAL: 0,
		TOOLS: 1,
		TOURNAMENT_CAPSULES: 2,
		TOURNAMENT_SOUVENIRS: 3
	};

	static SORT_DIRECTION = {
		ASC: 0,
		DESC: 1
	};

	constructor(store) {
		this.#store = store;
		this.#data = this.#store.items;
		this.#filteredData = this.#data;
		this.#tab = StoreTable.TAB.GENERAL;
		this.#VISIBLE_ROWS = Math.max(1, Math.floor((unsafeWindow.innerHeight * .66) / StoreTable.ROW_HEIGHT));

		// Set the default ordering
		this.#data.sort((a, b) => {
			// Show sales first
			if (a.discount && !b.discount) {
				return -1;
			}
			if (!a.discount && b.discount) {
				return 1;
			}

			// Sort by weight (popularity?), this is roughly the same order they appear in-game
			// Note: only the General tab uses weight
			if (a.layout_weight !== b.layout_weight) {
				if (typeof a.layout_weight === 'undefined') {
					return 1;
				}
				if (typeof b.layout_weight === 'undefined') {
					return -1;
				}
				return b.layout_weight - a.layout_weight;
			}

			// Show more recent tournament souvenir packages first
			if (a.supplemental_data && b.supplemental_data) {
				if (a.supplemental_data > b.supplemental_data) {
					return -1;
				}
				if (a.supplemental_data < b.supplemental_data) {
					return 1;
				}
			}

			// Show older items first
			return a.id - b.id
		});

		for (let i = 0; i < this.#data.length; i++) {
			// Preserve default sort ordering
			this.#data[i].default_sort_order = i;
			// Reset all row elements (clears out any changes made by a previous table)
			delete this.#data[i].element;
		}

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
									class: "cs2s_table_store_name_column",
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
												this.#SortRows({ event: event, columns: ["name", "supplemental_data"] });
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

														this.#FilterRows();
													}
												})
											]
										})
									]
								}),
								CreateElement("th", {
									class: "cs2s_table_store_type_stage_column",
									children: [
										CreateElement("span", {
											class: "cs2s_table_column",
											id: "type_column",
											text: "Type",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["type", "name"]});
											}
										}),
										CreateElement("span", {
											class: "cs2s_table_column",
											id: "stage_column",
											text: "Stage",
											style: {
												"display": "none"
											},
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["supplemental_data"]});
											}
										})
									]
								}),
								CreateElement("th", {
									class: "cs2s_table_store_price_team_column",
									children: [
										CreateElement("span", {
											class: "cs2s_table_column",
											id: "price_column",
											text: "Price",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["price", "name"]});
											}
										}),
										CreateElement("span", {
											class: "cs2s_table_column",
											id: "teams_column",
											style: {
												"display": "none"
											},
											text: "Match",
											children: [
												CreateElement("div", {
													class: "cs2s_table_column_sort",
												})
											],
											onclick: (event) => {
												this.#SortRows({ event: event, columns: ["team_1", "team_2", "supplemental_data"]});
											}
										}),
										CreateElement("span", {
											class: "cs2s_table_column_search cs2s_resizable_input",
											id: "teams_search",
											style: {
												"display": "none"
											},
											children: [
												CreateElement("input", {
													type: "search",
													placeholder: "Search",
													oninput: (event) => {
														// auto resize input box to input size
														event.target.style.width = "0px";
														event.target.parentNode.dataset.value = event.target.value || event.target.placeholder;
														event.target.style.width = `${event.target.parentNode.clientWidth}px`;

														this.#teamsSearchQuery = event.currentTarget.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

														this.#FilterRows();
													}
												})
											]
										})
									]
								})
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
				height: `${(this.#VISIBLE_ROWS + 1) * StoreTable.ROW_HEIGHT}px`
			},
			onscroll: () => { this.#UpdateRows(); },
			children: [this.#table]
		});

		// Build Footer Elements

		this.#actionButton = CreateElement("a", {
			class: "cs2s_green_button cs2s_button_disabled",
			html: "<span>Proceed...</span>",
			onclick: () => {
				if (this.#actionButton.classList.contains("cs2s_button_disabled")) {
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
						CreateElement("a", {
							class: "cs2s_table_footer_action_link cs2s_table_footer_action_link_no_icon cs2s_table_footer_action_link_active",
							text: "General",
							onclick: (event) => {
								this.#ChangeTab(event.currentTarget, StoreTable.TAB.GENERAL);
							}
						}),
						CreateElement("a", {
							class: "cs2s_table_footer_action_link cs2s_table_footer_action_link_no_icon",
							text: "Tools",
							onclick: (event) => {
								this.#ChangeTab(event.currentTarget, StoreTable.TAB.TOOLS);
							}
						}),
						this.#data.find(item => item.tournament_id) && CreateElement("a", {
							class: "cs2s_table_footer_action_link cs2s_table_footer_action_link_no_icon",
							text: "Tournament",
							onclick: (event) => {
								this.#ChangeTab(event.currentTarget, StoreTable.TAB.TOURNAMENT_CAPSULES);
							}
						}),
						this.#data.find(item => item.requires_supplemental_data) && CreateElement("a", {
							class: "cs2s_table_footer_action_link cs2s_table_footer_action_link_no_icon",
							text: "Tournament Souvenirs",
							onclick: (event) => {
								this.#ChangeTab(event.currentTarget, StoreTable.TAB.TOURNAMENT_SOUVENIRS);
							}
						})
					]
				}),
				CreateElement("div", {
					class: "cs2s_table_footer_element_right",
					children: [
						this.#actionButton
					]
				})
			]
		});

		// Build Popup Elements

		const popupTitle = "Select an item to purchase";

		this.#popup = new Popup({
			title: popupTitle,
			body: [this.#tableContainer, footerContainer],
			onclose: () => {
				if (this.#inventoryChanged) {
					window.location.reload();
				}
			}
		});
	}

	Show() {
		this.#popup.Show();
		this.#FilterRows();
		this.#tableContainer.focus();
		// Lock column widths so they don't jump around when filtering
		this.#tableContainer.style.width = `${this.#tableContainer.offsetWidth}px`;
		this.#tableContainer.querySelectorAll('thead th').forEach(th => {
			th.style.width = getComputedStyle(th).width;
		});
	}

	#GetRowElement(item) {
		if (item.element) {
			return item.element;
		}

		item.element = CreateElement("tr", {
			onmousedown: (event) => {
				if (event.target.nodeName === "A" || event.target.parentElement.nodeName === "A" // Ignore clicks on the market page link
					|| event.button !== 0
				) {
					return;
				}

				this.#SelectItem(item);
			},
			children: [
				CreateElement("td", {
					class: "cs2s_table_image_column",
					children: [
						CreateElement("img", {
							src: item.requires_supplemental_data ? (Icons.GetIconURL(item.hash_name, "93fx62f") ?? Icons.GetIconURL(item.image_hash_name, "93fx62f") ?? Icons.GetIconURL(item.image_name, "93fx62f")) : Icons.GetIconURL(item.image_name, "93fx62f")
						})
					]
				}),
				CreateElement("td", {
					class: "cs2s_table_name_column cs2s_table_store_name_column",
					text: item.name,
					children: [
						item.hash_name && CreateElement("a", {
							href: `https://steamcommunity.com/market/listings/${Constant.CS2_APPID}/${encodeURIComponent(item.hash_name)}`,
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
				}),
				(!item.requires_supplemental_data 
					? CreateElement("td", {
						class: "cs2s_table_store_type_stage_column",
						text: item.type
					})
					: CreateElement("td", {
						class: "cs2s_table_store_type_stage_column",
						// html: `${item.team_1} (${item.team_1_score}) &mdash; ${item.team_2} (${item.team_2_score})`
						text: item.section_name
					})
				),
				(!item.requires_supplemental_data 
					? CreateElement("td", {
						class: "cs2s_table_store_price_team_column",
						children: [
							item.discount && CreateElement("span", {
								class: "cs2s_table_store_discount",
								children: [
									CreateElement("span", {
										class: "cs2s_table_store_discount_percentage",
										text: `-${item.discount}%`
									}),
									CreateElement("span", {
										class: "cs2s_table_store_discount_original_price",
										text: this.#store.FormatCurrency(item.original_price)
									})
								]
								
							}),
							this.#store.FormatCurrency(item.price)
						]
					})
					: CreateElement("td", {
						class: "cs2s_table_store_price_team_column",
						html: `${item.team_1} (${item.team_1_score}) &mdash; ${item.team_2} (${item.team_2_score})`
						// html: item.match_result == 1 
						// 	? `<strong>${item.team_1} (${item.team_1_score})</strong> vs. ${item.team_2} (${item.team_2_score})` 
						// 	: `${item.team_1} (${item.team_1_score}) vs. <strong>${item.team_2} (${item.team_2_score})</strong>`
					})
				)
			]
		});

		if (this.#selectedItem == item) {
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
		this.#spacer.style.height = `${(this.#filteredData.length * StoreTable.ROW_HEIGHT) - this.#table.clientHeight + 31}px`;

		this.#UpdateRows();
		this.#UpdateFooter();

		if (this.#data.length == 0) {
			this.#tableBody.append(CreateElement("tr", {
				children: [
					CreateElement("td", {
						class: "cs2s_table_empty",
						colspan: 6,
						text: "The store is empty"
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
				Math.floor(this.#tableContainer.scrollTop / StoreTable.ROW_HEIGHT) - StoreTable.BUFFER_ROWS
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

		this.#tableBody.style.transform = `translate3d(0, ${startRow * StoreTable.ROW_HEIGHT}px, 0)`;
	}

	#UpdateFooter() {
		if (!this.#selectedItem) {
			this.#actionButton.classList.add("cs2s_button_disabled");
			if (!this.#actionButton.tooltip) {
				this.#actionButton.tooltip = BindTooltip(this.#actionButton, "No items selected");
			} else {
				this.#actionButton.tooltip.innerText = "No items selected";
			}
		} else {
			this.#actionButton.classList.remove("cs2s_button_disabled");
			this.#actionButton.unbindTooltip && this.#actionButton.unbindTooltip();
			this.#actionButton.tooltip = null;
		}
	}

	#SelectItem(item) {
		if (this.#selectedItem) {
			this.#GetRowElement(this.#selectedItem).classList.remove("cs2s_table_row_selected");
		}

		if (this.#selectedItem == item) {
			this.#selectedItem = null;
		} else {
			this.#selectedItem = item;
			this.#GetRowElement(item).classList.add("cs2s_table_row_selected");
		}

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
			if (this.#sortDirection === StoreTable.SORT_DIRECTION.DESC) {
				this.#sortColumns = ["default_sort_order"];
				this.#sortDirection = StoreTable.SORT_DIRECTION.ASC;
				resetSort = true;
			} else if (this.#sortDirection === StoreTable.SORT_DIRECTION.ASC) {
				this.#sortDirection = StoreTable.SORT_DIRECTION.DESC;
			}
		}

		if (!this.#sortColumns) {
			return;
		}

		if (!this.#sortDirection) {
			this.#sortDirection = StoreTable.SORT_DIRECTION.ASC;
		}

		const asc = this.#sortDirection === StoreTable.SORT_DIRECTION.ASC;

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
					return asc ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
				}

				return asc ? valueA - valueB : valueB - valueA;
			}

			return 0;
		});

		if (options.event) {
			this.#tableContainer.querySelectorAll('.cs2s_table_column_sort_asc').forEach(el => { el.classList.remove('cs2s_table_column_sort_asc'); });
			this.#tableContainer.querySelectorAll('.cs2s_table_column_sort_desc').forEach(el => { el.classList.remove('cs2s_table_column_sort_desc'); });

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

	#FilterRows() {
		if (this.#data.length == 0) {
			return;
		}

		const matches = item => {
			if (this.#tab === StoreTable.TAB.GENERAL && typeof item.layout_weight === "undefined") {
				return false;
			}

			if (this.#tab === StoreTable.TAB.TOOLS && item.layout_format !== "single") {
				return false;
			}

			if (this.#tab === StoreTable.TAB.TOURNAMENT_CAPSULES && (!item.tournament_id || item.requires_supplemental_data)) {
				return false;
			}

			if (this.#tab === StoreTable.TAB.TOURNAMENT_SOUVENIRS && (!item.tournament_id || !item.requires_supplemental_data)) {
				return false;
			}
	
			if (this.#searchQuery) {
				const searchWords = this.#searchQuery.split(' ').filter(word => word.length > 0);
				if (searchWords.length > 0 && !searchWords.every(word => item.name_normalized.includes(word))) {
					return false;
				}
			}

			if (this.#teamsSearchQuery && this.#tab === StoreTable.TAB.TOURNAMENT_SOUVENIRS) {
				const searchWords = this.#teamsSearchQuery.split(' ').filter(word => word.length > 0);
				if (searchWords.length > 0 && !searchWords.every(word => item.teams_normalized.includes(word))) {
					return false;
				}
			}
	
			return true;
		};

		this.#filteredData = this.#data.filter(matches);

		this.#tableContainer.scrollTop = 0;
		this.#SortRows();
		this.#UpdateTable();
	}

	#ChangeTab(button, newTab) {
		if (this.#tab == newTab) {
			return;
		}

		this.#tab = newTab;

		button.parentElement.querySelectorAll(".cs2s_table_footer_action_link").forEach(el => { el.classList.remove("cs2s_table_footer_action_link_active"); });
		button.classList.add("cs2s_table_footer_action_link_active");

		// Souvenir tab has unique columns
		if (newTab === StoreTable.TAB.TOURNAMENT_SOUVENIRS) {
			this.#tableContainer.querySelector("#stage_column").style.display = "";
			this.#tableContainer.querySelector("#teams_column").style.display = "";
			this.#tableContainer.querySelector("#teams_search").style.display = "";
			this.#tableContainer.querySelector("#type_column").style.display = "none";
			this.#tableContainer.querySelector("#price_column").style.display = "none";
		} else {
			this.#tableContainer.querySelector("#stage_column").style.display = "none";
			this.#tableContainer.querySelector("#teams_column").style.display = "none";
			this.#tableContainer.querySelector("#teams_search").style.display = "none";
			this.#tableContainer.querySelector("#type_column").style.display = "";
			this.#tableContainer.querySelector("#price_column").style.display = "";
		}

		// Reset all sorting
		this.#sortColumns = ["default_sort_order"];
		this.#sortDirection = StoreTable.SORT_DIRECTION.ASC;
		this.#tableContainer.querySelectorAll('.cs2s_table_column_sort_asc').forEach(el => { el.classList.remove('cs2s_table_column_sort_asc'); });
		this.#tableContainer.querySelectorAll('.cs2s_table_column_sort_desc').forEach(el => { el.classList.remove('cs2s_table_column_sort_desc'); });

		// Reset all filters
		this.#searchQuery = null;
		this.#teamsSearchQuery = null;
		this.#tableContainer.querySelectorAll('thead input[type="search"]').forEach(input => input.value = "");

		// Deselect the selected item
		if (this.#selectedItem) {
			this.#GetRowElement(this.#selectedItem).classList.remove("cs2s_table_row_selected");
			this.#selectedItem = null;
		}

		this.#FilterRows();
	}

	async #ProcessSelected() {
		if (!this.#selectedItem) {
			return;
		}

		const purchaseButton = CreateElement("button", {
			class: "cs2s_blue_long_button",
			type: "submit",
			text: this.#store.FormatCurrency(this.#selectedItem.price)
		});

		const closeButton = CreateElement("button", {
			class: "cs2s_grey_long_button",
			id: "form_cancel",
			type: "button",
			text: "Cancel"
		});

		const purchaseForm = CreateElement("form", {
			class: "cs2s_settings_form cs2s_settings_form_enclosed_submit",
			children: [
				CreateElement("div", {
					class: "cs2s_settings_form_group_item",
					children: [
						CreateElement("label", {
							for: "storage_unit_name",
							text: "Quantity"
						}),
						CreateElement("select", {
							id: "quantity",
							children: Array.from({ length: Constant.MAX_PURCHASE_QUANTITY }, (_, i) =>
								CreateElement("option", {
									value: i + 1,
									text: i + 1
								})
							), onchange: (event) => {
								const value = event.target.value;
								
								purchaseButton.innerText = this.#store.FormatCurrency(this.#selectedItem.price * value);
							}
						})
					]
				}),
				CreateElement("div", {
					class: "cs2s_settings_form_submit_group",
					children: [
						purchaseButton,
						closeButton
					]
				})
			],
			onsubmit: async (event) => {
				event.preventDefault();

				const initializePurchase = async () => {
					// The purchase will be completed in a new tab
					const newTab = unsafeWindow.open("", "_blank");
					if (newTab) {
						newTab.document.write(/*html*/`
							<!DOCTYPE html>
							<html>
							<head>
								<title>Initializing Purchase</title>
								<style>
									body {
										font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
										background: radial-gradient(circle at top left, rgba(74, 81, 92, 0.4) 0%, rgba(75, 81, 92, 0) 60%), #25282e;
										color: #bdbdbd;
										display: flex;
										justify-content: center;
										align-items: center;
										height: 100vh;
										margin: 0;
										text-align: center;
									}
									.spinner {
										width: 50px;
										height: 50px;
										border: 5px solid #a6a6ad80;
										border-top-color: transparent;
										border-radius: 50%;
										animation: spin 1s linear infinite;
										margin: 0 auto 20px;
									}
									@keyframes spin {
										0% { transform: rotate(0deg); }
										100% { transform: rotate(360deg); }
									}
								</style>
							</head>
							<body>
								<div>
									<div class="spinner"></div>
									<h1>Initializing Purchase...</h1>
								</div>
							</body>
							</html>
						`);
					}

					const loadingPopup = new Popup({
						simpleMode: true,
						disableClose: true,
						popoverMode: true,
						fade: false,
						title: "Initializing Purchase",
						body: [
							CreateElement("div", {
								class: "cs2s_action_body",
								children: [
									CreateElement("div", {
										class: "cs2s_action_spinner"
									})
								]
							})
						]
					});

					try {
						loadingPopup.Show();

						const quantity = purchaseForm.elements["quantity"].value;
						const purchaseUrl = await this.#store.InitializePurchase(this.#selectedItem, quantity);

						if (!newTab || newTab.closed) {
							throw new Error("Popup was closed.  Please try again.");
						}

						newTab.location.href = purchaseUrl;
						this.#inventoryChanged = true;

						loadingPopup.Hide();
					} catch (e) {
						loadingPopup.Hide();
						newTab?.close();

						Script.ShowError({ level: ERROR_LEVEL.HIGH }, new Error(`Failed to initialize purchase.`), e);
					}
				}

				if (!Script.Bot?.Plugin?.Connected) {
					Script.ShowStartInterfacePrompt({
						message: "Interface must be running to purchase items from the store",
						autoClose: false,
						popoverMode: true,
						fade: false,
						onconnected: () => {
							initializePurchase();
						}
					});
				} else {
					initializePurchase();
				}
			}
		});

		const popupBody = CreateElement("div", {
			class: "cs2s_action_body",
			children: [
				purchaseForm
			]
		});

		const itemName = CreateElement("span", {
			text: this.#selectedItem.name
		});

		// Display additional souvenir package match info
		if (this.#selectedItem.requires_supplemental_data) {
			BindTooltip(itemName, `From the ${this.#selectedItem.section_name} match between ${this.#selectedItem.team_1} and ${this.#selectedItem.team_2}.`);
		}

		const popup = new Popup({
			title: "Purchase ",
			titleChildren: [
				CreateElement("span", {
					class: "cs2s_table_title_item",
					children: [ itemName ],
					vars: {
						"image-url": `url(${this.#selectedItem.requires_supplemental_data ? (Icons.GetIconURL(this.#selectedItem.hash_name, "66fx45f") ?? Icons.GetIconURL(this.#selectedItem.image_hash_name, "66fx45f") ?? Icons.GetIconURL(this.#selectedItem.image_name, "66fx45f")) : Icons.GetIconURL(this.#selectedItem.image_name, "66fx45f")})`
					}
				})
			],
			body: [popupBody],
			simpleMode: true,
			popoverMode: true,
			onclose: () => {
				this.#tableContainer.focus();
			}
		});

		closeButton.onclick = () => { popup.Hide(); };

		popup.Show();
	}
}
