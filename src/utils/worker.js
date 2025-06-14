import { Sleep } from '@utils/helpers.js';

export default class Worker {
	#queue = [];
	#activeTasks = 0;
	#concurrentLimit;
	#delay;
	#running = false;
	cancelled = false;

	constructor(options = {}) {
		const { concurrentLimit = 1, delay = 0 } = options;

		this.#concurrentLimit = typeof concurrentLimit === "function" ? concurrentLimit : () => concurrentLimit;
		this.#delay = delay;
	}

	Add(task, options = {}) {
		if (this.cancelled) {
			return;
		}

		if (options.priority ?? false) {
			this.#queue.unshift(task);
		} else {
			this.#queue.push(task);
		}
	}

	Run() {
		if (this.#running) {
			return;
		}

		this.#running = true;

		(async () => {
			while (this.#queue.length > 0) {
				if (this.#activeTasks < this.#concurrentLimit()) {
					const task = this.#queue.shift();

					this.#activeTasks++;

					(async () => {
						try {
							await task();
						} finally {
							this.#activeTasks--;
						}
					})();
				} else {
					await Sleep(50);
				}

				if (this.#queue.length > 0) {
					await Sleep(this.#delay);
				}
			}

			this.#running = false;
		})();
	}

	async Finish() {
		while (this.#activeTasks > 0 || this.#queue.length > 0) {
			await Sleep(50);
		}
	}

	async Cancel() {
		this.cancelled = true;
		this.#queue.length = 0;

		await this.Finish();
	}
}
