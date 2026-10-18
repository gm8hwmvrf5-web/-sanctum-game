import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
for(const cfg of [
 {id:'DESKTOP',width:1672,height:941,isMobile:false},
 {id:'IPHONE',width:844,height:390,isMobile:true}
]){
 const page=await browser.newPage({viewport:{width:cfg.width,height:cfg.height},isMobile:cfg.isMobile,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(500);
 await page.evaluate(()=>{
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
 });
 await page.waitForTimeout(900);
 const data=await page.evaluate(()=>{
  // Dismiss instructional dialogs for the sole purpose of examining a gameplay screenshot.
  for(const m of document.querySelectorAll('.modal,#rogueTutorialIntro,#rogueTutorialCoach')){
   m.classList.add('hidden');
  }
  document.querySelectorAll('.tutorialOverlay,.tutorialShade').forEach(m=>m.classList.add('hidden'));
  if(typeof window.__sanctumGothicPreview?.mount==='function')window.__sanctumGothicPreview.mount();
  const rect=el=>{const r=el?.getBoundingClientRect();return r?{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}:null};
  const selectors=['#gothicPreviewHeader','#boardSection','#handPanel','.handCharacterCards','#gothicRitualHeading','#ritualPanel','#gothicPreviewActions'];
  return Object.fromEntries(selectors.map(s=>[s,rect(document.querySelector(s))]));
 });
 await page.waitForTimeout(350);
 const jpg=await page.screenshot({type:'jpeg',quality:77,fullPage:false,animations:'disabled'});
 const hud=await page.evaluate(()=>{
   const h=document.getElementById('topStatusBar');
   const rectangle=(e)=>{let r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]};
   return {hud:rectangle(h),css:{display:getComputedStyle(h).display,columns:getComputedStyle(h).gridTemplateColumns},items:[...h.children].map(el=>({id:el.id,cls:el.className,display:getComputedStyle(el).display,position:getComputedStyle(el).position,rect:rectangle(el),b:el.querySelector(':scope>b')?rectangle(el.querySelector(':scope>b')):null,text:el.textContent.trim().slice(0,90)}))};
 });
 const nav=await page.evaluate(()=>[...document.querySelectorAll('#handPanel .carouselNav')].map(el=>{
  const b=el.getBoundingClientRect();return {text:el.textContent,cls:el.className,parent:el.parentElement?.className,rect:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]};
 }));
 console.log('GOTHIC_'+cfg.id+'_NAV:'+JSON.stringify(nav));
 console.log('GOTHIC_'+cfg.id+'_HUD:'+JSON.stringify(hud));
 console.log('GOTHIC_'+cfg.id+'_LAYOUT:'+JSON.stringify(data));
 console.log('GOTHIC_'+cfg.id+'_JPEG:'+jpg.toString('base64'));
 if(errors.length)console.log('GOTHIC_'+cfg.id+'_ERRORS:'+JSON.stringify(errors));
 await page.close();
}
await browser.close();
