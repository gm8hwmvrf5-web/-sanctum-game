import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const required=[
  'index.html','service-worker.js','manifest.webmanifest',
  'src/styles/base.css','src/styles/roguelite.css','src/styles/mobile.css','src/styles/multiplayer.css','src/styles/accessibility.css','src/styles/accessibility.css',
  'src/js/00-data.js','src/js/10-engine.js','src/js/15-asset-loader.js','src/js/20-ui-foundation.js','src/js/25-font-settings.js','src/js/30-roguelite.js',
  'src/js/25-font-settings.js','src/js/40-priest-ui.js','src/js/50-mobile.js','src/js/60-multiplayer.js','src/js/70-multiplayer-patches.js',
  'src/js/80-wards.js','src/js/85-demon-merge-fx.js','src/js/86-elemental-damage-fx.js','src/js/87-cloud-saves.js','src/styles/demon-merge-fx.css','src/styles/elemental-damage-fx.css','src/styles/cloud-saves.css',
];

for(const file of required){
  if(!fs.existsSync(path.join(root,file))) throw new Error('Missing required file: '+file);
}

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(index.includes('parts/game-')) throw new Error('Clean index still references stitched game parts.');
if(index.includes('data:image/')) throw new Error('Clean index still contains embedded image data.');
if(!index.includes('</body>')||!index.includes('</html>')) throw new Error('Index markup is incomplete.');
if(index.includes('\\n<script')) throw new Error('Index contains a literal \\n before a script tag.');
if(index.includes('\\n<link')) throw new Error('Index contains a literal \\n before a stylesheet link.');
for(const token of ['damageFontSize','abilityFontSize','src/styles/accessibility.css','src/js/25-font-settings.js']){
  if(!index.includes(token)) throw new Error('Font controls wiring missing: '+token);
}
for(const element of ['pauseInviteFriendsBtn','pauseCloudSavesBtn','cloudSaveModal','cloudLoginBtn','cloudSignupBtn','cloudSaveSlots']){
 if(!index.includes('id="'+element+'"'))throw new Error('Cloud save UI missing: '+element);
}

const onlineSource=fs.readFileSync(path.join(root,'src/js/60-multiplayer.js'),'utf8');
for(const token of ['hostSavedRun','resumeSavedRun','createResumeParty','savedRunLobby','resumePending','mpResumeSavedBtn','SAVED_INVITE_KEY','scale','p_character_key','pushSharedState(\'game_start\'']){
 if(!onlineSource.includes(token))throw new Error('Loaded-run invite missing multiplayer hook: '+token);
}
const cloudSource=fs.readFileSync(path.join(root,'src/js/87-cloud-saves.js'),'utf8');
for(const token of ['signInWithPassword','signUp','sanctum_cloud_saves','upsert','applyLoadedSave','auth.getUser','sanctum_cloud_account_auth_v1']){
 if(!cloudSource.includes(token))throw new Error('Cloud save implementation missing: '+token);
}
const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
for(const asset of ['src/js/85-demon-merge-fx.js','src/styles/demon-merge-fx.css',
  'src/js/86-elemental-damage-fx.js','src/styles/elemental-damage-fx.css',
  'src/js/87-cloud-saves.js','src/styles/cloud-saves.css']){
 if(!index.includes('./'+asset)||!serviceWorker.includes('./'+asset)){
  throw new Error('Demon merge FX must load and precache '+asset);
 }
}

if(serviceWorker.includes('\\n')) throw new Error('Service worker contains a literal \\n escape outside a string.');

const ordered=[
 'src/js/00-data.js','src/js/10-engine.js','src/js/15-asset-loader.js','src/js/20-ui-foundation.js','src/js/30-roguelite.js',
 'src/js/40-priest-ui.js','src/js/50-mobile.js','src/js/60-multiplayer.js','src/js/70-multiplayer-patches.js',
 'src/js/80-wards.js','src/js/85-demon-merge-fx.js','src/js/86-elemental-damage-fx.js','src/js/87-cloud-saves.js',
];
let last=-1;
for(const file of ordered){
  const i=index.indexOf('./'+file);
  if(i<0) throw new Error('Index does not reference '+file);
  if(i<=last) throw new Error('Script order is incorrect at '+file);
  last=i;
}

for(const dir of ['src/js','src/styles']){
  for(const name of fs.readdirSync(path.join(root,dir))){
    const file=path.join(root,dir,name);
    if(!fs.statSync(file).isFile()) continue;
    const text=fs.readFileSync(file,'utf8');
    if(text.includes('data:image/') && text.includes(';base64,')) throw new Error('Base64 image payload remains in '+path.relative(root,file));
    if(text.includes('parts/game-')) throw new Error('Legacy stitched-part reference remains in '+path.relative(root,file));
  }
}

const sourceFiles=[
  'src/styles/base.css','src/styles/roguelite.css','src/styles/mobile.css','src/styles/multiplayer.css',
  'src/js/00-data.js','src/js/10-engine.js','src/js/15-asset-loader.js','src/js/20-ui-foundation.js','src/js/30-roguelite.js',
  'src/js/40-priest-ui.js','src/js/50-mobile.js','src/js/60-multiplayer.js','src/js/70-multiplayer-patches.js'
];
for(const source of sourceFiles){
  const text=fs.readFileSync(path.join(root,source),'utf8');
  const refs=[...text.matchAll(/(?:\.\.\/\.\.\/|\.\/)assets\/embedded\/([a-z0-9_-]+\.webp)/gi)].map(m=>m[1]);
  for(const ref of refs){
    if(!fs.existsSync(path.join(root,'assets/embedded',ref))) throw new Error('Missing extracted asset '+ref+' referenced by '+source);
  }
}

const embeddedDir=path.join(root,'assets/embedded');
const embedded=fs.existsSync(embeddedDir)?fs.readdirSync(embeddedDir).filter(x=>x.endsWith('.webp')):[];
if(embedded.length!==108) throw new Error('Expected 108 optimized WebP assets including ten new Demon illustrations, found '+embedded.length);


const obsoleteTokens=[
  'tutorialWelcome','tutorialCoach','tutorialResumeChip','sanctumTutorialScript',
  'mobileNav','mobileFullscreenBtn','mobilePauseMenuBtn','removeObsoleteMobileNav',
  'sanctumViewportFullscreen','iphoneFullscreenControl'
];
for(const file of ['index.html','src/js/20-ui-foundation.js','src/js/40-priest-ui.js','src/js/50-mobile.js','src/styles/roguelite.css','src/styles/mobile.css']){
  const text=fs.readFileSync(path.join(root,file),'utf8');
  for(const token of obsoleteTokens){
    if(text.includes(token))throw new Error('Obsolete clean-rebuild token '+token+' remains in '+file);
  }
}

const mergeEngine=fs.readFileSync(path.join(root,'src/js/10-engine.js'),'utf8');
for(const token of ['demonMergeVisuals','S.rooms[0].push(host)','mergedThisPhase','__sanctumRenderDemonMergeFx']){
 if(!mergeEngine.includes(token))throw new Error('Demon fusion Gateway visuals missing: '+token);
}
const elementalSource=fs.readFileSync(path.join(root,'src/js/70-multiplayer-patches.js'),'utf8');
const elementalVisualSource=fs.readFileSync(path.join(root,'src/js/86-elemental-damage-fx.js'),'utf8');
for(const key of ['elementalDamageVisual','elementalHp','elementalVisualAnchor'])if(!elementalSource.includes(key))throw new Error('Elemental damage event missing: '+key);
for(const key of ['sanctum-elemental-mark','sanctum-elemental-damage','elementalPoisonHits','elementalBurnQueue'])if(!elementalVisualSource.includes(key))throw new Error('Elemental art marker or floating number missing: '+key);
const dataSource=fs.readFileSync(path.join(root,'src/js/00-data.js'),'utf8');
if(!dataSource.includes('{n:"Quick Prayer",m:4')||
   !dataSource.includes('k:"quickPrayer",v:2,xv:3')){
  throw new Error('Quick Prayer must cost 4 Mana and use the targeted 2-card draw effect.');
}

if(!dataSource.includes('Palm of Judgment')||!dataSource.includes('Deal 2 damage to a Demon (or 4 to a Boss)')||!dataSource.includes('Deal 6 damage to a Demon (or 8 to a Boss)')){
  throw new Error('Monk Palm must display 2/6 damage vs Demons and 4/8 vs Bosses.');
}
const fontSettings=fs.readFileSync(path.join(root,'src/js/25-font-settings.js'),'utf8');
for(const token of ['sanctum_font_settings_v1','damageFontSize','abilityFontSize']){
  if(!fontSettings.includes(token)) throw new Error('Font settings module missing: '+token);
}

const bossPatch=fs.readFileSync(path.join(root,'src/js/70-multiplayer-patches.js'),'utf8');
for(const token of [
  'pauseRelicDeckBtn',
  'relicDeckModal',
  'renderRelicDeckReference',
  '__sanctumExtraRelics',
  'const burnBase=Math.max'
]){
  if(!bossPatch.includes(token)) throw new Error('Relic Deck / elemental crit compatibility missing: '+token);
}

for(const token of ["const SPRITE_URL='./assets/bosses/boss-sprite.webp'","ensureBossSprite('high')","sanctumBossArtReady"]){
  if(!bossPatch.includes(token)) throw new Error('Authoritative Boss artwork wiring missing: '+token);
}
if(bossPatch.includes('},10000);')) throw new Error('Legacy delayed 10-second Boss artwork warmup is still present.');
const multiplayerStyles=fs.readFileSync(path.join(root,'src/styles/multiplayer.css'),'utf8');
if(!multiplayerStyles.includes('body.sanctum-menu-subdialog-open #relicDeckModal[data-from-game-menu="1"]')){
  throw new Error('Relic Deck is not layered above the paused Game Menu.');
}
if(!multiplayerStyles.includes('#relicDeckModal{')||!multiplayerStyles.includes('z-index:205')){
  throw new Error('Relic Deck base modal stacking rule is missing.');
}

if(!multiplayerStyles.includes('html:not(.sanctumBossArtReady) #bossArea .bossArt')){
  throw new Error('Legacy Boss artwork flash guard is missing.');
}
if(!serviceWorker.includes('./assets/bosses/boss-sprite.webp')){
  throw new Error('Boss artwork sprite is not pre-cached by the clean service worker.');
}

const rogueSource=fs.readFileSync(path.join(root,'src/js/30-roguelite.js'),'utf8');
if(!rogueSource.includes("if(d&&d.crucifixAttached){carried++;delete d.crucifixAttached}")){
  throw new Error('Floor clear does not preserve Crucifix attachments from board Demons.');
}
if(!rogueSource.includes("S.pendingCrucifixTransfers=Math.max(0,Math.floor(Number(S.pendingCrucifixTransfers)||0))+carried")){
  throw new Error('Floor clear Crucifix carry count is missing.');
}

for(const token of [
  'repositoryCandleReduction:0',
  'rogueRepositoryCandleReductionForFloor',
  'floor<=5?0.10:floor<=10?0.125:0.15',
  'rogueRepositoryEnemyScaleFactor',
  'Demon HP and Attack scaling are reduced by',
  'mult*floorHp*candleFactor',
  'rogueFloorDamageMultiplier()*rogueRepositoryEnemyScaleFactor()'
]){
  if(!rogueSource.includes(token)) throw new Error('Votive Candle Demon-scaling wiring missing: '+token);
}
if(rogueSource.includes("restoreAltarLogged(10,'Votive Candle Bundle')")){
  throw new Error('Votive Candle Bundle still restores Altar Protection instead of reducing Demon scaling.');
}

for(const token of [
  "repository:{name:'The Sinking Repository'",
  'rogueRepositoryMarkVisit',
  'rogueRepositoryPrices',
  'rogueliteOpenRepository',
  "function rogueliteEnterBossRepository",
  "function rogueliteFinishRepository",
  "r.repositoryPendingBossFloor=r.floor",
  "rogueIsCycleBoss()){rogueWhenClear(()=>rogueliteEnterBossRepository('cycleCheckpoint'))",
  "rogueliteEnterBossRepository('route')",
  "repository:candles:",
  "repository:folio:",
  "window.__sanctumRepositoryPurchaseByActionKey"
]){
  if(!rogueSource.includes(token)) throw new Error('Post-Boss Sinking Repository wiring missing: '+token);
}
if(rogueSource.includes("Math.random()<0.25")||rogueSource.includes("rogueRepositoryVisitCount(cycle)<2")){
  throw new Error('Sinking Repository still has random access or a two-visit cap.');
}
if(!rogueSource.includes("r.cindersRun-=cost")) throw new Error('Sinking Repository purchases must spend unbanked run Cinders.');
if(!rogueSource.includes("return {relic:10+2*tier,candles:8+2*tier,folio:12+2*tier};")) throw new Error('Fixed shop prices must be 10/8/12, 12/10/14, 14/12/16 for cycles 1, 2, 3+.');

if(!rogueSource.includes('function rogueDifficultyMultiplier(){return Math.pow(1.5,')||
   !rogueSource.includes('function rogueFloorHealthMultiplier(){return 1+(0.03*Math.max(0,rogueCycleFloorFor')||
   !rogueSource.includes('function rogueFloorDamageMultiplier(){return 1+(0.03*Math.max(0,rogueCycleFloorFor')){
  throw new Error('Roguelite must scale +3% per floor within each cycle and ×1.5 per new cycle.');
}
if(!rogueSource.includes('function rogueRelicXpNeed(){let r=rogueState();return Math.ceil((20+8*(Math.max(0,Number(r.xpRelics)||0)+Math.max(0,Number(r.passageRelics)||0)))*1.25)')){
  throw new Error('XP-earned and passage reward Relics must both increase the 25%-raised threshold.');
}
for(const rule of ["reason==='Elite room-clear reward'||reason==='Boss room-clear reward'",'r.passageRelics=Math.max(0,Number(r.passageRelics)||0)+1']){
 if(!rogueSource.includes(rule))throw new Error('Passage Relic XP increment missing: '+rule);
}
if(!rogueSource.includes('repositoryFolioPurchases')||!rogueSource.includes(">=2){showGameStatus('The Forbidden Folio limit")){
  throw new Error('Run-only Forbidden Folio cap of two is missing.');
}
if(!rogueSource.includes('base+actBonus+bossDifference+cycleBonus')){
  throw new Error('Roguelite Boss phase damage must use flat player/Act/Cycle progression.');
}

for(const token of [
  "rogueSilentRelic('Elite room-clear reward','rogueRoute')",
  "rogueSilentRelic('Boss room-clear reward','rogueRoute')",
  "__sanctumRelicPopupAfter",
  "after:popupAfter"
]){
  if(!rogueSource.includes(token)) throw new Error('Relic reward popup wiring missing: '+token);
}
const relicCore=fs.readFileSync(path.join(root,'src/js/10-engine.js'),'utf8');
if(!relicCore.includes("completed&&completed.after")||!relicCore.includes("__sanctumRelicPopupAfter")){
  throw new Error('Relic popup continuation support is missing.');
}
const multiplayer=fs.readFileSync(path.join(root,'src/js/60-multiplayer.js'),'utf8');
for(const token of [
  "choice?.actionKey||inferGroupVoteActionKey",
  "'The Sinking Repository':'route:repository'",
  "key.startsWith('repository:')",
  "'route:repository'"
]){
  if(!multiplayer.includes(token)) throw new Error('Multiplayer Sinking Repository recovery missing: '+token);
}

for(const token of [
  "rogueSilentRelic('Elite room-clear reward','rogueRoute')",
  "rogueSilentRelic('Boss room-clear reward','rogueRoute')"
]){
  if(!multiplayer.includes(token)) throw new Error('Multiplayer Relic reward popup wiring missing: '+token);
}

if(!multiplayer.includes('supabase.co')) throw new Error('Supabase multiplayer configuration is missing.');
if(!multiplayer.includes('pushSharedState')) throw new Error('Multiplayer state publishing logic is missing.');
if(!multiplayer.includes('Deal 2 damage to a Demon (or 4 to a Boss). If it is a Demon, move it back exactly 1 room.')||
   !multiplayer.includes('Deal 6 damage to a Demon (or 8 to a Boss). If it is a Demon, move it back exactly 2 rooms.')){
   throw new Error('Monk multiplayer text must be 2/6 vs Demons and 4/8 vs Bosses.');
 }
 if(!multiplayer.includes('applyRemoteGameRow')) throw new Error('Multiplayer state receive/apply logic is missing.');

const engine=fs.readFileSync(path.join(root,'src/js/10-engine.js'),'utf8');
for(const token of [
  'pendingCrucifixTransfers:0',
  'function placeTransferredCrucifixInRemainingDeck',
  'const candidates=S.demonDeck.filter(d=>d&&!d.crucifixAttached)',
  'target.crucifixAttached=true',
  'function applyPendingCrucifixTransferToSpawn',
  'if(d.crucifixAttached)',
  'if(!placeTransferredCrucifixInRemainingDeck())S.pendingCrucifixTransfers++',
  'applyPendingCrucifixTransferToSpawn(d);if(S.rooms[0].length>=4)',
  'applyPendingCrucifixTransferToSpawn(d);if(S.rooms[0].length<4)'
]){
  if(!engine.includes(token)) throw new Error('Hidden Crucifix floor-transfer wiring missing: '+token);
}

for(const token of [
  'const DEMON_CRUCIFIX_ATTACHMENT_RATE=0.15',
  'function attachHiddenCrucifixCards',
  'Math.round(deck.length*DEMON_CRUCIFIX_ATTACHMENT_RATE)',
  'crucifixAttached=true',
  'function takeDemonCrucifixAttachment',
  'function revealAttachedCrucifix',
  "if(attachedCrucifix)revealAttachedCrucifix(d,'was defeated",
  "if(attachedCrucifix)revealAttachedCrucifix(d,'reached the Altar",
  'host.crucifixAttached=!!(host.crucifixAttached||donor.crucifixAttached)'
]){
  if(!engine.includes(token)) throw new Error('Hidden Crucifix Demon wiring missing: '+token);
}
if(engine.includes("if(!S?.rogue?.enabled){drawCrucifix();")){
  throw new Error('Legacy every-kill Crucifix draw is still active.');
}

for(const token of [
  '15+((S&&S.relicMods&&S.relicMods.crit)||0)',
  "count>=4?1.25:count===3?1.05:count===2?.85:.70",
  'if(S.players.length>=4)return 3',
  'return n>=4?32:n===3?23:n===2?15:10'
]){
  if(!engine.includes(token)) throw new Error('Player-count / crit balance wiring missing: '+token);
}

for(const token of [
  "key:'martyrEye'",
  'function basicAttackCritChance',
  '15+((S&&S.relicMods&&S.relicMods.crit)||0)',
  'CRITICAL HIT',
  "critical?base*2:base"
]){
  if(!engine.includes(token)) throw new Error('Critical Basic Attack wiring missing: '+token);
}

for(const token of [
  'QUICK_PRAYER_ATTACK_KINDS',
  'QUICK_PRAYER_PROTECTION_KINDS',
  "case'quickPrayer'",
  'drawPriestByQuickPrayerCategory'
]){
  if(!engine.includes(token)) throw new Error('Quick Prayer targeted draw wiring missing: '+token);
}

for(const symbol of ['startGame','moveDemons','defeatDemon','resolveRitual','render']){
  if(!engine.includes('function '+symbol) && !engine.includes(symbol+'=')) throw new Error('Core engine symbol missing: '+symbol);
}

console.log('Clean rebuild validation passed.');
console.log('Extracted WebP assets:',embedded.length);
console.log('JavaScript modules:',fs.readdirSync(path.join(root,'src/js')).filter(x=>x.endsWith('.js')).length);
console.log('Stylesheets:',fs.readdirSync(path.join(root,'src/styles')).filter(x=>x.endsWith('.css')).length);
