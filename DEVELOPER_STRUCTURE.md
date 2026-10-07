# Sanctum Developer Structure

This source layout is optimized for targeted development and AI-assisted GitHub edits while preserving the assembled game in the same runtime order.

## Editing rule

For normal gameplay, UI, mobile, or multiplayer changes, inspect only the relevant files under `parts/dev/`. Do not load the large legacy payload files unless the requested change specifically involves artwork or data stored there.

Every migrated source section was split only at existing newline boundaries and verified to reconstruct its original source exactly when joined with a newline, matching the loader's existing assembly behavior.

## Source map

- `parts/dev/10-shell/` — base HTML/CSS shell, shared visuals and responsive foundation.
- `parts/game-002.part` and `parts/game-003.part` — large legacy embedded payloads/assets. Avoid for routine code work.
- `parts/dev/40-gameplay/` — core gameplay actions, mana/blood, card transactions, Empowering, Ritual resolution and related mechanics.
- `parts/dev/50-tutorial/` — demon/art integration patches, tutorial, menu and save/load-related runtime additions.
- `parts/dev/60-run/` — run/floor/ascension flow, hand carousel, relic XP and run-progress behavior.
- `parts/dev/70-priest-ui/` — Priest dashboard/actions, relic/XP placement and Priest-area layout.
- `parts/dev/80-mobile/` — demon/boss popup behavior and dedicated iPhone-landscape layout.
- `parts/dev/81-mobile-polish/` — later iPhone/card/parchment/layout refinements.
- `parts/dev/90-multiplayer/` — multiplayer authority, synchronization, passage/reward ownership and multiplayer fixes.

## Runtime and cache

`index.html` is the canonical ordered source manifest. All source chunks are still concatenated before `document.write`, preserving the existing standalone game model.

The service worker now treats every path under `/parts/` as network-first. Cache version `sanctum-pwa-v19` is used for this developer-structure migration.

## Goal

Routine changes should now require reading tens of kilobytes instead of megabytes. The two large embedded payloads remain isolated so they do not consume development context unless a change actually needs them.
