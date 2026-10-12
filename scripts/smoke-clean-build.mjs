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

// Regression: the host's lobby must refresh when a guest joins, even if
// local gameplay state is stale and the Realtime channel emits no INSERT.
const lobbyPage=await browser.newPage({viewport:{width:1280,height:720}});
lobbyPage.on('pageerror',err=>failures.push('lobby pageerror: '+err.message));
await lobbyPage.addInitScript(()=>{
  const game={
    id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    room_code:'ABC234',status:'lobby',state:{stage:'lobby'},
    state_version:0,max_players:4
  };
  const roster=[{
    id:'host-1',game_id:game.id,seat:1,display_name:'Host Tester',
    is_host:true,connected:true,character_key:null
  }];
  window.__mockSanctumRoster=roster;
  window.supabase={
    createClient:()=>({
      rpc:async name=>{
        if(name==='create_sanctum_game')return {
          data:{game_id:game.id,room_code:game.room_code,player_id:'host-1',
            player_token:'test-token',seat:1,state_version:0},error:null
        };
        if(name==='sanctum_heartbeat')return {data:{ok:true,room_status:'lobby'},error:null};
        return {data:null,error:{message:'Unexpected test RPC: '+name}};
      },
      from:()=>({
        select(){return this;},
        eq(){return this;},
        maybeSingle:async()=>({data:{...game},error:null}),
        order:async()=>({data:roster.map(player=>({...player})),error:null})
      }),
      channel:()=>({
        on(){return this;},
        subscribe(callback){
          if(callback)queueMicrotask(()=>callback('SUBSCRIBED'));
          return this;
        }
      }),
      removeChannel:async()=>({error:null})
    })
  };
});
try{
  await lobbyPage.goto('http://127.0.0.1:4173/index.html',{waitUntil:'load',timeout:60000});
  await lobbyPage.locator('#pname0').fill('Host Tester');
  await lobbyPage.locator('#mpHostBtn').click();
  await lobbyPage.waitForFunction(()=>document.querySelector('.mpRoster')?.textContent?.includes('Host Tester'),null,{timeout:8000});
  await lobbyPage.evaluate(()=>{
    S.started=true; // Simulate a locally started game from an earlier session.
    window.__mockSanctumRoster.push({
      id:'guest-2',seat:2,display_name:'Guest Tester',
      is_host:false,connected:true,character_key:null
    });
  });
  await lobbyPage.waitForFunction(()=>document.querySelector('.mpRoster')?.textContent?.includes('Guest Tester'),null,{timeout:8000});
  const count=await lobbyPage.locator('.mpSeat:not(.empty)').count();
  if(count!==2)failures.push('lobby roster expected 2 occupied seats; found '+count);
}catch(err){
  failures.push('lobby roster auto-refresh regression: '+err.message);
}finally{
  await lobbyPage.close();
}

await browser.close();

if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Browser smoke test passed.');
console.log(JSON.stringify(state,null,2));
