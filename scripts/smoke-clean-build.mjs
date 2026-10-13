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

const demonCards=await page.evaluate(async()=>{
  const catalog=DEMON_TYPES;
  const added=catalog.filter(d=>d.key.startsWith('new_'));
  const pile=buildDemonDeck();
  const attached=pile.filter(d=>d.crucifixAttached).length;
  document.getElementById('demonDeckBtn').click();
  const pairs=document.querySelectorAll('#demonDeckGrid .deckpair').length;
  const faces=document.querySelectorAll('#demonDeckGrid .deckface.demon').length;
  const allMatch=added.every(d=>
    d.art==='./assets/embedded/'+d.key+'.webp'&&d.gart===d.art);
  const images=[...document.querySelectorAll('#demonDeckGrid .deckpair[data-demon-type^="new_"] img')];
  const artChecks=await Promise.all(images.map(async img=>{
    img.loading='eager';
    try{await Promise.race([
      img.decode(),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('art timeout')),7000))
    ])}catch(_){}
    return {width:img.naturalWidth,height:img.naturalHeight};
  }));
  const artworkLoaded=images.length===20&&
    artChecks.every(x=>x.width===480&&x.height===360);
  document.getElementById('demonDeckClose').click();
  return {
    types:catalog.length,added:added.length,physical:pile.length,attached,
    pairs,faces,artworkLoaded,allMatch,
    printed:added.every(d=>d.hp>0&&d.ghp>0&&d.b>=0&&d.gb>=0&&d.atk>=0&&d.gatk>=0&&!!d.a&&!!d.ga),
    // Greater cards intentionally share their Lesser form artwork for now.
  };
});
if(demonCards.types!==35||demonCards.added!==10||demonCards.physical!==140||
  demonCards.attached!==21||demonCards.pairs!==35||demonCards.faces!==70||
  !demonCards.artworkLoaded||!demonCards.printed||!demonCards.allMatch){
  failures.push('new Demon cards startup check failed: '+JSON.stringify(demonCards));
}
console.log('NEW DEMON CARDS SMOKE:',JSON.stringify(demonCards));


// Lightweight targeted check: Thorn Martyr's actual damage hook, not a deck
// audit. Check Lesser and Greater forms, both ordinary and lethal hits, and
// ensure blocked/zero-damage hits do not trigger retaliation.
const thorn=await page.evaluate(()=>{
  const def=DEMON_TYPES.find(x=>x.key==='new_thorn_martyr');
  if(!def)throw Error('Thorn Martyr definition missing');
  const checks=[];
  for(const greater of [false,true]){
    for(const hit of ['ordinary','lethal','zero']){
      S=freshState();
      S.started=true;
      S.phase='Priest';
      S.boss={...BOSSES[0],cur:BOSSES[0].hp};
      S.players=[{
        name:'Thorn Check',char:Object.keys(CHARACTERS)[0],
        blood:0,hand:[],basic:false,ritualUsed:[false,false,false],
        forceEmpower:false,discardUsed:false,consecrateUsed:false
      }];
      S.rogue={enabled:false};
      S.priestDeck=buildPriestDeck();
      S.demonDeck=buildDemonDeck();
      S.relicDeck=RELICS.map(r=>r.key);
      S.altar=20;
      const demon={...def,id:'thorn-check',greater,cur:greater?def.ghp:def.hp,status:{}};
      S.rooms[0].push(demon);
      const amount=hit==='zero'?0:hit==='lethal'?demon.cur+3:1;
      damageDemon(demon,amount,'Thorn Martyr targeted smoke check');
      const expected=20-(hit==='zero'?0:greater?2:1);
      checks.push({greater,hit,altar:S.altar,expected});
      if(S.altar!==expected)throw Error('Thorn Martyr did not retaliate: '+JSON.stringify(checks.at(-1)));
    }
  }
  S=freshState();
  return checks;
});
console.log('THORN MARTYR TARGETED SMOKE:',JSON.stringify(thorn));

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
        gte(){return this;},
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
