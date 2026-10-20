import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const result=await page.evaluate(async()=>{
  window.alert=()=>{};
  const el=id=>document.getElementById(id);
  el('playerCount').value='1';
  el('startBtn').click();
  // The opener must be synchronous in solo play, not deferred behind
  // game render timers or a passive timer that can be starved.
  if(el('rogueChoiceTitle').textContent!=='Choose Your First Law'||
     el('rogueChoiceModal').classList.contains('hidden'))
   throw Error('Solo startup failed to display the Law choice immediately');
  const wait=()=>new Promise(resolve=>setTimeout(resolve,150));
  for(let i=0;i<22&&!el('rogueChoiceTitle').textContent.includes('Choose Your First Law');i++)await wait();
  if(el('rogueChoiceTitle').textContent!=='Choose Your First Law')throw Error('Starting Law draft did not appear');
  const buttons=[...document.querySelectorAll('#rogueChoiceGrid button')];
  if(buttons.length!==3)throw Error('Expected three unique Law buttons');
  const names=buttons.map(x=>x.querySelector('h3')?.textContent);
  if(new Set(names).size!==3)throw Error('Law offers repeat');
  const offered=S.rogue.laws.offer.keys.slice();
  if(S.phase!=='Law Draft'||S.rogue.laws.active.length)throw Error('Combat was not waiting on the opening Law');
  buttons[1].click();
  if(S.phase!=='Priest'||S.rogue.laws.active[0]!==offered[1]||S.rogue.laws.offer!==null)throw Error('Choosing Law did not resume game');
  if(!el('rogueChoiceModal').classList.contains('hidden'))throw Error('Law modal failed to close');
  if(!document.querySelector('#rogueHud .sanctumLawChip'))throw Error('Active Law missing from HUD');
  clearTurnTimerInterval();
  // Both older saves and live synced state carry active Laws as plain JSON.
  const copy=JSON.parse(JSON.stringify(S));
  if(copy.rogue.laws.active[0]!==offered[1])throw Error('Law did not serialize');
  return {offered:names,selected:copy.rogue.laws.active[0],phase:S.phase};
 });
 assert.equal(result.phase,'Priest');
 assert.deepEqual(errors,[],'Browser JS errors');
 // Landscape phone view: the opening chooser must be visibly on screen,
 // tappable, and able to resume gameplay.
 const phone=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const mobileErrors=[];
 phone.on('pageerror',e=>mobileErrors.push(e.message));
 try{
  await phone.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
  const mobile=await phone.evaluate(()=>{
   document.getElementById('playerCount').value='1';
   document.getElementById('startBtn').click();
   const modal=document.getElementById('rogueChoiceModal');
   const rect=modal.getBoundingClientRect();
   const choices=[...document.querySelectorAll('#rogueChoiceGrid button')];
   const visible=!modal.classList.contains('hidden')&&rect.width>0&&rect.height>0;
   return {visible,choices:choices.length,phase:S.phase,rect:{top:rect.top,bottom:rect.bottom},
    availableHeight:innerHeight,css:getComputedStyle(modal).zIndex};
  });
  assert.equal(mobile.visible,true,'Landscape iPhone Law modal must be visible');
  assert.equal(mobile.choices,3,'Landscape iPhone must offer 3 Laws');
  assert.equal(mobile.phase,'Law Draft');
  assert(mobile.rect.top<mobile.availableHeight&&mobile.rect.bottom>0,'Law modal must intersect phone screen');
  await phone.locator('#rogueChoiceGrid button').first().click();
  assert.equal(await phone.evaluate(()=>S.phase),'Priest','Touch choice must enter combat');
  assert.deepEqual(mobileErrors,[],'Phone browser errors');
 }finally{await phone.close()}
 // Multiplayer-shaped host startup must keep pending draft until the
 // authoritative game_start commit, then open a serialized three-option
 // group choice. This does not fake network availability.
 const online=await browser.newPage({viewport:{width:1050,height:750}});
 try{
  await online.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
  const probe=await online.evaluate(()=>{
   let canChoose=false;
   let seen=0;
   window.__sanctumWardOnlineInfo=()=>({online:true,starting:!canChoose,canChoose});
   window.__sanctumMultiplayerGroupChoice=(meta,choices)=>{
    seen++;
    S.multiplayerVote={open:true,id:'mock-law-choice',category:'reward',
     resolverSeat:1,options:choices.map((x,index)=>({
      index,actionKey:x.actionKey,title:x.title,desc:x.desc
     }))};
    return true;
   };
   document.getElementById('playerCount').value='2';
   setupPlayersUI();
   document.getElementById('startBtn').click();
   if(!S.started||S.players.length!==2)throw Error('Simulated host did not start with two Priests');
   const offered=S.rogue.laws.offer?.keys||[];
   const deferred=!S.multiplayerVote&&offered.length===3;
   canChoose=true;
   window.__sanctumLaws.showPending();
   return {deferred,seen,options:S.multiplayerVote?.options?.map(x=>x.actionKey),
    active:S.rogue.laws.active.length};
  });
  assert.equal(probe.deferred,true,'Multiplayer must wait for authoritative startup');
  assert.equal(probe.seen,1,'Multiplayer should publish one choice when ready');
  assert.equal(probe.options.length,3,'Multiplayer Law draft has three synchronized choices');
  assert(probe.options.every(x=>x.startsWith('law:')));
  assert.equal(probe.active,0,'Selection should be pending, not randomly applied');
 }finally{await online.close()}
 console.log('PASS Laws opening browser draft, landscape phone touch, and multiplayer pending choice:',JSON.stringify(result));
}finally{await browser.close()}
