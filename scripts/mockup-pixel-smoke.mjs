import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const output=[];
for(const spec of [{name:'desktop',width:1536,height:768,isMobile:false},{name:'iphone',width:844,height:390,isMobile:true}]){
 const page=await browser.newPage({viewport:{width:spec.width,height:spec.height},isMobile:spec.isMobile});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{document.getElementById('playerCount').value='1';document.getElementById('startBtn').click()});
 await page.waitForTimeout(300);
 const check=await page.evaluate(async()=>{
  if(!document.documentElement.classList.contains('gothicUiPixelSkin'))throw Error('Pixel skin not loaded');
  const paths=['reference-shell','room-gateway','room-hall','room-chapel','room-crypt','room-boss','parchment-red','parchment-purple','parchment-gold','action-attack','action-ward','action-end','action-menu','banner','crest','hooded-figure'].map(n=>'./assets/ui-gothic/faithful/'+n+'.webp');
  const fetched=await Promise.all(paths.map(async p=>({p,ok:(await fetch(p)).ok})));
  if(fetched.some(x=>!x.ok))throw Error('Art missing: '+JSON.stringify(fetched.filter(x=>!x.ok)));
  const hud=document.getElementById('topStatusBar');
  const visibleHud=[...hud.children].filter(e=>getComputedStyle(e).display!=='none');
  if(visibleHud.length!==5)throw Error('HUD must contain five visible columns, got '+visibleHud.map(e=>e.id||e.className));
  const boxes=visibleHud.map(e=>e.getBoundingClientRect());
  if(boxes.some(b=>b.height<20)||Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))>2)
    throw Error('HUD stats are not centered on one row: '+JSON.stringify(boxes.map(b=>({y:b.y,height:b.height}))));
  const roomArt=getComputedStyle(document.querySelector('#boardSection .room.gateway')).backgroundImage;
  for(const placeholder of document.querySelectorAll('#boardSection .demons > .cap')){
   if(getComputedStyle(placeholder).display!=='none')throw Error('Empty placeholder still visible');
  }
  for(const id of ['turnTimerStat','manaStatBox','altarStatBox','gothicProgressChip','gothicXpHud']){
   const stat=document.getElementById(id);
   if(!stat?.querySelector('.gothicHudIcon svg'))throw Error('Missing centered SVG stat icon '+id);
  }
  if(!getComputedStyle(document.body,'::before').backgroundImage.includes('cathedral-backdrop.svg'))throw Error('Obsolete black backdrop still active');
  if(!roomArt.includes('room-gateway-v2.webp'))throw Error('Mockup room art not applied');
  const actions=document.getElementById('gothicPreviewActions');
  const ids=[...actions.querySelectorAll('button')].filter(x=>!x.hidden).map(x=>x.id);
  if(ids.join(',')!=='basicBtn,gothicWardPlaceholder,endBtn,gothicMenuBtn')throw Error('Command sequence '+ids);
  if(typeof document.getElementById('endBtn').onclick!=='function')throw Error('Live End Turn handler lost');
  if(!document.querySelector('.mpStatus'))throw Error('Multiplayer interface missing');
  const rituals=document.querySelectorAll('#ritualPanel .ritual');
  if(rituals.length!==3)throw Error('Ritual count changed');
  if(!getComputedStyle(document.querySelector('#ritualPanel .ritual')).backgroundImage.includes('ritual-red-v2.webp'))throw Error('Updated reference ritual artwork missing');
  if(!getComputedStyle(document.body,'::before').backgroundImage.includes('reference-cathedral-shell.webp'))throw Error('Reference cathedral background missing');
  const region=el=>{const a=el.getBoundingClientRect();return {x:Math.round(a.x),y:Math.round(a.y),w:Math.round(a.width),h:Math.round(a.height)}};
  return {rooms:[...document.querySelectorAll('#boardSection .room')].map(region),hand:region(document.getElementById('handPanel')),actions:region(actions)};
 });
 if(errors.length)throw Error('Browser exceptions: '+errors.join(' | '));
 output.push({viewport:spec.name,check});
 await page.screenshot({path:'/tmp/sanctum-'+spec.name+'.png',fullPage:false});
 await page.close();
}
await browser.close();
console.log('PIXEL MOCKUP SMOKE PASS',JSON.stringify(output));
