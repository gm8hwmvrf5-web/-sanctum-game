import {chromium} from 'playwright';

// Targeted Balance Update 1.0 browser checks: exact live engine values,
// party sizes, every Priest class, Boss acts/cycles, Wards, and shop limits.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const report=await page.evaluate(()=>{
  window.alert=()=>{};
  const assert=(test,msg)=>{if(!test)throw Error(msg)};
  const closeChoices=()=>['rogueChoiceModal','relicModal','rogueLegacyModal','wardCastModal'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  assert(S.started&&S.rogue.enabled,'Starting the actual game failed');
  const initial=JSON.stringify(S);
  const characters=Object.keys(CHARACTERS);
  assert(characters.length===6,'Expected six Priest classes');
  const pools={1:10,2:15,3:23,4:32};
  const drains={1:3,2:4,3:6,4:8};
  const reset=(n=1,floor=1,className=characters[0])=>{
   clearTurnTimerInterval();
   S=JSON.parse(initial);S.started=true;S.phase='Priest';S.round=1;S.altar=30;
   S.rogue.enabled=true;S.rogue.floor=floor;S.rogue.repositoryPendingBossFloor=0;
   S.rogue.repositoryResume=null;S.rogue.repositoryVisitedBossFloor=0;
   const ix=characters.indexOf(className);
   S.players=Array.from({length:n},(_,i)=>({
    name:'Balance '+(i+1),char:characters[(ix+i)%characters.length],
    hand:[],blood:0,basic:false,ritualUsed:[false,false,false],
    discardUsed:false,consecrateUsed:false
   }));
   S.current=0;S.mana=sharedManaRoundValue();S.pendingDemonManaDrain=0;
   S.boss={...BOSSES.find(b=>b.b===6),cur:100};S.bossRevealed=true;
   S.rooms=[[],[],[],[]];S.queue=[];S.bossFlags={spores:{}};
   closeChoices();
  };
  const closeEnough=(a,b)=>Math.abs(a-b)<0.0000001;
  const floors=[1,5,10,15,16,20,30,31,45];
  const expected=[1,1.12,1.27,1.42,1.5,1.68,2.13,2.25,3.195];
  floors.forEach((f,i)=>{
   reset(1,f);
   const got=rogueDifficultyMultiplier()*rogueFloorHealthMultiplier();
   assert(closeEnough(got,expected[i]),'Cycle-local HP scale floor '+f+': '+got+' vs '+expected[i]);
   assert(closeEnough(got,rogueDifficultyMultiplier()*rogueFloorDamageMultiplier()),'Demon Attack multiplier diverges from HP');
  });
  const matrix=[];
  for(const cls of characters){
   for(let n=1;n<=4;n++){
    for(const floor of [5,10,15,20,30,45]){
     reset(n,floor,cls);
     assert(sharedManaRoundValue()===pools[n],'Mana baseline mismatch for '+cls+' '+n+' players');
     assert(S.players[0].char===cls,'Selected Priest class did not survive setup');
     assert(rogueRelicXpNeed()===20,'First XP Relic must require 20');
     const act=Math.ceil((((floor-1)%15)+1)/5);
     const cycle=Math.floor((floor-1)/15)+1;
     const expectedDrain=Math.min(8,[0,1,2,3,4][n]+act-1+cycle-1);
     assert(bossDrainAmount()===expectedDrain,'Boss drain mismatch '+cls+' '+n+' players floor '+floor);
     for(const change of [-1,1]){
      S.boss.b=6+change;
      const variant=Math.min(8,Math.max(1,expectedDrain+change));
      assert(bossDrainAmount()===variant,'Boss printed damage ±1 mismatch on floor '+floor);
     }
     S.boss.b=6;
     matrix.push({priest:cls,players:n,floor,drain:expectedDrain,mana:pools[n]});
    }
    reset(n,5,cls);S.phase='Demon';
    drainSharedManaByDemon(2,'Balance spec');
    drainSharedManaByDemon(15,'Balance spec');
    assert(S.pendingDemonManaDrain===drains[n],'Shared next-turn penalty cap mismatch '+cls+' '+n);
    assert(S.mana===pools[n]-drains[n],'Immediate Demon Mana cap mismatch');
    S.bossRevealed=false;
    endRound();
    assert(S.phase==='Priest'&&S.mana===pools[n]-drains[n],'Next Priest round lost the drain cap');
    drainSharedManaByDemon(2,'Priest-phase ability');
    assert(S.mana===pools[n]-drains[n]-2,'Priest-phase drain should stay uncapped');
    assert(S.pendingDemonManaDrain===0,'Priest-phase drain should not queue for next round');
   }
  }
  for(const [i,cost] of [20,28,36,44,52].entries()){
   reset();
   S.rogue.xpRelics=i;
   assert(rogueRelicXpNeed()===cost,'Relic XP progression failed index '+i);
  }
  for(const [cycle,prices] of [[1,{relic:10,candles:8,folio:12}],[2,{relic:12,candles:10,folio:14}],[3,{relic:14,candles:12,folio:16}],[9,{relic:14,candles:12,folio:16}]]){
   reset(1,1+15*(cycle-1));
   assert(JSON.stringify(rogueRepositoryPrices(cycle))===JSON.stringify(prices),'Store fixed-price tiers failed cycle '+cycle);
  }
  for(const greater of [false,true]){
   reset();
   const definition=DEMON_TYPES.find(d=>d.key==='new_thorn_martyr');
   assert(definition,'Thorn Martyr is missing');
   const d={...definition,id:'balance-thorn',greater,cur:10,status:{}};
   S.rooms[0]=[d];S.bossRevealed=false;
   damageDemon(d,1,'First strike');
   const loss=greater?2:1;
   assert(S.altar===30-loss,'Thorn first strike should retaliate');
   damageDemon(d,1,'Second strike');
   assert(S.altar===30-loss,'Thorn retaliated twice in same Priest round');
   S.round++;
   damageDemon(d,1,'New Priest round');
   assert(S.altar===30-loss*2,'Thorn retaliation did not reset next round');
   S.phase='Demon';
   damageDemon(d,1,'Demon phase effect');
   assert(S.altar===30-loss*2,'Thorn triggered outside a Priest round');
  }
  const wardCosts={
   cinder:[3,1,2],thorns:[3,1,1],chains:[2,1,1],bell:[3,1,1],
   silence:[3,1,1],lantern:[2,1,1],vigil:[2,1,1],
   absolution:[2,0,2],siphon:[2,0,1],chalice:[2,0,1]
  };
  const wardDefs=window.__sanctumWards.definitions;
  assert(wardDefs.length===10&&window.__sanctumWards.interval===3,'Ward definitions/draft cadence changed');
  for(const w of wardDefs){
   const expectedCost=wardCosts[w.key];
   assert(expectedCost&&w.mana===expectedCost[0]&&w.blood===expectedCost[1]&&w.charges===expectedCost[2],
    'Ward Balance 1.0 cost or charge mismatch: '+w.key);
  }
  reset(1,5);S.rogue.cindersRun=80;S.rogue.repositoryResume='route';
  const clickFolio=()=>{
   const buttons=[...document.querySelectorAll('#rogueChoiceGrid button')];
   const folio=buttons.find(b=>b.textContent.includes('Forbidden Folio'));
   if(folio)folio.click();
   return !!folio;
  };
  for(const [floor,balance,price] of [[5,80,12],[20,68,14]]){
   S.rogue.floor=floor;S.phase='Repository';
   rogueliteOpenRepository();
   const costButton=[...document.querySelectorAll('#rogueChoiceGrid button')].find(b=>b.textContent.includes('Forbidden Folio'));
   assert(costButton&&costButton.textContent.includes(price+' Cinders'),'Folio tier price incorrect on floor '+floor);
   assert(clickFolio(),'Could not purchase Folio');
   assert(S.rogue.cindersRun===balance-price,'Folio purchase spending incorrect');
  }
  assert(S.rogue.repositoryFolioPurchases===2&&S.relicMods.hand>=2,'Two Folio purchases should increase hand limit by 2');
  S.rogue.floor=35;S.rogue.cindersRun=80;S.phase='Repository';S.rogue.repositoryResume='route';
  rogueliteOpenRepository();
  assert(![...document.querySelectorAll('#rogueChoiceGrid button')].some(b=>b.textContent.includes('Forbidden Folio')),
   'Third Forbidden Folio must not be offered');
  const before=S.rogue.cindersRun;
  assert(rogueRepositoryPurchaseByActionKey('repository:folio:16')===false,'Third Folio purchase was incorrectly allowed');
  assert(S.rogue.cindersRun===before,'Rejected Folio purchase spent Cinders');
  return {build:'Balance 1.0',priestClasses:characters,partySizes:Object.keys(pools).length,bossCases:matrix.length,
   scaleFloors:floors,firstFiveRelicXp:[20,28,36,44,52],wardCostsVerified:wardDefs.length,
   shopTierCycles:[1,2,3,9],folioLimit:2,demonManaCaps:drains,thornForms:2};
 });
 console.log('BALANCE 1.0 BROWSER MATRIX PASSED:',JSON.stringify(report));
 if(pageErrors.length)throw Error('Browser errors: '+pageErrors.join('; '));
}finally{await browser.close()}
