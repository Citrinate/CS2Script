import Script, { ERROR_LEVEL } from '@core/script.js';

export default class Cache {
	static #dbName = 'cs2_script';
	static #storeName = 'kvp';
	static #version = 1;
	static #initPromise = null;
	static #keyName = "DB_ENCRYPTION_KEY";
	static #key = null;

	static async #Init() {
		if (this.#initPromise) {
			return this.#initPromise;
		}

		this.#initPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(this.#dbName, this.#version);

			request.onupgradeneeded = () => {
				const db = request.result;

				if (!db.objectStoreNames.contains(this.#storeName)) {
					db.createObjectStore(this.#storeName);
				}
			};

			request.onsuccess = async () => {
				const db = request.result;

				const testKey = "cache_validity_test";
				const testValue = 42;

				const storedKey = GM_getValue(this.#keyName, null);
				if (storedKey) {
					try {
						const raw = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
						this.#key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

						// Validate key
						await this.#Encrypt({ test: true });

						// Validate that existing database uses this key
						if (await this.#Get(db, testKey) !== testValue) {
							throw new Error("Cache failed to validate");
						}
					} catch (e) {
						Script.ShowError({ level: ERROR_LEVEL.MEDIUM }, e, new Error("Clearing cache"));

						this.#key = null;
					}
				}

				if (!this.#key) {
					const rawKey = crypto.getRandomValues(new Uint8Array(32));
					this.#key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

					GM_setValue(this.#keyName, btoa(String.fromCharCode(...rawKey)));

					await this.#Clear(db);
				}

				await this.#Set(db, testKey, testValue);

				resolve(db);
			};

			request.onerror = () => {
				reject(request.error);
			};
		});

		return this.#initPromise;
	}

	static async #Encrypt(data) {
		const encoded = new TextEncoder().encode(JSON.stringify(data));
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.#key, encoded);
		const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
		combined.set(iv, 0);
		combined.set(new Uint8Array(ciphertext), iv.byteLength);

		return combined.buffer;
	}

	static async #decrypt(buffer) {
		const combined = new Uint8Array(buffer);
		const iv = combined.slice(0, 12);
		const ciphertext = combined.slice(12);
		const encoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.#key, ciphertext);

		return JSON.parse(new TextDecoder().decode(encoded));
	}

	static async #Clear(db) {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(this.#storeName, 'readwrite');
			const store = tx.objectStore(this.#storeName);
			const req = store.clear();

			req.onsuccess = () => {
				resolve();
			}

			req.onerror = () => {
				reject(req.error);
			}
			});
	}

	static async #Get(db, key, defaultValue = null) {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(this.#storeName, 'readonly');
			const store = tx.objectStore(this.#storeName);
			const req = store.get(key);

			req.onsuccess = async () => {
				if (!req.result) {
					resolve(defaultValue);

					return;
				}

				try {
					resolve(await this.#decrypt(req.result));
				} catch (e) {
					Script.ShowError({ level: ERROR_LEVEL.MEDIUM }, e);

					resolve(defaultValue);
				}
			}

			req.onerror = () => {
				reject(req.error);
			}
		});
	}

	static async #Set(db, key, value) {
		const encrypted = await this.#Encrypt(value);

		return new Promise((resolve, reject) => {
			const tx = db.transaction(this.#storeName, 'readwrite');
			const store = tx.objectStore(this.#storeName);
			const req = store.put(encrypted, key);

			req.onsuccess = () => {
				resolve();
			}

			req.onerror = () => {
				reject(req.error);
			}
		});
	}

	static async GetValue(key, defaultValue = null) {
		return this.#Get(await this.#Init(), key, defaultValue);
	}

	static async SetValue(key, value) {			
		return this.#Set(await this.#Init(), key, value);
	}
}
