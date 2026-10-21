import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Display-only smoke: five approved transparent artwork overlays on top of
// existing Gothic rooms, with room interaction and layout preserved.
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
  ['desktop',{width:1440,height:900}],
  ['iPad landscape',{width:1024,height:768}],
  ['iPhone landscape',{width:844,height:390}],
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
    if(!S.started)throw Error('Game startup did not complete');
    if(S.rogue?.laws?.offer?.keys?.length===3){
     window.__sanctumLawChoose(S.rogue.laws.offer.keys[0]);
     document.getElementById('rogueChoiceModal').classList.add('hidden');
    }
    clearTurnTimerInterval();
    render();
   });
   const info=await page.evaluate(async()=>{
    const keys=['gateway','hall','chapel','crypt','boss'];
    const rows=[];
    for(const key of keys){
     const room=document.querySelector('#boardSection > .room.'+key);
     const overlay=room?.querySelector(':scope > .roomEnergyFrame');
     if(!room||!overlay){rows.push({key,missing:true});continue}
     const cs=getComputedStyle(overlay),bg=getComputedStyle(room);
     const rect=room.getBoundingClientRect(),frame=overlay.getBoundingClientRect();
     const url=new URL('./assets/room-borders/energy-'+key+'.webp',location.href).href;
     const img=new Image();img.src=url;await img.decode();
     const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
     const ctx=canvas.getContext('2d');
     // A 1×1 crop at image center: opaque artwork would conceal game cards.
     ctx.drawImage(img,Math.floor(img.naturalWidth/2),Math.floor(img.naturalHeight/2),1,1,0,0,1,1);
     const centerAlpha=ctx.getImageData(0,0,1,1).data[3];
     rows.push({key,source:cs.borderImageSource,pointerEvents:cs.pointerEvents,
      visible:cs.display!=='none',position:cs.position,z:cs.zIndex,
      imageSlice:cs.borderImageSlice,borderWidth:parseFloat(cs.borderTopWidth),
      background:bg.backgroundImage,area:[rect.width,rect.height],
      frame:[frame.width,frame.height],
      natural:[img.naturalWidth,img.naturalHeight],centerAlpha});
    }
    return {rows,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      priest:!!document.getElementById('basicBtn'),rituals:document.querySelectorAll('#ritualPanel button[data-rit]').length};
   });
   const desc=label+' '+JSON.stringify(info);
   assert.equal(info.rows.length,5,desc);
   assert(info.rows.every(r=>!r.missing),'All five room frames mounted '+desc);
   assert(info.rows.every(r=>r.source.includes('energy-'+r.key+'.webp')),'Each room has correct color overlay '+desc);
   assert(info.rows.every(r=>r.visible&&r.position==='absolute'&&r.pointerEvents==='none'),'Frames remain decorative and click-through '+desc);
   assert(info.rows.every(r=>r.centerAlpha<=4),'Approved transparent centers preserved '+desc);
   assert(info.rows.every(r=>r.natural[0]===1695&&r.natural[1]>=170),'Full-resolution source border slices load '+desc);
   assert(info.rows.every(r=>r.frame[0]>0&&Math.abs(r.frame[0]-r.area[0])<=6&&Math.abs(r.frame[1]-r.area[1])<=6),'Energy overlay tracks responsive room size '+desc);
   assert(info.rows.every(r=>r.background.includes('url(')),'Original Gothic room artwork remains '+desc);
   assert(info.scrollWidth<=info.viewport+3,'Overlay must not cause horizontal overflow '+desc);
   assert(info.priest&&info.rituals===3,'Priest controls remain available '+desc);
   assert.deepEqual(errors,[],label+' game JS errors');
   console.log('PASS '+label+': five thin, transparent energy borders, art retained, hit targets unaffected, no clipping.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
