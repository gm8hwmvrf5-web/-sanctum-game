/* Linked Demons — isolated gameplay/status addition for Clean Rebuild.
 * The authoritative S.rooms status stores each bond; saved games and
 * multiplayer snapshots automatically preserve/replay it. */
(()=>{
'use strict';
if(window.__sanctumLinkedDemonsInstalled)return;
window.__sanctumLinkedDemonsInstalled=true;

const LINK_CHANCE=0.15, LINK_ATTACK=1, RAGE_ATTACK=2, RAGE_HP_RATIO=0.20;
const board=()=>Array.isArray(S?.rooms)?S.rooms.flat().filter(Boolean):[];
const byId=id=>board().find(d=>String(d.id)===String(id))||null;
const live=d=>!!(d&&d.id&&byId(d.id)===d);
const status=d=>d.status||(d.status={});
function partner(d){
 const mateId=d?.status?.bloodBondPartnerId;
 if(mateId==null)return null;
 const mate=byId(mateId);
 return mate&&String(mate.status?.bloodBondPartnerId)===String(d.id)?mate:null;
}
function isLinked(d){return !!(live(d)&&partner(d))}
function tryLink(d){
 // Roll only once for each eligible entrance. No queue, dead, or
 // already-bound Demon can roll. Distinct types avoid instant pair merges.
 if(!live(d)||d.status?.bloodBondSpent||d.status?.bloodBondPartnerId!=null)return false;
 const eligible=board().filter(other=>other!==d
  &&other.id!=null&&other.key!==d.key&&other.cur>0
  &&!other.status?.bloodBondSpent&&other.status?.bloodBondPartnerId==null);
 if(!eligible.length||Math.random()>=LINK_CHANCE)return false;
 const mate=eligible[Math.floor(Math.random()*eligible.length)];
 status(d).bloodBondPartnerId=String(mate.id);
 status(mate).bloodBondPartnerId=String(d.id);
 log('BLOOD BOND — '+demonName(d)+' and '+demonName(mate)+
  ' are LINKED. Both gain +'+LINK_ATTACK+' Attack until one is defeated.','bad');
 return true;
}
function breakBond(d,defeated=false){
 const id=d?.status?.bloodBondPartnerId;
 if(id==null)return false;
 const mate=partner(d);
 delete status(d).bloodBondPartnerId;
 status(d).bloodBondSpent=true;
 if(!mate)return false;
 delete status(mate).bloodBondPartnerId;
 status(mate).bloodBondSpent=true;
 if(defeated&&live(mate)){
  const bonus=Math.max(1,Math.ceil(demonMaxHP(mate)*RAGE_HP_RATIO));
  status(mate).bloodBondRageHp=(Number(mate.status.bloodBondRageHp)||0)+bonus;
  status(mate).bloodBondRageAttack=(Number(mate.status.bloodBondRageAttack)||0)+RAGE_ATTACK;
  mate.cur=Math.min(demonMaxHP(mate),mate.cur+bonus);
  log('BLOOD BOND BROKEN — '+demonName(mate)+' is ENRAGED by the defeat of '+
   demonName(d)+': +'+bonus+' maximum/current HP and +'+RAGE_ATTACK+' Attack.','bad');
 }else{
  log('BLOOD BOND — '+demonName(d)+' and '+demonName(mate)+' are no longer linked.','info');
 }
 return true;
}
const rawHP=demonMaxHP;
demonMaxHP=function(d){
 return rawHP.apply(this,arguments)+Math.max(0,Number(d?.status?.bloodBondRageHp)||0);
};
const rawAttack=demonAttack;
demonAttack=function(d){
 return Math.max(0,rawAttack.apply(this,arguments)
  +(isLinked(d)?LINK_ATTACK:0)
  +Math.max(0,Number(d?.status?.bloodBondRageAttack)||0));
};
const rawPlace=placeEnteringDemon;
placeEnteringDemon=function(d){
 const result=rawPlace.apply(this,arguments);
 if(result>=0&&live(d))tryLink(d);
 return result;
};
const rawDefeat=defeatDemon;
defeatDemon=function(d){
 if(live(d))breakBond(d,true);
 return rawDefeat.apply(this,arguments);
};
const rawMove=moveOneForward;
moveOneForward=function(d){
 const before=live(d),out=rawMove.apply(this,arguments);
 // Leaving the Crypt for the Altar breaks the link, but isn't a kill.
 if(before&&out&&!live(d))breakBond(d,false);
 return out;
};
const rawMerge=checkMerge;
checkMerge=function(){
 const before=board().slice();
 const result=rawMerge.apply(this,arguments);
 if(result){
  // A merge is a transformation, not a kill. Clear orphaned links
  // when a donor is consumed; do not grant Rage for merging.
  for(const d of before){
   if(!live(d)&&d.status?.bloodBondPartnerId!=null)breakBond(d,false);
  }
  // A transformed host may carry a bond to a donor now absent.
  for(const d of board()){
   if(d.status?.bloodBondPartnerId!=null&&!partner(d)){
    delete d.status.bloodBondPartnerId;
    d.status.bloodBondSpent=true;
   }
  }
 }
 return result;
};
const CHAIN='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9.2 8.5 7.7 7A4 4 0 0 0 2 12.7l3.8 3.8a4 4 0 0 0 5.7-5.7l-1.1-1.1M14.8 15.5l1.5 1.5a4 4 0 0 0 5.7-5.7l-3.8-3.8a4 4 0 0 0-5.7 5.7l1.1 1.1M9 15l6-6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DEMON_HEAD='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 8 3 2l7 3M18 8l3-6-7 3M6 8c-2 2-2 6 0 9l4 4h4l4-4c2-3 2-7 0-9-3-3-9-3-12 0Z M8 12l3 1-2 2M16 12l-3 1 2 2M10 18l2-2 2 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Anatomical heart silhouette: vessels at the crown, asymmetric ventricles.
const HEART='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 7V3c0-1.3 2-1.3 2 0v3M13 7V2c0-1.3 2-1.3 2 0v6M16 8l3-3c1-1 2.6.3 1.6 1.6L18 10M9 7C5 5 3 8 4 12c.6 2.4 3 3.5 4.3 5.9L11 22l3-3c2.7-2.5 5.2-5 4-9-1-3-3.2-4-5-3l-2 2-2-2Z M9 11c-2 1-2 3-1 5M14 11c2 1 2 4 0 6" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function decorate(){
 if(typeof document==='undefined')return;
 for(const card of document.querySelectorAll('#boardSection .demons .demon[data-demon]')){
  const d=byId(card.dataset.demon);
  const linked=!!(d&&isLinked(d)),rage=!!d?.status?.bloodBondRageAttack;
  const turnHp=Math.max(0,Number(d?.status?.enrageHpBonus)||0);
  card.classList.toggle('sanctum-blood-linked',linked);
  card.classList.toggle('sanctum-blood-enraged',rage);
  card.querySelectorAll('.sanctum-blood-marker').forEach(el=>el.remove());
  if(!linked&&!rage&&!turnHp)continue;
  const art=card.querySelector('.demonArtWrap')||card;
  const group=document.createElement('span');
  group.className='sanctum-blood-marker-group';
  const marker=(type,svg,label)=>{
   const icon=document.createElement('span');
   icon.className='sanctum-blood-marker sanctum-blood-marker-'+type;
   icon.innerHTML=svg;
   icon.title=label;
   icon.setAttribute('aria-label',label);
   group.appendChild(icon);
  };
  if(linked)marker('link',CHAIN,'Blood Bond: +'+LINK_ATTACK+' Attack while linked');
  if(rage)marker('rage',DEMON_HEAD,'Blood Bond Rage: +'+RAGE_ATTACK+' Attack, +'+d.status.bloodBondRageHp+' HP');
  if(turnHp)marker('heart',HEART,'Kill Enrage: +'+turnHp+' HP and Attack this turn from '+turnHp+' prior kill'+(turnHp===1?'':'s'));
  art.appendChild(group);
 }
}
const rawRender=render;
render=function(){
 const out=rawRender.apply(this,arguments);
 try{decorate()}catch(err){console.warn('Blood Bond visual skipped',err)}
 return out;
};
try{window.render=render}catch(_){}
window.__sanctumLinkedDemons={partner,isLinked,tryLink,breakBond,decorate,
 chance:LINK_CHANCE,linkAttack:LINK_ATTACK,rageAttack:RAGE_ATTACK,rageHpRatio:RAGE_HP_RATIO};
try{decorate()}catch(_){}
})();
