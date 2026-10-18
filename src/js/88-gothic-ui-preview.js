/* Visual-only Gothic UI preview for a dedicated testing branch.
 * Original game state, button events and Supabase behavior are reused. */
(()=>{
'use strict';
const app=document.querySelector('body>.app');
const board=document.getElementById('boardSection');
const originalHud=document.getElementById('topStatusBar');
if(!app||!board||!originalHud)return;
document.documentElement.classList.add('gothicUiPreview');

const header=document.createElement('div');
header.id='gothicPreviewHeader';
header.setAttribute('aria-label','Wardcraft and combat status');
header.innerHTML='<div id="gothicWardHeader"><strong>WARDCRAFT</strong><span id="gothicWardStatus">Wardcraft is waiting for the next passage.</span></div><div id="gothicHudDock"></div>';
app.insertBefore(header,board);
header.querySelector('#gothicHudDock').appendChild(originalHud);
const xp=document.createElement('div');
xp.id='gothicXpHud';
xp.setAttribute('aria-label','Relic XP');
xp.innerHTML='<b id="gothicXpValue">0 / 35</b><small>RELIC XP</small><span class="gothicXpTrack"><span class="gothicXpFill" id="gothicXpFill"></span></span>';
originalHud.appendChild(xp);

function status(){
 const ward=typeof window.__sanctumWards==='object'?window.__sanctumWards:null;
 const s=typeof S!=='undefined'?S:null;
 const a=s?.wardcraft;
 const label=document.getElementById('gothicWardStatus');
 if(!label)return;
 if(!s?.started){label.textContent='Wards await your descent';}
 else if(a?.active){label.textContent='Active Ward · '+(ward?.definitions?.find(w=>w.key===a.active.key)?.name||'Sanctum Ward');}
 else if(a?.selected){label.textContent='Ward ready to place';}
 else if(a?.offers?.length){label.textContent='Choose your Ward for this passage';}
 else{const interval=ward?.interval||3;const count=Math.max(0,Number(a?.combatPassages)||0);const left=interval-(count%interval);label.textContent='Next Ward draft in '+left+' combat passage'+(left===1?'':'s');}
 const relicMeter=document.getElementById('relicXpMeterStat');
 const value=document.getElementById('relicXpMeterValue');
 const out=document.getElementById('gothicXpValue');
 if(value&&out)out.textContent=value.textContent;
 const now=Number(relicMeter?.getAttribute('aria-valuenow'))||0;
 const max=Number(relicMeter?.getAttribute('aria-valuemax'))||35;
 const fill=document.getElementById('gothicXpFill');
 if(fill)fill.style.width=Math.min(100,Math.max(0,now/Math.max(1,max)*100))+'%';
}
function improveRituals(){
 document.querySelectorAll('#ritualPanel .ritualMain .rituals>.ritual:not([data-gothic-ritual])').forEach((ritual,index)=>{
  const title=ritual.querySelector(':scope > b');
  const details=ritual.querySelector(':scope > small');
  const btn=ritual.querySelector(':scope > button');
  if(!title||!details||!btn)return;
  const name=title.textContent.trim();
  const textCost=[...ritual.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join(' ');
  const cost=(textCost.match(/(\d+)\s+Demon Blood/i)||[])[1]||'0';
  const head=document.createElement('div');
  head.className='gothicRitualHead';
  const seal=document.createElement('span');
  seal.className='gothicRitualSeal';
  seal.setAttribute('aria-hidden','true');
  seal.textContent=['♰','✦','☀'][index]||'✦';
  const caption=document.createElement('span');
  const titleNode=document.createElement('b');titleNode.className='gothicRitualName';titleNode.textContent=name;
  const costNode=document.createElement('small');costNode.className='gothicRitualCost';costNode.textContent=cost+' Demon Blood';
  caption.append(titleNode,costNode);head.append(seal,caption);
  const tiers=document.createElement('div');tiers.className='gothicRitualTiers';
  const sectionHtml=details.innerHTML.split(/<br\s*\/?>/i);
  sectionHtml.forEach(html=>{
   if(!html.trim())return;
   const el=document.createElement('div');el.className='gothicRitualTier';
   el.innerHTML=html;
   tiers.appendChild(el);
  });
  ritual.replaceChildren(head,tiers,btn);
  ritual.dataset.gothicRitual='1';
 });
}
function mountUI(){
 const cards=document.querySelector('#handPanel .handCharacterCards');
 if(cards&&!cards.querySelector(':scope > .gothicHandTitle')){
  const title=document.createElement('div');
  title.className='gothicHandTitle';title.textContent='PRIEST HAND';
  cards.insertBefore(title,cards.firstChild);
 }
 const priest=document.querySelector('#handPanel .handCharacterPriest');
 if(!priest)return;
 let actionBar=document.getElementById('gothicPreviewActions');
 if(!actionBar){
  actionBar=document.createElement('div');actionBar.id='gothicPreviewActions';
  actionBar.setAttribute('role','group');
  actionBar.setAttribute('aria-label','Priest turn actions');
  priest.appendChild(actionBar);
 }
 // Priest rerenders create fresh gameplay buttons in the Ritual panel.
 // Prefer those over the detached previous buttons in the action strip.
 const freshBasic=priest.querySelector('#ritualPanel #basicBtn');
 const freshEnd=priest.querySelector('#ritualPanel #endBtn');
 const priorBasic=actionBar.querySelector('#basicBtn');
 const priorEnd=actionBar.querySelector('#endBtn');
 const basic=freshBasic||priorBasic;
 const end=freshEnd||priorEnd;
 const ward=document.getElementById('wardcraftCast');
 if(!basic||!end)return;
 if(priorBasic&&priorBasic!==basic)priorBasic.remove();
 if(priorEnd&&priorEnd!==end)priorEnd.remove();
 // Reuse live onClick bindings, do not create substitute gameplay actions.
 if(basic.parentNode!==actionBar)actionBar.appendChild(basic);
 let placeholder=document.getElementById('gothicWardPlaceholder');
 if(!placeholder){
  placeholder=document.createElement('button');placeholder.id='gothicWardPlaceholder';
  placeholder.className='btn';placeholder.type='button';placeholder.textContent='Place Ward';
  placeholder.disabled=true;placeholder.title='Earn and choose a Ward to place it.';
 }
 if(ward&&ward.parentNode!==actionBar)actionBar.appendChild(ward);
 if(placeholder.parentNode!==actionBar)actionBar.appendChild(placeholder);
 placeholder.hidden=!!(ward&&!ward.hidden);
 if(end.parentNode!==actionBar)actionBar.appendChild(end);
 let menu=document.getElementById('gothicMenuBtn');
 if(!menu){
  menu=document.createElement('button');menu.type='button';menu.id='gothicMenuBtn';
  menu.className='btn';menu.textContent='Menu';menu.setAttribute('aria-label','Open pause menu');
  menu.addEventListener('click',()=>{if(typeof window.openGameMenu==='function')window.openGameMenu();});
 }
 if(menu.parentNode!==actionBar)actionBar.appendChild(menu);
 improveRituals();
 status();
}
function enhance(){try{mountUI();status();}catch(e){console.warn('[Gothic UI preview] Decoration skipped:',e)}}
// Defer direct Priest rerenders until Wardcraft has attached its live button.
if(typeof renderPlayer==='function'){
 const prev=renderPlayer;
 renderPlayer=function(){const out=prev.apply(this,arguments);queueMicrotask(enhance);return out};
}
if(typeof render==='function'){
 const prev=render;
 render=function(){const out=prev.apply(this,arguments);enhance();return out};
 try{window.render=render}catch(_){}
}
if(typeof rogueliteRenderHud==='function'){
 const prev=rogueliteRenderHud;
 rogueliteRenderHud=function(){const out=prev.apply(this,arguments);queueMicrotask(enhance);return out};
}
enhance();
window.__sanctumGothicPreview={mount:enhance};
})();
