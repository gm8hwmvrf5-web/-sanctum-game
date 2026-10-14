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
  check(!document.querySelector('[data-elemental]'),'New Demon started with an elemental icon');
  const target={kind:'demon',d,r:0};
  const before=d.cur;
  dealDamageTarget(target,1,'Basic Attack',{});
  check(d.cur===before-1,'First attack unexpectedly changed damage');
  check(d.status.elementalPoisonHits===1,'First Poison hit counter missing');
  check(S.elementalBurnQueue.length===1,'Fire did not queue for end of turn');
  const art=document.querySelector('#room0 .demonArtWrap');
  check(!!art,'Artwork element missing');
  let marks=[...art.querySelectorAll('.sanctum-elemental-mark')];
  check(marks.length===2&&marks.some(x=>x.dataset.elemental==='fire')&&marks.some(x=>x.dataset.elemental==='poison'),
   'Fire and Poison symbols did not appear together over Demon artwork');
  check(marks.every(x=>art.contains(x)),'Elemental symbols are not attached to artwork');
  check(document.querySelectorAll('.sanctum-elemental-damage').length===0,
   'First Poison hit must not show extra elemental damage');
  const afterFirst=d.cur;
  dealDamageTarget(target,1,'Basic Attack',{});
  check(d.status.elementalPoisonHits===0,'Second Poison hit must reset hit marker');
  check(d.cur===afterFirst-1-basicAttackDamage(),'Second Poison burst dealt wrong damage');
  check(S.elementalBurnQueue.length===2,'Both Fire burn ticks should be queued');
  check(!art.isConnected||!art.querySelector('[data-elemental="poison"]'),
   'Poison marker incorrectly persisted after second hit');
  const artNow=document.querySelector('#room0 .demonArtWrap');
  check(!!artNow.querySelector('[data-elemental="fire"]')&&!artNow.querySelector('[data-elemental="poison"]'),
   'After Poison burst only Fire marker should remain');
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
   'Fire symbol did not disappear when Fire ended');
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
   'Poison-only symbol does not work independently of Fire');
  // Confirm no marker after a status-bearing Demon leaves the board.
  S.rooms[0]=[];render();
  check(!document.querySelector('#boardSection [data-elemental]'),
   'Elemental marker remained after the Demon was removed');
  return {snapshot,iconsBoth:true,firstPoisonHit:1,poisonBurst:poisonEvent.damage,
   fireTicks:fireEvents.length,fireRemoved:true,poisonRemoved:true,
   noDuplicateReplay:true,fireColor:'orange',poisonColor:'green'};
 });
 const guest=await browser.newPage({viewport:{width:844,height:390}});
 guest.on('pageerror',e=>errors.push('guest: '+e.message));
 await guest.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const replay=await guest.evaluate(snapshot=>{
  S=JSON.parse(snapshot);S.started=true;clearTurnTimerInterval();
  document.getElementById('setupModal')?.classList.add('hidden');
  render();
  const floats=document.querySelectorAll('#sanctumElementalDamageLayer .sanctum-elemental-damage');
  if(!floats.length||![...floats].some(x=>x.classList.contains('sanctum-elemental-damage-poison'))||
   ![...floats].some(x=>x.classList.contains('sanctum-elemental-damage-fire')))
   throw Error('Remote player did not replay both elemental damage colors');
  return {replayed:true,fire:[...floats].filter(x=>x.classList.contains('sanctum-elemental-damage-fire')).length,
   poison:[...floats].filter(x=>x.classList.contains('sanctum-elemental-damage-poison')).length};
 },result.snapshot);
 await host.waitForTimeout(1900);
 const cleaned=await host.evaluate(()=>document.querySelectorAll('.sanctum-elemental-damage').length===0);
 if(!cleaned)throw Error('Floating Fire and Poison numbers were not cleaned up');
 if(errors.length)throw Error('Browser errors: '+errors.join('; '));
 console.log('ELEMENTAL DAMAGE VISUALS SMOKE PASSED:',JSON.stringify({...result,snapshot:undefined,replay,cleaned}));
 await guest.close();
}finally{await browser.close();}
