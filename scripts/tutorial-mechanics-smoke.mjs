import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
// Test only the existing instructional UI, not a combat or mechanics audit.
const source=readFileSync('src/js/40-priest-ui.js','utf8');
const guide=readFileSync('index.html','utf8');
const required=['Wardcraft','Laws of Damnation','Crucifix Cards','Fire and Poison',
 'Lightning','Rage / Enrage','Demons Merge','Linked Demons'];
for(const term of required)assert(source.includes(term),'Tutorial should cover '+term);
for(const term of ['Wards','Laws of Damnation','Crucifix','Lightning','Enrage','Serpent','Cinderbrand','Linked Demons'])
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
   assert(initial.active&&initial.started&&initial.tutorial&&initial.step==='Tutorial 1 / 16',
     'Practice should start without changing game logic '+JSON.stringify(initial));
   let titles=[];
   for(let i=0;i<16;i++){
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
    if(i>=1&&i<=4){
     const priestLayout=await page.evaluate(()=>{
      const e=document.getElementById('rogueTutorialCoach'),c=getComputedStyle(e),r=e.getBoundingClientRect();
      return {top:r.top,left:r.left,right:r.right,width:r.width,screenWidth:innerWidth,positioned:e.classList.contains('rogueTutorialTopRight'),cssRight:c.right};
     });
     assert(priestLayout.positioned&&priestLayout.top<35,'Card lessons move tutorial coach to top '+JSON.stringify(priestLayout));
     assert(priestLayout.screenWidth-priestLayout.right<=30,'Card lessons place coach on right '+JSON.stringify(priestLayout));
    }
    if(state.title==='Wardcraft — Protect a Room'||state.title==='Laws of Damnation'){
     const expected=state.title.startsWith('Wardcraft')?'ward':'law';
     const demo=await page.evaluate(()=>({
      open:document.getElementById('rogueChoiceModal').classList.contains('rogueTutorialDemoModal'),
      type:document.getElementById('rogueChoiceModal').dataset.tutorialDemo,
      names:[...document.querySelectorAll('#rogueChoiceGrid [data-tutorial-demo-option]')].map(x=>x.textContent.trim()),
      images:[...document.querySelectorAll('#rogueChoiceGrid .ward-draft-art')].map(x=>getComputedStyle(x).backgroundImage)
     }));
     assert(demo.open&&demo.type===expected&&demo.names.length===3,'Correct practice choice opens automatically '+JSON.stringify(demo));
     if(expected==='ward'){
      const images=await page.evaluate(async()=>{
       const imgs=[...document.querySelectorAll('#rogueChoiceGrid .rogueTutorialWardIllustration')];
       await Promise.all(imgs.map(i=>i.decode()));
       return imgs.map(img=>({
        src:img.getAttribute('src'),ready:img.complete,
        width:img.naturalWidth,height:img.naturalHeight,
        rendered:getComputedStyle(img).display,rect:img.getBoundingClientRect().toJSON()
       }));
      });
      assert.equal(images.length,3,'All three Ward cards must contain an explicit artwork image');
      assert(images.every(x=>x.src.includes('/wards/ward-')&&x.width>40&&x.height>40&&x.rendered!=='none'&&x.rect.width>10&&x.rect.height>8),
       'Ward illustrations must load, decode and be visible, not just a CSS fallback '+JSON.stringify(images));
     }
     await page.locator('#rogueChoiceGrid [data-tutorial-demo-option="0"]').click();
     assert(await page.locator('#rogueChoiceModal').evaluate(el=>el.classList.contains('hidden')),'Practice choice closes after selection');
     assert((await page.locator('#rogueTutorialTask').textContent()).includes('Practice choice'),'Selection is explained');
     const untouched=await page.evaluate(()=>({laws:S.rogue.laws.active,ward:S.wardcraft?.active}));
     assert.equal(untouched.laws.length,0,'Practice Laws do not change live game state');
     assert(!untouched.ward,'Practice Wards do not consume real resources');
    }
    if(state.title==='Crucifix Cards — Hidden Surprises'){
      const modal=page.locator('#crucifixModal');
      assert(await modal.evaluate(x=>!x.classList.contains('hidden')&&x.classList.contains('rogueTutorialCrucifixDemo')),
       'Crucifix example should open automatically');
      const sample=await page.evaluate(async()=>{
        const image=document.querySelector('#crucifixModal .rogueTutorialCrucifixIllustration');
        await image.decode();
        return {name:document.getElementById('crucifixName').textContent,
         type:document.getElementById('crucifixType').textContent,
         text:document.getElementById('crucifixEffect').textContent,
         image: {source:image.getAttribute('src'),w:image.naturalWidth,h:image.naturalHeight},
         result:document.getElementById('crucifixResult').textContent,
         deck:S.crucifixDeck.length,discard:S.crucifixDiscard.length,
         altar:S.altar,mana:S.mana};
      });
      assert(sample.name==='Sealed Passage'&&sample.type==='Blessing'&&sample.text.includes('Gateway'),JSON.stringify(sample));
      assert(sample.image.w>40&&sample.image.h>40&&sample.image.source.endsWith('.webp'),'Existing Crucifix art loads '+JSON.stringify(sample));
      assert(sample.result.includes('TUTORIAL ONLY'),'No side effects promised '+JSON.stringify(sample));
      await page.locator('#crucifixModal .rogueTutorialCrucifixAgain').click();
      const example=await page.evaluate(()=>({
       name:document.getElementById('crucifixName').textContent,
       type:document.getElementById('crucifixType').textContent,
       deck:S.crucifixDeck.length,discard:S.crucifixDiscard.length,
       altar:S.altar,mana:S.mana
      }));
      assert(example.name==='Shattered Reliquary'&&example.type==='Curse','Second reveal demonstrates negative Crucifix');
      assert.deepEqual({deck:example.deck,discard:example.discard,altar:example.altar,mana:example.mana},
       {deck:sample.deck,discard:sample.discard,altar:sample.altar,mana:sample.mana},
       'Tutorial Crucifix must never draw a card or apply effects');
      await page.locator('#crucifixClose').click();
      assert(await modal.evaluate(x=>x.classList.contains('hidden')),'Demo Crucifix closes to tutorial');
    }
    if(state.title==='Linked Demons — Blood Bonds'){
     await page.locator('#rogueTutorialHelperBtn').click();
     const link=await page.evaluate(()=>({
      linked:[...document.querySelectorAll('#boardSection .sanctum-blood-marker-link')].length,
      demons:S.rooms.flat().filter(d=>d.status?.bloodBondPartnerId).map(d=>({id:d.id,key:d.key,attack:demonAttack(d)})),
      shouldLink:S.rooms.flat().filter(d=>d.status?.bloodBondPartnerId).every(d=>window.__sanctumLinkedDemons.isLinked(d))
     }));
     assert(link.shouldLink&&link.linked>=2&&link.demons.length===2&&link.demons[0].key!==link.demons[1].key,
       'Practice shows two different linked Demons with chain badges '+JSON.stringify(link));
    }
    assert(state.body.length>40,'Every lesson has detailed instruction '+i+' '+label);
    assert(state.rect.right<=state.rect.innerW+2&&state.rect.left>=-2,'Coach stays within horizontal screen '+JSON.stringify(state.rect));
    assert(state.rect.top>=-2&&state.rect.bottom<=state.rect.innerH+2,'Coach stays within screen height '+JSON.stringify(state.rect));
    if(i<15)await page.locator('#rogueTutorialNextBtn').click();
   }
   for(const keyword of ['Ward','Laws','Crucifix','Poison','Lightning','Enrage','Merge','Linked Demons']){
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
   console.log('PASS '+label+': Run Guide and all 16 tutorial lessons, safe mobile scrolling, no retained practice state.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
