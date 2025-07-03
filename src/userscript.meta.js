import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

export const userscriptHeader = 
`// ==UserScript==
// @name        Counter-Strike 2 Script
// @namespace   https://github.com/Citrinate
// @author      Citrinate
// @description Manage your CS2 storage units and inspect items
// @license     Apache-2.0
// @version     ${pkg.version}
// @match       https://steamcommunity.com/id/*/inventory*
// @match       https://steamcommunity.com/profiles/*/inventory*
// @match       https://steamcommunity.com/market/listings/*
// @connect     localhost
// @connect     127.0.0.1
// @connect     *
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// @grant       unsafeWindow
// @homepageURL https://github.com/Citrinate/CS2Script
// @supportURL  https://github.com/Citrinate/CS2Script/issues
// @downloadURL https://github.com/Citrinate/CS2Script/releases/latest/download/code.user.js
// @updateURL   https://github.com/Citrinate/CS2Script/releases/latest/download/code.user.js
// ==/UserScript==`;
