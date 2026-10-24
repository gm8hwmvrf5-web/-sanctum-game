/* Layout-redesign HUD placement correction.
 * Reuse the ORIGINAL live game meters / blood gauge. The older priest renderer
 * moves Relic XP into a sidebar after each render; this keeps it at TOP CENTER.
 * The Demon Blood gauge is moved ABOVE the Ritual title, never duplicated.
 * Card play, ritual effects, turn state, saves, and multiplayer are untouched.
 */
(()=>{
 'use strict';
 const app=document.querySelector('body > .app.layoutPhase5');
 const status=document.getElementById('topStatusBar');
 const ritualRoot=document.getElementById('ritualContent');
 if(!app||!status||!ritualRoot)return;
 app.classList.add('layoutHudCorrected');

 function placeHud(){
  // The live XP meter is repeatedly moved to .priestRelicTopStack by
  // rogueliteRenderHud and renderPlayer patches. Reparent it AFTER each draw.
  const xp=document.getElementById('relicXpMeterStat');
  if(xp&&xp.parentElement!==status){
   const timer=document.getElementById('turnTimerStat');
   status.insertBefore(xp,timer&&timer.parentElement===status?timer:null);
  }
  for(const id of ['manaStatBox','altarStatBox']){
   const el=document.getElementById(id);
   if(el&&el.parentElement!==status)status.appendChild(el);
  }
  const gauge=ritualRoot.querySelector('.ritualBloodGauge');
  const heading=ritualRoot.querySelector('.ritualTitleWithBlood');
  if(gauge&&heading){
   let dock=document.getElementById('layoutBloodDock');
   if(!dock||dock.parentElement!==ritualRoot){
    dock=document.createElement('div');
    dock.id='layoutBloodDock';
    dock.className='layoutBloodDock';
    dock.setAttribute('aria-label','Demon Blood above Rituals');
    const label=document.createElement('span');
    label.className='layoutBloodLabel';
    label.textContent='DEMON BLOOD';
    dock.appendChild(label);
    ritualRoot.insertBefore(dock,heading);
   }
   if(gauge.parentElement!==dock)dock.appendChild(gauge);
  }
 }
 // Both existing functions may rearrange the XP meter, so repair after each.
 if(typeof renderPlayer==='function'){
  const previous=renderPlayer;
  renderPlayer=function(){const value=previous.apply(this,arguments);placeHud();return value;};
 }
 if(typeof rogueliteRenderHud==='function'){
  const previous=rogueliteRenderHud;
  rogueliteRenderHud=function(){const value=previous.apply(this,arguments);placeHud();return value;};
 }
 if(typeof render==='function'){
  const previous=render;
  render=function(){const value=previous.apply(this,arguments);placeHud();return value;};
 }
 placeHud();
})();
