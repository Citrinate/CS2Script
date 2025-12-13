import Script, { ERROR_LEVEL } from '@core/script.js';
import Popup from '@components/popup.js';
import { CreateElement } from '@utils/helpers.js';

export default class LabelPopup {
	#casket;
	#inventory;

	constructor(casket, inventory) {
		this.#casket = casket;
		this.#inventory = inventory;
	}

	Show() {
		let prompt;
		let placeholder;

		if (this.#casket.attributes["custom name attr"]) {
			prompt = `Enter a new descriptive label for this Storage Unit.`;
			placeholder = this.#casket.attributes["custom name attr"];
		} else {
			prompt = "Enter a descriptive label for your personal Storage Unit and start using it for storing items.";
			placeholder = "New name"
		}

		const renameForm = CreateElement("form", {
			class: "cs2s_settings_form",
			html: /*html*/`
					<div class="cs2s_settings_form_group_item">
						<label for="storage_unit_name">
							${prompt}
						</label>
						<input type="text" name="storage_unit_name" placeholder="${placeholder}" maxlength="20">
					</div>
				
				<div class="cs2s_settings_form_submit_group">
					<button class="cs2s_blue_long_button" type="submit">Personalize</button>
					<button class="cs2s_grey_long_button" id="form_cancel" type="button">Cancel</button>
				</div>
			`,
			onsubmit: async (event) => {
				event.preventDefault();

				let name = renameForm.elements["storage_unit_name"].value || renameForm.elements["storage_unit_name"].placeholder;

				if (!Script.Bot?.Plugin?.Connected) {
					Script.ShowStartInterfacePrompt({
						message: "Interface must be running to personalize storage units",
						autoClose: true,
						popoverMode: true,
						fade: false,
						onconnected: () => {
							popup.Hide();
							this.#LabelItem(name);
						}
					});

					return;
				}

				popup.Hide();
				this.#LabelItem(name);
			}
		});

		const popup = new Popup({
			title: "Personalize Your Storage Unit",
			fade: false,
			body: [CreateElement("div", {
				class: "cs2s_action_body",
				children: [
					renameForm
				]
			})]
		});

		renameForm.querySelector("#form_cancel").onclick = () => { popup.Hide(); };

		popup.Show();
	}

	async #LabelItem(name) {
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
					text: "Storage Unit successfully labeled"
				}),
				successButton
			]
		});

		let storageUnitRenamed = false;

		const progressPopup = new Popup({
			simpleMode: true,
			disableClose: true,
			fade: false,
			title: "Labeling Storage Unit",
			body: [
				loadingBody,
				successBody
			],
			onclose: () => {										
				if (storageUnitRenamed) {										
					window.location.reload();
				}
			}
		});

		successBody.hide();
		successButton.onclick = () => { progressPopup.Hide(); };

		progressPopup.Show();

		try {
			await this.#inventory.LabelStorageUnit(this.#casket, name);
			storageUnitRenamed = true;
		} catch (e) {
			progressPopup.Hide();
			Script.ShowError({ level: ERROR_LEVEL.HIGH }, e, new Error(`Failed to label storage unit.`));

			return;
		}

		loadingBody.hide();
		successBody.show();
	}
}
