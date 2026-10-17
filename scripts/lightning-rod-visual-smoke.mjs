import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const details=await page.evaluate(async()=>{
  window.alert=()=>{};
  const ok=(condition,message)=>{if(!condition)throw Error(message)};
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  ok(S.started,'Game must start');
  clearTurnTimerInterval();
  const demon=(id,key)=>{
   const t=DEMON_TYPES[key];
   return {...t,id,greater:false,hp:30,cur:30,status:{}};
  };
  const [a,b,c,d]=[demon('light-target',0),demon('light-splash-1',1),demon('light-splash-2',2),demon('light-away',3)];
  S.activeRelics=['lightningRod'];
  S.players[0].basic=false;
  S.rooms=[[a,b,c],[d],[],[]];
  S.bossRevealed=false;
  S.phase='Priest';
  S.rogue.floor=2;
  S.rogue.nodeType='battle';
  S.rogue.encounterGoal=100;
  S.elementalDamageVisuals=[];
  S.elementalBurnQueue=[{kind:'demon',id:b.id,owner:0,damage:2}];
  b.status.elementalPoisonHits=1;
  const prior=chooseDamageTarget;
  const crit=basicAttackCritChance;
  try{
   chooseDamageTarget=async()=>({kind:'demon',d:a});
   basicAttackCritChance=()=>0;
   await basicAttack();
  }finally{
   chooseDamageTarget=prior;
   basicAttackCritChance=crit;
  }
  ok(a.cur===28&&b.cur===29&&c.cur===29&&d.cur===30,'Lightning damage rules unchanged');
  const events=S.elementalDamageVisuals.filter(x=>x.kind==='lightning');
  ok(events.length===3,'Lightning events on primary plus two room neighbors');
  const eventsById=Object.fromEntries(events.map(x=>[x.targetId,x]));
  ok(eventsById[a.id].damage===2&&eventsById[b.id].damage===1&&eventsById[c.id].damage===1,'Damage numbers use actual HP loss');
  ok(!eventsById[d.id],'No lightning event outside target room');
  for(const target of [a,b,c]){
   const until=target.status.lightningFxUntil;
   ok(until>Date.now()+4000&&until<Date.now()+5200,'5-second lightning icon expiry stored for '+target.id);
   const card=document.querySelector('#boardSection .demons [data-demon="'+target.id+'"]');
   ok(card&&card.querySelector('.sanctum-elemental-icon-lightning'),'Lightning icon shown for '+target.id);
  }
  const byId=id=>document.querySelector('#boardSection .demons [data-demon="'+id+'"]');
  const sameCard=byId(b.id);
  const lightning=sameCard.querySelector('.sanctum-elemental-icon-lightning');
  const fire=sameCard.querySelector('.sanctum-elemental-icon-fire');
  const poison=sameCard.querySelector('.sanctum-elemental-icon-poison');
  ok(fire&&poison,'Fire/Poison stack with Lightning');
  const sizes=[lightning,fire,poison].map(n=>[n.getBoundingClientRect().width,n.getBoundingClientRect().height]);
  ok(sizes.every(([w,h])=>w===sizes[0][0]&&h===sizes[0][1]),'Lightning icon uses Fire/Poison dimensions');
  ok(lightning.querySelector('svg path')?.getAttribute('fill')==='none','Yellow lightning bolt is outline-only');
  const iconColor=getComputedStyle(lightning).color;
  ok(iconColor==='rgb(241, 212, 72)','Expected yellow icon color: '+iconColor);
  const floating=[...document.querySelectorAll('#sanctumElementalDamageLayer .sanctum-elemental-damage-lightning')];
  ok(floating.length===3,'Yellow floating numbers are shown on all impacted Demons: '+floating.length);
  ok(floating.map(n=>n.textContent).join(',')==='−2,−1,−1','Floating numbers reflect actual hits');
  ok(getComputedStyle(floating[0]).color==='rgb(246, 217, 78)','Numbers are yellow');
  const snap=JSON.parse(JSON.stringify(S));
  ok(snap.rooms[0][1].status.lightningFxUntil===b.status.lightningFxUntil,'Expiry persists in saved/multiplayer state');
  ok(snap.elementalDamageVisuals.some(e=>e.kind==='lightning'),'Damage events serialize for multiplayer playback');
  return {numberCount:floating.length,iconSize:sizes[0],iconColor,damage:events.map(e=>e.damage)};
 });
 // Phone landscape sizes use precisely the same responsive rule for all badges.
 await page.setViewportSize({width:844,height:390});
 const mobile=await page.evaluate(()=>{
  const card=document.querySelector('#boardSection .demons [data-demon="light-splash-1"]');
  const effects=['lightning','fire','poison'].map(k=>card.querySelector('.sanctum-elemental-icon-'+k));
  return effects.map(n=>n?{w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}:null);
 });
 assert(mobile.every(x=>x&&Math.abs(x.w-mobile[0].w)<0.02&&Math.abs(x.h-mobile[0].h)<0.02),'Mobile landscape Lightning matches Fire/Poison: '+JSON.stringify(mobile));
 // Let the five-second status expire without any gameplay turn or re-render.
 await page.waitForFunction(()=>document.querySelectorAll('#boardSection .sanctum-elemental-icon-lightning').length===0,null,{timeout:8200});
 const expired=await page.evaluate(()=>({
  remaining:document.querySelectorAll('#boardSection .sanctum-elemental-icon-lightning').length,
  fire:document.querySelectorAll('#boardSection .sanctum-elemental-icon-fire').length,
  poison:document.querySelectorAll('#boardSection .sanctum-elemental-icon-poison').length,
  numbers:document.querySelectorAll('#sanctumElementalDamageLayer .sanctum-elemental-damage-lightning').length,
  hp:S.rooms.map(room=>room.map(d=>d.cur))
 }));
 assert.equal(expired.remaining,0);
 assert(expired.fire>=1&&expired.poison>=1,'Other statuses must remain after lightning expiry');
 assert.equal(expired.numbers,0,'Numbers use existing transient animation lifecycle');
 assert.deepEqual(expired.hp,[[28,29,29],[30],[],[]],'Five-second icon must not deal extra damage');
 assert.deepEqual(errors,[],'No browser errors');
 console.log('PASS: Lightning Rod real damage, same-size Gothic badges, stacked status icons, yellow floating numbers, serialization, iPhone landscape, and automatic 5s expiry.',JSON.stringify({details,mobile,expired}));
}finally{
 await browser.close();
}