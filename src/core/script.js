import * as Settings from '@core/settings.js';
import ASF from '@core/asf.js';
import Inventory from '@cs2/items/inventory';
import Popup from '@components/popup';
import Cache from '@utils/cache';
import { CreateElement, BindTooltip, Fade, Sleep, CreateCachedAsyncFunction, CompareVersions } from '@utils/helpers.js';

export const OPERATION_ERROR = {
	INTERFACE_NOT_CONNECTED: 0,
	INVENTORY_FAILED_TO_LOAD: 1,
};

export const ERROR_LEVEL = {
	HIGH: 0, // Popup notification
	MEDIUM: 1, // Navigation menu glow
	LOW: 2 // Log error only
};

class Script {
	static MIN_PLUGIN_VERSION = "1.2.0.0";

	Bot;
	AccountsConnected = 0;

	#inventory = null;
	#statusUpdateListeners = [];

	#navigationButton;
	#navigationStatus;
	#navigationMenu;
	#errorTableBody;

	constructor() {
		const globalNavigation = unsafeWindow.document.getElementById(`account_dropdown`);

		if (!globalNavigation) {
			return;
		}

		this.#navigationStatus = CreateElement("span", {
			class: "account_name",
			text: "???"
		});

		this.#navigationButton = CreateElement("span", {
			class: "popup_menu_item cs2s_navigation_popup_menu_item",
			onmouseenter: () => {
				this.#ShowNavigationMenu();
			},
			onmouseleave: () => {
				this.#HideNavigationMenu();
			},
			children: [
				CreateElement("span", {
					html: /*html*/`
					<span class="cs2s_navigation_icon">
						<svg
							width="173.27321"
							height="42.757812"
							viewBox="0 0 173.27321 42.757812"
							fill="currentColor"
							preserveAspectRatio="xMinYMin">
							<path
								d="m 79.808179,0 c -6.1207,1e-7 -11.646256,3.6370293 -14.035156,9.2363278 l -1.595704,3.7402352 -1.140625,2.667969 c -2.1334,4.9951 1.555679,10.533203 7.017579,10.533203 h 2.800781 22.875 l -2.935547,6.835937 H 58.10896 c -1.5238,0 -2.898,0.901969 -3.5,2.292969 l -3.222656,7.451172 h 39.164062 c 6.105704,0 11.625494,-3.621172 14.021494,-9.201172 l 2.87109,-6.683594 c 2.147,-4.9966 -1.54372,-10.548828 -7.01172,-10.548828 H 74.780835 l 1.884766,-4.402344 -4.792969,-2.3105472 h 40.464848 c 1.528,0 2.91081,-0.906287 3.50781,-2.304687 L 118.97029,0 Z M 24.497632,0.00195 C 18.410132,4.7e-4 12.905279,3.5995237 10.495679,9.1542936 L 0.6167727,32.216794 c -2.139226,4.9966 1.5490919,10.541016 7.0136719,10.541016 H 39.798413 c 1.5267,0 2.904906,-0.905381 3.503906,-2.300781 l 3.197266,-7.441404 H 12.644116 L 21.696851,11.923828 16.780835,9.6152348 h 37.253906 c 1.5267,0 2.904907,-0.905482 3.503906,-2.300782 L 60.679273,0.0058594 Z M 127.8824,0.00976 123.79451,9.6191351 h 37.17188 l -2.85157,6.7109369 h -27.21289 c -6.0365,0 -11.49792,3.620914 -13.86914,9.197266 l -0.0742,0.175781 -7.24804,17.052735 h 49.26758 l 1.89843,-4.466797 v -0.002 l 0.0742,-0.173828 v -0.01367 c 0.88057,-2.42168 -0.94013,-5.083985 -3.54101,-5.083985 h -31.46289 l 2.90625,-6.835937 h 32.1914 0.15039 0.01 c 2.95431,-0.06268 5.61224,-1.859402 6.77539,-4.597656 l 0.0742,-0.175782 4.61328,-10.851562 C 174.77935,5.5862411 171.10481,0.0097657 165.73201,0.0097657 Z" />
						</svg>
					</span>
				`}),
				"CS2Script: ",
				this.#navigationStatus
			]
		});

		globalNavigation.children[0].append(this.#navigationButton);

		GM_registerMenuCommand("Set ASF IPC Password", () => {
			const password = prompt("Enter ASF IPC Password", Settings.GetSetting(Settings.SETTING_ASF_PASSWORD));

			if (password !== null) {
				Settings.SetSetting(Settings.SETTING_ASF_PASSWORD, password);
				window.location.reload();
			}
		});
	}

	async #UpdateConnectionStatus() {
		try {
			const status = await ASF.GetBot();

			if (this.Bot) {
				const oldBot = this.Bot;
				this.Bot = status[this.Bot.ASF.BotName];

				for (const listener of this.#statusUpdateListeners) {
					listener(this.Bot, oldBot);
				}
			}

			const currentAccountConnected = this.Bot && status[this.Bot.ASF.BotName].Plugin?.Connected;
			const numOtherAccountsConnected = Object.values(status).filter(x => x.Plugin?.Connected).length - currentAccountConnected;
			const numOtherAccounts = Object.values(status).length - Number(this.Bot !== null);
			this.AccountsConnected = currentAccountConnected ? numOtherAccountsConnected + 1 : numOtherAccountsConnected;

			if (!this.#navigationStatus.tooltip) {
				this.#navigationStatus.tooltip = BindTooltip(this.#navigationStatus, "");
			}

			this.#navigationStatus.innerText = currentAccountConnected ? "1" : "0";
			this.#navigationStatus.tooltip.innerHTML = "Interface status for this account: ";
			if (currentAccountConnected) {
				this.#navigationStatus.tooltip.innerHTML += "<strong>Connected</strong>";
			} else {
				this.#navigationStatus.tooltip.innerHTML += "<strong>Not Connected</strong>";
			}

			if (numOtherAccounts > 0) {
				this.#navigationStatus.innerText += ` + ${numOtherAccountsConnected}`;
				this.#navigationStatus.tooltip.innerHTML += `<br>Interface is connected on <strong>${numOtherAccountsConnected}/${numOtherAccounts}</strong> other accounts`;
			}
		} catch (e) {
			this.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);
		}
	}

	AddStatusUpdateListener(listener) {
		this.#statusUpdateListeners.push(listener);
	}

	RemovetatusUpdateListener(listener) {
		this.#statusUpdateListeners = this.#statusUpdateListeners.filter(x => x !== listener);
	}

	#ShowNavigationMenu(fade = true) {
		if (this.#navigationMenu && this.#navigationMenu.isConnected) {
			if (this.#navigationMenu.fade) {
				this.#navigationMenu.fade.cancel();
				this.#navigationMenu.fade = null;
			}

			Fade(this.#navigationMenu, {
				to: 1,
				duration: 200
			});

			return;
		}

		const errorButton = CreateElement("a", {
			class: "popup_menu_item",
			text: "View Errors",
			onclick: () => {
				unsafeWindow.document.body.click(); // Hide the Steam #account_dropdown menu
				this.ShowErrors();
			}
		});

		if (this.#navigationButton.classList.contains("cs2s_navigation_status_error_glow")) {
			errorButton.classList.add("cs2s_navigation_status_error_glow");
		}

		const botConnected = this.Bot?.Plugin?.Connected;
		const interfaceToggleButton = CreateElement("a", {
			class: "popup_menu_item",
			text: !botConnected ? "Start Interface" : "Stop Interface",
			onclick: () => {
				unsafeWindow.document.body.click(); // Hide the Steam #account_dropdown menu
				if (!botConnected) {
					this.StartInterface();
				} else {
					this.StopInterface();
				}
			}
		});

		const settingsButton = CreateElement("a", {
			class: "popup_menu_item",
			text: "Settings",
			onclick: () => {
				unsafeWindow.document.body.click(); // Hide the Steam #account_dropdown menu
				this.ShowSettings();
			}
		});

		this.#navigationMenu = CreateElement("div", {
			class: "popup_block_new",
			children: [
				CreateElement("div", {
					class: "popup_body popup_menu",
					children: [
						interfaceToggleButton,
						settingsButton,
						this.#errorTableBody && errorButton,
					]
				})
			]
		});

		this.#navigationButton.append(this.#navigationMenu);

		this.#navigationMenu.style.top = `${this.#navigationButton.offsetTop}px`;
		this.#navigationMenu.style.left = `-${this.#navigationMenu.offsetWidth}px`;

		if (fade) {
			Fade(this.#navigationMenu, {
				from: 0,
				to: 1,
				duration: 200
			});
		}
	}

	#HideNavigationMenu() {
		if (!this.#navigationMenu) {
			return;
		}

		this.#navigationMenu.fade = Fade(this.#navigationMenu, {
			to: 0,
			duration: 200,
			onfinish: () => {
				this.#navigationMenu.isConnected && this.#navigationMenu.remove();
			}
		})
	}

	async VerifyConnection() {
		// Check that ASF is running
		try {
			await ASF.GetBot(null, false);
		} catch (e) {
			this.ShowError({ level: ERROR_LEVEL.MEDIUM }, e, new Error("ArchiSteamFarm is not running or cannot be reached. Please verify that ASF is running. Under \"Settings\", verify that your ASF server, port, and password settings are all correct."));

			return false;
		}

		// Check that the plugin is installed
		try {
			await ASF.GetPluginStatus();
		} catch (e) {
			this.ShowError({ level: ERROR_LEVEL.MEDIUM }, e, new Error("CS2 Interface plugin is not installed"));

			return false;
		}

		// Check that an ASF bot exists for the logged in account
		try {
			const bot = await ASF.GetBot(unsafeWindow.g_steamID);

			if (!bot) {
				throw new Error("ASF bot for this account was not found. If ASF was recently started, please wait until your bots come online and then reload the page.");
			}

			if (CompareVersions(Script.MIN_PLUGIN_VERSION, bot.Plugin.Version ?? "0") > 0) {
				this.ShowError({ level: ERROR_LEVEL.MEDIUM }, new Error(`CS2 Interface plugin is outdated, please update to version ${Script.MIN_PLUGIN_VERSION} or newer`));
			}

			this.Bot = bot;
		} catch (e) {
			this.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);

			return false;
		}

		this.#UpdateConnectionStatus();

		setInterval(() => {
			if (unsafeWindow.document.visibilityState === "hidden") {
				return;
			}

			this.#UpdateConnectionStatus();
		}, 1000);

		return true;
	}

	ShowError(options, ...errors) {
		if (!this.#errorTableBody) {
			this.#errorTableBody = CreateElement("tbody");
		}

		for (const error of errors) {
			console.log(error);

			this.#errorTableBody.prepend(
				CreateElement("tr", {
					children: [
						CreateElement("td", {
							text: (new Date()).toLocaleString()
						}),
						CreateElement("td", {
							text: options.level == ERROR_LEVEL.HIGH ? "High" : (options.level == ERROR_LEVEL.MEDIUM ? "Medium" : "Low")
						}),
						CreateElement("td", {
							text: error.message
						})
					]
				})
			);
		}

		if (this.#errorTableBody.isConnected) {
			return;
		}

		if (options.level === ERROR_LEVEL.HIGH) {
			const popup = new Popup({
				title: "Counter-Strike 2 Script Error",
				simpleMode: true,
				popoverMode: true,
				fade: false,
				body: [
					CreateElement("div", {
						class: "cs2s_action_body",
						children: [
							CreateElement("div", {
								class: "cs2s_action_message_tall cs2s_action_multi_message",
								children: [
									...errors.map(error => 
										CreateElement("div", {
											class: "cs2s_action_message",
											text: error.message
										})
									)
								]
							}),
							CreateElement("div", {
								class: "cs2s_action_buttons",
								children: [
									CreateElement("div", {
										class: "cs2s_grey_long_button",
										text: "Close",
										onclick: () => {
											popup.Hide();
										}
									})
								]
							})
						]
					})
				]
			});

			popup.Show();
		} else if (options.level === ERROR_LEVEL.MEDIUM) {
			const globalNavigationButton = unsafeWindow.document.getElementById(`account_pulldown`);
			this.#navigationButton.classList.add("cs2s_navigation_status_error_glow");
			globalNavigationButton && globalNavigationButton.classList.add("cs2s_navigation_status_error_pulse");
		}
	}

	ShowErrors() {
		const globalNavigationButton = unsafeWindow.document.getElementById(`account_pulldown`);
		this.#navigationButton.classList.remove("cs2s_navigation_status_error_glow");
		globalNavigationButton && globalNavigationButton.classList.remove("cs2s_navigation_status_error_pulse");

		const popup = new Popup({
			title: "Counter-Strike 2 Script Errors",
			body: [
				CreateElement("div", {
					text: "More detailed information can be found in your browser's developer console",
					style: {
						padding: "0px 0px 16px 16px",
						fontStyle: "italic"
					}
				}),
				CreateElement("div", {
					class: "cs2s_table_container cs2s_error_table_container",
					children: [
						CreateElement("table", {
							class: "cs2s_table",
							children: [
								CreateElement("thead", {
									children: [
										CreateElement("tr", {
											children: [
												CreateElement("th", {
													text: "Time"
												}),
												CreateElement("th", {
													text: "Severity"
												}),
												CreateElement("th", {
													text: "Error"
												})
											]
										})
									]
								}),
								this.#errorTableBody
							]
						})
					]
				})
			]
		});

		popup.Show();
	}

	ShowSettings() {
		const form = CreateElement("form", {
			class: "cs2s_settings_form",
			html: /*html*/`
				<div class="cs2s_settings_form_group_title">
					ASF Settings
				</div>
				<div class="cs2s_settings_form_group">
					<div class="cs2s_settings_form_group_item">
						<label for="${Settings.SETTING_ASF_SERVER}">
							ASF Server
						</label>
						<input type="text" name="${Settings.SETTING_ASF_SERVER}" placeholder="${Settings.DEFAULT_SETTINGS[Settings.SETTING_ASF_SERVER]}" value="${Settings.GetSetting(Settings.SETTING_ASF_SERVER)}">
					</div>
					<div class="cs2s_settings_form_group_item">
						<label for="${Settings.SETTING_ASF_PORT}">
							ASF Port
						</label>
						<input type="number" name="${Settings.SETTING_ASF_PORT}" placeholder="${Settings.DEFAULT_SETTINGS[Settings.SETTING_ASF_PORT]}" min="0" value="${Settings.GetSetting(Settings.SETTING_ASF_PORT)}">
					</div>
					<div class="cs2s_settings_form_group_item">
						<label>
							ASF IPC Password
						</label>
						<div class="cs2s_settings_form_message">
							This setting can be configured from your userscript manager's popup menu, found in your browser's extensions toolbar
						</div>
					</div>
				</div>

				<div class="cs2s_settings_form_group_title">
					Script Features
				</div>
				<div class="cs2s_settings_form_group">
					<div class="cs2s_settings_form_group_item cs2s_settings_form_group_item_checkbox">
						<input type="checkbox" name="${Settings.SETTING_INSPECT_ITEMS}" id="${Settings.SETTING_INSPECT_ITEMS}" ${Settings.GetSetting(Settings.SETTING_INSPECT_ITEMS) ? "checked" : ""}>							
						<label for="${Settings.SETTING_INSPECT_ITEMS}">
							Inspect Items
						</label>
					</div>
				</div>

				<div class="cs2s_settings_form_group_title">
					Script Settings
				</div>
				<div class="cs2s_settings_form_group">
					<div class="cs2s_settings_form_group_item">
						<label for="${Settings.SETTING_INTERFACE_AUTOSTOP_MINUTES}">
							Auto-stop interface if inactive for (minutes; 0 = never auto-stop${this.Bot?.Plugin?.Connected ? "; changes will apply on next start" : ""})
						</label>
						<input type="number" name="${Settings.SETTING_INTERFACE_AUTOSTOP_MINUTES}" placeholder="${Settings.DEFAULT_SETTINGS[Settings.SETTING_INTERFACE_AUTOSTOP_MINUTES]}" min="0" value="${Settings.GetSetting(Settings.SETTING_INTERFACE_AUTOSTOP_MINUTES)}">
					</div>
					<div class="cs2s_settings_form_group_item">
						<label for="${Settings.SETTING_INSPECT_CACHE_TIME_HOURS}">
							Re-inspect items after (hours; -1 = never re-inspect)
						</label>
						<input type="number" name="${Settings.SETTING_INSPECT_CACHE_TIME_HOURS}" placeholder="${Settings.DEFAULT_SETTINGS[Settings.SETTING_INSPECT_CACHE_TIME_HOURS]}" min="-1" value="${Settings.GetSetting(Settings.SETTING_INSPECT_CACHE_TIME_HOURS)}">
					</div>
				</div>
				
				<div class="cs2s_settings_form_submit_group">
					<button class="cs2s_blue_long_button" type="submit">Save</button>
					<button class="cs2s_grey_long_button" id="form_cancel" type="button">Cancel</button>
				</div>
			`,
			onsubmit: (event) => {
				event.preventDefault();

				for (const element of event.target) {
					if (!element.name || (!element.value && !element.placeholder)) {
						continue;
					}

					const value = element.type === "checkbox"
						? element.checked
						: (element.value || element.placeholder);

					Settings.SetSetting(element.name, value);
				}

				window.location.reload();
			}
		});

		const popup = new Popup({
			title: "Counter-Strike 2 Script Settings",
			body: [form]
		});

		form.querySelector("#form_cancel").onclick = () => { popup.Hide(); };

		popup.Show();
	}

	async StartInterface(options = {}) {
		const showProgress = options.showProgress ?? true;
		const errorLevel = options.errorLevel ?? ERROR_LEVEL.HIGH;

		if (!this.Bot) {
			this.ShowError({ level: errorLevel }, new Error("Cannot start interface. Check the error log for more information."));

			return false;
		}

		const loadingBody = CreateElement("div", {
			class: "cs2s_action_body",
			children: [
				CreateElement("div", {
					class: "cs2s_action_spinner"
				})
			]
		});

		const successButton = CreateElement("div", {
			class: "cs2s_blue_long_button",
			text: "OK"
		});

		const successBody = CreateElement("div", {
			class: "cs2s_action_body",
			children: [
				CreateElement("div", {
					class: "cs2s_action_message cs2s_action_message_tall",
					text: "Interface successfully started"
				}),
				successButton
			]
		});

		let interfaceStarted = false;

		const popup = new Popup({
			simpleMode: true,
			disableClose: true,
			popoverMode: options.popoverMode ?? false,
			fade: false,
			title: "Starting Interface",
			body: [
				loadingBody,
				successBody
			],
			onopen: options.onopen,
			onclose: () => {
				if (typeof options.onclose === "function") {
					options.onclose();
				}

				if (interfaceStarted) {
					if (typeof options.onconnected === "function") {
						options.onconnected();

						return interfaceStarted;
					}

					window.location.reload();
				}
			}
		});

		successBody.hide();
		successButton.onclick = () => { popup.Hide(); };

		if (showProgress) {
			popup.Show();
		}

		try {
			const response = await ASF.Send("CS2Interface", `Start`, "GET", this.Bot.ASF.BotName, { autoStop: Settings.GetSetting(Settings.SETTING_INTERFACE_AUTOSTOP_MINUTES) });

			if (!response || !response[this.Bot.ASF.BotName]?.Success) {
				popup.Hide();
				this.ShowError({ level: errorLevel }, new Error("Interface failed to start"));

				return interfaceStarted;
			}

			// Wait until inventory is loaded
			let status = await ASF.GetPluginStatus(this.Bot.ASF.BotName);

			while (status && status.Connected && !status.InventoryLoaded) {
				await Sleep(1000);
				status = await ASF.GetPluginStatus(this.Bot.ASF.BotName);
			}

			if (!status || !status.Connected || !status.InventoryLoaded) {
				popup.Hide();
				this.ShowError({ level: errorLevel }, new Error("Interface failed to start: Interface stopped while waiting for inventory to loaded"));

				return interfaceStarted;
			}
		} catch (e) {
			popup.Hide();
			this.ShowError({ level: errorLevel }, new Error(e.response?.Result?.[this.Bot.ASF.BotName]?.Message ?? e.message));

			return interfaceStarted;
		}

		interfaceStarted = true;

		if (options.autoClose) {
			popup.Hide();

			return interfaceStarted;
		}

		loadingBody.hide();
		successBody.show();

		return interfaceStarted;
	}

	async StopInterface(options = {}) {
		const showProgress = options.showProgress ?? true;
		const errorLevel = options.errorLevel ?? ERROR_LEVEL.HIGH;

		const loadingBody = CreateElement("div", {
			class: "cs2s_action_body",
			children: [
				CreateElement("div", {
					class: "cs2s_action_spinner"
				})
			]
		});

		const successButton = CreateElement("div", {
			class: "cs2s_blue_long_button",
			text: "OK"
		});

		const successBody = CreateElement("div", {
			class: "cs2s_action_body",
			children: [
				CreateElement("div", {
					class: "cs2s_action_message cs2s_action_message_tall",
					text: "Interface successfully stopped"
				}),
				successButton
			]
		});

		let interfaceStopped = false;

		const popup = new Popup({
			simpleMode: true,
			title: "Stopping Interface",
			body: [
				loadingBody,
				successBody
			],
			onclose: () => {
				if (interfaceStopped) {
					window.location.reload();
				}
			}
		});

		successBody.hide();
		successButton.onclick = () => { popup.Hide(); };

		if (showProgress) {
			popup.Show();
		}

		try {
			const response = await ASF.Send("CS2Interface", `Stop`, "GET", this.Bot.ASF.BotName);

			if (!response || !response[this.Bot.ASF.BotName]?.Success) {
				popup.Hide();
				this.ShowError({ level: errorLevel }, new Error("Interface failed to stop"));

				return interfaceStopped;
			}
		} catch (e) {
			popup.Hide();
			this.ShowError({ level: errorLevel }, e);

			return interfaceStopped;
		}

		interfaceStopped = true;

		loadingBody.hide();
		successBody.show();

		return interfaceStopped;
	}

	async RestartInterface(options = {}) {
		return await this.StopInterface(options) && await this.StartInterface(options);
	}

	ShowStartInterfacePrompt(options = {}) {
		const popup = new Popup({
			title: "Start Interface?",
			simpleMode: true,
			popoverMode: options.popoverMode ?? false,
			onopen: options.onopen,
			onclose: options.onclose,
			fade: options.fade,
			body: [
				CreateElement("div", {
					class: "cs2s_action_body",
					children: [
						CreateElement("div", {
							class: "cs2s_action_message cs2s_action_message_tall",
							text: options.message ?? "Start the interface?"
						}),
						CreateElement("div", {
							class: "cs2s_action_buttons",
							children: [
								CreateElement("div", {
									class: "cs2s_blue_long_button",
									text: "Start Interface",
									onclick: () => {
										popup.Hide();
										this.StartInterface(options);
									}
								}),
								CreateElement("div", {
									class: "cs2s_grey_long_button",
									text: "Cancel",
									onclick: () => {
										popup.Hide();
									}
								})
							]
						})
					]
				})
			]
		});

		popup.Show();
	}

	async GetInventory(options = {}) {
		if (this.#inventory === null) {
			const progressMessage = CreateElement("div", {
				class: "cs2s_action_message",
			});

			const progressBar = CreateElement("div", {
				class: "cs2s_action_progress_bar",
			});

			this.GetInventory.closeButton = CreateElement("div", {
				class: "cs2s_grey_long_button",
				text: "Close"
			});

			this.GetInventory.progressBody = CreateElement("div", {
				class: "cs2s_action_body",
				children: [
					progressMessage,
					progressBar,
					this.GetInventory.closeButton
				]
			});

			this.#inventory = CreateCachedAsyncFunction(async () => {
				const cache_id = `inventory_${unsafeWindow.g_steamID}`;
				const cache = await Cache.GetValue(cache_id, null);

				let inventory;

				if (this.Bot) {
					try {
						let status = await ASF.GetPluginStatus(this.Bot.ASF.BotName);

						if (status && status.Connected && status.InventoryLoaded) {
							if (!status.InventoryLoaded) {
								do {
									await Sleep(1000);
									status = await ASF.GetPluginStatus(this.Bot.ASF.BotName);
								} while (status && status.Connected && !status.InventoryLoaded)
							}

							if (status && status.Connected && status.InventoryLoaded) {
								const itemList = await ASF.Send("CS2Interface", "Inventory", "GET", this.Bot.ASF.BotName);

								if (itemList) {
									inventory = new Inventory(itemList);

									Cache.SetValue(cache_id, itemList);
								}
							}
						}
					} catch (e) {
						this.ShowError({ level: ERROR_LEVEL.LOW }, e);
					}
				}

				if (!inventory) {
					if (!cache) {
						return OPERATION_ERROR.INTERFACE_NOT_CONNECTED;
					}

					inventory = new Inventory(cache, true);
				}

				try {
					await inventory.LoadCrateContents((message, progress) => {
						progressMessage.innerText = message;
						progressBar.style.setProperty("--percentage", `${(progress * 100).toFixed(0)}%`);
					});

					return inventory;
				} catch (e) {
					this.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);

					return e.OPERATION_ERROR ?? OPERATION_ERROR.INVENTORY_FAILED_TO_LOAD;
				}
			});
		}

		let cancelled = false;

		const popup = new Popup({
			title: "Loading Inventory",
			body: [this.GetInventory.progressBody],
			simpleMode: true,
			onclose: () => {
				cancelled = true;
			}
		});

		this.GetInventory.closeButton.onclick = () => { popup.Hide(); };

		const alreadyFinished = this.#inventory.willReturnImmediately();

		if (options.showProgress && !alreadyFinished) {
			popup.Show();
		}

		const success = await this.#inventory() !== undefined;

		if (cancelled || !success) {
			return;
		}

		if (options.showProgress && !alreadyFinished) {
			// wait for the final animation to finish
			await Sleep(500);

			popup.Hide();
		}

		return await this.#inventory();
	}
}

const instance = new Script();
export default instance;
