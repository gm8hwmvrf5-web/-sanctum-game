/* Layout Redesign Phase 3 — earned Rituals.
 * Game mechanics, rituals, reward choices and multiplayer state ownership remain
 * unchanged. A NEW run starts with the first Ritual for each Priest.
 * Passage milestones: enter Floor 3 (second Ritual), Floor 6 (third Ritual).
 * Newly found Rituals are drawn from that class's own previously sealed ones.
 * Progress is stored on S.players, so save/load and Supabase carry it naturally.
 * Older saved runs WITHOUT the version marker keep their existing three Rituals.
 */
(()=>{
 'use strict';
 const app=document.querySelector('body > .app.layoutPhase2');
 if(!app||typeof CHARACTERS==='undefined'||typeof startGame!=='function')return;
 app.classList.add('layoutPhase3');
 const VERSION=1;
 const FLOOR_SECOND=3,FLOOR_THIRD=6;
 const getState=()=>typeof S!=='undefined'&&S&&typeof S==='object'?S:null;
 const isProgression=()=>getState()?.layoutRitualProgressionVersion===VERSION;
 const floorNow=()=>{
  const r=getState()?.rogue;
  return Math.max(1,Math.floor(Number(r?.floor)||1));
 };
 const countAtFloor=floor=>floor>=FLOOR_THIRD?3:floor>=FLOOR_SECOND?2:1;
 const getRituals=p=>Array.isArray(CHARACTERS[p?.char]?.rituals)?CHARACTERS[p.char].rituals:[];
 const validOwned=(p)=>{
  const available=getRituals(p).length;
  if(!isProgression())return Array.from({length:available},(_,i)=>i);
  const raw=p?.layoutRitualUnlocks;
  if(!Array.isArray(raw)){
   // For older saved-run invited party members whose field is missing, show
   // depth-appropriate rituals without modifying the non-authoritative state.
   return Array.from({length:Math.min(available,countAtFloor(floorNow()))},(_,i)=>i);
  }
  const clean=[];
  for(const n of raw){
   if(Number.isInteger(n)&&n>=0&&n<available&&!clean.includes(n))clean.push(n);
  }
  return clean.length?clean:[0].filter(n=>n<available);
 };
 const current=()=>{
  const state=getState();
  if(!state?.started||!Array.isArray(state.players)||!state.players.length)return null;
  return state.players[Math.max(0,Math.min(state.players.length-1,Number(state.current)||0))];
 };
 const isOwned=(p,index)=>validOwned(p).includes(index);
 function renderRitualProgress(){
  const p=current(),ritualRoot=document.getElementById('ritualContent');
  if(!p||!ritualRoot)return;
  const rituals=ritualRoot.querySelector('.rituals');
  if(!rituals)return;
  const owned=validOwned(p);
  const list=[...rituals.querySelectorAll(':scope > .ritual')];
  list.forEach((card,i)=>{
   const locked=!owned.includes(i);
   card.hidden=locked;
   card.setAttribute('aria-hidden',locked?'true':'false');
   if(locked){
    // The original renderer recreates buttons every time; never leave
    // a hidden Ritual with an active, keyboard-accessible use button.
    const button=card.querySelector('[data-rit]');
    if(button){button.disabled=true;button.tabIndex=-1;}
   }
  });
  let progress=ritualRoot.querySelector('#layoutRitualProgress');
  if(!progress){
   progress=document.createElement('div');
   progress.id='layoutRitualProgress';
   progress.className='layoutRitualProgress';
   progress.setAttribute('role','status');
   progress.setAttribute('aria-live','polite');
   rituals.parentElement.insertBefore(progress,rituals);
  }
  const max=getRituals(p).length;
  const next=owned.length>=max?'All rituals discovered'
   :floorNow()<FLOOR_SECOND?'Next discovery: Floor 3'
   :floorNow()<FLOOR_THIRD?'Next discovery: Floor 6'
   :'More rituals await in the descent';
  progress.textContent=owned.length+' / '+max+' RITUALS DISCOVERED  •  '+next;
  rituals.dataset.ritualsUnlocked=String(owned.length);
 }

 // StartGame is the final wrapping point after laws, wards and multiplayer
 // have prepared the authoritative S. The multiplayer start RPC is scheduled,
 // not sent until after this synchronous initializer returns.
 const priorStart=startGame;
 startGame=function(){
  const ok=priorStart.apply(this,arguments);
  if(!ok)return ok;
  const state=getState();
  if(state?.started){
   state.layoutRitualProgressionVersion=VERSION;
   for(const p of state.players||[]){
    // The initially prepared class is always the starting ritual.
    p.layoutRitualUnlocks=getRituals(p).length?[0]:[];
   }
   try{render()}catch(err){console.error('Ritual progression: initial render failed',err);}
  }
  return ok;
 };
 try{window.startGame=startGame;}catch(_){}

 function discoverAtCurrentFloor(){
  const state=getState();
  if(!state?.started||!isProgression())return;
  const wanted=countAtFloor(floorNow());
  for(const p of state.players||[]){
   const choices=getRituals(p);
   if(!choices.length)continue;
   // Missing fields from a saved-run join should inherit the CURRENT depth
   // rather than be granted three new unlocks by every connected device.
   if(!Array.isArray(p.layoutRitualUnlocks)){
    p.layoutRitualUnlocks=Array.from({length:Math.min(choices.length,wanted)},(_,i)=>i);
    continue;
   }
   let owned=validOwned(p);
   while(owned.length<Math.min(wanted,choices.length)){
    const remaining=choices.map((_,i)=>i).filter(i=>!owned.includes(i));
    if(!remaining.length)break;
    const index=remaining[Math.floor(Math.random()*remaining.length)];
    owned=[...owned,index];
    p.layoutRitualUnlocks=owned;
    const name=choices[index].n;
    if(typeof log==='function')
     log('RITUAL DISCOVERED — '+p.name+' ('+p.char+') unlocks '+name+' on Floor '+floorNow()+'.','good');
    if(p===current()&&typeof showGameStatus==='function')
     showGameStatus('New Ritual: '+name+' — '+p.char,'good');
   }
  }
 }
 // Route -> floor transition is invoked on the authoritative choice owner.
 // Applying discoveries HERE makes the same S snapshot available to the remote
 // players, without inserting an extra asynchronous vote or choice screen.
 if(typeof rogueliteEnterCurrentFloor==='function'){
  const priorEnter=rogueliteEnterCurrentFloor;
  rogueliteEnterCurrentFloor=function(){
   discoverAtCurrentFloor();
   return priorEnter.apply(this,arguments);
  };
 }
 // A saved game from an earlier stable build has no progression marker, so
 // its preexisting full Ritual set is deliberately preserved.
 if(typeof renderPlayer==='function'){
  const priorRender=renderPlayer;
  renderPlayer=function(){
   const value=priorRender.apply(this,arguments);
   renderRitualProgress();
   return value;
  };
 }
 // Defend against direct invocation of useRitual by a hidden button or script.
 // Base ritual effects, rolls, target selection and Blood spending are untouched.
 if(typeof useRitual==='function'){
  const priorUse=useRitual;
  useRitual=function(index){
   const p=current(),n=Number(index);
   if(p&&(!Number.isInteger(n)||!isOwned(p,n))){
    if(typeof showGameStatus==='function')showGameStatus('This Ritual is still sealed. Continue deeper to discover it.','bad');
    return false;
   }
   return priorUse.apply(this,arguments);
  };
 }
 // Reflow after any existing startup or save-load has completed.
 if(getState()?.started)renderRitualProgress();
})();
