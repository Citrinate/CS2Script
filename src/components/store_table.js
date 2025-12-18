import Script, { ERROR_LEVEL } from '@core/script.js';
import * as Constant from '@cs2/constants.js';
import Popup from '@components/popup.js';
import { CreateElement, BindTooltip } from '@utils/helpers.js';
import Icons from '@cs2/items/icons';
import Table from './table';

export default class StoreTable extends Table {
	#store;
	#tab = StoreTable.TAB.GENERAL;

	#selectedItem = null;
	#inventoryChanged = false;

	#searchQuery = null;
	#teamsSearchQuery = null;
	#defaultSort = {
		columns: ["default_sort_order"],
		direction: Table.SORT_DIRECTION.ASC
	};

	#actionButtonElement;
	#oldNotificationElement;

	static TAB = {
		GENERAL: 0,
		TOOLS: 1,
		TOURNAMENT_CAPSULES: 2,
		TOURNAMENT_SOUVENIRS: 3
	};

	constructor(store) {
		super();

		this.#store = store;

		// Set the default ordering
		this.#store.items.sort((a, b) => {
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

		for (let i = 0; i < this.#store.items.length; i++) {
			// Preserve default sort ordering
			this.#store.items[i].default_sort_order = i;
		}

		// Build Table Header
		const cachedNotificationElement = CreateElement("span", {
			text: "(Cached)"
		});

		BindTooltip(cachedNotificationElement, "The information below was loaded from cache and may no longer be accurate.");

		this.#oldNotificationElement = CreateElement("span", {
			text: "(Old)",
			style: {
				display: "none",
			}
		});

		BindTooltip(this.#oldNotificationElement, "The information below may be outdated and will be updated when the page is refreshed.");

		const tableHeaderElement = CreateElement("thead", {
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
										this._SortRows({ event: event, columns: ["name", "default_sort_order"] });
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

												this.#searchQuery = event.currentTarget.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(' ').filter(word => word.length > 0);

												this._FilterRows();
											}
										})
									]
								})
							]
						}),
						CreateElement("th", {
							class: "cs2s_table_store_type_match_column",
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
										this._SortRows({ event: event, columns: ["type", "name", "default_sort_order"]});
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
										this._SortRows({ event: event, columns: ["supplemental_data"]});
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
											placeholder: "Team Search",
											oninput: (event) => {
												// auto resize input box to input size
												event.target.style.width = "0px";
												event.target.parentNode.dataset.value = event.target.value || event.target.placeholder;
												event.target.style.width = `${event.target.parentNode.clientWidth}px`;

												this.#teamsSearchQuery = event.currentTarget.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(' ').filter(word => word.length > 0);

												this._FilterRows();
											}
										})
									]
								})
							]
						}),
						this.#store.inventoryLoaded && CreateElement("th", {
							class: "cs2s_table_store_owned_column",
							children: [
								CreateElement("span", {
									class: "cs2s_table_column",
									id: "owned_column",
									text: "Owned",
									children: [
										CreateElement("div", {
											class: "cs2s_table_column_sort",
										})
									],
									onclick: (event) => {
										this._SortRows({ event: event, columns: ["owned"]});
									}
								}),
								this.#store.inventoryLoadedFromCache && cachedNotificationElement,
								this.#oldNotificationElement
							]
						}),
						CreateElement("th", {
							class: "cs2s_table_store_price_column",
							children: [
								CreateElement("span", {
									class: "cs2s_table_column",
									text: "Price",
									children: [
										CreateElement("div", {
											class: "cs2s_table_column_sort",
										})
									],
									onclick: (event) => {
										this._SortRows({ event: event, columns: ["price", "default_sort_order"]});
									}
								})
							]
						})
					]
				})
			]
		});

		// Build Footer Elements
		this.#actionButtonElement = CreateElement("a", {
			class: "cs2s_green_button cs2s_button_disabled",
			html: "<span>Proceed...</span>",
			onclick: () => {
				if (this.#actionButtonElement.classList.contains("cs2s_button_disabled")) {
					return;
				}

				this.#ProcessSelected();
			}
		});

		const tableFooterElement = CreateElement("div", {
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
						this.#store.items.find(item => item.tournament_id) && CreateElement("a", {
							class: "cs2s_table_footer_action_link cs2s_table_footer_action_link_no_icon",
							text: "Tournament",
							onclick: (event) => {
								this.#ChangeTab(event.currentTarget, StoreTable.TAB.TOURNAMENT_CAPSULES);
							}
						}),
						this.#store.items.find(item => item.requires_supplemental_data) && CreateElement("a", {
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
						this.#actionButtonElement
					]
				})
			]
		});

		// Build Table
		this._CreateTable(this.#store.items, tableHeaderElement, tableFooterElement, {
				defaultSort: this.#defaultSort,
				popupTitle: "Select an item to purchase",
				popupOnClose: () => {
					if (this.#inventoryChanged) {
						window.location.reload();
					}
				}
			}
		);
	}

	_GetRowElement(item) {
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
							src: item.requires_supplemental_data ? (Icons.GetIconURL(item.alt_image_name, "93fx62f") ?? Icons.GetIconURL(item.image_name, "93fx62f")) : Icons.GetIconURL(item.image_name, "93fx62f")
						})
					]
				}),
				CreateElement("td", {
					class: "cs2s_table_name_column cs2s_table_store_name_column",
					text: item.name,
					children: [
						CreateElement("a", {
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
						class: "cs2s_table_store_type_match_column",
						text: item.type
					})
					: CreateElement("td", {
						class: "cs2s_table_store_type_match_column",
						html: `${item.section_name} &mdash; ${item.team_1} (${item.team_1_score}) &mdash; ${item.team_2} (${item.team_2_score})`
					})
				),
				this.#store.inventoryLoaded && CreateElement("td", {
					class: "cs2s_table_store_owned_column",
					text: item.owned
				}),
				CreateElement("td", {
					class: "cs2s_table_store_price_column",
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
			]
		});

		if (this.#selectedItem == item) {
			item.element.classList.add("cs2s_table_row_selected");
		}

		return item.element;
	}

	_UpdateFooter() {
		if (!this.#selectedItem) {
			this.#actionButtonElement.classList.add("cs2s_button_disabled");
			if (!this.#actionButtonElement.tooltip) {
				this.#actionButtonElement.tooltip = BindTooltip(this.#actionButtonElement, "No items selected");
			} else {
				this.#actionButtonElement.tooltip.innerText = "No items selected";
			}
		} else {
			this.#actionButtonElement.classList.remove("cs2s_button_disabled");
			this.#actionButtonElement.unbindTooltip && this.#actionButtonElement.unbindTooltip();
			this.#actionButtonElement.tooltip = null;
		}
	}

	#SelectItem(item) {
		if (this.#selectedItem) {
			this._GetRowElement(this.#selectedItem).classList.remove("cs2s_table_row_selected");
		}

		if (this.#selectedItem == item) {
			this.#selectedItem = null;
		} else {
			this.#selectedItem = item;
			this._GetRowElement(item).classList.add("cs2s_table_row_selected");
		}

		this._UpdateFooter();
	}

	_FilterRow(item) {
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

		if (this.#searchQuery && this.#searchQuery.length > 0) {
			for (const word of this.#searchQuery) {
				if (!item.name_normalized.includes(word)) {
					return false;
				}
			}
		}

		if (this.#teamsSearchQuery && this.#teamsSearchQuery.length > 0 && this.#tab === StoreTable.TAB.TOURNAMENT_SOUVENIRS) {
			for (const word of this.#teamsSearchQuery) {
				if (!item.teams_normalized.includes(word)) {
					return false;
				}
			}
		}

		return true;
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
			this._tableContainerElement.querySelector("#teams_column").style.display = "";
			this._tableContainerElement.querySelector("#teams_search").style.display = "";
			this._tableContainerElement.querySelector("#type_column").style.display = "none";
		} else {
			this._tableContainerElement.querySelector("#teams_column").style.display = "none";
			this._tableContainerElement.querySelector("#teams_search").style.display = "none";
			this._tableContainerElement.querySelector("#type_column").style.display = "";
		}

		// Reset all sorting
		this._sortColumns = ["default_sort_order"];
		this._sortDirection = Table.SORT_DIRECTION.ASC;
		this._tableContainerElement.querySelectorAll('.cs2s_table_column_sort_asc').forEach(el => { el.classList.remove('cs2s_table_column_sort_asc'); });
		this._tableContainerElement.querySelectorAll('.cs2s_table_column_sort_desc').forEach(el => { el.classList.remove('cs2s_table_column_sort_desc'); });

		// Reset all filters
		this.#searchQuery = null;
		this.#teamsSearchQuery = null;
		this._tableContainerElement.querySelectorAll('thead input[type="search"]').forEach(input => input.value = "");

		// Deselect the selected item
		if (this.#selectedItem) {
			this._GetRowElement(this.#selectedItem).classList.remove("cs2s_table_row_selected");
			this.#selectedItem = null;
		}

		this._FilterRows();
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

						if (!this.#inventoryChanged) {
							this.#inventoryChanged = true;

							if (this.#store.inventoryLoaded && !this.#store.inventoryLoadedFromCache) {
								this.#oldNotificationElement.style.display = "";
							}
						}

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
						"image-url": `url(${this.#selectedItem.requires_supplemental_data ? (Icons.GetIconURL(this.#selectedItem.alt_image_name, "66fx45f") ?? Icons.GetIconURL(this.#selectedItem.image_name, "66fx45f")) : Icons.GetIconURL(this.#selectedItem.image_name, "66fx45f")})`
					}
				})
			],
			body: [popupBody],
			simpleMode: true,
			popoverMode: true,
			onclose: () => {
				this._tableContainerElement.focus();
			}
		});

		closeButton.onclick = () => { popup.Hide(); };

		popup.Show();
	}
}
