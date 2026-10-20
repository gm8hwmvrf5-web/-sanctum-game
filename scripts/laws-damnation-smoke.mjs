import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Focused Laws of Damnation checks. No full game audit.
const js=fs.readFileSync('src/js/89-laws-damnation.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const mp=fs.readFileSync('src/js/60-multiplayer.js','utf8');
const rogue=fs.readFileSync('src/js/30-roguelite.js','utf8');
const engine=fs.readFileSync('src/js/10-engine.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const S={started:false,rogue:{enabled:true,floor:1},rooms:[[],[],[],[]],
 players:[{name:'Monk',blood:4}],activeRelics:[],round:1,phase:'Priest',
 mana:10,altar:20,current:0,queue:[],relicDeck:[],consecrated:[false,false,false,false]};
const logs=[];let seq=0,route=0,checkpoint=0,offerUi=null,usedDamage=0,bloodAward=0;
const modal={dataset:{},classList:{contains:cls=>cls==='hidden'}};
const document={getElementById:id=>id==='rogueChoiceModal'?modal:null};
const timers=new Map();
const ctx={S,document,Math,window:null,ROOM_NAMES:['Gateway','Hall','Chapel','Crypt'],
 setTimeout(fn,ms){const id=++seq;timers.set(id,fn);return id},
 clearTimeout(id){timers.delete(id)},
 clearTurnTimerInterval(){},
 resumeTurnTimerIfReady(){},
 render(){},
 log:(...args)=>logs.push(args),
 demonName:d=>d.n||d.key,
 uid:()=>String(++seq),
 roomConsecrated:i=>!!S.consecrated[i],
 findDemonLocation:d=>{for(let r=0;r<4;r++){const i=S.rooms[r].findIndex(x=>x.id===d?.id);if(i>=0)return{r,i}}return null},
 allDemons:()=>S.rooms.flatMap((room,r)=>room.map((d,i)=>({d,r,i}))),
 demonBlood:d=>d.b||0,
 demonMaxHP:d=>d.hp+(d.status?.extraHpBonus||0),
 demonAttack:d=>(d.atk||0)-(d.status?.wardAttackReduction||0),
 spawnOne(){const d={id:'s'+(++seq),key:'d'+seq,n:'Demon',hp:10,ghp:16,cur:10,atk:3,b:2,status:{},greater:false};S.rooms[0].push(d);return d},
 placeEnteringDemon(d){S.rooms[0].push(d);return 0},
 triggerEnterRoom(){},
 dealDamageTarget(x,amt){usedDamage=amt;if(x.kind==='demon')x.d.cur-=amt;return amt},
 damageDemon(d,amt){d.cur-=amt;if(d.cur<=0){const loc=ctx.findDemonLocation(d);if(loc)S.rooms[loc.r].splice(loc.i,1)}return amt},
 defeatDemon(d){const loc=ctx.findDemonLocation(d);if(loc)S.rooms[loc.r].splice(loc.i,1);return true},
 distributeKillBlood(n){bloodAward+=n},
 damageAltar(n){S.altar-=n},
 healAltar(n){S.altar+=n},
 addMana(n){S.mana+=n},
 sharedManaRoundValue:()=>10,
 consecrateUnavailableReason:()=>'',consecrateRoom(i){S.mana-=3;S.consecrated[i]=true;return true},openConsecrateModal(){},
 endRound(){S.round++;S.phase='Priest';S.consecrated=[false,false,false,false];return true},
 startGame(){S.started=true;S.rogue={enabled:true,floor:1};S.phase='Priest';return true},
};
ctx.window=ctx;
ctx.__sanctumLawShowChoice=(...args)=>{offerUi=args};
ctx.__sanctumLawResumeRoute=()=>{route++};
ctx.__sanctumLawResumeCycleCheckpoint=()=>{checkpoint++};
vm.createContext(ctx);
vm.runInContext(js,ctx,{timeout:5000});
const laws=ctx.__sanctumLaws;
assert.equal(laws.definitions.length,12,'Twelve distinct Laws must be available');
assert.equal(new Set(laws.definitions.map(x=>x.key)).size,12);
assert.equal(ctx.startGame(),true);
assert.equal(S.phase,'Law Draft','New game must wait for the Law choice');
assert.equal(S.rogue.laws.offer.kind,'start');
assert.equal(S.rogue.laws.offer.keys.length,3);
assert.equal(new Set(S.rogue.laws.offer.keys).size,3,'Offer three unique random Laws');
laws.showPending();
assert.equal(offerUi[3].length,3,'Exactly three startup buttons');
assert(offerUi[3].every(x=>x.actionKey.startsWith('law:')));
assert.equal(S.rogue.laws.active.length,0,'Offer must not pre-activate a Law');
assert(!ctx.__sanctumLawChoose('invalid'),'Cannot choose unoffered Law');
const first=S.rogue.laws.offer.keys[0];
assert(ctx.__sanctumLawChoose(first));
assert.equal(S.phase,'Priest','Combat resumes after selection');
assert.equal(S.rogue.laws.offer,null);
assert.equal(S.rogue.laws.active.length,1);
assert.equal(S.rogue.laws.active[0],first);
S.rogue.floor=5;S.bossDefeatHandled=true;
assert.equal(ctx.__sanctumLawInterceptRoute(),true,'Boss one triggers Law choice');
assert.equal(S.rogue.laws.offer.keys.length,2);
assert(S.rogue.laws.offer.keys.every(x=>x!==first),'New Law offers exclude active Laws');
assert(ctx.__sanctumLawChoose(S.rogue.laws.offer.keys[0]));
assert.equal(route,1);
assert.equal(ctx.__sanctumLawInterceptRoute(),false,'Boss Law choice cannot repeat');
S.rogue.floor=10;S.bossDefeatHandled=true;
assert.equal(ctx.__sanctumLawInterceptRoute(),true,'Boss two triggers Law choice');
assert(ctx.__sanctumLawChoose(S.rogue.laws.offer.keys[0]));
assert.equal(S.rogue.laws.active.length,3);
assert.equal(route,2);
S.rogue.floor=15;S.bossDefeatHandled=true;
assert.equal(ctx.__sanctumLawInterceptCycleCheckpoint(),true,'Third Boss rotates Law');
assert.equal(S.rogue.laws.offer.kind,'cycle');
assert(ctx.__sanctumLawChoose(S.rogue.laws.offer.keys[0]));
assert.equal(S.rogue.laws.active.length,3,'Law cap must stay at three');
assert(!S.rogue.laws.active.includes(first),'Oldest Law replaced after Boss three');
assert.equal(checkpoint,1);
assert.equal(ctx.__sanctumLawInterceptCycleCheckpoint(),false,'Cannot trigger two checkpoint drafts');
assert.equal(JSON.parse(JSON.stringify(S)).rogue.laws.active.length,3,'Laws persist in saved state');

function activate(key){S.rogue.laws.active=[key];S.rogue.laws.offer=null;S.phase='Priest'}
function d(id){return{id,n:id,key:id,hp:10,ghp:16,cur:10,atk:3,b:2,greater:false,status:{}}}
activate('bloodPower');S.players[0].blood=2;const t=d('target');
ctx.dealDamageTarget({kind:'demon',d:t},4,'Attack',{basicAttack:true});
assert.equal(usedDamage,7,'Blood Is Power adds +3 to Basic Attack');
assert.equal(S.players[0].blood,1,'Blood Is Power spends 1 Blood');
activate('elementalChaos');S.round=4;S.rooms=[[d('e1'),d('e2')],[],[],[]];
ctx.dealDamageTarget({kind:'demon',d:S.rooms[0][0]},3,'Basic',{basicAttack:true});
assert.equal(S.rooms[0][1].cur,9,'Elemental Chaos splashes 1 to neighbor');
activate('bloodCovenant');S.rooms=[[d('a'),d('b')],[],[],[]];
ctx.defeatDemon(S.rooms[0][0]);
assert.equal(S.rooms[0][0].cur,12,'Blood Covenant heals next Demon');
assert.equal(ctx.demonMaxHP(S.rooms[0][0]),12,'Blood Covenant raises max HP');
activate('greaterCalling');S.rooms=[[],[],[],[]];S.rogue.laws.normalSpawns=0;
ctx.spawnOne();ctx.spawnOne();ctx.spawnOne();
assert(S.rooms[0].some(x=>x.status.lawGreaterCalling&&x.greater),'Third spawn is Greater');
activate('endlessProcession');S.rooms=[[],[],[],[]];S.rogue.laws.normalSpawns=0;
for(let i=0;i<4;i++)ctx.spawnOne();
const spectral=S.rooms[0].find(x=>x.status.lawSpectral);
assert(spectral,'Fourth spawn introduces spectral companion');
assert.equal(ctx.demonBlood(spectral),0,'Spectral grants no Blood');
assert.equal(ctx.demonMaxHP(spectral),5,'Spectral has half HP');
activate('shiftingSanctum');S.rooms=[[d('shift')],[],[],[]];S.round=1;
ctx.triggerEnterRoom(S.rooms[0][0]);
assert.equal(S.rooms[0][0].status.attackMoveBonus,1);
activate('wardensOath');S.rooms=[[],[],[d('oath')],[]];
ctx.triggerEnterRoom(S.rooms[2][0]);
assert.equal(S.rooms[2][0].cur,12);
assert.equal(ctx.demonAttack(S.rooms[2][0]),2);
activate('forbiddenScripture');
assert.equal(ctx.__sanctumLawCardManaCost(3,true),2);
assert.equal(ctx.__sanctumLawCardManaCost(3,false),4);
activate('lastBenediction');S.mana=4;S.consecrated=[false,false,false,false];
assert.equal(ctx.consecrateUnavailableReason(0),'');
ctx.consecrateRoom(0);
assert.equal(S.mana,0,'Consecration costs 4 Mana');
S.rooms=[[d('ward')],[],[],[]];S.phase='Demon';ctx.endRound();
assert.equal(S.rooms[0][0].cur,8,'Consecrated room deals 2 end-phase damage');
activate('graveTithe');S.rooms=[[d('tithe')],[],[],[]];S.phase='Priest';S.altar=20;bloodAward=0;
ctx.defeatDemon(S.rooms[0][0]);
assert.equal(bloodAward,2);
assert.equal(S.altar,19);
activate('hollowGrace');S.rooms=[[{...d('greater'),greater:true}],[],[],[]];S.phase='Priest';S.altar=10;
ctx.defeatDemon(S.rooms[0][0]);
assert.equal(S.altar,12);
activate('relentlessNight');S.round=3;S.mana=6;S.rooms=[[d('night')],[],[],[]];
ctx.endRound();
assert.equal(S.mana,8,'Relentless Night grants +2 Mana on fourth round');
assert.equal(ctx.demonAttack(S.rooms[0][0]),4,'Fourth round gives Demon +1 Attack');
assert(/89-laws-damnation\.js\?v=clean\d+/.test(html),'Versioned Laws script asset is loaded');
assert(/laws-damnation\.css\?v=clean\d+/.test(html),'Versioned Laws styles are loaded');
assert(mp.includes("key.startsWith('law:')"),'Multiplayer must rebuild Law actions');
 // Isolate the actual multiplayer scheduling function: a generic state_sync
 // render right after game_start must not cancel the startup RPC.
 const publishStart=mp.indexOf("  function schedulePublish(actionType=");
 const publishEnd=mp.indexOf("  function freshPriestShuffle(",publishStart);
 assert(publishStart>=0&&publishEnd>publishStart,'Multiplayer publish scheduling function available');
 const pending=new Map(),sent=[];
 let timerId=0;
 const publishCtx={
  session:{isHost:true},S:{started:true},
  applyingRemote:false,startingOnline:false,resolvingVoteTransition:false,
  gameStartPublishPending:false,publishTimer:0,
  setTimeout(fn,delay){const id=++timerId;pending.set(id,{fn,delay});return id},
  clearTimeout(id){pending.delete(id)},
  async pushSharedState(kind){sent.push(kind);return true}
 };
 vm.createContext(publishCtx);
 vm.runInContext(mp.slice(publishStart,publishEnd),publishCtx,{timeout:1000});
 publishCtx.schedulePublish('game_start',{players:2},30);
 const initialId=publishCtx.publishTimer;
 assert(pending.has(initialId),'Startup RPC must be scheduled');
 publishCtx.schedulePublish('state_sync',{},0);
 assert.equal(publishCtx.publishTimer,initialId,'Render state sync cannot override pending game_start');
 assert.equal(pending.size,1,'Only the pending game_start should remain');
 await pending.get(initialId).fn();
 assert.equal(sent[0],'game_start','Lobby must receive game_start before state_sync');
 assert.equal(publishCtx.gameStartPublishPending,false,'Startup priority guard must release');
 publishCtx.schedulePublish('state_sync',{},0);
 assert.equal(pending.size,2,'Post-start state changes can synchronize normally');
assert(rogue.includes('window.__sanctumLawInterceptCycleCheckpoint'), 'Third Boss requires Law transition');
assert(engine.includes('__sanctumLawCardManaCost'), 'Empowered mana discount hook must exist');
assert(sw.includes("'./src/js/89-laws-damnation.js'"));
console.log('PASS: 12 Laws, random startup 3-choice, Boss transitions, replacement cap, persistence, and focused combat effects.');
