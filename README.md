# Counter-Strike 2 Script

[![Check out my other ArchiSteamFarm projects](https://img.shields.io/badge/Check%20out%20my%20other%20ArchiSteamFarm%20projects-blue?logo=github)](https://github.com/stars/Citrinate/lists/archisteamfarm-plugins)  ![GitHub all releases](https://img.shields.io/github/downloads/Citrinate/CS2Script/total?logo=github&label=Downloads)

## Introduction

This is a userscript for managing your Counter-Strike 2 storage units and inspecting items.

> [!NOTE]
> This script requires that you use [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm)

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

Status and controls for the script can be found in the account dropdown menu, while on any Steam inventory or market listing page.  If using non-default IPC settings with ASF, you'll need to configure how the script connects to ASF under "Settings".

[![Menu](/screenshots/thumbnails/script_menu.png)](/screenshots/script_menu.png) [![Settings](/screenshots/thumbnails/script_settings.png)](/screenshots/script_settings.png)

You have the option to manually Start and Stop the interface (connecting and disconnecting your account from CS2).  This is only necessary when you want to inspect items.  When managing your storage units, the script will prompt you to connect whenever necessary.  By default, the interface will automatically stop after a period of inactivity (note: simply viewing a page where the script is active counts as activity).

To inspect items, the interface must be running on at least any one bot. If you want certain bots to have the interface always running for this purpose, it’s recommended you configure them to [auto-start](https://github.com/Citrinate/CS2Interface#autostartcs2interface) the interface.
