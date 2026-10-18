import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
for(const cfg of [
 {id:'DESKTOP',width:1536,height:768,isMobile:false},
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
 const jpg=await page.screenshot({type:'jpeg',quality:43,fullPage:false,animations:'disabled'});
 console.log('GOTHIC_'+cfg.id+'_LAYOUT:'+JSON.stringify(data));
 console.log('GOTHIC_'+cfg.id+'_JPEG:'+jpg.toString('base64'));
 if(errors.length)console.log('GOTHIC_'+cfg.id+'_ERRORS:'+JSON.stringify(errors));
 await page.close();
}
await browser.close();
