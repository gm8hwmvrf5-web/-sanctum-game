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
  const roomArt=getComputedStyle(document.querySelector('#boardSection .room.gateway')).backgroundImage;
  if(!roomArt.includes('room-gateway.webp'))throw Error('Mockup room art not applied');
  const actions=document.getElementById('gothicPreviewActions');
  const ids=[...actions.querySelectorAll('button')].filter(x=>!x.hidden).map(x=>x.id);
  if(ids.join(',')!=='basicBtn,gothicWardPlaceholder,endBtn,gothicMenuBtn')throw Error('Command sequence '+ids);
  if(typeof document.getElementById('endBtn').onclick!=='function')throw Error('Live End Turn handler lost');
  if(!document.querySelector('.mpStatus'))throw Error('Multiplayer interface missing');
  const rituals=document.querySelectorAll('#ritualPanel .ritual');
  if(rituals.length!==3)throw Error('Ritual count changed');
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
