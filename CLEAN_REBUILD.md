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

### Balance Update 1.0 — Moderately challenging

- **Enemy HP and Attack:** Each cycle resets its per-floor multiplier to `1 + 0.03 × (cycle floor − 1)`; cycle multipliers progress `1.0×, 1.5×, 2.25×, …` (cycle 1/2/3). Existing Elite and Greater differences remain. Votive Candle effects remain 10% / 12.5% / 15% non-stacking run reductions.
- **Boss Altar Phase damage:** For Bosses with 6 printed Altar damage, Acts 1/2/3 drain 1/2/3 (solo), 2/3/4 (2P), 3/4/5 (3P), or 4/5/6 (4P). Bosses with 5 or 7 printed damage apply −1 or +1, to a minimum of 1. Each later cycle adds 1, maximum 8. This drain no longer uses the enemy stat multiplier. Boss summons and unique abilities remain.
- **Relic XP:** Start at 20 XP, then +8 XP per XP-earned Relic (20, 28, 36, 44, 52). Reward and store Relics remain separate from XP cost increases.
- **Sinking Repository:** Store remains guaranteed after each Boss, before Cycle banking. Fixed cycle 1 / 2 / 3+ Cinder prices: each random Relic 10 / 12 / 14; Candle Bundle 8 / 10 / 12; Forbidden Folio 12 / 14 / 16. Folio increases maximum hand size by 1, limited to 2 purchases per run. Existing effects, single purchase per visit, and Leave option are unchanged.
- **Shared Mana:** 1P=10, 2P=15, 3P=23, 4P=32. Normal Demon spawns stay unchanged.
- **Demon effect safety:** Thorn Martyr's damaged retaliation occurs at most once per Priest round (Lesser 1 / Greater 2 Altar). Combined Demon/Boss-Phase Mana drains carry to the next Priest round with caps of 3/4/6/8 for 1/2/3/4 players. Immediate Priest-Phase Mana losses and card taxes are unchanged.
- **Wardcraft costs:** Cinder 3 Mana+1 Blood; Thorns 3+1; Chains 2+1; Bell 3+1; Silence 3+1; Lantern 2+1; Vigil 2+1; Absolution 2+0; Siphon 2+0; Chalice 2+0. Ward effects, charges, 2-phase lifespan, artwork, and every-third-combat-passage offers are unchanged.

Balance changes are checked by `scripts/balance-1-0-smoke.mjs` alongside the gameplay and multiplayer browser smoke suite. The proposed first-cycle 65–75% completion target is a tuning goal, not an established measured win rate.

### Balance Update 1.1 — Moderately challenging follow-up

- **Sanctuary route choice:** A Ruined Sanctuary substitutes for one of three combat choices with a 1-in-3 probability on eligible route offers; at most **one Sanctuary may be visited per Act per cycle**. This count is serialized with the run and resets for the next Act or cycle.
- **Excess Blood healing:** The party may recover a maximum of **4 actual Altar Protection per round** from all excess Blood sources combined, including the Consecrated Chapel healing bonus. Blood itself still distributes to each Priest according to the unchanged multiplayer kill rule.
- **Possessor penalties:** The total extra Priest card Mana cost from Possessors and Desecrated Chapel is limited to **+2** with one or two Priests and **+3** with three or four Priests. The printed Demon abilities still apply up to this cap.
- **Relic Basic Attack growth:** Relic damage bonuses of 0–5 apply at full strength; after +5, each two additional raw Relic attack points yield +1 effective attack. Legacy Basic Attack upgrades retain their full additive value, and critical chance, Fire, and Poison keep their existing rules.
- **Boss HP party multipliers:** 70% for 1P, 85% for 2P, 105% for 3P, and 125% for 4P, before Roguelite Act/Cycle scaling. Boss Altar drains follow Balance 1.0 unchanged.
- **Automatic Altar renewal:** Combined beginning-of-Priest-turn and beginning-of-round renewal healing is capped at **6 actual Altar Protection per round**. Immediate Altar healing, Demon-defeat healing blessings, and other sources are separate and unaffected. Renewal charges still tick when they activate.
- **Monk:** Palm of Judgment deals **4/8 base damage to bosses** for Lesser/Greater, while preserving **2/6 damage and 1/2-space knockback** against ordinary Demons. Inner Peace gives **2/3 Blood** for Lesser/Greater, and Greater still draws two Priest cards. Ritual Power Relics still add their printed bonuses.

Validated by `scripts/balance-1-1-smoke.mjs` alongside the Balance 1.0 and multiplayer browser suite. These are targeted balance assertions rather than measured real-world completion-rate statistics.

## Account-based cloud saves (Clean Rebuild)

**Account / Cloud Saves** is available inside the Tab/Pause game menu. Players can
create an account using an email address and password, sign in, and manually
save or load **three private cloud slots** from PC, phone, or tablet. A saved
run includes the complete versioned gameplay snapshot (Priest hands, relics,
room positions, bosses, status effects, etc.). "Upload Browser Save" transfers
a previously saved local run without loading it first; "Save Current Run"
uploads the currently active run. Cloud loading also stores a new browser save
on that device, so browser/offline backup workflows remain intact.

This feature uses a **second** Supabase JS client with persistent Auth tokens
under `sanctum_cloud_account_auth_v1`; the multiplayer room client and its
existing anonymous session behavior are not modified. Cloud slots have an
`auth.uid() = user_id` RLS policy for all SELECT/INSERT/UPDATE/DELETE; anon
accounts have no table access. Cloud data is private to the signed-in account.
No Supabase service-role secret is present in browser files.

**Scope and safeguards:** Cloud saves are manual; they are not silently
overwritten between devices. Overwriting and deleting a cloud slot require
confirmation. Cloud load/save is disabled during live online multiplayer
rooms, since multiplayer state is governed by the authoritative room, and
loading a personal snapshot could disrupt other players. Local browser
saves and JSON import/export continue to work without logging in.

For email confirmation: enable Supabase Auth Email sign-in. New-account
confirmation emails must be deliverable; for a clean return link set the
project's Auth Site URL / redirect allowlist to the published Clean Rebuild
URL. If confirmation is enabled, first confirm the email before using
password sign-in. Configure a production SMTP provider for large-scale use
(Supabase built-in email delivery may be rate-limited).

Schema: Supabase migration `create_sanctum_cloud_save_slots`; table
`public.sanctum_cloud_saves`. Browser regression:
`node scripts/cloud-saves-smoke.mjs` (mock backend; creates no real users).
