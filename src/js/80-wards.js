/* Sanctum Wardcraft: tactical wards atop the existing 2D/Supabase game.
   State and rules are authoritative; DOM effects are cosmetic only. */
(()=>{
'use strict';
if(window.__sanctumWardcraftInstalled)return;
window.__sanctumWardcraftInstalled=true;

const WARDS=Object.freeze([
 {key:'cinder',name:'Cinder Sigil',category:'Offense',mana:3,blood:1,charges:2,trigger:'enter',color:'#ef672b',art:0,desc:'The first Demon entering this room each Demon Phase takes 3 damage (scales by floor). Up to two activations.'},
 {key:'thorns',name:'Thorns of Retribution',category:'Offense',mana:4,blood:1,charges:1,trigger:'defeat',color:'#de463b',art:1,desc:'When a Demon is defeated here, deal 2 damage (scales by floor) to up to two other Demons in the same room.'},
 {key:'chains',name:'Chains of Penitence',category:'Control',mana:3,blood:1,charges:1,trigger:'enter',color:'#84b8ff',art:2,desc:'The first entering Demon is bound and cannot advance in its next Demon Phase.'},
 {key:'bell',name:'Bell of Return',category:'Control',mana:4,blood:2,charges:1,trigger:'enter',color:'#f3bd64',art:3,desc:'Push the first entering Demon back one room. If the prior room is full, stop the Demon instead.',rooms:[1,2,3]},
 {key:'silence',name:'Seal of Silence',category:'Control',mana:3,blood:1,charges:1,trigger:'enter',color:'#c596e5',art:4,desc:'The first entering Demon loses its special ability through its next Demon Phase.'},
 {key:'lantern',name:"Martyr's Lantern",category:'Defense',mana:3,blood:1,charges:1,trigger:'defeat',color:'#ffce7b',art:5,desc:'The first Demon defeated here restores 3 Altar Protection (scales by floor).'},
 {key:'vigil',name:'Vigil of Iron',category:'Defense',mana:2,blood:1,charges:1,trigger:'exit',color:'#e4e8ec',art:6,desc:'The first Demon advancing out of the room permanently loses 2 Attack (scales by floor).'},
 {key:'absolution',name:'Seal of Absolution',category:'Purification',mana:3,blood:0,charges:2,trigger:'defeat',color:'#ffe4a2',art:7,desc:'Each of the next two Demons defeated in this room clears an additional Corruption tracker.'},
 {key:'siphon',name:'Siphon Script',category:'Resources',mana:2,blood:0,charges:1,trigger:'defeat',color:'#6ce8bb',art:8,desc:'The first Demon defeated in this room restores 3 shared Mana, subject to the normal Mana cap.'},
 {key:'chalice',name:'Blood Chalice',category:'Resources',mana:3,blood:0,charges:1,trigger:'defeat',color:'#f06a73',art:9,desc:'The first Demon defeated here grants the killing player 2 additional Demon Blood (up to their normal cap).'}
]);
const lookup=key=>WARDS.find(w=>w.key===key)||null;
const fmt=w=>w.mana+' Mana'+(w.blood?' + '+w.blood+' Blood':'');
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const artStyle=w=>'--ward-image:url("./assets/wards/ward-'+w.key+'.webp");--ward-color:'+w.color+';';
const activeWard=()=>S?.wardcraft?.active||null;
const stage=()=>S&&S.started&&S.phase==='Priest'&&S.rogue?.enabled&&S.rogue.nodeType!=='repository'&&S.rogue.nodeType!=='sanctuary'&&!S.rogue.pendingClear;
const allowed=w=>Array.isArray(w.rooms)?w.rooms:[0,1,2,3];
function ensure(){
 if(!S)return null;
 if(!S.wardcraft||typeof S.wardcraft!=='object')S.wardcraft={selected:null,offers:[],floor:0,active:null,lastPlacementRound:-1};
 const a=S.wardcraft;
 if(!Array.isArray(a.offers))a.offers=[];
 if(a.lastPlacementRound==null)a.lastPlacementRound=-1;
 if(a.active&&(!lookup(a.active.key)||!Number.isInteger(a.active.room)||a.active.room<0||a.active.room>3))a.active=null;
 return a;
}
function scaled(v){return v+Math.min(2,Math.max(0,Math.floor((Math.max(1,(S.rogue?.floor||1))-1)%15/5)));}
function publishRender(){if(typeof render==='function')render();}
function expire(reason){
 const state=ensure();if(!state?.active)return;
 const w=lookup(state.active.key);
 state.active=null;
 if(w&&typeof log==='function')log(w.name+' ends'+(reason?' ('+reason+')':'')+'.','info');
}
function consume(w){
 const state=ensure(),a=state.active;
 if(!a||a.key!==w.key)return;
 a.charges=Math.max(0,(Number(a.charges)||0)-1);
 if(a.charges===0)expire('spent');
}
function canTrigger(kind,room){
 const a=activeWard();
 const w=a&&lookup(a.key);
 if(!w||w.trigger!==kind||a.room!==room||a.charges<=0||a.phasesLeft<=0)return null;
 return w;
}
function applyEntrance(d,room){
 const w=canTrigger('enter',room);
 if(!w||!d||typeof findDemonLocation!=='function'||!findDemonLocation(d))return;
 // A Cinder Sigil can strike only once per Demon Phase even if many Demons enter.
 const a=activeWard();
 if(w.key==='cinder'&&(S.phase!=='Demon'||a.lastEnterRound===S.round))return;
 if(w.key==='cinder')a.lastEnterRound=S.round;
 consume(w);
 if(w.key==='cinder'){
   const n=scaled(3);
   log(w.name+' scorches '+demonName(d)+' for '+n+' damage.','good');
   damageDemon(d,n,w.name);
 }else if(w.key==='chains'){
   d.status=d.status||{};
   // A Demon entering after its normal movement must be held in the next phase.
   d.status.wardBoundThroughRound=S.round+(S.phase==='Demon'?1:0);
   if(typeof applyStop==='function')applyStop(d);
   log(w.name+' binds '+demonName(d)+' until its next Demon Phase.','good');
 }else if(w.key==='bell'){
   const prev=room-1;
   if(prev<0||S.rooms[prev].length>=4){
     if(typeof applyStop==='function')applyStop(d);
     d.status=d.status||{};
     d.status.wardBoundThroughRound=S.round+(S.phase==='Demon'?1:0);
     log(w.name+' holds '+demonName(d)+'; the previous room cannot accept it.','good');
   }else{
     backwardTravel++;
     let moved=false;
     try{moved=moveDemonBackOne(d,w.name)}finally{backwardTravel--;}
     if(!moved){
       if(typeof applyStop==='function')applyStop(d);
       d.status.wardBoundThroughRound=S.round+(S.phase==='Demon'?1:0);
     }
     log(w.name+(moved?' returns ':' stops ')+demonName(d)+'.','good');
   }
 }else if(w.key==='silence'){
   d.status=d.status||{};
   d.status.wardSilencedThroughRound=S.round+(S.phase==='Demon'?1:0);
   log(w.name+' suppresses '+demonName(d)+' until after its next Demon Phase.','good');
 }
 publishRender();
}
function applyDefeat(d,room,killer){
 const w=canTrigger('defeat',room);
 if(!w)return;
 consume(w);
 if(w.key==='thorns'){
   const victims=(S.rooms[room]||[]).filter(x=>x.id!==d.id).slice(0,2);
   if(victims.length){
     log(w.name+' retaliates against '+victims.length+' Demon(s).','good');
     victims.forEach(t=>{if(findDemonLocation(t)?.r===room)damageDemon(t,scaled(2),w.name)});
   }
 }else if(w.key==='lantern'){
   restoreAltarLogged(scaled(3),w.name);
 }else if(w.key==='absolution'){
   if(typeof setRoomCorruption==='function'){
     const n=Math.max(0,Number(S.corruption?.[room]||0));
     setRoomCorruption(room,n-1);
     log(w.name+' removes 1 additional Corruption in '+ROOM_NAMES[room]+'.','good');
   }
 }else if(w.key==='siphon'){
   if(typeof addMana==='function')addMana(3);
   log(w.name+' returns up to 3 shared Mana.','good');
 }else if(w.key==='chalice'){
   if(Number.isInteger(killer)&&S.players?.[killer]){
     const p=S.players[killer],before=Number(p.blood)||0;
     p.blood=Math.min(10,before+2);
     log(w.name+' grants '+(p.blood-before)+' extra Demon Blood to '+(p.name||'the killing Priest')+'.','good');
   }else log(w.name+' releases no bonus Blood: no Priest dealt the finishing blow.','info');
 }
 publishRender();
}
function choose(key){
 const w=lookup(key),a=ensure();
 if(!w||!a||!a.offers.includes(key)||!S?.started)return false;
 a.selected=key;a.offers=[];a.active=null;
 clearDraftRetry();draftAttempts=0;
 const choiceModal=document.getElementById('rogueChoiceModal');
 if(choiceModal)delete choiceModal.dataset.wardDraftFloor;
 if(typeof log==='function')log('WARDCRAFT — '+w.name+' unlocked for this passage. Any Priest may place it once.','good');
 document.getElementById('wardCastModal')?.classList.add('hidden');
 publishRender();
 if(typeof resumeTurnTimerIfReady==='function')resumeTurnTimerIfReady();
 return true;
}
window.__sanctumWardChoose=choose;
function shuffled(){
 const a=WARDS.map(w=>w.key);
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
 return a.slice(0,3);
}
let draftRetryTimer=0;
let draftAttempts=0;
function clearDraftRetry(){
 if(draftRetryTimer)clearTimeout(draftRetryTimer);
 draftRetryTimer=0;
}
function wardChoices(){
 return ensure().offers.map(key=>{
   const w=lookup(key);
   return {title:w.name,icon:'✧',actionKey:'ward:'+key,cls:'wardDraftChoice',desc:w.desc,reward:fmt(w),
     html:'<div class="ward-draft-art" style="'+artStyle(w)+'"></div><div class="ward-draft-body"><h3>'+esc(w.name)+'</h3><small>'+esc(w.category)+' · '+esc(fmt(w))+'</small><p>'+esc(w.desc)+'</p><span class="nodeReward">Unlock for this passage</span></div>',
     action:()=>choose(key)};
 });
}
function queueDraft(delay=0){
 clearDraftRetry();
 draftRetryTimer=setTimeout(showPendingDraft,delay);
}
function showPendingDraft(){
 draftRetryTimer=0;
 const a=ensure();
 if(!S?.started||!S.rogue?.enabled||!a?.offers?.length||a.selected||a.active)return;
 if(a.floor!==Number(S.rogue.floor)||['Defeat','Victory','Repository','Sanctuary'].includes(S.phase))return;
 const modal=document.getElementById('rogueChoiceModal');
 const isWardVote=S.multiplayerVote?.open&&S.multiplayerVote?.options?.some(o=>String(o.actionKey||'').startsWith('ward:'));
 if(isWardVote){
   if(modal&&!modal.classList.contains('hidden'))return;
   // Let the multiplayer choice renderer display the pending synchronized draft.
   if(typeof render==='function')render();
   return;
 }
 const online=typeof window.__sanctumWardOnlineInfo==='function'?window.__sanctumWardOnlineInfo():null;
 if(online?.online&&(!online.canChoose||online.starting)){
   // Game start must be committed to Supabase before starting its first choice.
   // Retain the three offered Wards in S while waiting for authoritative host state.
   queueDraft(Math.min(900,300+Math.min(draftAttempts++,10)*60));
   return;
 }
 // A reward, Priest draft or route choice must finish before Wardcraft starts.
 if(S.multiplayerVote?.open || (modal&&!modal.classList.contains('hidden')&&!modal.dataset.wardDraftFloor)){
   queueDraft(250);return;
 }
 if(modal&&!modal.classList.contains('hidden')&&modal.dataset.wardDraftFloor===String(a.floor))return;
 if(typeof window.__sanctumWardShowChoice!=='function'){queueDraft(350);return;}
 const floor=a.floor;
 window.__sanctumWardShowChoice('Floor '+floor+' · Wardcraft','Choose a Ward',
   'Select one of three magical Wards. The selected Ward is shared by the party, and a Priest may place it during combat.',wardChoices());
 if(online?.online){
   // The multiplayer handler may decline while authority is being handed off.
   if(!S.multiplayerVote?.open){queueDraft(400);return;}
 }else if(modal){
   modal.dataset.wardDraftFloor=String(floor);
 }
 draftAttempts=0;
}
function offer(force=false){
 const a=ensure(),r=S?.rogue;
 if(!a||!r?.enabled||!S.started||r.nodeType==='repository'||r.nodeType==='sanctuary'||['Defeat','Victory'].includes(S.phase))return;
 const floor=Math.max(1,Number(r.floor)||1);
 if(a.floor===floor&&!force){
   if(a.offers.length&&!a.selected&&!a.active)queueDraft(120);
   return;
 }
 a.floor=floor;a.active=null;a.selected=null;a.offers=shuffled();a.lastPlacementRound=-1;
 draftAttempts=0;
 publishRender();
 // Do not open a different choice inside the game-start state commit.
 // In single player the popup appears immediately; online it waits for host authority.
 queueDraft(onlineReadyDelay());
}
function onlineReadyDelay(){
 const state=typeof window.__sanctumWardOnlineInfo==='function'?window.__sanctumWardOnlineInfo():null;
 return state?.online?350:0;
}
function refuseText(w,room){
 const a=ensure(),p=S.players?.[S.current];
 if(!stage())return 'Wards may only be placed during an active Priest turn in combat.';
 if(document.body.classList.contains('mpWaitingTurn'))return 'Wait until it is your Priest turn.';
 if(!p)return 'No active Priest.';
 if(!w||a.selected!==w.key)return 'Choose a Ward at the beginning of this combat passage first.';
 if(a.active)return 'A Ward is already active.';
 if(a.lastPlacementRound===S.round)return 'Only one Ward may be placed per round.';
 if(!allowed(w).includes(room))return 'This Ward cannot be placed in that room.';
 if(Number(S.mana||0)<w.mana)return 'Not enough shared Mana.';
 if(Number(p.blood||0)<w.blood)return 'Not enough Demon Blood.';
 return '';
}
function place(room){
 const a=ensure(),w=lookup(a?.selected);
 const reason=refuseText(w,room);
 if(reason){if(typeof showGameStatus==='function')showGameStatus(reason,'bad');return false;}
 const p=S.players[S.current];
 S.mana-=w.mana;p.blood-=w.blood;
 a.active={key:w.key,room,charges:w.charges,phasesLeft:2,lastEnterRound:-1};
 a.selected=null;a.lastPlacementRound=S.round;
 document.getElementById('wardCastModal')?.classList.add('hidden');
 log((p.name||'Priest')+' inscribes '+w.name+' in the '+ROOM_NAMES[room]+' for '+fmt(w)+'.','good');
 publishRender();return true;
}
window.__sanctumWardPlace=place;
function closeCast(){document.getElementById('wardCastModal')?.classList.add('hidden');if(typeof resumeTurnTimerIfReady==='function')resumeTurnTimerIfReady();}
function castPopup(){
 if(!stage()||document.body.classList.contains('mpWaitingTurn'))return;
 const a=ensure(),w=lookup(a.selected);
 if(!w)return;
 const modal=document.getElementById('wardCastModal');
 const grid=modal.querySelector('.ward-cast-grid');
 modal.querySelector('.ward-cast-description').textContent=w.name+' — '+w.desc+' Cost: '+fmt(w)+'.';
 grid.innerHTML=allowed(w).map(r=>{
    const reason=refuseText(w,r);
    return '<button type="button" class="btn" data-ward-room="'+r+'" '+(reason?'disabled title="'+esc(reason)+'"':'')+'>'+esc(ROOM_NAMES[r])+'</button>';
 }).join('');
 grid.querySelectorAll('[data-ward-room]').forEach(btn=>btn.onclick=()=>place(Number(btn.dataset.wardRoom)));
 modal.classList.remove('hidden');
 // Popup blocks accidental game-turn progression but does not mutate game state.
 if(typeof pauseTurnTimer==='function')pauseTurnTimer();
}
function addInterface(){
 const section=document.getElementById('boardSection');
 if(!section)return;
 const bar=document.createElement('div');
 bar.className='wardcraft-bar';bar.id='wardcraftBar';
 bar.innerHTML='<span class="wardcraft-label">WARDCRAFT</span><span id="wardcraftStatus">Choose a Ward when a combat passage begins.</span><button type="button" class="btn" id="wardcraftCast" disabled>Place Ward</button>';
 section.parentNode.insertBefore(bar,section);
 const inlineDraft=document.createElement('div');
 inlineDraft.id='wardcraftInlineDraft';inlineDraft.className='wardcraft-inline-draft';inlineDraft.hidden=true;
 bar.insertAdjacentElement('afterend',inlineDraft);
 bar.querySelector('#wardcraftCast').addEventListener('click',()=>{
  const a=ensure();
  if(a?.offers?.length&&!a.selected){queueDraft(0);return;}
  castPopup();
 });
 const modal=document.createElement('div');
 modal.id='wardCastModal';modal.className='modal hidden ward-cast-modal';
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Place a Ward');
 modal.innerHTML='<div class="modalbox ward-cast-box"><h2>Inscribe a Ward</h2><p class="ward-cast-description"></p><div class="ward-cast-grid"></div><button type="button" class="btn" id="wardCastCancel">Cancel</button></div>';
 document.body.appendChild(modal);
 modal.querySelector('#wardCastCancel').onclick=closeCast;
 modal.addEventListener('click',e=>{if(e.target===modal)closeCast();});
}
function renderWardUI(){
 const state=ensure();if(!state)return;
 const a=state.active,w=a&&lookup(a.key),offer=lookup(state.selected),bar=document.getElementById('wardcraftBar');
 const inline=document.getElementById('wardcraftInlineDraft');
 if(inline){
   const show=!!(S?.started&&state.floor===Number(S.rogue?.floor)&&state.offers.length&&!state.selected&&!state.active);
   inline.hidden=!show;
   if(show){
     const signature=state.offers.join('|');
     if(inline.dataset.offers!==signature){
       inline.dataset.offers=signature;
       inline.innerHTML='<div class="wardcraft-inline-title">Choose one Ward for this passage</div>'+state.offers.map(key=>{
         const def=lookup(key);
         return '<button type="button" class="wardcraft-inline-option" data-ward-inline="'+esc(key)+'" style="'+artStyle(def)+'"><span class="wardcraft-inline-art"></span><b>'+esc(def.name)+'</b><small>'+esc(fmt(def))+'</small></button>';
       }).join('');
       inline.querySelectorAll('[data-ward-inline]').forEach(b=>b.onclick=()=>{
         if(document.body.classList.contains('mpWaitingTurn'))return;
         if(!stage())return;
         choose(b.dataset.wardInline);
       });
     }
   }else inline.dataset.offers='';
 }
 if(bar){
   const label=bar.querySelector('#wardcraftStatus'),cast=bar.querySelector('#wardcraftCast');
   if(w){label.textContent=w.name+' · '+ROOM_NAMES[a.room]+' · '+a.charges+' charge(s) · '+a.phasesLeft+' Demon Phase(s)';cast.textContent='Ward Active';cast.disabled=true;}
   else if(offer){label.textContent=offer.name+' · '+fmt(offer)+(state.lastPlacementRound===S.round?' · Placed this round':'');cast.textContent='Place Ward';cast.disabled=!!refuseText(offer,allowed(offer)[0]);}
   else if(state.offers.length){label.textContent='Choose 1 of 3 offered Wards for Floor '+state.floor;cast.textContent='Choose Ward';cast.disabled=!!document.body.classList.contains('mpWaitingTurn');}
   else {label.textContent=S?.started?'No Ward prepared':'Choose a Ward when a passage begins.';cast.textContent='Place Ward';cast.disabled=true;}
   bar.hidden=!S?.started||!S.rogue?.enabled;
   // Old saves and reconnects may contain pending Ward offers without an open dialog.
   if(state.offers.length&&!state.selected&&!state.active&&!draftRetryTimer&&!S.multiplayerVote?.open){
     queueDraft(450);
   }
 }
 for(let i=0;i<4;i++){
   const room=document.getElementById('room'+i)?.closest('.room');
   if(!room)continue;
   const on=!!(w&&a.room===i);
   room.classList.toggle('wardcraft-active',on);
   const existing=room.querySelector('.wardcraft-veil');
   const badge=room.querySelector('.wardcraft-badge');
   if(!on){existing?.remove();badge?.remove();room.style.removeProperty('--ward-glow');continue;}
   room.style.setProperty('--ward-glow',w.color);
   let veil=existing;
   if(!veil){veil=document.createElement('div');veil.className='wardcraft-veil';veil.setAttribute('aria-hidden','true');veil.innerHTML='<div class="wardcraft-illustration"></div><div class="wardcraft-ring"></div>';room.insertBefore(veil,room.firstChild);}
   veil.style.setProperty('--ward-image','url("./assets/wards/ward-'+w.key+'.webp")');
   if(!badge){const b=document.createElement('button');b.type='button';b.className='wardcraft-badge';b.onclick=()=>{const now=activeWard(),def=now&&lookup(now.key);if(def)alert(def.name+'\n'+def.desc+'\n'+now.charges+' charge(s), '+now.phasesLeft+' Demon Phase(s) remaining.');};room.appendChild(b);}
   const b=room.querySelector('.wardcraft-badge');
   b.textContent='✧ '+w.name+' · '+a.charges;
 }
}
addInterface();

// Wrappers are intentionally installed last: these are the post-audit movement
// and post-multiplayer render functions, not their older pre-fix implementations.
let backwardTravel=0;
if(typeof moveDemonBackOne==='function'){
 const base=moveDemonBackOne;
 moveDemonBackOne=function(){backwardTravel++;try{return base.apply(this,arguments);}finally{backwardTravel--;}};
}
if(typeof demonCode==='function'){
 const base=demonCode;demonCode=function(d){
   if(d?.status?.wardSilencedThroughRound>=S.round)return null;
   return base.apply(this,arguments);
 };
}
if(typeof demonAbility==='function'){
 const base=demonAbility;demonAbility=function(d){
   return d?.status?.wardSilencedThroughRound>=S.round?'ABILITY SILENCED':base.apply(this,arguments);
 };
}
if(typeof demonAttack==='function'){
 const base=demonAttack;demonAttack=function(d){
   return Math.max(0,base.apply(this,arguments)-Math.max(0,Number(d?.status?.wardAttackReduction)||0));
 };
}
if(typeof triggerEnterRoom==='function'){
 const base=triggerEnterRoom;
 triggerEnterRoom=function(d){
   const old=backwardTravel,locBefore=findDemonLocation(d);
   const out=base.apply(this,arguments);
   const after=findDemonLocation(d);
   if(!old&&locBefore&&after&&after.r===locBefore.r)applyEntrance(d,after.r);
   return out;
 };
}
if(typeof moveOneForward==='function'){
 const base=moveOneForward;
 moveOneForward=function(d){
   const loc=findDemonLocation(d),room=loc?.r;
   const w=room==null?null:canTrigger('exit',room);
   const stopped=!!(d?.status?.stop&&S.phase==='Demon');
   const destFull=room!=null&&room<3&&S.rooms[room+1].length>=4;
   let applied=false;
   if(w?.key==='vigil'&&!stopped&&!destFull){
     d.status=d.status||{};
     d.status.wardAttackReduction=(Number(d.status.wardAttackReduction)||0)+scaled(2);
     applied=true;
   }
   const out=base.apply(this,arguments);
   if(applied){
     if(out){consume(w);log(w.name+' permanently weakens '+demonName(d)+' by '+scaled(2)+' Attack.','good');}
     else d.status.wardAttackReduction=Math.max(0,(d.status.wardAttackReduction||0)-scaled(2));
   }
   return out;
 };
}
if(typeof defeatDemon==='function'){
 const base=defeatDemon;
 defeatDemon=function(d){
   const loc=findDemonLocation(d),killer=S.phase==='Priest'?S.current:null,pre=Number(S.defeats)||0;
   const out=base.apply(this,arguments);
   if(loc&&(Number(S.defeats)||0)>pre)applyDefeat(d,loc.r,killer);
   return out;
 };
}
if(typeof moveDemons==='function'){
 const base=moveDemons;
 moveDemons=function(){
   const a=activeWard();
   // A bound Demon in the current round is held by the existing audited
   // stop mechanic. Clear overdue holds only after the intended phase.
   if(S?.rooms)for(const d of S.rooms.flat()){
     if(!d?.status)continue;
     if(d.status.wardBoundThroughRound>=S.round)d.status.stop=true;
     else delete d.status.wardBoundThroughRound;
   }
   return base.apply(this,arguments);
 };
}
if(typeof endRound==='function'){
 const base=endRound;
 endRound=function(){
   const a=activeWard();
   if(a&&S.phase!=='Rogue Reward'){
     a.phasesLeft=Math.max(0,a.phasesLeft-1);
     if(a.phasesLeft===0)expire('two Demon Phases elapsed');
   }
   return base.apply(this,arguments);
 };
}
if(typeof render==='function'){
 const base=render;render=function(){
   const out=base.apply(this,arguments);
   renderWardUI();
   return out;
 };
 try{window.render=render;}catch(_){}
}
// The original setup button was bound to the prior startGame wrapper.
// Rebind it so the new-run Ward draft is opened through the live function.
const start=document.getElementById('startBtn');
if(start&&typeof startGame==='function')start.onclick=()=>startGame();
window.__sanctumWardOpenPassage=offer;
window.__sanctumWardClosePassage=expire;
window.__sanctumWards={definitions:WARDS,choose,place,offer,ensure,expire,render:renderWardUI,reopenDraft:()=>queueDraft(0)};
})();
