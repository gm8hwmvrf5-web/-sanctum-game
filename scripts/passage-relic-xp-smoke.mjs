import {chromium} from 'playwright';

// Exercising real passage reward buttons, both local and multiplayer-compatible
// reward handlers (same rogueSilentRelic function), saved state and bonus relics.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const result=await page.evaluate(()=>{
  window.alert=()=>{};window.confirm=()=>true;
  const check=(ok,message)=>{if(!ok)throw Error(message)};
  const need=()=>window.__sanctumBalanceReadouts().relicXpRequired;
  const modal=id=>document.getElementById(id);
  const choose=title=>{
   const b=[...document.querySelectorAll('#rogueChoiceGrid button')]
    .find(x=>x.querySelector('h3')?.textContent===title);
   check(!!b,'Reward choice missing: '+title+'; modal '+modal('rogueChoiceTitle')?.textContent);
   b.click();
  };
  modal('playerCount').value='1';modal('startBtn').click();
  check(S.started&&S.rogue.enabled,'Fresh roguelite game failed to start');
  const original=JSON.stringify(S);
  const keys=RELICS.map(r=>r.key);
  const reset=()=>{
   clearTurnTimerInterval();
   S=JSON.parse(original);
   S.relicDeck=keys.slice(0,9);
   S.relicPopupQueue=[];
   S.rogue.relicXp=0;S.rogue.xpRelics=0;S.rogue.passageRelics=0;
   ['rogueChoiceModal','relicModal','rogueLegacyModal'].forEach(id=>modal(id)?.classList.add('hidden'));
   check(need()===25,'Fresh Relic XP target must be 25');
  };
  const elite=()=>{
   S.rogue.floor=2;S.rogue.bossFloor=false;S.rogue.nodeType='elite';
   S.rogue.nodeName='Elite Procession';S.rogue.encounterGoal=1;
   S.rogue.encounterDefeats=0;S.rogue.pendingClear=false;
   S.phase='Priest';S.bossRevealed=false;
   const d={...DEMON_TYPES[0],id:'test-xp-elite',greater:false,cur:1,b:0,status:{}};
   S.rooms=[[d],[],[],[]];S.queue=[];
   defeatDemon(d);
   check(modal('rogueChoiceTitle').textContent==='Choose One Reward',
    'Elite passage did not create reward selection');
  };
  reset();
  elite();
  check(need()===25,'Clearing an Elite without choosing a relic increased XP tier');
  check(modal('rogueChoiceGrid').textContent.includes('+10 next XP cost'),
   'Elite Relic reward lacks increased-XP description');
  choose('Claim a Relic');
  check(S.rogue.passageRelics===1&&S.rogue.xpRelics===0&&need()===35,
   'Claiming an Elite passage Relic must raise next cost from 25 to 35');
  check(!modal('relicModal').classList.contains('hidden'),
   'Elite passage Relic popup did not open');
  check(S.relicPopupQueue[0]?.after==='rogueRoute','Elite Relic popup lost route continuation');
  const saved=compactSaveJSON();
  check(JSON.parse(saved).state.rogue.passageRelics===1,
   'Passage Relic counter is not persisted in normal saved games');
  modal('relicClose').click();

  // Both old saves (without the new counter) and new saved runs must load.
  check(applyLoadedSave(saved,'passage XP smoke',null),
   'Could not load the passage XP save');
  check(S.rogue.passageRelics===1&&need()===35,
   'Reloading a passage reward lost its increased XP target');
  const oldSave=JSON.parse(saved);
  delete oldSave.state.rogue.passageRelics;
  check(applyLoadedSave(JSON.stringify(oldSave),'legacy XP smoke',null),
   'Could not load a legacy save lacking passageRelics');
  check(need()===25,'Loading an older save must preserve its original XP tier');

  reset();
  S.rogue.xpRelics=1;S.rogue.passageRelics=1;S.rogue.relicXp=17;
  check(need()===45,'XP Relic and Elite passage Relic must stack to cost 45');
  S.phase='Boss';S.rogue.floor=5;S.rogue.nodeType='boss';
  S.rogue.bossFloor=true;S.boss={...BOSSES[0],cur:0};
  S.bossRevealed=true;S.bossDefeatHandled=false;
  defeatBossIfNeeded();
  check(modal('rogueChoiceTitle').textContent==='Claim an Act Reward',
   'Boss passage reward chooser missing');
  check(modal('rogueChoiceGrid').textContent.includes('raises your next Relic XP requirement by 10'),
   'Boss passage does not explain XP increase');
  choose('Reliquary');
  check(S.rogue.passageRelics===2&&S.rogue.xpRelics===1&&need()===55,
   'Boss passage Relic must advance next XP target from 45 to 55');
  check(S.rogue.relicXp===17,'Passage reward must not subtract earned XP');
  check(S.relicPopupQueue[0]?.after==='rogueRoute',
   'Boss Relic popup lost route continuation');

  reset();
  S.rogue.cindersRun=100;
  const beforeStore=need(),beforeCount=S.rogue.passageRelics;
  check(window.__sanctumRepositoryPurchaseByActionKey(
   'repository:relic:'+encodeURIComponent(keys[0])+':10'),
   'Repository Relic purchase failed');
  check(need()===beforeStore&&S.rogue.passageRelics===beforeCount,
   'Purchased Repository Relic must not count as passage reward');

  reset();
  elite();
  // Empty the Relic deck after reaching the reward. This isolates the
  // failed-claim path from the engine's encounter/setup deck handling.
  S.relicDeck=[];
  choose('Claim a Relic');
  check(need()===25&&S.rogue.passageRelics===0,
   'Empty deck must not raise next XP target: '+JSON.stringify({need:need(),passage:S.rogue.passageRelics,deck:S.relicDeck?.length}));
  return {first:25,afterElite:35,afterXpAndElite:45,afterBoss:55,
   savedAndLoaded:true,legacySave:true,storeExcluded:true,emptyDeckExcluded:true};
 });
 if(errors.length)throw Error('Browser exceptions: '+errors.join(' | '));
 console.log('PASSAGE RELIC XP SMOKE PASSED:',JSON.stringify(result));
}finally{await browser.close()}
