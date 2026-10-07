/* Clean rebuild module: UI foundation, save/load, base tutorial. Original execution order preserved. */

/* source: script-1 */
(function(){
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone=window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  const hint=document.getElementById('installHint');
  if(isIOS && !standalone && hint) hint.classList.remove('hidden');
  document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.jump;
    if(id==='top') window.scrollTo({top:0,behavior:'smooth'});
    else document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
})();

(function installReliableWheelScroll(){
 if(window.__sanctumReliableWheelScrollInstalled)return;
 window.__sanctumReliableWheelScrollInstalled=true;

 function wheelDeltaPixels(e){
  let dy=e.deltaY;
  if(e.deltaMode===1)dy*=18;
  else if(e.deltaMode===2)dy*=Math.max(400,window.innerHeight||800);
  return dy*1.8;
 }

 document.addEventListener('wheel',function(e){
  if(e.defaultPrevented||e.ctrlKey||e.metaKey)return;

  // Preserve intentional horizontal scrolling/trackpad gestures.
  if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;

  const dy=wheelDeltaPixels(e);
  if(!dy)return;

  const visibleModal=[...document.querySelectorAll('.modal:not(.hidden)')]
    .find(el=>getComputedStyle(el).display!=='none');

  if(visibleModal){
   const box=e.target.closest('.modalbox');
   if(box&&visibleModal.contains(box)){
    const max=Math.max(0,box.scrollHeight-box.clientHeight);
    if(max>0){
     box.scrollTop=Math.max(0,Math.min(max,box.scrollTop+dy));
     e.preventDefault();
    }
   }else{
    // Never scroll the game page behind an active popup.
    e.preventDefault();
   }
   return;
  }

  const scroller=document.scrollingElement||document.documentElement;
  const max=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
  if(max<=0)return;

  const next=Math.max(0,Math.min(max,scroller.scrollTop+dy));
  if(next!==scroller.scrollTop){
   scroller.scrollTop=next;
   e.preventDefault();
  }
 },{passive:false,capture:true});
})();


/* source: saveLoadPauseScript */
(function(){
 'use strict';
 window.__sanctumManualPaused=false;

 function blockingModalOpen(){
   const allowed=new Set(['pauseOverlay','setupModal']);
   return [...document.querySelectorAll('.modal')].some(el=>
     !allowed.has(el.id) && !el.classList.contains('hidden')
   );
 }

 function setMenuPausedState(paused){
   window.__sanctumManualPaused=!!paused;
   if(S)S.manualPaused=!!paused;
   const btn=document.getElementById('pauseBtn');
   if(btn)btn.textContent='Menu';
 }

 function openGameMenu(){
   const overlay=document.getElementById('pauseOverlay');
   if(!overlay || !overlay.classList.contains('hidden'))return false;
   if(blockingModalOpen())return false;

   if(S&&S.started){
     setMenuPausedState(true);
     try{pauseTurnTimer(false)}catch(e){try{clearTurnTimerInterval()}catch(_){}}
     try{showGameStatus('Game paused.','good')}catch(e){}
   }
   overlay.classList.remove('hidden');
   setTimeout(()=>{
     const first=document.getElementById('pauseNewGameBtn');
     if(first)first.focus();
   },0);
   return true;
 }
 window.openGameMenu=openGameMenu;

 window.hidePauseOverlay=function(resume=true){
  const overlay=document.getElementById('pauseOverlay');
  if(overlay)overlay.classList.add('hidden');

  const wasStarted=!!(S&&S.started);
  setMenuPausedState(false);

  if(resume&&wasStarted){
   if(window.__sanctumTutorialMode){
     try{clearTurnTimerInterval();updateTurnTimerDisplay()}catch(e){}
   }else{
     try{resumeTurnTimerIfReady()}catch(e){}
   }
  }
 };

 // Move the live Game Log and lower-page game information into this one menu.
 const pauseLogSection=document.getElementById('pauseLogSection');
 const logPanel=document.getElementById('logPanel');
 const liveLog=document.getElementById('log');
 if(pauseLogSection&&logPanel&&liveLog){
   const logHeading=logPanel.querySelector('h3');
   if(logHeading)pauseLogSection.appendChild(logHeading);
   pauseLogSection.appendChild(liveLog);
 }
 const pauseManualSection=document.getElementById('pauseManualSection');
 if(pauseManualSection&&logPanel){
   while(logPanel.firstChild)pauseManualSection.appendChild(logPanel.firstChild);
   logPanel.classList.add('hidden');
 }
 const pauseInfoSection=document.getElementById('pauseInfoSection');
 const infoSection=document.getElementById('infoSection');
 if(pauseInfoSection&&infoSection){
   while(infoSection.firstChild)pauseInfoSection.appendChild(infoSection.firstChild);
   infoSection.classList.add('hidden');
 }

 const pauseBtn=document.getElementById('pauseBtn');
 if(pauseBtn){
   pauseBtn.textContent='Menu';
   pauseBtn.addEventListener('click',openGameMenu);
 }

 const mobilePauseMenuBtn=document.getElementById('mobilePauseMenuBtn');
 if(mobilePauseMenuBtn){
   const span=mobilePauseMenuBtn.querySelector('span');
   if(span)span.textContent='Menu';
   mobilePauseMenuBtn.addEventListener('click',openGameMenu);
 }

 const newGameMenuBtn=document.getElementById('pauseNewGameBtn');
 if(newGameMenuBtn)newGameMenuBtn.addEventListener('click',()=>{
   // Hand control to the existing New Game flow without briefly restarting the timer.
   window.hidePauseOverlay(false);
   const target=document.getElementById('newGameBtn');
   if(target&&!target.disabled)setTimeout(()=>target.click(),0);
 });

 const pauseSaveBtn=document.getElementById('pauseSaveBtn');
 if(pauseSaveBtn)pauseSaveBtn.addEventListener('click',()=>save());

 const pauseLoadBtn=document.getElementById('pauseLoadBtn');
 if(pauseLoadBtn)pauseLoadBtn.addEventListener('click',()=>load());

 const resumeBtn=document.getElementById('resumeGameBtn');
 if(resumeBtn)resumeBtn.addEventListener('click',()=>window.hidePauseOverlay(true));

 const loadBrowserBtn=document.getElementById('loadBrowserBtn');
 if(loadBrowserBtn)loadBrowserBtn.addEventListener('click',()=>loadBrowserSave());

 const importBtn=document.getElementById('importSaveBtn');
 if(importBtn)importBtn.addEventListener('click',()=>importSaveFile());

 const cancelBtn=document.getElementById('loadCancelBtn');
 if(cancelBtn)cancelBtn.addEventListener('click',()=>closeLoadChooser());

 const fileInput=document.getElementById('saveFileInput');
 if(fileInput)fileInput.addEventListener('change',async()=>{
  const file=fileInput.files&&fileInput.files[0];
  if(!file)return;
  try{
    const raw=await file.text();
    applyLoadedSave(raw,'imported save file',null);
  }catch(err){
    console.error(err);
    alert('That save file could not be read.');
  }finally{
    fileInput.value='';
  }
 });

 function isEditable(el){
   if(!el)return false;
   const tag=(el.tagName||'').toLowerCase();
   return tag==='input'||tag==='textarea'||tag==='select'||el.isContentEditable;
 }

 document.addEventListener('keydown',e=>{
   if(e.ctrlKey||e.metaKey||e.altKey||isEditable(e.target))return;
   const overlay=document.getElementById('pauseOverlay');
   if(!overlay)return;
   const open=!overlay.classList.contains('hidden');

   // Tab is the one game-menu key. Once open, native Tab navigation remains available.
   if(e.key==='Tab'&&!open){
     if(blockingModalOpen())return;
     e.preventDefault();
     openGameMenu();
     return;
   }

   if(!open)return;
   const key=(e.key||'').toLowerCase();
   if(key==='escape'){
     e.preventDefault();
     window.hidePauseOverlay(true);
     return;
   }

   const shortcuts={
     n:document.getElementById('pauseNewGameBtn'),
     s:document.getElementById('pauseSaveBtn'),
     l:document.getElementById('pauseLoadBtn'),
     r:document.getElementById('resumeGameBtn')
   };
   if(shortcuts[key]){
     e.preventDefault();
     shortcuts[key].click();
   }
 });

 const menuToggle=document.getElementById('menuToggleBtn');
 if(menuToggle)menuToggle.title='Tab opens the game menu and pauses automatically';
})();


/* source: sanctumTutorialScript */
(function(){
  'use strict';
  document.body.classList.add('tutorial-build');

  const welcome=document.getElementById('tutorialWelcome');
  const coach=document.getElementById('tutorialCoach');
  const resumeChip=document.getElementById('tutorialResumeChip');
  const titleEl=document.getElementById('tutorialStepTitle');
  const bodyEl=document.getElementById('tutorialStepBody');
  const tipEl=document.getElementById('tutorialTip');
  const progressEl=document.getElementById('tutorialProgress');
  const prevBtn=document.getElementById('tutorialPrevBtn');
  const nextBtn=document.getElementById('tutorialNextBtn');
  const practiceBtn=document.getElementById('tutorialPracticeBtn');
  let stepIndex=0;
  let tutorialActive=false;
  let highlighted=null;

  // Keep the real game timer paused while the lesson is open or in practice mode.
  const originalBeginTurn=window.beginTurn;
  if(typeof originalBeginTurn==='function'){
    window.beginTurn=function(){
      const result=originalBeginTurn.apply(this,arguments);
      if(window.__sanctumTutorialMode){
        try{clearTurnTimerInterval();S.turnTimerRemaining=TURN_TIMER_SECONDS;updateTurnTimerDisplay()}catch(e){}
      }
      return result;
    };
    try{beginTurn=window.beginTurn}catch(e){}
  }

  function pauseTimer(){
    try{clearTurnTimerInterval();S.turnTimerRemaining=TURN_TIMER_SECONDS;updateTurnTimerDisplay()}catch(e){}
  }
  function resumeTimer(){
    try{clearTurnTimerInterval();S.turnTimerRemaining=TURN_TIMER_SECONDS;updateTurnTimerDisplay();startTurnTimer(TURN_TIMER_SECONDS)}catch(e){}
  }
  function clearHighlight(){
    if(highlighted)highlighted.classList.remove('tutorial-highlight');
    document.querySelectorAll('.tutorial-highlight').forEach(el=>el.classList.remove('tutorial-highlight'));
    highlighted=null;
  }
  function resolveTarget(step){
    if(typeof step.target==='function')return step.target();
    if(step.target)return document.querySelector(step.target);
    return null;
  }
  function focusTarget(step){
    clearHighlight();
    const el=resolveTarget(step);
    if(!el)return;
    highlighted=el;
    el.classList.add('tutorial-highlight');
    setTimeout(()=>{
      try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch(e){}
    },60);
  }

  const steps=[
    {
      title:'Your Mission',
      target:'.stats',
      body:'Protect the <b>Altar</b> while you defeat <b>13 base Demons</b>. After the 13th defeat, the Boss awakens. Defeat at least one Boss and choose <b>Save the Sanctum</b> to win. If Altar Protection reaches <b>0</b>, the run ends immediately.',
      tip:'The game is a race between your damage output and the pressure building on the Altar.'
    },
    {
      title:'The Demon Path',
      target:'#boardSection',
      body:'Demons travel from <b>Gateway → Hall → Chapel → Crypt → Altar</b>. Each normal room holds up to 4 Demons. When a Demon reaches the Altar, its current <b>Attack</b> becomes Altar Protection loss.',
      tip:'Demons closest to the Altar are usually the most urgent targets.'
    },
    {
      title:'Read the Status Bar',
      target:'.stats',
      body:'Every round begins with <b>10 Shared Mana</b>. The bar shows your current <b>Act and Floor</b>, turn timer, Altar Protection, and progress through the current encounter.',
      tip:'Shared Mana belongs to the entire team. Spending heavily early can leave later Priests with nothing.'
    },
    {
      title:'Your Priest Hand',
      target:'#handPanel',
      practice:true,
      body:'Priest cards use Shared Mana. Players normally draw <b>2 Priest cards at the start of their turn</b>. Each card shows its normal effect and its Empowered effect. You may also <b>discard 1 card per turn</b> to immediately draw a replacement.',
      tip:'Your deck contains 128 physical cards. Each individual card is used once per deck cycle before reshuffling.'
    },
    {
      title:'Playing a Priest Card',
      target:()=>document.querySelector('#handContent .card')||document.getElementById('handPanel'),
      practice:true,
      body:'Press <b>Play</b> on a card, then make any required target or amount selections. The Mana cost is paid only when the play successfully resolves. If you press <b>Cancel</b> during targeting, the entire attempt rolls back.',
      tip:'Basic Attack and Priest-card damage do not transfer leftover damage after a Demon is defeated.'
    },
    {
      title:'Basic Attack',
      target:()=>document.getElementById('basicBtn')||document.getElementById('ritualPanel'),
      practice:true,
      body:'Each Priest may use <b>Basic Attack once per turn</b>. It starts at 2 damage and can be permanently improved by Relics. Basic Attack costs no Mana and can target the Boss after it appears.',
      tip:'Because it is free, Basic Attack is usually worth using before ending your turn.'
    },
    {
      title:'Demon Blood & Rituals',
      target:'#ritualPanel',
      practice:true,
      body:'Defeated Demons award <b>Demon Blood</b>, up to 10 per Priest. Rituals spend Blood rather than Mana, and each Priest may resolve only <b>1 Ritual per turn</b>. Roll a d20: 1–9 gives the Lesser effect, 10–19 the Greater effect, and a natural 20 gives the Greater effect for <b>free</b>.',
      tip:'All Ritual numbers in this build are boosted by 20% and rounded up. Direct-damage Rituals can target the Boss.'
    },
    {
      title:'Ritual Overkill',
      target:'#ritualPanel',
      body:'Only <b>damaging Rituals</b> carry over excess damage. If a Ritual kills a normal Demon with damage remaining, you may send the leftover damage to another Demon after that defeat’s Crucifix/Relic popups resolve. The chain can continue if another Demon is also defeated.',
      tip:'This makes a high-damage Ritual especially valuable against several weakened Demons.'
    },
    {
      title:'Empowering Priest Cards',
      target:'#handPanel',
      body:'When you hold <b>two matching unempowered cards</b>, press Empower to merge them for free into one stronger card. You pay the Empowered play cost only when you actually use it. Empower Blood surcharge is 0 Blood for 1-Mana cards, 1 Blood for 2–3 Mana cards, and 2 Blood for 4–5 Mana cards; Blood-generation cards have no Blood surcharge.',
      tip:'Empowering uses two real copies from your evolving run deck—merging never creates an extra permanent card.'
    },
    {
      title:'Corruption & Desecration',
      target:'#boardSection',
      body:'Whenever a Demon leaves a room while moving toward the Altar, that room gains <b>1 Corruption</b>. Desecration thresholds are Gateway 3, Hall 4, Chapel 5, and Crypt 6. Desecrated rooms gain dangerous penalties. Defeating a Demon in a room removes 1 Corruption there.',
      tip:'If Corruption returns to 0, that room’s Desecration and visual cracks are cleared.'
    },
    {
      title:'Consecrating a Room',
      target:()=>document.querySelector('[data-cons="0"]')||document.getElementById('boardSection'),
      practice:true,
      body:'Once per player turn you may Consecrate a room for <b>3 Shared Mana + 1 Demon Blood</b>. Consecration removes all Corruption from that room and lasts until the round ends. Gateway damages new spawns, Hall stops entrants, Chapel boosts Altar healing, and Crypt prevents Demon merges.',
      tip:'Consecration is expensive, so use it when cleansing a dangerous room also gives you a useful round-long bonus.'
    },
    {
      title:'Defeats, Crucifix Cards & Relics',
      target:'#defeatStat',
      body:'Every normal Demon defeat increases the Base Defeats counter and immediately triggers <b>1 Crucifix event</b>. The complete 36-card Crucifix deck is shuffled and does not repeat a card until the whole cycle is used. Relics are earned after the 5th Demon defeat, every 25 cumulative Boss damage, and on a 33% roll after defeating a Greater Demon.',
      tip:'Relics permanently improve Basic Attack, hand size, Ritual Power, or a combination of those bonuses.'
    },
    {
      title:'Ending the Turn & Demon Phase',
      target:()=>document.getElementById('endBtn')||document.getElementById('ritualPanel'),
      practice:true,
      body:'When you are finished, press <b>End Turn</b>. After all Priests have acted, Demons advance, room-entry abilities resolve, and new Demons spawn. Shared Mana returns to 10 when the next round begins.',
      tip:'Before ending, check whether you still have a free Basic Attack, a useful Ritual, or a card you should discard.'
    },
    {
      title:'The Boss Stage',
      target:'#bossArea',
      body:'The Boss appears after the 13th base Demon defeat. Boss HP and Altar drain scale with player count. During the Boss Stage, <b>normal Demon spawning happens every other round</b>, beginning with a skipped normal spawn on the first Demon Phase after the Boss awakens. Boss-specific summoned Demons are unaffected.',
      tip:'All direct-damage Rituals can target the Boss, so Demon Blood becomes an important finishing resource.'
    },
    {
      title:'Save the Sanctum—or Descend',
      target:'#infoSection',
      body:'When you defeat a Boss, choose <b>Save the Sanctum</b> to claim victory or <b>Descend Further</b> to continue the same run against another Boss. Descending carries forward your Altar, hands, Blood, Relics, Corruption, Demon positions, and cumulative Boss-damage progress.',
      tip:'You now know the complete core loop. The Rules button remains available for exact edge cases and card interactions.'
    }
  ];

  function renderStep(){
    if(!tutorialActive)return;
    const step=steps[stepIndex];
    progressEl.textContent=`Tutorial ${stepIndex+1} of ${steps.length}`;
    titleEl.textContent=step.title;
    bodyEl.innerHTML=step.body;
    tipEl.innerHTML=`<b>Tip:</b> ${step.tip}`;
    prevBtn.disabled=stepIndex===0;
    nextBtn.textContent=stepIndex===steps.length-1?'Finish Tutorial':'Next';
    practiceBtn.classList.toggle('hidden',!step.practice);
    focusTarget(step);
    pauseTimer();
  }

  function showCoach(){
    resumeChip.classList.add('hidden');
    coach.classList.remove('hidden');
    renderStep();
  }
  function hideForPractice(){
    clearHighlight();
    coach.classList.add('hidden');
    resumeChip.classList.remove('hidden');
    pauseTimer();
    try{showGameStatusToast('Tutorial practice mode — the turn timer is paused. Use the highlighted controls, then tap Resume Tutorial.')}catch(e){}
  }
  function finishTutorial(){
    tutorialActive=false;
    window.__sanctumTutorialMode=false;
    clearHighlight();
    coach.classList.add('hidden');
    resumeChip.classList.add('hidden');
    resumeTimer();
    try{showGameStatusToast('Tutorial complete. The turn timer is live — save the Sanctum.')}catch(e){}
  }
  function exitTutorial(){
    tutorialActive=false;
    window.__sanctumTutorialMode=false;
    clearHighlight();
    coach.classList.add('hidden');
    resumeChip.classList.add('hidden');
    if(S&&S.started)resumeTimer();
  }
  function startWalkthrough(resetToFirst=true){
    tutorialActive=true;
    window.__sanctumTutorialMode=true;
    if(resetToFirst)stepIndex=0;
    pauseTimer();
    showCoach();
  }
  function startGuidedGame(){
    welcome.classList.add('hidden');
    try{
      document.getElementById('playerCount').value='1';
      setupPlayersUI();
      const name=document.getElementById('pname0');
      const char=document.getElementById('pchar0');
      if(name)name.value='Tutorial Priest';
      if(char)char.value='Exorcist';
      window.__sanctumTutorialMode=true;
      startGame();
      if(S.players&&S.players[0])S.players[0].blood=4;
      log('Tutorial mode: 4 Demon Blood granted for Ritual practice.','info');
      render();
      pauseTimer();
      setTimeout(()=>startWalkthrough(true),150);
    }catch(err){
      console.error('Tutorial start failed',err);
      window.__sanctumTutorialMode=false;
      welcome.classList.add('hidden');
      document.getElementById('setupModal')?.classList.remove('hidden');
    }
  }

  document.getElementById('tutorialStartBtn').addEventListener('click',startGuidedGame);
  document.getElementById('tutorialNormalBtn').addEventListener('click',()=>welcome.classList.add('hidden'));
  document.getElementById('tutorialExitBtn').addEventListener('click',exitTutorial);
  prevBtn.addEventListener('click',()=>{if(stepIndex>0){stepIndex--;renderStep()}});
  nextBtn.addEventListener('click',()=>{if(stepIndex>=steps.length-1)finishTutorial();else{stepIndex++;renderStep()}});
  practiceBtn.addEventListener('click',hideForPractice);
  resumeChip.addEventListener('click',showCoach);

  // Add a permanent Tutorial button to the normal menu so the lesson can be reopened.
  const toolbar=document.getElementById('topToolbar');
  if(toolbar&&!document.getElementById('tutorialBuildBadge')){
    const btn=document.createElement('button');
    btn.className='btn';btn.id='tutorialBuildBadge';btn.type='button';btn.textContent='Tutorial';
    btn.addEventListener('click',()=>{
      if(!S.started){welcome.classList.remove('hidden');return}
      startWalkthrough(true);
    });
    toolbar.appendChild(btn);
  }
})();
