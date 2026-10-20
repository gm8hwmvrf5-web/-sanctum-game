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
 console.log('PASS Laws opening browser draft:',JSON.stringify(result));
}finally{await browser.close()}
