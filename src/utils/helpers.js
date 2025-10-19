export function Request(url) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);

		xhr.onload = function () {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(xhr.responseText);
			} else {
				reject(new Error(`Request failed with status: ${xhr.status}`));
			}
		};

		xhr.onerror = function () {
			reject(new Error('Network error occurred'));
		};

		xhr.ontimeout = function () {
			reject(new Error('Request timed out'));
		};

		xhr.send();
	});
}

export function CreateElement(tag, options) {
	const el = document.createElement(tag);

	if (options) {
		for (const [key, value] of Object.entries(options)) {
			if (key === "class") {
				el.className = value;
			} else if (key === "html") {
				el.innerHTML = value;
			} else if (key === "text") {
				el.innerText = value;
			} else if (key === "hide" && value) {
				el.hide();
			} else if (key === "style") {
				Object.assign(el.style, value);
			}  else if (key === "vars") {
				for (const [varName, varValue] of Object.entries(value)) {
					el.style.setProperty(`--${varName}`, varValue);
				}
			} else if (key === "dataset") {
				Object.assign(el.dataset, value);
			} else if (key === "disabled") {
				el.disabled = value;
			} else if (key === "selected") {
				el.selected = value;
			} else if (key.startsWith("on") && typeof value === "function") {
				el.addEventListener(key.slice(2).toLowerCase(), value);
			} else if (key === "htmlChildren") {
				for (const child of value) {
					if (!child) {
						continue;
					}

					el.insertAdjacentHTML("beforeend", child);
				}
			} else if (key === "children") {
				for (const child of value) {
					if (!child) {
						continue;
					}

					el.append(child instanceof Node ? child : document.createTextNode(child));
				}
			} else {
				el.setAttribute(key, value);
			}
		}
	}

	return el;
}

export function CreateCachedAsyncFunction(asyncFunction) {
	let cache = null;
	let inProgress = null;

	const wrapped = async () => {
		if (cache !== null) {
			return cache;
		}

		if (inProgress) {
			return inProgress;
		}

		inProgress = asyncFunction().then(result => {
			cache = result;

			return result;
		});

		return inProgress;
	};

	wrapped.willReturnImmediately = () => {
		return cache !== null;
	};

	return wrapped;
}

export function BindTooltip(element, text, options = {}) {
	if (element.unbindTooltip) {
		element.unbindTooltip();
	}

	const tooltip = CreateElement("div", {
		class: "cs2s_tooltip",
		text: text
	});

	let fadeOutAnimation = null;

	if (options.showStyle ?? true) {
		element.classList.add(`cs2s_has_tooltip`);
	}

	function onMouseEnter() {
		if (fadeOutAnimation) {
			fadeOutAnimation.cancel();
			fadeOutAnimation = null;
		}

		const rect = element.getBoundingClientRect();

		document.body.appendChild(tooltip);
		void tooltip.offsetWidth;
		tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
		tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2}px`;

		Fade(tooltip, { from: 0, to: 1, duration: 200 });
	}

	function onMouseLeave() {
		fadeOutAnimation = Fade(tooltip, {
			from: 1,
			to: 0,
			duration: 200,
			onfinish: () => {
				tooltip.isConnected && tooltip.remove();
			}
		});
	}

	element.addEventListener("mouseenter", onMouseEnter);
	element.addEventListener("mouseleave", onMouseLeave);
	element.unbindTooltip = () => {
		element.removeEventListener("mouseenter", onMouseEnter);
		element.removeEventListener("mouseleave", onMouseLeave);
		element.classList.remove(`cs2s_has_tooltip`);
		element.unbindTooltip = null;
		tooltip.isConnected && tooltip.remove();
	}

	return tooltip;
}

export function Fade(element, options) {
	const to = options.to ?? 1;

	if (typeof options.from !== "undefined") {
		element.style.opacity = options.from;
	}

	const animation = element.animate({
		opacity: to
	}, {
		duration: options.duration ?? 250,
		easing: "ease",
		fill: "forwards"
	});

	if (typeof options.onfinish === "function") {
		animation.onfinish = () => {
			options.onfinish();
		}
	}

	return animation;
}

export function Sleep(milliseconds) {
	if (milliseconds <= 0) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

export function Random(min, max) {
	return Math.random() * (max - min) + min;
}

export function CompareVersions(v1, v2) {
	const parts1 = v1.split('.').map(Number);
	const parts2 = v2.split('.').map(Number);
	const length = Math.max(parts1.length, parts2.length);

	for (let i = 0; i < length; i++) {
		const num1 = parts1[i] || 0;
		const num2 = parts2[i] || 0;

		if (num1 > num2) return 1;
		if (num1 < num2) return -1;
	}

	return 0;
}
