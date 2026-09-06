# BUFI VPN 😄

A prank app to mess with friends — UI similar to Mullvad, but under the hood it only **changes your DNS** to a public DNS provider (Cloudflare / Quad9 / Google / OpenDNS depending on the region you pick), then plays a "connecting to VPN" animation with fake stats (speed, ping, new IP...) for fun.

**No data collection, no hidden process files, uninstalls normally** via Windows Settings > Apps.

## How it works
- Pressing "Connect" calls `netsh` (needs Administrator rights) to set a static DNS on every active network adapter.
- Pressing "Disconnect" resets DNS back to automatic (DHCP).
- Your current location is auto-detected via IP (ipapi.co / ipwho.is) — no location permission needed.
- All speed/ping/IP numbers shown while "connected" are **random fake numbers**, purely decorative.
- The world map is a fully offline vector map (SVG, real country borders bundled in the app) — no internet connection is required to see it. You can zoom (scroll wheel or the +/− buttons) and drag to pan.
- The status pin is **red** at your current location, turns **yellow** while "flying" to the destination, and **green** once connected.
- The app keeps running in the background when you close the window (so the fake connection state persists) — a full close/exit is only done from the **system tray icon → Exit**. Left-clicking the tray icon opens a small flyout, just like real VPN apps.
- Default language is English.

## Building the Windows installer

### Option 1: Let GitHub Actions build it (recommended)
1. Create a new GitHub repo and push everything in this folder.
2. Go to the **Actions** tab — the "Build BUFI VPN (Windows)" workflow runs automatically.
   - Or go to Actions → select the workflow → **Run workflow** to trigger it manually.
3. Wait for the build to finish (~5-10 min), then open that run's **Artifacts** section to download the `.msi`/`.exe` installer.
4. (Optional) Push a Git tag like `v1.0.0` and the workflow will attach the installer to a GitHub Release automatically.

> Note: this source code was generated on a Linux machine, so **it cannot build the Windows .exe/.msi locally here**. The real build happens on GitHub Actions' `windows-latest` runner — the standard approach recommended by Tauri itself.

### Option 2: Build locally on your own Windows machine
Requires: [Node.js](https://nodejs.org), [Rust](https://rustup.rs), and [Visual Studio Build Tools](https://tauri.app/v1/guides/getting-started/prerequisites) (needed by Tauri).

```powershell
npm install
npm run build
```

The installer will be at:
```
src-tauri/target/release/bundle/msi/BUFI VPN_0.1.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/BUFI VPN_0.1.0_x64-setup.exe
```

## App icons (drop your images here)

Two different images are used, dropped in two different places:

| Image | Where to put it | Notes |
|---|---|---|
| **App icon** (.exe / installer / taskbar / tray icon) | `src-tauri/icons/source.png` | Square PNG, 1024×1024 recommended, transparent background. The GitHub Actions workflow automatically runs `tauri icon` on this file before building, generating every required size/format (`.ico`, `.icns`, all PNG sizes) — this is the "auto-convert" step. If this file is missing, the existing default icons are kept. |
| **In-app logo** (next to the "BUFI VPN" text in the header) | `src/assets/logo.png` (or `.svg`) | Used directly, no conversion needed. If the file is missing, the app just hides that spot gracefully. |

## Regenerating the offline world map (optional)

The country-border SVG data lives in `src/assets/world-map-paths.js` and is generated from public-domain map data (Natural Earth, via the `world-atlas` npm package) — it's a static file, no internet needed at runtime. To regenerate it:

```bash
npm install
npm run gen-map
```

## Project structure
```
bufi-vpn/
├── src-tauri/          # Rust backend (DNS via netsh, admin rights, system tray, windows)
├── src/                # HTML/CSS/JS UI
│   ├── index.html       # Main window (map, server list)
│   ├── popup.html/.js   # Small flyout shown from the tray icon
│   ├── data.js           # Shared server list + DNS providers
│   └── assets/           # Offline map data, logo, etc.
├── scripts/gen-map.mjs # Regenerates the offline map SVG data
├── .github/workflows/  # GitHub Actions build installer
└── package.json
```

## Uninstalling
Go to **Settings > Apps > Apps & features**, find "BUFI VPN" → Uninstall, just like any normal Windows app. (Tip: exit the app from the tray icon first so DNS is reset before uninstalling.)
