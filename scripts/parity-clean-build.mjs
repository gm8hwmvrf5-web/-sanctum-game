import { chromium } from 'playwright';

const CLEAN_URL=process.env.CLEAN_URL||'http://127.0.0.1:4173/index.html';
const BASELINE_URL=process.env.BASELINE_URL||'http://127.0.0.1:4174/index.html';

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort()){
      if(['art','gart','id','createdAt','updatedAt','turnTimerRemaining'].includes(key))continue;
      out[key]=stable(value[key]);
    }
    return out;
  }
  return value;
}

async function loadRun(browser,url,label){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const failures=[];
  page.on('pageerror',err=>failures.push(label+' pageerror: '+err.message));
  page.on('console',msg=>{
    if(msg.type()==='error'){
      const text=msg.text();
      if(!/supabase|network|fetch/i.test(text))failures.push(label+' console: '+text);
    }
  });
  page.on('requestfailed',req=>{
    try{
      const u=new URL(req.url());
      if(u.hostname==='127.0.0.1'||u.hostname==='localhost'){
        failures.push(label+' request failed: '+u.pathname+' '+(req.failure()?.errorText||''));
      }
    }catch{}
  });

  await page.addInitScript(()=>{
    let seed=0x5a17c0de;
    Math.random=()=>{
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    };
  });

  const response=await page.goto(url,{waitUntil:'networkidle',timeout:90000});
  if(!response||!response.ok())throw new Error(label+' index failed to load');
  await page.waitForFunction(()=>typeof startGame==='function'&&document.getElementById('startBtn'),{timeout:60000});

  await page.selectOption('#playerCount','1');
  await page.evaluate(()=>{ if(typeof setupPlayersUI==='function')setupPlayersUI(); });
  const timerOptions=await page.locator('#turnTimerSelect option').evaluateAll(opts=>opts.map(o=>o.value));
  if(timerOptions.includes('120'))await page.selectOption('#turnTimerSelect','120');

  // Reset randomness immediately before gameplay begins. The clean build performs
  // different non-game boot work (external assets/modules), so seeding only at
  // document creation can legitimately consume a different number of random calls.
  // From this point forward both builds must consume the exact same gameplay RNG.
  const started=await page.evaluate(()=>{
    // The game intentionally prefers crypto.getRandomValues for deck/Boss
    // randomization. Override both randomness sources with stateless values so
    // parity checks compare mechanics instead of entropy.
    Math.random=()=>0.2718281828459045;
    try{
      Object.defineProperty(globalThis.crypto,'getRandomValues',{
        configurable:true,
        value:array=>{
          for(let i=0;i<array.length;i++)array[i]=0x45d9f3b;
          return array;
        }
      });
    }catch{
      try{
        globalThis.crypto.getRandomValues=array=>{
          for(let i=0;i<array.length;i++)array[i]=0x45d9f3b;
          return array;
        };
      }catch{}
    }
    try{localStorage.removeItem('sanctumBossBagV1')}catch{}
    return startGame();
  });
  if(started!==true)throw new Error(label+' startGame returned '+String(started));

  await page.waitForFunction(()=>{
    try{return !!eval('S')?.started}catch{return false}
  },{timeout:30000});

  async function snap(stage){
    return page.evaluate(stageName=>{
      const get=name=>{try{return eval(name)}catch{return undefined}};
      const s=get('S');
      const priest=get('PRIEST')||[];
      const demons=get('DEMON_TYPES')||[];
      const bosses=get('BOSSES')||[];
      const relics=get('RELICS')||[];
      const chars=get('CHARACTERS')||{};
      const pickCard=c=>c?({
        n:c.n,m:c.m,e:c.e,x:c.x,k:c.k,v:c.v,xv:c.xv,
        empowered:!!c.empowered,empowerPaid:c.empowerPaid===true
      }):null;
      const pickDemon=d=>d?({
        key:d.key,n:d.n,g:d.g,greater:!!d.greater,cur:d.cur,
        hp:d.hp,ghp:d.ghp,b:d.b,gb:d.gb,atk:d.atk,gatk:d.gatk,
        ability:d.ability,gability:d.gability,
        status:d.status?JSON.parse(JSON.stringify(d.status)):{}
      }):null;
      const call=name=>{
        try{
          const fn=get(name);
          return typeof fn==='function'?fn():null;
        }catch{return null}
      };
      return {
        stage:stageName,
        definitions:{
          priestCount:priest.length,
          priestNames:priest.map(c=>c.n),
          demonTypeCount:demons.length,
          demonKeys:demons.map(d=>d.key),
          bossCount:bosses.length,
          bossKeys:bosses.map(b=>b.key),
          relicCount:relics.length,
          relicKeys:relics.map(r=>r.key),
          characterNames:Object.keys(chars)
        },
        state:{
          started:!!s?.started,
          phase:s?.phase,
          players:(s?.players||[]).map(p=>({
            name:p.name,char:p.char,blood:p.blood,basic:!!p.basic,
            hand:(p.hand||[]).map(pickCard),
            ritualUsed:Array.isArray(p.ritualUsed)?[...p.ritualUsed]:[]
          })),
          current:s?.current,
          mana:s?.mana,
          altar:s?.altar,
          defeats:s?.defeats,
          rooms:(s?.rooms||[]).map(room=>room.map(pickDemon)),
          boss:s?.boss?{key:s.boss.key,n:s.boss.n,hp:s.boss.hp,cur:s.boss.cur,b:s.boss.b}:null,
          bossRevealed:!!s?.bossRevealed,
          priestDeck:(s?.priestDeck||[]).map(c=>c.n),
          demonDeck:(s?.demonDeck||[]).map(d=>d.key+':'+(d.greater?'G':'L')),
          relicDeck:[...(s?.relicDeck||[])],
          rogue:s?.rogue?{
            enabled:!!s.rogue.enabled,floor:s.rogue.floor,act:s.rogue.act,
            nodeType:s.rogue.nodeType,encounterGoal:s.rogue.encounterGoal,
            encounterDefeats:s.rogue.encounterDefeats,cinders:s.rogue.cinders,
            relicXp:s.rogue.relicXp
          }:null
        },
        helpers:{
          sharedMana:call('sharedManaRoundValue'),
          normalSpawn:call('normalSpawnCount'),
          basicAttack:call('basicAttackDamage'),
          bossDrain:call('bossDrainAmount')
        },
        dom:{
          handCards:document.querySelectorAll('#handContent .card').length,
          rituals:document.querySelectorAll('#ritualContent .ritual').length,
          onlinePanel:!!document.getElementById('sanctumOnlinePanel')
        }
      };
    },stage);
  }

  const initial=await snap('initial');

  await page.evaluate(()=>{
    if(typeof spawnOne!=='function')throw new Error('spawnOne missing');
    spawnOne(false);
  });
  const afterSpawn=await snap('afterSpawn');

  await page.evaluate(async()=>{
    if(typeof moveDemons!=='function')throw new Error('moveDemons missing');
    const out=moveDemons();
    if(out&&typeof out.then==='function')await out;
  });
  const afterMove=await snap('afterMove');

  if(failures.length)throw new Error(failures.join('\n'));
  await page.close();
  return stable({initial,afterSpawn,afterMove});
}

function assertEqual(a,b,label){
  const aa=JSON.stringify(a);
  const bb=JSON.stringify(b);
  if(aa===bb)return;
  let i=0;
  while(i<aa.length&&i<bb.length&&aa[i]===bb[i])i++;
  throw new Error(
    label+' mismatch near character '+i+'\n'+
    'baseline: '+aa.slice(Math.max(0,i-220),i+500)+'\n'+
    'clean:    '+bb.slice(Math.max(0,i-220),i+500)
  );
}

const browser=await chromium.launch({headless:true});
try{
  const baseline=await loadRun(browser,BASELINE_URL,'baseline');
  const clean=await loadRun(browser,CLEAN_URL,'clean');
  assertEqual(baseline,clean,'Known-good multiplayer-dev parity');
  console.log('Clean rebuild parity test passed.');
  console.log(JSON.stringify({
    priestCards:clean.initial.definitions.priestCount,
    demonTypes:clean.initial.definitions.demonTypeCount,
    bosses:clean.initial.definitions.bossCount,
    relics:clean.initial.definitions.relicCount,
    initialHand:clean.initial.state.players[0]?.hand.length||0,
    initialDemons:clean.initial.state.rooms.reduce((n,r)=>n+r.length,0),
    afterSpawnDemons:clean.afterSpawn.state.rooms.reduce((n,r)=>n+r.length,0)
  },null,2));
}finally{
  await browser.close();
}
