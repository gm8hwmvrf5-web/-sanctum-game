import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const failures=[];

page.on('pageerror',err=>failures.push('pageerror: '+err.message));
page.on('console',msg=>{
  if(msg.type()==='error') failures.push('console: '+msg.text());
});
page.on('requestfailed',req=>{
  try{
    const u=new URL(req.url());
    if(u.hostname==='127.0.0.1'||u.hostname==='localhost') failures.push('request failed: '+u.pathname+' '+(req.failure()?.errorText||''));
  }catch{}
});

const response=await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
if(!response||!response.ok()) failures.push('index response was not successful');

await page.waitForTimeout(750);
const state=await page.evaluate(()=>({
  title:document.title,
  board:!!document.getElementById('boardSection'),
  setup:!!document.getElementById('setupModal'),
  multiplayer:!!document.getElementById('sanctumOnlinePanel'),
  startGame:typeof startGame,
  render:typeof render,
  moveDemons:typeof moveDemons,
  loadedScripts:[...document.scripts].filter(s=>s.src).map(s=>new URL(s.src).pathname),
  localBrokenImages:[...document.images].filter(img=>{
    try{
      const u=new URL(img.src);
      return (u.hostname==='127.0.0.1'||u.hostname==='localhost')&&img.complete&&img.naturalWidth===0;
    }catch{return false}
  }).map(img=>img.src)
}));

if(!/Sanctum of the Damned/i.test(state.title)) failures.push('unexpected document title: '+state.title);
if(!state.board) failures.push('boardSection missing');
if(!state.setup) failures.push('setupModal missing');
if(!state.multiplayer) failures.push('multiplayer panel missing');
for(const [name,value] of [['startGame',state.startGame],['render',state.render],['moveDemons',state.moveDemons]]){
  if(value!=='function') failures.push(name+' is not available as a function');
}
if(state.loadedScripts.length<8) failures.push('expected 8 clean JS modules, found '+state.loadedScripts.length);
if(state.localBrokenImages.length) failures.push('broken local images: '+state.localBrokenImages.join(', '));

await browser.close();

if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Browser smoke test passed.');
console.log(JSON.stringify(state,null,2));
