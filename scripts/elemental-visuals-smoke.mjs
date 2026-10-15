import {chromium} from 'playwright';

// Real-browser regression for Fire/Poison gameplay status, number colors,
// end-of-turn expiration and multiplayer replay. Visuals must not add damage.
const browser=await chromium.launch({headless:true});
const host=await browser.newPage({viewport:{width:1220,height:800}});
const errors=[];
host.on('pageerror',error=>errors.push('host: '+error.message));
try{
 await host.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const result=await host.evaluate(()=>{
  window.alert=()=>{};
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  check(S.started&&S.rogue.enabled,'Game did not start');
  clearTurnTimerInterval();
  S.rooms=[[],[],[],[]];S.queue=[];S.phase='Priest';S.round=3;S.current=0;
  S.bossRevealed=false;S.bossFlags={spores:{}};
  S.desecratedRooms=[false,false,false,false];S.consecrated=[false,false,false,false];
  S.corruption=[0,0,0,0];
  S.elementalRelics={fire:true,poison:true,deckVersion:1};
  S.elementalBurnQueue=[];S.elementalDamageVisuals=[];
  const base=DEMON_TYPES.find(t=>t.key==='imp_lesser')||DEMON_TYPES[0];
  const d={...base,id:'fx-imp-1',greater:false,cur:65,status:{}};
  S.rooms[0]=[d];
  render();
  check(!document.querySelector('[data-elemental]'),'New Demon started with an elemental overlay');
  const target={kind:'demon',d,r:0};
  const before=d.cur;
  dealDamageTarget(target,1,'Basic Attack',{});
  check(d.cur===before-1,'First attack unexpectedly changed damage');
  check(d.status.elementalPoisonHits===1,'First Poison hit counter missing');
  check(S.elementalBurnQueue.length===1,'Fire did not queue for end of turn');
  const art=document.querySelector('#room0 .demonArtWrap');
  check(!!art,'Artwork element missing');
  const layers=[...art.querySelectorAll('.sanctum-elemental-overlay')];
  check(layers.length===2&&layers.some(x=>x.dataset.elemental==='fire')&&layers.some(x=>x.dataset.elemental==='poison'),
   'Fire and Poison artwork overlays did not stack');
  check(layers.every(x=>art.contains(x)),'Elemental overlays escaped artwork container');
  check(!document.querySelector('.sanctum-elemental-mark'),'Old status badge still rendered');
  check(art.querySelectorAll('.sanctum-flame').length===4,
   'Fire must have four animated flame tongues');
  check(art.querySelectorAll('.sanctum-miasma').length===4,
   'Poison must have four drifting gas clouds');
  check(getComputedStyle(art.querySelector('.sanctum-flame')).animationName==='sanctumFlameFlicker',
   'Fire flame animation missing');
  check(getComputedStyle(art.querySelector('.sanctum-miasma')).animationName==='sanctumMiasmaDrift',
   'Poison mist animation missing');
  check(getComputedStyle(art.querySelector('.sanctum-elemental-overlays')).pointerEvents==='none',
   'Visual effects must not block Demon taps');
  const overlaySnapshot=JSON.stringify(S);
  check(document.querySelectorAll('.sanctum-elemental-damage').length===0,
   'First Poison hit must not show extra elemental damage');
  const afterFirst=d.cur;
  dealDamageTarget(target,1,'Basic Attack',{});
  check(d.status.elementalPoisonHits===0,'Second Poison hit must reset hit marker');
  check(d.cur===afterFirst-1-basicAttackDamage(),'Second Poison burst dealt wrong damage');
  check(S.elementalBurnQueue.length===2,'Both Fire burn ticks should be queued');
  check(!art.isConnected||!art.querySelector('[data-elemental="poison"]'),
   'Poison gas incorrectly persisted after second hit');
  const artNow=document.querySelector('#room0 .demonArtWrap');
  check(!!artNow.querySelector('[data-elemental="fire"]')&&!artNow.querySelector('[data-elemental="poison"]'),
   'After Poison burst only Fire flames should remain');
  const poisonEvent=S.elementalDamageVisuals.find(x=>x.kind==='poison');
  check(poisonEvent?.damage===basicAttackDamage(),'Poison event records incorrect actual damage');
  const poisonFloat=document.querySelector('.sanctum-elemental-damage-poison');
  check(poisonFloat?.textContent==='−'+poisonEvent.damage,
   'Green floating Poison damage number missing');
  check(getComputedStyle(poisonFloat).color==='rgb(151, 242, 123)',
   'Poison floating number must be green');
  check(getComputedStyle(poisonFloat).animationDuration==='1.5s',
   'Elemental floating-number animation must last 50% longer (1.5 seconds)');
  const beforeBurn=d.cur;
  endTurn();
  check(S.elementalBurnQueue.length===0,'Fire queue not cleared at end of turn');
  check(d.cur===beforeBurn-2,'Two queued Fire ticks changed their original damage');
  check(!document.querySelector('#room0 [data-elemental="fire"]'),
   'Fire overlay did not disappear when Fire ended');
  const fireEvents=S.elementalDamageVisuals.filter(x=>x.kind==='fire');
  check(fireEvents.length===2&&fireEvents.every(x=>x.damage===1),'Actual Fire damage events wrong');
  const fireFloat=document.querySelector('.sanctum-elemental-damage-fire');
  check(fireFloat&&getComputedStyle(fireFloat).color==='rgb(255, 157, 50)',
   'Orange floating Fire damage number missing');
  check(getComputedStyle(fireFloat).animationDuration==='1.5s',
   'Fire floating-number animation must last 50% longer');
  clearTurnTimerInterval();
  const snapshot=JSON.stringify(S);
  const eventsBefore=document.querySelectorAll('.sanctum-elemental-damage').length;
  render();render();
  check(document.querySelectorAll('.sanctum-elemental-damage').length===eventsBefore,
   'Repeated board renders replayed the same damage event');
  // Confirm a nonlethal Basic Attack still applies Poison when Fire is disabled.
  S.elementalRelics.fire=false;S.elementalBurnQueue=[];
  S.phase='Priest';S.current=0;S.rooms[0]=[d];
  d.status.elementalPoisonHits=0;render();
  dealDamageTarget(target,1,'Basic Attack',{});
  check(!document.querySelector('#room0 [data-elemental="fire"]')&&
   !!document.querySelector('#room0 [data-elemental="poison"]'),
   'Poison-only gas does not work independently of Fire');
  // Confirm no marker after a status-bearing Demon leaves the board.
  S.rooms[0]=[];render();
  check(!document.querySelector('#boardSection [data-elemental]'),
   'Elemental overlay remained after the Demon was removed');
  // Boss artwork must receive the same independent layers, without covering
  // the stat text or changing active Boss Poison/Fire status.
  S.bossRevealed=true;
  S.boss={...BOSSES[0],cur:50,status:{elementalPoisonHits:1}};
  S.elementalBurnQueue=[{kind:'boss',id:String(S.boss.key||S.boss.n),damage:2}];
  render();
  const bossArt=document.querySelector('#bossArea .sanctum-elemental-boss-art');
  check(!!bossArt&&!!bossArt.querySelector('.bossArt'),
   'Boss art wrapper missing');
  check(bossArt.querySelectorAll('.sanctum-elemental-overlay').length===2,
   'Boss must display simultaneous flames and poison gas');
  check(!bossArt.querySelector('.bossName')&&!!document.querySelector('#bossArea .bossName'),
   'Boss overlay must not cover printed stats or ability text');
  S.boss.status.elementalPoisonHits=0;S.elementalBurnQueue=[];render();
  check(!document.querySelector('#bossArea [data-elemental]'),
   'Boss artwork overlays did not expire independently');
  return {snapshot,overlaySnapshot,overlaysBoth:true,bossStacked:true,firstPoisonHit:1,poisonBurst:poisonEvent.damage,
   fireTicks:fireEvents.length,fireRemoved:true,poisonRemoved:true,
   noDuplicateReplay:true,fireColor:'orange',poisonColor:'green'};
 });
 const guest=await browser.newPage({viewport:{width:844,height:390}});
 guest.on('pageerror',e=>errors.push('guest: '+e.message));
 await guest.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const replay=await guest.evaluate(({snapshot,overlaySnapshot})=>{
  S=JSON.parse(overlaySnapshot);S.started=true;clearTurnTimerInterval();
  document.getElementById('setupModal')?.classList.add('hidden');
  render();
  const simultaneous=document.querySelector('#boardSection .demonArtWrap');
  if(!simultaneous||simultaneous.querySelectorAll('.sanctum-elemental-overlay').length!==2)
   throw Error('Remote player did not reconstruct stackable Fire/Poison overlays from shared status');
  S=JSON.parse(snapshot);
  render();
  const floats=document.querySelectorAll('#sanctumElementalDamageLayer .sanctum-elemental-damage');
  if(!floats.length||![...floats].some(x=>x.classList.contains('sanctum-elemental-damage-poison'))||
   ![...floats].some(x=>x.classList.contains('sanctum-elemental-damage-fire')))
   throw Error('Remote player did not replay both elemental damage colors');
  return {replayed:true,fire:[...floats].filter(x=>x.classList.contains('sanctum-elemental-damage-fire')).length,
   poison:[...floats].filter(x=>x.classList.contains('sanctum-elemental-damage-poison')).length};
 },{snapshot:result.snapshot,overlaySnapshot:result.overlaySnapshot});
 await host.waitForTimeout(1900);
 const cleaned=await host.evaluate(()=>document.querySelectorAll('.sanctum-elemental-damage').length===0);
 if(!cleaned)throw Error('Floating Fire and Poison numbers were not cleaned up');
 if(errors.length)throw Error('Browser errors: '+errors.join('; '));
 console.log('ELEMENTAL DAMAGE VISUALS SMOKE PASSED:',JSON.stringify({...result,snapshot:undefined,overlaySnapshot:undefined,replay,cleaned}));
 await guest.close();
}finally{await browser.close();}
