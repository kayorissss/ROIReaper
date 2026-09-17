## Changes in this PR

Transformed ROIReaper from a 12-mini-game web suite into **CHUBUGAMES — Cashier 3D (v1.1.0)**, a full 3D first-person cashier simulator.

### What's changed:
- **Game core**: Replaced all 12 old mini-games (clicker, durak, slots, casino, etc.) with a single 3D cashier simulator using Three.js
- **3D gameplay**: First-person view (WASD + mouse look), cashier at register, shelves with products, customers walking around
- **Money system**: 🍯 Honey currency + total earnings; cash register animates open/closed
- **Barcode/QR pickups**: 5 collectibles worth 2-10 honey each scattered in the 3D world
- **Upgrade system**: Speed, extra shelves, loyalty discount (cost: 10 honey each)
- **Levels/progression**: More customers/speed per level
- **Splash screen**: CHUBUGAMES studio branding with "Начинаем рабочий день..." progress bar
- **Beautiful UI**: Dark theme, amber accents, animated progress bar, hover states
- **Graphics settings**: High/Medium/Low saved to localStorage
- **README**: Rewritten with CHUBUGAMES description and new release assets
- **Package.json**: v1.1.0, CHUBUGAMES branding, new keywords

### Installers (built):
- `ROIReaper-Setup-1.1.0.exe` — Full Windows installer
- `ROIReaper-1.1.0-Portable.zip` — Standalone (run index.html in browser)

### Key files modified:
- `src/renderer/index.html` — Full 3D game replacing all mini-games
- `README.md` — New game description
- `package.json` — v1.1.0, CHUBUGAMES branding
- All old game JS files deleted (`clicker.js`, `durak.js`, `slots.js`, etc.)

### Screenshot/Preview:
The game runs in-browser with Three.js, bloom post-processing, PointerLock FPS controls, and a beautiful styled UI overlay.

---
*This PR creates the CHUBUGAMES Cashier 3D game as the sole focus of ROIReaper v1.1.0, replacing the mini-game collection with one deep, polished experience.*