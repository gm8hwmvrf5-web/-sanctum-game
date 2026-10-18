/* Faithful SVG-art Gothic visual layer. The game engine stays unchanged. */
(()=>{
'use strict';
const app=document.querySelector('body>.app'),board=document.getElementById('boardSection'),hud=document.getElementById('topStatusBar');
if(!app||!board||!hud)return;
document.documentElement.classList.add('gothicUiPreview');
const banner=document.createElement('div');banner.id='gothicPreviewHeader';
banner.setAttribute('aria-label','Wardcraft and combat status');
banner.innerHTML='<div id="gothicWardHeader"><strong>WARDCRAFT</strong><span id="gothicWardStatus">Wards await your descent</span></div><img id="gothicCenterCrest" src="./assets/ui-gothic/header-crest.svg" alt="" aria-hidden="true"><div id="gothicHudDock"></div>';
app.insertBefore(banner,board);
banner.querySelector('#gothicHudDock').appendChild(hud);
const xp=document.createElement('div');xp.id='gothicXpHud';
xp.setAttribute('aria-label','Relic XP');
xp.innerHTML='<b id="gothicXpValue">0 / 35</b><small>RELIC XP</small><span class="gothicXpTrack"><span class="gothicXpFill" id="gothicXpFill"></span></span>';
hud.appendChild(xp);
const progress=document.createElement('div');progress.id='gothicProgressChip';progress.className='stat';
progress.setAttribute('aria-label','Current floor and run progress');
progress.innerHTML='<b id="gothicFloorValue">1 / 15</b><span>FLOOR</span>';
const defeat=document.getElementById('defeatStat')?.closest('.stat');
hud.insertBefore(progress,defeat||xp);
for(const room of board.querySelectorAll('.room')){
 if(!room.querySelector('.gothicRoomFrame')){
  const art=document.createElement('span');art.className='gothicRoomFrame';art.setAttribute('aria-hidden','true');room.appendChild(art);
 }
}
function syncStatus(){
 const s=typeof S==='undefined'?null:S,ward=window.__sanctumWards||null,a=s?.wardcraft;
 const out=document.getElementById('gothicWardStatus');
 if(out){
  if(!s?.started)out.textContent='Wards await your descent';
  else if(a?.active)out.textContent='Active Ward · '+(ward?.definitions?.find(w=>w.key===a.active.key)?.name||'Sanctum Ward');
  else if(a?.selected)out.textContent='Ward ready to place';
  else if(a?.offers?.length)out.textContent='Choose your Ward for this passage';
  else{const n=ward?.interval||3,c=Math.max(0,Number(a?.combatPassages)||0),left=n-c%n;out.textContent='Next Ward draft in '+left+' combat passage'+(left===1?'':'s');}
 }
 const value=document.getElementById('relicXpMeterValue'),meter=document.getElementById('relicXpMeterStat');
 const text=document.getElementById('gothicXpValue'),fill=document.getElementById('gothicXpFill');
 if(value&&text)text.textContent=value.textContent;
 const floor=document.getElementById('rogueFloor')?.textContent||'?';
 const f=document.getElementById('gothicFloorValue');if(f)f.textContent=floor;
 const prog=document.getElementById('gothicProgressChip');
 if(prog){
  const passage=document.getElementById('roguePassage')?.textContent||'?';
  const act=document.getElementById('rogueAct')?.textContent||'?';
  const round=document.getElementById('roundStat')?.textContent||'?';
  prog.title='Passage '+passage+' · Act '+act+' · Floor '+floor+' · Round '+round;
  prog.setAttribute('aria-label',prog.title);
 }
 if(fill){const v=Number(meter?.getAttribute('aria-valuenow'))||0,max=Math.max(1,Number(meter?.getAttribute('aria-valuemax'))||35);fill.style.width=(Math.min(100,Math.max(0,v/max*100)))+'%';}
}
function enhanceRituals(){
 const rituals=document.querySelectorAll('#ritualPanel .ritualMain .rituals>.ritual:not([data-gothic-ritual])');
 rituals.forEach((r,index)=>{
  const title=r.querySelector(':scope > b'),desc=r.querySelector(':scope > small'),button=r.querySelector(':scope > button[data-rit]');
  if(!title||!desc||!button)return;
  const cost=(Array.from(r.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').match(/(\d+)\s+Demon Blood/i)||[])[1]||'0';
  const head=document.createElement('div');head.className='gothicRitualHead';
  const seal=document.createElement('span');seal.className='gothicRitualSeal';seal.dataset.ritualIndex=String(index);seal.textContent=['♰','✦','☀'][index]||'✦';seal.setAttribute('aria-hidden','true');
  const info=document.createElement('span');
  const name=document.createElement('b');name.className='gothicRitualName';name.textContent=title.textContent;
  const blood=document.createElement('small');blood.className='gothicRitualCost';blood.textContent=cost+' Demon Blood';
  info.append(name,blood);head.append(seal,info);
  const tiers=document.createElement('div');tiers.className='gothicRitualTiers';
  desc.innerHTML.split(/<br\s*\/?>/i).forEach(s=>{
   if(!s.trim())return;
   const section=document.createElement('div');section.className='gothicRitualTier';section.innerHTML=s;tiers.appendChild(section);
  });
  r.replaceChildren(head,tiers,button);r.dataset.gothicRitual='1';
  // Retain the original ritual button and its game handler, but make the full
  // parchment clickable for mouse/touch and keyboard in the mockup layout.
  r.classList.add('gothicRitualReady');r.setAttribute('role','button');r.tabIndex=0;
  r.setAttribute('aria-label',name.textContent+' — '+blood.textContent+'. '+button.textContent);
  r.onclick=event=>{if(event.target.closest('button'))return;button.click();};
  r.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();button.click();}};
 });
}
function mount(){
 const priest=document.querySelector('#handPanel .handCharacterPriest');
 if(!priest)return;
 const cards=document.querySelector('#handPanel .handCharacterCards');
 if(cards&&!cards.querySelector(':scope > .gothicHandTitle')){
  const unused=document.createElement('div');unused.className='gothicHandTitle';unused.textContent='Priest hand';cards.insertBefore(unused,cards.firstChild);
 }
 let ritualHeading=document.getElementById('gothicRitualHeading');
 if(!ritualHeading){
  ritualHeading=document.createElement('div');ritualHeading.id='gothicRitualHeading';
  ritualHeading.innerHTML='<span class="gothicHeadingText">RITUALS</span>';
  priest.insertBefore(ritualHeading,document.getElementById('ritualPanel'));
 }
 const freshSummary=document.querySelector('#handPanel .priestRelicTopStack .relicSummary');
 const existingSummary=ritualHeading.querySelector('.relicSummary');
 if(freshSummary){
  if(existingSummary&&existingSummary!==freshSummary)existingSummary.remove();
  ritualHeading.appendChild(freshSummary);
 }
 const gauge=document.querySelector('#ritualPanel .ritualTitleWithBlood .ritualBloodGauge');
 if(gauge){
  // The Priest renderer regenerates this meter: remove previous copies.
  ritualHeading.querySelectorAll('.ritualBloodGauge').forEach(node=>node.remove());
  ritualHeading.appendChild(gauge);
 }
 let actions=document.getElementById('gothicPreviewActions');
 if(!actions){actions=document.createElement('div');actions.id='gothicPreviewActions';actions.setAttribute('role','group');actions.setAttribute('aria-label','Priest turn actions');priest.appendChild(actions);}
 // The engine recreates the Priest tracker on each render. Prefer those
 // newly wired buttons; old buttons are detached to avoid duplicate IDs.
 const newBasic=priest.querySelector('#ritualPanel #basicBtn'),newEnd=priest.querySelector('#ritualPanel #endBtn');
 const oldBasic=actions.querySelector('#basicBtn'),oldEnd=actions.querySelector('#endBtn');
 const basic=newBasic||oldBasic,end=newEnd||oldEnd;
 if(!basic||!end)return;
 if(oldBasic&&oldBasic!==basic)oldBasic.remove();
 if(oldEnd&&oldEnd!==end)oldEnd.remove();
 const ward=document.getElementById('wardcraftCast');
 let placeholder=document.getElementById('gothicWardPlaceholder');
 if(!placeholder){placeholder=document.createElement('button');placeholder.id='gothicWardPlaceholder';placeholder.type='button';placeholder.className='btn';placeholder.disabled=true;placeholder.textContent='Place Ward';placeholder.title='Choose a Ward to enable placement';}
 placeholder.hidden=!!ward&&!ward.hidden;
 let menu=document.getElementById('gothicMenuBtn');
 if(!menu){menu=document.createElement('button');menu.type='button';menu.className='btn';menu.id='gothicMenuBtn';menu.textContent='Menu';menu.setAttribute('aria-label','Open pause menu');menu.addEventListener('click',()=>window.openGameMenu?.());}
 // Fixed mockup order. Re-mount the live Ward button after Wardcraft's render hook.
 actions.appendChild(basic);
 if(ward)actions.appendChild(ward);
 actions.appendChild(placeholder);
 actions.appendChild(end);
 actions.appendChild(menu);
 enhanceRituals();
 syncStatus();
}
let queued=false;
function enhance(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{mount()}catch(err){console.warn('Gothic visual preview skipped',err)}});}
if(typeof renderPlayer==='function'){
 const prev=renderPlayer;
 renderPlayer=function(){const result=prev.apply(this,arguments);enhance();return result};
}
if(typeof render==='function'){
 const prev=render;
 render=function(){const result=prev.apply(this,arguments);mount();syncStatus();return result};
 try{window.render=render}catch(_){}
}
if(typeof rogueliteRenderHud==='function'){
 const prev=rogueliteRenderHud;
 rogueliteRenderHud=function(){const result=prev.apply(this,arguments);enhance();return result};
}
enhance();
window.__sanctumGothicPreview={mount:()=>{mount();syncStatus();}};
})();
