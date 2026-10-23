import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
// Test only the existing instructional UI, not a combat or mechanics audit.
const source=readFileSync('src/js/40-priest-ui.js','utf8');
const guide=readFileSync('index.html','utf8');
const required=['Wardcraft','Laws of Damnation','Crucifix Cards','Fire and Poison',
 'Lightning','Rage / Enrage','Demons Merge'];
for(const term of required)assert(source.includes(term),'Tutorial should cover '+term);
for(const term of ['Wards','Laws of Damnation','Crucifix','Lightning','Enrage','Serpent','Cinderbrand'])
 assert(guide.includes(term),'Run Guide should cover '+term);
assert(!guide.includes('double the previous cycle difficulty'),'Old 2× cycle rule should be fixed');
assert(!guide.includes('gain +5% of base per floor'),'Old 5% scaling description should be fixed');
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
  ['desktop',{width:1280,height:800}],
  ['iPad landscape',{width:1024,height:768}],
  ['iPhone landscape',{width:844,height:390}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label==='iPhone landscape',hasTouch:label==='iPhone landscape'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
   // Both the readable Run Guide and the real practice tutorial must be reachable.
   const has=await page.evaluate(()=>({
     guide:document.getElementById('rogueGuideModal')!=null,
     entry:document.getElementById('setupTutorialBtn')!=null,
     guideContent:document.querySelectorAll('#rogueGuideModal .rogueGuideStep').length,
     guideHeadings:document.querySelectorAll('#rogueGuideModal .rogueGuideHeading').length
   }));
   assert(has.guide&&has.entry,'Guide and tutorial entry exist '+label);
   assert(has.guideContent>=15&&has.guideHeadings>=4,'Guide expanded '+JSON.stringify(has));
   await page.locator('#setupTutorialBtn').click();
   await page.locator('#rogueTutorialBeginBtn').click();
   const initial=await page.evaluate(()=>({
     active:!document.getElementById('rogueTutorialCoach').classList.contains('hidden'),
     step:document.getElementById('rogueTutorialProgress').textContent,
     started:S.started,
     tutorial:window.__sanctumTutorialMode
   }));
   assert(initial.active&&initial.started&&initial.tutorial&&initial.step==='Tutorial 1 / 15',
     'Practice should start without changing game logic '+JSON.stringify(initial));
   let titles=[];
   for(let i=0;i<15;i++){
    const state=await page.evaluate(()=>({
      title:document.getElementById('rogueTutorialTitle').textContent,
      body:document.getElementById('rogueTutorialBody').textContent,
      rect:(()=>{
        const e=document.getElementById('rogueTutorialCoach'),r=e.getBoundingClientRect();
        return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,
          innerH:innerHeight,innerW:innerWidth,scroll:e.scrollHeight,client:e.clientHeight};
      })()
    }));
    titles.push(state.title);
    assert(state.body.length>40,'Every lesson has detailed instruction '+i+' '+label);
    assert(state.rect.right<=state.rect.innerW+2&&state.rect.left>=-2,'Coach stays within horizontal screen '+JSON.stringify(state.rect));
    assert(state.rect.top>=-2&&state.rect.bottom<=state.rect.innerH+2,'Coach stays within screen height '+JSON.stringify(state.rect));
    if(i<14)await page.locator('#rogueTutorialNextBtn').click();
   }
   for(const keyword of ['Ward','Laws','Crucifix','Poison','Lightning','Enrage','Merge']){
    assert(titles.some(t=>t.includes(keyword)),'Missing lesson: '+keyword+' '+JSON.stringify(titles));
   }
   await page.locator('#rogueTutorialNextBtn').click();
   const exit=await page.evaluate(()=>({
     closed:document.getElementById('rogueTutorialCoach').classList.contains('hidden'),
     setup:!document.getElementById('setupModal').classList.contains('hidden'),
     mode:window.__sanctumTutorialMode,
     started:S.started
   }));
   assert(exit.closed&&exit.setup&&!exit.mode&&!exit.started,'Tutorial must discard practice state '+JSON.stringify(exit));
   assert.deepEqual(errors,[],'No JavaScript errors '+label);
   console.log('PASS '+label+': Run Guide and all 15 tutorial lessons, safe mobile scrolling, no retained practice state.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
