import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 for(const [label,viewport] of [
  ['desktop',{width:1440,height:900}],
  ['landscape iPad',{width:1024,height:768}],
  ['iPhone landscape',{width:844,height:390}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label.includes('iPhone'),hasTouch:label.includes('iPhone')});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
   await page.evaluate(()=>{
    document.getElementById('playerCount').value='1';
    document.getElementById('startBtn').click();
    if(!S.started)throw Error('Startup failed');
    if(S.rogue?.laws?.offer?.keys?.length){
     window.__sanctumLawChoose(S.rogue.laws.offer.keys[0]);
     document.getElementById('rogueChoiceModal').classList.add('hidden');
    }
    clearTurnTimerInterval();
   });
   for(const char of ['Exorcist','Crusader','Oracle','Monk','High Priestess','Abbess']){
    const result=await page.evaluate(char=>{
     S.players[S.current].char=char;
     S.relicMods.ritual=3;
     S.activeRelics=['firstLightChalice','oracleEye','vesperBell'];
     render();
     const tracker=document.querySelector('#handPanel .handCharacterPriest .ritualTracker');
     const labels=[...tracker.querySelectorAll('.badge')].map(x=>x.textContent.trim());
     const note=document.querySelector('.ritualPowerNote')?.textContent;
     const rituals=[...document.querySelectorAll('#handPanel .handCharacterPriest .rituals > .ritual')].map(x=>x.textContent);
     const buttons=['basicBtn','endBtn','consecrateBtn'].map(id=>document.getElementById(id));
     const badge=document.getElementById('actionCinderBadge');
     const end=document.getElementById('endBtn');
     const player=tracker.querySelector('.playerTurnTag');
     return {labels,note,rituals,buttonCount:buttons.filter(Boolean).length,
      parentGood:buttons.every(x=>x?.parentElement===tracker),
      consecrateAfterEnd:end?.nextElementSibling===document.getElementById('consecrateBtn'),
      playerVisible:!!player, cinderVisible:!!badge&&badge.getClientRects().length>0,
      cinderLast:badge===tracker.lastElementChild,
      trackedBlood:document.querySelector('.ritualBloodGauge')?.getAttribute('aria-valuenow'),
      calculated:CHARACTERS[char].rituals.map(r=>[
        ritualDisplayedEffect(r,false),ritualDisplayedEffect(r,true)
      ])};
    },char);
    const m=label+' '+char+' '+JSON.stringify(result);
    assert.equal(result.buttonCount,3,'Priest actions remain '+m);
    assert(result.parentGood&&result.consecrateAfterEnd,'Actions remain beside End Turn '+m);
    assert(result.labels.every(x=>x.startsWith('Cinders:')),'Only Cinders remains in tracker '+m);
    assert(result.cinderVisible&&result.cinderLast,'Cinders stays at right '+m);
    assert(result.playerVisible,'Priest label remains '+m);
    assert.equal(result.trackedBlood,'0','Demon Blood gauge remains functional '+m);
    assert(result.note?.includes('Relic Power +3'),'Ritual power label reflects relics '+m);
    assert.equal(result.rituals.length,3,'Three rituals render '+m);
    assert(result.rituals.every((r,i)=>result.calculated[i].every(text=>r.includes(text))),'All Ritual effects show calculated values '+m);
   }
   // Specific damage and power scaling must agree with actual resolver math.
   const mods=await page.evaluate(()=>{
    const get=(char,kind)=>CHARACTERS[char].rituals.find(r=>r.kind===kind);
    S.relicMods.ritual=0;const unbuffed=[
     ritualDisplayedEffect(get('Exorcist','castHell'),false),
     ritualDisplayedEffect(get('Crusader','crusaderSmite'),false),
     ritualDisplayedEffect(get('Monk','palmJudgment'),true)
    ];
    S.relicMods.ritual=4;render();
    const buffed=[
     ritualDisplayedEffect(get('Exorcist','castHell'),false),
     ritualDisplayedEffect(get('Crusader','crusaderSmite'),false),
     ritualDisplayedEffect(get('Monk','palmJudgment'),true)
    ];
    const note=document.querySelector('.ritualPowerNote').textContent;
    return {unbuffed,buffed,note};
   });
   assert(mods.unbuffed[0].includes('Deal 3 damage'));
   assert(mods.buffed[0].includes('Deal 7 damage'));
   assert(mods.unbuffed[1].includes('Deal 6 damage'));
   assert(mods.buffed[1].includes('Deal 10 damage'));
   assert(mods.unbuffed[2].includes('Deal 6 damage')&&mods.buffed[2].includes('Deal 10 damage'));
   assert(mods.note.includes('Relic Power +4'));
   assert.deepEqual(errors,[],label+' browser errors');
   console.log('PASS '+label+': only Cinders tracker, intact controls, accurate Lesser/Greater Relic damage/power for six classes.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
