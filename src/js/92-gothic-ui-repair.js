/* Polish existing live Priest controls (never replace their event handlers).
 * Run after every game rerender because Priest DOM elements are regenerated. */
(()=>{
'use strict';
const designs={
  basicBtn:{label:'Basic Attack',glyph:'<path d="m3 21 6-6m-5-9 14 14M7 3l14 14m-2-16-4 4m3-2 3 3M16 5l3-3" /><path d="m3 3 4 4m-3-2 3-3M3 21l5-5m-6 3 3 3"/>'},
  wardcraftCast:{label:'Place Ward',glyph:'<path d="M12 2v20M5 8h14M9 18l3 4 3-4"/><path d="M6 4 4 6m14-2 2 2M3 12h2m14 0h2"/>'},
  gothicWardPlaceholder:{label:'Place Ward',glyph:'<path d="M12 2v20M5 8h14M9 18l3 4 3-4"/><path d="M6 4 4 6m14-2 2 2M3 12h2m14 0h2"/>'},
  endBtn:{label:'End Turn',glyph:'<path d="M5 3h14M5 21h14M7 3v4c0 2 3 3 5 5-2 2-5 3-5 5v4M17 3v4c0 2-3 3-5 5 2 2 5 3 5 5v4"/>'},
  gothicMenuBtn:{label:'Menu',glyph:'<path d="M4 6h16M4 12h16M4 18h16"/>'}
};
function refine(){
 const actionBar=document.getElementById('gothicPreviewActions');
 if(!actionBar)return;
 for(const button of actionBar.querySelectorAll('button')){
  const config=designs[button.id];if(!config)continue;
  const raw=(button.querySelector('.gothicActionLabel')?.textContent||button.textContent||'').replace(/\s+/g,' ').trim();
  if(button.dataset.gothicLastLabel===raw&&button.querySelector('.gothicActionIcon'))continue;
  button.dataset.gothicLastLabel=raw;
  const icon=document.createElement('span');icon.className='gothicActionIcon';icon.setAttribute('aria-hidden','true');
  icon.innerHTML='<svg viewBox="0 0 24 24" focusable="false" xmlns="http://www.w3.org/2000/svg">'+config.glyph+'</svg>';
  const caption=document.createElement('span');caption.className='gothicActionLabel';
  if(button.id==='basicBtn'){
   const cost=raw.match(/\(([^)]+)\)\s*$/);
   const label=document.createElement('span');
   label.textContent=raw.includes('Used')?'Attack Used':'Basic Attack';
   caption.append(label);
   if(cost){const c=document.createElement('small');c.className='gothicActionCost';c.textContent='('+cost[1]+')';caption.append(c);}
  }else{
   caption.textContent=raw||config.label;
  }
  // Keep onclick and game-supplied disabled/title/aria attributes on the button.
  button.replaceChildren(icon,caption);
 }
}
const crest=document.getElementById('gothicCenterCrest');
if(crest)crest.remove();
const gameHeader=document.getElementById('gothicWardHeader');
const gameTitle=gameHeader?.querySelector('strong');
if(gameTitle)gameTitle.innerHTML='<span>SANCTUM</span><small>OF THE DAMNED</small>';
window.__sanctumPolishActions=refine;
refine();
})();
