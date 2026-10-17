import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1280,height:800}});
const page=await ctx.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const first=await page.evaluate(()=>{
  const check=(value,msg)=>{if(!value)throw new Error(msg)};
  check(SanctumSkins.get()==='gothic','Default skin Gothic');
  check(window.SanctumKawaiiArt,'Phase 2 artwork module loaded');
  check(SanctumKawaiiArt.roomCount===5&&SanctumKawaiiArt.demonCount===35&&SanctumKawaiiArt.bossCount===10,'Expected 5/35/10 artwork catalog');
  const gothicRooms=['gateway','hall','chapel','crypt','boss'].map(k=>getComputedStyle(document.querySelector('.room.'+k)).backgroundImage);
  check(gothicRooms.every(x=>!x.includes('data:image/svg+xml')),'Gothic rooms retain original art');
  return {gothicRooms:gothicRooms.length,artCount:SanctumKawaiiArt.nameCount};
 });
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.started);
 const states=await page.evaluate(async()=>{
  clearTurnTimerInterval();
  const check=(value,msg)=>{if(!value)throw new Error(msg)};
  const before=JSON.parse(JSON.stringify(S));
  const fixtures=[];
  for(const demon of DEMON_TYPES){
   for(const greater of [false,true]){
    const img=document.createElement('img');
    img.setAttribute('alt',greater?demon.g:demon.n);
    img.setAttribute('src',greater?demon.gart:demon.art);
    img.dataset.kawaiiFixture=demon.key+':'+(greater?'g':'l');
    document.body.appendChild(img);
    fixtures.push({el:img,gothic:greater?demon.gart:demon.art});
   }
  }
  for(const boss of BOSSES){
   const img=document.createElement('img');
   img.setAttribute('alt',boss.n);
   img.setAttribute('src',boss.art);
   img.dataset.kawaiiFixture='boss:'+boss.key;
   document.body.appendChild(img);
   fixtures.push({el:img,gothic:boss.art});
  }
  window.__kawaiiTestFixtures=fixtures;
  SanctumSkins.set('kawaii');
  await new Promise(r=>setTimeout(r,120));
  const roomNames=['gateway','hall','chapel','crypt','boss'];
  const roomImages=roomNames.map(k=>getComputedStyle(document.querySelector('.room.'+k)).backgroundImage);
  check(roomImages.every(x=>x.includes('data:image/svg+xml')),'All five kawaii room backgrounds render in CSS');
  const art=fixtures.map(x=>x.el.getAttribute('src')||'');
  check(art.length===80,'All 70 lesser/greater Demon variants plus ten bosses checked');
  check(art.every(src=>src.startsWith('data:image/svg+xml')),'Every Demon and Boss swaps to kawaii SVG');
  check(new Set(art.slice(0,70)).size>=33,'Demon artwork has distinct illustrations');
  check(new Set(art.slice(70)).size===10,'Ten distinct Boss images');
  check(art.every(src=>src.length>1000),'No placeholder/blank images');
  check(SanctumSkins.get()==='kawaii','Theme switched instantly');
  check(localStorage.getItem('sanctum-visual-skin-v1')==='kawaii','Device preference saved');
  check(JSON.stringify(before)===JSON.stringify(S),'Artwork swap does not change gameplay state');
  const save=JSON.parse(compactSaveJSON());
  check(!('skin' in save.state)&&!('visualSkin' in save.state),'Run save excludes device skin');
  const onBoard=document.querySelector('#boardSection .demonArt');
  if(onBoard)check(onBoard.getAttribute('src').startsWith('data:image/svg+xml'),'Actual board Demon art is kawaii');
  SanctumSkins.set('gothic');
  await new Promise(r=>setTimeout(r,120));
  check(fixtures.every(x=>x.el.getAttribute('src')===x.gothic),'All original Gothic art restored');
  check(roomNames.every(k=>!getComputedStyle(document.querySelector('.room.'+k)).backgroundImage.includes('data:image/svg+xml')),'Gothic room art restored');
  SanctumSkins.set('kawaii');
  await new Promise(r=>setTimeout(r,120));
  check(fixtures.every(x=>x.el.getAttribute('src')?.startsWith('data:image/svg+xml')),'Kawaii reenabled without corruption');
  return {checkedArt:art.length,uniqueDemons:new Set(art.slice(0,70)).size,uniqueBosses:new Set(art.slice(70)).size,roomCount:roomImages.length,started:S.started};
 });
 await page.evaluate(()=>{if(!window.openGameMenu())throw Error('Failed to open game menu')});
 await page.locator('#sanctumSkinSelect').waitFor({state:'visible'});
 assert.equal(await page.locator('#sanctumSkinSelect').inputValue(),'kawaii');
 await page.setViewportSize({width:844,height:390});
 const mobile=await page.evaluate(()=>{
  const selector=document.getElementById('sanctumSkinSelect');
  const pos=selector.getBoundingClientRect();
  const roomArt=['gateway','hall','chapel','crypt','boss'].map(k=>getComputedStyle(document.querySelector('.room.'+k)).backgroundImage.includes('data:image/svg+xml'));
  return {selectorWidth:pos.width,selectorRight:pos.right,viewport:innerWidth,rooms:roomArt,active:SanctumSkins.get()};
 });
 assert(mobile.selectorWidth>140&&mobile.selectorRight<=mobile.viewport+2,'Mobile menu fits landscape view');
 assert(mobile.rooms.every(Boolean),'Every mobile room retains kawaii art');
 await page.locator('#sanctumSkinSelect').selectOption('gothic');
 assert.equal(await page.evaluate(()=>SanctumSkins.get()),'gothic');
 await page.locator('#sanctumSkinSelect').selectOption('kawaii');
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>SanctumSkins.get()),'kawaii','Skin persists after reload');
 const other=await browser.newContext();
 const otherPage=await other.newPage();
 await otherPage.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
 assert.equal(await otherPage.evaluate(()=>SanctumSkins.get()),'gothic','Another device defaults to Gothic');
 await other.close();
 assert.deepEqual(errors,[],'No JavaScript page errors');
 console.log('PASS Phase 2 kawaii rooms, 70 Demon forms, 10 Boss art swaps, Gothic restoration, save/multiplayer isolation, mobile landscape and local persistence.',JSON.stringify({first,states,mobile}));
}finally{await ctx.close();await browser.close()}
