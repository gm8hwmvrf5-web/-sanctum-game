/* Clean rebuild module: Priest hand, HUD, menu, interactive tutorial. Original execution order preserved. */

/* source: compactPriestHandCarouselScript */
(()=>{
  'use strict';
  const carouselState=new Map();
  function stateForPlayer(){
    const key=Number.isFinite(S?.current)?S.current:0;
    if(!carouselState.has(key))carouselState.set(key,{index:0,cardId:null});
    return carouselState.get(key);
  }
  function clampIndex(i,n){return n?Math.max(0,Math.min(n-1,i||0)):0}
  function selectIndex(index,rerender=true){
    if(!S?.started||!S.players?.length)return;
    const hand=S.players[S.current]?.hand||[],st=stateForPlayer();
    if(!hand.length){st.index=0;st.cardId=null;return}
    st.index=((index%hand.length)+hand.length)%hand.length;
    st.cardId=hand[st.index]?.id||null;
    if(rerender)renderPlayer();
  }
  function selectedIndex(hand){
    const st=stateForPlayer();
    // Empowering can request a one-time hand focus. Putting that card at the
    // carousel center guarantees it is one of the two full front cards.
    if(S?._focusHandCardId){
      const focusId=S._focusHandCardId;
      const focusIndex=hand.findIndex(c=>c.id===focusId);
      delete S._focusHandCardId;
      if(focusIndex>=0){st.index=focusIndex;st.cardId=focusId;return focusIndex}
    }
    if(st.cardId){
      const found=hand.findIndex(c=>c.id===st.cardId);
      if(found>=0){st.index=found;return found}
    }
    st.index=clampIndex(st.index,hand.length);
    st.cardId=hand[st.index]?.id||null;
    return st.index;
  }
  function enhanceHandCarousel(){
    const handHost=document.getElementById('handContent');
    const handEl=handHost?.querySelector('.hand');
    if(!handEl||!S?.started||!S.players?.length)return;
    const hand=S.players[S.current]?.hand||[];
    const cards=[...handEl.children].filter(el=>el.classList?.contains('card'));
    if(!cards.length)return;
    const idx=selectedIndex(hand),n=cards.length;
    handEl.classList.add('carouselTrack');
    cards.forEach((card,i)=>{
      card.classList.add('carouselCard');
      card.classList.remove('is-left','is-center','is-right');
      card.hidden=true;
      card.removeAttribute('data-carousel-side');
      card.setAttribute('aria-hidden','true');
      card.onclick=null;
      if(i===idx){
        card.hidden=false;card.classList.add('is-center');card.setAttribute('aria-hidden','false');
      }
    });
    if(n>1){
      const left=(idx-1+n)%n,right=(idx+1)%n;
      if(left!==idx){
        const c=cards[left];c.hidden=false;c.classList.add('is-left');c.setAttribute('aria-hidden','false');c.dataset.carouselSide=String(left);c.onclick=e=>{if(e.target.closest('button'))return;selectIndex(left)};
      }
      if(right!==idx&&right!==left){
        const c=cards[right];c.hidden=false;c.classList.add('is-right');c.setAttribute('aria-hidden','false');c.dataset.carouselSide=String(right);c.onclick=e=>{if(e.target.closest('button'))return;selectIndex(right)};
      }else if(n===2){
        const c=cards[left];c.classList.remove('is-left');c.classList.add('is-right');
      }
    }
    const wrap=document.createElement('div');wrap.className='handCarousel';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Priest hand carousel');
    handEl.parentNode.insertBefore(wrap,handEl);wrap.appendChild(handEl);
    const prev=document.createElement('button');prev.type='button';prev.className='btn carouselNav carouselPrev';prev.setAttribute('aria-label','Previous Priest card');prev.textContent='‹';prev.disabled=n<2;
    const next=document.createElement('button');next.type='button';next.className='btn carouselNav carouselNext';next.setAttribute('aria-label','Next Priest card');next.textContent='›';next.disabled=n<2;
    wrap.insertBefore(prev,handEl);wrap.appendChild(next);
    const meta=document.createElement('div');meta.className='carouselMeta';meta.innerHTML=`<span class="carouselCount"><b>${idx+1}</b> / ${n}</span><span class="carouselHint">Tap a side card or use ← →</span>`;wrap.appendChild(meta);
    prev.onclick=()=>selectIndex(idx-1);next.onclick=()=>selectIndex(idx+1);
    wrap.onkeydown=e=>{
      if(e.target.closest('button,input,select,textarea'))return;
      if(e.key==='ArrowLeft'){e.preventDefault();selectIndex(idx-1)}
      else if(e.key==='ArrowRight'){e.preventDefault();selectIndex(idx+1)}
    };
    let startX=null;
    wrap.onpointerdown=e=>{if(e.target.closest('button'))return;startX=e.clientX};
    wrap.onpointerup=e=>{if(startX===null)return;const dx=e.clientX-startX;startX=null;if(Math.abs(dx)<38)return;selectIndex(idx+(dx<0?1:-1))};
  }
  const baseRenderPlayer=renderPlayer;
  renderPlayer=function(){const out=baseRenderPlayer();enhanceHandCarousel();return out};
  // Apply immediately when loading a saved/in-progress run.
  if(S?.started)renderPlayer();
})();


/* source: leftHandRightCharacterScript */
(()=>{
  'use strict';
  const handPanel=document.getElementById('handPanel');
  const handContent=document.getElementById('handContent');
  const ritualPanel=document.getElementById('ritualPanel');
  if(!handPanel||!handContent||!ritualPanel||document.getElementById('handCharacterStage'))return;
  const stage=document.createElement('div');stage.id='handCharacterStage';stage.className='handCharacterStage';
  const cards=document.createElement('div');cards.className='handCharacterCards';
  const priest=document.createElement('div');priest.className='handCharacterPriest';
  handPanel.insertBefore(stage,handPanel.firstChild);
  stage.appendChild(cards);stage.appendChild(priest);
  cards.appendChild(handContent);priest.appendChild(ritualPanel);
})();


/* source: moveRelicXpBelowRitualsScript */
(()=>{
  'use strict';
  const priest=document.querySelector('#handPanel .handCharacterPriest');
  const ritualPanel=document.getElementById('ritualPanel');
  const meter=document.getElementById('relicXpMeterStat');
  if(priest&&ritualPanel&&meter){
    meter.classList.add('priestRelicXpMeter');
    ritualPanel.insertAdjacentElement('afterend',meter);
  }
})();


/* source: twoFrontCardHandPatchScript */
(()=>{
  'use strict';
  function applyTwoFrontCards(){
    const wrap=document.querySelector('#handContent .handCarousel');
    const track=wrap?.querySelector('.hand.carouselTrack');
    if(!wrap||!track)return;
    wrap.classList.add('twoFrontMode');
    const cards=[...track.children].filter(el=>el.classList?.contains('carouselCard'));
    const center=cards.findIndex(c=>c.classList.contains('is-center'));
    const n=cards.length;
    if(center<0||!n)return;
    // The existing carousel already exposes the next card as is-right. Keep both front cards fully interactive.
    const right=cards.findIndex(c=>c.classList.contains('is-right'));
    const meta=wrap.querySelector('.carouselMeta');
    if(meta){
      const count=meta.querySelector('.carouselCount');
      if(count){
        const second=right>=0?right:center;
        count.innerHTML=n>1?`<b>${center+1} &amp; ${second+1}</b> / ${n}`:`<b>${center+1}</b> / ${n}`;
      }
      const hint=meta.querySelector('.carouselHint');
      if(hint)hint.textContent='Use ‹ › to rotate cards';
    }
  }
  const previousRenderPlayer=renderPlayer;
  renderPlayer=function(){const out=previousRenderPlayer();applyTwoFrontCards();return out};
  if(S?.started)applyTwoFrontCards();
  document.title='Sanctum of the Damned — Two-Card Hand Edition';
})();


/* source: fourVisibleTwoFrontPatchScript */
(()=>{
  'use strict';
  function applyFourVisibleHand(){
    const wrap=document.querySelector('#handContent .handCarousel');
    const track=wrap?.querySelector('.hand.carouselTrack');
    if(!wrap||!track)return;
    wrap.classList.add('fourVisibleMode');
    const cards=[...track.children].filter(el=>el.classList?.contains('carouselCard'));
    const n=cards.length;
    if(!n)return;
    cards.forEach(c=>c.classList.remove('is-back-left','is-back-right'));
    const center=cards.findIndex(c=>c.classList.contains('is-center'));
    if(center<0)return;
    const frontRight=(center+1)%n;
    const backLeft=(center-1+n)%n;
    const backRight=(center+2)%n;

    // Ensure the two front cards are the current card and the following card.
    if(n>1){
      cards[frontRight].hidden=false;
      cards[frontRight].setAttribute('aria-hidden','false');
      cards[frontRight].classList.remove('is-left');
      cards[frontRight].classList.add('is-right');
    }

    // Add one preview card behind each side when distinct cards are available.
    if(n>2 && backLeft!==center && backLeft!==frontRight){
      const c=cards[backLeft];
      c.hidden=false;c.setAttribute('aria-hidden','false');
      c.classList.remove('is-left','is-right');c.classList.add('is-back-left');
      c.onclick=e=>{if(e.target.closest('button'))return;const prev=wrap.querySelector('.carouselPrev');prev?.click();};
    }
    if(n>3 && backRight!==center && backRight!==frontRight && backRight!==backLeft){
      const c=cards[backRight];
      c.hidden=false;c.setAttribute('aria-hidden','false');
      c.classList.remove('is-left','is-right');c.classList.add('is-back-right');
      c.onclick=e=>{if(e.target.closest('button'))return;const next=wrap.querySelector('.carouselNext');next?.click();};
    }

    const meta=wrap.querySelector('.carouselMeta');
    if(meta){
      const count=meta.querySelector('.carouselCount');
      if(count)count.innerHTML=n>1?`<b>${center+1} &amp; ${frontRight+1}</b> / ${n}`:`<b>${center+1}</b> / ${n}`;
      const hint=meta.querySelector('.carouselHint');
      if(hint)hint.textContent=n>2?'Use ‹ › or tap a rear card to rotate':'Use ‹ › to rotate cards';
    }
  }
  const priorRenderPlayer=renderPlayer;
  renderPlayer=function(){const out=priorRenderPlayer();applyFourVisibleHand();return out};
  if(S?.started)applyFourVisibleHand();
  document.title='Sanctum of the Damned — Four-Card Fan Hand';
})();


/* source: priestActionLeftFontPatchScript */
(()=>{
  'use strict';
  function ensureActionRail(){
    const stage=document.querySelector('#handPanel .handCharacterStage');
    const priest=document.querySelector('#handPanel .handCharacterPriest');
    if(!stage||!priest)return null;
    let rail=stage.querySelector('.priestActionRail');
    if(!rail){
      rail=document.createElement('div');
      rail.className='priestActionRail';
      rail.setAttribute('aria-label','Turn actions');
      stage.insertBefore(rail,priest);
    }
    return rail;
  }
  function moveTurnActionsLeft(){
    const rail=ensureActionRail();
    const priest=document.querySelector('#handPanel .handCharacterPriest');
    if(!rail||!priest)return;
    const basic=priest.querySelector('#basicBtn');
    const end=priest.querySelector('#endBtn');
    if(basic&&basic.parentElement!==rail)rail.appendChild(basic);
    if(end&&end.parentElement!==rail)rail.appendChild(end);
  }
  const priorRenderPlayer=renderPlayer;
  renderPlayer=function(){
    const out=priorRenderPlayer();
    moveTurnActionsLeft();
    return out;
  };
  if(S?.started)moveTurnActionsLeft();
  document.title='Sanctum of the Damned — Left Action Rail Edition';
})();


/* source: priestTopActionButtonsFixScript */
(()=>{
  'use strict';
  function placePriestActions(){
    const priest=document.querySelector('#handPanel .handCharacterPriest');
    const ritualMain=priest?.querySelector('#ritualContent');
    const rituals=ritualMain?.querySelector('.rituals');
    const tracker=ritualMain?.querySelector('.ritualTracker');
    if(!priest||!ritualMain||!rituals)return;

    let top=ritualMain.querySelector('.priestActionTop');
    if(!top){
      top=document.createElement('div');
      top.className='priestActionTop';
      top.setAttribute('aria-label','Turn actions');
    }

    const basic=document.getElementById('basicBtn');
    const end=document.getElementById('endBtn');
    if(basic)top.appendChild(basic);
    if(end)top.appendChild(end);

    // Position the two action buttons immediately above the Ritual cards.
    ritualMain.insertBefore(top,rituals);

    // The old action rail is intentionally empty/hidden now.
    const oldRail=document.querySelector('#handPanel .priestActionRail');
    if(oldRail){
      const cinder=oldRail.querySelector('#actionCinderBadge');
      if(cinder&&tracker)tracker.insertBefore(cinder,tracker.querySelector('.playerTurnTag')||null);
    }

    // Keep the Cinder counter with the other Priest counters, never in the action row.
    const cinder=document.getElementById('actionCinderBadge');
    if(cinder&&tracker&&cinder.parentElement!==tracker){
      tracker.insertBefore(cinder,tracker.querySelector('.playerTurnTag')||null);
    }
  }

  const priorRenderPlayer=renderPlayer;
  renderPlayer=function(){
    const out=priorRenderPlayer();
    placePriestActions();
    return out;
  };

  // rogueliteRenderHud can create/move the Cinder badge after renderPlayer, so normalize after it too.
  if(typeof rogueliteRenderHud==='function'){
    const priorRogueHud=rogueliteRenderHud;
    rogueliteRenderHud=function(){
      const out=priorRogueHud();
      placePriestActions();
      return out;
    };
  }

  if(S?.started)placePriestActions();
  document.title='Sanctum of the Damned — Priest Top Actions';
})();


/* source: priestHeaderXpRelicsReflowScript */
(()=>{
  'use strict';
  function normalizePriestHeaderAndRelics(){
    const priest=document.querySelector('#handPanel .handCharacterPriest');
    const ritualPanel=document.getElementById('ritualPanel');
    const ritualMain=ritualPanel?.querySelector('#ritualContent');
    const tracker=ritualMain?.querySelector('.ritualTracker');
    if(!priest||!ritualPanel||!ritualMain||!tracker)return;

    // Build a dedicated Priest-side strip directly above the Priest UI.
    let stack=priest.querySelector('.priestRelicTopStack');
    if(!stack){
      stack=document.createElement('div');
      stack.className='priestRelicTopStack';
      stack.setAttribute('aria-label','Relic progression and active Relics');
      priest.insertBefore(stack,ritualPanel);
    }

    const xp=document.getElementById('relicXpMeterStat');
    if(xp&&xp.parentElement!==stack)stack.appendChild(xp);

    // renderPlayer rebuilds the card-side Relic summary each render. Move the fresh
    // copy into this Priest-side stack, replacing the previous summary cleanly.
    const freshSummary=document.querySelector('#handContent > .relicSummary');
    const oldSummary=stack.querySelector('.relicSummary');
    if(freshSummary){
      if(oldSummary&&oldSummary!==freshSummary)oldSummary.remove();
      stack.appendChild(freshSummary);
    }

    // Older layout patches may temporarily place the turn buttons in the hidden
    // action container. Do NOT clear that container before moving the live buttons,
    // or the controls are deleted from the DOM.
    const oldTop=ritualMain.querySelector('.priestActionTop');

    const basic=document.getElementById('basicBtn');
    const end=document.getElementById('endBtn');
    const player=tracker.querySelector('.playerTurnTag');
    const cinder=document.getElementById('actionCinderBadge');

    // Place Basic Attack and End Turn immediately after the Demon Blood badge.
    // This keeps the two turn controls at the left side of the Priest stats bar.
    const demonBloodBadge=tracker.querySelector('.badge');
    if(basic){
      if(demonBloodBadge)demonBloodBadge.insertAdjacentElement('afterend',basic);
      else tracker.prepend(basic);
    }
    if(end){
      if(basic&&basic.parentElement===tracker)basic.insertAdjacentElement('afterend',end);
      else if(demonBloodBadge)demonBloodBadge.insertAdjacentElement('afterend',end);
      else tracker.prepend(end);
    }

    // The old action container stays empty/hidden after its live controls are moved.
    if(oldTop){[...oldTop.children].forEach(el=>{if(el!==basic&&el!==end)el.remove()});}

    // Keep the player label after the stat/action cluster; Cinders remains physically last.
    if(player&&player.parentElement===tracker)tracker.appendChild(player);
    if(cinder){
      if(cinder.parentElement!==tracker)tracker.appendChild(cinder);
      else tracker.appendChild(cinder); // re-appending guarantees it is physically last
    }
  }

  const priorRenderPlayer=renderPlayer;
  renderPlayer=function(){
    const out=priorRenderPlayer();
    normalizePriestHeaderAndRelics();
    return out;
  };

  if(typeof rogueliteRenderHud==='function'){
    const priorRogueHud=rogueliteRenderHud;
    rogueliteRenderHud=function(){
      const out=priorRogueHud();
      normalizePriestHeaderAndRelics();
      return out;
    };
  }

  if(S?.started)normalizePriestHeaderAndRelics();
  document.title='Sanctum of the Damned — Priest Header & Relic Strip';
})();


/* source: legacyCloseHeaderOrderCenteredHandScript */
(()=>{
  'use strict';

  function closeLegacySafely(){
    const modal=document.getElementById('rogueLegacyModal');
    if(!modal)return;
    const r=(S&&S.rogue&&S.rogue.enabled)?rogueState():null;
    if(r&&r.legacyCheckpoint){
      // A checkpoint has no active combat state to return to; closing advances to
      // the next cycle so the player can never become trapped behind the shop.
      rogueliteContinueAfterLegacy();
      return;
    }
    modal.classList.add('hidden');
    resumeTurnTimerIfReady();
  }

  function ensureLegacyDismiss(){
    const box=document.querySelector('#rogueLegacyModal .rogueModalBox');
    if(!box)return;
    let btn=document.getElementById('rogueLegacyDismiss');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.id='rogueLegacyDismiss';
      btn.className='btn';
      btn.textContent='Close ✕';
      btn.setAttribute('aria-label','Close Legacy Store');
      box.insertBefore(btn,box.firstChild);
    }
    btn.onclick=closeLegacySafely;
  }

  function arrangePriestHeader(){
    const tracker=document.querySelector('#handPanel .handCharacterPriest .ritualTracker');
    if(!tracker)return;
    const basic=document.getElementById('basicBtn');
    const end=document.getElementById('endBtn');
    const cinder=document.getElementById('actionCinderBadge');
    // Demon Blood is the first ordinary badge in the original Priest tracker.
    const demonBlood=[...tracker.querySelectorAll(':scope > .badge')].find(el=>!el.id&&/Demon Blood/i.test(el.textContent||''));

    if(basic)tracker.insertBefore(basic,tracker.firstChild);
    if(end){
      if(basic&&basic.parentElement===tracker)basic.insertAdjacentElement('afterend',end);
      else tracker.insertBefore(end,tracker.firstChild);
    }
    if(demonBlood){
      if(end&&end.parentElement===tracker)end.insertAdjacentElement('afterend',demonBlood);
      else if(basic&&basic.parentElement===tracker)basic.insertAdjacentElement('afterend',demonBlood);
    }
    // Cinders is physically last so it stays pinned to the far right by existing CSS.
    if(cinder&&cinder.parentElement===tracker)tracker.appendChild(cinder);
  }

  const priorPlayerRender=renderPlayer;
  renderPlayer=function(){
    const out=priorPlayerRender();
    arrangePriestHeader();
    ensureLegacyDismiss();
    return out;
  };

  if(typeof rogueliteRenderHud==='function'){
    const priorHud=rogueliteRenderHud;
    rogueliteRenderHud=function(){
      const out=priorHud();
      arrangePriestHeader();
      ensureLegacyDismiss();
      return out;
    };
  }

  if(typeof rogueliteOpenLegacy==='function'){
    const priorOpen=rogueliteOpenLegacy;
    rogueliteOpenLegacy=function(forceCheckpoint=false){
      const out=priorOpen(forceCheckpoint);
      ensureLegacyDismiss();
      return out;
    };
  }

  ensureLegacyDismiss();
  if(S?.started)arrangePriestHeader();
  document.title='Sanctum of the Damned — Empowered Card Auto-Front';
})();


/* source: horizontalXpSafetyPatch */
(()=>{
  'use strict';
  function syncHorizontalRelicXp(){
    const meter=document.getElementById('relicXpMeterStat');
    const fill=document.getElementById('relicXpMeterFill');
    if(!meter||!fill)return;
    const now=Math.max(0,Number(meter.getAttribute('aria-valuenow'))||0);
    const need=Math.max(1,Number(meter.getAttribute('aria-valuemax'))||15);
    const pct=Math.max(0,Math.min(100,(now/need)*100));
    fill.style.height='100%';
    fill.style.width=`${pct}%`;
  }
  if(typeof rogueliteRenderHud==='function'){
    const prior=rogueliteRenderHud;
    rogueliteRenderHud=function(){const out=prior();syncHorizontalRelicXp();return out;};
  }
  if(typeof renderPlayer==='function'){
    const priorPlayer=renderPlayer;
    renderPlayer=function(){const out=priorPlayer();syncHorizontalRelicXp();return out;};
  }
  if(S?.started)syncHorizontalRelicXp();
  document.title='Sanctum of the Damned — Horizontal Relic XP & Blood Gauge';
})();


/* source: tabMenuOnlyScript */
(()=>{
  'use strict';
  function addMenuButton(id,label,handler,cls='btn'){
    const host=document.querySelector('#pauseOverlay .pauseActions');
    if(!host||document.getElementById(id))return;
    const b=document.createElement('button');
    b.type='button'; b.id=id; b.className=cls; b.textContent=label;
    b.addEventListener('click',handler);
    const resume=document.getElementById('resumeGameBtn');
    host.insertBefore(b,resume||null);
  }
  function clickExisting(id){const el=document.getElementById(id);if(el)el.click();}
  addMenuButton('pauseRulesBtn','Rules',()=>clickExisting('rulesBtn'));
  addMenuButton('pauseDemonDeckBtn','Demon Deck',()=>clickExisting('demonDeckBtn'));
  addMenuButton('pauseBossDeckBtn','Boss Deck',()=>clickExisting('bossDeckBtn'));
  addMenuButton('pauseRunGuideBtn','Run Guide',()=>{
    if(typeof rogueliteShowGuide==='function')rogueliteShowGuide();
    else clickExisting('tutorialBuildBadge');
  });
  addMenuButton('pauseLegacyBtn','Legacy',()=>{
    if(typeof rogueliteOpenLegacy==='function')rogueliteOpenLegacy(false);
    else clickExisting('rogueLegacyBtn');
  });
  // Keep Resume visually last.
  const host=document.querySelector('#pauseOverlay .pauseActions');
  const resume=document.getElementById('resumeGameBtn');
  if(host&&resume)host.appendChild(resume);
})();


/* source: rogueliteInteractiveTutorialScript */
(function(){
 'use strict';
 const setup=document.getElementById('setupModal');
 const setupActions=setup?.querySelector('.modalbox > div:last-child');
 const start=document.getElementById('startBtn');
 const intro=document.getElementById('rogueTutorialIntro');
 const coach=document.getElementById('rogueTutorialCoach');
 const progress=document.getElementById('rogueTutorialProgress');
 const title=document.getElementById('rogueTutorialTitle');
 const body=document.getElementById('rogueTutorialBody');
 const task=document.getElementById('rogueTutorialTask');
 const prev=document.getElementById('rogueTutorialPrevBtn');
 const next=document.getElementById('rogueTutorialNextBtn');
 const helper=document.getElementById('rogueTutorialHelperBtn');
 let active=false,index=0,poll=null,savedSetup=null,mergeShown=false;
 if(setupActions&&start&&!document.getElementById('setupTutorialBtn')){
   const b=document.createElement('button');
   b.className='btn';b.id='setupTutorialBtn';b.type='button';b.textContent='Play Tutorial';b.style.flex='1';
   start.insertAdjacentElement('afterend',b);
 }
 const setupTutorialBtn=document.getElementById('setupTutorialBtn');

 function captureSetup(){
   const count=Number(document.getElementById('playerCount')?.value||1);
   const players=[];
   for(let i=0;i<count;i++)players.push({name:document.getElementById(`pname${i}`)?.value||'',char:document.getElementById(`pchar${i}`)?.value||''});
   return {count,timer:document.getElementById('turnTimerSelect')?.value||'60',players};
 }
 function restoreSetup(){
   const snap=savedSetup;
   const count=document.getElementById('playerCount');
   if(count&&snap)count.value=String(snap.count||1);
   setupPlayersUI();
   if(snap){
     const timer=document.getElementById('turnTimerSelect');if(timer)timer.value=snap.timer||'60';
     (snap.players||[]).forEach((p,i)=>{let n=document.getElementById(`pname${i}`),c=document.getElementById(`pchar${i}`);if(n)n.value=p.name;if(c&&p.char)c.value=p.char});
   }
 }
 function tutorialCard(name){
   const base=(window.PRIEST||PRIEST||[]).find(c=>c.n===name);
   return base?{...base,id:`tutorial-${name.replace(/\W/g,'').toLowerCase()}-${uid()}`,empowered:false,empowerPaid:false}:null;
 }
 function seedPracticeHand(){
   const p=currentPlayer();if(!p)return;
   const names=['Quick Prayer','Smite','Smite','Divine Shield'];
   const cards=names.map(tutorialCard).filter(Boolean);
   if(cards.length>=3)p.hand=cards;
 }
 function makeLesser(base,tag='practice'){
   const d={...base,id:`tutorial-${tag}-${uid()}`,greater:false,cur:base.hp,status:{}};
   if(S?.rogue?.enabled&&typeof window.__rogueliteMutateDemon==='function')window.__rogueliteMutateDemon(d);
   d.cur=demonMaxHP(d);return d;
 }
 function seedPracticeDemon(){
   if(!S?.started)return;
   S.rooms=[[],[],[],[]];
   const base=DEMON_TYPES[0];
   if(base)S.rooms[0].push(makeLesser(base,'starter'));
 }
 function clearFocus(){document.querySelectorAll('.rogueTutorialFocus').forEach(el=>el.classList.remove('rogueTutorialFocus'))}
 function resolveTarget(step){try{return typeof step.target==='function'?step.target():document.querySelector(step.target)}catch(e){return null}}
 function focusStep(){clearFocus();const el=resolveTarget(steps[index]);if(el){el.classList.add('rogueTutorialFocus');try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}}}
 function pause(){try{pauseTurnTimer(false)}catch(e){try{clearTurnTimerInterval()}catch(_){}}}
 function checkDone(step){try{return !step.check||!!step.check()}catch(e){return false}}
 function updateTask(){
   if(!active)return;
   const step=steps[index],done=checkDone(step);
   task.classList.toggle('done',done);
   task.innerHTML=step.task?`${done?'✓ ':''}${step.task}${done?'':' <small style="display:block;margin-top:4px;opacity:.72">Optional practice — Next is always available.</small>'}`:'Read this step, then continue.';
   next.disabled=false;
   next.textContent=index===steps.length-1?'Return to Setup':'Next';
   next.title=done?'Task complete — continue.':'Practice is optional — you can continue now and return with Previous.';
   helper.classList.toggle('hidden',!step.helper);
   if(step.helper)helper.textContent=step.helperLabel||'Practice Helper';
   pause();
 }
 function showStep(){
   if(!active)return;
   const step=steps[index];
   progress.textContent=`Tutorial ${index+1} / ${steps.length}`;
   title.textContent=step.title;body.innerHTML=step.body;
   prev.disabled=index===0;helper.onclick=step.helper||null;
   focusStep();updateTask();
 }
 function finishTutorial(message='Tutorial complete — choose your real run setup.'){
   active=false;mergeShown=false;window.__sanctumTutorialMode=false;window.__rogueliteTutorialSession=false;document.body.classList.remove('rogue-tutorial-active');
   if(poll){clearInterval(poll);poll=null}clearFocus();coach.classList.add('hidden');intro.classList.add('hidden');
   try{clearTurnTimerInterval()}catch(e){}
   S=freshState();
   restoreSetup();
   const cancel=document.getElementById('setupCancelBtn');if(cancel)cancel.classList.add('hidden');
   pauseTurnTimer(true);setup?.classList.remove('hidden');
   try{showGameStatus(message,'good')}catch(e){}
 }
 function prepareTarget(){
   if(!S?.started)return;
   let x=allDemons().find(x=>!x.d.greater);
   if(!x){const base=DEMON_TYPES[0];if(base){const d=makeLesser(base,'target');S.rooms[0].push(d);x={d,r:0,i:S.rooms[0].length-1}}}
   if(x){x.d.cur=1;log(`Tutorial helper: ${demonName(x.d)} is set to 1 HP so you can practice earning Demon Blood and Relic XP.`,'info');render();focusStep()}
 }
 function demonstrateMerge(){
   if(!S?.started)return;
   const base=DEMON_TYPES[0];if(!base)return;
   S.globalMergeBlock=false;S.blockNextMerge=false;S.roomMergeBlock={};S.consecrated=[false,false,false,false];
   S.rooms=[[],[],[],[]];
   const a=makeLesser(base,'merge-a'),b=makeLesser(base,'merge-b');
   S.rooms[0].push(a);S.rooms[1].push(b);
   log(`Tutorial: two matching ${base.n} cards are placed in Gateway and Hall.`,'info');
   resolveBoardDuplicateMerges();mergeShown=true;render();focusStep();updateTask();
 }

 const steps=[
  {title:'The Run at a Glance',target:'.stats',body:'This is the real play screen. Protect the <b>Altar</b>, spend shared Mana carefully, and clear floors. A roguelite cycle has <b>15 floors across 3 Acts</b>, with Bosses on Floors 5, 10, and 15.',task:null},
  {title:'Play a Priest Card',target:'#handPanel',body:'Your front two cards are immediately playable. Priest cards normally spend <b>Shared Mana</b>. For this practice hand, use <b>Quick Prayer</b> or any other card you can resolve.',task:'Play one Priest card.',check:()=>Number(S?.runStats?.cardsPlayed||0)>=1},
  {title:'Empower Matching Cards',target:'#handPanel',body:'Two matching unempowered cards can merge into one stronger <b>Empowered</b> card. Empowering itself is free; you pay the Empowered play cost only when you actually play it. The Empowered card automatically rotates to the front of the hand.',task:'Empower the two matching Smite cards.',check:()=>!!currentPlayer()?.hand?.some(c=>c.empowered)},
  {title:'Use Your Free Basic Attack',target:()=>document.getElementById('basicBtn')||document.getElementById('ritualPanel'),body:'Every Priest gets <b>one Basic Attack per turn</b>. It costs no Mana, so it is an important source of reliable damage.',task:'Use Basic Attack once.',check:()=>!!currentPlayer()?.basic},
  {title:'Spend Demon Blood on a Ritual',target:'#ritualPanel',body:'Rituals spend <b>Demon Blood</b>, not Mana. The practice Priest begins with 4 Blood so you can try one immediately. You may resolve only one Ritual each Priest turn.',task:'Resolve one Ritual.',check:()=>Number(S?.runStats?.ritualsUsed||0)>=1},
  {title:'Earn Blood and Relic XP',target:()=>document.getElementById('relicXpMeterStat')||document.getElementById('ritualPanel'),body:'Defeating a Demon awards its remaining <b>Demon Blood</b> and also grants the same amount as <b>Relic XP</b>. The first XP Relic needs 15 XP; later XP-earned Relics require 5 more each time.',task:'Defeat at least one Demon. Use the helper if you want a 1-HP practice target.',check:()=>Number(S?.defeats||0)>=1||Number(S?.rogue?.relicXp||0)>0,helper:prepareTarget,helperLabel:'Prepare 1-HP Demon'},
  {title:'End the Turn',target:()=>document.getElementById('endBtn')||document.getElementById('ritualPanel'),body:'When you are finished, press <b>End Turn</b>. In solo play that immediately leads into the Demon Phase: Demons advance toward the Altar, their abilities resolve, and the next round begins.',task:'End the turn and reach Round 2.',check:()=>Number(S?.round||1)>=2},
  {title:'Duplicate Demons Merge',target:'#boardSection',body:'Whenever <b>two copies of the same Lesser Demon</b> are on the board, they automatically become that card’s Greater form. If they were in different rooms, the Greater Demon stays in the room <b>farthest from the Altar</b>.',task:'Run the merge demonstration.',check:()=>mergeShown,helper:demonstrateMerge,helperLabel:'Show Merge Demo'},
  {title:'Relics, Cinders, and the Endless Loop',target:()=>document.querySelector('.priestRelicTopStack')||document.getElementById('handPanel'),body:'Clear rooms to choose rewards and build your Relic set. After every third Boss, your earned <b>Cinders are banked</b> and the Legacy shop opens. You can then continue with the same run and Relics into another 3 Acts at higher Ascension difficulty. This tutorial state will now be discarded.',task:null}
 ];

 function startTutorial(){
   savedSetup=captureSetup();intro.classList.add('hidden');
   document.getElementById('playerCount').value='1';setupPlayersUI();
   const n=document.getElementById('pname0'),c=document.getElementById('pchar0'),timer=document.getElementById('turnTimerSelect');
   if(n)n.value='Tutorial Priest';if(c)c.value='Exorcist';if(timer)timer.value='60';
   window.__sanctumTutorialMode=true;window.__rogueliteTutorialSession=true;
   if(!startGame()){window.__sanctumTutorialMode=false;window.__rogueliteTutorialSession=false;restoreSetup();setup?.classList.remove('hidden');return}
   active=true;index=0;mergeShown=false;document.body.classList.add('rogue-tutorial-active');
   const p=currentPlayer();if(p){p.blood=4;seedPracticeHand()}
   seedPracticeDemon();S.mana=10;render();pause();coach.classList.remove('hidden');showStep();
   poll=setInterval(()=>{if(active){updateTask();if(!document.querySelector('.rogueTutorialFocus'))focusStep()}},250);
 }

 setupTutorialBtn?.addEventListener('click',()=>{savedSetup=captureSetup();intro.classList.remove('hidden')});
 document.getElementById('rogueTutorialBackBtn')?.addEventListener('click',()=>intro.classList.add('hidden'));
 document.getElementById('rogueTutorialBeginBtn')?.addEventListener('click',startTutorial);
 document.getElementById('rogueTutorialExitBtn')?.addEventListener('click',()=>finishTutorial('Tutorial exited — your practice state was discarded.'));
 prev.addEventListener('click',()=>{if(index>0){index--;showStep()}});
 next.addEventListener('click',()=>{if(index>=steps.length-1)finishTutorial();else{index++;showStep()}});
 window.__startRogueliteTutorial=startTutorial;
})();
