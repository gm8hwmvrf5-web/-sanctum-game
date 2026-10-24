/* Sanctum Layout Redesign — Phase 5 accessibility/touch adapter.
 * No combat, card, turn, save, reward, or multiplayer logic changes.
 * Legacy iPhone scaler is skipped while .layoutPhase5 is active.
 */
(()=>{
  'use strict';
  const app=document.querySelector('body > .app.layoutPhase4');
  if(!app)return;
  app.classList.add('layoutPhase5');

  // The original iPhone sizing script sets inline !important transforms.
  // Remove them once when adopting the full-viewport Phase 5 shell; its
  // landscape fit guard now knows to leave the redesign unscaled.
  for(const name of ['position','left','top','width','height','transform','transform-origin']){
    app.style.removeProperty(name);
  }
  document.documentElement.classList.remove('iphoneGameFit');
  document.body.classList.remove('iphoneGameFit');

  // Keep a dependable pause/menu control outside the scrolling ritual panel.
  // The existing pause overlay remains the ONLY menu implementation.
  let menu=document.getElementById('layoutMobileMenuBtn');
  if(!menu){
    menu=document.createElement('button');
    menu.type='button';
    menu.id='layoutMobileMenuBtn';
    menu.className='btn layoutMobileMenuBtn';
    menu.setAttribute('aria-label','Open pause menu');
    menu.setAttribute('title','Pause and open game menu');
    menu.textContent='☰  MENU';
    menu.addEventListener('click',()=>{
      if(typeof window.openGameMenu==='function')window.openGameMenu();
      else document.getElementById('pauseBtn')?.click();
    });
    app.appendChild(menu);
  }

  // In portrait, the hand and Rituals are stacked below a 440px room view.
  // Absolutely positioned panels do not contribute to the app's scroll height;
  // measure the real panel so the final Ritual button stays reachable.
  function updatePortraitScrollSpace(){
    const isPortrait=typeof window.matchMedia==='function'&&
      window.matchMedia('(orientation:portrait) and (max-width:760px)').matches;
    if(!isPortrait){
      app.style.removeProperty('min-height');
      return;
    }
    const panel=document.getElementById('handPanel');
    if(!panel)return;
    const appRect=app.getBoundingClientRect();
    const bottom=panel.getBoundingClientRect().bottom-appRect.top;
    if(Number.isFinite(bottom)&&bottom>0)
      app.style.setProperty('min-height',Math.max(1150,Math.ceil(bottom+36))+'px','important');
  }
  if(typeof ResizeObserver==='function'){
    const panel=document.getElementById('handPanel');
    if(panel)new ResizeObserver(updatePortraitScrollSpace).observe(panel);
  }
  window.addEventListener('resize',updatePortraitScrollSpace);
  window.addEventListener('orientationchange',updatePortraitScrollSpace);
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(updatePortraitScrollSpace);

  // Phase 2 overlays and Phase 4 cinematic are deliberately click-through.
  // Confirming keyboard/touch semantics for the existing room tabs requires
  // only ARIA text changes, never a replacement of their click handlers.
  const nav=document.getElementById('layoutRoomNav');
  if(nav){
    nav.setAttribute('aria-label','Inspect rooms for enemies');
    const tabs=[...nav.querySelectorAll('.layoutRoomTab')];
    tabs.forEach(tab=>{tab.setAttribute('title','Inspect '+(tab.querySelector('span')?.textContent||'room'));});
  }
})();
