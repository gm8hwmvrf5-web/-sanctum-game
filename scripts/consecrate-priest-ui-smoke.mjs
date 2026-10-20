import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// One focused, headless browser UI check. No complete combat audit.
const browser=await chromium.launch({headless:true});
const errors=[];
for(const [label,viewport] of [
 ['desktop',{width:1280,height:760}],
 ['iPhone landscape',{width:844,height:390}]
]){
 const page=await browser.newPage({viewport,isMobile:label!=='desktop',hasTouch:label!=='desktop'});
 page.on('pageerror',e=>errors.push(label+': '+e.message));
 try{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
  await page.evaluate(()=>{
   document.getElementById('playerCount').value='1';
   document.getElementById('startBtn').click();
   if(!S.started)throw Error('New run failed to start');
   if(S.rogue?.laws?.offer?.keys?.length===3){
    window.__sanctumLawChoose(S.rogue.laws.offer.keys[0]);
    document.getElementById('rogueChoiceModal').classList.add('hidden');
   }
   clearTurnTimerInterval();
   // Force the same empty-room state the normal board displays.
   S.rooms=[[],[],[],[]];
   S.mana=10;
   S.players[0].blood=5;
   S.players[0].consecrateUsed=false;
   S.consecrated=[false,false,false,false];
   S.rogue.laws.active=[];
   render();
  });
  const result=await page.evaluate(()=>{
   const bossHelp=document.getElementById('bossArea');
   if(bossHelp?.textContent.trim())throw Error('Boss Room must contain no pre-boss helper text');
   const oldButtons=document.querySelectorAll('[data-cons]');
   const empty=[...document.querySelectorAll('#room0,#room1,#room2,#room3')].filter(x=>x.textContent.includes('Empty'));
   const end=document.getElementById('endBtn');
   const priestAction=document.getElementById('consecrateBtn');
   const uses=[...document.querySelectorAll('#ritualPanel button[data-rit]')];
   const cards=[...document.querySelectorAll('#ritualPanel .ritualMain .rituals > .ritual')];
   const cardBounds=cards.map(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
   const buttonBounds=uses.map(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
   const handPanel=document.getElementById('handPanel').getBoundingClientRect();
   return {roomButtons:oldButtons.length,emptyLabels:empty.length,cardBounds,buttonBounds,handBottom:handPanel.bottom,
    adjacent:end?.nextElementSibling===priestAction,
    consecrateVisible:!!priestAction&&!priestAction.disabled&&getComputedStyle(priestAction).display!=='none',
    rituals:uses.map(x=>({height:x.getBoundingClientRect().height,minHeight:getComputedStyle(x).minHeight})),
    buttons:uses.length};
  });
  assert.equal(result.roomButtons,0,label+' Consecrate buttons must leave rooms');
  assert.equal(result.emptyLabels,0,label+' rooms must have no Empty label');
  assert.equal(result.adjacent,true,label+' Consecrate must follow End Turn');
  assert.equal(result.consecrateVisible,true,label+' Priest Consecrate control must be visible');
  assert.equal(result.buttons,3,label+' must retain three Ritual actions');
  assert.equal(result.cardBounds.length,3);
  const bottoms=result.cardBounds.map(x=>x.bottom);
  const buttonTops=result.buttonBounds.map(x=>x.top);
  const buttonBottoms=result.buttonBounds.map(x=>x.bottom);
  assert(Math.max(...bottoms)-Math.min(...bottoms)<=1.5,
    label+' Ritual borders must share a bottom line: '+JSON.stringify(result.cardBounds));
  assert(Math.max(...buttonTops)-Math.min(...buttonTops)<=1.5,
    label+' Ritual Use buttons must align on the same row: '+JSON.stringify(result.buttonBounds));
  assert(Math.max(...buttonBottoms)-Math.min(...buttonBottoms)<=1.5,
    label+' Ritual Use buttons must end on the same line: '+JSON.stringify(result.buttonBounds));
  assert(result.handBottom-Math.max(...bottoms)<=30,
    label+' Rituals should extend close to hand panel bottom edge: '+JSON.stringify(result));
  const maxH=label==='desktop'?34:30;
  assert(result.rituals.every(x=>x.height<=maxH),
   label+' ritual use buttons should be thinner: '+JSON.stringify(result.rituals));
  await page.locator('#consecrateBtn').click();
  const chooser=await page.evaluate(()=>{
   const modal=document.getElementById('consecrateModal'),opts=[...modal.querySelectorAll('[data-consecrate-room]')];
   return {visible:!modal.classList.contains('hidden'),options:opts.map(x=>({
    room:x.querySelector('strong')?.textContent,cost:x.querySelector('.consecrate-room-cost')?.textContent,
    effect:x.querySelector('.consecrate-room-effect')?.textContent,disabled:x.disabled
   }))};
  });
  assert.equal(chooser.visible,true,label+' Consecrate chooser is visible');
  assert.deepEqual(chooser.options.map(x=>x.room),['Gateway','Hall','Chapel','Crypt']);
  assert(chooser.options.every(x=>x.cost==='Cost: 3 Shared Mana + 1 Demon Blood'&&!x.disabled&&x.effect.length>20));
  await page.locator('[data-consecrate-room="1"]').click();
  const after=await page.evaluate(()=>({
   mana:S.mana,blood:S.players[0].blood,used:S.players[0].consecrateUsed,
   hall:S.consecrated[1],closed:document.getElementById('consecrateModal').classList.contains('hidden')
  }));
  assert.deepEqual(after,{mana:7,blood:4,used:true,hall:true,closed:true},
   label+' Consecration applies only the selected Hall effect/cost');
  // New Priest turn and Last Benediction must correctly price the popup at 4 Mana.
  await page.evaluate(()=>{
   S.players[0].consecrateUsed=false;
   S.consecrated=[false,false,false,false];
   S.rogue.laws.active=['lastBenediction'];
   S.mana=9;S.players[0].blood=6;
   render();
  });
  await page.locator('#consecrateBtn').click();
  const lawCost=await page.locator('[data-consecrate-room="2"] .consecrate-room-cost').textContent();
  assert.equal(lawCost,'Cost: 4 Shared Mana + 1 Demon Blood');
  await page.locator('[data-consecrate-room="2"]').click();
  const lawAfter=await page.evaluate(()=>({mana:S.mana,blood:S.players[0].blood,chapel:S.consecrated[2]}));
  assert.deepEqual(lawAfter,{mana:5,blood:5,chapel:true},'Last Benediction deducts 4 Mana');
  console.log('PASS '+label+': no Empty, one Priest Consecrate, 4 priced room choices, correct effects/costs, thin Ritual buttons.');
 }finally{await page.close()}
}
assert.deepEqual(errors,[],'Unexpected browser JavaScript errors');
await browser.close();
