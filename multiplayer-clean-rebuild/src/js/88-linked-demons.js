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
const FLAME='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2C11 7 6.5 9.2 6.5 14.3a5.5 5.5 0 0 0 11 0c0-3.5-2.2-5.5-3.2-6.8.2 3-1 4.3-2.3 5.3.4-4.1-.1-7.1 0-10.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
function decorate(){
 if(typeof document==='undefined')return;
 for(const card of document.querySelectorAll('#boardSection .demons .demon[data-demon]')){
  const d=byId(card.dataset.demon);
  const linked=d&&isLinked(d),enraged=!!d?.status?.bloodBondRageAttack;
  card.classList.toggle('sanctum-blood-linked',!!linked);
  card.classList.toggle('sanctum-blood-enraged',enraged);
  card.querySelectorAll('.sanctum-blood-marker').forEach(el=>el.remove());
  if(!linked&&!enraged)continue;
  const art=card.querySelector('.demonArtWrap')||card;
  const icon=document.createElement('span');
  icon.className='sanctum-blood-marker '+(enraged?'sanctum-blood-marker-rage':'sanctum-blood-marker-link');
  icon.innerHTML=(enraged?FLAME:CHAIN)+
   '<span>'+(enraged?'RAGE':'LINK')+'</span>';
  icon.title=enraged
   ?'Blood Bond Rage: +'+RAGE_ATTACK+' Attack, +'+d.status.bloodBondRageHp+' HP'
   :'Blood Bond: +'+LINK_ATTACK+' Attack each while both survive; defeating one enrages the other';
  icon.setAttribute('aria-label',icon.title);
  art.appendChild(icon);
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
