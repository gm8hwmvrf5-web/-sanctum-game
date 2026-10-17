import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1280,height:800}});
const page=await ctx.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const initial=await page.evaluate(()=>{
  const P=window.SanctumKawaiiPhase3,skins=window.SanctumSkins;
  if(!P)throw Error('Phase 3 art module missing');
  if(skins.get()!=='gothic')throw Error('Default Gothic expected');
  if(P.priestCardCount!==Object.keys(PRIEST_CARD_ARTS).length||P.priestCardCount!==32)throw Error('32 Priest card art mappings');
  if(P.priestClassCount!==Object.keys(CHARACTERS).length||P.priestClassCount!==6)throw Error('Six Priest class portraits');
  if(P.wardCount!==10||P.iconCount!==8)throw Error('Missing Ward or icon variants');
  const expectedRelics=new Set([...RELICS,...(window.__sanctumExtraRelics||[])].map(r=>r.key||r.k||r.id));
  if(P.relicCount!==expectedRelics.size)throw Error('Relic art count incorrect: '+P.relicCount+' vs '+expectedRelics.size);
  for(const [name,path] of Object.entries(PRIEST_CARD_ARTS)){
   if(!P.getPriestArt(name)?.startsWith('data:image/svg+xml'))throw Error('Missing Priest '+name);
  }
  for(const k of expectedRelics){
   if(!P.getRelicArt(k)?.startsWith('data:image/svg+xml'))throw Error('Missing Relic '+k);
  }
  for(const k of ['cinder','thorns','chains','bell','silence','lantern','vigil','absolution','siphon','chalice']){
   if(!P.getWardArt(k)?.startsWith('data:image/svg+xml'))throw Error('Missing Ward '+k);
  }
  return {cards:P.priestCardCount,classes:P.priestClassCount,relics:P.relicCount,wards:P.wardCount,icons:P.iconCount};
 });
 // A game run is needed to open the in-game menu.
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.started);
 const result=await page.evaluate(async()=>{
  const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
  clearTurnTimerInterval();
  const S0=JSON.stringify(S);
  const skins=window.SanctumSkins,Pack=window.SanctumKawaiiPhase3;
  const hand=document.querySelector('.cardArt');
  assert(hand,'Hand must display Priest artwork');
  const gothicBackground=hand.style.backgroundImage;
  assert(gothicBackground.includes('assets/embedded/'),'Gothic Priest card keeps old artwork');
  // Existing CSS background art must swap without updating state or using render().
  skins.set('kawaii');await new Promise(r=>setTimeout(r,60));
  assert(skins.get()==='kawaii','Kawaii setting active');
  const active=document.querySelector('.cardArt');
  const cuteBackground=getComputedStyle(active).backgroundImage;
  assert(cuteBackground.includes('data:image/svg+xml'),'Priest card background uses kawaii SVG');
  const allArt=Object.keys(PRIEST_CARD_ARTS).map(k=>Pack.getPriestArt(k));
  assert(new Set(allArt).size===32,'All 32 Priest cards have unique kawaii art');
  const fixture=document.createElement('img');
  fixture.alt='Exorcist';fixture.src=CHARACTERS.Exorcist.img;
  document.body.append(fixture);
  await new Promise(r=>setTimeout(r,60));
  assert(fixture.getAttribute('src').startsWith('data:image/svg+xml'),'Class portrait swapped');
  // The Ward art selection uses existing inline style --ward-image path.
  const wardFixture=document.createElement('div');
  wardFixture.className='ward-draft-art';
  wardFixture.style.setProperty('--ward-image','url("'+new URL('./assets/wards/ward-cinder.webp',document.baseURI)+'")');
  document.body.append(wardFixture);
  const wardBg=getComputedStyle(wardFixture).backgroundImage;
  assert(wardBg.includes('data:image/svg+xml'),'Cinder Ward artwork replaced in Kawaii');
  // All ten original inline Ward URLs must route to the correct distinct SVG.
  const wardEls=[];
  for(const k of ['cinder','thorns','chains','bell','silence','lantern','vigil','absolution','siphon','chalice']){
   const el=document.createElement('div');
   el.className='ward-draft-art';
   el.style.setProperty('--ward-image','url("'+new URL('./assets/wards/ward-'+k+'.webp',document.baseURI)+'")');
   document.body.append(el);wardEls.push(el);
   assert(getComputedStyle(el).backgroundImage.includes('data:image/svg+xml'),'Ward '+k+' art not applied');
  }
  // Relic popup: insert image without running a gameplay reward/claim action.
  document.getElementById('relicName').textContent=RELICS[0].n;
  document.getElementById('relicModal').classList.remove('hidden');
  Pack.refresh();
  const popupArt=document.querySelector('#relicModal .sanctum-kawaii-relic-art');
  assert(popupArt?.src.startsWith('data:image/svg+xml'),'Reward popup has kawaii Relic illustration');
  assert(getComputedStyle(popupArt).display==='block','Reward popup image visible in Kawaii');
  // Relic Deck contains the full catalog and each card gains an illustration.
  if(typeof window.renderRelicDeckReference!=='function')throw Error('Missing Relic Deck renderer');
  window.renderRelicDeckReference();Pack.refresh();
  const cards=[...document.querySelectorAll('#relicDeckReferenceGrid .relicDeckReferenceCard')];
  assert(cards.length===Pack.relicCount,'Relic Deck card count matches '+Pack.relicCount);
  assert(cards.every(c=>c.querySelector('.sanctum-kawaii-relic-art')?.getAttribute('src')?.startsWith('data:image/svg+xml')),'All Relic Deck cards have art');
  assert(getComputedStyle(cards[0].querySelector('.sanctum-kawaii-relic-art')).display==='block','Relic Deck images visible');
  const cssIcon=getComputedStyle(document.querySelector('#boardSection .room.gateway')).backgroundImage;
  assert(cssIcon.includes('data:image/svg+xml'),'Phase 2 room artwork retained');
  assert(JSON.stringify(S)===S0,'Skin artwork must never mutate game state');
  // Switching back must completely restore Gothic art on cards and portraits.
  skins.set('gothic');await new Promise(r=>setTimeout(r,60));
  const originalBack=getComputedStyle(active).backgroundImage;
  assert(!originalBack.includes('data:image/svg+xml'),'Gothic Priest original background restored');
  assert(fixture.getAttribute('src')===CHARACTERS.Exorcist.img,'Original Gothic Priest class portrait restored');
  assert(!getComputedStyle(wardFixture).backgroundImage.includes('data:image/svg+xml'),'Original Gothic Ward art restored');
  assert(getComputedStyle(popupArt).display==='none','Extra Relic art hidden in Gothic');
  assert(JSON.stringify(S)===S0,'Gothic switch must leave game state unchanged');
  skins.set('kawaii');await new Promise(r=>setTimeout(r,60));
  assert(getComputedStyle(active).backgroundImage.includes('data:image/svg+xml'),'Can reenable Kawaii without restarting');
  return {relicDeck:cards.length,priestArt:true,classPortrait:true,wardIllustrations:wardEls.length,kawaiiRestored:true};
 });
 await page.evaluate(()=>{document.getElementById('relicModal').classList.add('hidden');if(!window.openGameMenu())throw Error('Could not open paused menu')});
 await page.setViewportSize({width:844,height:390});
 await page.locator('#sanctumSkinSelect').scrollIntoViewIfNeeded();
 const mobile=await page.evaluate(()=>({mode:SanctumSkins.get(),width:document.getElementById('sanctumSkinSelect').getBoundingClientRect().width,fit:document.getElementById('sanctumSkinSelect').getBoundingClientRect().right<=innerWidth+1,
  cardArt:!!document.querySelector('.cardArt')&&getComputedStyle(document.querySelector('.cardArt')).backgroundImage.includes('data:image/svg+xml')}));
 assert(mobile.mode==='kawaii'&&mobile.width>110&&mobile.fit&&mobile.cardArt,'Mobile landscape status');
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>SanctumSkins.get()),'kawaii','Skin persists reload');
 const secondCtx=await browser.newContext();
 const secondPage=await secondCtx.newPage();
 await secondPage.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
 assert.equal(await secondPage.evaluate(()=>SanctumSkins.get()),'gothic','Separate player defaults to Gothic');
 await secondCtx.close();
 assert.deepEqual(errors,[],'Unexpected browser runtime errors');
 console.log('PASS Phase 3: '+JSON.stringify({initial,result,mobile}));
}finally{await ctx.close();await browser.close()}
