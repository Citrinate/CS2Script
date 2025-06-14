import { CreateElement, Fade } from '@utils/helpers.js';

export default class Popup {
	static #numPopups = 0;

	#popoverMode;
	#onopen;
	#onclose;
	#fade;

	#popupContainer;
	#background;
	#visible = false;

	constructor(options) {
		this.#popoverMode = options.popoverMode ?? false;
		this.#onopen = options.onopen ?? false;
		this.#onclose = options.onclose ?? false;
		this.#fade = options.fade ?? true;

		Popup.#numPopups++;

		const title = CreateElement("div", {
			class: "cs2s_popup_title",
			text: options.title ?? "",
			children: options.titleChildren ?? []
		});

		const simpleMode = options.simpleMode ?? false;
		const disableClose = options.disableClose ?? false;

		const closeButton = !simpleMode && CreateElement("div", {
			class: "cs2s_popup_close_button",
			onclick: () => {
				this.Hide();
			}
		});

		const popupBody = CreateElement("div", {
			class: `cs2s_popup_body`,
			children: [
				!disableClose && closeButton,
				title,
				...(options.body ?? [])
			]
		});

		if (simpleMode) {
			popupBody.classList.add("cs2s_popup_body_simple");
		}

		if (this.#popoverMode) {
			popupBody.classList.add("cs2s_popup_body_popover");
		}

		this.#background = CreateElement("div", {
			class: "cs2s_popup_background",
			style: {
				zIndex: 1000 + Popup.#numPopups
			}
		});

		this.#popupContainer = CreateElement("div", {
			class: "cs2s_popup_container",
			style: {
				zIndex: 1000 + Popup.#numPopups
			},
			children: [
				popupBody
			]
		});

		if (!disableClose) {
			this.#popupContainer.addEventListener("dblclick", (event) => {
				const box = popupBody.getBoundingClientRect();
				const style = getComputedStyle(popupBody);
				if (event.clientY < box.top
					|| event.clientX < box.left
					|| event.clientY > box.bottom + parseInt(style.marginBottom)
					|| event.clientX > box.right
				) {
					this.Hide();
				}
			});

			document.addEventListener("keydown", (event) => {
				if (!this.#visible) {
					return;
				}

				if (event.key === "Escape") {
					event.preventDefault();
					this.Hide();
				}
			});
		}
	}

	Show() {
		if (this.#visible) {
			return;
		}

		this.#visible = true;

		if (typeof this.#onopen === "function") {
			this.#onopen();
		}

		unsafeWindow.document.body.append(this.#background, this.#popupContainer);

		if (!this.#popoverMode) {
			if (this.#fade) {
				Fade(this.#background, {
					from: 0,
					to: getComputedStyle(this.#background).opacity
				});
			}

			unsafeWindow.document.body.classList.add("cs2s_popup_opened");
		}
	}

	Hide() {
		if (!this.#visible) {
			return;
		}

		this.#visible = false;

		if (typeof this.#onclose === "function") {
			this.#onclose();
		}

		if (this.#fade) {
			Fade(this.#background, {
				from: getComputedStyle(this.#background).opacity,
				to: 0,
				onfinish: () => {
					this.#background.isConnected && this.#background.remove();
				}
			});
		} else {
			this.#background.isConnected && this.#background.remove();
		}

		this.#popupContainer.isConnected && this.#popupContainer.remove();

		if (!this.#popoverMode) {
			unsafeWindow.document.body.classList.remove("cs2s_popup_opened");
		}
	}
};
