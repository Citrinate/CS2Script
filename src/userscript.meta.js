import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

export const userscriptHeader = 
`// ==UserScript==
// @name        Counter-Strike 2 Script
// @namespace   https://github.com/Citrinate
// @author      Citrinate
// @description Manage your storage units and view detailed item information
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
// @require     https://github.com/Tampermonkey/utils/raw/d8a4543a5f828dfa8eefb0a3360859b6fe9c3c34/requires/gh_2215_make_GM_xhr_more_parallel_again.js
// ==/UserScript==`;
