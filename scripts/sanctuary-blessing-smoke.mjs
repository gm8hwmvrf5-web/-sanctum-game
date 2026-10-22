import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Ensure the resumed group-vote route calls the same reward as the local UI.
const multiplayerSource=readFileSync('src/js/60-multiplayer.js','utf8');
const sanctuarySource=readFileSync('src/js/30-roguelite.js','utf8');
assert(multiplayerSource.includes("'sanctuary:sacrament':()=>window.__sanctumSanctuaryRewards.sacrament()"),
 'Resumed multiplayer Sacrament must use the exported shared reward');
assert(multiplayerSource.includes("'sanctuary:confession':()=>window.__sanctumSanctuaryRewards.confession()"),
 'Resumed multiplayer Confession must use the exported shared reward');
assert(sanctuarySource.includes("Restore 8 Altar Protection and cleanse all Corruption"),
 'Confession UI must state 8 Altar Protection and cleansing');
assert(sanctuarySource.includes("Each Priest gains 3 Demon Blood and draws 1 random Priest card"),
 'Sacrament UI must state +3 Blood and a Priest card for every player');

const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
  ['desktop',{width:1280,height:800}],
  ['iPhone landscape',{width:844,height:390}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label==='iPhone landscape',hasTouch:label==='iPhone landscape'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
   await page.evaluate(()=>{
    document.getElementById('playerCount').value='1';
    document.getElementById('startBtn').click();
    if(!S.started)throw Error('New game failed to start');
    if(S.rogue?.laws?.offer?.keys?.length){
     window.__sanctumLawChoose(S.rogue.laws.offer.keys[0]);
     document.getElementById('rogueChoiceModal').classList.add('hidden');
    }
    clearTurnTimerInterval();
   });

   // The actions are exported for resumed multiplayer votes; the initial
   // Sanctuary UI references the very same callbacks inside its scoped module.
   const hooks=await page.evaluate(()=>Object.keys(window.__sanctumSanctuaryRewards||{}));
   assert.deepEqual(hooks.sort(),['confession','sacrament'],label+' both shared reward actions are accessible');

   // Simulate a two-player game locally, without entering an online room.
   const before=await page.evaluate(()=>{
    S.players.push({...S.players[0],name:'Test Priest 2',char:'Monk',blood:9,hand:[]});
    S.players[0].blood=4;
    S.players[0].hand=[];
    S.mana=6;
    render();
    const beforeIds=S.priestDeck.map(c=>c.id);
    return {mana:S.mana,blood:S.players.map(p=>p.blood),pile:beforeIds,
      hands:S.players.map(p=>p.hand.length)};
   });
   await page.evaluate(()=>{
    window.__sanctumSanctuaryRewards.sacrament();
    clearTurnTimerInterval();
   });
   const after=await page.evaluate(()=>({
    mana:S.mana,blood:S.players.map(p=>p.blood),
    hands:S.players.map(p=>p.hand.length),
    cards:S.players.map(p=>p.hand.map(c=>c.id)),
    pile:S.priestDeck.map(c=>c.id)
   }));
   assert.equal(after.mana,before.mana,label+' new Sacrament must not change shared Mana');
   assert.deepEqual(after.blood,[7,10],label+' each Priest gains 3 Blood, capped at 10');
   assert.deepEqual(after.hands,[1,1],label+' each Priest draws one random card');
   assert(after.cards.every(row=>row.length===1&&before.pile.includes(row[0])),
    label+' Priest cards must be drawn from the run deck');
   assert.notEqual(after.cards[0][0],after.cards[1][0],label+' no duplicate draw IDs');
   assert.equal(after.pile.length,before.pile.length-2,label+' exactly two cards consumed');

   // Respect existing hand capacity when a Sanctuary blessing is claimed.
   const limits=await page.evaluate(()=>{
    const p=S.players[0];
    p.hand=Array.from({length:handLimit()},(_,i)=>({...PRIEST[0],id:'full-hand-'+i}));
    p.blood=0;
    const pileBefore=S.priestDeck.length;
    const beforeHand=p.hand.length;
    const drawn=drawPriest(p,1);
    return {drawn,pileBefore,pileAfter:S.priestDeck.length,beforeHand,afterHand:p.hand.length};
   });
   assert.deepEqual(limits,{drawn:0,pileBefore:limits.pileBefore,pileAfter:limits.pileBefore,
    beforeHand:limits.beforeHand,afterHand:limits.beforeHand},label+' hand limit remains enforced');

   // Confession grants eight Protection; also retains cleansing on every room.
   await page.evaluate(()=>{
    S.altar=12;
    S.corruption=[1,2,3,4];
    S.desecratedRooms=[true,true,true,true];
    render();
   });
   await page.evaluate(()=>{
    window.__sanctumSanctuaryRewards.confession();
    clearTurnTimerInterval();
   });
   const conf=await page.evaluate(()=>({
    altar:S.altar,corruption:S.corruption,desecrated:S.desecratedRooms
   }));
   assert.equal(conf.altar,20,label+' Confession restores exactly 8 Altar Protection');
   assert(conf.corruption.every(n=>n===0)&&conf.desecrated.every(b=>!b),
    label+' Confession still cleanses room Corruption');

   assert.deepEqual(errors,[],label+' no JS errors');
   console.log('PASS '+label+': Sanctuary choices, +8 Confession, each Priest +3 Blood and 1 run-deck card, hand cap and Mana unchanged.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
