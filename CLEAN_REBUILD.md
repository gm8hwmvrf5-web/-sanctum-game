# Sanctum of the Damned — Multiplayer Clean Rebuild

This branch is a clean-source rebuild of the known-good `multiplayer-dev` game at commit `48aedfad37db12a5fee5b1dffdfc80065ad34f7a`.

## Safety

- `multiplayer-dev` is not modified by this rebuild.
- The rebuild started from the exact working multiplayer state.
- Artwork was extracted byte-for-byte from the embedded WebP data and stored under `assets/embedded/`.
- The game no longer depends on the stitched `parts/game-*.part` runtime on this branch.

## Source layout

- `index.html` — static game markup only.
- `src/js/00-data.js` — Priest, Demon, Boss, Crucifix, Relic, artwork and other game definitions.
- `src/js/10-engine.js` — core state, turns, combat, Rituals, Demon movement, boss flow, rendering and saves.
- `src/js/20-ui-foundation.js` — save/load, pause/menu and original tutorial support.
- `src/js/30-roguelite.js` — passages, floors, Ascension, Cinders, Legacy and run progression.
- `src/js/40-priest-ui.js` — Priest hand carousel, HUD placement and interactive tutorial UI.
- `src/js/50-mobile.js` — iPhone landscape/fullscreen/layout behavior and PWA registration.
- `src/js/60-multiplayer.js` — Supabase room/session synchronization and multiplayer authority.
- `src/js/70-multiplayer-patches.js` — final multiplayer-facing boss/deck/menu/relic/movement behavior.
- `src/styles/base.css` — base board/card/game styling.
- `src/styles/roguelite.css` — run/Legacy/Priest-play-area styling.
- `src/styles/mobile.css` — iPhone and compact landscape styling.
- `src/styles/multiplayer.css` — multiplayer lobby, boss reader and multiplayer-specific styling.

## Development rule

Make changes in the smallest relevant source module. Do not recreate giant embedded HTML or base64 artwork bundles. Keep assets external and keep multiplayer authority/synchronization isolated from normal game mechanics.

## Current goal

Match the working multiplayer build behavior first, then simplify active wrapper chains only when each replacement can be verified against the working baseline.
