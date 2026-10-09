/* Clean rebuild module: roguelite run systems. Original execution order preserved. */

/* source: rogueliteOriginalArtSystems */
(()=>{
'use strict';
const ROGUE_META_KEY='sanctumRogueliteLegacyV1';
const ROGUE_VERSION=5;
const ROGUE_NODE_INFO={
 battle:{name:'Standard Battle',icon:'✦',cls:'',desc:'A balanced encounter using the normal Sanctum pressure.',reward:'1 Cinder • normal reward choice'},
 elite:{name:'Elite Procession',icon:'☠',cls:'elite',desc:'Demons gain additional HP and Attack. The encounter is longer, but its spoils are richer.',reward:'3 Cinders • bonus Relic choice available'},
 swarm:{name:'Hellgate Swarm',icon:'♜',cls:'elite',desc:'More Demons spawn each Demon Phase. Individual foes are less enhanced than Elites.',reward:'2 Cinders • normal reward choice'},
 sanctuary:{name:'Ruined Sanctuary',icon:'✚',cls:'sanctuary',desc:'No combat. Choose one recovery or preparation blessing, then continue deeper.',reward:'1 Cinder • recovery choice'},
 boss:{name:'Boss Gate',icon:'♛',cls:'boss',desc:'A Boss Demon seals the next descent. Defeat it to reach the next Act.',reward:'Boss Cinders • major reward'}
};
const ROGUE_UPGRADES={
 blood:{name:'Vial of the Penitent',desc:'Each Priest starts future runs with +1 Demon Blood per rank.',cap:3,costs:[15,27,42]},
 hand:{name:'Hidden Scripture',desc:'Each Priest draws +1 additional starting Priest card per rank.',cap:2,costs:[21,36]},
 ward:{name:'Ward of Ash',desc:'Begin each run with 2 points of Altar Barrier per rank for the opening round.',cap:3,costs:[18,30,45]},
 relic:{name:'Reliquary Key',desc:'Begin each future run with one random Relic already active. This starting Relic does not raise the Relic XP requirement.',cap:1,costs:[54]},
 basicAttack:{name:'Consecrated Strike',desc:'Basic Attack deals +1 permanent damage per rank in future fresh runs.',cap:3,costs:[25,40,60]},
 relicXpGain:{name:'Relic Communion',desc:'Each Demon kill grants +1 additional Relic XP per rank in future fresh runs.',cap:3,costs:[30,45,65]}
};
let rogueModalActions=[];

function rogueDefaultState(){return {enabled:true,version:ROGUE_VERSION,act:1,floor:1,cycle:1,nodeType:'battle',nodeName:'Standard Battle',encounterDefeats:0,encounterGoal:4,pendingClear:false,bossFloor:false,cindersRun:0,banked:false,bankedAmount:0,lastBankedAmount:0,cyclesCleared:0,legacyCheckpoint:false,bossesSpawned:0,relicXp:0,xpRelics:0,history:[],lastReward:'',runStartedAt:Date.now()}}
function rogueState(){if(!S.rogue||typeof S.rogue!=='object')S.rogue=rogueDefaultState();return S.rogue}
function rogueMeta(){let base={cinders:0,blood:0,hand:0,ward:0,relic:0,basicAttack:0,relicXpGain:0,bestFloor:0,wins:0,runs:0,cycles:0};try{let v=JSON.parse(localStorage.getItem(ROGUE_META_KEY)||'{}');return {...base,...v}}catch(e){return base}}
function rogueSaveMeta(m){try{localStorage.setItem(ROGUE_META_KEY,JSON.stringify(m));return true}catch(e){console.warn('Legacy storage unavailable',e);return false}}
function rogueLegacyBasicAttackBonus(){return Math.max(0,Number(S?.rogue?.legacyBasicAttackBonus)||0)}
function rogueLegacyRelicXpBonus(){return Math.max(0,Number(S?.rogue?.legacyRelicXpBonus)||0)}
window.basicAttackDamage=function(){
 let relicBonus=Math.max(0,Number(S?.relicMods?.basic)||0);
 return 2+relicBonus+rogueLegacyBasicAttackBonus();
};
function rogueCycleForFloor(f){return Math.floor((Math.max(1,Number(f)||1)-1)/15)+1}
function rogueCycleFloorFor(f){return ((Math.max(1,Number(f)||1)-1)%15)+1}
function rogueActForFloor(f){return Math.ceil(rogueCycleFloorFor(f)/5)}
function rogueCycle(){let r=rogueState();r.cycle=rogueCycleForFloor(r.floor||1);return r.cycle}
function rogueDifficultyMultiplier(){return Math.pow(2,Math.max(0,rogueCycle()-1))}
function rogueFloorHealthMultiplier(){return 1+(0.15*Math.max(0,(Math.max(1,Number(rogueState().floor)||1)-1)))}
function rogueFloorDamageMultiplier(){return 1+(0.05*Math.max(0,(Math.max(1,Number(rogueState().floor)||1)-1)))}
function rogueAct(){let r=rogueState();r.act=Math.min(3,Math.max(1,rogueActForFloor(r.floor||1)));return r.act}
function rogueStep(){return ((rogueState().floor-1)%5)+1}
function rogueIsBossFloor(){return ((Math.max(1,rogueState().floor||1))%5)===0}
function rogueIsCycleBoss(){return ((Math.max(1,rogueState().floor||1))%15)===0}
function rogueGoalFor(type){let a=rogueAct();if(type==='elite')return 5+(a-1);if(type==='swarm')return 5+(a-1);return 4+(a-1)}
function rogueNode(type){return ROGUE_NODE_INFO[type]||ROGUE_NODE_INFO.battle}
function rogueCap(v,min,max){return Math.max(min,Math.min(max,v))}
function rogueShuffle(arr){let a=[...arr];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function rogueAddCinders(n,why=''){let r=rogueState();r.cindersRun=Math.max(0,(r.cindersRun||0)+n);if(why)log(`CINDERS +${n} — ${why}.`,'good');rogueliteRenderHud()}
function rogueClearRooms(){S.rooms=[[],[],[],[]];S.queue=[];selectedDemonId=null}
function rogueCleanseAll(){for(let i=0;i<4;i++){S.corruption[i]=0;S.desecratedRooms[i]=false}}
function rogueGiveBlood(n){S.players.forEach(p=>p.blood=Math.min(10,(p.blood||0)+n));log(`Each Priest gains ${n} Demon Blood.`,'good')}
function rogueRelicXpNeed(){let r=rogueState();return 15+5*Math.max(0,r.xpRelics||0)}
function rogueKillXpValue(d){
 if(!d)return 0;
 let base=demonBlood(d),extra=demonCode(d)==='defeatBlood'?demonValue(d):0;
 if(bossIs("soulTyrant")&&!d.greater)return Math.max(0,base+extra-1);
 return Math.max(0,base+extra);
}
function rogueAwardKillXp(amount,d){
 let r=rogueState(),legacyBonus=rogueLegacyRelicXpBonus();
 amount=Math.max(0,Math.floor(amount||0))+legacyBonus;if(!amount)return;
 r.relicXp=Math.max(0,r.relicXp||0)+amount;
 log(`RELIC XP +${amount} — ${demonName(d)}'s kill grants experience${legacyBonus?` (includes +${legacyBonus} Legacy XP`:''}${legacyBonus?')':''} (${r.relicXp}/${rogueRelicXpNeed()}).`,'good');
 let safety=0;
 while(safety++<20){
  let need=rogueRelicXpNeed();
  if(r.relicXp<need)break;
  if(!S.relicDeck||!S.relicDeck.length){log(`Relic XP reached ${need}, but the Relic deck is empty.`,'info');break}
  r.relicXp-=need;
  let before=(S.activeRelics||[]).length;
  let rel=pullRelic(`Relic XP reached ${need}. Demon Blood earned from kills has revealed a Relic.`);
  if(!rel||(S.activeRelics||[]).length<=before){r.relicXp+=need;break}
  r.xpRelics=(r.xpRelics||0)+1;
  log(`XP RELIC ${r.xpRelics} claimed. The next Relic now requires ${rogueRelicXpNeed()} XP.`,'good');
 }
 rogueliteRenderHud();
}
function rogueSilentRelic(reason='Roguelite reward'){
 S.relicDeck=S.relicDeck||[];
 if(!S.relicDeck.length)return null;
 let key=S.relicDeck.pop(),rel=relicByKey(key);if(!rel)return null;
 applyRelic(rel);log(`${reason}: ${rel.n}. Bonus reward Relics do not increase the Relic XP requirement.`,'good');return rel;
}
function rogueOtherModalOpen(){
 const ignore=new Set(['setupModal','pauseOverlay','rogueChoiceModal','rogueLegacyModal','rogueGuideModal']);
 return [...document.querySelectorAll('.modal')].some(el=>!ignore.has(el.id)&&!el.classList.contains('hidden'));
}
function rogueWhenClear(fn,attempt=0){if(!S?.rogue?.enabled)return;if(rogueOtherModalOpen()&&attempt<120){setTimeout(()=>rogueWhenClear(fn,attempt+1),100);return}fn()}
function rogueShowChoice(eyebrow,title,text,choices){
 clearTurnTimerInterval();
 if(typeof window.__sanctumMultiplayerGroupChoice==='function'){
  try{
   if(window.__sanctumMultiplayerGroupChoice({eyebrow,title,text},choices))return;
  }catch(err){console.error('Multiplayer group choice failed; using local choice.',err)}
 }
 const modal=document.getElementById('rogueChoiceModal'),grid=document.getElementById('rogueChoiceGrid');
 document.getElementById('rogueChoiceEyebrow').textContent=eyebrow;
 document.getElementById('rogueChoiceTitle').textContent=title;
 document.getElementById('rogueChoiceText').innerHTML=text;
 rogueModalActions=choices.map(c=>c.action);
 grid.innerHTML=choices.map((c,i)=>`<button class="rogueChoice ${c.cls||''}" data-rogue-choice="${i}" type="button">${c.html||`<div class="nodeIcon">${c.icon||'✦'}</div><h3>${c.title}</h3><p>${c.desc||''}</p>${c.reward?`<span class="nodeReward">${c.reward}</span>`:''}`}</button>`).join('');
 grid.querySelectorAll('[data-rogue-choice]').forEach(btn=>btn.onclick=()=>{let i=+btn.dataset.rogueChoice,fn=rogueModalActions[i];modal.classList.add('hidden');rogueModalActions=[];if(fn)fn()});
 modal.classList.remove('hidden');
 setTimeout(()=>grid.querySelector('button')?.focus(),0);
}
function rogueStartNextRound(){
 if(S.altar<=0)return;
 // A floor transition is a clean tactical break, then the original round-start logic resumes.
 endRound();
}
function rogueApplyLegacyStart(){
 let m=rogueMeta(),r=rogueState();
 r.legacyBasicAttackBonus=Math.max(0,Number(m.basicAttack)||0);
 r.legacyRelicXpBonus=Math.max(0,Number(m.relicXpGain)||0);
 if(m.blood)S.players.forEach(p=>p.blood=Math.min(10,(p.blood||0)+m.blood));
 if(m.hand)S.players.forEach(p=>drawPriest(p,m.hand));
 if(m.ward){S.altarBarrier=(S.altarBarrier||0)+(m.ward*2);S.altarBarrierRound=S.round;log(`Legacy Ward: ${m.ward*2} Altar Barrier protects the opening round.`,'good')}
 if(m.relic)rogueSilentRelic('Reliquary Key');
 if(r.legacyBasicAttackBonus)log(`Legacy Consecrated Strike: Basic Attack gains +${r.legacyBasicAttackBonus} damage this run.`,'good');
 if(r.legacyRelicXpBonus)log(`Legacy Relic Communion: Demon kills gain +${r.legacyRelicXpBonus} Relic XP this run.`,'good');
}
function rogueShuffleDemonDeckForPassage(reason='new passage'){
 if(!S||!Array.isArray(S.demonDeck)||S.demonDeck.length<2){
  if(S){
   S.demonPassageShuffleNonce=(Number(S.demonPassageShuffleNonce)||0)+1;
   S.demonPassageShuffleReason=reason;
  }
  return false;
 }
 const deck=[...S.demonDeck];
 const randomUnit=()=>{
  try{
   if(window.crypto&&crypto.getRandomValues){
    const u=new Uint32Array(1);
    crypto.getRandomValues(u);
    return u[0]/4294967296;
   }
  }catch(_){}
  return Math.random();
 };
 for(let i=deck.length-1;i>0;i--){
  const j=Math.floor(randomUnit()*(i+1));
  [deck[i],deck[j]]=[deck[j],deck[i]];
 }
 S.demonDeck=deck;
 S.demonPassageShuffleNonce=(Number(S.demonPassageShuffleNonce)||0)+1;
 S.demonPassageShuffleReason=reason;
 log(`DEMON DECK — ${deck.length} remaining cards freshly shuffled for ${reason}.`,'info');
 return true;
}
function rogueliteInitializeRun(){
 let r=rogueState();Object.assign(r,rogueDefaultState());
 r.nodeName=ROGUE_NODE_INFO.battle.name;r.encounterGoal=rogueGoalFor('battle');
 rogueShuffleDemonDeckForPassage('Passage 1');
 rogueApplyLegacyStart();
 S.bossRevealed=false;S.bossDefeatHandled=false;S.pendingBossChoice=false;S.pendingVictory=false;
 log(`ROGUELITE RUN — Act 1, Floor 1. Defeat ${r.encounterGoal} Demons to clear the first encounter.`,'good');
 render();
}
function rogueliteMutateDemon(d){
 if(!d||!S?.rogue?.enabled)return;
 let r=rogueState();d.status=d.status||{};
 if(d.status.rogueScaledFloor===r.floor)return;
 d.status.rogueScaledFloor=r.floor;
 let mult=rogueDifficultyMultiplier(),floorHp=rogueFloorHealthMultiplier();
 let printed=Math.max(1,d.greater?d.ghp:d.hp);
 let actHp=Math.max(0,rogueAct()-1)+(r.nodeType==='elite'?1:0);
 let target=Math.max(1,Math.round((printed+actHp)*mult*floorHp));
 let extra=Math.max(0,target-printed);
 if(extra){d.status.extraHpBonus=(d.status.extraHpBonus||0)+extra;d.status.rogueHpBonus=(d.status.rogueHpBonus||0)+extra;d.cur+=extra}
 if(r.nodeType==='elite')d.status.attackBonus=(d.status.attackBonus||0)+1;
 d.status.rogueDifficulty=mult;d.status.rogueFloorHealth=floorHp;
}
window.__rogueliteMutateDemon=rogueliteMutateDemon;
function rogueliteEnterCurrentFloor(type){
 let r=rogueState();r.cycle=rogueCycle();r.act=rogueAct();r.pendingClear=false;r.encounterDefeats=0;r.bossFloor=rogueIsBossFloor();
 rogueClearRooms();S.pendingBossChoice=false;S.pendingVictory=false;
 rogueShuffleDemonDeckForPassage(`Passage ${r.floor}`);
 if(r.bossFloor){
   r.nodeType='boss';r.nodeName='Boss Gate';
   if((r.bossesSpawned||0)>0){let old=S.boss&&S.boss.key;cleanOldBossEffects();S.boss=drawBossForDescent(old);S.boss.cur=S.boss.hp}
   r.bossesSpawned=(r.bossesSpawned||0)+1;S.bossRevealed=false;S.bossDefeatHandled=false;S.bossFlags={spores:{}};resetBossRoundFlags();
   revealBoss();
   // Bosses retain the original ability package, then scale with Ascension and cumulative floor depth.
   let pacing=.55+((rogueAct()-1)*.08),mult=rogueDifficultyMultiplier(),floorHp=rogueFloorHealthMultiplier();S.boss.hp=Math.max(42,Math.round(S.boss.hp*pacing*mult*floorHp));S.boss.cur=S.boss.hp;
   log(`BOSS GATE — Cycle ${rogueCycle()}, Act ${rogueAct()}, Floor ${rogueCycleFloorFor(r.floor)}. ${S.boss.n} seals the descent at ${S.boss.hp} HP (${mult}× Ascension • ${floorHp.toFixed(2)}× floor HP • ${rogueFloorDamageMultiplier().toFixed(2)}× floor damage).`,'bad');
   rogueStartNextRound();render();return;
 }
 S.bossRevealed=false;S.bossDefeatHandled=false;r.nodeType=type||'battle';r.nodeName=rogueNode(r.nodeType).name;r.encounterGoal=rogueGoalFor(r.nodeType);
 if(r.nodeType==='sanctuary'){
   S.phase='Sanctuary';clearTurnTimerInterval();rogueAddCinders(1,'the Sanctuary is reached');render();setTimeout(rogueliteOpenSanctuary,120);return;
 }
 // Two visible threats establish the next room; normal original spawning takes over afterwards.
 let opening=S.players.length===1?1:2;for(let i=0;i<opening;i++)spawnOne(false);
 log(`CYCLE ${rogueCycle()} • ACT ${rogueAct()} • FLOOR ${rogueCycleFloorFor(r.floor)} — ${r.nodeName}. Defeat ${r.encounterGoal} Demons to advance at ${rogueDifficultyMultiplier()}× Ascension difficulty, ${rogueFloorHealthMultiplier().toFixed(2)}× floor HP, and ${rogueFloorDamageMultiplier().toFixed(2)}× floor damage.`,'good');
 rogueStartNextRound();render();
}
function rogueliteAfterDemonDefeat(){
 let r=rogueState();if(!r.enabled||r.bossFloor||r.pendingClear||['Victory','Defeat'].includes(S.phase))return;
 r.encounterDefeats=(r.encounterDefeats||0)+1;
 if(r.encounterDefeats<r.encounterGoal){render();return}
 r.pendingClear=true;S.phase='Rogue Reward';clearTurnTimerInterval();
 log(`${r.nodeName} cleared on Floor ${r.floor}. The remaining Demons are driven back.`,'good');
 rogueWhenClear(rogueliteOpenEncounterReward);
}
function rogueliteOpenEncounterReward(){
 let r=rogueState();if(!r.pendingClear)return;
 rogueClearRooms();
 let gain=r.nodeType==='elite'?3:r.nodeType==='swarm'?2:1;rogueAddCinders(gain,`${r.nodeName} cleared`);
 const choices=[
   {icon:'✠',title:'Draft a Priest Card',desc:'Reveal three Priest cards. Shuffle one extra copy into your run deck for future random draws.',reward:'Deck-building reward',action:()=>rogueliteOpenDraft(rogueliteOpenRoute)},
   {icon:'✚',title:'Recover the Altar',desc:'Restore 6 Altar Protection and gain 2 shared Mana.',reward:'Immediate recovery',action:()=>{restoreAltarLogged(6,'Encounter recovery');addMana(2);rogueliteOpenRoute()}},
   r.nodeType==='elite'
    ?{icon:'◆',title:'Claim a Relic',cls:'elite',desc:'Recover one random Relic from the original Sanctum Relic deck. Because this is a room-clear choice, it does not raise your next Relic XP requirement.',reward:'Bonus Relic • no XP-cost increase',action:()=>{let rel=rogueSilentRelic('Elite room-clear reward');showGameStatus(rel?`Relic claimed: ${rel.n}`:'The Relic deck is empty.','good');rogueliteOpenRoute()}}
    :{icon:'♦',title:'Blood Cache',desc:'Each Priest gains 2 Demon Blood and you collect 1 extra Cinder.',reward:'+2 Blood each • +1 Cinder',action:()=>{rogueGiveBlood(2);rogueAddCinders(1,'Blood Cache');rogueliteOpenRoute()}}
 ];
 rogueShowChoice(`Floor ${r.floor} Cleared`,'Choose One Reward','Your combat build persists through the entire run. Choose one reward before selecting the next route.',choices);
}
function rogueliteOpenDraft(after){
 let picks=rogueShuffle(PRIEST.map((c,i)=>({c,i}))).slice(0,3);
 let choices=picks.map(({c,i})=>{let art=(typeof PRIEST_CARD_ARTS!=='undefined'&&PRIEST_CARD_ARTS[c.n])||c.art||'';return {title:c.n,desc:c.e,reward:'Empowered: '+c.x,voteCard:c.n,voteEmpowered:c.x,cls:'rogueDraftCard',html:`<div class="rogueDraftCost">${c.m}</div><div class="rogueDraftArt" style="background-image:url('${art}')"></div><div class="rogueDraftBody"><h3>${c.n}</h3><p>${c.e}</p><small><b>Empowered:</b> ${c.x}</small><span class="nodeReward">Shuffle an extra copy into this run</span></div>`,action:()=>{let card={...c,id:`rogue-${i}-${uid()}`};S.priestDeck=shuffle([...(S.priestDeck||[]),card]);log(`${c.n} is added to the run deck and shuffled into the remaining random draws.`,'good');rogueState().lastReward=`Drafted ${c.n}`;render();after&&after()}}});
 rogueShowChoice('Priest Draft','Choose One Card','These are original Priest cards and use the existing card artwork/effects. The chosen card becomes part of this run only.',choices);
}
function rogueliteOpenSanctuary(){
 let r=rogueState();
 rogueShowChoice(`Act ${r.act} • Floor ${r.floor}`,'Ruined Sanctuary','No Demons attack here. Take one blessing, then choose the next descent.',[
  {icon:'✚',title:'Confession',cls:'sanctuary',desc:'Restore 8 Altar Protection and cleanse all Corruption from every room.',reward:'Strong defensive reset',action:()=>{restoreAltarLogged(8,'Sanctuary Confession');rogueCleanseAll();log('All room Corruption is cleansed.','good');rogueliteOpenRoute()}},
  {icon:'✠',title:'Study the Reliquary',cls:'sanctuary',desc:'Draft one Priest card from three choices.',reward:'Improve your run deck',action:()=>rogueliteOpenDraft(rogueliteOpenRoute)},
  {icon:'♦',title:'Take Sacrament',cls:'sanctuary',desc:'Each Priest gains 3 Demon Blood. Shared Mana is restored to the current player-count baseline.',reward:'Ritual preparation',action:()=>{rogueGiveBlood(3);S.mana=Math.max(sharedManaRoundValue(),S.mana);render();rogueliteOpenRoute()}}
 ]);
}
function rogueliteRouteOptions(){let pool=['battle','elite','swarm','sanctuary'];return rogueShuffle(pool).slice(0,3)}
function rogueliteOpenRoute(){
 let r=rogueState();r.pendingClear=false;let next=r.floor+1,nextCycle=rogueCycleForFloor(next),nextFloor=rogueCycleFloorFor(next),nextAct=rogueActForFloor(next),nextMult=Math.pow(2,Math.max(0,nextCycle-1));
 if((next%5)===0){
  let n=rogueNode('boss');rogueShowChoice(`Cycle ${nextCycle} • Act ${nextAct} • Floor ${nextFloor}`,'The Boss Gate Opens',`There is no safe route around the next chamber. Ascension pressure is ${nextMult}×.`,[{icon:n.icon,title:`Enter Boss Floor ${nextFloor}`,cls:n.cls,desc:n.desc,reward:n.reward,action:()=>{r.floor=next;rogueliteEnterCurrentFloor('boss')}}]);return;
 }
 let options=rogueliteRouteOptions().map(type=>{let n=rogueNode(type);return {icon:n.icon,title:n.name,cls:n.cls,desc:n.desc,reward:n.reward,action:()=>{r.floor=next;rogueliteEnterCurrentFloor(type)}}});
 rogueShowChoice(`Cycle ${nextCycle} • Act ${nextAct} • Floor ${nextFloor}`,'Choose Your Route',`Each route changes the pressure and reward profile. Cycle ${nextCycle} enemies fight at ${nextMult}× difficulty.`,options);
}
function rogueliteBossDefeated(){
 if(!S.bossRevealed||!S.boss||S.boss.cur>0||S.bossDefeatHandled)return;
 let r=rogueState();S.bossDefeatHandled=true;S.bossesDefeated=(S.bossesDefeated||0)+1;r.bossFloor=true;S.phase='Rogue Reward';clearTurnTimerInterval();
 let gain=5+rogueAct();rogueAddCinders(gain,`${S.boss.n} defeated`);log(`${S.boss.n} HAS BEEN DEFEATED — Cycle ${rogueCycle()}, Act ${rogueAct()}, Floor ${rogueCycleFloorFor(r.floor)}.`,'good');render();
 if(rogueIsCycleBoss()){rogueWhenClear(rogueliteCycleCheckpoint);return}
 rogueWhenClear(()=>rogueShowChoice(`Boss Defeated • Cycle ${rogueCycle()} • Act ${r.act}`,'Claim an Act Reward','Choose one major reward before entering the next Act.',[
  {icon:'◆',title:'Reliquary',cls:'elite',desc:'Gain a random Relic and restore 4 Altar Protection. This room-clear Relic does not raise your next Relic XP requirement.',reward:'Bonus Relic • +4 Protection',action:()=>{rogueSilentRelic('Boss room-clear reward');restoreAltarLogged(4,'Boss reward');rogueliteOpenRoute()}},
  {icon:'✚',title:'Purification',cls:'sanctuary',desc:'Restore 10 Altar Protection and cleanse all room Corruption.',reward:'Large recovery',action:()=>{restoreAltarLogged(10,'Boss purification');rogueCleanseAll();render();rogueliteOpenRoute()}},
  {icon:'✠',title:'Arsenal of Faith',desc:'Draft a Priest card and each Priest gains 2 Demon Blood.',reward:'Card draft • +2 Blood each',action:()=>{rogueGiveBlood(2);rogueliteOpenDraft(rogueliteOpenRoute)}}
 ]));
}
function rogueliteBankCycle(){
 let r=rogueState(),m=rogueMeta(),gain=Math.max(0,Math.floor(r.cindersRun||0));
 m.cinders=(m.cinders||0)+gain;m.bestFloor=Math.max(m.bestFloor||0,r.floor||1);m.cycles=(m.cycles||0)+1;rogueSaveMeta(m);
 r.cindersRun=0;r.lastBankedAmount=gain;r.bankedAmount=(r.bankedAmount||0)+gain;r.cyclesCleared=(r.cyclesCleared||0)+1;
 log(`ASCENSION BANK — ${gain} Cinders are secured after three Acts. Legacy balance: ${m.cinders}.`,'good');rogueliteRenderHud();return gain;
}
function rogueliteCycleCheckpoint(){
 let r=rogueState(),finishedCycle=rogueCycle(),nextCycle=finishedCycle+1,nextMult=Math.pow(2,finishedCycle);
 rogueClearRooms();r.legacyCheckpoint=true;rogueliteBankCycle();S.phase='Legacy Checkpoint';render();
 log(`CYCLE ${finishedCycle} COMPLETE. The Legacy opens before Cycle ${nextCycle}, where Demons and Bosses rise to ${nextMult}× difficulty.`,'good');
 rogueliteOpenLegacy(true);
}
function rogueliteContinueAfterLegacy(){
 let r=rogueState();document.getElementById('rogueLegacyModal').classList.add('hidden');
 if(!r.legacyCheckpoint){resumeTurnTimerIfReady();return}
 r.legacyCheckpoint=false;let nextCycle=rogueCycleForFloor(r.floor+1),nextMult=Math.pow(2,Math.max(0,nextCycle-1));
 log(`THE DESCENT CONTINUES — Cycle ${nextCycle} begins. Your current cards, Relics, Blood, Relic XP, Altar state, and run build persist. Enemy difficulty is now ${nextMult}×.`,'bad');
 rogueliteOpenRoute();
}
function rogueliteBankRun(win){
 let r=rogueState();if(r.banked)return r.bankedAmount||0;
 let m=rogueMeta(),gain=0,lost=Math.max(0,Math.floor(r.cindersRun||0));
 if(win&&lost){gain=lost;m.cinders=(m.cinders||0)+gain;log(`${gain} remaining Cinders are banked as the run ends.`,'good')}else if(!win&&lost){log(`${lost} unbanked Cinders are lost. Cinders are secured only after each three-Act cycle.`,'bad')}
 r.cindersRun=0;m.bestFloor=Math.max(m.bestFloor||0,r.floor||1);m.runs=(m.runs||0)+1;if(win)m.wins=(m.wins||0)+1;rogueSaveMeta(m);r.banked=true;r.bankedAmount=(r.bankedAmount||0)+gain;return r.bankedAmount||0;
}
function rogueliteRenderHud(){
 let hud=document.getElementById('rogueHud');if(!hud)return;let r=S&&S.rogue&&S.rogue.enabled?rogueState():rogueDefaultState(),m=rogueMeta();
 r.cycle=rogueCycle();r.act=rogueAct();document.getElementById('roguePassage').textContent=`${rogueStep()} / 5`;document.getElementById('rogueAct').textContent=`${r.act||1} / 3`;document.getElementById('rogueFloor').textContent=`${rogueCycleFloorFor(r.floor||1)} / 15`;let runLabel=document.querySelector('.runProgressStat > span');if(runLabel)runLabel.textContent=`Cycle ${r.cycle} • ${rogueDifficultyMultiplier()}×`;document.getElementById('rogueRoute').textContent=r.nodeName||rogueNode(r.nodeType).name;let xpEl=document.getElementById('rogueRelicXp');if(xpEl)xpEl.textContent=`${Math.max(0,r.relicXp||0)} / ${rogueRelicXpNeed()}`;document.getElementById('rogueCinders').textContent=r.cindersRun||0;document.getElementById('rogueLegacyCinders').textContent=m.cinders||0;
 let pct=rogueIsBossFloor()?((S.bossRevealed&&S.boss&&S.boss.hp)?(1-(S.boss.cur/S.boss.hp))*100:0):((r.encounterGoal||1)?((r.encounterDefeats||0)/(r.encounterGoal||1))*100:0);document.getElementById('rogueProgressFill').style.width=`${rogueCap(pct,0,100)}%`;
 const xpNeed=Math.max(1,rogueRelicXpNeed()),xpNow=Math.max(0,Number(r.relicXp)||0),xpPct=rogueCap((xpNow/xpNeed)*100,0,100);
 const xpMeter=document.getElementById('relicXpMeterStat'),xpFill=document.getElementById('relicXpMeterFill'),xpValue=document.getElementById('relicXpMeterValue');
 if(xpFill){xpFill.style.width=`${xpPct}%`;xpFill.style.height='100%';}if(xpValue)xpValue.textContent=`${xpNow} / ${xpNeed}`;if(xpMeter){xpMeter.setAttribute('aria-valuemax',String(xpNeed));xpMeter.setAttribute('aria-valuenow',String(xpNow));xpMeter.title=`Relic XP ${xpNow} / ${xpNeed}`}
 const tracker=document.querySelector('#ritualContent .ritualTracker'),basic=document.getElementById('basicBtn'),rail=document.querySelector('#handPanel .priestActionRail');
 const cinderHost=(rail&&basic&&basic.parentElement===rail)?rail:tracker;
 if(cinderHost&&!document.getElementById('actionCinderBadge')){let badge=document.createElement('span');badge.className='badge cinderActionBadge';badge.id='actionCinderBadge';badge.innerHTML='Cinders: <b id="actionCinders">0</b>';if(basic&&basic.parentElement===cinderHost)cinderHost.insertBefore(badge,basic);else cinderHost.prepend(badge)}
 const cinderValue=document.getElementById('actionCinders');if(cinderValue)cinderValue.textContent=String(Math.max(0,Number(r.cindersRun)||0));
 if(S?.rogue?.enabled){let stat=document.getElementById('defeatStat'),lab=stat&&stat.nextElementSibling;if(stat){if(rogueIsBossFloor())stat.textContent='BOSS';else if(r.nodeType==='sanctuary')stat.textContent='REST';else stat.textContent=`${r.encounterDefeats||0} / ${r.encounterGoal||0}`}if(lab)lab.textContent=rogueIsBossFloor()?'Boss Floor':r.nodeType==='sanctuary'?'Sanctuary':'Encounter Defeats'}
}
function rogueliteOpenLegacy(forceCheckpoint=false){
 let m=rogueMeta(),live=S&&S.started&&!['Victory','Defeat'].includes(S.phase),r=live?rogueState():null,checkpoint=!!(live&&r&&(r.legacyCheckpoint||forceCheckpoint));pauseTurnTimer();
 document.getElementById('rogueLegacyMeta').innerHTML=`<span class="badge">Cinders: <b>${m.cinders||0}</b></span><span class="badge">Best Depth: <b>${m.bestFloor||0}</b></span><span class="badge">Cycles Cleared: <b>${m.cycles||0}</b></span><span class="badge">Runs: <b>${m.runs||0}</b></span>${checkpoint?`<span class="badge">Checkpoint — purchases unlocked</span>`:(live?'<span class="badge">Purchases unlock after every 3 Acts</span>':'')}`;
 document.getElementById('rogueLegacyGrid').innerHTML=Object.entries(ROGUE_UPGRADES).map(([key,u])=>{let rank=m[key]||0,max=rank>=u.cap,cost=max?null:u.costs[rank],locked=live&&!checkpoint;return `<div class="legacyItem"><h3>${u.name} <span class="rogueRunTag">${rank}/${u.cap}</span></h3><p>${u.desc}</p><button class="btn ${max?'':'green'}" data-legacy-buy="${key}" ${max||locked||m.cinders<cost?'disabled':''}>${max?'Maxed':`Buy — ${cost} Cinders`}</button></div>`}).join('');
 document.querySelectorAll('[data-legacy-buy]').forEach(b=>b.onclick=()=>rogueliteBuyLegacy(b.dataset.legacyBuy));let close=document.getElementById('rogueLegacyClose');if(close)close.textContent=checkpoint?`Continue Descent — Cycle ${rogueCycle()+1} (${Math.pow(2,rogueCycle())}×)`:'Close';document.getElementById('rogueLegacyModal').classList.remove('hidden');
}
function rogueliteBuyLegacy(key){let u=ROGUE_UPGRADES[key],m=rogueMeta();if(!u)return;let rank=m[key]||0;if(rank>=u.cap)return;let cost=u.costs[rank];if((m.cinders||0)<cost)return;m.cinders-=cost;m[key]=rank+1;rogueSaveMeta(m);showGameStatus(`${u.name} upgraded to ${m[key]}/${u.cap}. Permanent starting bonuses apply from the next fresh run.`,'good');rogueliteOpenLegacy(S?.rogue?.legacyCheckpoint);rogueliteRenderHud()}
function rogueliteShowGuide(){pauseTurnTimer();document.getElementById('rogueGuideModal').classList.remove('hidden')}
function rogueliteCloseGuide(){document.getElementById('rogueGuideModal').classList.add('hidden');resumeTurnTimerIfReady()}

// ---- Integrate with the original game instead of replacing it. ----
const _freshState=freshState;freshState=function(){let st=_freshState();st.rogue=rogueDefaultState();return st};
const _startGame=startGame;startGame=function(){let ok=_startGame();if(ok)rogueliteInitializeRun();return ok};
const _defeatDemon=defeatDemon;defeatDemon=function(d,opts={}){let before=S.defeats||0;let killXp=S?.rogue?.enabled?rogueKillXpValue(d):0;let out=_defeatDemon(d,opts);if(S?.rogue?.enabled&&(S.defeats||0)>before){rogueAwardKillXp(killXp,d);rogueliteAfterDemonDefeat()}return out};
const _revealBoss=revealBoss;revealBoss=function(){if(S?.rogue?.enabled&&!rogueIsBossFloor())return;return _revealBoss()};
const _defeatBossIfNeeded=defeatBossIfNeeded;defeatBossIfNeeded=function(){if(S?.rogue?.enabled)return rogueliteBossDefeated();return _defeatBossIfNeeded()};
const _normalSpawnCount=normalSpawnCount;normalSpawnCount=function(){let n=_normalSpawnCount();if(S?.rogue?.enabled&&!S.bossRevealed&&rogueState().nodeType==='swarm')n=Math.min(4,n+1);return n};
const _triggerEnterPlay=triggerEnterPlay;triggerEnterPlay=function(d){if(S?.rogue?.enabled)rogueliteMutateDemon(d);return _triggerEnterPlay(d)};
const _spawnOne=spawnOne;spawnOne=function(doLog=true){let before=new Set((S.rooms||[]).flat().map(d=>d.id));let out=_spawnOne(doLog);if(S?.rogue?.enabled){let d=(S.rooms||[]).flat().find(x=>!before.has(x.id));if(d){rogueliteMutateDemon(d);render()}}return out};
const _demonAttack=demonAttack;demonAttack=function(d){let n=_demonAttack(d);if(S?.rogue?.enabled)return Math.max(0,Math.round(n*rogueDifficultyMultiplier()*rogueFloorDamageMultiplier()));return n};
const _bossDrainAmount=bossDrainAmount;bossDrainAmount=function(){let n=_bossDrainAmount();if(S?.rogue?.enabled&&S.bossRevealed){let reduction=Math.max(0,4-rogueAct()),base=Math.max(2,n-reduction);return Math.max(2,Math.round(base*rogueDifficultyMultiplier()*rogueFloorDamageMultiplier()))}return n};
const _gameOver=gameOver;gameOver=function(win){if(S?.rogue?.enabled)rogueliteBankRun(!!win);return _gameOver(win)};
const _render=render;render=function(){let out=_render();rogueliteRenderHud();if(S?.rogue?.enabled&&!S.bossRevealed){let a=document.getElementById('bossArea');if(a){let r=rogueState(),c=rogueCycle(),cf=rogueCycleFloorFor(r.floor),mult=rogueDifficultyMultiplier();a.innerHTML=rogueIsBossFloor()?'<div class="cap">The Boss Gate is opening…</div>':`<div class="cap">Boss Floors each cycle: 5 • 10 • 15<br><span class="muted">Cycle ${c} • Act ${r.act} • Floor ${cf} • ${mult}× difficulty</span></div>`}}return out};
const _showEndRunStatistics=showEndRunStatistics;showEndRunStatistics=function(outcome){let x=_showEndRunStatistics(outcome);if(S?.rogue?.enabled){let r=rogueState();let grid=document.querySelector('#endRunStatsModal .endRunStatsGrid')||document.querySelector('#endRunStatsModal .endRunGrid');if(!document.getElementById('endRunRogueFloor')){let anchor=document.getElementById('endRunNatural20s')?.parentElement;if(anchor){anchor.insertAdjacentHTML('afterend',`<div class="endRunStat"><b id="endRunRogueFloor">0</b><span>Floor Reached</span></div><div class="endRunStat"><b id="endRunRogueCinders">0</b><span>Cinders Banked</span></div>`)}}let f=document.getElementById('endRunRogueFloor'),c=document.getElementById('endRunRogueCinders');if(f)f.textContent=`C${rogueCycleForFloor(r.floor)} • F${rogueCycleFloorFor(r.floor)}/15`;if(c)c.textContent=r.bankedAmount||0}return x};

// Rebind the setup Start button because the original page bound its pre-roguelite function reference.
const startBtn=document.getElementById('startBtn');if(startBtn)startBtn.onclick=()=>startGame();
// Rename the old tutorial entry into a run guide; the classic tutorial's 13-defeat boss lesson is no longer accurate.
const oldTutorial=document.getElementById('tutorialBuildBadge');if(oldTutorial){let b=oldTutorial.cloneNode(true);oldTutorial.replaceWith(b);b.textContent='Run Guide';b.onclick=rogueliteShowGuide}
document.getElementById('tutorialWelcome')?.classList.add('hidden');

// Legacy button lives alongside the original Save/Load/Rules controls.
const toolbar=document.getElementById('topToolbar');if(toolbar&&!document.getElementById('rogueLegacyBtn')){let b=document.createElement('button');b.className='btn';b.id='rogueLegacyBtn';b.type='button';b.textContent='Legacy';b.onclick=rogueliteOpenLegacy;toolbar.appendChild(b)}
document.getElementById('rogueLegacyClose').onclick=rogueliteContinueAfterLegacy;
document.getElementById('rogueGuideClose').onclick=rogueliteCloseGuide;

// Setup/rules copy: clarify the new run structure without disturbing the original controls.
const setupBox=document.querySelector('#setupModal .modalbox');if(setupBox&&!document.getElementById('rogueSetupNotice')){let n=document.createElement('div');n.id='rogueSetupNotice';n.className='notice';n.innerHTML='<b>Endless Roguelite:</b> Each cycle is 15 floors across 3 Acts, with Bosses on Floors 5, 10, and 15. After the third Boss, Cinders bank, the Legacy shop opens, and the same run continues into a new cycle at double difficulty. Demon kills no longer draw Crucifix cards. Demon Blood earned from kills also becomes Relic XP: 15 XP for the first XP Relic, then +5 required for each XP-earned Relic. Room-clear Relic choices do not raise that requirement. Demon and Boss HP gains +15% of base per floor, while their damage gains +5% per floor. The online Priest run deck is built per player: <b>one of every Priest card + 15 randomized duplicate cards for each player</b>, all combined into one shared shuffled draw deck. Opening hands and future draws are random; drafted reward cards are shuffled into that run deck as extra copies. Choose a 30–120 second Priest turn timer before starting the run.';let h=setupBox.querySelector('h2');h?.insertAdjacentElement('afterend',n)}
const rules=document.getElementById('rulesText');if(rules){rules.innerHTML=`<div class="notice"><b>Endless Roguelite Structure:</b> Clear short encounters, choose a reward, then choose the next route. Every cycle has Bosses on Floors 5, 10, and 15. The third Boss banks your Cinders and opens the Legacy shop; continuing starts another 3 Acts at double the previous cycle difficulty. Demon Blood from kills doubles as Relic XP. XP Relics cost 15, then 20, 25, 30… XP; room-clear Relic choices do not increase that cost. Demon kills do not draw Crucifix cards. Altar Protection, Priest hands, Blood, XP progress, Corruption, Relics, and your evolving Priest run deck persist between floors. Drafted Priest cards are shuffled into future random draws. Cinders bank only when the run ends.</div>`+rules.innerHTML;rules.innerHTML=rules.innerHTML.replace(/The Boss appears after the 13th base Demon defeat\./g,'In Roguelite mode, Bosses appear on Floors 5, 10, and 15.').replace(/progress toward the 13 required base-Demon defeats/g,'progress toward the current encounter-clear requirement')}
const bossDeckP=document.querySelector('#bossDeckModal p');if(bossDeckP)bossDeckP.textContent='10 unique Boss Demons from the original Boss deck. In this Roguelite Edition, a randomized Boss guards Floors 5, 10, and 15. Boss identity, artwork, abilities, and the existing hidden Boss bag are preserved.';

document.title='Sanctum of the Damned — Compact Card Carousel Edition';
rogueliteRenderHud();
})();
