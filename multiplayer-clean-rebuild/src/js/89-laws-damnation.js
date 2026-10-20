/* Laws of Damnation — Clean Rebuild, live run modifiers.
 * All draft state and effect counters live in S.rogue.laws, so multiplayer
 * snapshots and local/cloud saves preserve exactly the same choices. */
(()=>{
'use strict';
if(window.__sanctumLawsInstalled)return;
window.__sanctumLawsInstalled=true;
const DEFINITIONS=[
 {key:'bloodCovenant',name:'The Blood Covenant',icon:'⛓',desc:'Every Demon slain strengthens the surviving Demon closest to the Altar by +2 maximum and current HP.',reward:'Kill order matters'},
 {key:'shiftingSanctum',name:'The Shifting Sanctum',icon:'◈',desc:'Every three rounds another room becomes unstable. Demons entering it gain one additional movement on their next Demon Phase.',reward:'Rooms become dangerous'},
 {key:'bloodPower',name:'Blood Is Power',icon:'♦',desc:'Basic Attacks automatically spend 1 Demon Blood, if available, for +3 direct damage. Save Blood for Rituals or use it for offense.',reward:'Blood versus damage'},
 {key:'endlessProcession',name:'The Endless Procession',icon:'♜',desc:'Every fourth normally spawned Demon brings a spectral copy at half HP and Attack. Spectral Demons grant no Blood or Relic XP.',reward:'Extra bodies, no XP'},
 {key:'lastBenediction',name:'The Last Benediction',icon:'✠',desc:'Consecration costs 4 Mana instead of 3, but consecrated rooms deal 2 damage to their occupants at the end of each Demon Phase.',reward:'Offensive consecration'},
 {key:'forbiddenScripture',name:'Forbidden Scripture',icon:'❖',desc:'Empowered Priest cards cost 1 less Mana; unempowered cards cost 1 additional Mana.',reward:'Build around Empowering'},
 {key:'elementalChaos',name:'Elemental Chaos',icon:'✧',desc:'The first Basic Attack each round splashes 1 damage to another Demon in the same room, plus 1 extra damage if the party owns a Fire, Poison, or Lightning Relic.',reward:'Splash positioning'},
 {key:'greaterCalling',name:'The Greater Calling',icon:'♛',desc:'Every third normally spawned Demon becomes Greater. Defeating it awards 5 additional Relic XP.',reward:'Harder Demons, faster Relics'},
 {key:'graveTithe',name:'The Grave Tithe',icon:'♢',desc:'Defeating a Demon in the Gateway during a Priest turn grants 2 extra Blood to the killer, but costs 1 Altar Protection (never the final point).',reward:'Blood versus Altar'},
 {key:'wardensOath',name:"The Warden's Oath",icon:'✥',desc:'The first time each Demon enters the Chapel it gains +2 HP but permanently loses 1 Attack.',reward:'Control the Chapel'},
 {key:'hollowGrace',name:'Hollow Grace',icon:'☽',desc:'Every Greater Demon killed restores 2 Altar Protection; Lesser Demon kills during Priest turns cost 1 shared Mana.',reward:'Hunt Greater Demons'},
 {key:'relentlessNight',name:'Relentless Night',icon:'☾',desc:'Every fourth round, Demons gain +1 Attack, but the party receives +2 shared Mana that round (up to the normal Mana cap).',reward:'Dangerous fourth rounds'}
];
const LOOKUP=Object.fromEntries(DEFINITIONS.map(x=>[x.key,x]));
const isRogue=()=>!!(S?.started&&S?.rogue?.enabled);
function get(){
 if(!isRogue())return null;
 const r=S.rogue;
 if(!r.laws||typeof r.laws!=='object')r.laws={active:[],offer:null,completedBossFloors:[],normalSpawns:0};
 const s=r.laws;
 if(!Array.isArray(s.active))s.active=[];
 if(!Array.isArray(s.completedBossFloors))s.completedBossFloors=[];
 s.active=s.active.filter(x=>!!LOOKUP[x]).slice(-3);
 return s;
}
const has=key=>!!get()?.active.includes(key);
function drawChoices(count){
 const active=new Set(get()?.active||[]);
 const pool=DEFINITIONS.filter(x=>!active.has(x.key)).map(x=>x.key);
 for(let i=pool.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,count);
}
let retry=null,shownOffer='';
function defer(ms=180){
 if(retry)clearTimeout(retry);
 retry=setTimeout(showPending,ms);
}
function offer(kind){
 const s=get();if(!s||s.offer)return false;
 const floor=Math.max(1,Number(S.rogue.floor)||1);
 if(kind!=='start'&&s.completedBossFloors.includes(floor))return false;
 s.offer={id:'law-'+floor+'-'+kind,kind,floor,keys:drawChoices(kind==='start'?3:2)};
 if(kind==='start')S.phase='Law Draft';
 clearTurnTimerInterval();
 log('LAWS OF DAMNATION — Choose '+(kind==='start'?'one of three starting Laws':'one of two new Laws')+'.','info');
 defer(kind==='start'?420:140);
 return true;
}
function showPending(){
 retry=null;
 const s=get(),o=s?.offer;
 if(!o||!o.keys?.length||['Defeat','Victory'].includes(S.phase))return;
 const modal=document.getElementById('rogueChoiceModal');
 const choice=S.multiplayerVote;
 if(choice?.open){
  if(choice.options?.some(x=>String(x.actionKey||'').startsWith('law:')))return;
  defer(280);return;
 }
 const online=typeof window.__sanctumWardOnlineInfo==='function'?window.__sanctumWardOnlineInfo():null;
 if(online?.online&&(!online.canChoose||online.starting)){defer(350);return}
 if(modal&&!modal.classList.contains('hidden')){
  if(modal.dataset.lawOffer===o.id)return;
  defer(280);return;
 }
 if(typeof window.__sanctumLawShowChoice!=='function'){defer(350);return}
 const choices=o.keys.map(key=>{
  const law=LOOKUP[key];
  return {title:law.name,icon:law.icon,cls:'lawDraftChoice',desc:law.desc,
   reward:law.reward,actionKey:'law:'+key,action:()=>choose(key)};
 });
 const title=o.kind==='start'?'Choose Your First Law':o.kind==='cycle'?'Replace a Law of Damnation':'Choose Another Law';
 const msg=o.kind==='start'
  ?'Three random Laws have appeared. Choose ONE to define this run from its very first encounter.'
  :o.kind==='cycle'
   ?'The third Boss has fallen. Choose a new Law to replace your oldest Law. Only three may remain active.'
   :'The Boss has fallen. Choose one new Law to add to your run. You may hold up to three active Laws.';
 window.__sanctumLawShowChoice('Laws of Damnation • Floor '+o.floor,title,msg,choices);
 if(online?.online){if(!S.multiplayerVote?.open){defer(350);return}}
 else if(modal)modal.dataset.lawOffer=o.id;
 shownOffer=o.id;
}
function choose(key){
 const s=get(),o=s?.offer;
 if(!o||!o.keys.includes(key)||!LOOKUP[key])return false;
 if(o.kind!=='start'&&o.floor!==Number(S.rogue.floor))return false;
 const removed=s.active.length>=3?s.active.shift():null;
 if(removed)log('LAW FADES — '+LOOKUP[removed].name+' is replaced.','info');
 s.active.push(key);
 if(o.kind!=='start'&&!s.completedBossFloors.includes(o.floor))s.completedBossFloors.push(o.floor);
 s.offer=null;
 shownOffer='';
 const modal=document.getElementById('rogueChoiceModal');
 if(modal)delete modal.dataset.lawOffer;
 log('LAW OF DAMNATION — '+LOOKUP[key].name+' now rules the Sanctum. '+LOOKUP[key].desc,'bad');
 if(o.kind==='start'){
  S.phase='Priest';
  if(typeof resumeTurnTimerIfReady==='function')resumeTurnTimerIfReady();
 }else if(o.kind==='cycle'){
  window.__sanctumLawResumeCycleCheckpoint?.();
 }else window.__sanctumLawResumeRoute?.();
 render();
 return true;
}
window.__sanctumLawChoose=choose;
window.__sanctumLawInterceptRoute=()=>{
 const s=get(),r=S?.rogue;
 if(!s||!S?.bossDefeatHandled||r.floor%5!==0||r.floor%15===0)return false;
 if(s.offer){defer();return true}
 if(s.completedBossFloors.includes(r.floor))return false;
 return offer('boss');
};
window.__sanctumLawInterceptCycleCheckpoint=()=>{
 const s=get(),r=S?.rogue;
 if(!s||!S?.bossDefeatHandled||r.floor%15!==0)return false;
 if(s.offer){defer();return true}
 if(s.completedBossFloors.includes(r.floor))return false;
 return offer('cycle');
};
const originalStart=startGame;
startGame=function(){
 const ok=originalStart.apply(this,arguments);
 if(ok&&isRogue()){
  S.rogue.laws={active:[],offer:null,completedBossFloors:[],normalSpawns:0};
  offer('start');
  render();
 }
 return ok;
};
try{window.startGame=startGame}catch(_){}

const baseBlood=demonBlood;
demonBlood=function(d){
 return d?.status?.lawSpectral?0:baseBlood.apply(this,arguments);
};
const baseHP=demonMaxHP;
demonMaxHP=function(d){
 const n=baseHP.apply(this,arguments);
 return d?.status?.lawSpectral?Math.max(1,Math.ceil(n/2)):n;
};
const baseAttack=demonAttack;
demonAttack=function(d){
 let n=baseAttack.apply(this,arguments);
 if(d?.status?.lawSpectral)n=Math.max(0,Math.ceil(n/2));
 if(has('relentlessNight')&&S.round%4===0)n+=1;
 return n;
};
const baseSpawn=spawnOne;
spawnOne=function(){
 const enabled=isRogue()&&S.phase!=='Law Draft';
 const before=enabled?new Set((S.rooms||[]).flat().map(x=>x.id)):null;
 const out=baseSpawn.apply(this,arguments);
 const s=get();
 if(!enabled||!s)return out;
 const d=(S.rooms||[]).flat().find(x=>!before.has(x.id));
 if(!d)return out;
 s.normalSpawns=(Number(s.normalSpawns)||0)+1;
 if(has('greaterCalling')&&s.normalSpawns%3===0&&!d.greater){
  d.greater=true;
  d.status=d.status||{};
  for(const key of ['rogueScaledFloor','rogueHpBonus','rogueDifficulty','rogueFloorHealth','partyHpBonus','partyHpBaseMax','partyHpPlayerCount'])delete d.status[key];
  d.status.extraHpBonus=0;
  d.status.lawGreaterCalling=true;
  if(typeof window.__rogueliteMutateDemon==='function')window.__rogueliteMutateDemon(d);
  window.__sanctumSyncPartyDemonScaling?.(S);
  d.cur=demonMaxHP(d);
  log('GREATER CALLING — '+demonName(d)+' arrives as Greater (+5 XP on defeat).','bad');
 }
 if(has('endlessProcession')&&s.normalSpawns%4===0){
  const echo={...d,id:'law-echo-'+uid(),status:{lawSpectral:true,noMerge:true},greater:!!d.greater,cur:d.greater?d.ghp:d.hp};
  delete echo.crucifixAttached;
  const placed=placeEnteringDemon(echo);
  if(placed>=0){
   echo.cur=demonMaxHP(echo);
   log('ENDLESS PROCESSION — a Spectral '+demonName(echo)+' joins the board. No Blood or Relic XP.','bad');
  }else{
   // Never add synthetic echoes to the normal Demon deck or overflow queue.
   S.queue=S.queue.filter(x=>x.id!==echo.id);
   log('ENDLESS PROCESSION — no room remains for the Spectral companion.','info');
  }
 }
 render();
 return out;
};
const baseEnter=triggerEnterRoom;
triggerEnterRoom=function(d){
 const out=baseEnter.apply(this,arguments);
 if(!isRogue()||!findDemonLocation(d))return out;
 const loc=findDemonLocation(d);
 if(has('shiftingSanctum')){
  const unstable=Math.floor((Number(S.round)-1)/3)%4;
  if(loc.r===unstable&&d.status?.lawShiftMarkedRound!==S.round){
   d.status=d.status||{};
   d.status.lawShiftMarkedRound=S.round;
   d.status.attackMoveBonus=Math.max(0,Number(d.status.attackMoveBonus)||0)+1;
   log('SHIFTING SANCTUM — '+demonName(d)+' is hastened through the '+ROOM_NAMES[loc.r]+'.','bad');
  }
 }
 if(has('wardensOath')&&loc.r===2&&!d.status?.lawChapelOath){
  d.status=d.status||{};d.status.lawChapelOath=true;
  d.status.extraHpBonus=(Number(d.status.extraHpBonus)||0)+2;
  d.cur+=2;
  d.status.wardAttackReduction=(Number(d.status.wardAttackReduction)||0)+1;
  log("WARDEN'S OATH — "+demonName(d)+' gains +2 HP but loses 1 Attack on entering the Chapel.','info');
 }
 return out;
};
const baseDamageTarget=dealDamageTarget;
dealDamageTarget=function(x,amt,source,opts={}){
 if(has('bloodPower')&&opts?.basicAttack&&S.phase==='Priest'){
  const p=S.players?.[S.current];
  if(p&&p.blood>=1){
   p.blood--;
   amt+=3;
   log('BLOOD IS POWER — '+p.name+' spends 1 Demon Blood to add 3 Basic Attack damage.','good');
  }
 }
 const others=has('elementalChaos')&&opts?.basicAttack&&x?.kind==='demon'
  ?(S.rooms[findDemonLocation(x.d)?.r]||[]).filter(d=>d.id!==x.d.id).map(d=>d.id):[];
 const splash=others.length&&get().lawEchoRound!==S.round;
 const floor=S.rogue?.floor,location=x?.kind==='demon'?findDemonLocation(x.d):null;
 const out=baseDamageTarget.call(this,x,amt,source,opts);
 if(splash&&location&&S.rogue?.floor===floor){
  const possible=(S.rooms[location.r]||[]).filter(d=>others.includes(d.id));
  if(possible.length){
   get().lawEchoRound=S.round;
   const bonus=(S.activeRelics||[]).some(k=>['cinderbrand','serpentsFang','lightningRod'].includes(k))?2:1;
   damageDemon(possible[Math.floor(Math.random()*possible.length)],bonus,'Elemental Chaos');
   log('ELEMENTAL CHAOS — Basic Attack arcs into a second Demon for '+bonus+' damage.','good');
  }
 }
 return out;
};
window.__sanctumLawCardManaCost=(mana,empowered)=>has('forbiddenScripture')
 ?Math.max(0,Number(mana)+(empowered?-1:1)):mana;
const baseConsecrateReason=consecrateUnavailableReason;
consecrateUnavailableReason=function(i){
 const reason=baseConsecrateReason.apply(this,arguments);
 if(reason)return reason;
 if(has('lastBenediction')&&S.mana<4)return 'The Last Benediction requires 4 shared Mana to Consecrate.';
 return '';
};
const baseConsecrate=consecrateRoom;
consecrateRoom=function(i){
 const extra=has('lastBenediction');
 const allowed=!consecrateUnavailableReason(i);
 if(!allowed)return baseConsecrate.apply(this,arguments);
 const out=baseConsecrate.apply(this,arguments);
 if(out!==false&&extra)S.mana=Math.max(0,S.mana-1);
 return out;
};
const baseConsecrateModal=openConsecrateModal;
openConsecrateModal=function(){
 const out=baseConsecrateModal.apply(this,arguments);
 if(has('lastBenediction')){
  const el=document.getElementById('consecratePlay');
  if(el&&!el.disabled)el.textContent='Play — Pay 4 Mana + 1 Blood';
 }
 return out;
};
const baseDefeat=defeatDemon;
defeatDemon=function(d){
 const floor=S?.rogue?.floor,loc=isRogue()?findDemonLocation(d):null;
 const phase=S.phase,wasGreater=!!d?.greater,wasSpectral=!!d?.status?.lawSpectral;
 const out=baseDefeat.apply(this,arguments);
 if(!loc||!isRogue()||S.rogue.floor!==floor||wasSpectral)return out;
 if(has('bloodCovenant')){
  const available=allDemons().slice().sort((a,b)=>b.r-a.r);
  const survivor=available[0]?.d;
  if(survivor){
   survivor.status=survivor.status||{};
   survivor.status.extraHpBonus=(Number(survivor.status.extraHpBonus)||0)+2;
   survivor.cur=Math.min(demonMaxHP(survivor),survivor.cur+2);
   log('BLOOD COVENANT — '+demonName(survivor)+' gains +2 maximum/current HP.','bad');
  }
 }
 if(has('graveTithe')&&loc.r===0&&phase==='Priest'){
  distributeKillBlood(2,S.current);
  if(S.altar>1)damageAltar(1,'The Grave Tithe');
 }
 if(has('hollowGrace')){
  if(wasGreater)healAltar(2,'Hollow Grace');
  else if(phase==='Priest')addMana(-1);
 }
 return out;
};
const baseEndRound=endRound;
endRound=function(){
 if(has('lastBenediction')&&['Demon','Boss'].includes(S.phase)&&!S.rogue.pendingClear){
  const floor=S.rogue.floor;
  const targets=(S.rooms||[]).flatMap((room,i)=>roomConsecrated(i)?room.map(d=>d.id):[]);
  for(const id of targets){
   if(!S?.started||S?.rogue?.floor!==floor||S.rogue.pendingClear)break;
   const d=allDemons().map(x=>x.d).find(x=>x.id===id);
   if(d)damageDemon(d,2,'The Last Benediction');
  }
  if(S.rogue.pendingClear||['Rogue Reward','Defeat'].includes(S.phase))return;
 }
 const previousRound=S?.round;
 const out=baseEndRound.apply(this,arguments);
 if(has('relentlessNight')&&S.round!==previousRound&&S.round%4===0){
  const cap=typeof sharedManaRoundValue==='function'?sharedManaRoundValue():10;
  const bonus=Math.max(0,Math.min(2,cap-S.mana));
  S.mana+=bonus;
  if(bonus)log('RELENTLESS NIGHT — +'+bonus+' shared Mana, but Demons have +1 Attack this round.','bad');
 }
 return out;
};
const baseRender=render;
render=function(){
 const out=baseRender.apply(this,arguments);
 try{
  const s=get(),hud=document.getElementById('rogueHud');
  if(hud){
   let rail=hud.querySelector('.sanctumLawRail');
   if(!rail){rail=document.createElement('div');rail.className='sanctumLawRail';hud.appendChild(rail)}
   const signature=JSON.stringify({active:s?.active||[],offer:s?.offer?.id||null});
   if(rail.dataset.signature!==signature){
    rail.dataset.signature=signature;
    rail.innerHTML=(s?.active||[]).map(key=>'<span class="sanctumLawChip" title="'+LOOKUP[key].desc+'">'+LOOKUP[key].icon+' '+LOOKUP[key].name+'</span>').join('')
      +(s?.offer?'<span class="sanctumLawChip sanctumLawPending">Choose a Law</span>':'');
    rail.hidden=!s||(s.active.length===0&&!s.offer);
   }
  }
  if(s?.offer&&!S.multiplayerVote?.open&&!retry)defer(260);
 }catch(error){console.warn('Law display skipped',error)}
 return out;
};
try{window.render=render}catch(_){}
window.__sanctumLaws={definitions:DEFINITIONS,has,choose,offer,showPending,get};
})();