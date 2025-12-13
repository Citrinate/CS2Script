import { GetSetting, SETTING_ASF_SERVER, SETTING_ASF_PORT, SETTING_ASF_PASSWORD } from '@core/settings.js';

export default {
	Send: async function (operation, path, http_method, bot, data) {
		let payload = null;
		let parameters = "";

		if (data) {
			if (http_method === "GET") {
				parameters = "?" + new URLSearchParams(data).toString();
			} else if (http_method === "POST") {
				payload = JSON.stringify(data);
			}
		}

		const xhrResponse = await new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				url: `${GetSetting(SETTING_ASF_SERVER)}:${GetSetting(SETTING_ASF_PORT)}/Api/${operation}/${bot}/${path}${parameters}`,
				method: http_method,
				data: payload,
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json",
					"Authentication": GetSetting(SETTING_ASF_PASSWORD)
				},
				onload: (response) => {
					let parsedResponse;
					try {
						// Wrap large numbers in strings to prevent precision loss (specificly: tournament match ids)
						parsedResponse = JSON.parse(response.responseText.replace(/:(\s*)(\d{16,})/g, ':"$2"'));
					} catch {
						// Not a JSON response
						parsedResponse = response.response;
					}

					resolve({ ...response, response: parsedResponse });
				},
				onerror: (e) => {
					const error = new Error(`(${e.status}) Request error from /Api/${operation}/${path}`);
					error.code = e.status;

					reject(error);
				},
				ontimeout: (e) => {
					const error = new Error(`(${e.status}) Request timed out on /Api/${operation}/${path}`);
					error.code = e.status;

					reject(error);
				}
			});
		});

		if (xhrResponse.status === 401) {
			const error = new Error(`(401) Missing or incorrect ASF IPC password. Please check your settings and verify your ASF IPC password.`);
			error.code = xhrResponse.status;
			error.response = xhrResponse.response;

			throw error;
		}

		if (xhrResponse.status === 403) {
			let errorMessage;
			if (!GetSetting(SETTING_ASF_SERVER).includes("127.0.0.1") 
				&& !GetSetting(SETTING_ASF_SERVER).toLowerCase().includes("localhost")
				&& !GetSetting(SETTING_ASF_PASSWORD)
			) {
				errorMessage = "(403) You must use an ASF IPC password when connecting to ASF remotely.";
			} else {
				errorMessage = "(403) The ASF IPC password you entered was incorrect. Please wait or restart ASF, and then try again.";
			}

			const error = new Error(errorMessage);
			error.code = xhrResponse.status;
			error.response = xhrResponse.response;

			throw error;
		}

		if (!xhrResponse.response || xhrResponse.status !== 200) {
			let errorMessage = `(${xhrResponse.status}) ASF request error from /Api/${operation}/${path}`;
			if (xhrResponse.response?.Message) {
				errorMessage += `: ${xhrResponse.response?.Message}`;
			} else if (xhrResponse.status >= 500) {
				errorMessage += `: Please check your ASF logs for errors`;
			}

			const error = new Error(errorMessage);
			error.code = xhrResponse.status;
			error.response = xhrResponse.response;

			throw error;
		}

		if (!xhrResponse.response.Success) {
			let errorMessage = `(${xhrResponse.status}) ASF response error from /Api/${operation}/${path}`;
			if (xhrResponse.response.Message) {
				errorMessage += `: ${xhrResponse.response.Message}`;
			}

			const error = new Error(errorMessage);
			error.code = xhrResponse.status;
			error.response = xhrResponse.response;

			throw error;
		}

		return xhrResponse.response.Result ?? xhrResponse.response;
	},

	GetBot: async function (steamID, includePluginStatus = true) {
		if (steamID === false) {
			// Not logged into Steam on browser
			return;
		}

		const bots = await this.Send("Bot", "", "GET", "ASF");

		let pluginStatus;
		if (includePluginStatus) {
			pluginStatus = await this.GetPluginStatus();
		}

		const mergedBots = Object.fromEntries(
			Object.entries(bots).map(([key, value]) => [
				key,
				{
					ASF: value,
					Plugin: pluginStatus?.[key]
				}
			])
		);

		if (steamID) {
			return Object.values(mergedBots).find(bot => bot.ASF.SteamID == steamID);
		}

		return mergedBots;
	},

	GetPluginStatus: async function (botName) {
		const bots = await this.Send("CS2Interface", "Status", "GET", "ASF", { "refreshAutoStop": "true" });

		if (botName) {
			return bots[botName];
		}

		return bots;
	}
};
