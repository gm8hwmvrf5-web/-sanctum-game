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

## Wardcraft (optional tactical Wards, 2026-10)

Ten unique Wards have 3-choice drafts at the start of every third combat passage (combat passages 3, 6, 9, etc., including boss fights). Sanctuary and Sinking Repository visits do not count toward the interval. The passage chooser picks one shared Ward. Priests can place it during their own Priest phase by spending shared Mana and personal Blood. Only one Ward may be placed per round and one active across the board. Wards have two Demon Phases of duration and a limited number of activations. Room overlays glow with each Ward's own color, without covering Demon cards. The ten generated paintings are packed into a small optimized WebP sprite sheet and used both as choice card art and as faint overlays. Support for multiplayer state, vote choice reconstruction, and save/load is included. Source: `src/js/80-wards.js`, `src/styles/wards.css`, `assets/wards/ward-art-sprite.webp`.

### Wardcraft high-resolution illustrations

Ten individual optimized 900 × 600 WebP illustrations are stored in `assets/wards/ward-<key>.webp` and selected by their Ward key. The Ward selection modal, inline selector, and translucent under-card room glow all reuse the same image. The old low-resolution sprite is not loaded. Keep Ward colors, layering, and the live mechanic state unchanged when adjusting artwork. Each optimized image is approximately 130–170 KB, compared with the previous 3.7 KB sprite for all ten images.

### Sinking Repository after Bosses

The Sinking Repository now appears as a **guaranteed, separate stop after every Boss** (cycle floors 5, 10, and 15). Bosses on floors 5 and 10 still give their normal act rewards before the shop; the floor-15 shop opens before unspent Cinders bank at the Legacy checkpoint. The random route appearance, eight-Cinder requirement, and two-visits-per-cycle limit are removed. Purchases remain run-only; the shop can be left without buying. Its offers are limited to what the party can afford, with a free exit even at zero Cinders. The shop does not consume another floor or change Ward drafting cadence.
