# Counter-Strike 2 Script

A userscript for managing your storage units and viewing detailed item information.

## Installation

1. Install a userscript manager like [Violentmonkey](https://violentmonkey.github.io/)
2. Go [here](https://github.com/Citrinate/CS2Script/releases/latest/download/code.user.js) and click "Install"
3. Make sure that you have:
    - [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm) with [IPC](https://github.com/JustArchiNET/ArchiSteamFarm/wiki/IPC) enabled (which is the default)
    - The [Counter-Strike 2 Interface plugin](https://github.com/Citrinate/CS2Interface) (v1.1.0.0 or newer)

## Is this safe to use?

This userscript and its associated ASF plugin work without knowing any of your private account details (their connection to Steam is fully managed by ArchiSteamFarm). All source code is open source, and all releases obtained from official sources are verifiably built from that source code.

Nothing here interacts with the Counter-Strike 2 game client, nor are you even required to have the game installed, and so there is no risk of receiving a VAC ban. No Steam account data, CS2 item data, or any other information is shared through usage of this script or its associated plugin.

This tool works by sending requests to the Counter-Strike 2 game coordinator. No serious attempt is made to trick Valve's servers into thinking these requests are coming from an authentic Counter-Strike 2 game client, and so it should be assumed that Valve can identify all accounts using tools like this. Valve has not been known to take action against such accounts, but there is no guarantee that this will always be the case.

## Features

### Storage Unit Management

Access your storage unit contents directly from your Steam inventory. Interact with individual storage units or all of them at once. Once loaded, the contents are cached, and can be viewed without your ASF bot.

[![Storage Unit Selection](/screenshots/thumbnails/casket_select.png)](/screenshots/casket_select.png) [![Storage Unit Interface](/screenshots/thumbnails/casket_interface.png)](/screenshots/casket_interface.png)

---

### Item Inspection

View detailed item information in Steam inventories or on the Steam marketplace. Each ASF bot can inspect one item per second, so the more bots you have, the faster you'll be able to inspect large amounts of items.

> [!NOTE]
> This can be disabled under "Settings" if you're also using another tool that provides a similar feature

[![Inventory Items](/screenshots/thumbnails/inventory_items.png)](/screenshots/inventory_items.png) [![Market Items](/screenshots/thumbnails/market_items.png)](/screenshots/market_items.png)

## Usage

If using non-default IPC settings, the first thing you'll need to do is open "Settings" and configure how the script connects to ASF. Status and controls for the script can be found in the account dropdown menu, while on any Steam inventory or market listing page.

[![Menu](/screenshots/thumbnails/script_menu.png)](/screenshots/script_menu.png) [![Settings](/screenshots/thumbnails/script_settings.png)](/screenshots/script_settings.png)

When managing your storage units, there's no need to manually start or stop the interface. If not running, you'll be be prompted to start the interface whenever it's required, and it will automatically stop after a period of inactivity (note: simply viewing a page where the script is active counts as activity).

To inspect items, the interface must be running on at least any one bot. If you want certain bots to have the interface always running for this purpose, it’s recommended you configure them to [auto-start](https://github.com/Citrinate/CS2Interface#autostartcs2interface) the interface.
