/* Fire/Poison visuals for Cinderbrand and Serpent's Fang. All mechanics
 * still live in 70-multiplayer-patches.js; this module reads their statuses
 * and replays lightweight damage events from synchronized game state. */
(()=>{
'use strict';
if(window.__sanctumElementalDamageFxInstalled)return;
window.__sanctumElementalDamageFxInstalled=true;
const seen=new Set();
const recent=()=>Date.now();
const reduced=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function syncData(){
 const state=typeof S!=='undefined'?S:null;
 const burns=Array.isArray(state?.elementalBurnQueue)?state.elementalBurnQueue:[];
 const fireDemons=new Map();
 let fireBoss=false;
 for(const item of burns){
  if(!item||!Number.isFinite(Number(item.damage))||Number(item.damage)<=0)continue;
  if(item.kind==='boss')fireBoss=true;
  else if(item.kind==='demon'){
   const id=String(item.id||'');
   fireDemons.set(id,(fireDemons.get(id)||0)+Math.max(0,Number(item.damage)||0));
  }
 }
 return {state,fireDemons,fireBoss};
}
function addMark(container,kind,description){
 if(!container)return;
 const item=document.createElement('span');
 item.className='sanctum-elemental-mark sanctum-elemental-'+kind;
 item.dataset.elemental=kind;
 item.setAttribute('title',description);
 item.setAttribute('aria-label',description);
 item.textContent=kind==='fire'?'♨':'☣';
 container.appendChild(item);
}
function decorate(target,fire,poison){
 if(!target)return;
 const host=target.querySelector('.demonArtWrap')||
            target.querySelector('.bossArt')?.parentElement;
 if(!host)return;
 if(target.classList.contains('bossCard'))host.classList.add('sanctum-elemental-boss-art');
 const current=host.querySelector('.sanctum-elemental-marks');
 if(current)current.remove();
 target.classList.toggle('sanctum-elemental-fire-active',fire>0);
 target.classList.toggle('sanctum-elemental-poison-active',poison>0);
 if(!(fire>0||poison>0))return;
 const row=document.createElement('div');
 row.className='sanctum-elemental-marks';
 if(fire>0)addMark(row,'fire','Burning • '+fire+' Fire damage pending');
 if(poison>0)addMark(row,'poison','Poison '+poison+'/2 Basic Attack hits');
 host.appendChild(row);
}
function drawMarkers(){
 const {state,fireDemons,fireBoss}=syncData();
 if(!state)return;
 const byId=new Map();
 for(const room of state.rooms||[]){
  for(const d of room||[])if(d?.id)byId.set(String(d.id),d);
 }
 document.querySelectorAll('#boardSection .demons .demon[data-demon]').forEach(card=>{
  const id=card.getAttribute('data-demon');
  const d=byId.get(id);
  if(!d)return;
  decorate(card,fireDemons.get(id)||0,Math.max(0,Number(d.status?.elementalPoisonHits)||0));
 });
 const boss=state.bossRevealed?document.querySelector('#bossArea .bossCard'):null;
 if(boss)decorate(boss,fireBoss?1:0,Math.max(0,Number(state.boss?.status?.elementalPoisonHits)||0));
}
function damageLayer(){
 let el=document.getElementById('sanctumElementalDamageLayer');
 if(el)return el;
 el=document.createElement('div');
 el.id='sanctumElementalDamageLayer';
 el.setAttribute('aria-hidden','true');
 document.body.appendChild(el);
 return el;
}
function targetPoint(evt){
 let card=null;
 if(evt.targetKind==='boss'){
  card=document.querySelector('#bossArea .bossArt')||
       document.querySelector('#bossArea .bossCard');
 }else{
  card=Array.from(document.querySelectorAll('#boardSection .demons [data-demon]'))
   .find(x=>x.getAttribute('data-demon')===String(evt.targetId||''));
 }
 if(!card&&Number.isInteger(evt.room)&&evt.room>=0&&evt.room<=3){
  card=document.getElementById('room'+evt.room);
 }
 const w=window.innerWidth||900,h=window.innerHeight||600;
 const b=card?.getBoundingClientRect();
 if(b&&b.width>0&&b.height>0&&b.right>=0&&b.left<=w&&b.bottom>=0&&b.top<=h)
  return {x:Math.max(28,Math.min(w-28,b.left+b.width*.5)),
   y:Math.max(32,Math.min(h-32,b.top+b.height*.36))};
 return {x:w*.5,y:h*.43};
}
function showNumber(evt){
 const amount=Math.max(0,Math.floor(Number(evt.damage)||0));
 if(!amount||!(evt.kind==='fire'||evt.kind==='poison'))return;
 const pos=targetPoint(evt);
 const label=document.createElement('span');
 label.className='sanctum-elemental-damage sanctum-elemental-damage-'+evt.kind;
 label.textContent='−'+amount;
 label.setAttribute('aria-hidden','true');
 label.style.left=pos.x+'px';
 label.style.top=pos.y+'px';
 damageLayer().appendChild(label);
 setTimeout(()=>label.remove(),reduced()?500:1080);
}
function drawDamage(){
 const list=typeof S!=='undefined'&&Array.isArray(S?.elementalDamageVisuals)
  ?S.elementalDamageVisuals:[];
 for(const event of list){
  const id=String(event?.id||'');
  if(!id||seen.has(id))continue;
  seen.add(id);
  if(seen.size>160)seen.delete(seen.values().next().value);
  if(Number.isFinite(event.createdAt)&&Math.abs(recent()-event.createdAt)<=12000)
   showNumber(event);
 }
}
window.__sanctumRenderElementalFx=function(){
 try{drawMarkers();drawDamage()}catch(error){
  console.warn('Elemental visual effect skipped safely',error);
 }
};
window.__sanctumElementalFxState=()=>({
 markers:document.querySelectorAll('#boardSection .sanctum-elemental-mark').length,
 floating:document.querySelectorAll('#sanctumElementalDamageLayer .sanctum-elemental-damage').length,
 seen:seen.size
});
// Wrap the game's final render function, after the elemental gameplay patch
// and existing merge animation. The wrapper never changes the game state.
if(typeof render==='function'){
 const previousRender=render;
 render=function(){
  const result=previousRender.apply(this,arguments);
  window.__sanctumRenderElementalFx();
  return result;
 };
 try{window.render=render}catch(_){}
}
})();
