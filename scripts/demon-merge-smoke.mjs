import {chromium} from 'playwright';

// Merge mechanic & visual checks, including the state serialized to a guest.
const browser=await chromium.launch({headless:true});
const host=await browser.newPage({viewport:{width:1120,height:800}});
const errors=[];
host.on('pageerror',e=>errors.push('host: '+e.message));
try{
 await host.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const fixture=await host.evaluate(()=>{
  window.alert=()=>{};
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  const check=(test,message)=>{if(!test)throw Error(message)};
  check(S.started,'Game did not start');
  const first=DEMON_TYPES.find(d=>d.key==='imp_lesser')||DEMON_TYPES[0];
  const base=JSON.stringify(S);
  const demon=(def,id,greater=false)=>({
   ...def,id,greater,cur:greater?def.ghp:def.hp,status:{}
  });
  const reset=()=>{
   clearTurnTimerInterval();S=JSON.parse(base);S.rogue.enabled=false;
   S.round=2;S.phase='Priest';S.rooms=[[],[],[],[]];S.queue=[];
   S.demonMergeVisuals=[];S.pendingCrucifixTransfers=0;
   S.demonDeck=[];S.desecratedRooms=[false,false,false,false];
   S.consecrated=[false,false,false,false];S.corruption=[0,0,0,0];
   S.globalMergeBlock=false;S.blockNextMerge=false;S.roomMergeBlock={};
   selectedDemonId=null;
  };
  reset();
  const left=demon(first,'lesser-hall'),right=demon(first,'lesser-crypt');
  S.rooms[1]=[left];S.rooms[3]=[right];
  render(); // Draw Lesser cards before the authoritative merge.
  check(checkMerge(right),'Matching Lesser Demon did not merge');
  check(S.rooms[0].length===1&&S.rooms[0][0].greater,'Greater did not resurface in Gateway');
  check(S.rooms.slice(1).every(room=>room.length===0),'Merged Lessers remained outside Gateway');
  check(S.rooms[0][0].id==='lesser-hall','Original host identity changed');
  check(S.rooms[0][0].cur===demonMaxHP(S.rooms[0][0]),'Greater HP was not restored');
  const event=S.demonMergeVisuals[0];
  check(event?.sources?.length===2&&event.destination===0,'Synchronized visual event missing');
  check(event.sources[0].room===1&&event.sources[1].room===3,
   'Visual source rooms do not reflect actual merge locations');
  check(event.sources.every(s=>s.art&&s.name),'Merged cards have no art or name');
  render();
  check(document.querySelectorAll('#sanctumDemonMergeLayer .sanctum-merge-lesser').length===2,
   'Both Lesser visual cards did not appear');
  const twins=Array.from(document.querySelectorAll('.sanctum-merge-lesser'));
  check(twins.every(t=>t.getAnimations().length>=1),'Shaking animations did not start on both cards');
  const offsets=twins[0].getAnimations()[0].effect.getKeyframes();
  check(offsets.some(x=>x.offset>.06&&x.offset<.4&&String(x.transform).includes('translateX')),
   'Shake-to-fusion animation does not include alternating oscillations');
  const greater=Array.from(document.querySelectorAll('#room0 .demon')).find(e=>e.dataset.demon==='lesser-hall');
  check(greater?.classList.contains('sanctum-merge-arrival-hidden'),
   'Gateway Greater appeared before shaking cards combined');
  const container=document.getElementById('sanctumDemonMergeLayer');
  check(container.getAttribute('aria-hidden')==='true'&&getComputedStyle(container).pointerEvents==='none',
   'Merge overlay blocks interactive game controls');
  const guestState=JSON.stringify(S);
  return {guestState,base,firstKey:first.key,mergeId:event.id};
 });
 const guest=await browser.newPage({viewport:{width:844,height:390}});
 guest.on('pageerror',e=>errors.push('guest: '+e.message));
 await guest.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const guestReport=await guest.evaluate(serialized=>{
  S=JSON.parse(serialized);S.started=true;
  document.getElementById('setupModal').classList.add('hidden');
  render();
  const ghosts=document.querySelectorAll('.sanctum-merge-lesser');
  if(ghosts.length!==2)throw Error('Multiplayer guest did not replay the serialized two-card merge');
  const vals=[...ghosts].map(g=>g.getBoundingClientRect());
  return {replayed:true,twins:ghosts.length,inViewport:vals.every(r=>r.left>=0&&r.right<=innerWidth)};
 },fixture.guestState);
 await host.waitForTimeout(1600);
 const clean=await host.evaluate(()=>{
  const check=(test,message)=>{if(!test)throw Error(message)};
  check(document.querySelectorAll('.sanctum-merge-ghost').length===0,'Merge visual ghosts were not cleaned up');
  check(window.__sanctumDemonMergeVisualState().busy===false,'Animation remains busy');
  check(document.querySelector('#room0 .demon')?.classList.contains('sanctum-merge-arrival-hidden')!==true,
   'Greater remained invisible after animation');
  return true;
 });
 const mechanics=await host.evaluate(({base,firstKey})=>{
  const check=(test,msg)=>{if(!test)throw Error(msg)};
  const def=DEMON_TYPES.find(d=>d.key===firstKey);
  const demon=(d,id,greater=false)=>({...d,id,greater,cur:greater?d.ghp:d.hp,status:{}});
  const reset=()=>{
   clearTurnTimerInterval();S=JSON.parse(base);S.rogue.enabled=false;
   S.round=2;S.phase='Priest';S.rooms=[[],[],[],[]];
   S.queue=[];S.demonMergeVisuals=[];S.demonDeck=[];
   S.pendingCrucifixTransfers=0;S.globalMergeBlock=false;S.blockNextMerge=false;
   S.roomMergeBlock={};S.consecrated=[false,false,false,false];
   S.corruption=[0,0,0,0];S.desecratedRooms=[false,false,false,false];
  };
  // Two Crucifixes must survive a merger, even when the deck is empty.
  reset();let a=demon(def,'cross-hall'),b=demon(def,'cross-crypt');
  a.crucifixAttached=true;b.crucifixAttached=true;
  S.rooms[1]=[a];S.rooms[3]=[b];
  check(checkMerge(b),'Hidden Crucifix fixture did not merge');
  check(S.rooms[0][0].crucifixAttached===true,'First attached Crucifix was lost');
  check(S.pendingCrucifixTransfers===1,'Second attached Crucifix not transferred');
  // Capacity: 4 Gateway Demons remain four, Lesser preferred for queue.
  reset();let gate=DEMON_TYPES.filter(t=>t.key!==def.key).slice(0,4)
   .map((t,i)=>demon(t,'gate-'+i,i===0));
  S.rooms[0]=gate;S.rooms[1]=[demon(def,'full-hall')];
  S.rooms[3]=[demon(def,'full-crypt')];S.queue=[demon(DEMON_TYPES[8],'already-queued')];
  check(checkMerge(S.rooms[3][0]),'Full Gateway prevented merge');
  check(S.rooms[0].length===4,'Full Gateway exceeds room capacity');
  check(S.rooms[0].some(d=>d.greater&&d.key===def.key),'Greater missing from full Gateway');
  check(S.queue[0].id==='gate-1','An existing Lesser was not queued before Greater arrival');
  check(S.queue[1].id==='already-queued','Preexisting queued Demons changed order');
  check(S.rooms.flat().length+S.queue.length===7,'Demon was lost or duplicated during full-Gateway merge');
  // Room merge protections remain authoritative.
  reset();S.rooms[1]=[demon(def,'shield1')];S.rooms[3]=[demon(def,'shield2')];
  S.globalMergeBlock=true;
  check(!checkMerge(S.rooms[3][0])&&S.demonMergeVisuals.length===0,
   'Global merge prevention did not suppress fusion and visual');
  S.globalMergeBlock=false;S.consecrated[3]=true;
  check(!checkMerge(S.rooms[3][0]),'Consecrated Crypt no longer prevents merge');
  // Spawn-driven merge and entry into the Gateway.
  reset();S.rooms[2]=[demon(def,'spawn-match')];S.queue=[demon(def,'new-spawn')];
  spawnOne(false);
  check(S.rooms[0].length===1&&S.rooms[0][0].greater&&S.rooms[2].length===0,
   'A matching Demon spawned into Gateway did not combine and resurface');
  // Merging in a Demon Phase should not immediately advance the new Greater.
  reset();S.phase='Demon';
  S.rooms[0]=[demon(def,'phase-gateway')];
  S.rooms[2]=[demon(def,'phase-chapel')];
  moveDemons();
  check(S.rooms[0].length===1&&S.rooms[0][0].greater,
   'Greater moved out of Gateway during its merge Demon Phase');
  endRound();
  check(!S.rooms[0][0].status.mergedThisPhase,'Merge movement flag did not clear next round');
  return {crucifixesPreserved:true,roomCap:4,queuedLesser:true,mergeBlock:true,
   spawnMerges:true,mergedGreaterStaysOnePhase:true};
 },{base:fixture.base,firstKey:fixture.firstKey});
 await guest.waitForTimeout(1500);
 const guestDone=await guest.evaluate(()=>({
  cleaned:document.querySelectorAll('.sanctum-merge-ghost').length===0,
  queue:window.__sanctumDemonMergeVisualState().queued
 }));
 if(!guestDone.cleaned)throw Error('Multiplayer guest ghosts were not cleaned up');
 if(errors.length)throw Error('Browser script errors: '+errors.join('; '));
 console.log('DEMON MERGE ANIMATION SMOKE PASSED:',JSON.stringify({
  localShake:clean,guest:guestReport,guestFinished:guestDone,mechanics,
  eventSerialized:true
 }));
 await guest.close();
}finally{await browser.close();}
