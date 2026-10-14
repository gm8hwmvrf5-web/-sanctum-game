/* Cosmetic Demon-merge visual: replay from serialized game state on all
 * clients. No timers delay or mutate combat, movement, or Supabase turns. */
(()=>{
'use strict';
if(window.__sanctumDemonMergeFxInstalled)return;
window.__sanctumDemonMergeFxInstalled=true;
const seen=new Set(),waiting=[];
let active=null,busy=false;
const reduced=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const clip=(n,a,b)=>Math.max(a,Math.min(b,n));
const viewport=()=>({w:window.innerWidth||document.documentElement.clientWidth||900,h:window.innerHeight||document.documentElement.clientHeight||600});
function roomPoint(room,index,side){
 const {w,h}=viewport(),area=document.getElementById('room'+room);
 if(area){
  const r=area.getBoundingClientRect();
  if(r.right>=0&&r.left<=w&&r.bottom>=0&&r.top<=h){
   // Space two Lesser cards apart even if they began in the same room.
   return {
    x:clip(r.left+r.width*(side===0?.29:.71),66,w-66),
    y:clip(r.top+Math.min(r.height*.53,85)+(index%2)*8,60,h-60)
   };
  }
 }
 // If a mobile carousel room is off-screen, keep the spectacle visible.
 return {x:w*(side===0?.33:.67),y:h*.45};
}
function gatewayPoint(id){
 const {w,h}=viewport();
 const cards=Array.from(document.querySelectorAll('#room0 [data-demon]'));
 const card=cards.find(c=>c.dataset.demon===String(id));
 const room=document.getElementById('room0');
 const r=(card||room)?.getBoundingClientRect();
 if(r&&r.right>0&&r.left<w&&r.bottom>0&&r.top<h){
  return {x:clip(r.left+r.width/2,72,w-72),y:clip(r.top+r.height/2,72,h-72)};
 }
 return {x:w*.50,y:h*.45};
}
function cardFace(d,type){
 const card=document.createElement('div');
 card.className='sanctum-merge-ghost '+(type==='greater'?'sanctum-merge-greater':'sanctum-merge-lesser');
 const image=document.createElement('img');
 image.src=String(d.art||'');image.alt='';image.decoding='async';
 image.draggable=false;card.appendChild(image);
 const name=document.createElement('div');
 name.className='sanctum-merge-name';name.textContent=String(d.name||'Demon');
 card.appendChild(name);
 const label=document.createElement('div');
 label.className='sanctum-merge-form';label.textContent=type==='greater'?'GREATER DEMON • GATEWAY':'LESSER DEMON';
 card.appendChild(label);
 return card;
}
function setPos(el,p){
 const {w,h}=viewport();
 const width=Math.min(148,Math.max(90,w*.28));
 el.style.width=width+'px';
 el.style.left=clip(p.x-width/2,2,Math.max(2,w-width-2))+'px';
 el.style.top=clip(p.y-78,2,Math.max(2,h-160))+'px';
}
function targetCard(id){
 return Array.from(document.querySelectorAll('#room0 [data-demon]'))
  .find(e=>e.dataset.demon===String(id))||null;
}
function ensureLayer(){
 let layer=document.getElementById('sanctumDemonMergeLayer');
 if(!layer){
  layer=document.createElement('div');
  layer.id='sanctumDemonMergeLayer';
  layer.setAttribute('aria-hidden','true');
  document.body.appendChild(layer);
 }
 return layer;
}
function setArrivalHidden(on){
 if(!active)return;
 const t=targetCard(active.id);
 if(t)t.classList.toggle('sanctum-merge-arrival-hidden',!!on);
}
function play(event){
 busy=true;
 const id=event.result?.id;
 active={id,conceal:true};
 setArrivalHidden(true);
 const layer=ensureLayer(),revealAt=gatewayPoint(id);
 const sources=(event.sources||[]).slice(0,2);
 const twins=sources.map((part,i)=>{
  const el=cardFace(part,'lesser'),start=roomPoint(part.room,part.index,i);
  setPos(el,start);layer.appendChild(el);
  return {el,start};
 });
 const greater=cardFace(event.result||{},'greater');
 setPos(greater,revealAt);greater.classList.add('sanctum-merge-reveal');
 layer.appendChild(greater);
 const flash=document.createElement('div');
 flash.className='sanctum-merge-flash';flash.style.left=revealAt.x+'px';flash.style.top=revealAt.y+'px';
 layer.appendChild(flash);
 const duration=reduced()?360:1300;
 // The first ~40% is a simultaneous side-to-side shake. Both Lesser card
 // images then fly toward the same point at the Gateway and disappear.
 if(!reduced()&&typeof greater.animate==='function'){
  twins.forEach(({el,start},i)=>{
   const dx=revealAt.x-start.x,dy=revealAt.y-start.y,sign=i===0?-1:1;
   el.animate([
    {offset:0,transform:'translateX(0) rotate(0deg)',opacity:1},
    {offset:.065,transform:`translateX(${sign*8}px) rotate(${sign*5}deg)`},
    {offset:.13,transform:`translateX(${-sign*8}px) rotate(${-sign*5}deg)`},
    {offset:.20,transform:`translateX(${sign*9}px) rotate(${sign*5}deg)`},
    {offset:.27,transform:`translateX(${-sign*9}px) rotate(${-sign*5}deg)`},
    {offset:.34,transform:`translateX(${sign*7}px) rotate(${sign*4}deg)`},
    {offset:.40,transform:'translateX(0) rotate(0deg)',opacity:1},
    {offset:.69,transform:`translate(${dx}px,${dy}px) scale(.18) rotate(${sign*18}deg)`,opacity:0},
    {offset:1,transform:`translate(${dx}px,${dy}px) scale(.18)`,opacity:0}
   ],{duration,fill:'forwards',easing:'ease-in-out'});
  });
 }else{
  twins.forEach(({el})=>{el.classList.add('sanctum-merge-motion-reduced');});
 }
 const revealDelay=reduced()?90:860;
 setTimeout(()=>{
  if(active?.id!==id)return;
  active.conceal=false;
  setArrivalHidden(false);
  const real=targetCard(id);
  if(real)real.classList.add('sanctum-merge-arrived');
  greater.classList.add('sanctum-merge-visible');
  flash.classList.add('sanctum-merge-flash-active');
 },revealDelay);
 setTimeout(()=>{
  // The animation is UI-only; the real Greater remains in Gateway.
  const real=targetCard(id);
  if(real)real.classList.remove('sanctum-merge-arrival-hidden','sanctum-merge-arrived');
  twins.forEach(({el})=>el.remove());
  greater.remove();flash.remove();
  if(active?.id===id)active=null;
  busy=false;drain();
 },duration+120);
}
function drain(){
 if(busy||!waiting.length)return;
 const next=waiting.shift();
 if(!next||!S?.started){waiting.length=0;return}
 play(next);
}
window.__sanctumRenderDemonMergeFx=function(){
 try{
  if(active&&active.conceal)setArrivalHidden(true);
  const list=(typeof S!=='undefined'&&S&&Array.isArray(S.demonMergeVisuals))?S.demonMergeVisuals:[];
  const now=Date.now();
  for(const event of list){
   const id=String(event?.id||'');
   if(!id||seen.has(id))continue;
   seen.add(id);
   if(seen.size>150){
    const oldest=seen.values().next().value;
    seen.delete(oldest);
   }
   if(Number.isFinite(event.createdAt)&&Math.abs(now-event.createdAt)<12000&&
      Array.isArray(event.sources)&&event.sources.length===2&&event.result?.id)waiting.push(event);
  }
  if(waiting.length>12)waiting.splice(0,waiting.length-12);
  drain();
 }catch(err){console.warn('Demon merge visual failed safely',err)}
};
window.__sanctumDemonMergeVisualState=()=>({
 busy,queued:waiting.length,seen:seen.size,
 currentGreater:active?.id||null
});
})();
