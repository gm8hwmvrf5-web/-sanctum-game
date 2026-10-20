import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
  ['desktop',{width:1440,height:720}],
  ['iPhone landscape',{width:844,height:390}],
  ['4:3 tablet',{width:1024,height:768}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label==='iPhone landscape',hasTouch:label==='iPhone landscape'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
   const initial=await page.evaluate(()=>({
    mode:window.SanctumAspectRatio.value,
    selected:document.getElementById('aspectRatioSelect').value,
    width:document.querySelector('.app').getBoundingClientRect().width,
    options:[...document.querySelector('#aspectRatioSelect').options].map(x=>x.value)
   }));
   assert.equal(initial.mode,'auto');
   assert.equal(initial.selected,'auto');
   assert.deepEqual(initial.options,['auto','19.5:9','4:3']);
   // The selector belongs to the paused Game Menu, which is normally
   // hidden behind the opening New Game setup. Show the actual menu
   // surface before using the browser's real dropdown interaction.
   await page.evaluate(()=>document.getElementById('pauseOverlay').classList.remove('hidden'));
   assert.equal(await page.locator('#aspectRatioSelect').isVisible(),true);
   // Paused Game Menu remains the only place the user changes this display preference.
   // Trigger the actual change event so the browser checks binding + storage.
   await page.locator('#aspectRatioSelect').selectOption('19.5:9');
   const wide=await page.evaluate(()=>({
    selected:document.getElementById('aspectRatioSelect').value,
    root:document.documentElement.dataset.sanctumAspect,
    width:document.querySelector('.app').getBoundingClientRect().width,
    saved:localStorage.getItem('sanctum_display_aspect_v1')
   }));
   assert.equal(wide.selected,'19.5:9');
   assert.equal(wide.root,'19.5:9');
   assert.equal(wide.saved,'19.5:9');
   await page.locator('#aspectRatioSelect').selectOption('4:3');
   const tablet=await page.evaluate(()=>({
    mode:window.SanctumAspectRatio.value,
    root:document.documentElement.dataset.sanctumAspect,
    width:document.querySelector('.app').getBoundingClientRect().width,
    saved:localStorage.getItem('sanctum_display_aspect_v1')
   }));
   assert.equal(tablet.mode,'4:3');
   assert.equal(tablet.root,'4:3');
   assert.equal(tablet.saved,'4:3');
   assert(tablet.width<=wide.width+1,label+' 4:3 should not be wider than 19.5:9');
   if(label==='desktop'){
    assert(wide.width>tablet.width+150,
     'Wide vs tablet should make a visible game width difference on desktop '+JSON.stringify({wide,tablet}));
   }
   await page.reload({waitUntil:'networkidle'});
   await page.evaluate(()=>document.getElementById('pauseOverlay').classList.remove('hidden'));
   const persisted=await page.evaluate(()=>({
    mode:window.SanctumAspectRatio.value,
    selected:document.getElementById('aspectRatioSelect').value,
    width:document.querySelector('.app').getBoundingClientRect().width,
    setupVisible:!document.getElementById('setupModal').classList.contains('hidden')
   }));
   assert.equal(persisted.mode,'4:3','Selection persists on reload');
   assert.equal(persisted.selected,'4:3');
   assert.equal(persisted.setupVisible,true,'New Game setup must remain available');
   await page.locator('#aspectRatioSelect').selectOption('auto');
   const restored=await page.evaluate(()=>({
    root:document.documentElement.dataset.sanctumAspect,
    mode:window.SanctumAspectRatio.value,
    width:document.querySelector('.app').getBoundingClientRect().width
   }));
   assert.equal(restored.root,undefined,'Auto mode restores normal responsive layout');
   assert.equal(restored.mode,'auto');
   assert.equal(restored.width,initial.width,'Auto should use original app width');
   // Changing local aspect ratio never changes shared game state or difficulty.
   const before=await page.evaluate(()=>JSON.stringify(S));
   await page.locator('#aspectRatioSelect').selectOption('19.5:9');
   assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'Display mode must not modify game state');
   assert.deepEqual(errors,[],'Browser errors');
   console.log('PASS '+label+': saved local ratios, visible layout adjustment, original Auto, unchanged gameplay state.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
