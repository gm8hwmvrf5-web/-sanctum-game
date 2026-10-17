import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const result=await page.evaluate(async()=>{
  window.alert=()=>{};
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  const expectedKeys=['lightningRod','soulHarvestLedger','everflowCenser','saintAbacus','wardenChain'];
  const relics=expectedKeys.map(key=>RELICS.find(r=>r.key===key));
  assert(relics.every(Boolean),'All five Relics must exist in the normal catalog');
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  assert(S.started&&S.rogue.enabled,'Start real roguelite run');
  clearTurnTimerInterval();
  const snapshot=JSON.stringify(S);
  const reset=()=>{
   S=JSON.parse(snapshot);
   S.phase='Priest';S.current=0;
   S.rooms=[[],[],[],[]];S.bossRevealed=false;
   S.rogue.floor=2;S.rogue.nodeType='battle';S.rogue.bossFloor=false;
   S.rogue.relicXp=0;S.rogue.xpRelics=0;S.rogue.passageRelics=0;S.rogue.passageXpEarned=0;
   S.rogue.legacyRelicXpBonus=0;
   S.relicPopupQueue=[];
   S.activeRelics=[];
   S.relicMods={basic:0,hand:0,ritual:0,crit:0};
   S.players[0].basic=false;
   S.consecrated=[false,false,false,false];
   clearTurnTimerInterval();
  };
  function demon(id,greater=false){
   const base=DEMON_TYPES[0];
   return {...base,id,greater,hp:30,ghp:42,cur:greater?42:30,status:{}};
  }
  // Old saves: insert the missing five Relics once without resetting owned/deck.
  reset(); S.relicDeck=['varoSword']; normalizeSanctumState();
  assert(expectedKeys.every(k=>S.relicDeck.includes(k)),'Backfill new Relics in old saves');
  normalizeSanctumState();
  assert(expectedKeys.every(k=>S.relicDeck.filter(x=>x===k).length===1),'No duplicated Relics on rendering');
  // Lightning deals normal full damage to the chosen Demon, only half *base*
  // to other Demons in the same room. Nothing touches another room.
  reset();applyRelic(relics[0]);
  const [a,b,c,d]=[demon('a'),demon('b'),demon('c'),demon('d')];
  S.rooms=[[a,b,c],[d],[],[]];
  const chooseOriginal=chooseDamageTarget,critOriginal=basicAttackCritChance;
  try{
   chooseDamageTarget=async()=>({kind:'demon',d:a});
   basicAttackCritChance=()=>0;
   await basicAttack();
   assert(a.cur===28&&b.cur===29&&c.cur===29&&d.cur===30,'Lightning normal damage/splash/room restriction');
   S.players[0].basic=false;S.relicMods.basic=3;
   basicAttackCritChance=()=>100;
   await basicAttack();
   assert(a.cur===18&&b.cur===26&&c.cur===26,'Crit affects only selected Demon; other targets receive ceil(5/2)');
  }finally{chooseDamageTarget=chooseOriginal;basicAttackCritChance=critOriginal}
  // Ledger adds exactly 5 XP to each Demon kill and the Elite replay count.
  reset();applyRelic(relics[1]);
  const xpVictim=demon('xp');
  // XP handlers are module-private in the roguelite script. Defeat a real
  // Demon through the public engine instead of bypassing defeat accounting.
  const expectedXp=demonBlood(xpVictim)+5;
  S.rooms=[[xpVictim],[],[],[]];S.rogue.encounterGoal=99;
  defeatDemon(xpVictim);
  assert(S.rogue.relicXp===expectedXp,'Ledger should add +5 XP to actual defeat XP');
  assert(S.rogue.passageXpEarned===expectedXp,'Elite passage records Ledger XP');
  // XP threshold discount across multiple tiers.
  reset();applyRelic(relics[3]);
  for(const [earned,need] of [[0,30],[1,40],[5,80],[6,100],[10,180],[16,370]]){
   S.rogue.xpRelics=earned;
   assert(window.__sanctumBalanceReadouts().relicXpRequired===need,'Saint Abacus XP tier '+earned+': got '+window.__sanctumBalanceReadouts().relicXpRequired);
  }
  // A mana Relic expands the party-size cap and triggers again on each turn.
  reset();applyRelic(relics[2]);
  assert(sharedManaRoundValue()===15,'Solo mana cap increased by five');
  S.mana=2;beginTurn(true);clearTurnTimerInterval();
  assert(S.mana===7,'First Priest turn restores +5 Mana');
  beginTurn(true);clearTurnTimerInterval();
  assert(S.mana===12,'Following Priest turn restores +5 Mana');
  beginTurn(true);clearTurnTimerInterval();
  assert(S.mana===15,'Mana capped at new shared maximum');
  const serialized=JSON.parse(JSON.stringify(S));
  assert(serialized.activeRelics.includes('everflowCenser'),'Mana Relic persists through saved state');
  // Warden Chain must prevent the pair in both processing directions, with
  // a stored passage floor; a new passage replenishes the protection.
  reset();applyRelic(relics[4]);
  const [first,second]=[demon('m1'),demon('m2')];
  S.rooms=[[first,second],[],[],[]];
  assert(checkMerge(first)===false,'First merge prevented');
  assert(S.rogue.wardenChainBlockedFloor===2,'Passage 2 consumed the block');
  assert(checkMerge(second)===false,'Reverse merge cannot bypass the blocked pair');
  assert(S.rooms[0].length===2,'The blocked pair stays separated');
  const savedBlock=JSON.parse(JSON.stringify(S));
  assert(savedBlock.rogue.wardenChainBlockedPair.length===2,'Blocked pair persists in multiplayer/saves');
  S.rogue.floor=3;
  assert(checkMerge(first)===false,'Next passage restores block');
  assert(S.rogue.wardenChainBlockedFloor===3,'Block uses new floor');
  // Elite Greater-to-Ultra also uses same interceptor.
  reset();applyRelic(relics[4]);
  S.rogue.nodeType='elite';
  const [ultra1,ultra2]=[demon('u1',true),demon('u2',true)];
  S.rooms=[[ultra1,ultra2],[],[],[]];
  assert(checkMerge(ultra1)===false,'Elite Ultra merge prevented');
  assert(checkMerge(ultra2)===false,'Reverse Elite merge prevented');
  assert(!ultra1.status.ultraForm&&!ultra2.status.ultraForm,'Both remain Greater');
  clearTurnTimerInterval();
  return {added:relics.map(x=>x.n),lightningSplash:3,killedDemonXp:8,manaCap:15,mergeBlockedFloor:S.rogue.wardenChainBlockedFloor};
 });
 assert.equal(result.added.length,5);
 assert.deepEqual(errors,[],'Browser errors in focused Relic checks');
 console.log('PASS five real-game Relics:',JSON.stringify(result));
}finally{await browser.close()}
