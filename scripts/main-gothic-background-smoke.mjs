import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
   ['desktop',{width:1440,height:900}],
   ['iPad landscape',{width:1024,height:768}],
   ['iPhone landscape',{width:844,height:390}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label==='iPhone landscape',hasTouch:label==='iPhone landscape'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
   const report=await page.evaluate(async()=>{
     const before=getComputedStyle(document.body,'::before');
     const art=new Image();
     art.src='./assets/backgrounds/sanctum-three-step-altar-bg-6k.webp';
     await art.decode();
     const rect=document.querySelector('body > .app')?.getBoundingClientRect();
     const hand=getComputedStyle(document.querySelector('#handPanel'));
     return {image:before.backgroundImage,size:before.backgroundSize,
       opacity:before.opacity,position:before.backgroundPosition,
       dimensions:[art.naturalWidth,art.naturalHeight],
       appWidth:rect?.width,viewportWidth:innerWidth,
       handBackground:hand.backgroundColor,handImage:hand.backgroundImage};
   });
   assert(report.image.includes('sanctum-three-step-altar-bg-6k.webp'),label+' selected protected-altar art must be the actual body background');
   assert(report.image.includes('linear-gradient'),label+' subtle dark overlay retained for readability');
   assert(report.size.split(',').every(s=>s.trim()==='cover'),label+' art scales proportionally with cover: '+report.size);
   assert.equal(report.opacity,'1',label+' art should be visible and not dimmed by old brick opacity');
   assert.deepEqual(report.dimensions,[6144,3458],label+' full-resolution illustration must decode');
   assert(report.appWidth>=report.viewportWidth*.97,label+' keep full-width responsive layout');
   assert(report.handBackground==='rgba(0, 0, 0, 0)'&&report.handImage==='none',
     label+' Priest overlay remains transparent over the background');
   assert.deepEqual(errors,[],label+' no startup browser errors');
   console.log('PASS '+label+': new Gothic WebP decodes, covers viewport, and remains visible behind transparent Priest UI');
  }finally{await context.close();}
 }
}finally{await browser.close();}
