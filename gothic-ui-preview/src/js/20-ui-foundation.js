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
