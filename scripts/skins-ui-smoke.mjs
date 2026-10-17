import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const errors=[];
const url='http://127.0.0.1:4173/index.html';
const ctx=await browser.newContext({viewport:{width:1280,height:800}});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(url,{waitUntil:'networkidle',timeout:60000});
 await page.locator('#sanctumSkinSelect').waitFor({state:'attached'});
 const orig=await page.evaluate(()=>{
  if(!window.SanctumSkins)throw Error('Skin engine missing');
  if(window.SanctumSkins.get()!=='gothic')throw Error('Default skin must be Gothic');
  if(document.documentElement.dataset.sanctumSkin!=='gothic')throw Error('Default DOM skin Gothic');
  return {
    titlebar:getComputedStyle(document.querySelector('.titlebar')).backgroundImage,
    body:getComputedStyle(document.body).backgroundImage
  };
 });
 // The Game Menu only appears once a run has started. Verify gameplay
 // first, then toggle without resetting the running single-player state.
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.started===true);
 // The desktop build intentionally hides the small-screen Menu button.
 // Use the same public menu opener as the Tab shortcut.
 await page.evaluate(()=>{if(!window.openGameMenu())throw Error('Unable to open in-game menu')});
 await page.locator('#sanctumSkinSelect').selectOption('kawaii');
 const result=await page.evaluate(()=>{
  const by=sel=>document.querySelector(sel);
  const box=by('#pauseOverlay .pauseBox');
  const room=by('.room.gateway');
  const title=by('.titlebar');
  return {
   stored:localStorage.getItem('sanctum-visual-skin-v1'),
   selected:by('#sanctumSkinSelect').value,
   skin:window.SanctumSkins.get(),
   intro:by('#sanctumSkinDescription').textContent,
   roomRadius:getComputedStyle(room).borderRadius,
   titleRadius:getComputedStyle(title).borderRadius,
   pauseRadius:getComputedStyle(box).borderRadius,
   titleBg:getComputedStyle(title).backgroundImage,
   bodyBg:getComputedStyle(document.body).backgroundImage,
   noThemeInS:!Object.prototype.hasOwnProperty.call(S,'visualSkin')&&
               !Object.prototype.hasOwnProperty.call(S,'skin')&&
               !Object.prototype.hasOwnProperty.call(S,'theme')
  };
 });
 assert.equal(result.skin,'kawaii');
 assert.equal(result.selected,'kawaii');
 assert.equal(result.stored,'kawaii');
 assert(result.intro.includes('artwork remains Gothic'),'Phase 1 art scope is correctly disclosed');
 assert.notEqual(result.titleBg,orig.titlebar,'Title visibly changes');
 assert.notEqual(result.bodyBg,orig.body,'Background visibly changes');
 assert.equal(result.noThemeInS,true,'Skin setting must never write to multiplayer S');
 assert(parseInt(result.roomRadius)>=15,'Pastel room frames should be rounded');
 assert(parseInt(result.pauseRadius)>=20,'Kawaii menu frame should be rounded');
 // Future alternate-art lookup should swap old/new paths safely in both directions.
 const swaps=await page.evaluate(async()=>{
  const skins=window.SanctumSkins;
  const old='./assets/embedded/6224178d-17708.webp';
  const cute='./assets/embedded/28229fd3-25784.webp';
  const img=document.createElement('img');
  img.id='themeArtworkFixture';
  img.setAttribute('src',old);
  document.body.appendChild(img);
  const registered=skins.registerArtwork(old,cute);
  await new Promise(resolve=>setTimeout(resolve,30));
  const mapped=img.getAttribute('src');
  const mapLookup=skins.resolveArtwork(old);
  skins.set('gothic');
  await new Promise(resolve=>setTimeout(resolve,30));
  const reverted=img.getAttribute('src');
  skins.set('kawaii');
  await new Promise(resolve=>setTimeout(resolve,30));
  const reskinned=img.getAttribute('src');
  // Newly rendered card art should inherit the mapping without changing
  // engine/card data paths, because all future art is assigned via src.
  const newImg=document.createElement('img');
  newImg.id='themeNewArtworkFixture';
  newImg.setAttribute('src',old);
  document.body.appendChild(newImg);
  await new Promise(resolve=>setTimeout(resolve,30));
  const dynamicallyMapped=newImg.getAttribute('src');
  skins.set('gothic');
  return {registered,mapped,mapLookup,reverted,reskinned,dynamicallyMapped,
    restoredNewImg:newImg.getAttribute('src')};
 });
 assert.equal(swaps.registered,true);
 assert.equal(swaps.mapped,'./assets/embedded/28229fd3-25784.webp');
 assert.equal(swaps.mapLookup,swaps.mapped);
 assert.equal(swaps.reverted,'./assets/embedded/6224178d-17708.webp');
 assert.equal(swaps.reskinned,swaps.mapped);
 assert.equal(swaps.dynamicallyMapped,swaps.mapped);
 assert.equal(swaps.restoredNewImg,swaps.reverted);
 // Theme persists across reload, and does not require starting a new run.
 await page.evaluate(()=>window.SanctumSkins.set('kawaii'));
 await page.reload({waitUntil:'networkidle',timeout:60000});
 assert.equal(await page.evaluate(()=>window.SanctumSkins.get()),'kawaii');
 assert.equal(await page.locator('#sanctumSkinSelect').inputValue(),'kawaii');
 // Gameplay must remain operational after a skin switch.
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.started&&window.SanctumSkins?.get()==='kawaii');
 const playing=await page.evaluate(()=>{
  clearTurnTimerInterval();
  return {
   mode:window.SanctumSkins.get(),phase:S.phase,
   roomCount:S.rooms.length,playerCount:S.players.length,
   save:JSON.parse(compactSaveJSON()).state
  };
 });
 assert.equal(playing.roomCount,4);
 assert(playing.playerCount>=1);
 assert(!('skin' in playing.save)&&!('visualSkin' in playing.save),'Save contains game only, no per-device skin');
 // The desktop build intentionally hides the small-screen Menu button.
 // Use the same public menu opener as the Tab shortcut.
 await page.evaluate(()=>{if(!window.openGameMenu())throw Error('Unable to open in-game menu')});
 await page.locator('#sanctumSkinSelect').selectOption('gothic');
 assert.equal(await page.evaluate(()=>window.SanctumSkins.get()),'gothic');
 assert.equal(await page.evaluate(()=>S.started),true,'Changing skin must not reset gameplay');
 // Mobile landscape: theme selector fits in paused menu, can toggle in either mode.
 await page.setViewportSize({width:844,height:390});
 await page.locator('#sanctumSkinSelect').scrollIntoViewIfNeeded();
 assert(await page.locator('#sanctumSkinSelect').isVisible(),'Mobile landscape toggle visible');
 await page.locator('#sanctumSkinSelect').selectOption('kawaii');
 const mobile=await page.locator('#sanctumSkinSelect').evaluate(el=>{
  const r=el.getBoundingClientRect(),p=el.closest('.skinSettingsPanel').getBoundingClientRect();
  return {width:r.width,left:r.left,right:r.right,panelWidth:p.width,innerWidth:window.innerWidth,skin:window.SanctumSkins.get()};
 });
 assert.equal(mobile.skin,'kawaii');
 assert(mobile.width>150&&mobile.right<=mobile.innerWidth+1,'Skin menu must fit mobile viewport');
 // A second device/browser context must keep Gothic despite first device's Kawaii.
 const other=await browser.newContext({viewport:{width:844,height:390}});
 const second=await other.newPage();
 await second.goto(url,{waitUntil:'networkidle',timeout:60000});
 const independent=await second.evaluate(()=>({skin:window.SanctumSkins.get(),storage:localStorage.getItem('sanctum-visual-skin-v1')}));
 assert.equal(independent.skin,'gothic');
 assert.equal(independent.storage,null);
 await other.close();
 assert.deepEqual(errors,[],'No JS errors');
 console.log('PASS Phase 1 skin: Gothic default, kawaii live UI, persisted selection, safe artwork mapping, gameplay/save isolation, mobile landscape, independent device preferences.',JSON.stringify({result,swaps,mobile,independent}));
}finally{await ctx.close();await browser.close()}
