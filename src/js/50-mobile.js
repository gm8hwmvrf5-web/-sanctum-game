/* Clean rebuild module: iPhone/mobile presentation and PWA. Original execution order preserved. */

/* source: iphonePriestPauseMenuButtonV3Script */
(()=>{
  'use strict';
  const iphoneLandscape=()=>window.matchMedia('(orientation:landscape) and (max-height:520px) and (max-width:1000px)').matches;

  function ensurePriestMenuButton(){
    const existing=document.getElementById('iphonePauseMenuBtn');
    if(!iphoneLandscape()){
      if(existing)existing.remove();
      return;
    }

    const tracker=document.querySelector('#handPanel .handCharacterPriest .ritualTracker');
    if(!tracker)return;

    let btn=existing;
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.id='iphonePauseMenuBtn';
      btn.className='btn trackerAction';
      btn.textContent='Menu';
      btn.setAttribute('aria-label','Open pause menu');
      btn.addEventListener('click',()=>{
        if(typeof window.openGameMenu==='function')window.openGameMenu();
      });
    }

    // Keep the single Menu button at the far right of the same row.
    if(btn.parentElement!==tracker)tracker.appendChild(btn);
    else tracker.appendChild(btn);
  }

  if(typeof renderPlayer==='function'){
    const priorRenderPlayer=renderPlayer;
    renderPlayer=function(){
      const out=priorRenderPlayer();
      ensurePriestMenuButton();
      return out;
    };
  }

  if(typeof rogueliteRenderHud==='function'){
    const priorRogueHud=rogueliteRenderHud;
    rogueliteRenderHud=function(){
      const out=priorRogueHud();
      ensurePriestMenuButton();
      return out;
    };
  }

  window.addEventListener('resize',ensurePriestMenuButton);
  window.addEventListener('orientationchange',()=>setTimeout(ensurePriestMenuButton,50));
  if(S?.started)ensurePriestMenuButton();
})();


/* source: equalizePriestRitualHeightsV4Script */
(()=>{
  'use strict';

  function equalizePriestRitualHeights(){
    const groups=[...document.querySelectorAll('#ritualPanel .ritualMain .rituals')];
    groups.forEach(group=>{
      const cards=[...group.querySelectorAll(':scope > .ritual')];
      if(!cards.length)return;

      cards.forEach(card=>{
        card.style.removeProperty('height');
        card.style.removeProperty('min-height');
      });

      requestAnimationFrame(()=>{
        const max=Math.ceil(Math.max(...cards.map(card=>card.getBoundingClientRect().height)));
        if(!Number.isFinite(max)||max<=0)return;
        cards.forEach(card=>{
          card.style.setProperty('height',max+'px','important');
          card.style.setProperty('min-height',max+'px','important');
        });
      });
    });
  }

  if(typeof renderPlayer==='function'){
    const priorRenderPlayer=renderPlayer;
    renderPlayer=function(){
      const out=priorRenderPlayer();
      equalizePriestRitualHeights();
      return out;
    };
  }

  window.addEventListener('resize',equalizePriestRitualHeights);
  window.addEventListener('orientationchange',()=>setTimeout(equalizePriestRitualHeights,60));
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',equalizePriestRitualHeights,{once:true});
  }else{
    equalizePriestRitualHeights();
  }
})();


/* source: fitPriestTitlesClean */
(()=>{
  'use strict';
  function fitPriestCardTitles(){
    const titles=[...document.querySelectorAll('#handContent .hand .card h4')];
    titles.forEach(title=>{
      title.style.setProperty('white-space','nowrap','important');
      title.style.removeProperty('font-size');
      let size=parseFloat(getComputedStyle(title).fontSize)||9;
      const minSize=5.5;
      let guard=0;
      while(title.scrollWidth>title.clientWidth+0.5&&size>minSize&&guard<30){
        size=Math.max(minSize,size-0.25);
        title.style.setProperty('font-size',size+'px','important');
        guard++;
      }
    });
  }
  function scheduleFit(){requestAnimationFrame(fitPriestCardTitles)}
  if(typeof renderPlayer==='function'){
    const priorRenderPlayer=renderPlayer;
    renderPlayer=function(){const out=priorRenderPlayer();scheduleFit();return out};
  }
  if(typeof rogueliteRenderHud==='function'){
    const priorRogueHud=rogueliteRenderHud;
    rogueliteRenderHud=function(){const out=priorRogueHud();scheduleFit();return out};
  }
  window.addEventListener('resize',scheduleFit);
  window.addEventListener('orientationchange',()=>setTimeout(scheduleFit,60));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleFit,{once:true});
  else scheduleFit();
})();

/* source: iphoneLandscapeViewportFitV13Script */
(()=>{
  'use strict';

  let frame=0;
  let fitting=false;

  function isPhoneLandscape(){
    return matchMedia('(orientation:landscape) and (max-height:520px) and (max-width:1000px)').matches;
  }

  function viewport(){
    const vv=window.visualViewport;
    return {
      w:Math.max(1,vv?vv.width:innerWidth),
      h:Math.max(1,vv?vv.height:innerHeight),
      x:vv?vv.offsetLeft:0,
      y:vv?vv.offsetTop:0
    };
  }

  function overlayOpen(){
    return [...document.querySelectorAll('.modal,#rogueTutorialIntro,#rogueTutorialCoach')]
      .some(el=>{
        if(!el||el.classList.contains('hidden'))return false;
        const s=getComputedStyle(el);
        return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;
      });
  }

  function clearFit(){
    const app=document.querySelector('body > .app')||document.querySelector('.app');
    if(!app)return;
    ['position','left','top','width','height','transform','transform-origin']
      .forEach(p=>app.style.removeProperty(p));
    document.documentElement.classList.remove('iphoneGameFit');
    document.body.classList.remove('iphoneGameFit');
  }

  function fit(){
    if(fitting)return;
    fitting=true;
    try{
      const app=document.querySelector('body > .app')||document.querySelector('.app');
      if(!app)return;

      if(!isPhoneLandscape()||overlayOpen()){
        clearFit();
        return;
      }

      clearFit();

      const v=viewport();

      // First lay out at the exact visible device width.
      app.style.setProperty('width',v.w+'px','important');
      app.style.setProperty('max-width','none','important');

      const naturalH=Math.max(1,Math.ceil(app.scrollHeight));
      let scale=Math.min(1,v.h/naturalH);

      // Only shrink if necessary; never magnify the iPhone layout.
      if(scale>0.985)scale=1;
      scale=Math.max(.72,scale);

      // Expand the virtual layout width by the inverse scale so the transformed
      // result still reaches both left and right edges of the iPhone.
      const layoutW=v.w/scale;
      app.style.setProperty('width',layoutW+'px','important');

      // Re-measure because the wider virtual layout often reduces wrapping/height.
      const adjustedH=Math.max(1,Math.ceil(app.scrollHeight));
      const adjustedScale=Math.min(1,v.h/adjustedH);
      if(adjustedScale<scale)scale=Math.max(.72,adjustedScale);

      const finalW=v.w/scale;
      app.style.setProperty('width',finalW+'px','important');

      document.documentElement.classList.add('iphoneGameFit');
      document.body.classList.add('iphoneGameFit');
      app.style.setProperty('position','fixed','important');
      app.style.setProperty('left',v.x+'px','important');
      app.style.setProperty('top',v.y+'px','important');
      app.style.setProperty('transform','scale('+scale+')','important');
      app.style.setProperty('transform-origin','top left','important');
    }finally{
      fitting=false;
    }
  }

  function schedule(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>requestAnimationFrame(fit));
  }

  if(typeof renderPlayer==='function'){
    const prior=renderPlayer;
    renderPlayer=function(){const out=prior();schedule();return out;};
  }
  if(typeof renderBoard==='function'){
    const prior=renderBoard;
    renderBoard=function(){const out=prior();schedule();return out;};
  }

  addEventListener('resize',schedule);
  addEventListener('orientationchange',()=>setTimeout(schedule,80));
  if(window.visualViewport){
    visualViewport.addEventListener('resize',schedule);
    visualViewport.addEventListener('scroll',schedule);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',schedule,{once:true});
  }else{
    schedule();
  }
  addEventListener('load',schedule,{once:true});
})();


/* source: simpleSandTimerV17Script */
(()=>{
  'use strict';

  let observedMax=0;
  let lastRemaining=null;

  function findTimerBox(){
    let box=document.querySelector('.turnTimerStat,#turnTimerStatBox');
    if(box)return box;

    const value=document.getElementById('turnTimerStatValue')||
                document.getElementById('turnTimerStat')||
                document.getElementById('turnTimer');
    if(value)return value.closest('.stat')||value.parentElement;

    return [...document.querySelectorAll('#topStatusBar .stat,.stats .stat')]
      .find(el=>/turn\s*timer|timer/i.test(el.textContent||''))||null;
  }

  function ensureSand(box){
    if(!box)return;
    box.classList.add('turnTimerStat');
    if(!box.querySelector('.turnTimerSandPile')){
      const pile=document.createElement('div');
      pile.className='turnTimerSandPile';
      const stream=document.createElement('div');
      stream.className='turnTimerSandStream';
      const specks=document.createElement('div');
      specks.className='turnTimerSandSpecks';
      box.prepend(specks);
      box.prepend(stream);
      box.prepend(pile);
    }
  }

  function numericTimerValue(box){
    try{
      if(typeof S!=='undefined'&&S&&Number.isFinite(Number(S.turnTimerRemaining))){
        return Math.max(0,Number(S.turnTimerRemaining));
      }
    }catch(_){}

    const preferred=document.getElementById('turnTimerStatValue');
    const text=(preferred||box.querySelector('b')||box).textContent||'';
    const m=text.match(/\d+(?:\.\d+)?/);
    return m?Math.max(0,Number(m[0])):null;
  }

  function timerMaximum(remaining){
    try{
      if(typeof TURN_TIMER_SECONDS!=='undefined'&&Number(TURN_TIMER_SECONDS)>0){
        return Number(TURN_TIMER_SECONDS);
      }
    }catch(_){}

    if(lastRemaining!==null&&remaining>lastRemaining+1)observedMax=remaining;
    observedMax=Math.max(observedMax,remaining||0,1);
    return observedMax;
  }

  function updateSand(){
    const box=findTimerBox();
    if(!box)return;
    ensureSand(box);

    const remaining=numericTimerValue(box);
    if(remaining===null)return;

    const max=Math.max(1,timerMaximum(remaining));
    const elapsed=Math.max(0,Math.min(1,1-(remaining/max)));
    box.style.setProperty('--sand-fill',(elapsed*100).toFixed(2)+'%');

    const paused=!!(
      document.hidden||
      window.__sanctumManualPaused||
      (typeof S!=='undefined'&&S&&S.manualPaused)
    );
    box.classList.toggle('sandPaused',paused);
    box.classList.toggle('sandFinished',remaining<=0);

    lastRemaining=remaining;
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',updateSand,{once:true});
  }else{
    updateSand();
  }

  /* Timer updates once per second; this stays intentionally lightweight. */
  setInterval(updateSand,250);
})();


/* source: sanctumPwaRegistration */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
