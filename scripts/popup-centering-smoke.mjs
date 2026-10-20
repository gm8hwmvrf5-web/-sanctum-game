import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Inspect visible dialog geometry using genuine responsive browser viewports.
// Do not execute gameplay audits or interact with a real multiplayer room.
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
  ['large landscape',{width:1536,height:707}],
  ['desktop',{width:1440,height:900}],
  ['iPad landscape',{width:1024,height:768}],
  ['iPad portrait',{width:768,height:1024}],
  ['iPhone landscape',{width:844,height:390}],
  ['small iPhone landscape',{width:740,height:340}],
  ['iPhone portrait',{width:390,height:844}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label.includes('iPhone'),hasTouch:label.includes('iPhone')});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
   await page.evaluate(()=>{
    document.getElementById('playerCount').value='1';
    document.getElementById('startBtn').click();
    if(!S.started)throw Error('Failed to start single-player game');
    clearTurnTimerInterval();
   });
   // First verify the actual starting Law popup with three choices.
   await page.waitForFunction(()=>document.getElementById('rogueChoiceModal')?.dataset.lawChoice==='1',{timeout:12000});
   for(const id of ['rogueChoiceModal','pauseOverlay','choiceModal','relicModal','cardRevealModal','setupModal','cloudSaveModal']){
    await page.evaluate(id=>{
     for(const popup of document.querySelectorAll('.modal'))popup.classList.add('hidden');
     document.getElementById(id).classList.remove('hidden');
    },id);
    const info=await page.evaluate(id=>{
     const modal=document.getElementById(id),box=modal.querySelector('.modalbox');
     const overlay=modal.getBoundingClientRect(),r=box.getBoundingClientRect();
     return {id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
      width:r.width,height:r.height,cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2,
      visibleWidth:innerWidth,visibleHeight:innerHeight,
      overlayWidth:overlay.width,overlayHeight:overlay.height,
      scrollH:box.scrollHeight,clientH:box.clientHeight,
      hasVerticalScroll:getComputedStyle(box).overflowY!=='hidden',
      lawCards:document.getElementById('rogueChoiceGrid')?.children.length};
    },id);
    const m=label+' '+id+' '+JSON.stringify(info);
    assert(info.width>0 && info.height>0,'Dialog remains visible '+m);
    assert(info.left>=5&&info.right<=info.visibleWidth-5,'Popup must stay within horizontal edges '+m);
    assert(info.top>=3&&info.bottom<=info.visibleHeight-3,'Popup must stay within vertical edges '+m);
    assert(Math.abs(info.cx-info.visibleWidth/2)<3,'Popup must be horizontally centered '+m);
    if(info.height < info.visibleHeight-18)assert(Math.abs(info.cy-info.visibleHeight/2)<4,'Popup must be vertically centered '+m);
    assert(info.overlayWidth<=info.visibleWidth+1,'Backdrop cannot overflow width '+m);
    assert(info.hasVerticalScroll,'Tall modal content stays scrollable '+m);
    if(id==='rogueChoiceModal'){
     assert.equal(info.lawCards,3,'All three Law choices must remain');
     const limit=label==='iPhone portrait'?.95:label.includes('iPhone landscape')?.895:.955;
     assert(info.width<=info.visibleWidth*limit+2,'Law popup should be 5% narrower '+m);
    }
   }
   assert.deepEqual(errors,[],label+' browser errors');
   console.log('PASS '+label+': centered Laws, Menu, choice, relic and reader popups; safe edges and scrolling.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
