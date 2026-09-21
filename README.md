# Hyrule Object Map: mobile viewer

A mobile-first interface for the Breath of the Wild object database, built on a fork of [MrCheeze/botw-object-map](https://github.com/MrCheeze/botw-object-map). The fork retains the original map imagery, Leaflet library and object data, but replaces the desktop homepage with a full-screen, touch-friendly map.

**Live site:** https://leadresponsesystems.github.io/botw-object-map/

## On iPhone

Open the live site in Safari. Tap **Explore objects** at the bottom to open search, enter an object such as Rushroom or Lynel, or tap a category chip, then tick an object type to show its positions. Tap the target icon on a result row to jump to its first location. Tap the sheet handle or the collapse arrow to return to the map. You can pinch and drag the map. Use the HD button if you want a higher-resolution map. For an app-like shortcut, use Safari's **Share → Add to Home Screen**.

The **ⓘ** button switches between Overworld, Dungeons, Hyrule Castle and Trial of the Sword datasets. Chosen object types are stored locally per dataset.

## Performance and limitations

The interface renders at most 65 search results initially and up to 700 markers within the visible area. It caps concurrent object type selections at 60. The map first requests a resized WebP image via wsrv.nl and falls back to the original large PNG if needed. Initial loading still requires the original roughly 11 MB Overworld object database, and the app has not been verified on physical iPhone Safari. Internet access is needed to load the data and map; this is not an offline map. Dynamically spawned game objects may not be represented.

The small app shell is cached by a service worker to facilitate home-screen use, but the map database and imagery are not bundled for offline access. No backend, account, build tooling or paid API is required.

## Source and credits

Original object data, map imagery and map engine: [MrCheeze](https://github.com/MrCheeze/botw-object-map). This is an independent, noncommercial viewer and is not affiliated with Nintendo or MrCheeze. The upstream repository does not specify a top-level license; verify rights before reusing its assets commercially.

## Local development

Serve the repository root over HTTP, for example `python3 -m http.server 8000`, then open `http://localhost:8000`. The viewer uses `index.html`, `app.css`, `app.js`, `manifest.webmanifest`, `sw.js` and `assets/icon.svg`, plus the original fork's data and map files. GitHub Pages deploys from the `gh-pages` branch root.