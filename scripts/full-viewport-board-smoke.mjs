import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
  ['desktop',{width:1440,height:900}],
  ['wide desktop',{width:1920,height:1080}],
  ['landscape iPad',{width:1024,height:768}],
  ['wide tablet',{width:1180,height:820}],
  ['iPhone landscape',{width:844,height:390}],
  ['small iPhone landscape',{width:740,height:340}],
  ['iPad portrait',{width:768,height:1024}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label.includes('iPhone'),hasTouch:label.includes('iPhone')});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
   await page.evaluate(()=>{
    document.getElementById('playerCount').value='1';
    document.getElementById('startBtn').click();
    if(!S.started)throw Error('Game did not start');
    if(S.rogue?.laws?.offer?.keys?.length===3){
     window.__sanctumLawChoose(S.rogue.laws.offer.keys[0]);
     document.getElementById('rogueChoiceModal').classList.add('hidden');
    }
    clearTurnTimerInterval();
    render();
   });
   for(const mode of ['auto','19.5:9','4:3']){
    await page.evaluate(mode=>window.SanctumAspectRatio.set(mode),mode);
    const m=await page.evaluate(()=>{
     const box=selector=>{
      const r=document.querySelector(selector)?.getBoundingClientRect();
      return r&&{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
     };
     return {app:box('body > .app'),board:box('#boardSection'),
      rooms:[...document.querySelectorAll('#boardSection > .room')].map(x=>{
       const r=x.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom};
      }),stat:box('#topStatusBar'),hand:box('#handPanel'),
      scrollWidth:document.documentElement.scrollWidth,
      scrollHeight:document.documentElement.scrollHeight,
      screenW:window.innerWidth,screenH:window.innerHeight};
    });
    const err=label+' '+mode+' '+JSON.stringify(m);
    assert(m.app.width>=m.screenW*.975,'Game cannot be letterboxed: '+err);
    assert(m.board.width>=m.screenW*.95,'Rooms must span the screen width: '+err);
    assert.equal(m.rooms.length,5,'All five rooms remain: '+err);
    assert(m.scrollWidth<=m.screenW+3,'No horizontal overflow: '+err);
    assert(m.stat.top>=m.board.bottom-2,'Status below board: '+err);
    assert(m.hand.top>=m.stat.bottom-2,'Priest controls below status: '+err);
    if(viewport.width>viewport.height){
     const min=label.includes('iPhone')?123:Math.max(200,.29*m.screenH);
     assert(m.rooms.every(r=>r.height>=min),'Rooms must expand vertically: '+err);
     const widths=m.rooms.map(r=>r.width);
     assert(Math.max(...widths)-Math.min(...widths)<4,'Five rooms share available width: '+err);
     // When the UI fits, there is no unused brick area beneath the Priest panel.
     if(m.scrollHeight<=m.screenH+8){
      assert(m.screenH-m.hand.bottom<35,'Priest UI should anchor to viewport bottom: '+err);
     }else{
      assert(m.hand.bottom>=m.screenH-38,'Short screens scroll rather than clip Priest UI: '+err);
     }
    }
   }
   assert.deepEqual(errors,[],'Browser errors '+label);
   console.log('PASS '+label+': full-width board, expanding rooms, Priest UI below, no clipping.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
