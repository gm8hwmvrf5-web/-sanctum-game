/* Clean rebuild: core game state and mechanics. */
function buildCrucifixDeck(){return shuffle(CRUCIFIX.map(e=>e.n))}
function resetCrucifixDeck(){S.crucifixDeck=buildCrucifixDeck();S.crucifixDiscard=[]}
function ensureCrucifixDeckState(){
 const names=CRUCIFIX.map(e=>e.n),valid=new Set(names);
 const deck=Array.isArray(S.crucifixDeck)?S.crucifixDeck:[],discard=Array.isArray(S.crucifixDiscard)?S.crucifixDiscard:[];
 const combined=[...deck,...discard],unique=new Set(combined);
 const ok=combined.length===names.length&&unique.size===names.length&&combined.every(n=>valid.has(n));
 if(!ok)resetCrucifixDeck();
}
function takeCrucifixCard(){
 ensureCrucifixDeckState();
 if(!S.crucifixDeck.length){
  S.crucifixDeck=shuffle([...S.crucifixDiscard]);
  S.crucifixDiscard=[];
  log('All 36 Crucifix cards have been used. The full Crucifix deck is reshuffled.','info');
 }
 const name=S.crucifixDeck.pop();
 S.crucifixDiscard.push(name);
 return CRUCIFIX.find(e=>e.n===name);
}
let S = freshState();
let choiceResolve=null, choiceCancelSerial=0, selectedDemonId=null, crucifixDisplayQueue=[];
let overflowDamageQueue=[], overflowPromptActive=false;
function freshState(){return {started:false,round:1,phase:"Setup",mana:10,altar:30,defeats:0,rooms:[[],[],[],[]],queue:[],players:[],current:0,priestDeck:[],priestDiscard:[],priestCycleUsed:[],demonDeck:[],demonDiscard:[],demonCycleUsed:[],defeated:[],boss:null,bossRevealed:false,bossStageRoundsElapsed:0,bossFlags:{spores:{}},altarShield:0,altarBarrier:0,altarBarrierRound:0,altarTurnRenewals:[],altarDefeatBlessings:[],altarRoundRenewals:[],crucifixDeck:[],crucifixDiscard:[],nextAltarBonus:0,roomStop:{},roomMergeBlock:{},globalMergeBlock:false,blockNextMerge:false,mergeManaDiscount:0,mergeBloodDiscount:0,ignoreNegativeCrucifix:0,ritualRerolls:0,nextRitualFixed:null,corruption:[0,0,0,0],desecratedRooms:[false,false,false,false],consecrated:[false,false,false,false],relicDeck:[],activeRelics:[],relicMods:{basic:0,hand:0,ritual:0},relicFiveDefeatClaimed:false,bossDamageTotal:0,relicBossThresholds:0,relicPopupQueue:[],pendingVictory:false,pendingBossChoice:false,bossDefeatHandled:false,bossesDefeated:0,phaseBeforeBossChoice:null,lastDefeatedBossName:"",lastPriestCardPlayed:null,runStats:{damageToDemons:0,cardsPlayed:0,ritualsUsed:0,natural20s:0,greaterDemonsDefeated:0},runStatsShown:false,turnTimerSeconds:60,turnTimerRemaining:60,manualPaused:false,log:[]}}
function demonName(d){return d.greater?d.g:d.n}
function demonMaxHP(d){let max=d.greater?d.ghp:d.hp;max+=(d.status&&d.status.bossHpBonus)||0;max+=(d.status&&d.status.extraHpBonus)||0;if(bossIs("boneKing")){let loc=findDemonLocation(d);if(loc&&loc.r===3)max+=1}return max}
function demonBlood(d){let printed=d.greater?d.gb:d.b;let drained=(d.status&&d.status.bloodDrained)||0;return Math.max(0,printed-drained)}
function baseDemonAttack(d){return d.greater?d.gatk:d.atk}
function demonAttack(d){
 let atk=baseDemonAttack(d)+(d.status?.attackBonus||0)+(d.status?.attackRoundBonus||0);
 let loc=findDemonLocation(d);
 if(loc){
  let room=S.rooms[loc.r]||[];
  if(demonCode(d)==='packAttack'&&room.some(x=>x.id!==d.id))atk+=demonValue(d);
  for(let x of room)if(demonCode(x)==='roomAttack')atk+=demonValue(x);
 }
 return Math.max(0,atk);
}
function demonAbility(d){return d.status&&d.status.abilityRemoved?'ABILITY REMOVED':(d.greater?d.gability:d.ability)}
function demonCode(d){return d.status&&d.status.abilityRemoved?null:(d.greater?(d.ga||d.a):d.a)}
function demonValue(d){return d.status&&d.status.abilityRemoved?0:(d.greater?(d.gv??d.v):d.v)}
function demonArt(d){return d.greater?d.gart:d.art}
function priestTax(){let tax=allDemons().reduce((sum,x)=>sum+(demonCode(x.d)==='priestTax'?demonValue(x.d):0),0);if(roomDesecrated(2))tax+=1;return tax}
function closestDemon(excludeId=null){for(let r=3;r>=0;r--){for(let i=0;i<S.rooms[r].length;i++){let d=S.rooms[r][i];if(d.id!==excludeId)return d}}return null}
function stopIsBlocked(d){if(demonCode(d)!=='stopWard')return false;let used=d.status.stopWardUsed||0, cap=demonValue(d);if(used<cap){d.status.stopWardUsed=used+1;log(`${demonName(d)} prevents a movement-stopping effect (${d.status.stopWardUsed}/${cap}).`,'bad');return true}return false}
function applyStop(d){if(!d)return;if(stopIsBlocked(d))return;d.status.stop=true;log(`${demonName(d)} will not move this Demon Phase.`,'good')}
async function chooseAndStopDemons(ritualName,max,sourceRoom=null,checkHalving=true){let used=new Set(),stopped=0;for(let i=0;i<max;i++){let pool=(sourceRoom===null?allDemons():S.rooms[sourceRoom].map(d=>({d,r:sourceRoom}))).filter(x=>!used.has(x.d.id));if(!pool.length)break;if(i>0)pool.push({kind:'done',done:true,label:'DONE — keep the stops already resolved'});let x=await chooseVisualDemonTargets(`${ritualName} — choose Demon ${i+1} of up to ${max}${i>0?' or Done':''}`,pool);if(!x)return stopped;if(x.done||x.kind==='done')break;used.add(x.d.id);if(checkHalving)ritualIsHalved(x.d);applyStop(x.d);stopped++}return stopped}
async function chooseAndStopRooms(ritualName,max){let used=new Set();for(let i=0;i<max;i++){let occupied=ROOM_NAMES.map((n,idx)=>({n,i:idx})).filter(x=>S.rooms[x.i].length&&!used.has(x.i));if(!occupied.length)break;if(i>0)occupied.push({done:true});let rm=await choose(`${ritualName} — choose room ${i+1} of up to ${max}${i>0?' or Done':''}`,occupied,x=>x.done?'DONE — keep the rooms already held':`${x.n} (${S.rooms[x.i].length} Demon${S.rooms[x.i].length===1?'':'s'})`);if(!rm)return;if(rm.done)break;used.add(rm.i);let halved=S.rooms[rm.i].filter(d=>demonCode(d)==='ritualHalf').some(d=>ritualIsHalved(d));if(halved){await chooseAndStopDemons(`${ritualName} is halved in ${rm.n}`,ritualScale(1),rm.i,false);log(`${ritualName} is reduced to its Lesser effect in ${rm.n}.`,'bad')}else{S.rooms[rm.i].forEach(d=>applyStop(d));log(`${ritualName} holds ${rm.n}.`,'good')}}}
function moveDemonBackOne(d,source='Ritual'){let loc=findDemonLocation(d);if(!loc)return false;if(loc.r<=0){log(`${demonName(d)} is already in the Gateway and cannot move back.`);return false}if(S.rooms[loc.r-1].length>=4){log(`${source} cannot move ${demonName(d)} back because the previous room is full.`,'bad');return false}let destination=loc.r-1;S.rooms[loc.r].splice(loc.i,1);S.rooms[destination].push(d);d.cur=Math.min(d.cur,demonMaxHP(d));log(`${source} moves ${demonName(d)} back to ${['Gateway','Hall','Chapel','Crypt'][destination]}.`,'good');triggerEnterRoom(d);let after=findDemonLocation(d);if(after)checkMerge(d);render();return true}
function ritualIsHalved(d){if(demonCode(d)!=='ritualHalf')return false;let used=d.status.ritualHalfUsed||0,cap=demonValue(d);if(used<cap){d.status.ritualHalfUsed=used+1;log(`${demonName(d)} forces this Ritual to resolve at half effect.`,'bad');return true}return false}

const ROOM_NAMES=["Gateway","Hall","Chapel","Crypt"];
const DESECRATION_THRESHOLDS=[3,4,5,6];
function roomDesecrationThreshold(i){return DESECRATION_THRESHOLDS[i]||3}
const RELICS=[
 {key:'varoSword',n:"Sword of Saint Varo",cat:'Basic Attack',effect:'Basic Attack permanently deals +1 damage.',mods:{basic:1}},
 {key:'crusaderTooth',n:"Crusader's Tooth",cat:'Basic Attack',effect:'Basic Attack permanently deals +1 damage.',mods:{basic:1}},
 {key:'ashenBell',n:'Ashen War Bell',cat:'Basic Attack',effect:'Basic Attack permanently deals +1 damage.',mods:{basic:1}},
 {key:'martyrNail',n:"Martyr's Nail",cat:'Basic Attack',effect:'Basic Attack permanently deals +1 damage.',mods:{basic:1}},
 {key:'dawnSpear',n:'Spear of First Dawn',cat:'Basic Attack',effect:'Basic Attack permanently deals +2 damage.',mods:{basic:2}},
 {key:'ironReliquary',n:'Iron Reliquary',cat:'Basic Attack',effect:'Basic Attack permanently deals +1 damage.',mods:{basic:1}},
 {key:'gospelFragment',n:'Gospel Fragment',cat:'Hand Size',effect:'Maximum Priest hand size permanently increases by 1.',mods:{hand:1}},
 {key:'archivistKey',n:"Archivist's Key",cat:'Hand Size',effect:'Maximum Priest hand size permanently increases by 1.',mods:{hand:1}},
 {key:'pilgrimSatchel',n:"Pilgrim's Satchel",cat:'Hand Size',effect:'Maximum Priest hand size permanently increases by 1.',mods:{hand:1}},
 {key:'illuminatedPsalm',n:'Illuminated Psalm',cat:'Hand Size',effect:'Maximum Priest hand size permanently increases by 1.',mods:{hand:1}},
 {key:'saintLedger',n:"Saint's Ledger",cat:'Hand Size',effect:'Maximum Priest hand size permanently increases by 2.',mods:{hand:2}},
 {key:'keeperSeal',n:"Keeper's Seal",cat:'Hand Size',effect:'Maximum Priest hand size permanently increases by 1.',mods:{hand:1}},
 {key:'firstLightChalice',n:'Chalice of First Light',cat:'Ritual Power',effect:'Permanent +1 to numerical Ritual damage, healing, marks, Mana gains, and Demon Blood gains.',mods:{ritual:1}},
 {key:'oracleEye',n:"Oracle's Eye",cat:'Ritual Power',effect:'Permanent +1 to numerical Ritual damage, healing, marks, Mana gains, and Demon Blood gains.',mods:{ritual:1}},
 {key:'vesperBell',n:'Bell of Vespers',cat:'Ritual Power',effect:'Permanent +1 to numerical Ritual damage, healing, marks, Mana gains, and Demon Blood gains.',mods:{ritual:1}},
 {key:'sacredEmber',n:'Sacred Ember',cat:'Ritual Power',effect:'Permanent +1 to numerical Ritual damage, healing, marks, Mana gains, and Demon Blood gains.',mods:{ritual:1}},
 {key:'crownThorns',n:'Crown of Thorns',cat:'Ritual Power',effect:'Permanent +2 to numerical Ritual damage, healing, marks, Mana gains, and Demon Blood gains.',mods:{ritual:2}},
 {key:'seerBones',n:'Bones of the Seer',cat:'Ritual Power',effect:'Permanent +1 to numerical Ritual damage, healing, marks, Mana gains, and Demon Blood gains.',mods:{ritual:1}},
 {key:'trinityReliquary',n:'Trinity Reliquary',cat:'Hybrid Relic',effect:'Basic Attack permanently deals +1 damage and maximum Priest hand size increases by 1.',mods:{basic:1,hand:1}},
 {key:'sanctumHeart',n:'Heart of the Sanctum',cat:'Hybrid Relic',effect:'Maximum Priest hand size permanently increases by 1 and Ritual numerical effects gain +1.',mods:{hand:1,ritual:1}}
];
function relicByKey(k){return RELICS.find(r=>r.key===k)||null}
function handLimit(){return HAND_LIMIT+((S&&S.relicMods&&S.relicMods.hand)||0)}
function basicAttackDamage(){return 2+((S&&S.relicMods&&S.relicMods.basic)||0)}
function ritualScale(n){return Math.ceil(n*1.2)}
function ritualBoost(n){return ritualScale(n)+((S&&S.relicMods&&S.relicMods.ritual)||0)}
function applyRelic(r){if(!r)return;S.relicMods=S.relicMods||{basic:0,hand:0,ritual:0};for(let k of ['basic','hand','ritual'])S.relicMods[k]=(S.relicMods[k]||0)+((r.mods&&r.mods[k])||0);S.activeRelics=S.activeRelics||[];S.activeRelics.push(r.key);log(`RELIC — ${r.n}: ${r.effect}`,'good')}
function relicModalBlocked(){return !document.getElementById('crucifixModal').classList.contains('hidden')||!document.getElementById('choiceModal').classList.contains('hidden')||!document.getElementById('consecrateModal').classList.contains('hidden')||!document.getElementById('desecrationModal').classList.contains('hidden')||!document.getElementById('descendModal').classList.contains('hidden')}
function showNextRelicPopup(){S.relicPopupQueue=S.relicPopupQueue||[];if(!S.relicPopupQueue.length||relicModalBlocked())return;let q=S.relicPopupQueue[0],r=relicByKey(q.key);if(!r){S.relicPopupQueue.shift();showNextRelicPopup();return}document.getElementById('relicName').textContent=r.n;document.getElementById('relicCategory').textContent=r.cat;document.getElementById('relicEffect').textContent=r.effect;document.getElementById('relicReason').textContent=q.reason||'A Relic has been recovered from the Sanctum.';document.getElementById('relicModal').classList.remove('hidden');setTimeout(()=>document.getElementById('relicClose').focus(),0)}
function closeRelicPopup(){document.getElementById('relicModal').classList.add('hidden');if(S.relicPopupQueue&&S.relicPopupQueue.length)S.relicPopupQueue.shift();if(S.relicPopupQueue&&S.relicPopupQueue.length){showNextRelicPopup();return}processOverflowDamageQueue();if(S.pendingBossChoice){setTimeout(()=>{showBossVictoryChoice();resumeTurnTimerIfReady()},80);return}if(S.pendingVictory){S.pendingVictory=false;setTimeout(()=>alert('Congratulations! You have saved the Sanctum!'),100)}resumeTurnTimerIfReady()}
function pullRelic(reason){S.relicDeck=S.relicDeck||[];if(!S.relicDeck.length){log('The Relic deck is empty. No further Relics can be drawn.');return null}let key=S.relicDeck.pop(),r=relicByKey(key);if(!r)return null;applyRelic(r);S.relicPopupQueue=S.relicPopupQueue||[];S.relicPopupQueue.push({key,reason});render();showNextRelicPopup();return r}
function checkBossDamageRelics(){if(S?.rogue?.enabled)return;S.bossDamageTotal=S.bossDamageTotal||0;S.relicBossThresholds=S.relicBossThresholds||0;let earned=Math.floor(S.bossDamageTotal/25);while(S.relicBossThresholds<earned){S.relicBossThresholds++;pullRelic(`The Priests have dealt ${S.relicBossThresholds*25} cumulative damage to the Boss.`)}}
function rollGreaterDemonRelic(){
 let roll=Math.floor(Math.random()*100)+1;
 if(roll<=33){
  log(`GREATER DEMON RELIC ROLL — ${roll}/100: SUCCESS. A Relic is recovered.`,'good');
  pullRelic(`A Greater Demon was defeated and the Relic roll succeeded (${roll}/100 — 33% chance).`);
  return true;
 }
 log(`GREATER DEMON RELIC ROLL — ${roll}/100: no Relic.`,'info');
 return false;
}
function relicSummaryHtml(){let mods=S.relicMods||{basic:0,hand:0,ritual:0},keys=S.activeRelics||[];if(!keys.length)return '<div class="relicSummary"><b>Relics:</b> None recovered yet. In Roguelite mode, Demon Blood earned from kills also counts as Relic XP.</div>';let names=keys.map(k=>relicByKey(k)).filter(Boolean).map(r=>`<span class="relicChip">${r.n}</span>`).join('');return `<div class="relicSummary"><b>Relics ${keys.length}/20</b> • Basic Attack ${basicAttackDamage()} • Hand Limit ${handLimit()} • Ritual +${mods.ritual||0}<br>${names}</div>`}

const DESECRATION_EFFECTS=[
 'Desecrated Gateway: every newly spawned Demon entering the Gateway gains +1 HP.',
 'Desecrated Hall: every Demon entering the Hall gains +1 Attack for the current round.',
 'Desecrated Chapel: all Priest cards cost +1 additional shared Mana while the Chapel remains Desecrated.',
 'Desecrated Crypt: every Demon entering the Crypt heals 1 HP.'
];
function openDesecrationInfo(i){
 document.getElementById('desecrationRoomName').textContent=ROOM_NAMES[i];
 document.getElementById('desecrationEffect').textContent=`${DESECRATION_EFFECTS[i]} This room becomes Desecrated after ${roomDesecrationThreshold(i)} Demons leave it while moving toward the Altar. It remains Desecrated while at least 1 Corruption tracker remains. If Corruption reaches 0, Desecration is cleared and the cracks disappear.`;
 document.getElementById('desecrationModal').classList.remove('hidden');
 setTimeout(()=>document.getElementById('desecrationClose').focus(),0);
}
function closeDesecrationInfo(){
 document.getElementById('desecrationModal').classList.add('hidden');
}

function roomCorruption(i){return (S.corruption&&S.corruption[i])||0}
function setRoomCorruption(i,value,state=S){
 if(!state||i<0||i>3)return 0;
 if(!Array.isArray(state.corruption))state.corruption=[0,0,0,0];
 while(state.corruption.length<4)state.corruption.push(0);
 if(!Array.isArray(state.desecratedRooms))state.desecratedRooms=[false,false,false,false];
 while(state.desecratedRooms.length<4)state.desecratedRooms.push(false);
 state.corruption[i]=Math.max(0,Math.floor(Number(value)||0));
 if(state.corruption[i]===0)state.desecratedRooms[i]=false;
 else if(state.corruption[i]>=roomDesecrationThreshold(i))state.desecratedRooms[i]=true;
 return state.corruption[i];
}
function roomDesecrated(i){
 return !!(S.desecratedRooms&&S.desecratedRooms[i])||roomCorruption(i)>=roomDesecrationThreshold(i)
}
function roomConsecrated(i){return !!(S.consecrated&&S.consecrated[i])}
function roomStateHtml(i){
 let parts=[`Maximum 4 Demons • Corruption ${roomCorruption(i)}/${roomDesecrationThreshold(i)}`];
 if(roomDesecrated(i))parts.push(`<button type="button" class="desecrationInfoBtn" data-desecrate-info="${i}">Desecrated — Clear at 0 Corruption</button>`);
 if(roomConsecrated(i))parts.push('<span class="tag good">Consecrated</span>');
 if(roomDesecrated(i))parts.push(`<div class="desecrationEffectText">${DESECRATION_EFFECTS[i]}</div>`);
 return parts.join(' ');
}
function consecrateUnavailableReason(i){
 if(!S.started)return 'Start a game first.';
 if(S.phase!=='Priest')return 'Rooms can only be consecrated during the Priest phase.';
 let p=currentPlayer();
 if(!p)return 'There is no active player.';
 if(p.consecrateUsed)return `${p.name} has already consecrated a room this turn.`;
 if(S.mana<3)return `You need 3 shared Mana, but only ${S.mana} is available.`;
 if(p.blood<1)return `${p.name} needs 1 Demon Blood, but has ${p.blood}.`;
 if(roomConsecrated(i))return `${ROOM_NAMES[i]} is already consecrated for this round.`;
 return '';
}
const CONSECRATE_EFFECTS=[
 'Cleanse all Corruption. Until the round ends, newly spawned Demons entering the Gateway take 1 damage.',
 'Cleanse all Corruption. Until the round ends, Demons entering the Hall are stopped for the next Demon Phase.',
 'Cleanse all Corruption. Until the round ends, every effect that restores Altar Protection restores +1 additional Protection.',
 'Cleanse all Corruption. Until the round ends, Demon merging is prevented.'
];
let pendingConsecrateRoom=null;
function openConsecrateModal(i){
 pendingConsecrateRoom=i;
 let modal=document.getElementById('consecrateModal');
 let p=currentPlayer();
 let reason=consecrateUnavailableReason(i);
 document.getElementById('consecrateRoomName').textContent=ROOM_NAMES[i];
 document.getElementById('consecrateEffect').textContent=CONSECRATE_EFFECTS[i];
 let status=document.getElementById('consecrateStatus');
 let mana=S.mana||0,blood=p?p.blood:0,corruption=roomCorruption(i);
 if(reason){
   status.className='consecrateStatus bad';
   status.textContent=`Cannot play yet: ${reason} Current resources — Mana ${mana}/10, Demon Blood ${blood}/10, Corruption ${corruption}/${roomDesecrationThreshold(i)}.`;
 }else{
   status.className='consecrateStatus good';
   status.textContent=`Ready to play. Current resources — Mana ${mana}/10, Demon Blood ${blood}/10, Corruption ${corruption}/${roomDesecrationThreshold(i)}.`;
 }
 let play=document.getElementById('consecratePlay');
 play.disabled=!!reason;
 play.textContent=reason?'Cannot Play':'Play — Pay 3 Mana + 1 Blood';
 modal.classList.remove('hidden');
 setTimeout(()=>document.getElementById(reason?'consecrateClose':'consecratePlay').focus(),0);
}
function closeConsecrateModal(){
 pendingConsecrateRoom=null;
 document.getElementById('consecrateModal').classList.add('hidden');
}
function consecrateRoom(i){
 let reason=consecrateUnavailableReason(i);
 if(reason){openConsecrateModal(i);return false}
 let p=currentPlayer();
 S.mana=Math.max(0,S.mana-3);
 p.blood=Math.max(0,p.blood-1);
 p.consecrateUsed=true;
 let removed=roomCorruption(i);
 let wasDesecrated=roomDesecrated(i);
 S.corruption[i]=0;
 S.desecratedRooms=S.desecratedRooms||[false,false,false,false];
 S.desecratedRooms[i]=false;
 S.consecrated[i]=true;
 log(`${p.name} consecrates the ${ROOM_NAMES[i]} for this round by spending 3 Mana and 1 Demon Blood.`,'good');
 if(removed>0)log(`The consecration cleanses ${removed} Corruption tracker${removed===1?'':'s'} from the ${ROOM_NAMES[i]}.`,'good');
 if(wasDesecrated)log(`${ROOM_NAMES[i]} reaches 0 Corruption. Its Desecration is cleared and the cracks fade away.`,'good');
 switch(i){
  case 0: log('Consecrated Gateway: newly spawned Demons take 1 damage on entry.','good'); break;
  case 1: log('Consecrated Hall: Demons entering the Hall are stopped for the next Demon Phase.','good'); break;
  case 2: log('Consecrated Chapel: Altar-healing effects restore +1 additional Protection.','good'); break;
  case 3: log('Consecrated Crypt: Demon merging is prevented while it remains consecrated.','good'); break;
 }
 closeConsecrateModal();
 render();
 return true;
}
function addCorruption(i,source='Demon movement'){
 if(i<0||i>3)return;
 let threshold=roomDesecrationThreshold(i);
 if(roomConsecrated(i)){log(`${source} would corrupt the ${ROOM_NAMES[i]}, but its consecration holds.`, 'good');return}
 if(roomCorruption(i)>=threshold){log(`${source} deepens the taint, but the ${ROOM_NAMES[i]} is already Desecrated.`, 'bad');return}
 S.corruption[i]=(S.corruption[i]||0)+1;
 if(S.corruption[i]>=threshold){
  S.desecratedRooms=S.desecratedRooms||[false,false,false,false];
  if(!S.desecratedRooms[i]){
   S.desecratedRooms[i]=true;
   log(`${ROOM_NAMES[i]} becomes Desecrated at ${threshold} Corruption! Reduce it to 0 Corruption to clear the Desecration.`, 'bad');
  }else{
   log(`${ROOM_NAMES[i]} gains 1 Corruption (${S.corruption[i]}/${threshold}). It remains Desecrated.`, 'bad');
  }
 }else log(`${ROOM_NAMES[i]} gains 1 Corruption (${S.corruption[i]}/${threshold}).`, 'bad');
}
function reduceRoomCorruptionOnDemonDefeat(roomIndex){
 if(roomIndex<0||roomIndex>3)return 0;
 let before=roomCorruption(roomIndex);
 if(before<=0)return 0;
 let wasDesecrated=roomDesecrated(roomIndex);
 S.corruption[roomIndex]=Math.max(0,before-1);
 let after=S.corruption[roomIndex];
 if(after===0){
  S.desecratedRooms=S.desecratedRooms||[false,false,false,false];
  S.desecratedRooms[roomIndex]=false;
  log(`A Demon defeated in the ${ROOM_NAMES[roomIndex]} removes the final Corruption tracker (0/${roomDesecrationThreshold(roomIndex)}).`,'good');
  if(wasDesecrated)log(`${ROOM_NAMES[roomIndex]} is cleansed: Desecration ends, its penalty is removed, and the cracks disappear.`,'good');
 }else if(wasDesecrated){
  log(`A Demon defeated in the ${ROOM_NAMES[roomIndex]} removes 1 Corruption tracker (${after}/${roomDesecrationThreshold(roomIndex)}). The room remains Desecrated until Corruption reaches 0.`,'good');
 }else{
  log(`A Demon defeated in the ${ROOM_NAMES[roomIndex]} removes 1 Corruption tracker (${after}/${roomDesecrationThreshold(roomIndex)}).`,'good');
 }
 return 1;
}
function applyRoomEntryEffects(d){
 let loc=findDemonLocation(d);if(!loc)return;
 if(loc.r===1&&roomDesecrated(1)){
  d.status=d.status||{};
  d.status.attackRoundBonus=(d.status.attackRoundBonus||0)+1;
  log(`${demonName(d)} gains +1 Attack from the Desecrated Hall.`, 'bad');
 }
 if(loc.r===1&&roomConsecrated(1)){
  applyStop(d);
  log(`Consecrated Hall stops ${demonName(d)}.`, 'good');
 }
 if(loc.r===3&&roomDesecrated(3)){
  let before=d.cur;
  d.cur=Math.min(demonMaxHP(d),d.cur+1);
  if(d.cur>before)log(`${demonName(d)} heals 1 HP in the Desecrated Crypt.`, 'bad');
 }
}
function normalizeSanctumState(){
 ensureCrucifixDeckState();
 if(!S.corruption||!Array.isArray(S.corruption))S.corruption=[0,0,0,0];
 while(S.corruption.length<4)S.corruption.push(0);
 if(!S.desecratedRooms||!Array.isArray(S.desecratedRooms)){
   S.desecratedRooms=[0,1,2,3].map(i=>roomCorruption(i)>=roomDesecrationThreshold(i));
 }
 while(S.desecratedRooms.length<4)S.desecratedRooms.push(false);
 for(let i=0;i<4;i++){
   if(roomCorruption(i)<=0)S.desecratedRooms[i]=false;
   else if(roomCorruption(i)>=roomDesecrationThreshold(i))S.desecratedRooms[i]=true;
   S.desecratedRooms[i]=!!S.desecratedRooms[i];
 }
 if(!S.consecrated||!Array.isArray(S.consecrated))S.consecrated=[false,false,false,false];
 while(S.consecrated.length<4)S.consecrated.push(false);
 S.players=(S.players||[]).map(p=>({consecrateUsed:false,...p, consecrateUsed:!!p.consecrateUsed}));
 S.rooms=(S.rooms||[[],[],[],[]]);
 while(S.rooms.length<4)S.rooms.push([]);
 if(!Array.isArray(S.priestCycleUsed))S.priestCycleUsed=[];
 if(!Array.isArray(S.demonDiscard))S.demonDiscard=[];
 if(!Array.isArray(S.demonCycleUsed))S.demonCycleUsed=[];
 if(!Array.isArray(S.priestDeck))S.priestDeck=[];
 if(!Array.isArray(S.priestDiscard))S.priestDiscard=[];
 S.priestDeck=S.priestDeck.filter(c=>c&&!c.temp&&!String(c.id||'').startsWith('echo-'));
 S.priestDiscard=S.priestDiscard.filter(c=>c&&!c.temp&&!String(c.id||'').startsWith('echo-'));
 if(!S.relicDeck||!Array.isArray(S.relicDeck))S.relicDeck=shuffle(RELICS.map(r=>r.key));
 if(!S.activeRelics||!Array.isArray(S.activeRelics))S.activeRelics=[];
 if(!S.relicMods)S.relicMods={basic:0,hand:0,ritual:0};
 for(let k of ['basic','hand','ritual'])if(!Number.isFinite(S.relicMods[k]))S.relicMods[k]=0;
 if(typeof S.relicFiveDefeatClaimed!=='boolean')S.relicFiveDefeatClaimed=S.defeats>=5;
 if(!Number.isFinite(S.bossDamageTotal))S.bossDamageTotal=0;
 if(!Number.isFinite(S.bossStageRoundsElapsed))S.bossStageRoundsElapsed=0;
 S.bossStageRoundsElapsed=Math.max(0,Math.floor(S.bossStageRoundsElapsed));
 if(!Number.isFinite(S.relicBossThresholds))S.relicBossThresholds=Math.floor(S.bossDamageTotal/25);
 if(!S.relicPopupQueue||!Array.isArray(S.relicPopupQueue))S.relicPopupQueue=[];
 if(typeof S.pendingVictory!=='boolean')S.pendingVictory=false;
 if(typeof S.pendingBossChoice!=='boolean')S.pendingBossChoice=false;
 if(typeof S.bossDefeatHandled!=='boolean')S.bossDefeatHandled=false;
 if(!Number.isFinite(S.bossesDefeated))S.bossesDefeated=0;
 if(typeof S.phaseBeforeBossChoice!=='string')S.phaseBeforeBossChoice=null;
 if(typeof S.lastDefeatedBossName!=='string')S.lastDefeatedBossName='';
 if(!S.lastPriestCardPlayed||typeof S.lastPriestCardPlayed!=='object'||S.lastPriestCardPlayed.k==='echo')S.lastPriestCardPlayed=null;
 if(S.lastPriestCardPlayed){
  let echoBase=PRIEST.find(c=>c.n===S.lastPriestCardPlayed.n);
  if(echoBase){let {art,...echoDefinition}=echoBase;S.lastPriestCardPlayed={...echoDefinition};}
 }
 if(!S.runStats||typeof S.runStats!=='object')S.runStats={};
 for(let k of ['damageToDemons','cardsPlayed','ritualsUsed','natural20s','greaterDemonsDefeated']){
   if(!Number.isFinite(S.runStats[k]))S.runStats[k]=0;
 }
 if(typeof S.runStatsShown!=='boolean')S.runStatsShown=false;
 if(!Array.isArray(S.altarTurnRenewals))S.altarTurnRenewals=[];
 if(!Array.isArray(S.altarDefeatBlessings))S.altarDefeatBlessings=[];
 if(!Array.isArray(S.altarRoundRenewals))S.altarRoundRenewals=[];
 if(!Number.isFinite(S.altarBarrier))S.altarBarrier=0;
 if(!Number.isFinite(S.altarBarrierRound))S.altarBarrierRound=0;
 S.altarTurnRenewals=S.altarTurnRenewals.filter(x=>x&&Number.isFinite(x.amount)&&Number.isFinite(x.remaining)&&x.remaining>0);
 S.altarDefeatBlessings=S.altarDefeatBlessings.filter(x=>x&&Number.isFinite(x.amount)&&Number.isFinite(x.remaining)&&x.remaining>0);
 S.altarRoundRenewals=S.altarRoundRenewals.filter(x=>x&&Number.isFinite(x.amount)&&Number.isFinite(x.remaining)&&Number.isFinite(x.nextRound)&&x.remaining>0);
 if(!Number.isFinite(S.turnTimerSeconds))S.turnTimerSeconds=60;
 S.turnTimerSeconds=Math.max(30,Math.min(120,Math.round(S.turnTimerSeconds/15)*15));
 if(typeof TURN_TIMER_SECONDS!=='undefined')TURN_TIMER_SECONDS=S.turnTimerSeconds;
 if(!Number.isFinite(S.turnTimerRemaining))S.turnTimerRemaining=S.turnTimerSeconds;
 S.turnTimerRemaining=Math.max(0,Math.min(S.turnTimerSeconds,Math.ceil(S.turnTimerRemaining)));
 if(typeof S.manualPaused!=='boolean')S.manualPaused=false;
}

function bossIs(code){return !!(S&&S.bossRevealed&&S.boss&&S.boss.key===code)}
function ensureBossFlags(){if(!S.bossFlags)S.bossFlags={};if(!S.bossFlags.spores)S.bossFlags.spores={};return S.bossFlags}
function resetBossRoundFlags(){let f=ensureBossFlags(),spores=f.spores||{};S.bossFlags={spores,blackRitualUsed:false,soulSupportUsed:false,seraphHaloUsed:false,reaperPreventUsed:false,omenUsed:false,breachUsed:false,ashenWakeUsed:false}}
const SUPPORT_RITUAL_KINDS=new Set(["visionFate","foretoldDeath","rewriteDestiny","holdLine","martyrGuard","sacredMark","divineIntervention","chainsFaith","stillWicked","innerPeace","echoedGrace","miracleUnity","severUnholy"]);
function applyBossRitualRestriction(r,full){let f=ensureBossFlags();if(bossIs("blackSovereign")&&!f.blackRitualUsed){f.blackRitualUsed=true;log(`${S.boss.n} — Edict of Silence: the first Ritual this round resolves at half effect.`,"bad");return false}if(bossIs("soulTyrant")&&SUPPORT_RITUAL_KINDS.has(r.kind)&&!f.soulSupportUsed){f.soulSupportUsed=true;log(`${S.boss.n} — Chains of Dominion: the first Support Ritual this round resolves at half effect.`,"bad");return false}return full}
function addBossHpBonus(d,n,label){if(!d||n<=0)return;d.status=d.status||{};d.status.bossHpBonus=(d.status.bossHpBonus||0)+n;d.cur+=n;if(label)log(`${demonName(d)} gains ${n} HP from ${label}.`,"bad")}
function bossBreachBonus(loss){let f=ensureBossFlags();if(bossIs("lordOfAsh")&&!f.ashenWakeUsed){f.ashenWakeUsed=true;loss+=1;log(`${S.boss.n} — Ashen Wake adds 1 Altar loss to the first breach this round.`,"bad")}return loss}
function spawnBossSummonedLesser(count=1,fireImp=false){for(let i=0;i<count;i++){let d;if(fireImp){let base=DEMON_TYPES.find(x=>x.key==="imp_fire")||DEMON_TYPES[1];d={...base,id:`fireimp-${uid()}`,greater:false,cur:base.hp,status:{summoned:true,noMerge:true}}}else{let base=drawDemon();if(!base){log(`${S.boss.n} cannot summon: no Demon card is available.`,'bad');continue}d={...base,greater:false,cur:base.hp,status:{summoned:true,noMerge:true}}}if(S.rooms[0].length<4){S.rooms[0].push(d);triggerEnterPlay(d);triggerEnterRoom(d);if(roomDesecrated(0)&&findDemonLocation(d)){d.status=d.status||{};d.status.extraHpBonus=(d.status.extraHpBonus||0)+1;d.cur+=1;log(`${demonName(d)} gains +1 HP from the Desecrated Gateway.`,'bad')}if(roomConsecrated(0)&&findDemonLocation(d))damageDemon(d,1,'Consecrated Gateway')}else S.queue.push(d);log(`${demonName(d)} is summoned by ${S.boss.n} and cannot merge.`,"bad")}render()}
function recallOldestDefeated(){let idx=S.defeated.findIndex(d=>!d.greater);if(idx<0){log(`${S.boss.n} finds no defeated Lesser Demon to return.`);return}let old=S.defeated.splice(idx,1)[0];S.defeats=Math.max(0,S.defeats-1);let d={...old,greater:false,cur:old.hp,status:{}};if(S.rooms[0].length<4){S.rooms[0].push(d);triggerEnterPlay(d);triggerEnterRoom(d);if(roomDesecrated(0)&&findDemonLocation(d)){d.status=d.status||{};d.status.extraHpBonus=(d.status.extraHpBonus||0)+1;d.cur+=1;log(`${demonName(d)} gains +1 HP from the Desecrated Gateway.`,'bad')}if(roomConsecrated(0)&&findDemonLocation(d))damageDemon(d,1,'Consecrated Gateway');if(findDemonLocation(d))checkMerge(d)}else S.queue.push(d);log(`${S.boss.n} returns ${d.n} from the defeated row to the Entrance. Defeat count falls to ${S.defeats}.`,"bad")}
async function crimsonProphecy(){
 if(S.demonDeck.length<2)return;
 let top=S.demonDeck[S.demonDeck.length-1],second=S.demonDeck[S.demonDeck.length-2];
 let picked=await showRevealedDemonCards(`${S.boss.n} — Blood Prophecy`,[top,second],{
  selectTop:true,
  subtitle:'Blood Prophecy reveals the next two Demon cards in full. Choose which Demon should enter first.'
 });
 if(picked===1){
  S.demonDeck[S.demonDeck.length-1]=second;
  S.demonDeck[S.demonDeck.length-2]=top;
  log(`${S.boss.n} reorders the top two Demon cards: ${demonName(second)} will enter first.`,'bad');
 }else{
  log(`${S.boss.n} keeps ${demonName(top)} on top of the Demon deck.`,'bad');
 }
}
function plagueBloom(){for(let r=0;r<4;r++){if(!S.rooms[r].length)continue;let d=S.rooms[r][0],before=d.cur;d.cur=Math.min(demonMaxHP(d),d.cur+1);if(d.cur>before)log(`${S.boss.n} — Pestilent Bloom heals ${demonName(d)} in ${["Gateway","Hall","Chapel","Crypt"][r]} for 1 HP.`,"bad")}}
function damageBoss(amt,source="Damage",ritual=false){if(!S.bossRevealed||!S.boss||amt<=0)return;let f=ensureBossFlags();if(f.bossMark){amt+=f.bossMark;log(`Sacred marking adds ${f.bossMark} damage to ${S.boss.n}.`,'good');f.bossMarkCharges=(f.bossMarkCharges||1)-1;if(f.bossMarkCharges<=0){delete f.bossMark;delete f.bossMarkCharges}}let original=amt;if(ritual&&bossIs("fallenSeraph")&&!f.seraphHaloUsed){f.seraphHaloUsed=true;amt=Math.max(1,Math.floor(amt/2));log(`${S.boss.n} — Profane Halo halves the first Ritual that targets it this round (${original} → ${amt}).`,"bad")}if(ritual&&bossIs("devourer")){let reduced=Math.max(1,amt-1);if(reduced!==amt)log(`${S.boss.n} — Hungering Maw reduces Ritual damage by 1 (${amt} → ${reduced}).`,"bad");amt=reduced}if(bossIs("dreadReaper")&&!f.reaperPreventUsed){f.reaperPreventUsed=true;let blocked=Math.min(2,amt);amt-=blocked;log(`${S.boss.n} — Harvest Unending prevents ${blocked} of the first damage it would take this round.`,"bad")}if(amt<=0){render();return}let before=S.boss.cur;S.boss.cur=Math.max(0,S.boss.cur-amt);let dealt=before-S.boss.cur;S.bossDamageTotal=(S.bossDamageTotal||0)+dealt;log(`${source} deals ${dealt} damage to ${S.boss.n}. Total Boss damage: ${S.bossDamageTotal}.`,"good");checkBossDamageRelics();defeatBossIfNeeded();render()}
function triggerEnterRoom(d){let code=demonCode(d),v=demonValue(d);if(code==='roomAltar'){damageAltar(v,`${demonName(d)} enters a room`)}let loc=findDemonLocation(d);if(!loc)return;applyRoomEntryEffects(d);loc=findDemonLocation(d);if(!loc)return;let f=ensureBossFlags();if(bossIs("boneKing")&&loc.r===3){d.cur+=1;log(`${S.boss.n} — Ossuary Court grants ${demonName(d)} +1 HP in the Crypt.`,"bad")}let sporeCount=f.spores[loc.r]||0;if(bossIs("plagueFather")&&sporeCount>0){f.spores[loc.r]=sporeCount-1;addBossHpBonus(d,1,"Corruption Spores")}if(bossIs("gatebreaker")&&!f.breachUsed&&(loc.r===1||loc.r===2)){f.breachUsed=true;let moved=moveOneForward(d,`${S.boss.n} — Breach the Sanctum`);if(moved)log(`${S.boss.n} — Breach the Sanctum moves ${demonName(d)} 1 additional room forward.`,"bad");else log(`${S.boss.n} — Breach the Sanctum tries to move ${demonName(d)}, but the next room is full.`,"bad")}}
function triggerEnterPlay(d){let code=demonCode(d),v=demonValue(d);if(code==='enterMana'){addMana(-v);log(`${demonName(d)} enters play: lose ${v} shared Mana.`,'bad')}if(d.family==='Undead'){let bonus=0;for(let x of allDemons()){if(x.d.id!==d.id&&demonCode(x.d)==='undeadAttack')bonus+=demonValue(x.d)}if(bonus>0){d.status=d.status||{};d.status.attackRoundBonus=(d.status.attackRoundBonus||0)+bonus;log(`${demonName(d)} gains +${bonus} Attack this round from Death Hierophant / Soul Conqueror.`,'bad')}}let f=ensureBossFlags();if(bossIs("crimsonOracle")&&!f.omenUsed){f.omenUsed=true;addBossHpBonus(d,2,"Omen Unbound")}}
function spawnSpecificImp(count=1){let base=DEMON_TYPES[0];for(let i=0;i<count;i++){let d={...base,id:`imp-${uid()}`,greater:false,cur:base.hp,status:{}};if(S.rooms[0].length<4){S.rooms[0].push(d);triggerEnterPlay(d);triggerEnterRoom(d);if(roomDesecrated(0)&&findDemonLocation(d)){d.status=d.status||{};d.status.extraHpBonus=(d.status.extraHpBonus||0)+1;d.cur+=1;log(`${demonName(d)} gains +1 HP from the Desecrated Gateway.`,'bad')}if(roomConsecrated(0)&&findDemonLocation(d))damageDemon(d,1,'Consecrated Gateway');if(findDemonLocation(d))checkMerge(d)}else S.queue.push(d);log(`${d.n} is spawned by a Demon ability.`,'bad')}}

function moveOneForward(d,reason='Demon movement'){let loc=findDemonLocation(d);if(!loc)return false;let r=loc.r;if(r===3){let printed=baseDemonAttack(d),attack=demonAttack(d),code=demonCode(d),v=demonValue(d);S.rooms[3].splice(loc.i,1);addCorruption(3, `${demonName(d)} leaving the Crypt`);let loss=attack;if(code==='altarPlus')loss+=v;if(d.status.ruinBonus&&d.status.ruinRound===S.round)loss+=d.status.ruinBonus;loss=bossBreachBonus(loss);let mod=attack-printed;log(`${demonName(d)} reaches the Altar and attacks for ${attack}${mod?` (${printed}${mod>0?'+':''}${mod})`:''}.`,'bad');damageAltar(loss,`${demonName(d)} attack`);if(code==='attackMove'){let t=closestDemon();if(t){t.status=t.status||{};t.status.attackMoveBonus=(t.status.attackMoveBonus||0)+v;log(`${demonName(d)} attack grants ${demonName(t)} +${v} movement this Demon Phase.`,'bad')}}S.demonDeck.unshift(resetDemon(d));return true}if(S.rooms[r+1].length>=4)return false;S.rooms[r].splice(loc.i,1);addCorruption(r, `${demonName(d)} leaving the ${ROOM_NAMES[r]}`);S.rooms[r+1].push(d);triggerEnterRoom(d);return true}
function resolveStartDemonPhaseAbilities(){let snapshot=allDemons().map(x=>x.d);for(let d of snapshot){let code=demonCode(d),v=demonValue(d);if(code==='spawnImp')spawnSpecificImp(v);else if(code==='phasePush'){let moved=new Set();for(let k=0;k<v;k++){let t=null;for(let r=3;r>=0&&!t;r--){t=S.rooms[r].find(x=>!moved.has(x.id))||null}if(!t)break;moved.add(t.id);log(`${demonName(d)} moves ${demonName(t)} forward 1 room (automatic closest distinct target).`,'bad');moveOneForward(t,`${demonName(d)} ability`)}}}}
function resolveEndDemonPhaseAbilities(){for(let x of allDemons()){let d=x.d;if(demonCode(d)==='endHeal'){let v=demonValue(d),before=d.cur;d.cur=Math.min(demonMaxHP(d),d.cur+v);if(d.cur>before)log(`${demonName(d)} heals ${d.cur-before} HP at the end of the Demon Phase.`,'bad')}}}
function triggerDefeatAbility(d,opts={}){let code=demonCode(d),v=demonValue(d);if(opts.suppressNegative&&['defeatMana','defeatPush','defeatRuin','defeatAttack'].includes(code)){log(`${demonName(d)}'s negative defeat ability is suppressed by the Ritual.`,'good');return}if(code==='defeatBlood'&&!opts.skipBlood){distributeBlood(v);log(`${demonName(d)} ability grants ${v} additional Blood.`,'good')}else if(code==='defeatMana'){addMana(-v);log(`${demonName(d)} ability removes ${v} shared Mana.`,'bad')}else if(code==='defeatPush'){let t=closestDemon(d.id);if(t){log(`${demonName(d)} pushes ${demonName(t)} forward ${v} space${v===1?'':'s'} (automatic next-target choice).`,'bad');for(let i=0;i<v;i++)if(!moveOneForward(t,`${demonName(d)} defeat ability`))break}}else if(code==='defeatRuin'){let t=closestDemon(d.id);if(t){t.status.ruinBonus=(t.status.ruinBonus||0)+v;t.status.ruinRound=S.round;log(`${demonName(t)} gains +${v} Altar damage if it breaches this round.`,'bad')}}else if(code==='defeatAttack'){let t=closestDemon(d.id);if(t){t.status=t.status||{};t.status.attackBonus=(t.status.attackBonus||0)+v;log(`${demonName(d)} grants ${demonName(t)} +${v} Attack until it reaches the Altar.`,'bad')}}}
function resetRoundDemonStatuses(){allDemons().forEach(x=>{delete x.d.status.damageIgnoreUsed;delete x.d.status.stopWardUsed;delete x.d.status.ritualHalfUsed;delete x.d.status.ruinBonus;delete x.d.status.ruinRound;delete x.d.status.attackRoundBonus;delete x.d.status.attackMoveBonus})}
function randomUnit(){
 try{
  if(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==='function'){
   let a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0]/4294967296;
  }
 }catch(e){}
 return Math.random();
}
function shuffle(a){
 // Full Fisher-Yates pass: every card in the supplied deck participates in the shuffle.
 for(let i=a.length-1;i>0;i--){let j=Math.floor(randomUnit()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
 return a;
}
function uid(){return Math.random().toString(36).slice(2,9)}
function log(msg,type="info"){S.log.unshift({msg,type,t:Date.now()}); if(S.log.length>120)S.log.pop(); renderLog();}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function addMana(v){S.mana=clamp(S.mana+v,0,10);render()}
function healAltar(v,source="Altar healing"){
 let bonus=(v>0&&roomConsecrated(2))?1:0;
 let actual=Math.max(0,Math.min(30,S.altar+v+bonus)-S.altar);
 S.altar=clamp(S.altar+v+bonus,0,30);
 if(bonus>0&&actual>0)log(`Consecrated Chapel adds +1 Altar Protection to ${source}.`,'good');
 render();
}
function restoreAltarLogged(v,source){
 let before=S.altar;
 healAltar(v,source);
 let restored=Math.max(0,S.altar-before);
 log(`${source} restores ${restored} Altar Protection.`,'good');
 return restored;
}
function addAltarTurnRenewal(amount,turns,source){
 S.altarTurnRenewals=S.altarTurnRenewals||[];
 S.altarTurnRenewals.push({amount,remaining:turns,source});
 log(`${source} creates a lingering renewal: +${amount} Altar Protection at the start of the next ${turns} Priest turn${turns===1?'':'s'}.`,'good');
}
function resolveAltarTurnRenewals(){
 if(!S.altarTurnRenewals||!S.altarTurnRenewals.length)return;
 for(let fx of S.altarTurnRenewals){
  if(fx.remaining>0){restoreAltarLogged(fx.amount,`${fx.source} lingering renewal`);fx.remaining--}
 }
 S.altarTurnRenewals=S.altarTurnRenewals.filter(fx=>fx.remaining>0);
}
function addAltarDefeatBlessing(amount,charges,source){
 S.altarDefeatBlessings=S.altarDefeatBlessings||[];
 S.altarDefeatBlessings.push({amount,remaining:charges,source});
 log(`${source} blesses the next ${charges} Demon defeat${charges===1?'':'s'}: each restores ${amount} Altar Protection.`,'good');
}
function resolveAltarDefeatBlessings(){
 if(!S.altarDefeatBlessings||!S.altarDefeatBlessings.length)return;
 for(let fx of S.altarDefeatBlessings){
  if(fx.remaining>0){restoreAltarLogged(fx.amount,`${fx.source} defeat blessing`);fx.remaining--}
 }
 S.altarDefeatBlessings=S.altarDefeatBlessings.filter(fx=>fx.remaining>0);
}
function addAltarRoundRenewal(amount,rounds,source){
 S.altarRoundRenewals=S.altarRoundRenewals||[];
 S.altarRoundRenewals.push({amount,remaining:rounds,nextRound:S.round+1,source});
 log(`${source} will restore ${amount} Altar Protection at the start of each of the next ${rounds} round${rounds===1?'':'s'}.`,'good');
}
function resolveAltarRoundRenewals(){
 if(!S.altarRoundRenewals||!S.altarRoundRenewals.length)return;
 for(let fx of S.altarRoundRenewals){
  if(fx.remaining>0&&S.round>=fx.nextRound){
   restoreAltarLogged(fx.amount,`${fx.source} round renewal`);
   fx.remaining--;
   fx.nextRound=S.round+1;
  }
 }
 S.altarRoundRenewals=S.altarRoundRenewals.filter(fx=>fx.remaining>0);
}
function addAltarBarrier(amount,source){
 if(S.altarBarrierRound!==S.round){S.altarBarrier=0;S.altarBarrierRound=S.round}
 S.altarBarrier=(S.altarBarrier||0)+amount;
 log(`${source} wards the Altar against the next ${amount} Protection loss this round.`,'good');
}
function damageAltar(v,source="Demon"){
  v += S.nextAltarBonus; S.nextAltarBonus=0;
  if(S.altarBarrierRound!==S.round)S.altarBarrier=0;
  if(S.altarBarrier>0){let blocked=Math.min(v,S.altarBarrier);v-=blocked;S.altarBarrier-=blocked;log(`Holy Barrier prevents ${blocked} Altar Protection loss. ${S.altarBarrier} ward remains this round.`,"good")}
  if(source==="Demon" && S.altarShield>0){let blocked=Math.min(v,S.altarShield);v-=blocked;S.altarShield-=blocked;log(`Sanctum protection blocks ${blocked} Altar loss.`,"good")}
  if(v>0){S.altar=Math.max(0,S.altar-v);log(`${source} causes ${v} Altar loss.`,"bad")}
  if(S.altar<=0) gameOver(false); render();
}
function buildPriestDeck(){
 // Roguelite starting deck: exactly one copy of each of the 32 Priest cards.
 // Extra copies only enter the run when the player drafts them as rewards.
 let d=PRIEST.map((c,i)=>({...c,id:`p${i}-base-${uid()}`}));
 return shuffle(d);
}
function buildDemonDeck(){
 let d=[];
 DEMON_TYPES.forEach((t,i)=>{for(let j=0;j<4;j++)d.push({...t,id:`d${i}-${j}-${uid()}`,greater:false,cur:t.hp,status:{}})});
 // 25 Demon types × 4 physical copies = exactly 100 cards.
 return shuffle(d);
}
function resetPriestCardForDeck(card){
 if(!card||card.temp)return null;
 let base=PRIEST.find(c=>c.n===card.n);
 if(!base)return {...card,empowered:false,empowerPaid:false,empManaDiscount:0,empBloodDiscount:0};
 return {...base,id:card.id};
}
function returnPriestCardToDiscard(card){
 if(!card||card.temp)return false;
 let reset=resetPriestCardForDeck(card);if(!reset)return false;
 S.priestDiscard.push(reset);return true;
}
function returnPriestCardToBottom(card){
 if(!card||card.temp)return false;
 let reset=resetPriestCardForDeck(card);if(!reset)return false;
 S.priestDeck.unshift(reset);return true;
}
function reshufflePriestAvailable(reason='Priest draw pile exhausted'){
 let pool=[...(S.priestDeck||[]),...(S.priestDiscard||[])].filter(c=>c&&!c.temp&&!String(c.id||'').startsWith('echo-')).map(resetPriestCardForDeck).filter(Boolean);
 if(!pool.length)return false;
 // Preserve physical-card identity and remove only accidental duplicate IDs from legacy saves.
 let seen=new Set();pool=pool.filter(c=>{if(!c||!c.id||seen.has(c.id))return false;seen.add(c.id);return true});
 S.priestDiscard=[];
 S.priestDeck=shuffle(pool);
 S.priestCycleUsed=[];
 log(`${reason}. ${S.priestDeck.length} available Priest cards are fully reshuffled.`);
 return true;
}
function reshuffleDemonCycle(reason='Demon deck cycle complete'){
 if(!S.demonDeck.length)return false;
 S.demonDeck=shuffle(S.demonDeck);
 S.demonCycleUsed=[];
 log(`${reason}. The remaining Demon deck is fully reshuffled.`);
 return true;
}
const HAND_LIMIT=7;
function addPriestToHand(p,card){if(!p||!card)return false;let limit=handLimit();if(p.hand.length>=limit){log(`${p.name} is at the ${limit}-card hand limit. No card is added.`);return false}p.hand.push(card);return true}
function drawPriest(p,n){
 let drawn=0,limit=handLimit();
 S.priestCycleUsed=Array.isArray(S.priestCycleUsed)?S.priestCycleUsed:[];
 for(let i=0;i<n;i++){
  if(p.hand.length>=limit){if(i===0)log(`${p.name} is at the ${limit}-card hand limit and draws no cards.`);else log(`${p.name} reaches the ${limit}-card hand limit; remaining draws are skipped.`);break}
  if(!S.priestDeck.length){if(!reshufflePriestAvailable('Priest draw pile exhausted'))break}
  let used=new Set(S.priestCycleUsed);
  let next=S.priestDeck[S.priestDeck.length-1];
  // A card returned to the bottom of the deck cannot be drawn a second time in the same cycle.
  // Reaching one means every still-unseen card ahead of it has already been drawn, so reshuffle now.
  if(next&&used.has(next.id)){if(!reshufflePriestAvailable('All currently available Priest cards have been seen once this cycle'))break;next=S.priestDeck[S.priestDeck.length-1]}
  let card=S.priestDeck.pop();
  if(!card)break;
  S.priestCycleUsed.push(card.id);
  if(addPriestToHand(p,card))drawn++;
 }
 render();return drawn;
}
function drawDemon(){
 S.demonCycleUsed=Array.isArray(S.demonCycleUsed)?S.demonCycleUsed:[];
 S.demonDiscard=Array.isArray(S.demonDiscard)?S.demonDiscard:[];
 if(!S.demonDeck.length){
  let banishedCount=S.demonDiscard.length;
  S.demonDeck=buildDemonDeck();
  S.demonDiscard=[];
  S.demonCycleUsed=[];
  log(`Demon draw pile exhausted. A fresh 100-card Demon deck is fully reshuffled${banishedCount?`; ${banishedCount} banished card${banishedCount===1?'':'s'} return for the new cycle`:''}.`);
 }
 if(!S.demonDeck.length)return null;
 let used=new Set(S.demonCycleUsed),next=S.demonDeck[S.demonDeck.length-1];
 // Demons that reached the Altar may sit on the bottom by rule, but cannot be drawn twice
 // before the rest of the current Demon cycle has been exhausted.
 if(next&&used.has(next.id)){reshuffleDemonCycle('All Demon cards available in this cycle have been seen once');next=S.demonDeck[S.demonDeck.length-1]}
 let d=S.demonDeck.pop();
 if(d)S.demonCycleUsed.push(d.id);
 return d;
}

const BOSS_BAG_STORAGE_KEY='sanctum-boss-bag-v1';
function secureRandomIndex(max){
 if(max<=1)return 0;
 try{
  if(window.crypto&&window.crypto.getRandomValues){
   const range=0x100000000;
   const limit=range-(range%max);
   const buf=new Uint32Array(1);
   do{window.crypto.getRandomValues(buf)}while(buf[0]>=limit);
   return buf[0]%max;
  }
 }catch(e){}
 return Math.floor(Math.random()*max);
}
function secureShuffle(arr){
 let a=[...arr];
 for(let i=a.length-1;i>0;i--){
  let j=secureRandomIndex(i+1);
  [a[i],a[j]]=[a[j],a[i]];
 }
 return a;
}
function loadBossBag(){
 let keys=BOSSES.map(b=>b.key);
 try{
  let saved=JSON.parse(localStorage.getItem(BOSS_BAG_STORAGE_KEY)||'null');
  if(Array.isArray(saved)){
   saved=saved.filter((k,i)=>keys.includes(k)&&saved.indexOf(k)===i);
   if(saved.length)return saved;
  }
 }catch(e){}
 return secureShuffle(keys);
}
function saveBossBag(bag){
 try{localStorage.setItem(BOSS_BAG_STORAGE_KEY,JSON.stringify(bag))}catch(e){}
}
function drawHiddenBoss(){
 let bag=loadBossBag();
 if(!bag.length)bag=secureShuffle(BOSSES.map(b=>b.key));
 let key=bag.shift();
 saveBossBag(bag);
 let picked=BOSSES.find(b=>b.key===key)||BOSSES[secureRandomIndex(BOSSES.length)];
 return {...picked,cur:null};
}

function drawBossForDescent(excludeKey){
 let keys=BOSSES.map(b=>b.key);
 let bag=loadBossBag();
 if(!bag.length)bag=secureShuffle(keys);
 let idx=bag.findIndex(k=>k!==excludeKey);
 if(idx<0){
   bag=secureShuffle(keys.filter(k=>k!==excludeKey));
   if(!bag.length)bag=[excludeKey];
   idx=0;
 }
 let key=bag.splice(idx,1)[0];
 saveBossBag(bag);
 let picked=BOSSES.find(b=>b.key===key)||BOSSES[secureRandomIndex(BOSSES.length)];
 return {...picked,cur:null};
}



let TURN_TIMER_SECONDS=60;
let turnTimerInterval=null;
let turnTimerDeadline=0;
let turnTimerWaitingForPopup=false;
let turnTimerPausedForSetup=false;
let turnTimeoutInProgress=false;

function updateTurnTimerDisplay(){
 let value=document.getElementById('turnTimerStatValue');
 let stat=document.getElementById('turnTimerStat');
 let fill=document.getElementById('turnTimerFill');
 if(!value||!stat)return;
 stat.classList.remove('warning','critical','lowFill');

 if(!S.started||S.phase!=='Priest'){
  value.textContent='—';
  if(fill)fill.style.height='0%';
  stat.setAttribute('aria-valuenow','0');
  stat.classList.add('lowFill');
  return;
 }

 let seconds=Math.max(0,Math.min(TURN_TIMER_SECONDS,Math.ceil(Number(S.turnTimerRemaining)||0)));
 value.textContent=`${seconds}s`;
 if(fill)fill.style.height=`${(seconds/TURN_TIMER_SECONDS)*100}%`;
 stat.setAttribute('aria-valuenow',String(seconds));
 if(seconds<=30)stat.classList.add('lowFill');
 if(seconds<=5)stat.classList.add('critical');
 else if(seconds<=10)stat.classList.add('warning');
}

function clearTurnTimerInterval(){
 if(turnTimerInterval){
  clearInterval(turnTimerInterval);
  turnTimerInterval=null;
 }
 turnTimerDeadline=0;
}

function turnTimerBlockedByRequiredPopup(){
 let ids=['crucifixModal','relicModal','descendModal','endRunStatsModal'];
 return ids.some(id=>{
  let el=document.getElementById(id);
  return el&&!el.classList.contains('hidden');
 });
}

function pauseTurnTimer(forSetup=false){
 if(S.started&&S.phase==='Priest'&&turnTimerDeadline){
  S.turnTimerRemaining=Math.max(0,Math.ceil((turnTimerDeadline-Date.now())/1000));
 }
 clearTurnTimerInterval();
 if(forSetup)turnTimerPausedForSetup=true;
 updateTurnTimerDisplay();
}

function startTurnTimer(seconds=TURN_TIMER_SECONDS){
 clearTurnTimerInterval();
 turnTimeoutInProgress=false;
 if(window.__sanctumManualPaused||S.manualPaused){updateTurnTimerDisplay();return;}

 if(!S.started||S.phase!=='Priest'){
  turnTimerWaitingForPopup=false;
  updateTurnTimerDisplay();
  return;
 }

 let n=Number.isFinite(seconds)?Math.ceil(seconds):TURN_TIMER_SECONDS;
 n=Math.max(1,Math.min(TURN_TIMER_SECONDS,n));
 S.turnTimerRemaining=n;
 updateTurnTimerDisplay();

 if(turnTimerPausedForSetup)return;

 if(turnTimerBlockedByRequiredPopup()){
  turnTimerWaitingForPopup=true;
  return;
 }

 turnTimerWaitingForPopup=false;
 turnTimerDeadline=Date.now()+n*1000;
 turnTimerInterval=setInterval(tickTurnTimer,200);
}

function resumeTurnTimerIfReady(){
 if(window.__sanctumManualPaused||S.manualPaused){clearTurnTimerInterval();updateTurnTimerDisplay();return;}
 if(!S.started||S.phase!=='Priest'){
  clearTurnTimerInterval();
  turnTimerWaitingForPopup=false;
  updateTurnTimerDisplay();
  return;
 }
 if(turnTimerPausedForSetup||turnTimerBlockedByRequiredPopup()){
  turnTimerWaitingForPopup=true;
  return;
 }
 if(!turnTimerInterval){
  startTurnTimer(S.turnTimerRemaining||TURN_TIMER_SECONDS);
 }
}

function tickTurnTimer(){
 if(window.__sanctumManualPaused||S.manualPaused){clearTurnTimerInterval();updateTurnTimerDisplay();return;}
 if(!S.started||S.phase!=='Priest'){
  clearTurnTimerInterval();
  updateTurnTimerDisplay();
  return;
 }

 // Mandatory Crucifix / Relic / Boss-choice screens must resolve before the
 // next player can act, so the active countdown waits while they are visible.
 if(turnTimerBlockedByRequiredPopup()){
  S.turnTimerRemaining=Math.max(1,Math.ceil((turnTimerDeadline-Date.now())/1000));
  clearTurnTimerInterval();
  turnTimerWaitingForPopup=true;
  updateTurnTimerDisplay();
  return;
 }

 let remaining=Math.max(0,Math.ceil((turnTimerDeadline-Date.now())/1000));
 if(remaining!==S.turnTimerRemaining){
  S.turnTimerRemaining=remaining;
  updateTurnTimerDisplay();
 }

 if(remaining<=0){
  clearTurnTimerInterval();
  handleTurnTimerExpired();
 }
}

function cancelTimedOutPlayerAction(){
 // Trigger the same transaction-cancel path used by the visible Cancel button.
 choiceCancelSerial++;

 if(choiceResolve){
  let resolver=choiceResolve;
  choiceResolve=null;
  document.getElementById('choiceModal').classList.add('hidden');
  try{resolver(null)}catch(e){}
 }

 let reveal=document.getElementById('cardRevealModal');
 let revealClose=document.getElementById('cardRevealClose');
 if(reveal&&!reveal.classList.contains('hidden')&&revealClose){
  try{revealClose.click()}catch(e){reveal.classList.add('hidden')}
 }

 let damageModal=document.getElementById('damageAmountModal');
 let damageCancel=document.getElementById('damageAmountCancel');
 if(damageModal&&!damageModal.classList.contains('hidden')&&damageCancel){
  try{damageCancel.click()}catch(e){damageModal.classList.add('hidden')}
 }

 let consecrate=document.getElementById('consecrateModal');
 if(consecrate&&!consecrate.classList.contains('hidden'))closeConsecrateModal();

 let desecration=document.getElementById('desecrationModal');
 if(desecration&&!desecration.classList.contains('hidden'))closeDesecrationInfo();
}

function discardTimedOutHandOverage(p){
 if(!p||!Array.isArray(p.hand))return;
 let discarded=[];
 while(p.hand.length>handLimit()){
  let c=p.hand.pop();
  if(!c)break;
  returnPriestCardToBottom(c);
  discarded.push(c.n);
 }
 if(discarded.length){
  log(`${p.name} timed out above the hand limit. ${discarded.join(', ')} ${discarded.length===1?'is':'are'} placed on the bottom of the Priest deck.`,'bad');
 }
}

function advanceTurnAfterTimeout(){
 if(!S.started||S.phase!=='Priest')return;
 let p=currentPlayer();
 discardTimedOutHandOverage(p);
 clearTurnTimerInterval();

 if(S.current<S.players.length-1){
  S.current++;
  beginTurn(false);
 }else{
  runDemonPhase();
 }
}

function handleTurnTimerExpired(){
 if(turnTimeoutInProgress||!S.started||S.phase!=='Priest')return;
 turnTimeoutInProgress=true;

 let timedOutIndex=S.current;
 let p=currentPlayer();
 let playerName=p?p.name:`Player ${timedOutIndex+1}`;
 S.turnTimerRemaining=0;
 updateTurnTimerDisplay();

 cancelTimedOutPlayerAction();
 log(`${playerName}'s ${TURN_TIMER_SECONDS}-second turn timer expired. The turn ends automatically.`,'bad');
 showGameStatus(`${playerName}: TIME — turn ended automatically.`,'bad');

 // Give any cancelled async card/Ritual transaction a chance to roll back
 // before advancing to the next player.
 setTimeout(()=>{
  if(S.started&&S.phase==='Priest'&&S.current===timedOutIndex){
   advanceTurnAfterTimeout();
  }
  turnTimeoutInProgress=false;
 },80);
}

function resetTurnTimerForNewTurn(){
 turnTimerPausedForSetup=false;
 S.turnTimerRemaining=TURN_TIMER_SECONDS;
 startTurnTimer(TURN_TIMER_SECONDS);
}

function syncTurnTimerAfterLoad(){
 clearTurnTimerInterval();
 turnTimerPausedForSetup=false;
 turnTimerWaitingForPopup=false;
 turnTimeoutInProgress=false;
 if(S.started&&S.phase==='Priest'){
  let saved=Number.isFinite(S.turnTimerRemaining)?S.turnTimerRemaining:TURN_TIMER_SECONDS;
  startTurnTimer(saved>0?saved:TURN_TIMER_SECONDS);
 }else{
  updateTurnTimerDisplay();
 }
}

function setupPlayersUI(){const n=+document.getElementById('playerCount').value;const area=document.getElementById('setupPlayers');area.innerHTML='';const names=Object.keys(CHARACTERS);for(let i=0;i<n;i++){let div=document.createElement('div');div.className='setupPlayer';div.innerHTML=`<b>Player ${i+1}</b><br><input id="pname${i}" value="Player ${i+1}" style="width:100%;margin:5px 0;background:#0e0d0d;color:white;border:1px solid #594929;padding:6px"><select id="pchar${i}" style="width:100%;background:#0e0d0d;color:white;border:1px solid #594929;padding:6px">${names.map((x,j)=>`<option ${j===i?'selected':''}>${x}</option>`).join('')}</select>`;area.appendChild(div)}}
function syncSetupTimerOption(){let el=document.getElementById('turnTimerSelect');if(el){let n=Number(S?.turnTimerSeconds||TURN_TIMER_SECONDS||60);n=Math.max(30,Math.min(120,Math.round(n/15)*15));el.value=String(n)}}
function startGame(){const n=+document.getElementById('playerCount').value;let chars=[];for(let i=0;i<n;i++)chars.push(document.getElementById(`pchar${i}`).value);if(new Set(chars).size!==chars.length){alert('Choose a different character for each player.');return false}let chosenTimer=Number(document.getElementById('turnTimerSelect')?.value||60);chosenTimer=Math.max(30,Math.min(120,Math.round(chosenTimer/15)*15));S=freshState();S.turnTimerSeconds=chosenTimer;S.turnTimerRemaining=chosenTimer;TURN_TIMER_SECONDS=chosenTimer;S.started=true;S.phase='Priest';S.priestDeck=buildPriestDeck();S.priestCycleUsed=[];S.demonDeck=buildDemonDeck();S.demonCycleUsed=[];resetCrucifixDeck();S.boss=drawHiddenBoss();S.boss.cur=S.boss.hp;S.relicDeck=shuffle(RELICS.map(r=>r.key));for(let i=0;i<n;i++){let p={name:document.getElementById(`pname${i}`).value||`Player ${i+1}`,char:chars[i],blood:0,hand:[],basic:false,ritualUsed:[false,false,false],forceEmpower:false,discardUsed:false,consecrateUsed:false};S.players.push(p);drawPriest(p,4)}for(let i=0;i<normalSpawnCount();i++)spawnOne(false);document.getElementById('setupModal').classList.add('hidden');beginTurn(true);log('The Sanctum is besieged. The first round begins.');render();return true}
function currentPlayer(){return S.players[S.current]}
function beginTurn(skipDraw=false){if(!S.started)return;S.phase='Priest';let p=currentPlayer();p.basic=false;p.ritualUsed=[false,false,false];p.forceEmpower=false;p.discardUsed=false;p.consecrateUsed=false;S.mergeManaDiscount=0;S.mergeBloodDiscount=0;resolveAltarTurnRenewals();if(!skipDraw)drawPriest(p,2);log(`${p.name} (${p.char}) begins a turn.`);render();resetTurnTimerForNewTurn()}
function endTurn(){let p=currentPlayer();if(p.hand.length>handLimit()){alert(`Hand limit is ${handLimit()}. Discard cards before ending your turn.`);return}clearTurnTimerInterval();if(S.current<S.players.length-1){S.current++;beginTurn(false)}else{runDemonPhase()}}
function normalSpawnCount(){
 // During the Boss Stage, normal deck spawns happen every other round.
 // The first Demon Phase after the Boss awakens skips the normal spawn.
 // Boss-specific summons use their own summon functions and are unaffected.
 if(S.bossRevealed&&((S.bossStageRoundsElapsed||0)%2===0))return 0;
 if(S.players.length===1)return 1;
 if(S.players.length===2&&S.bossRevealed)return 1;
 return 2;
}
function runDemonPhase(){clearTurnTimerInterval();S.phase='Demon';S.turnTimerRemaining=TURN_TIMER_SECONDS;log('Demon Phase begins.','bad');render();updateTurnTimerDisplay();setTimeout(()=>{resolveStartDemonPhaseAbilities();moveDemons();const bossStageAtSpawn=S.bossRevealed;const spawnCount=normalSpawnCount();if(bossStageAtSpawn&&spawnCount===0)log('Boss Stage: normal Demon spawning is skipped this round.','info');for(let i=0;i<spawnCount;i++)spawnOne();if(bossStageAtSpawn)S.bossStageRoundsElapsed=(S.bossStageRoundsElapsed||0)+1;resolveEndDemonPhaseAbilities();if(S.bossRevealed)runBossPhase();else endRound()},200)}
function moveDemons(){for(let r=3;r>=0;r--){let room=[...S.rooms[r]];for(let d of room){let locNow=findDemonLocation(d);if(!locNow||locNow.r!==r)continue;let blockedByRoom=S.roomStop[r]&&!stopIsBlocked(d);if(d.status.stop||blockedByRoom){delete d.status.stop;delete d.status.attackMoveBonus;continue}let attackMoveBonus=d.status.attackMoveBonus||0;delete d.status.attackMoveBonus;let moved=moveOneForward(d);if(!moved)continue;let code=demonCode(d),extra=code==='fast'?demonValue(d):0;for(let k=0;k<extra;k++){let loc=findDemonLocation(d);if(!loc)break;if(S.rooms[loc.r].length!==1)break;if(!moveOneForward(d,`${demonName(d)} extra movement`))break}for(let k=0;k<attackMoveBonus;k++){let loc=findDemonLocation(d);if(!loc)break;if(!moveOneForward(d,`${demonName(d)} bonus movement from a Demon attack`))break}}}S.roomStop={};allDemons().forEach(x=>delete x.d.status.attackMoveBonus);render()}
function resetDemon(d){d.greater=false;d.cur=d.hp;d.status={};return d}
function spawnOne(doLog=true){let d=S.queue.length?S.queue.shift():drawDemon();if(!d){if(doLog)log('No Demon card is currently available to spawn.');return}if(S.rooms[0].length>=4){S.queue.push(d);if(doLog)log(`${d.n} waits in the Gate Queue.`,'bad');return}S.rooms[0].push(d);triggerEnterPlay(d);triggerEnterRoom(d);if(roomDesecrated(0)&&findDemonLocation(d)){d.status=d.status||{};d.status.extraHpBonus=(d.status.extraHpBonus||0)+1;d.cur+=1;log(`${demonName(d)} gains +1 HP from the Desecrated Gateway.`,'bad')}if(roomConsecrated(0)&&findDemonLocation(d))damageDemon(d,1,'Consecrated Gateway');if(doLog)log(`${d.n} enters the Gateway.`,'bad');if(findDemonLocation(d))checkMerge(d);render()}
function mergeRogueHpBonus(d){return Math.max(0,Number(d?.status?.rogueHpBonus)||0)}
function mergedDemonStatus(host,donor){
 let a={...(host.status||{})},b={...(donor.status||{})};
 let aExtra=Math.max(0,(a.extraHpBonus||0)-mergeRogueHpBonus(host)),bExtra=Math.max(0,(b.extraHpBonus||0)-mergeRogueHpBonus(donor));
 let out={...a};
 out.extraHpBonus=Math.max(aExtra,bExtra);
 out.bossHpBonus=Math.max(a.bossHpBonus||0,b.bossHpBonus||0);
 for(let k of ['attackBonus','attackRoundBonus','attackMoveBonus','ruinBonus','damageIgnoreUsed','stopWardUsed','ritualHalfUsed'])out[k]=Math.max(a[k]||0,b[k]||0);
 out.bloodDrained=Math.max(0,(a.bloodDrained||0)+(b.bloodDrained||0));
 if(a.abilityRemoved||b.abilityRemoved)out.abilityRemoved=true;
 if(a.stop||b.stop)out.stop=true;
 delete out.rogueScaledFloor;delete out.rogueDifficulty;delete out.rogueFloorHealth;delete out.rogueHpBonus;delete out.noMerge;
 out.mergedThisPhase=true;
 return out;
}
function checkMerge(d){
 if(!d||d.greater||d.status?.noMerge)return false;
 let here=findDemonLocation(d);if(!here)return false;
 let matches=allDemons().filter(x=>x.d.id!==d.id&&!x.d.greater&&!x.d.status?.noMerge&&x.d.key===d.key);
 if(!matches.length)return false;
 // Prefer the room farthest from the Altar: Gateway (0) -> Hall (1) -> Chapel (2) -> Crypt (3).
 matches.sort((a,b)=>a.r-b.r||a.i-b.i);
 let other=matches[0];
 if(S.globalMergeBlock||(S.roomMergeBlock&&(S.roomMergeBlock[here.r]||S.roomMergeBlock[other.r])))return false;
 if(roomConsecrated(3)){log(`Consecrated Crypt prevents two ${d.n} cards from merging this round.`,'good');return false}
 if(S.blockNextMerge){S.blockNextMerge=false;log(`A merge of two ${d.n} cards is prevented.`,'good');return false}
 let host=d,donor=other.d;
 if(other.r<here.r){host=other.d;donor=d}
 let donorLoc=findDemonLocation(donor);if(!donorLoc)return false;
 let status=mergedDemonStatus(host,donor);
 S.rooms[donorLoc.r].splice(donorLoc.i,1);
 if(selectedDemonId===donor.id)selectedDemonId=host.id;
 host.greater=true;host.status=status;
 host.cur=Math.max(1,host.ghp||host.hp||1);
 if(S?.rogue?.enabled&&typeof window.__rogueliteMutateDemon==='function')window.__rogueliteMutateDemon(host);
 host.cur=demonMaxHP(host);
 let loc=findDemonLocation(host),room=loc?ROOM_NAMES[loc.r]:'board';
 log(`Two ${host.n} cards merge in the ${room} and become ${host.g}!`, 'bad');
 return true;
}
function resolveBoardDuplicateMerges(){
 let guard=0,changed=true;
 while(changed&&guard++<20){
  changed=false;
  for(let x of allDemons())if(checkMerge(x.d)){changed=true;break}
 }
}
function bossDrainAmount(){
 if(!S.boss)return 0;
 if(S.players.length<=2)return Math.max(1,S.boss.b-5);
 if(S.players.length===3)return Math.max(1,S.boss.b-2);
 return S.boss.b;
}
async function runBossPhase(){S.phase='Boss';ensureBossFlags();log(`${S.boss.n} begins its Boss Phase.`,"bad");render();if(bossIs("crimsonOracle"))await crimsonProphecy();let drain=bossDrainAmount();damageAltar(drain,`${S.boss.n} Boss Rule (${drain} scaled from ${S.boss.b})`);if(S.altar<=0)return;switch(S.boss.key){case"blackSovereign":spawnBossSummonedLesser(1);break;case"boneKing":recallOldestDefeated();break;case"gatebreaker":spawnBossSummonedLesser(2);break;case"lordOfAsh":spawnBossSummonedLesser(1,true);break;case"dreadReaper":recallOldestDefeated();break;case"devourer":spawnBossSummonedLesser(1);break}if(bossIs("plagueFather"))plagueBloom();endRound()}
function sharedManaRoundValue(){let n=Number(S?.players?.length||1);return n>=4?35:n===3?20:n===2?15:10}
/* Multiplayer Mana gains/losses use the same player-count pool cap as round resets.
   This fixes Mana Blessing and every other addMana() effect still inheriting the old 10-Mana ceiling. */
addMana=function(v){let cap=sharedManaRoundValue();S.mana=clamp(S.mana+v,0,cap);render()}
function endRound(){if(S.altar<=0)return;S.round++;S.mana=sharedManaRoundValue();S.current=0;S.altarBarrier=0;S.altarBarrierRound=0;S.globalMergeBlock=false;S.blockNextMerge=false;S.roomMergeBlock={};S.consecrated=[false,false,false,false];resolveBoardDuplicateMerges();S.players.forEach(p=>{p.ritualUsed=[false,false,false];p.consecrateUsed=false});S.nextRitualFixed=null;resetRoundDemonStatuses();resetBossRoundFlags();resolveAltarRoundRenewals();if(bossIs("fallenSeraph")){S.mana=Math.max(0,S.mana-2);log(`${S.boss.n} — Heresy Unbound removes 2 Mana at the start of the round.`,"bad")}S.phase='Priest';log(`Round ${S.round} begins. Shared Mana is ${S.mana}.`);beginTurn(false)}
function allDemons(){let out=[];S.rooms.forEach((room,r)=>room.forEach(d=>out.push({d,r})));return out}

function snapshotActionState(){return JSON.stringify(S)}
function restoreCancelledAction(snapshot){
 S=JSON.parse(snapshot);
 normalizeSanctumState();
 crucifixDisplayQueue=[];
 ['crucifixModal','relicModal','descendModal'].forEach(id=>{
  let el=document.getElementById(id);
  if(el)el.classList.add('hidden');
 });
 render();
}
function actionWasCancelled(startSerial){return choiceCancelSerial!==startSerial}

function choose(title,items,labelFn){return new Promise(res=>{choiceResolve=res;document.getElementById('choiceTitle').textContent=title;let g=document.getElementById('choiceGrid');g.classList.remove('damageTargetGrid');g.innerHTML='';items.forEach((it,i)=>{let el=document.createElement('div');el.className='choice';el.textContent=labelFn(it,i);el.onclick=()=>{document.getElementById('choiceModal').classList.add('hidden');g.classList.remove('damageTargetGrid');choiceResolve=null;res(it)};g.appendChild(el)});document.getElementById('choiceModal').classList.remove('hidden')})}

function makeVisualDemonTargetCard(x,finish){
 if(x&&(x.kind==='done'||x.done)){
  let el=document.createElement('div');
  el.className='choice damageTargetDone';
  el.textContent=x.label||'DONE — resolve with selected target';
  el.onclick=()=>finish(x);
  return el;
 }
 let isBoss=x&&x.kind==='boss';
 let d=isBoss?x.boss:x&&x.d;
 if(!d)return null;
 let name=isBoss?d.n:demonName(d);
 let art=isBoss?d.art:demonArt(d);
 let hp=isBoss?`${d.cur}/${d.hp}`:`${d.cur}/${demonMaxHP(d)}`;
 let blood=isBoss?d.b:demonBlood(d);
 let atk=isBoss?'—':demonAttack(d);
 let room=isBoss?'BOSS ROOM':ROOM_NAMES[x.r];
 let ability=isBoss?(d.rules||[]).map(r=>`${r[0]}: ${r[1]}`).join(' • '):demonAbility(d);
 let el=document.createElement('button');
 el.type='button';
 el.className=`choice damageTargetCard${!isBoss&&d.greater?' greater':''}${isBoss?' bossTarget':''}`;
 el.setAttribute('aria-label',`Target ${name}, HP ${hp}, ${room}`);
 let family=isBoss?'BOSS':d.family;
 el.innerHTML=`<div class="demonArtWrap"><img class="demonArt" src="${art}" alt="${name}"></div><div class="demonBody"><div class="targetRoomTag">${room}</div><div class="name">${name}</div><div class="demonStats"><span class="hp">HP ${hp}</span><span class="blood">Blood ${blood}</span>${!isBoss?`<span class="attack">Attack ${atk}</span>`:''}</div><div class="familyTag">${family}${!isBoss&&d.greater?' • GREATER':''}</div><div class="abilityText">${ability||'No printed ability.'}</div></div>`;
 el.onclick=()=>finish(x);
 return el;
}
function chooseVisualDemonTargets(title,items){
 return new Promise(res=>{
  choiceResolve=res;
  document.getElementById('choiceTitle').textContent=title;
  let g=document.getElementById('choiceGrid');
  g.innerHTML='';
  g.classList.add('damageTargetGrid');
  const finish=value=>{
   document.getElementById('choiceModal').classList.add('hidden');
   g.classList.remove('damageTargetGrid');
   choiceResolve=null;
   res(value);
  };
  items.forEach(x=>{
   let el=makeVisualDemonTargetCard(x,finish);
   if(el)g.appendChild(el);
  });
  document.getElementById('choiceModal').classList.remove('hidden');
  setTimeout(()=>{let first=g.querySelector('.damageTargetCard,.damageTargetDone');if(first)first.focus()},0);
 });
}

function choosePriestCard(title,items,ownerLabel=''){
 return new Promise(res=>{
  choiceResolve=res;
  document.getElementById('choiceTitle').textContent=title;
  let g=document.getElementById('choiceGrid');
  g.classList.remove('damageTargetGrid');
  g.innerHTML='';
  items.forEach(c=>{
   let el=document.createElement('div');
   el.className='choice priestCardChoice';

   if(ownerLabel){
    let owner=document.createElement('div');
    owner.className='priestChoiceOwner';
    owner.textContent=ownerLabel;
    el.appendChild(owner);
   }

   if(c.empowered){
    let tag=document.createElement('div');
    tag.className='priestChoiceStatus';
    tag.textContent='SOURCE CARD: EMPOWERED';
    el.appendChild(tag);
   }

   let top=document.createElement('div');
   top.className='priestChoiceTop';
   let name=document.createElement('div');
   name.className='priestChoiceName';
   name.textContent=c.n;
   let cost=document.createElement('div');
   cost.className='priestChoiceCost';
   cost.textContent=`${c.m} Mana`;
   top.append(name,cost);
   el.appendChild(top);

   let normal=document.createElement('div');
   normal.className='priestChoiceEffect';
   let nb=document.createElement('b');
   nb.textContent='Normal: ';
   normal.appendChild(nb);
   normal.appendChild(document.createTextNode(c.e||'No normal effect text.'));
   el.appendChild(normal);

   let empowered=document.createElement('div');
   empowered.className='priestChoiceEffect';
   let eb=document.createElement('b');
   eb.textContent='Empowered: ';
   empowered.appendChild(eb);
   empowered.appendChild(document.createTextNode(c.x||'No Empowered effect text.'));
   el.appendChild(empowered);

   el.onclick=()=>{
    document.getElementById('choiceModal').classList.add('hidden');
    choiceResolve=null;
    res(c);
   };
   g.appendChild(el);
  });
  document.getElementById('choiceModal').classList.remove('hidden');
 });
}


function revealedDemonPairHtml(d,index,selectable=false,actionLabel='Put this Demon on top'){
 let order=index===0?'#1 — NEXT TO DRAW':`#${index+1} — DRAW ORDER`;
 return `<div class="revealDemonEntry">
   <div class="revealDrawOrder">${order}</div>
   <div class="deckpair">
     <div class="deckface">
       <img src="${d.art}" alt="${d.n}">
       <b>${d.n}</b>
       <small>${d.family} • HP ${d.hp} • Blood ${d.b} • Attack ${d.atk}</small>
       <p>${d.ability}</p>
     </div>
     <div class="deckarrow">→</div>
     <div class="deckface greater">
       <img src="${d.gart}" alt="${d.g}">
       <b>${d.g}</b>
       <small>${d.family} • HP ${d.ghp} • Blood ${d.gb} • Attack ${d.gatk}</small>
       <p>${d.gability}</p>
     </div>
   </div>
   ${selectable?`<button class="btn green revealPickBtn" data-reveal-pick="${index}">${actionLabel}</button>`:''}
 </div>`;
}
function showRevealedDemonCards(title,cards,opts={}){
 return new Promise(resolve=>{
  let modal=document.getElementById('cardRevealModal');
  let titleEl=document.getElementById('cardRevealTitle');
  let subtitle=document.getElementById('cardRevealSubtitle');
  let grid=document.getElementById('cardRevealGrid');
  let close=document.getElementById('cardRevealClose');
  let selectTop=!!opts.selectTop;
  let selectBanish=!!opts.selectBanish;
  let selectable=selectTop||selectBanish;
  let actionLabel=selectBanish?'Banish this Demon':'Put this Demon on top';

  titleEl.textContent=title;
  subtitle.textContent=opts.subtitle||(
   selectBanish
    ?'Every revealed Demon card is shown in full. Choose one card to banish to the Demon discard pile.'
    :selectTop
     ?'Every revealed Demon card is shown in full. Choose which card should be on top of the Demon deck.'
     :'Every revealed Demon card is shown in full. Card #1 is the next Demon that would be drawn.'
  );
  grid.innerHTML=cards.map((d,i)=>revealedDemonPairHtml(d,i,selectable,actionLabel)).join('');

  let finish=value=>{
   modal.classList.add('hidden');
   close.onclick=null;
   grid.querySelectorAll('[data-reveal-pick]').forEach(b=>b.onclick=null);
   resolve(value);
  };

  if(selectTop){
   close.textContent='Keep Current Top Card';
   close.onclick=()=>finish(0);
   grid.querySelectorAll('[data-reveal-pick]').forEach(btn=>btn.onclick=()=>finish(+btn.dataset.revealPick));
  }else if(selectBanish){
   close.textContent='Cancel';
   close.onclick=()=>finish(null);
   grid.querySelectorAll('[data-reveal-pick]').forEach(btn=>btn.onclick=()=>finish(+btn.dataset.revealPick));
  }else{
   close.textContent='Close';
   close.onclick=()=>finish(null);
  }
  modal.classList.remove('hidden');
  setTimeout(()=>close.focus(),0);
 });
}

function priestDemonVisualTargets(){return allDemons().map(x=>({kind:'demon',...x}))}
async function choosePriestDemonTarget(title='Choose a Demon'){let a=priestDemonVisualTargets();if(!a.length){alert('There are no Demons on the path.');return null}return await chooseVisualDemonTargets(title,a)}
async function choosePriestEligibleDemonTarget(title,items,emptyMessage='There are no valid Demon targets.'){let a=(items||[]).map(x=>x&&x.kind?x:{kind:'demon',...x});if(!a.length){alert(emptyMessage);return null}return await chooseVisualDemonTargets(title,a)}
function damageTargets(){let a=allDemons().map(x=>({kind:'demon',...x}));if(S.bossRevealed&&S.boss&&S.boss.cur>0)a.push({kind:'boss',boss:S.boss});return a}
async function chooseDamageTarget(title='Choose a damage target'){let a=damageTargets();if(!a.length){alert('There are no valid damage targets.');return null}return await chooseVisualDemonTargets(title,a)}
function damageTargetKey(x){return x&&x.kind==='boss'?'boss':x&&x.d?`demon:${x.d.id}`:''}
async function chooseOptionalDistinctDamageTarget(title,usedKeys=new Set(),allowDone=false){
 let a=damageTargets().filter(x=>!usedKeys.has(damageTargetKey(x)));
 if(allowDone)a.push({kind:'done'});
 if(!a.length)return {kind:'done'};
 return await chooseVisualDemonTargets(title,a);
}
const PURIFIABLE_STATUS_GROUPS=[
 {key:'attackBonus',keys:['attackBonus'],label:'Attack bonus'},
 {key:'attackRoundBonus',keys:['attackRoundBonus'],label:'Attack bonus this round'},
 {key:'attackMoveBonus',keys:['attackMoveBonus'],label:'Bonus movement'},
 {key:'ruinBonus',keys:['ruinBonus','ruinRound'],label:'Ruin Altar-damage bonus'},
 {key:'bossHpBonus',keys:['bossHpBonus'],label:'Boss-granted HP bonus'}
];
function removePurifiableStatus(d,g){if(!d||!g)return;g.keys.forEach(k=>delete d.status[k]);d.cur=Math.min(d.cur,demonMaxHP(d));}

function dealDamageTarget(x,amt,source='Effect',opts={}){if(!x||amt<=0)return 0;if(x.kind==='boss'){damageBoss(amt,source,!!opts.ritual);return 0}return damageDemon(x.d,amt,source,opts)}
async function chooseDamageRoom(title='Choose a room to damage'){
 let rooms=['Gateway','Hall','Chapel','Crypt'].map((n,i)=>({n,i,kind:'room'})).filter(x=>S.rooms[x.i].length>0);
 let bossTarget=(S.bossRevealed&&S.boss&&S.boss.cur>0)?{n:'Boss Room',i:4,kind:'boss',boss:S.boss}:null;
 if(!rooms.length&&!bossTarget){alert('There are no occupied rooms or Boss targets to damage.');return null}
 return await new Promise(res=>{
  choiceResolve=res;
  document.getElementById('choiceTitle').textContent=title;
  let g=document.getElementById('choiceGrid');g.innerHTML='';g.classList.add('damageTargetGrid');
  const finish=value=>{document.getElementById('choiceModal').classList.add('hidden');g.classList.remove('damageTargetGrid');choiceResolve=null;res(value)};
  rooms.forEach(x=>{let el=document.createElement('button');el.type='button';el.className='choice damageRoomChoice';el.innerHTML=`<b>${x.n}</b><small>${S.rooms[x.i].length} Demon${S.rooms[x.i].length===1?'':'s'} — damage the whole room</small>`;el.onclick=()=>finish(x);g.appendChild(el)});
  if(bossTarget){let el=makeVisualDemonTargetCard(bossTarget,finish);if(el)g.appendChild(el)}
  document.getElementById('choiceModal').classList.remove('hidden');
  setTimeout(()=>{let first=g.querySelector('button');if(first)first.focus()},0);
 });
}
async function basicAttack(){let p=currentPlayer();if(p.basic)return;let x=await chooseDamageTarget('Basic Attack — choose target');if(!x)return;p.basic=true;dealDamageTarget(x,basicAttackDamage(),`${p.name}'s Basic Attack`);render()}
function queueOverflowDamage(amount,source='Effect',opts={}){amount=Math.floor(amount||0);if(amount<=0)return;overflowDamageQueue.push({amount,source,opts:{ritual:!!opts.ritual,suppressNegativeDefeat:!!opts.suppressNegativeDefeat}});log(`${amount} overkill damage from ${source} is ready to transfer to another Demon.`,'good')}
async function processOverflowDamageQueue(){
 if(overflowPromptActive||!overflowDamageQueue.length)return;
 if([...document.querySelectorAll('.modal:not(.hidden)')].some(el=>el.id!=='choiceModal'))return;
 let item=overflowDamageQueue.shift(),demons=allDemons();
 if(!demons.length){log(`${item.amount} leftover damage from ${item.source} has no other Demon to hit.`);if(overflowDamageQueue.length)setTimeout(processOverflowDamageQueue,0);return}
 overflowPromptActive=true;
 let options=[...demons,{kind:'done',done:true,label:`Discard the ${item.amount} leftover damage`}];
 let pick=await chooseVisualDemonTargets(`${item.source} — ${item.amount} leftover damage`,options);
 overflowPromptActive=false;
 if(!pick||pick.done){log(`${item.amount} leftover damage from ${item.source} is discarded.`);if(overflowDamageQueue.length)setTimeout(processOverflowDamageQueue,0);return}
 damageDemon(pick.d,item.amount,item.source,{...item.opts,allowOverflow:true});
 if(document.getElementById('crucifixModal').classList.contains('hidden')&&overflowDamageQueue.length)setTimeout(processOverflowDamageQueue,0);
}
function damageDemon(d,amt,source='Effect',opts={}){if(d.status.mark){amt+=d.status.mark;log(`A sacred mark adds ${d.status.mark} damage.`,'good');d.status.markCharges=(d.status.markCharges||1)-1;if(d.status.markCharges<=0){delete d.status.mark;delete d.status.markCharges}}let code=demonCode(d),v=demonValue(d);if(code==='ignoreDamage'&&!d.status.damageIgnoreUsed){let blocked=Math.min(amt,v);amt-=blocked;d.status.damageIgnoreUsed=true;log(`${demonName(d)} ignores ${blocked} damage.`,'bad')}if(opts.ritual&&code==='ritualArmor'){let blocked=Math.min(amt,v);amt-=blocked;log(`${demonName(d)} reduces Ritual damage by ${blocked}.`,'bad')}if(amt<=0){render();return 0}let before=d.cur,overflow=Math.max(0,amt-before);d.cur=Math.max(0,d.cur-amt);let dealt=Math.max(0,before-d.cur);S.runStats=S.runStats||{};S.runStats.damageToDemons=(S.runStats.damageToDemons||0)+dealt;log(`${source} deals ${dealt} to ${demonName(d)}.`,'good');if(code==='hurtMana'){addMana(-v);log(`${demonName(d)} causes the shared Mana pool to lose ${v}.`,'bad')}if(d.cur<=0){defeatDemon(d,{suppressNegative:!!opts.suppressNegativeDefeat});if(opts.allowOverflow&&overflow>0)queueOverflowDamage(overflow,source,opts)}render();return overflow}
function findDemonLocation(d){for(let r=0;r<4;r++){let i=S.rooms[r].findIndex(x=>x.id===d.id);if(i>=0)return {r,i}}return null}
function distributeKillBlood(n,killerIndex=null){
 n=Math.max(0,Number(n)||0);
 if(!n||!Array.isArray(S.players)||!S.players.length)return;
 const hasKiller=Number.isInteger(killerIndex)&&killerIndex>=0&&killerIndex<S.players.length;
 const half=n/2;
 let excess=0;
 S.players.forEach((p,i)=>{
  const gain=hasKiller&&i===killerIndex?n:half;
  const before=Math.max(0,Number(p.blood)||0);
  const after=Math.min(10,before+gain);
  p.blood=after;
  excess+=Math.max(0,(before+gain)-10);
 });
 if(excess>0){
  let before=S.altar;
  healAltar(excess);
  log(`${excess} excess Blood restores ${S.altar-before} Altar Protection.`,'good');
 }
 if(hasKiller){
  const killer=S.players[killerIndex];
  log(`${killer?.name||('Player '+(killerIndex+1))} receives ${n} Demon Blood for the killing blow; every other Priest receives ${half}.`,'good');
 }else{
  log(`No Priest landed the killing blow; each Priest receives ${half} Demon Blood.`,'good');
 }
}
function defeatDemon(d,opts={}){let loc=findDemonLocation(d);if(!loc)return;S.rooms[loc.r].splice(loc.i,1);reduceRoomCorruptionOnDemonDefeat(loc.r);S.runStats=S.runStats||{};if(d.greater)S.runStats.greaterDemonsDefeated=(S.runStats.greaterDemonsDefeated||0)+1;let baseBlood=demonBlood(d),extraBlood=demonCode(d)==='defeatBlood'?demonValue(d):0,skipBlood=false,reward=baseBlood;if(bossIs("soulTyrant")&&!d.greater){reward=Math.max(0,baseBlood+extraBlood-1);skipBlood=extraBlood>0;log(`${S.boss.n} — Tyrant's Claim reduces this Lesser Demon's total Blood reward by 1.`,"bad")}distributeKillBlood(reward,S.phase==='Priest'?Number(S.current):null);S.defeats++;S.defeated.push({...d,status:{...d.status}});log(`${demonName(d)} is defeated. Demon Blood is awarded by the multiplayer kill rule. Defeat ${S.defeats}/13.`,'good');resolveAltarDefeatBlessings();if(bossIs("plagueFather")){let f=ensureBossFlags();f.spores[loc.r]=(f.spores[loc.r]||0)+1;log(`${S.boss.n} — Corruption Spores marks ${["Gateway","Hall","Chapel","Crypt"][loc.r]}; the next Demon to enter gains 1 HP.`,"bad")}if(bossIs("devourer")&&!d.greater&&S.boss.cur>0){let before=S.boss.cur;S.boss.cur=Math.min(S.boss.hp,S.boss.cur+1);if(S.boss.cur>before)log(`${S.boss.n} — Feast of Ruin heals the Boss for 1 HP.`,"bad")}triggerDefeatAbility(d,{skipBlood,suppressNegative:!!opts.suppressNegative});if(!S?.rogue?.enabled){drawCrucifix();if(d.greater)rollGreaterDemonRelic();if(S.defeats>=5&&!S.relicFiveDefeatClaimed){S.relicFiveDefeatClaimed=true;pullRelic('Five Demons have been defeated. The Sanctum reveals a hidden Relic.')}}if(S.defeats>=13&&!S.bossRevealed)revealBoss();render()}
function distributeBlood(n){let left=n;let idx=S.current;let safety=0;while(left>0&&safety<100){let p=S.players[idx%S.players.length];if(p.blood<10){p.blood++;left--}idx++;safety++;if(S.players.every(p=>p.blood>=10))break}if(left>0){let before=S.altar;healAltar(left);log(`${left} excess Blood restores ${S.altar-before} Altar Protection.`,'good')}}
function bossHpFactor(){return S.players.length<=2?.70:S.players.length===3?.85:1}
function scaleBossForPlayers(preserveDamage=false){
 if(!S.boss)return;
 let base=S.boss.baseHp||S.boss.hp;
 let factor=bossHpFactor(),scaled=Math.max(1,Math.round(base*factor));
 let oldMax=S.boss.hp||base,oldCur=S.boss.cur==null?oldMax:S.boss.cur;
 S.boss.baseHp=base;
 if(preserveDamage&&oldMax>0&&S.bossRevealed){let ratio=Math.max(0,oldCur/oldMax);S.boss.cur=Math.round(scaled*ratio)}else S.boss.cur=scaled;
 S.boss.hp=scaled;S.boss.scaledForPlayers=S.players.length;
}
function revealBoss(){scaleBossForPlayers(false);S.bossRevealed=true;S.bossStageRoundsElapsed=0;resetBossRoundFlags();if(bossIs("boneKing"))S.rooms[3].forEach(d=>{d.cur+=1;log(`${S.boss.n} — Ossuary Court grants ${demonName(d)} +1 HP in the Crypt.`,"bad")});let pct=Math.round(bossHpFactor()*100);log(`THE BOSS AWAKENS: ${S.boss.n} — ${S.boss.hp} HP (${pct}% HP) • Boss Phase drain ${bossDrainAmount()} (printed ${S.boss.b}).`,'bad');render()}
function showEndRunStatistics(outcome){
 normalizeSanctumState();
 let rs=S.runStats||{};
 let demonDamage=rs.damageToDemons||0;
 let bossDamage=S.bossDamageTotal||0;
 let totalDamage=demonDamage+bossDamage;
 let victory=outcome==='victory';

 document.getElementById('endRunStatsEyebrow').textContent=victory?'Sanctum Saved':'Sanctum Fallen';
 document.getElementById('endRunStatsTitle').textContent='End of Run Statistics';
 document.getElementById('endRunOutcome').textContent=victory
   ?`Victory — ${S.bossesDefeated||1} Boss${(S.bossesDefeated||1)===1?'':'es'} defeated.`
   :'Defeat — the Altar reached 0 Protection.';
 document.getElementById('endRunTotalDamage').textContent=totalDamage;
 document.getElementById('endRunDamageBreakdown').textContent=`${demonDamage} to Demons • ${bossDamage} to Bosses`;
 document.getElementById('endRunRound').textContent=S.round||1;
 document.getElementById('endRunDemons').textContent=S.defeats||0;
 document.getElementById('endRunGreater').textContent=rs.greaterDemonsDefeated||0;
 document.getElementById('endRunBosses').textContent=S.bossesDefeated||0;
 document.getElementById('endRunRelics').textContent=(S.activeRelics||[]).length;
 document.getElementById('endRunAltar').textContent=S.altar||0;
 document.getElementById('endRunCards').textContent=rs.cardsPlayed||0;
 document.getElementById('endRunRituals').textContent=rs.ritualsUsed||0;
 document.getElementById('endRunNatural20s').textContent=rs.natural20s||0;

 S.runStatsShown=true;
 document.getElementById('endRunStatsModal').classList.remove('hidden');
 setTimeout(()=>document.getElementById('endRunStatsClose').focus(),0);
}

function gameOver(win){
 clearTurnTimerInterval();
 if(win){finishSanctumRun();return}
 S.phase='Defeat';
 render();
 if(!S.runStatsShown)setTimeout(()=>showEndRunStatistics('defeat'),100);
}
function bossChoiceBlocked(){
 return (S.relicPopupQueue&&S.relicPopupQueue.length)||
        !document.getElementById('relicModal').classList.contains('hidden')||
        !document.getElementById('crucifixModal').classList.contains('hidden')||
        !document.getElementById('choiceModal').classList.contains('hidden');
}
function showBossVictoryChoice(){
 if(!S.pendingBossChoice||bossChoiceBlocked())return;
 document.getElementById('descendBossName').textContent=`${S.lastDefeatedBossName} has been destroyed.`;
 document.getElementById('descendBossCount').textContent=`Bosses defeated this run: ${S.bossesDefeated}`;
 document.getElementById('descendModal').classList.remove('hidden');
 setTimeout(()=>document.getElementById('descendFurtherBtn').focus(),0);
}
function cleanOldBossEffects(){
 for(let x of allDemons()){
   x.d.status=x.d.status||{};
   delete x.d.status.bossHpBonus;
   // Remove only Boss-specific HP. Persistent non-Boss bonuses such as
   // Desecrated Gateway extra HP must survive a deeper descent.
   let base=x.d.greater?x.d.ghp:x.d.hp;
   let persistentExtra=x.d.status.extraHpBonus||0;
   x.d.cur=Math.min(x.d.cur,base+persistentExtra);
 }
 S.bossFlags={spores:{}};
}
function spawnNextDescentBoss(){
 let oldKey=S.boss&&S.boss.key;
 cleanOldBossEffects();
 S.boss=drawBossForDescent(oldKey);
 S.boss.cur=S.boss.hp;
 S.bossRevealed=true;
 S.bossDefeatHandled=false;
 S.pendingBossChoice=false;
 document.getElementById('descendModal').classList.add('hidden');
 scaleBossForPlayers(false);
 S.bossFlags={spores:{}};
 resetBossRoundFlags();
 if(bossIs("boneKing"))S.rooms[3].forEach(d=>{d.cur=Math.min(demonMaxHP(d),d.cur+1);log(`${S.boss.n} — Ossuary Court grants ${demonName(d)} +1 HP in the Crypt.`,"bad")});
 let pct=Math.round(bossHpFactor()*100);
 let nextNumber=(S.bossesDefeated||0)+1;
 log(`DESCENT ${nextNumber}: ${S.boss.n} emerges in the Boss Room — ${S.boss.hp} HP (${pct}% HP) • Boss Phase drain ${bossDrainAmount()} (printed ${S.boss.b}).`,'bad');
 if(S.phaseBeforeBossChoice)S.phase=S.phaseBeforeBossChoice;
 S.phaseBeforeBossChoice=null;
 render();
}
function finishSanctumRun(){
 clearTurnTimerInterval();
 S.pendingBossChoice=false;
 S.pendingVictory=false;
 S.phaseBeforeBossChoice=null;
 document.getElementById('descendModal').classList.add('hidden');
 S.phase='Victory';
 render();
 if(!S.runStatsShown)setTimeout(()=>showEndRunStatistics('victory'),100);
}
function defeatBossIfNeeded(){
 if(!S.bossRevealed||!S.boss||S.boss.cur>0||S.bossDefeatHandled)return;
 S.bossDefeatHandled=true;
 S.bossesDefeated=(S.bossesDefeated||0)+1;
 S.lastDefeatedBossName=S.boss.n;
 S.phaseBeforeBossChoice=S.phase;
 S.pendingBossChoice=true;
 log(`${S.boss.n} HAS BEEN DEFEATED. Choose whether to save the Sanctum or descend deeper.`,'good');
 render();
 if(bossChoiceBlocked())return;
 setTimeout(showBossVictoryChoice,80);
}
function resolvePriestCardRef(ref,p=currentPlayer()){
 if(!ref)return null;
 if(typeof ref==='string')return p&&p.hand?p.hand.find(c=>c.id===ref)||null:null;
 return ref;
}
function empowerBloodCost(card){
 if(!card)return 0;
 if(Number.isFinite(card.eb))return Math.max(0,card.eb);
 // Empowering already consumes two matching cards, so the Blood surcharge is
 // deliberately much lower than the old 1-for-1 Mana-to-Blood surcharge.
 // 1-Mana cards: 0 Blood; 2-3 Mana: 1 Blood; 4-5 Mana: 2 Blood.
 return Math.max(0,Math.floor((card.m||0)/2));
}
function empowerCard(card){
 let p=currentPlayer();card=resolvePriestCardRef(card,p);if(!card||card.empowered)return;
 let matches=p.hand.filter(x=>x.n===card.n&&!x.empowered);
 if(matches.length<2){alert('You need two matching unempowered cards to Empower.');return}
 // Merging is free. Any merge discounts earned this turn are stored on the
 // Empowered card and applied later, when the card is actually played.
 let savedManaDiscount=S.mergeManaDiscount||0;
 let savedBloodDiscount=S.mergeBloodDiscount||0;
 let pair=matches.slice(0,2),keep=pair[0],sacrifice=pair[1];
 let removeIds=new Set(pair.map(x=>x.id));
 p.hand=p.hand.filter(x=>!removeIds.has(x.id));
 // Keep one of the two real run-deck identities as the Empowered card and send the
 // other real copy to discard. This prevents merges from creating synthetic permanent cards.
 returnPriestCardToDiscard(sacrifice);
 p.hand.push({...keep,empowered:true,empowerPaid:false,empManaDiscount:savedManaDiscount,empBloodDiscount:savedBloodDiscount});
 // Make the newly Empowered card the carousel focus on the next render so it is
 // immediately one of the two full front cards instead of being hidden elsewhere in the hand.
 S._focusHandCardId=keep.id;
 S.mergeManaDiscount=0;S.mergeBloodDiscount=0;
 let pendingMana=Math.max(0,card.m+priestTax()-savedManaDiscount);
 let pendingBlood=Math.max(0,empowerBloodCost(card)-savedBloodDiscount);
 log(`${p.name} merges two ${card.n} cards into an Empowered card. No cost is paid yet; when played it will cost ${pendingMana} Mana${pendingBlood?` + ${pendingBlood} Blood`:''} at the current Priest-card tax.`,'good');
 render();
}
async function playCard(card,emp=false){
 let p=currentPlayer();card=resolvePriestCardRef(card,p);if(!card)return;
 let playerName=p.name;
 let storedEmpowered=!!card.empowered;let forcedEmpower=!!p.forceEmpower&&!storedEmpowered;
 let useEmpowered=storedEmpowered||forcedEmpower||emp;
 // Compatibility: cards Empowered in the immediately previous build may
 // already have their cost paid. New Empowered cards pay only when used.
 let prepaid=storedEmpowered&&card.empowerPaid===true;
 let storedManaDiscount=storedEmpowered?(card.empManaDiscount||0):0;
 let storedBloodDiscount=storedEmpowered?(card.empBloodDiscount||0):0;
 let manaCost=prepaid?0:storedEmpowered
   ?Math.max(0,card.m+priestTax()-storedManaDiscount)
   :Math.max(0,card.m+priestTax());
 let bloodCost=prepaid?0:storedEmpowered
   ?Math.max(0,empowerBloodCost(card)-storedBloodDiscount)
   :(forcedEmpower||emp)?Math.max(0,empowerBloodCost(card)-S.mergeBloodDiscount):0;
 if(S.mana<manaCost){alert(`Not enough shared Mana. This card needs ${manaCost}.`);return}
 if(bloodCost&&p.blood<bloodCost){alert(`Not enough Demon Blood. This card needs ${bloodCost}.`);return}

 // Cards resolve as a transaction. If the player presses Cancel in ANY
 // target/player/room choice opened by this card, the entire action rolls
 // back: no effect, no spent resources, and the card stays in hand.
 let actionSnapshot=snapshotActionState();
 let cancelAtStart=choiceCancelSerial;

 // Temporarily reserve the displayed cost while resolving.
 S.mana-=manaCost;
 if(bloodCost)p.blood-=bloodCost;
 // A card that has been played is no longer occupying a hand slot while its
 // effect resolves. This lets draw effects refill the vacated slot and prevents
 // Crucifix/random-discard effects from discarding the card already being played.
 let pendingIndex=p.hand.findIndex(x=>x.id===card.id);
 let pendingCard=pendingIndex>=0?p.hand.splice(pendingIndex,1)[0]:card;

 let resolved=await resolvePriest(pendingCard,useEmpowered);
 if(!resolved||actionWasCancelled(cancelAtStart)){
   restoreCancelledAction(actionSnapshot);
   log(`${playerName} cancels ${card.n}. Nothing is spent and the card remains in hand.`);
   render();
   return;
 }

 // Holy Echo always refers to the most recently SUCCESSFULLY played non-Echo Priest card.
 // Store only the card definition, not its hand id or paid/Empower bookkeeping.
 if(pendingCard.k!=='echo'){
   const {id,art,empowered,empowerPaid,empManaDiscount,empBloodDiscount,temp,...echoDefinition}=pendingCard;
   S.lastPriestCardPlayed={...echoDefinition};
 }

 p=currentPlayer();
 card=pendingCard;
 S.runStats=S.runStats||{};
 S.runStats.cardsPlayed=(S.runStats.cardsPlayed||0)+1;
 if(forcedEmpower)p.forceEmpower=false;
 returnPriestCardToDiscard(card);
 S.mergeManaDiscount=0;S.mergeBloodDiscount=0;
 let costText=prepaid?' (Empower cost was already paid in an older save)':` for ${manaCost} Mana${bloodCost?` + ${bloodCost} Blood`:''}`;
 log(`${playerName} plays ${useEmpowered?'Empowered ':''}${card.n}${costText}.`,'good');
 render();
}
function drainableDemons(minBlood=1){return allDemons().filter(x=>demonBlood(x.d)>=minBlood)}
function drainBloodFromDemon(d,amount,source="Priest card"){
 let available=demonBlood(d),taken=Math.min(Math.max(0,amount),available);
 if(taken<=0)return 0;
 d.status=d.status||{};
 d.status.bloodDrained=(d.status.bloodDrained||0)+taken;
 distributeBlood(taken);
 log(`${source} drains ${taken} Demon Blood from ${demonName(d)}. ${demonBlood(d)} Blood remains on that Demon.`,'good');
 return taken;
}
async function chooseManaToBloodAmount(cardName,maxMana){
 let spendable=Math.min(maxMana,S.mana-(S.mana%2));
 if(spendable<2){alert(`${cardName} needs at least 2 shared Mana available to convert.`);return null}
 let opts=[];
 for(let mana=2;mana<=spendable;mana+=2)opts.push({mana,blood:mana/2});
 return await choose(`${cardName} — choose how much Mana to convert`,opts,o=>`${o.mana} Mana → ${o.blood} Demon Blood`);
}
async function resolvePriest(c,emp){
 let v=emp?c.xv:c.v;
 switch(c.k){
  case'damage':{
   let x=await chooseDamageTarget(`${c.n} — choose damage target`);
   if(!x)return false;
   dealDamageTarget(x,v,c.n);
   return true;
  }
  case'multiDamage':{
   let used=new Set(),targets=[];
   let first=await chooseOptionalDistinctDamageTarget(`${c.n}: choose target 1 of up to 2`,used,false);
   if(!first||first.kind==='done')return false;
   targets.push(first);used.add(damageTargetKey(first));
   if(damageTargets().some(x=>!used.has(damageTargetKey(x)))){
    let second=await chooseOptionalDistinctDamageTarget(`${c.n}: choose a different second target, or Done`,used,true);
    if(!second)return false;
    if(second.kind!=='done'){targets.push(second);used.add(damageTargetKey(second));}
   }
   targets.forEach(x=>dealDamageTarget(x,v,c.n));
   return targets.length>0;
  }
  case'mark':{
   let x=await choosePriestDemonTarget(`${c.n} — choose Demon`);
   if(!x)return false;
   x.d.status.mark=v;log(`${x.d.n} is marked: next attack +${v}.`);
   return true;
  }
  case'roomDamage':{
   let room=await chooseDamageRoom(`${c.n} — choose room`);
   if(!room)return false;
   if(room.kind==='boss')damageBoss(v,c.n,false);else [...S.rooms[room.i]].forEach(d=>damageDemon(d,v,c.n));
   return true;
  }
  case'purify':{
    let x=await choosePriestEligibleDemonTarget(`${c.n} — choose Demon whose ability will be removed`,allDemons());
    if(!x)return false;
    let d=x.d;
    d.status=d.status||{};
    if(!d.status.abilityRemoved){
     d.status.abilityRemoved=true;
     log(`${c.n} removes ${demonName(d)}'s ability for the rest of its time on the board.`,'good');
    }else{
     log(`${demonName(d)} already has no ability. ${c.n} still deals its damage.`,'good');
    }
    damageDemon(d,v,c.n);
    return true;
   }
  case'peekDemon':{
    let revealed=S.demonDeck.slice(-v).reverse();
    if(!revealed.length){alert(`${c.n} finds no Demon cards to reveal.`);return true}
    log(`${c.n} reveals the next ${revealed.length} Demon card${revealed.length===1?'':'s'}: ${revealed.map(d=>d.n).join(', ')}.`);
    let banishCount=Math.min(revealed.length,emp?(c.xbanish||2):(c.banish||1));
    for(let pickNo=0;pickNo<banishCount;pickNo++){
     let available=revealed.filter(card=>S.demonDeck.some(d=>d&&d.id===card.id));
     if(!available.length)break;
     let picked=await showRevealedDemonCards(`${c.n} — Choose Demon ${pickNo+1} of ${banishCount} to Banish`,available,{
      selectBanish:true,
      subtitle:`Showing the next ${available.length} available Demon card${available.length===1?'':'s'} in draw order. Choose ${banishCount-pickNo} more to banish to the Demon discard pile.`
     });
     if(picked===null||picked===undefined)return false;
     let chosen=available[picked];
     if(!chosen)return false;
     let deckIndex=S.demonDeck.findIndex(d=>d&&d.id===chosen.id);
     if(deckIndex<0)return false;
     let [banished]=S.demonDeck.splice(deckIndex,1);
     S.demonDiscard=Array.isArray(S.demonDiscard)?S.demonDiscard:[];
     S.demonDiscard.push(banished);
     log(`${c.n} banishes ${banished.n} to the Demon discard pile. It cannot be drawn again this Demon deck cycle.`,'good');
    }
    return true;
   }
  case'shield':{let before=S.altar;healAltar(v,c.n);log(`${c.n} restores ${S.altar-before} Altar Protection.`,'good');return true}
  case'altarTurnRenewal':{restoreAltarLogged(v,c.n);addAltarTurnRenewal(emp?c.xregen:c.regen,emp?c.xticks:c.ticks,c.n);return true}
  case'altarBarrier':{restoreAltarLogged(v,c.n);addAltarBarrier(emp?c.xguard:c.guard,c.n);return true}
  case'altarBarrierDamage':{let x=await chooseDamageTarget(`${c.n} — choose damage target`);if(!x)return false;dealDamageTarget(x,v,c.n);addAltarBarrier(emp?c.xguard:c.guard,c.n);return true}
  case'altarDefeatBlessing':{restoreAltarLogged(v,c.n);addAltarDefeatBlessing(emp?c.xdefeatHeal:c.defeatHeal,emp?c.xcharges:c.charges,c.n);return true}
  case'altarDefeatBlessingDamage':{let x=await chooseDamageTarget(`${c.n} — choose damage target`);if(!x)return false;dealDamageTarget(x,v,c.n);addAltarDefeatBlessing(emp?c.xdefeatHeal:c.defeatHeal,emp?c.xcharges:c.charges,c.n);return true}
  case'altarRoundRenewal':{restoreAltarLogged(v,c.n);addAltarRoundRenewal(emp?c.xroundHeal:c.roundHeal,emp?c.xrounds:c.rounds,c.n);return true}
  case'stop':{
   let stopped=0,used=new Set();
   for(let i=0;i<v;i++){
    let opts=allDemons().filter(x=>!used.has(x.d.id));
    if(!opts.length)break;
    let x=await choosePriestEligibleDemonTarget(`${c.n} — choose Demon ${i+1} of ${Math.min(v,allDemons().length)}`,opts);
    if(!x)return false;
    used.add(x.d.id);applyStop(x.d);stopped++;
   }
   return stopped>0;
  }
  case'altar':{restoreAltarLogged(v,c.n);return true;}
  case'altarChoice':{
   let pick=await choose(`${c.n} — choose effect`,[{mode:'heal'},{mode:'damage'}],o=>o.mode==='heal'?`Restore ${v} Altar Protection`:`Deal ${v} damage to a Demon`);
   if(!pick)return false;
   if(pick.mode==='heal'){restoreAltarLogged(v,c.n);return true;}
   let x=await chooseDamageTarget(`${c.n} — choose damage target`);
   if(!x)return false;
   dealDamageTarget(x,v,c.n);
   return true;
  }
  case'execute':{
   let eligible=allDemons().filter(x=>x.d.cur<=v);
   if(!eligible.length){alert(`${c.n} has no valid target. No Demon has ${v} HP or less.`);return false}
   let x=await choosePriestEligibleDemonTarget(`Choose a Demon with ${v} HP or less`,eligible);
   if(!x)return false;
   defeatDemon(x.d);return true;
  }
  case'iron':addAltarBarrier(v,c.n);if(emp)drawPriest(currentPlayer(),1);return true;
  case'mana':addMana(v);return true;
  case'draw':drawPriest(currentPlayer(),v);return true;
  case'sharedDraw':{
   if(S.players.length===1){if(currentPlayer().hand.length>=handLimit()){alert(`${c.n} has no effect because your hand is full.`);return false}drawPriest(currentPlayer(),v);log(`${c.n} affects the solo Priest instead.`,'good');return true}
   let draws=0;
   let opts=S.players.filter((p,i)=>i!==S.current&&p.hand.length<handLimit());
   if(!opts.length){alert(`${c.n} has no eligible player because every other Priest hand is full.`);return false}
   for(let i=0;i<v;i++){
    opts=S.players.filter((p,idx)=>idx!==S.current&&p.hand.length<handLimit());
    if(!opts.length)break;
    let choices=[...opts];if(draws>0)choices.push({done:true,name:'Done',char:''});
    let t=await choose(emp?'Choose a Priest to receive this draw'+(draws?' or Done':''):'Choose another player',choices,p=>p.done?'DONE — resolve current draws':`${p.name} — ${p.char} — Hand ${p.hand.length}/${handLimit()}`);
    if(!t)return false;
    if(t.done)break;
    drawPriest(t,1);draws++;
   }
   return draws>0;
  }
  case'drainBlood':{
   let eligible=drainableDemons(v);
   if(!eligible.length){alert(`${c.n} has no valid target with at least ${v} Demon Blood remaining.`);return false}
   let x=await choosePriestEligibleDemonTarget(`${c.n} — choose a Demon with at least ${v} Blood`,eligible);
   if(!x)return false;
   drainBloodFromDemon(x.d,v,c.n);
   return true;
  }
  case'drainBloodDraw':{
   let eligible=drainableDemons(v);
   if(!eligible.length){alert(`${c.n} has no valid target with at least ${v} Demon Blood remaining.`);return false}
   let x=await choosePriestEligibleDemonTarget(`${c.n} — choose a Demon with at least ${v} Blood`,eligible);
   if(!x)return false;
   drainBloodFromDemon(x.d,v,c.n);
   drawPriest(currentPlayer(),emp?(c.xdraw||2):(c.draw||1));
   return true;
  }
  case'drainBloodMana':{
   let eligible=drainableDemons(v);
   if(!eligible.length){alert(`${c.n} has no valid target with at least ${v} Demon Blood remaining.`);return false}
   let x=await choosePriestEligibleDemonTarget(`${c.n} — choose a Demon with at least ${v} Blood`,eligible);
   if(!x)return false;
   let taken=drainBloodFromDemon(x.d,v,c.n);
   let manaGain=emp?(c.xmanaGain||taken):(c.manaGain||taken);
   addMana(manaGain);
   log(`${c.n} returns ${manaGain} shared Mana to the pool.`,'good');
   return true;
  }
  case'multiDrainBlood':{
   let used=new Set(),drained=0;
   for(let i=0;i<v;i++){
    let opts=drainableDemons(1).filter(z=>!used.has(z.d.id)).map(z=>({kind:'demon',...z}));
    if(!opts.length)break;
    if(drained>0)opts.push({kind:'done'});
    let x=await chooseVisualDemonTargets(`${c.n} — choose Demon ${i+1} of up to ${v}${drained?' or Done':''}`,opts.map(z=>z.kind?z:{kind:'demon',...z}));
    if(!x)return false;
    if(x.kind==='done')break;
    used.add(x.d.id);
    drainBloodFromDemon(x.d,1,c.n);
    drained++;
   }
   if(!drained){alert(`${c.n} has no Demon with Blood remaining to drain.`);return false}
   return true;
  }
  case'manaToBlood':{
   let pick=await chooseManaToBloodAmount(c.n,v);
   if(!pick)return false;
   S.mana-=pick.mana;
   distributeBlood(pick.blood);
   log(`${c.n} converts ${pick.mana} shared Mana into ${pick.blood} Demon Blood.`,'good');
   return true;
  }
  case'echo':{
   let last=S.lastPriestCardPlayed;
   if(!last||last.k==='echo'){
    alert(`${c.n} cannot be used yet.\n\nPlay another Priest card first, then Holy Echo can repeat its effect.`);
    return false;
   }
   let echoEmpowered=!!emp;
   log(`${c.n} echoes ${last.n} using its ${echoEmpowered?'EMPOWERED':'normal'} effect.`,'good');
   let echoed={...last,n:`${c.n} — ${last.n}`};
   return await resolvePriest(echoed,echoEmpowered);
  }
 }
 return true;
}
function discardCard(id){let p=currentPlayer();if(p.discardUsed){alert('You may only discard and redraw once per player turn.');return}let i=p.hand.findIndex(c=>c.id===id);if(i>=0){let c=p.hand.splice(i,1)[0];returnPriestCardToDiscard(c);p.discardUsed=true;log(`${p.name} discards ${c.n} and draws a replacement. This player has used their discard for the turn.`);drawPriest(p,1)}}

function ensureRitualRollPopup(){
 let wrap=document.getElementById('ritualRollOverlay');
 if(wrap) return wrap;
 wrap=document.createElement('div');
 wrap.id='ritualRollOverlay';
 wrap.className='ritualRollOverlay hidden';
 wrap.innerHTML=`<div class="ritualRollCard" role="status" aria-live="polite" aria-atomic="true">
   <div class="ritualRollEyebrow">Ritual Roll</div>
   <h3 class="ritualRollTitle" id="ritualRollTitle">Ritual</h3>
   <div class="ritualRollToastNumber" id="ritualRollNumber">20</div>
   <div class="ritualRollToastMeta" id="ritualRollMeta">Greater effect • Blood Cost: 0</div>
 </div>`;
 document.body.appendChild(wrap);
 return wrap;
}

async function showRitualRollPopup(ritual,roll,opts={}){
 const wrap=ensureRitualRollPopup();
 const card=wrap.querySelector('.ritualRollCard');
 const title=wrap.querySelector('#ritualRollTitle');
 const num=wrap.querySelector('#ritualRollNumber');
 const meta=wrap.querySelector('#ritualRollMeta');
 title.textContent=ritual?.n||'Ritual';
 card.classList.remove('is-final');
 meta.textContent='Rolling…';
 wrap.classList.remove('hidden');
 const totalTicks=10;
 for(let tick=0;tick<totalTicks;tick++){
   num.textContent=String(1+Math.floor(Math.random()*20));
   await new Promise(r=>setTimeout(r, 40 + tick*10));
 }
 num.textContent=String(roll);
 card.classList.add('is-final');
 let label = roll===20 ? 'FREE' : (roll>=10 ? `Greater effect • Blood Cost: ${ritual?.b ?? 0}` : `Lesser effect • Blood Cost: ${ritual?.b ?? 0}`);
 meta.textContent=label;
 await new Promise(r=>setTimeout(r, 2000));
 wrap.classList.add('hidden');
}

function ritualUnavailableReason(r){
 let p=currentPlayer(),demons=allDemons(),targets=damageTargets();
 switch(r.kind){
  case'castHell':case'finalExorcism':case'foretoldDeath':case'crusaderSmite':case'sacredMark':case'abbessRebuke':
   if(!targets.length)return 'There are no valid Demon or Boss targets.';
   break;
  case'severUnholy':
   if(!targets.length)return 'There are no valid Demon or Boss targets.';
   break;
  case'holdLine':case'stillWicked':
   if(!demons.length)return 'There are no Demons on the path.';
   break;
  case'palmJudgment':
   if(!targets.length)return 'There are no valid Demon or Boss targets.';
   break;
  case'chainsFaith':
   if(!demons.some(x=>x.r>0&&S.rooms[x.r-1].length<4))return 'No Demon can be moved backward because every Demon is either in the Gateway or blocked by a full previous room.';
   break;
  case'visionFate':
   if(p.hand.length>=handLimit())return `Your hand is full (${handLimit()}/${handLimit()}).`;
   if(!S.priestDeck.length)return 'There are no Priest cards left in the draw deck to reveal.';
   break;
  case'martyrGuard':
   if(S.altar>=30&&p.blood>=10)return 'The Altar is already at full Protection and you are already at maximum Demon Blood.';
   break;
  case'divineIntervention':
   if(S.altar>=30&&S.mana>=sharedManaRoundValue())return 'The Altar is already at full Protection and the shared Mana pool is already full.';
   break;
  case'innerPeace':
   if(p.blood>=10&&p.hand.length>=handLimit())return 'You are already at maximum Demon Blood and your Priest hand is full.';
   break;
  case'echoedGrace':{
   if(p.hand.length>=handLimit())return `Your hand is full (${handLimit()}/${handLimit()}).`;
   let hasCard=S.players.length===1?p.hand.length>0:S.players.some((x,idx)=>idx!==S.current&&x.hand.length>0);
   if(!hasCard)return 'There is no eligible Priest card available to copy.';
   break;
  }
  case'miracleUnity':{
   let others=S.players.length===1?[p]:S.players.filter((x,idx)=>idx!==S.current);
   if(others.every(x=>x.blood>=10)&&S.altar>=30)return 'All eligible players are at maximum Demon Blood and the Altar is already at full Protection.';
   break;
  }
 }
 return '';
}
function showSkillUnavailable(r,reason){alert(`${r.n} cannot be used right now.\n\n${reason}`)}
async function useRitual(i){
 let p=currentPlayer(),r=CHARACTERS[p.char].rituals[i];
 if(p.ritualUsed&&p.ritualUsed.some(Boolean)){showSkillUnavailable(r,'You may use only 1 Ritual per player turn.');return}
 if(p.blood<r.b){showSkillUnavailable(r,`You need ${r.b} Demon Blood, but you only have ${p.blood}.`);return}
 let unavailable=ritualUnavailableReason(r);if(unavailable){showSkillUnavailable(r,unavailable);return}

 let playerName=p.name;
 let actionSnapshot=snapshotActionState();
 let cancelAtStart=choiceCancelSerial;

 let roll;
 if(S.nextRitualFixed){
  roll=S.nextRitualFixed;
  S.nextRitualFixed=null;
  log(`Rewrite Destiny fixes this Ritual roll at ${roll}.`,'good');
  await showRitualRollPopup(r,roll,{subtitle:'Rewrite Destiny fixes this Ritual roll.'});
 }
 else{
  roll=1+Math.floor(Math.random()*20);
  await showRitualRollPopup(r,roll,{subtitle:'Rolling a d20 to resolve this Ritual.'});
  if((S.ritualRerolls||0)>0&&roll!==20){
   let rerollChoice=await choose(`Ritual roll: ${roll} — Rewrite Destiny reroll available`,[{a:'reroll',label:'Spend 1 reroll and roll again'},{a:'keep',label:`Keep the ${roll}`}],x=>x.label);
   if(!rerollChoice){restoreCancelledAction(actionSnapshot);log(`${playerName} cancels ${r.n} before resolving it. No Blood is spent and the Ritual remains available.`);render();return}
   if(rerollChoice.a==='reroll'){
    S.ritualRerolls--;
    let old=roll;
    roll=1+Math.floor(Math.random()*20);
    log(`Rewrite Destiny rerolls ${old} → ${roll}.`,'good');
    await showRitualRollPopup(r,roll,{subtitle:`Rewrite Destiny reroll — replacing ${old}.`});
   }
  }
 }

 let full=roll>=10;
 let natural20=roll===20;

 full=applyBossRitualRestriction(r,full);
 // Reserve the Ritual cost before resolving so Blood-gain Rituals calculate correctly.
 // True Cancel restores the snapshot, so a cancelled Ritual still costs nothing.
 if(!natural20)p.blood=Math.max(0,p.blood-r.b);
 if(natural20){
  log(`Natural 20! ${r.n} uses its GREATER effect with no Demon Blood cost.`,'good');
 }else{
  log(`${playerName} prepares ${r.n}: d20=${roll} → ${full?'GREATER':'LESSER'} effect.`,'good');
 }

 await resolveRitual(r,full);

 // Pressing the visible in-game Cancel button at any point aborts the
 // entire Ritual, including any earlier selection/effect from a multi-step Ritual.
 if(actionWasCancelled(cancelAtStart)){
  restoreCancelledAction(actionSnapshot);
  log(`${playerName} cancels ${r.n}. No Blood is spent and the Ritual remains available.`);
  render();
  return;
 }

 // Commit Ritual-use state only after successful resolution. Cost was already
 // reserved above; a natural 20 reserved nothing and is therefore fully free.
 p=currentPlayer();
 p.ritualUsed=[true,true,true];
 S.runStats=S.runStats||{};
 S.runStats.ritualsUsed=(S.runStats.ritualsUsed||0)+1;
 if(natural20)S.runStats.natural20s=(S.runStats.natural20s||0)+1;
 log(`${playerName} uses ${r.n}: d20=${roll} → ${full?'GREATER':'LESSER'} effect${natural20?' • FREE':''}.`,'good');
 render();
}
async function resolveRitual(r,full){
 switch(r.kind){
  case'castHell':{let x=await chooseDamageTarget(`${r.n} — choose target`);if(x){if(x.kind==='boss')damageBoss(ritualBoost(full?8:5),r.n,true);else{let halved=ritualIsHalved(x.d),effFull=full&&!halved;damageDemon(x.d,ritualBoost(effFull?8:5),r.n,{ritual:true,suppressNegativeDefeat:effFull,allowOverflow:true})}}break}
  case'severUnholy':{let greater=allDemons().filter(x=>x.d.greater);if(greater.length){let used=new Set(),max=Math.min(ritualScale(1),greater.length);for(let i=0;i<max;i++){let opts=allDemons().filter(x=>x.d.greater&&!used.has(x.d.id));if(!opts.length)break;if(i>0)opts.push({done:true});let x=await chooseVisualDemonTargets(`${r.n} — choose Greater Demon ${i+1} of up to ${max}${i>0?' or Done':''}`,opts.map(z=>z.done?{kind:'done',done:true,label:'DONE — keep the severing already resolved'}:z));if(!x)return;if(x.done)break;used.add(x.d.id);let halved=ritualIsHalved(x.d),effFull=full&&!halved;x.d.greater=false;x.d.cur=Math.min(x.d.cur,x.d.hp);log(`${x.d.n} is severed back to Lesser form.`,'good');if(effFull)damageDemon(x.d,ritualBoost(3),r.n,{ritual:true,allowOverflow:true})}}else{let x=await chooseDamageTarget(`${r.n} — no Greater Demon is present; choose a damage target`);if(x)dealDamageTarget(x,ritualBoost(full?5:3),r.n,{ritual:true,allowOverflow:true})}break}
  case'finalExorcism':{let x=await chooseDamageTarget(`${r.n} — choose target`);if(x){let effFull=full;if(x.kind==='demon'&&ritualIsHalved(x.d))effFull=false;let amount=(effFull?8:4)+(x.kind==='demon'&&x.d.greater?3:0);amount=ritualBoost(amount);dealDamageTarget(x,amount,r.n,{ritual:true,allowOverflow:true})}break}
  case'visionFate':{let reveal=full?ritualScale(6):ritualScale(4),p=currentPlayer(),picks=full?ritualScale(2):ritualScale(1),revealed=S.priestDeck.slice(-reveal);for(let n=0;n<picks;n++){if(p.hand.length>=handLimit()){log(`${p.name} reaches the ${handLimit()}-card hand limit.`);break}let top=revealed.filter(c=>S.priestDeck.some(d=>d.id===c.id));if(!top.length)break;if(n>0){let choice=[...top,{done:true,n:'Done',m:0,e:'Keep the card already chosen and finish Vision of Fate.',x:'',id:'vision-done'}];


let c=await choosePriestCard(`${r.n} — choose card ${n+1} of ${picks}, or Done`,choice,'Revealed from the Priest deck');if(!c)return;if(c.done)break;let idx=S.priestDeck.findIndex(x=>x.id===c.id);if(idx>=0)addPriestToHand(p,S.priestDeck.splice(idx,1)[0])}else{let c=await choosePriestCard(`${r.n} — choose card ${n+1} of ${picks}`,top,'Revealed from the Priest deck');if(!c)return;let idx=S.priestDeck.findIndex(x=>x.id===c.id);if(idx>=0)addPriestToHand(p,S.priestDeck.splice(idx,1)[0])}}break}
  case'foretoldDeath':{let x=await chooseDamageTarget(`${r.n} — choose marked target`);if(x){let effFull=full;if(x.kind==='demon'&&ritualIsHalved(x.d))effFull=false;let bonus=ritualBoost(effFull?6:4);if(x.kind==='boss'){let f=ensureBossFlags();if(bossIs("fallenSeraph")&&!f.seraphHaloUsed){f.seraphHaloUsed=true;bonus=Math.max(1,Math.floor(bonus/2));log(`${S.boss.n} — Profane Halo halves ${r.n}'s mark to +${bonus}.`,"bad")}f.bossMark=bonus;f.bossMarkCharges=ritualScale(1);log(`${S.boss.n} is foretold: next ${f.bossMarkCharges} damage sources +${bonus} each.`,'good')}else{x.d.status.mark=bonus;x.d.status.markCharges=ritualScale(1);log(`${demonName(x.d)} is foretold: next ${x.d.status.markCharges} damage sources +${bonus} each.`,'good')}}break}
  case'rewriteDestiny':if(full){S.nextRitualFixed=ritualScale(15);log(`Rewrite Destiny: the next Ritual used this round will resolve with a roll of ${S.nextRitualFixed}.`,'good')}else{S.ritualRerolls=(S.ritualRerolls||0)+ritualScale(1);log(`Rewrite Destiny banks a Ritual reroll. ${S.ritualRerolls} reroll${S.ritualRerolls===1?' is':'s are'} available.`,'good')}break;
  case'crusaderSmite':{let x=await chooseDamageTarget(`${r.n} — choose target`);if(x){let effFull=full;if(x.kind==='demon'&&ritualIsHalved(x.d))effFull=false;dealDamageTarget(x,ritualBoost(effFull?9:5),r.n,{ritual:true,allowOverflow:true})}break}
  case'holdLine':if(full){await chooseAndStopRooms(r.n,ritualScale(1))}else{await chooseAndStopDemons(r.n,ritualScale(1))}break;
  case'martyrGuard':{let before=S.altar;healAltar(ritualBoost(full?5:3),r.n);log(`${r.n} restores ${S.altar-before} Altar Protection.`,'good');if(full){let p=currentPlayer(),old=p.blood;p.blood=Math.min(10,p.blood+ritualBoost(1));if(p.blood>old)log(`${p.name} gains ${p.blood-old} Demon Blood from ${r.n}.`,'good')}break}
  case'sacredMark':{let x=await chooseDamageTarget(`${r.n} — choose marked target`);if(x){let effFull=full;if(x.kind==='demon'&&ritualIsHalved(x.d))effFull=false;let bonus=ritualBoost(3),charges=effFull?ritualScale(2):ritualScale(1);if(x.kind==='boss'){let f=ensureBossFlags();if(bossIs("fallenSeraph")&&!f.seraphHaloUsed){f.seraphHaloUsed=true;if(charges>1)charges=1;else bonus=Math.max(1,Math.floor(bonus/2));log(`${S.boss.n} — Profane Halo halves ${r.n}.`,"bad")}f.bossMark=bonus;f.bossMarkCharges=charges}else{x.d.status.mark=bonus;x.d.status.markCharges=charges}log(`${x.kind==='boss'?S.boss.n:demonName(x.d)} receives Sacred Mark: +${bonus} damage for the next ${charges} damage source${charges===1?'':'s'}.`,'good')}break}
  case'divineIntervention':{let before=S.altar;healAltar(ritualBoost(full?6:4),r.n);log(`${r.n} restores ${S.altar-before} Altar Protection.`,'good');if(full)addMana(ritualBoost(2));break}
  case'chainsFaith':{let moved=new Set(),max=full?ritualScale(2):ritualScale(1);for(let i=0;i<max;i++){let opts=allDemons().filter(x=>x.r>0&&S.rooms[x.r-1].length<4&&!moved.has(x.d.id));if(!opts.length){if(i===0){log('No Demon can be moved back from its current room.');alert(`${r.n} cannot be used on any current Demon because none can be moved backward.`)}break}if(i>0)opts.push({done:true});let x=await chooseVisualDemonTargets(`${r.n} — choose Demon ${i+1} of ${max}${i>0?' or Done':''}`,opts.map(z=>z.done?{kind:'done',done:true,label:'DONE — keep the movement already resolved'}:z));if(!x)return;if(x.done)break;let halved=ritualIsHalved(x.d);if(halved&&full)max=ritualScale(1);moved.add(x.d.id);await moveDemonBackOne(x.d,r.n)}break}
  case'palmJudgment':{let x=await chooseDamageTarget(`${r.n} — choose target`);if(x){let effFull=full;if(x.kind==='demon'&&ritualIsHalved(x.d))effFull=false;let amount=ritualBoost(effFull?6:3);dealDamageTarget(x,amount,r.n,{ritual:true,allowOverflow:true});if(x.kind==='demon'){let d=x.d,moveSpaces=effFull?2:1;for(let step=0;step<moveSpaces&&findDemonLocation(d);step++){let loc=findDemonLocation(d);if(!loc||loc.r<=0)break;if(!await moveDemonBackOne(d,r.n))break}}}break}
  case'stillWicked':if(full){await chooseAndStopRooms(r.n,ritualScale(1))}else{await chooseAndStopDemons(r.n,ritualScale(1))}break;
  case'innerPeace':{let p=currentPlayer(),gain=ritualBoost(full?3:2),old=p.blood;p.blood=Math.min(10,p.blood+gain);log(`${p.name} gains ${p.blood-old} Demon Blood from ${r.n}.`,'good');if(full)drawPriest(p,ritualScale(1));break}
  case'echoedGrace':{let p=currentPlayer();let others=S.players.length===1?[p]:S.players.filter((x,i)=>i!==S.current&&x.hand.length);if(!others.length){log('No eligible Priest card is available to echo.');alert(`${r.n} cannot be used because there is no eligible Priest card to copy.`);break}let op=S.players.length===1?p:await choose('Choose another player',others,x=>`${x.name} — ${x.char}`);if(!op)break;let used=new Set(),copies=0,maxCopies=ritualScale(1);for(let i=0;i<maxCopies;i++){if(p.hand.length>=handLimit()){log(`${p.name} is at the ${handLimit()}-card hand limit.`);break}let pool=op.hand.filter(c=>!used.has(c.id));if(!pool.length)break;if(i>0)pool=[...pool,{done:true,n:'Done',m:0,e:'Keep the copied card already gained.',x:'',id:'echo-done'}];let c=await choosePriestCard(`${r.n} — choose card ${i+1} of up to ${maxCopies}${i>0?' or Done':''}`,pool,S.players.length===1?`${p.name} — ${p.char}`:`${op.name} — ${op.char}`);if(!c)return;if(c.done)break;used.add(c.id);let clone={...c,id:'echo-'+uid(),temp:true};if(full){clone.empowered=true;clone.empowerPaid=false;clone.empManaDiscount=0;clone.empBloodDiscount=0}else{clone.empowered=false;delete clone.empowerPaid;delete clone.empManaDiscount;delete clone.empBloodDiscount}if(addPriestToHand(p,clone)){copies++;log(`${p.name} receives ${full?'an EMPOWERED • READY':'a normal'} copy of ${c.n}.`,'good')}}if(!copies)log(`${r.n} copies no card.`);break}
  case'abbessRebuke':{let x=await chooseDamageTarget(`${r.n} — choose target`);if(x){let effFull=full;if(x.kind==='demon'&&ritualIsHalved(x.d))effFull=false;dealDamageTarget(x,ritualBoost(effFull?7:4),r.n,{ritual:true,allowOverflow:true})}break}
  case'miracleUnity':{let t;if(S.players.length===1)t=currentPlayer();else{let opts=S.players.filter((p,i)=>i!==S.current);t=await choose(`${r.n} — choose another player`,opts,p=>`${p.name} — ${p.char} — Blood ${p.blood}/10`)}if(t){let old=t.blood;t.blood=Math.min(10,t.blood+ritualBoost(2));log(`${t.name} gains ${t.blood-old} Demon Blood from ${r.n}.`,'good');if(full){let before=S.altar;healAltar(ritualBoost(3),r.n);log(`${r.n} restores ${S.altar-before} Altar Protection.`,'good')}}break}
 }
}
function clearCrucifixChoiceUI(){
 let area=document.getElementById('crucifixChoiceArea');
 if(area){area.innerHTML='';area.classList.add('hidden')}
 let close=document.getElementById('crucifixClose');
 if(close)close.classList.remove('hidden');
}
function renderCrucifixDisplay(item){
 let modal=document.getElementById('crucifixModal'),card=document.getElementById('crucifixCard');
 clearCrucifixChoiceUI();
 card.className='crucifixCard '+(item.t||'double');
 document.getElementById('crucifixType').textContent=item.t==='good'?'Blessing':item.t==='bad'?'Curse':item.t==='cursed'?'CURSED CRUCIFIX':'Double-Edged Event';
 document.getElementById('crucifixName').textContent=item.n;
 document.getElementById('crucifixEffect').textContent=item.txt;
 document.getElementById('crucifixResult').textContent=item.result||'Effect resolved.';
 modal.classList.remove('hidden');
 setTimeout(()=>document.getElementById('crucifixClose').focus(),0);
}
function renderChoiceCrucifix(e){
 let modal=document.getElementById('crucifixModal'),card=document.getElementById('crucifixCard');
 card.className='crucifixCard choice';
 document.getElementById('crucifixType').textContent='Crucifix Choice';
 document.getElementById('crucifixName').textContent=e.n;
 document.getElementById('crucifixEffect').textContent=e.txt;
 document.getElementById('crucifixResult').textContent='Choose one path. The event will not resolve until a choice is made.';
 let close=document.getElementById('crucifixClose');
 close.classList.add('hidden');
 let area=document.getElementById('crucifixChoiceArea');
 area.innerHTML='';
 area.classList.remove('hidden');
 e.choices.forEach((ch,i)=>{
  let btn=document.createElement('button');
  btn.type='button';
  btn.className='crucifixChoice';
  let allowed=!ch.can||ch.can(S);
  btn.disabled=!allowed;
  btn.innerHTML=`<b>${ch.label}</b><span>${ch.desc}${allowed?'':' • Unavailable'}</span>`;
  btn.onclick=()=>{
   if(btn.disabled)return;
   area.querySelectorAll('button').forEach(b=>b.disabled=true);
   let result=ch.fx(S)||`${ch.label} resolved.`;
   log(`CRUCIFIX CHOICE — ${e.n}: ${ch.label}.`,'info');
   render();
   area.classList.add('hidden');
   document.getElementById('crucifixResult').textContent=result;
   close.classList.remove('hidden');
   close.focus();
  };
  area.appendChild(btn);
 });
 modal.classList.remove('hidden');
 let first=[...area.querySelectorAll('button')].find(b=>!b.disabled);
 if(first)setTimeout(()=>first.focus(),0);
}
function showCrucifixCard(e,result=''){
 let item={n:e.n,t:e.t,txt:e.txt,result:result||'Effect resolved.'},modal=document.getElementById('crucifixModal');
 if(!modal.classList.contains('hidden')){crucifixDisplayQueue.push(item);return}
 renderCrucifixDisplay(item);
}
function showChoiceCrucifix(e){
 let modal=document.getElementById('crucifixModal');
 if(!modal.classList.contains('hidden')){crucifixDisplayQueue.push({choiceEvent:e});return}
 renderChoiceCrucifix(e);
}
function closeCrucifixPopup(){
 let modal=document.getElementById('crucifixModal');
 modal.classList.add('hidden');
 clearCrucifixChoiceUI();
 if(crucifixDisplayQueue.length){
  let next=crucifixDisplayQueue.shift();
  if(next&&next.choiceEvent)renderChoiceCrucifix(next.choiceEvent);
  else renderCrucifixDisplay(next);
  return;
 }
 showNextRelicPopup();
 setTimeout(()=>{
  processOverflowDamageQueue();
  if(S.pendingBossChoice&&!bossChoiceBlocked())showBossVictoryChoice();
  resumeTurnTimerIfReady();
 },0);
}
function drawCrucifix(){
 let e=takeCrucifixCard();
 if(e.choice){
  log(`CRUCIFIX — ${e.n}: ${e.txt}`,'info');
  showChoiceCrucifix(e);
  return;
 }
 if((e.t==='bad'||e.t==='cursed')&&S.ignoreNegativeCrucifix>0){
  S.ignoreNegativeCrucifix--;
  log(`CRUCIFIX — ${e.n}: ${e.txt}`,'bad');
  log(`Iron Faith ignores ${e.n}.`,'good');
  render();
  showCrucifixCard(e,'Ignored by Iron Faith — the negative effect did not resolve.');
  return;
 }
 log(`${e.t==='cursed'?'CURSED CRUCIFIX':'CRUCIFIX'} — ${e.n}: ${e.txt}`,(e.t==='bad'||e.t==='cursed')?'bad':e.t==='good'?'good':'info');
 e.fx(S);
 render();
 showCrucifixCard(e,'Effect resolved. Review the game log for any resulting changes.');
}
const SANCTUM_SAVE_KEY='sanctum-save-v2';
const SANCTUM_LEGACY_SAVE_KEY='sanctum-save';
let gameStatusToastTimer=null;

function showGameStatus(message,type='good'){
 let el=document.getElementById('gameStatusToast');
 if(!el)return;
 el.textContent=message;
 el.className=`gameStatusToast ${type}`;
 clearTimeout(gameStatusToastTimer);
 gameStatusToastTimer=setTimeout(()=>el.classList.add('hidden'),2200);
}

function compactSaveJSON(){
 // Artwork is already permanently embedded in this HTML. Saving it again for
 // every Demon/Boss copy can exceed browser storage, especially on iPad.
 return JSON.stringify({
  version:2,
  savedAt:Date.now(),
  state:S
 },(key,value)=>(key==='art'||key==='gart')?undefined:value);
}

function restoreStaticArtwork(){
 const restoreDemon=d=>{
  if(!d||!d.key)return d;
  let base=DEMON_TYPES.find(x=>x.key===d.key);
  if(base){
   d.art=base.art;
   d.gart=base.gart;
  }
  return d;
 };
 if(Array.isArray(S.demonDeck))S.demonDeck.forEach(restoreDemon);
 if(Array.isArray(S.queue))S.queue.forEach(restoreDemon);
 if(Array.isArray(S.defeated))S.defeated.forEach(restoreDemon);
 if(Array.isArray(S.rooms))S.rooms.forEach(room=>{
  if(Array.isArray(room))room.forEach(restoreDemon);
 });
 if(S.boss&&S.boss.key){
  let base=BOSSES.find(x=>x.key===S.boss.key);
  if(base&&base.art)S.boss.art=base.art;
 }
}

function downloadSaveBackup(data){
 try{
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const round=(S&&S.round)||1;
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`Sanctum_Save_Round_${round}_${stamp}.json`;
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{try{URL.revokeObjectURL(url)}catch(e){};a.remove()},1000);
  return true;
 }catch(err){
  console.error('Sanctum backup download failed',err);
  return false;
 }
}
function save(){
 if(!S.started){alert('Start a game before saving.');return false}
 let data;
 try{data=compactSaveJSON()}catch(err){console.error('Sanctum save serialization failed',err);alert('The current game could not be prepared for saving.');return false}
 let browserStored=false;
 try{
  localStorage.setItem(SANCTUM_SAVE_KEY,data);
  try{localStorage.removeItem(SANCTUM_LEGACY_SAVE_KEY)}catch(e){}
  browserStored=localStorage.getItem(SANCTUM_SAVE_KEY)===data;
 }catch(err){console.warn('Browser storage unavailable; using downloadable backup.',err)}
 const backupCreated=downloadSaveBackup(data);
 log(`Game saved — Round ${S.round}, ${S.phase} phase.`,'good');
 const ok=browserStored||backupCreated;
 const message=browserStored&&backupCreated?`Saved ✓  Round ${S.round} • browser + backup file`:browserStored?`Saved ✓  Round ${S.round} • browser`:backupCreated?`Saved ✓  Round ${S.round} • backup file`:`Save failed`;
 showGameStatus(message,ok?'good':'bad');
 let b=document.getElementById('saveBtn');
 if(b){let old=b.textContent;b.textContent=ok?'Saved ✓':'Save Failed';setTimeout(()=>{if(b)b.textContent=old},1500)}
 if(!browserStored&&backupCreated)alert('Browser storage is restricted here, so a save-backup file was created instead. Use Load → Import Save File to restore it later.');
 if(!ok)alert('The game could not be saved in browser storage and the backup file could not be created. No current progress was changed.');
 return ok;
}
function migratePriestBalance(){
 const swaps={"Aegis":"Blessed Steel","Sanctuary":"Sacred Nova","Bulwark":"Wrath of the Saints"};
 const replaceCard=c=>{if(!c)return c;let name=swaps[c.n]||c.n;let def=PRIEST.find(x=>x.n===name);return def?{...def,id:c.id,temp:c.temp}:c};
 S.priestDeck=(S.priestDeck||[]).map(replaceCard);
 S.priestDiscard=(S.priestDiscard||[]).map(replaceCard);
 (S.players||[]).forEach(p=>{p.hand=(p.hand||[]).map(replaceCard);if(typeof p.discardUsed!=='boolean')p.discardUsed=false;if(!Array.isArray(p.ritualUsed))p.ritualUsed=[false,false,false]});if(typeof S.ritualRerolls!=='number')S.ritualRerolls=0;if(typeof S.nextRitualFixed==='undefined')S.nextRitualFixed=null;
 if(S.altarShield>0){S.altar=clamp((S.altar||0)+S.altarShield,0,30);S.altarShield=0;}
 if(!S.bossFlags)S.bossFlags={spores:{}};ensureBossFlags();
 if(S.boss){
   const norm=n=>String(n||"").toLowerCase().replace(/^the\s+/,"").trim();
   const def=BOSSES.find(b=>norm(b.n)===norm(S.boss.n));
   if(def){
     const oldMax=S.boss.hp||S.boss.baseHp||def.hp,oldCur=S.boss.cur==null?oldMax:S.boss.cur,ratio=oldMax>0?Math.max(0,oldCur/oldMax):1;
     S.boss={...def,cur:def.hp,baseHp:def.hp};
     if(S.bossRevealed){scaleBossForPlayers(false);S.boss.cur=Math.max(0,Math.min(S.boss.hp,Math.round(S.boss.hp*ratio)))}else S.boss.cur=S.boss.hp;
   }else{
     if(!S.boss.baseHp)S.boss.baseHp=S.boss.hp;
     if(S.bossRevealed&&S.boss.scaledForPlayers!==S.players.length)scaleBossForPlayers(true);
   }
 }
}
function readBrowserSave(){
 try{
  let raw=localStorage.getItem(SANCTUM_SAVE_KEY),sourceKey=raw?SANCTUM_SAVE_KEY:null;
  if(!raw){raw=localStorage.getItem(SANCTUM_LEGACY_SAVE_KEY);if(raw)sourceKey=SANCTUM_LEGACY_SAVE_KEY}
  return {raw,sourceKey,error:null};
 }catch(error){return {raw:null,sourceKey:null,error}}
}
function browserSaveSummary(){
 const info=readBrowserSave();
 if(!info.raw)return null;
 try{
  const parsed=JSON.parse(info.raw),state=parsed&&parsed.state?parsed.state:parsed;
  if(!state||!Array.isArray(state.players))return null;
  return {round:state.round||1,phase:state.phase||'Unknown',savedAt:parsed&&parsed.savedAt||null};
 }catch(e){return null}
}
function closeLoadChooser(){const m=document.getElementById('loadChooserModal');if(m)m.classList.add('hidden')}
function openLoadChooser(){
 const m=document.getElementById('loadChooserModal'),localBtn=document.getElementById('loadBrowserBtn'),summary=document.getElementById('loadBrowserSummary');
 if(!m)return;
 const s=browserSaveSummary();
 if(localBtn)localBtn.disabled=!s;
 if(summary)summary.textContent=s?`Round ${s.round} • ${s.phase}${s.savedAt?` • ${new Date(s.savedAt).toLocaleString()}`:''}`:'No browser save found in this copy of the game.';
 m.classList.remove('hidden');
}
function applyLoadedSave(raw,sourceLabel='save file',sourceKey=null){
 if(!raw){alert('No save data was provided.');return false}
 if(S.started&&!confirm(`Load this ${sourceLabel}? Your current unsaved progress will be replaced.`))return false;
 let previousStateJSON=null;
 try{previousStateJSON=JSON.stringify(S)}catch(e){}
 try{
  const parsed=JSON.parse(raw);
  const loaded=parsed&&parsed.state?parsed.state:parsed;
  if(!loaded||typeof loaded!=='object'||!Array.isArray(loaded.players))throw new Error('Invalid save data');
  closeTransientModalsForSetup();
  closeLoadChooser();
  if(typeof window.hidePauseOverlay==='function')window.hidePauseOverlay(false);
  S=loaded;
  S.manualPaused=false;
  window.__sanctumManualPaused=false;
  restoreStaticArtwork();
  migratePriestBalance();
  normalizeSanctumState();
  resolveBoardDuplicateMerges();
  selectedDemonId=null;
  crucifixDisplayQueue=[];
  document.getElementById('setupModal').classList.add('hidden');
  let cancel=document.getElementById('setupCancelBtn');if(cancel)cancel.classList.add('hidden');
  log(`Saved game loaded — Round ${S.round}, ${S.phase} phase.`,'good');
  render();
  syncTurnTimerAfterLoad();
  const stamp=parsed&&parsed.savedAt?new Date(parsed.savedAt):null;
  const when=stamp&&!isNaN(stamp)?` • ${stamp.toLocaleString()}`:'';
  showGameStatus(`Loaded ✓  Round ${S.round} • ${S.phase}${when}`,'good');
  if(sourceKey===SANCTUM_LEGACY_SAVE_KEY){try{localStorage.setItem(SANCTUM_SAVE_KEY,compactSaveJSON());localStorage.removeItem(SANCTUM_LEGACY_SAVE_KEY)}catch(e){}}
  if(sourceLabel==='imported save file'){try{localStorage.setItem(SANCTUM_SAVE_KEY,compactSaveJSON())}catch(e){}}
  if(S.pendingBossChoice)setTimeout(showBossVictoryChoice,120);
  return true;
 }catch(err){
  console.error('Sanctum load failed',err);
  if(previousStateJSON){try{S=JSON.parse(previousStateJSON);restoreStaticArtwork();normalizeSanctumState();render();syncTurnTimerAfterLoad()}catch(e){}}
  showGameStatus('Saved game could not be loaded.','bad');
  alert('The selected save appears to be damaged or incompatible. Your current run has been kept.');
  return false;
 }
}
function loadBrowserSave(){
 const info=readBrowserSave();
 if(info.error){alert('Browser save storage is unavailable in this environment. Choose Import Save File instead.');return false}
 if(!info.raw){alert('No browser save was found. Choose Import Save File if you have a backup.');return false}
 return applyLoadedSave(info.raw,'browser save',info.sourceKey);
}
function importSaveFile(){
 const input=document.getElementById('saveFileInput');
 if(!input)return;
 input.value='';
 input.click();
}
function load(){openLoadChooser()}
function boardDemonAbilityText(d){
 if(!d)return '';
 if(d.status&&d.status.abilityRemoved)return 'Ability Removed';
 let base=(typeof DEMON_TYPES!=='undefined'&&Array.isArray(DEMON_TYPES))
   ? DEMON_TYPES.find(x=>x&&x.key===d.key)
   : null;
 let text=d.greater
   ? ((base&&base.gability)||d.gability||'')
   : ((base&&base.ability)||d.ability||'');
 return text||'No printed ability.';
}
function render(){normalizeSanctumState();document.getElementById('roundStat').textContent=S.round;updateTurnTimerDisplay();document.getElementById('manaStat').textContent=S.mana;let manaBox=document.getElementById('manaStatBox'),manaFill=document.getElementById('manaOrbFill'),manaCap=typeof sharedManaRoundValue==='function'?sharedManaRoundValue():10;if(manaFill)manaFill.style.height=`${clamp(S.mana,0,manaCap)/manaCap*100}%`;if(manaBox){manaBox.setAttribute('aria-valuenow',S.mana);manaBox.setAttribute('aria-valuemax',manaCap);manaBox.classList.toggle('empty',S.mana<=0)}document.getElementById('altarStat').textContent=S.altar;let altarBox=document.getElementById('altarStatBox'),altarFill=document.getElementById('altarMeterFill');if(altarFill)altarFill.style.height=`${clamp(S.altar,0,30)/30*100}%`;if(altarBox){altarBox.setAttribute('aria-valuenow',S.altar);altarBox.classList.toggle('empty',S.altar<=0)}document.getElementById('defeatStat').textContent=`${S.defeats} / 13`;
 for(let r=0;r<4;r++){
   let el=document.getElementById(`room${r}`);
   el.innerHTML=S.rooms[r].map(d=>`<div class="demon ${d.greater?'greater':''} ${selectedDemonId===d.id?'selected':''}" data-demon="${d.id}" data-key="${d.key}"><button type="button" class="mpDemonTapTarget" data-demon-open="${d.id}" aria-label="Open ${demonName(d)} card"></button><div class="demonArtWrap"><img class="demonArt" decoding="async" fetchpriority="high" src="${demonArt(d)}" alt="${demonName(d)}"></div><div class="demonBody"><div class="name">${demonName(d)}</div><div class="demonStats" aria-label="Health ${d.cur}, Demon Blood ${demonBlood(d)}, Attack ${demonAttack(d)}"><span class="hp" title="Health"><span class="statLabel">HP</span><span class="statValue">${d.cur}</span></span><span class="blood" title="Demon Blood"><span class="statLabel">BLD</span><span class="statValue">${demonBlood(d)}</span></span><span class="attack" title="Attack"><span class="statLabel">ATK</span><span class="statValue">${demonAttack(d)}</span></span></div><div class="familyTag">${d.family}${d.greater?' • GREATER':''}</div><div class="abilityText">${boardDemonAbilityText(d)}</div></div></div>`).join('')||'<div class="cap">Empty</div>';
   let roomEl=el.closest('.room');
   if(roomEl){
     roomEl.classList.toggle('desecrated',roomDesecrated(r));
     roomEl.classList.toggle('consecrated',roomConsecrated(r));
   }
   let meta=document.getElementById(`roomMeta${r}`);
   if(meta)meta.innerHTML=`<div class="cap">${roomStateHtml(r)}</div><button class="btn" data-cons="${r}">Consecrate</button>`;
 }
 document.querySelectorAll('[data-demon-open]').forEach(btn=>{let lastOpen=0;const open=e=>{if(e){e.preventDefault();e.stopPropagation()}let now=Date.now();if(now-lastOpen<350)return;lastOpen=now;selectedDemonId=btn.dataset.demonOpen;if(typeof window.__sanctumOpenDemonReader==='function')window.__sanctumOpenDemonReader(btn.dataset.demonOpen)};btn.onclick=open;btn.ontouchend=open;btn.onpointerup=open;});
 document.querySelectorAll('[data-cons]').forEach(el=>el.onclick=()=>openConsecrateModal(+el.dataset.cons));
 document.querySelectorAll('[data-desecrate-info]').forEach(el=>el.onclick=e=>{e.stopPropagation();openDesecrationInfo(+el.dataset.desecrateInfo)});
 renderBoss();renderPlayer();renderLog()
}
function renderBoss(){let a=document.getElementById('bossArea');if(!S.bossRevealed){a.innerHTML='<div class="cap">The Boss awakens after the 13th base Demon is defeated.</div>';return}let rules=(S.boss.rules||[]).filter(x=>x[0]!=="Boss Rule").map(x=>`<div><b>${x[0]}:</b> ${x[1]}</div>`).join("");a.innerHTML=`<div class="bossCard"><img class="bossArt" src="${S.boss.art}" alt="${S.boss.n}"><div class="bossName">${S.boss.n}</div><div class="bossSubtitle">${S.boss.subtitle||""}</div><div class="bossAbilityMini"><b>Descent:</b> Boss ${(S.bossesDefeated||0)+1} • ${S.bossesDefeated||0} defeated this run</div><div class="bossStatLine" aria-label="Boss stats"><span class="hp">HP ${S.boss.cur}/${S.boss.hp}</span><span class="bossStatSep" aria-hidden="true">•</span><span class="blood">Blood Power ${S.boss.b}</span></div><div class="bossAbilityMini">${rules}</div><div class="bossAbilityMini">${S.boss.baseHp&&S.boss.baseHp!==S.boss.hp?`Player-scaled HP: ${S.boss.hp} from ${S.boss.baseHp} printed HP.`:""}</div><div class="bossAbilityMini"><b>Boss Phase Altar Drain:</b> ${bossDrainAmount()}${bossDrainAmount()!==S.boss.b?` (scaled from printed ${S.boss.b})`:''}</div></div>`}
function renderPlayer(){
 let handEl=document.getElementById('handContent'),ritualEl=document.getElementById('ritualContent');
 if(!S.started||!S.players.length){if(handEl)handEl.innerHTML='Start a new game to draw your Priest hand.';if(ritualEl)ritualEl.innerHTML='Start a new game to view your Rituals.';return}
 let p=currentPlayer(),ch=CHARACTERS[p.char],tax=priestTax();
 let counts={};p.hand.forEach(c=>{if(!c.empowered)counts[c.n]=(counts[c.n]||0)+1});
 if(handEl){
   handEl.innerHTML=`${relicSummaryHtml()}${tax?`<div class="notice"><b>Priest Mana Tax:</b> Priest cards currently cost +${tax} shared Mana from Possessors and/or a Desecrated Chapel.</div>`:''}<div class="hand">${p.hand.map(c=>{let canEmp=!c.empowered&&counts[c.n]>=2;let empMana=c.empowered&&c.empowerPaid!==true?Math.max(0,c.m+tax-(c.empManaDiscount||0)):0;let empBlood=c.empowered&&c.empowerPaid!==true?Math.max(0,empowerBloodCost(c)-(c.empBloodDiscount||0)):0;let costLabel=c.empowered?(c.empowerPaid===true?'PAID':(empBlood?`${empMana}M + ${empBlood}B`:`${empMana}M`)):c.m+tax;let artSrc=PRIEST_CARD_ARTS[c.n]||c.art||priestArtByName['Guardian Prayer']||'';let artHtml=artSrc?`<div class="cardArt${c.n==='Divine Wrath'?' divineWrathArt':''}" style="background-image:url('${artSrc}')"></div>`:'';return `<div class="card ${c.empowered?'empoweredCard':canEmp?'empowerable':''}">${artHtml}<div class="cost">${costLabel}</div><div class="cardBottom">${c.empowered?'<div class="empoweredTag">EMPOWERED • READY</div>':''}<h4>${c.n}</h4>${c.empowered?`<p><b>Empowered Effect:</b> ${c.x}</p><p><small>${c.empowerPaid===true?'Empower cost was already paid.':'Merge was free. Pay '+empMana+' Mana'+(empBlood?' + '+empBlood+' Blood':'')+' when you play this card.'}</small></p>`:`<p>${c.e}</p><p><b>Empowered:</b> ${c.x}</p>`}<div class="actions"><button class="btn blue" data-play="${c.id}">Play</button>${canEmp?`<button class="btn red" data-emp="${c.id}">Empower</button>`:''}<button class="btn" data-disc="${c.id}" ${p.discardUsed?'disabled title="Discard already used this turn"':''}>Discard</button></div></div></div>`}).join('')}</div>`;
 }
 let ritualSpent=p.ritualUsed&&p.ritualUsed.some(Boolean),slot=`Player ${S.current+1}`,displayPlayer=p.name&&p.name!==slot?`${slot} • ${p.name}`:slot;
 if(ritualEl){
   ritualEl.innerHTML=`<div class="ritualTracker"><span class="badge">Demon Blood: <b>${p.blood}/10</b></span><span class="badge">Hand: <b>${p.hand.length}/${handLimit()}</b></span><span class="badge">Discard: <b>${p.discardUsed?'Used':'Ready'}</b></span><span class="badge">Ritual: <b>${ritualSpent?'Used':'Available'}</b></span><span class="badge">Ritual Power: <b>+${(S.relicMods&&S.relicMods.ritual)||0}</b></span><button class="btn red trackerAction" id="basicBtn" ${p.basic?'disabled':''}>${p.basic?'Basic Attack Used':`Basic Attack (${basicAttackDamage()})`}</button><button class="btn green trackerAction" id="endBtn">End Turn</button><span class="playerTurnTag"><b>${displayPlayer}</b><small>${p.char}</small></span></div><h3 class="ritualTitleWithBlood"><span>Rituals</span><span class="ritualBloodGauge" role="meter" aria-label="Demon Blood" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${Math.max(0,Math.min(10,p.blood||0))}" title="Demon Blood ${Math.max(0,Math.min(10,p.blood||0))}/10"><span class="ritualBloodGaugeFill" style="width:${Math.max(0,Math.min(10,p.blood||0))*10}%"></span><em>${Math.max(0,Math.min(10,p.blood||0))}/10</em></span></h3><div class="rituals">${ch.rituals.map((r,i)=>`<div class="ritual ${ritualSpent?'used':''}"><b>${r.n}</b> — ${r.b} Demon Blood<small><b>Lesser (1–9):</b> ${r.h}<br><b>Greater (10–19):</b> ${r.f}<br><b class="ritualFreeRoll">Free - (20)</b></small><button class="btn" data-rit="${i}">${ritualSpent?'Ritual Used — Tap for reason':'Roll d20 & Use'}</button></div>`).join('')}</div>`;
 }
 if(ritualEl){let basic=ritualEl.querySelector('#basicBtn'),endBtn=ritualEl.querySelector('#endBtn');if(basic)basic.onclick=basicAttack;if(endBtn)endBtn.onclick=endTurn;ritualEl.querySelectorAll('[data-rit]').forEach(b=>b.onclick=()=>useRitual(+b.dataset.rit));}
 if(handEl){handEl.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playCard(b.dataset.play));handEl.querySelectorAll('[data-emp]').forEach(b=>b.onclick=()=>empowerCard(b.dataset.emp));handEl.querySelectorAll('[data-disc]').forEach(b=>b.onclick=()=>discardCard(b.dataset.disc));}
}
function renderLog(){let el=document.getElementById('log');el.innerHTML=S.log.map(x=>`<div class="${x.type}">${x.msg}</div>`).join('')}
function askDamageAmount(targetName){return new Promise(resolve=>{let modal=document.getElementById('damageAmountModal'),input=document.getElementById('damageAmountInput'),target=document.getElementById('damageAmountTarget'),apply=document.getElementById('damageAmountApply'),cancel=document.getElementById('damageAmountCancel');document.getElementById('damageAmountTitle').textContent='Manual Damage';target.textContent=`Target: ${targetName}`;input.value='1';let finish=value=>{modal.classList.add('hidden');apply.onclick=null;cancel.onclick=null;input.onkeydown=null;resolve(value)};apply.onclick=()=>{let n=Math.floor(Number(input.value));if(!Number.isFinite(n)||n<1){input.focus();return}finish(Math.min(n,9999))};cancel.onclick=()=>finish(null);input.onkeydown=e=>{if(e.key==='Enter')apply.click();else if(e.key==='Escape')cancel.click()};modal.classList.remove('hidden');setTimeout(()=>{input.focus();input.select()},0)})}
async function manualDamage(){let target=await chooseDamageTarget('Manual Damage — choose a Demon or Boss');if(!target)return;let name=target.kind==='boss'?target.boss.n:(target.d.greater?target.d.g:target.d.n);let n=await askDamageAmount(name);if(n!==null)dealDamageTarget(target,n,'Manual damage')}
function manualKill(){let target=allDemons().find(x=>x.d.id===selectedDemonId);if(target)defeatDemon(target.d);else alert('Click a Demon first.')}

const topMenuBar=document.getElementById('topMenuBar');const menuToggleBtn=document.getElementById('menuToggleBtn');if(menuToggleBtn&&topMenuBar){menuToggleBtn.onclick=()=>{const minimized=topMenuBar.classList.toggle('minimized');menuToggleBtn.textContent=minimized?'Show Menu ▼':'Hide Menu ▲';menuToggleBtn.setAttribute('aria-expanded',String(!minimized));}};
function closeTransientModalsForSetup(){
 choiceCancelSerial++;
 if(choiceResolve){
  let resolver=choiceResolve;
  choiceResolve=null;
  try{resolver(null)}catch(e){}
 }
 crucifixDisplayQueue=[];
 selectedDemonId=null;
 [
  'choiceModal','damageAmountModal','descendModal','relicModal',
  'desecrationModal','consecrateModal','crucifixModal',
  'cardRevealModal','demonDeckModal','bossDeckModal','rulesModal',
  'newGameConfirmModal'
 ].forEach(id=>{
  let el=document.getElementById(id);
  if(el)el.classList.add('hidden');
 });
}

function openNewGameSetup(){
 if(!S.started){
  showNewGameSetup();
  return;
 }
 pauseTurnTimer(true);
 document.getElementById('newGameConfirmModal').classList.remove('hidden');
 setTimeout(()=>document.getElementById('restartGameConfirmBtn').focus(),0);
}

function showNewGameSetup(){
 pauseTurnTimer(true);
 closeTransientModalsForSetup();
 let count=document.getElementById('playerCount');
 if(S.started&&S.players.length>=1&&S.players.length<=4)count.value=String(S.players.length);
 setupPlayersUI();
 let cancel=document.getElementById('setupCancelBtn');
 if(cancel)cancel.classList.toggle('hidden',!S.started);
 document.getElementById('setupModal').classList.remove('hidden');
}

function cancelNewGameSetup(){
 if(!S.started)return;
 document.getElementById('setupModal').classList.add('hidden');
 let cancel=document.getElementById('setupCancelBtn');
 if(cancel)cancel.classList.add('hidden');
 showGameStatus('New Game cancelled — current run kept.','good');
 render();
 turnTimerPausedForSetup=false;
 resumeTurnTimerIfReady();
}

document.getElementById('playerCount').onchange=setupPlayersUI;
document.getElementById('startBtn').onclick=()=>{
 let wasStarted=S.started;
 let started=startGame();
 if(!started)return;
 let cancel=document.getElementById('setupCancelBtn');
 if(cancel)cancel.classList.add('hidden');
 showGameStatus(wasStarted?'New game started.':'Game started.','good');
};
document.getElementById('setupCancelBtn').onclick=cancelNewGameSetup;
document.getElementById('restartGameConfirmBtn').onclick=()=>{
 document.getElementById('newGameConfirmModal').classList.add('hidden');
 showNewGameSetup();
};
document.getElementById('restartGameCancelBtn').onclick=()=>{
 document.getElementById('newGameConfirmModal').classList.add('hidden');
 showGameStatus('Restart cancelled — current run kept.','good');
 turnTimerPausedForSetup=false;
 resumeTurnTimerIfReady();
};
document.getElementById('newGameBtn').onclick=openNewGameSetup;
document.getElementById('saveBtn').onclick=save;
document.getElementById('loadBtn').onclick=load;document.getElementById('spawnBtn').onclick=()=>spawnOne();document.getElementById('crucifixBtn').onclick=drawCrucifix;document.getElementById('damageBtn').onclick=manualDamage;document.getElementById('killBtn').onclick=manualKill;document.querySelectorAll('[data-adjust]').forEach(b=>b.onclick=()=>{let v=+b.dataset.val;if(b.dataset.adjust==='altar'){if(v>0)healAltar(v);else damageAltar(-v,'Manual')}else addMana(v)});document.getElementById('choiceCancel').onclick=()=>{choiceCancelSerial++;document.getElementById('choiceModal').classList.add('hidden');document.getElementById('choiceGrid').classList.remove('damageTargetGrid');if(choiceResolve){let r=choiceResolve;choiceResolve=null;r(null)}};
document.getElementById('crucifixClose').onclick=closeCrucifixPopup;
document.getElementById('relicClose').onclick=closeRelicPopup;
document.getElementById('descendFurtherBtn').onclick=spawnNextDescentBoss;
document.getElementById('saveSanctumBtn').onclick=finishSanctumRun;
document.getElementById('endRunStatsClose').onclick=()=>document.getElementById('endRunStatsModal').classList.add('hidden');
document.getElementById('desecrationClose').onclick=closeDesecrationInfo;
document.getElementById('consecrateClose').onclick=closeConsecrateModal;
document.getElementById('consecratePlay').onclick=()=>{if(pendingConsecrateRoom!==null)consecrateRoom(pendingConsecrateRoom)};
document.getElementById('rulesBtn').onclick=()=>document.getElementById('rulesModal').classList.remove('hidden');document.getElementById('rulesClose').onclick=()=>document.getElementById('rulesModal').classList.add('hidden');document.getElementById('rulesText').innerHTML=`<p><b>Round:</b> Shared Mana resets by player count: 10 in solo, 15 with 2 players, 20 with 3 players, and 35 with 4 players. Each player draws 2 cards, takes a turn, then Demons move and new Demons spawn (1 in solo; normally 2 with 2–4 players, except 2-player Boss rounds spawn 1). If the Boss is revealed, it acts after the Demon Phase.</p><p><b>Solo mode:</b> Choose 1 player at setup. Effects that normally require another player target the solo Priest instead, so support cards and Abbess Rituals remain usable.</p><p><b>Player turn:</b> Each Priest has <b>60 seconds</b> to complete their turn. The countdown resets to 60 seconds when the next Priest begins. At 0, any unfinished card/Ritual targeting is cancelled and rolled back, then that Priest’s turn ends automatically. If the timed-out Priest is somehow above the hand limit, excess cards are placed on the bottom of the Priest deck before play advances. Mandatory Crucifix, Relic, and Boss-choice popups pause the next active countdown until they are resolved. Use a Basic Attack once for a base 2 damage (plus any permanent Relic bonus), play Priest cards with shared Mana, and choose and use only 1 of your three Rituals. Once per player turn, you may manually discard 1 Priest card and immediately draw 1 replacement. To Empower, combine two matching unempowered Priest cards. Merging costs nothing and creates one <b>EMPOWERED • READY</b> card in your hand. Do not pay its Empower cost until you actually play it. Empowered cards now keep the normal card’s Mana cost and use a reduced Blood surcharge: <b>0 Blood for 1-Mana cards, 1 Blood for 2–3 Mana cards, and 2 Blood for 4–5 Mana cards</b>. Blood-harvesting and Mana-to-Blood cards have <b>no Empower Blood surcharge</b>, so they never spend the resource they are meant to generate. Any displayed discounts still apply.</p><p><b>Priest deck balance:</b> In online multiplayer, each player contributes one complete set of every Priest card plus 15 randomized duplicate Priest cards to the shared starting draw deck. The full combined deck is shuffled before play, creating more matching-card opportunities for Empowering. Extra copies gained through run rewards are still shuffled into the remaining draw pile. The seven added Blood cards introduce Demon-Blood draining and Mana-to-Blood conversion. Empowered effects were rebalanced so merges are a meaningful upgrade rather than an expensive substitute for simply playing two normal copies. Altar-restoration cards now use distinct defensive patterns instead of all being flat heals: Divine Shield creates a short renewal that continues for its full duration, Holy Barrier now mixes offense with prevention, Shield of Faith now mixes direct damage with upcoming defeat-based healing, and Consecration can flex between healing or direct damage while Circle of Protection restores more Protection across future rounds.</p><p><b>Demon merge balance:</b> All 25 Demon card types were checked for a valid Greater form. Duplicate Lesser cards now merge directly from the board instead of consuming Defeated-row trophies. The merge uses the printed Greater artwork, HP, Blood, Attack, and ability; existing ability removal, stops, Blood already drained, and relevant combat bonuses carry into the merged Demon so merging cannot cleanse a weakened or modified copy.</p><p><b>Echoed Grace:</b> Cards created by Echoed Grace are temporary copies, not additional permanent cards in the Priest run deck. They may be played or merged normally while in hand, but vanish instead of entering the Priest draw/discard piles when they leave the hand.</p><p><b>Holy Echo:</b> Holy Echo repeats the most recently successfully played non-Holy Echo Priest card without paying that card’s original Mana or Blood cost. Normal Holy Echo repeats that card’s normal effect; Empowered Holy Echo repeats its Empowered effect. All secondary parameters of that card—such as delayed healing, wards, defeat-triggered healing, and round-based renewal—are preserved when echoed. If the repeated effect requires a target or choice, make those choices again. Holy Echo itself is never stored as the next Echo target, preventing Echo loops.</p><p><b>Cancel:</b> The Cancel button in any card or Ritual target/room/player selection is a true abort. The entire attempted action is rolled back: the Priest card stays in hand, Mana/Blood is not spent, the Ritual remains unused, and any partial effect from earlier selections in that same action is undone.</p><p><b>Rituals:</b> Rituals cost Demon Blood only and never use shared Mana. Each player may use only 1 Ritual per turn; after one is successfully resolved, the other two lock until that player’s next turn. All Rituals that deal direct damage may target the Boss once it is revealed. Ritual effects in this build are increased by <b>20%</b> and rounded up to whole numbers. <b>d20:</b> 1–9 Lesser effect; 10–19 Greater effect; a natural 20 uses the Greater effect with <b>no Demon Blood cost</b>. A natural 20 never costs Altar Protection.</p><p><b>Ritual overkill damage:</b> Only damaging Rituals can transfer leftover damage. When a damaging Ritual defeats a normal Demon with damage left over, the leftover damage is saved. After that defeat’s Crucifix and Relic popups resolve, choose another Demon to receive the leftover damage or discard it. If that transfer also defeats a Demon with damage remaining, the overkill can continue again. Basic Attacks and Priest cards do not transfer leftover damage.</p><p><b>Removing Demon abilities:</b> Purifying Flame permanently removes the targeted normal Demon’s printed ability while that Demon remains on the board. Its Attack, HP, Blood value, movement, and Greater/Lesser form are unchanged unless another effect modifies them. If that Demon later merges into its Greater form, the removed-ability state remains.</p><p><b>Target selection:</b> Whenever a card, Ritual, manual damage action, or other ability asks you to target a Demon or Boss, the selection popup shows the actual current Demon/Boss cards with artwork, HP, Blood, Attack, room, and ability text. Click the card itself to choose that target.</p><p><b>Card reveals and card-viewing effects:</b> Whenever a card, Ritual, or Boss effect tells you to reveal or look at cards, all affected cards are shown together in a popup with their complete information. Priest cards show Mana cost plus their Normal and Empowered effects. Demon cards show artwork, HP, Blood, Attack, printed ability, and both Lesser and Greater faces before play continues. <b>Abbess:</b> Sacred Rebuke is her offensive Ritual: Lesser deals 5 damage to a Demon or Boss; Greater deals 9. Ritual Power applies normally.</p><p><b>Demon path:</b> Gateway → Hall → Chapel → Crypt → attack the Altar. Rooms hold 4 Demons. When a Demon leaves a room while moving toward the Altar, that room gains 1 <b>Corruption</b>. Each room now has a different Desecration requirement: <b>Gateway 3</b>, <b>Hall 4</b>, <b>Chapel 5</b>, and <b>Crypt 6</b>. Once a room reaches its own requirement it becomes <b>Desecrated</b>. Defeating a Demon inside Gateway, Hall, Chapel, or Crypt removes <b>1 Corruption tracker</b> from that room. After Desecration has triggered, the room stays Desecrated while it has 1 or more Corruption trackers. When its tracker reaches <b>0 Corruption</b>, the Desecration is completely cleared: its penalty ends and the visual cracks disappear. The room can become Desecrated again later if Corruption reaches its threshold again. Desecrated rooms have special penalties: <b>Gateway</b> gives newly spawned Demons +1 HP, <b>Hall</b> gives Demons entering it +1 Attack this round, <b>Chapel</b> adds +1 to the Mana tax on Priest cards, and <b>Crypt</b> heals Demons entering it for 1. When a Demon reaches the Altar, its current <b>Attack</b> is applied automatically as Altar loss, including automatic Attack bonuses from Demon abilities. Demon Blood is normally the reward value gained when that Demon is defeated. Blood drained by a Priest card is removed from that Demon immediately, so drained Blood cannot be collected again when it is later defeated. Normal spawning is 1 Demon per round in solo. With 2 players, spawn 2 Demons per round before the Boss appears, then 1 Demon on normal-spawn rounds once the Boss is revealed. With 3–4 players, spawn 2 Demons on normal-spawn rounds. During the Boss Stage, normal Demon spawning occurs every other round, beginning with a skipped normal spawn on the first Demon Phase after the Boss awakens. Boss-specific summoned Demons are unaffected and still spawn normally. Whenever two copies of the same Lesser Demon card are on the board, they immediately merge into that card's Greater form. If they are in different rooms, the Greater Demon remains in the room farthest from the Altar. Merge-prevention effects and Boss-summoned no-merge Demons still work normally.</p><p><b>Blood-drain Priest cards:</b> Blood Tithe, Crimson Siphon, Leech Rite, and Essence Decanter can drain Demon Blood directly from normal Demons. The drained amount is immediately awarded through the normal Blood distribution rules and permanently reduces that Demon’s remaining Blood reward. Mana Distillation, Altar Exchange, and Sanguine Channel convert shared Mana into Demon Blood at exactly <b>2 Mana per 1 Blood</b>. When one of those conversion cards is played, a popup requires the player to choose the amount of Mana to convert before the effect resolves; Cancel rolls the whole card play back.</p><p><b>Consecration:</b> During the Priest phase, the active player may consecrate 1 room on their turn by spending <b>3 shared Mana + 1 Demon Blood</b>. Consecrating a room cleanses all of its Corruption trackers and lasts until the round ends. Because this reduces the room to 0 Corruption, it also clears any active Desecration, removing that room’s Desecration penalty and cracks. Consecrated rooms grant bonuses: <b>Gateway</b> deals 1 damage to newly spawned Demons, <b>Hall</b> stops Demons that enter it, <b>Chapel</b> adds +1 to all Altar-healing effects, and <b>Crypt</b> prevents Demon merges while consecrated.</p><p><b>Defeat:</b> Blood is distributed among players (max 10); overflow restores Altar up to 30. In Roguelite mode, defeating a Demon no longer draws a Crucifix card. Each Demon kill instead grants <b>Relic XP equal to the total Demon Blood earned from that kill</b>; Blood-drained from a Demon before death therefore cannot also become kill XP later.</p><p><b>Relics:</b> The 22-card Relic deck includes Cinderbrand and Serpent's Fang alongside the original Relics. Automatic Relics are experience-based in Roguelite mode. The first XP Relic requires <b>15 Relic XP</b>. After an XP-earned Relic is claimed, the next requirement increases by 5: <b>20, 25, 30, 35…</b>. XP progress resets toward the new requirement while any overflow XP carries over. Relics deliberately chosen as a reward after clearing a room or Boss do <b>not</b> raise this XP requirement. The former 5-defeat Relic, 25-Boss-damage Relics, and 33% Greater-Demon Relic roll are disabled in Roguelite mode.</p><p><b>Deck randomization:</b> A new run builds and fully shuffles a <b>32-card Priest deck</b> containing exactly one copy of every Priest card. Opening hands and all normal draws come randomly from that shared run deck without replacement during a deck cycle. Played/discarded Priest cards wait in the discard pile until the draw pile reaches a reshuffle point. When a Priest-card reward is drafted, one new permanent copy is added to this run and immediately shuffled into the remaining draw pile, making it eligible for future random draws. Cards returned to the bottom of the Priest deck are not allowed to repeat during that same cycle. Empowering two matching Priest cards consumes two real run-deck copies and never creates an extra permanent card. The Demon deck remains a fully shuffled <b>100-card deck</b> (25 Demon types × 4 copies), with the same no-repeat cycle rules.</p><p><b>Demon deck:</b> The digital deck uses the 25 Demon types from the five created Demon sheets, four copies each. Each board Demon shows its printed ability and current Attack. Movement, Mana, healing, damage-reduction, Altar-loss, spawning, merge-related, and Attack-based abilities resolve automatically. Death Hierophant/Soul Conqueror buffs newly entering Undead for the round; Moonfang/Bloodhowl checks its room when it attacks; Cultist/Blood Cultist buffs the next Demon when defeated; Gatekeeper/Hell Gatekeeper boosts Demons in its room; and Infernal Bone Drake/Apocalypse Drake grants the next Demon bonus movement after attacking.</p><p><b>Official Boss deck:</b> One of the 10 official Boss Demons is secretly drawn from a shuffled Boss bag at setup. A Boss will not repeat until all 10 have been used; after that, the full 10-Boss bag reshuffles. Its printed Boss Rule and compatible named abilities are automated, including summoning, defeated-row recall, Mana pressure, Blood reduction, room HP effects, extra breach damage, Ritual restrictions, damage prevention, and healing. Once the Boss is revealed, it appears directly in damage target menus for Basic Attack, Priest damage cards, multi-target damage, room-damage cards, and damage Rituals. For manual adjustments, use the existing <b>Manual Damage</b> control and select the Boss as the target.</p><p><b>Boss scaling:</b> Boss HP is scaled when revealed: 70% of printed HP in solo or with 2 players, 85% with 3 players, and 100% with 4 players. Boss Phase Altar drain is also player-scaled in the digital game: in solo or with 2 players, reduce printed drain by 5 (minimum 1); with 3 players, reduce it by 2 (minimum 1); with 4 players, use the full printed drain. Blood Power itself is unchanged.</p><p><b>Descending Further:</b> When a Boss is defeated, a choice popup appears. Choose <b>Save the Sanctum</b> to end the run in victory, or <b>Descend Further</b> to keep the current run and immediately spawn another Boss. Altar Protection, Priest hands, Demon Blood, active Relics, Corruption, Consecration, Demon positions, defeated Demons, and cumulative Boss-damage Relic progress all carry forward. Temporary effects belonging specifically to the defeated Boss are cleared before the next Boss enters.</p><p><b>End-of-run statistics:</b> When the run ends in Victory or Defeat, a results screen shows total damage dealt, damage to Demons, damage to Bosses, Round reached, Demons defeated, Greater Demons defeated, Bosses defeated, Relics recovered, Altar Protection remaining, Priest cards played, Rituals used, and Natural 20s.</p><p><b>Victory:</b> Defeat at least one Boss and choose <b>Save the Sanctum</b>. <b>Loss:</b> Altar reaches 0 at any point, including during deeper descents.</p><p><b>Game Menu, Save & Load:</b> Press <b>Tab</b> to open the single Game Menu; opening it automatically pauses the game and freezes the current Priest turn timer. The menu contains New Game, Save, Load, and Resume. Save stores a compact browser save when browser storage is available and also creates a portable JSON backup file. Load lets you restore either the browser save or import one of those backup files, which is useful when running the standalone HTML from Files/iOS where browser storage can be restricted.</p><p><b>Systems audit:</b> This build was checked across all 32 Priest cards, 18 character Rituals, 25 Demon types, 10 Bosses, and 20 Relics. Fixes include Chapel Desecration tax, true-cancel reroll handling, optional second selections, distinct Infernal Mage targets, backward-movement room-entry effects, Demon Overlord Ritual defenses, correct Fire Imp summoning, Boss-cleanup HP preservation, played-card hand-slot timing, merged-Demon bonus preservation, effective-max-HP healing, queued Crucifix displays after multi-kills, synchronized Corruption/Desecration cleansing, temporary Echoed Grace copy cleanup, and 60-second timer-state normalization.</p>`;
function renderDemonCodex(){let el=document.getElementById('demonDeckGrid');if(!el)return;el.innerHTML=DEMON_TYPES.map(d=>`<div class="deckpair"><div class="deckface"><img loading="lazy" decoding="async" fetchpriority="low" src="${d.art}" alt="${d.n}"><b>${d.n}</b><small>${d.family} • HP ${d.hp} • Blood ${d.b} • Attack ${d.atk}</small><p>${d.ability}</p></div><div class="deckarrow">→</div><div class="deckface greater"><img loading="lazy" decoding="async" fetchpriority="low" src="${d.gart}" alt="${d.g}"><b>${d.g}</b><small>${d.family} • HP ${d.ghp} • Blood ${d.gb} • Attack ${d.gatk}</small><p>${d.gability}</p></div></div>`).join('')}
document.getElementById('demonDeckBtn').onclick=()=>{renderDemonCodex();document.getElementById('demonDeckModal').classList.remove('hidden')};
document.getElementById('demonDeckClose').onclick=()=>document.getElementById('demonDeckModal').classList.add('hidden');
function renderBossCodex(){let el=document.getElementById('bossDeckGrid');if(!el)return;el.innerHTML=BOSSES.map(b=>`<div class="bossDeckCard"><img loading="lazy" decoding="async" fetchpriority="low" src="${b.art}" alt="${b.n}"><div class="bossDeckMeta"><b>${b.n}</b> • HP ${b.hp} • Blood ${b.b}<br><small>${b.subtitle}</small></div></div>`).join("")}
document.getElementById('bossDeckBtn').onclick=()=>{renderBossCodex();document.getElementById('bossDeckModal').classList.remove('hidden')};
document.getElementById('bossDeckClose').onclick=()=>document.getElementById('bossDeckModal').classList.add('hidden');
setupPlayersUI();syncSetupTimerOption();let initialSetupCancel=document.getElementById('setupCancelBtn');if(initialSetupCancel)initialSetupCancel.classList.add('hidden');render();updateTurnTimerDisplay();
