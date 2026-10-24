/* Phase 2 battlefield presentation, revised: card-only priest view.
 * The third-person model and class portrait have been intentionally removed.
 * Combat rooms, card hand, existing demon targets and multiplayer are untouched.
 */
(()=>{
 'use strict';
 const app=document.querySelector('body > .app.layoutPhase1');
 const board=document.getElementById('boardSection');
 if(!app||!board||!document.getElementById('layoutRoomNav'))return;
 app.classList.add('layoutPhase2');

 // Retain the atmospheric room depth, but no priest figure or character art.
 const stage=document.createElement('div');
 stage.id='layoutBattlefieldAtmosphere';
 stage.setAttribute('aria-hidden','true');
 stage.innerHTML='<div class="layoutDepthHaze"></div><div class="layoutGroundPlane"></div><div class="layoutGroundSigil"></div>';
 board.insertAdjacentElement('afterend',stage);

 const encounter=document.createElement('div');
 encounter.id='layoutEncounterLabel';
 encounter.className='layoutEncounterLabel';
 encounter.setAttribute('role','status');
 encounter.setAttribute('aria-live','off');
 encounter.innerHTML='<span class="layoutEncounterEyebrow">SANCTUM ENCOUNTER</span><strong id="layoutEncounterTitle">GATEWAY</strong><small id="layoutEncounterSubtitle">Awaiting the exorcism</small>';
 stage.insertAdjacentElement('afterend',encounter);

 const title=document.getElementById('layoutEncounterTitle');
 const subtitle=document.getElementById('layoutEncounterSubtitle');
 const names=['Gateway','Hall','Chapel','Crypt','Boss Room'];
 const keys=['gateway','hall','chapel','crypt','boss'];

 function updateEncounter(){
  const state=typeof S!=='undefined'&&S&&typeof S==='object'?S:null;
  const active=!!state?.started;
  const focus=board.dataset.focusedRoom||'gateway';
  const index=Math.max(0,keys.indexOf(focus));
  let count=0;
  if(active){
   if(index<4&&Array.isArray(state.rooms?.[index]))count=state.rooms[index].length;
   else if(index===4&&state.bossRevealed&&state.boss&&Number(state.boss.cur)>0)count=1;
  }
  title.textContent=names[index].toUpperCase();
  subtitle.textContent=!active?'Choose a priest to begin':count
   ?count+' '+(count===1?'demon':'demons')+' in sight • Tap to inspect'
   :'No demons in sight • Watch the next spawn';
  app.classList.toggle('layoutActiveCombat',active&&count>0);
  document.querySelectorAll('#layoutRoomNav .layoutRoomTab').forEach((tab,i)=>{
   let amount=0;
   if(active){
    amount=i<4?(Array.isArray(state.rooms?.[i])?state.rooms[i].length:0)
     :(state.bossRevealed&&state.boss&&Number(state.boss.cur)>0?1:0);
   }
   const badge=tab.querySelector('.roomCount');
   if(badge)badge.textContent=String(amount);
   tab.setAttribute('aria-label',names[i]+', '+amount+' '+(amount===1?'enemy':'enemies')+', inspect room');
  });
 }

 if(typeof renderPlayer==='function'){
  const prior=renderPlayer;
  renderPlayer=function(){const result=prior.apply(this,arguments);updateEncounter();return result;};
 }
 if(typeof render==='function'){
  const prior=render;
  render=function(){const result=prior.apply(this,arguments);updateEncounter();return result;};
 }
 if(typeof rogueliteRenderHud==='function'){
  const prior=rogueliteRenderHud;
  rogueliteRenderHud=function(){const result=prior.apply(this,arguments);updateEncounter();return result;};
 }
 if(typeof MutationObserver==='function'){
  new MutationObserver(updateEncounter).observe(board,{attributes:true,attributeFilter:['data-focused-room']});
 }
 updateEncounter();
})();
