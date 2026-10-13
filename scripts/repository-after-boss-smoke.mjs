import {chromium} from 'playwright';

// Focused browser smoke: guaranteed post-Boss store in the real single-player
// engine. Does not run the full Priest, Demon, or Boss audit suite.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
try {
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const report=await page.evaluate(()=>{
   window.alert=()=>{};
   document.getElementById('playerCount').value='1';
   document.getElementById('startBtn').click();
   if(!S?.started||!S.rogue?.enabled)throw Error('Roguelite startup failed');
   const base=JSON.stringify(S);
   const output=[];
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   const choiceTitle=()=>document.getElementById('rogueChoiceTitle')?.textContent;
   const clickChoice=(name)=>{
     const button=[...document.querySelectorAll('#rogueChoiceGrid button')]
       .find(b=>b.textContent.includes(name));
     if(!button)throw Error('Missing choice '+name+' from '+choiceTitle());
     button.click();
   };
   const reset=(floor,cinders)=>{
     clearTurnTimerInterval();
     S=JSON.parse(base);
     S.rogue.enabled=true;S.rogue.floor=floor;S.rogue.nodeType='boss';
     S.rogue.cindersRun=cinders;S.rogue.legacyCheckpoint=false;
     S.rogue.repositoryVisits={};S.rogue.repositoryPendingBossFloor=0;
     S.rogue.repositoryResume=null;S.rogue.repositoryVisitedBossFloor=0;
     S.phase='Boss';S.altar=30;S.boss={...BOSSES[0],cur:0};
     S.bossRevealed=true;S.bossDefeatHandled=false;S.relicDeck=[];
     S.relicPopupQueue=[];
     for(const id of ['rogueChoiceModal','relicModal','rogueLegacyModal']){
       document.getElementById(id)?.classList.add('hidden');
     }
   };
   const checkStore=(floor,resume)=>{
     check(choiceTitle()==='The Sinking Repository','Store missing after Boss floor '+floor+': '+choiceTitle());
     check(S.rogue.floor===floor,'Store incorrectly incremented floor '+floor);
     check(S.rogue.repositoryResume===resume,'Incorrect store continuation at floor '+floor);
     check(S.rogue.repositoryVisits[String(Math.floor((floor-1)/15)+1)]===1,'Store not marked exactly once');
     check([...document.querySelectorAll('#rogueChoiceGrid button')].some(b=>b.textContent.includes('Leave Empty-Handed')),'Store exit missing');
   };
   reset(5,0);
   defeatBossIfNeeded();
   check(choiceTitle()==='Claim an Act Reward','Floor 5 Boss reward missing');
   clickChoice('Purification');
   checkStore(5,'route');
   check(S.rogue.cindersRun===6,'First Boss did not award 6 Cinders');
   clickChoice('Leave Empty-Handed');
   check(choiceTitle()==='Choose Your Route','Shop exit did not show route after first Boss');
   check(![...document.querySelectorAll('#rogueChoiceGrid button')].some(b=>b.textContent.includes('The Sinking Repository')),'Random store route still offered');
   check(!S.rogue.repositoryResume&&!S.rogue.repositoryPendingBossFloor,'Shop was not marked complete');
   output.push({bossFloor:5,store:true,bossReward:true,routeAfterStore:true});

   reset(10,30);
   defeatBossIfNeeded();
   clickChoice('Purification');
   checkStore(10,'route');
   clickChoice('Votive Candle Bundle');
   check(S.rogue.repositoryCandleReduction>0,'Votive Candle purchase failed');
   check(choiceTitle()==='Choose Your Route','Purchased store item did not resume route');
   output.push({bossFloor:10,store:true,purchasedCandle:true,routeAfterStore:true});

   reset(15,7);
   defeatBossIfNeeded();
   checkStore(15,'cycleCheckpoint');
   check(!S.rogue.legacyCheckpoint&&S.rogue.cindersRun===15,'Cycle boss banked Cinders before store');
   clickChoice('Leave Empty-Handed');
   check(S.phase==='Legacy Checkpoint'&&S.rogue.legacyCheckpoint,'Third Boss did not reach Legacy checkpoint after store');
   check(S.rogue.cindersRun===0&&S.rogue.bankedAmount===15,'Remaining Cinders were not banked after store');
   check(!document.getElementById('rogueLegacyModal').classList.contains('hidden'),'Legacy shop did not open');
   document.getElementById('rogueLegacyClose').click();
   check(choiceTitle()==='Choose Your Route','Legacy continuation did not resume routes');
   output.push({bossFloor:15,store:true,preBank:true,legacyAfterStore:true});

   reset(5,0);
   defeatBossIfNeeded();
   S.rogue.cindersRun=0;
   clickChoice('Purification');
   checkStore(5,'route');
   check(document.querySelectorAll('#rogueChoiceGrid button').length===1,'Zero-Cinder store has unaffordable choices');
   clickChoice('Leave Empty-Handed');
   check(choiceTitle()==='Choose Your Route','Zero-Cinder shop exit failed');
   output.push({bossFloor:5,zeroCinders:true,store:true,exit:true});
   return output;
 });
 console.log('POST-BOSS REPOSITORY SMOKE PASS:',JSON.stringify(report));
 if(pageErrors.length)throw Error('Browser errors: '+pageErrors.join('; '));
}finally{await browser.close()}
