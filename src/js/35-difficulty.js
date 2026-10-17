/* Run difficulty: additive to existing floor/cycle mechanics, persistent in S. */
(()=>{
'use strict';
const LEVELS=Object.freeze({easy:-0.05,standard:0,hard:0.05,hell:0.10,tormented:0.10});
const LABELS=Object.freeze({
 easy:'Easy — enemies lose 5% HP and Attack each global round.',
 standard:'Standard — the original enemy and Boss scaling.',
 hard:'Hard — enemies gain 5% HP and Attack each global round.',
 hell:'Hell — enemies gain 10% HP and Attack each global round.',
 tormented:'Tormented — 10% more HP and Attack per round; Boss HP starts at 100% printed in solo, then 115% / 130% / 145% for 2–4 players before floor scaling.'
});
function sanitize(value){return Object.hasOwn(LEVELS,value)?value:'standard'}
function level(){return sanitize(S?.difficulty)}
function difficultyRoundMultiplier(){
 const rate=LEVELS[level()];
 if(!rate)return 1;
 const round=Math.max(1,Math.floor(Number(S?.round)||1));
 return Math.pow(1+rate,Math.min(500,round));
}
// Only the difficulty-specific delta is stored on each enemy, allowing all
// old save games, floor scaling, mergers, room bonuses, and transformations.
const rawDemonMaxHP=demonMaxHP;
demonMaxHP=function(d){
 const baseline=Math.max(1,Math.floor(Number(rawDemonMaxHP(d))||1));
 return Math.max(1,Math.round(baseline*difficultyRoundMultiplier()));
};
const rawDemonAttack=demonAttack;
demonAttack=function(d){
 const attack=rawDemonAttack(d);
 if(attack<=0)return 0;
 return Math.max(1,Math.round(attack*difficultyRoundMultiplier()));
};
const rawBossDrainAmount=bossDrainAmount;
bossDrainAmount=function(){
 const base=rawBossDrainAmount();
 if(base<=0)return base;
 return Math.max(1,Math.round(base*difficultyRoundMultiplier()));
};
function reconcileDemon(d){
 if(!d)return;
 d.status=d.status||{};
 const baseline=Math.max(1,Math.floor(Number(rawDemonMaxHP(d))||1));
 const target=Math.max(1,Math.round(baseline*difficultyRoundMultiplier()));
 const previous=Number(d.status.difficultyHpDelta)||0;
 const next=target-baseline;
 if(next!==previous){
  d.cur=Math.max(0,Math.min(target,(Number(d.cur)||0)+next-previous));
  d.status.difficultyHpDelta=next;
 }
}
function reconcileBoss(){
 const b=S?.boss;
 if(!b||!S.bossRevealed||b.cur==null||b.cur<=0)return;
 const previous=Number(b.difficultyHpDelta)||0;
 const baseline=Math.max(1,Math.round((Number(b.hp)||1)-previous));
 const target=Math.max(1,Math.round(baseline*difficultyRoundMultiplier()));
 const next=target-baseline;
 if(next!==previous){
  b.cur=Math.max(0,Math.min(target,b.cur+next-previous));
  b.hp=target;
  b.difficultyHpDelta=next;
 }
}
function reconcileAll(){
 if(!S)return;
 S.difficulty=level();
 for(const room of S.rooms||[])for(const d of room||[])reconcileDemon(d);
 reconcileBoss();
}
const baseRender=render;
render=function(){
 reconcileAll();
 const out=baseRender.apply(this,arguments);
 updateControls();
 return out;
};
const baseStart=startGame;
startGame=function(){
 const selected=sanitize(document.getElementById('difficultySetupSelect')?.value);
 const success=baseStart.apply(this,arguments);
 if(success){
  S.difficulty=selected;
  reconcileAll();
  render();
 }
 return success;
};
function multiplayerSession(){return window.SanctumMultiplayerDev?.session||null}
function updateControls(){
 const current=level(),started=!!S?.started;
 const setup=document.getElementById('difficultySetupSelect');
 const pause=document.getElementById('difficultyPauseSelect');
 const info=document.getElementById('difficultyPauseInfo');
 const setupInfo=document.getElementById('difficultySetupInfo');
 if(setup&&started)setup.value=current;
 if(pause&&pause.value!==current)pause.value=current;
 if(info)info.textContent=LABELS[current]+
  (started?' Round '+(S.round||1)+' multiplier: '+difficultyRoundMultiplier().toFixed(2)+'×.':'');
 if(setupInfo&&setup)setupInfo.textContent=LABELS[sanitize(setup.value)];
 if(pause){
  const online=multiplayerSession();
  const cannotChange=!!(online&&started&&!window.SanctumMultiplayerDev?.isMyTurn);
  pause.disabled=cannotChange;
  pause.title=cannotChange?'Only the active player can change multiplayer difficulty.':'Difficulty affects this run immediately.';
 }
}
function selectSetup(value){
 const setup=document.getElementById('difficultySetupSelect');
 if(setup)setup.value=sanitize(value);
 updateControls();
}
const setup=document.getElementById('difficultySetupSelect');
if(setup)setup.addEventListener('change',()=>updateControls());
const pause=document.getElementById('difficultyPauseSelect');
if(pause)pause.addEventListener('change',()=>{
 const selected=sanitize(pause.value);
 const online=multiplayerSession();
 if(online&&S?.started&&!window.SanctumMultiplayerDev?.isMyTurn){
  pause.value=level();return;
 }
 if(S?.started){
  if(level()===selected)return;
  S.difficulty=selected;
  reconcileAll();
  log('DIFFICULTY — '+selected.toUpperCase()+'. '+LABELS[selected],'info');
  render();
 }else{
  selectSetup(selected);
  pause.value=selected;
 }
});
selectSetup('standard');
window.__sanctumDifficulty={level,multiplier:difficultyRoundMultiplier,reconcileAll,selectSetup};
})();
