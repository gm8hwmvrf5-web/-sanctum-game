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
// Visual layers are confined to the artwork. Status values are read-only:
 // Fire and Poison can each be active, and their layers never affect combat.
function artHost(target){
 const demonArt=target.querySelector('.demonArtWrap');
 if(demonArt)return demonArt;
 const image=target.querySelector('.bossArt');
 if(!image)return null;
 // Boss artwork is normally an <img> directly inside the Boss card.
 // Wrap only the image so gas/flames cannot cover Boss stats or abilities.
 let wrap=image.parentElement;
 if(!wrap?.classList.contains('sanctum-elemental-boss-art')){
  wrap=document.createElement('div');
  wrap.className='sanctum-elemental-boss-art';
  image.parentElement.insertBefore(wrap,image);
  wrap.appendChild(image);
 }
 return wrap;
}
function makeLayer(kind){
 const layer=document.createElement('div');
 layer.className='sanctum-elemental-overlay sanctum-elemental-'+kind+'-overlay';
 layer.dataset.elemental=kind;
 layer.setAttribute('aria-hidden','true');
 if(kind==='fire'){
  for(let i=0;i<4;i++){
   const tongue=document.createElement('span');
   tongue.className='sanctum-flame sanctum-flame-'+(i+1);
   layer.appendChild(tongue);
  }
 }else{
  for(let i=0;i<4;i++){
   const cloud=document.createElement('span');
   cloud.className='sanctum-miasma sanctum-miasma-'+(i+1);
   layer.appendChild(cloud);
  }
 }
 return layer;
}
function decorate(target,fire,poison){
 if(!target)return;
 const host=artHost(target);
 if(!host)return;
 const burning=fire>0,poisoned=poison>0;
 target.classList.toggle('sanctum-elemental-fire-active',burning);
 target.classList.toggle('sanctum-elemental-poison-active',poisoned);
 // The engine rebuilds each card on render. Updating rather than duplicating
 // layers also supports independent status expiry on an existing card node.
 const existing=host.querySelector('.sanctum-elemental-overlays');
 if(!burning&&!poisoned){
  if(existing)existing.remove();
  return;
 }
 const layers=existing||document.createElement('div');
 layers.className='sanctum-elemental-overlays';
 layers.setAttribute('aria-hidden','true');
 for(const [kind,active] of [['fire',burning],['poison',poisoned]]){
  const old=layers.querySelector('[data-elemental="'+kind+'"]');
  if(active&&!old)layers.appendChild(makeLayer(kind));
  if(!active&&old)old.remove();
 }
 if(!existing)host.appendChild(layers);
 // Keep tooltips informative without reintroducing visual status badges.
 host.title=[
  burning?'Burning: '+Math.floor(fire)+' Fire damage pending':null,
  poisoned?'Poison: '+Math.floor(poison)+'/2 Basic Attack hits':null
 ].filter(Boolean).join(' • ');
}
function drawOverlays(){
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
 setTimeout(()=>label.remove(),reduced()?750:1620);
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
 try{drawOverlays();drawDamage()}catch(error){
  console.warn('Elemental visual effect skipped safely',error);
 }
};
window.__sanctumElementalFxState=()=>({
 overlays:document.querySelectorAll('#boardSection .sanctum-elemental-overlay, #bossArea .sanctum-elemental-overlay').length,
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
