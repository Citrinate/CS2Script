import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: {
			globals: {
				...globals.browser,
				GM_xmlhttpRequest: 'readonly',
				GM_getValue: 'readonly',
				GM_setValue: 'readonly',
				GM_addStyle: 'readonly',
				GM_registerMenuCommand: 'readonly',
				unsafeWindow: 'readonly'
			}
		},
		rules: {
			"no-unreachable": "warn"
		},
	}
]);
