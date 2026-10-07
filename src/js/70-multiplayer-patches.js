/* Clean rebuild module: multiplayer boss UI, menu layers, deck UI, relic and movement fixes. Original execution order preserved. */

/* source: multiplayerBossArtworkSpritePatch */
(()=>{
  'use strict';

  const SPRITE_URL='https://raw.githubusercontent.com/gm8hwmvrf5-web/-sanctum-game/multiplayer-dev/assets/bosses/boss-sprite.webp?v=20261006hq';
  const BOSS_ART_ORDER=[
    'plagueFather',
    'blackSovereign',
    'fallenSeraph',
    'gatebreaker',
    'crimsonOracle',
    'devourer',
    'soulTyrant',
    'lordOfAsh',
    'dreadReaper',
    'boneKing'
  ];
  const COLS=2;
  const TILE_W=512;
  const TILE_H=384;
  let bossArtworkUrls=null;

  function installArtwork(urls){
    if(!urls)return;
    bossArtworkUrls=urls;

    if(typeof BOSSES!=='undefined'&&Array.isArray(BOSSES)){
      BOSSES.forEach(b=>{
        if(b&&urls[b.key])b.art=urls[b.key];
      });
    }

    if(typeof S!=='undefined'&&S&&S.boss&&urls[S.boss.key]){
      S.boss.art=urls[S.boss.key];
    }

    window.__sanctumBossArtworkUrls=urls;
    window.__sanctumBossArtworkReady=true;

    try{
      if(typeof render==='function')render();
    }catch(err){
      console.warn('Boss artwork refresh render failed',err);
    }

    try{
      const modal=document.getElementById('bossDeckModal');
      if(modal&&!modal.classList.contains('hidden')&&typeof renderBossCodex==='function'){
        renderBossCodex();
      }
    }catch(err){
      console.warn('Boss codex artwork refresh failed',err);
    }
  }

  function cropSprite(img){
    const urls={};
    BOSS_ART_ORDER.forEach((key,index)=>{
      const sx=(index%COLS)*TILE_W;
      const sy=Math.floor(index/COLS)*TILE_H;
      const canvas=document.createElement('canvas');
      canvas.width=TILE_W;
      canvas.height=TILE_H;
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)return;
      ctx.drawImage(img,sx,sy,TILE_W,TILE_H,0,0,TILE_W,TILE_H);
      try{
        urls[key]=canvas.toDataURL('image/webp',0.86);
      }catch(_){
        urls[key]=canvas.toDataURL('image/jpeg',0.88);
      }
    });
    return urls;
  }

  const sprite=new Image();
  sprite.crossOrigin='anonymous';
  sprite.decoding='async';
  sprite.onload=()=>{
    try{
      installArtwork(cropSprite(sprite));
    }catch(err){
      console.error('Could not prepare the new Boss artwork.',err);
    }
  };
  sprite.onerror=()=>{
    console.error('Could not load the optimized Boss artwork sprite.');
  };
  sprite.src=SPRITE_URL;

  /* Saved / remotely synced states omit art. Re-apply the new Boss art whenever
     static artwork is restored, without changing any state or Boss rules. */
  if(typeof restoreStaticArtwork==='function'){
    const _restoreStaticArtwork=restoreStaticArtwork;
    restoreStaticArtwork=function(){
      const out=_restoreStaticArtwork.apply(this,arguments);
      if(bossArtworkUrls&&typeof S!=='undefined'&&S&&S.boss&&bossArtworkUrls[S.boss.key]){
        S.boss.art=bossArtworkUrls[S.boss.key];
      }
      return out;
    };
  }
})();


/* source: multiplayerBossStatFitScript */
(()=>{
  'use strict';
  if(window.__sanctumBossStatFitInstalled)return;
  window.__sanctumBossStatFitInstalled=true;

  function fitOne(el,maxPx,minPx){
    if(!el||el.clientWidth<=0)return;
    el.style.fontSize=maxPx+'px';

    // Use binary search so the text lands at the largest size that still fits.
    if(el.scrollWidth<=el.clientWidth+0.5)return;
    let lo=minPx,hi=maxPx,best=minPx;
    for(let i=0;i<10;i++){
      const mid=(lo+hi)/2;
      el.style.fontSize=mid.toFixed(2)+'px';
      if(el.scrollWidth<=el.clientWidth+0.5){
        best=mid;
        lo=mid;
      }else{
        hi=mid;
      }
    }
    el.style.fontSize=Math.max(minPx,best).toFixed(2)+'px';
  }

  function fitBossStatLines(){
    const mobile=window.matchMedia('(max-width:760px), (orientation:landscape) and (max-height:520px)').matches;
    document.querySelectorAll('#bossArea .bossStatLine')
      .forEach(el=>fitOne(el,mobile?11:12,mobile?9:4.5));
    document.querySelectorAll('dialog.mpDemonReader[data-reader-kind="boss"] .mpDemonReaderStats')
      .forEach(el=>fitOne(el,mobile?14:17,mobile?10.5:8));
  }

  let raf=0;
  function scheduleFit(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(fitBossStatLines);
  }

  // Refit after every normal game render so changing HP values can never force
  // the Boss line onto a second row.
  if(typeof render==='function'){
    const _bossStatFitRender=render;
    render=function(){
      const out=_bossStatFitRender.apply(this,arguments);
      scheduleFit();
      return out;
    };
    try{window.render=render}catch(_){}
  }

  window.addEventListener('resize',scheduleFit,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(scheduleFit,80),{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',scheduleFit,{passive:true});
  }

  // The Boss reader is rendered independently of the main board, so observe
  // its DOM changes as well as Boss-room re-renders.
  const observer=new MutationObserver(scheduleFit);
  const startObserver=()=>{
    const bossArea=document.getElementById('bossArea');
    const reader=document.getElementById('mpDemonReader');
    if(bossArea)observer.observe(bossArea,{childList:true,subtree:true,characterData:true});
    if(reader)observer.observe(reader,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-reader-kind','open']});
    scheduleFit();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});
  else startObserver();

  window.__sanctumFitBossStats=fitBossStatLines;
})();


/* source: gameMenuSubdialogLayerScript */
(()=>{
  'use strict';
  if(window.__sanctumMenuSubdialogLayerInstalled)return;
  window.__sanctumMenuSubdialogLayerInstalled=true;

  const menuToModal={
    pauseLoadBtn:'loadChooserModal',
    pauseRulesBtn:'rulesModal',
    pauseDemonDeckBtn:'demonDeckModal',
    pausePriestDeckBtn:'priestDeckModal',
    pauseBossDeckBtn:'bossDeckModal',
    pauseRunGuideBtn:'rogueGuideModal',
    pauseLegacyBtn:'rogueLegacyModal'
  };

  const closeToModal={
    loadCancelBtn:'loadChooserModal',
    rulesClose:'rulesModal',
    demonDeckClose:'demonDeckModal',
    priestDeckClose:'priestDeckModal',
    bossDeckClose:'bossDeckModal',
    rogueGuideClose:'rogueGuideModal',
    rogueLegacyClose:'rogueLegacyModal'
  };

  let active=null;

  function menuIsOpen(){
    const menu=document.getElementById('pauseOverlay');
    return !!menu&&!menu.classList.contains('hidden');
  }

  function keepGamePaused(){
    if(!S||!S.started)return;
    window.__sanctumManualPaused=true;
    S.manualPaused=true;
    try{pauseTurnTimer(false)}catch(_){
      try{clearTurnTimerInterval()}catch(__){}
    }
    try{updateTurnTimerDisplay()}catch(_){}
  }

  function markMenuSubdialog(modalId,triggerId){
    if(!menuIsOpen())return false;
    const modal=document.getElementById(modalId);
    if(!modal)return false;

    if(active&&active.modalId!==modalId){
      const old=document.getElementById(active.modalId);
      if(old)delete old.dataset.fromGameMenu;
    }

    active={modalId,triggerId};
    modal.dataset.fromGameMenu='1';
    document.body.classList.add('sanctum-menu-subdialog-open');
    keepGamePaused();

    // Opening handlers in older parts may alter timer state, so reassert the
    // paused-menu state after the child screen has actually opened.
    requestAnimationFrame(keepGamePaused);
    setTimeout(keepGamePaused,0);
    return true;
  }

  function returnToGameMenu(modalId){
    if(!active||active.modalId!==modalId)return false;
    const modal=document.getElementById(modalId);
    if(modal){
      modal.classList.add('hidden');
      delete modal.dataset.fromGameMenu;
    }

    const triggerId=active.triggerId;
    active=null;
    document.body.classList.remove('sanctum-menu-subdialog-open');
    keepGamePaused();

    const menu=document.getElementById('pauseOverlay');
    if(menu)menu.classList.remove('hidden');

    setTimeout(()=>{
      const trigger=document.getElementById(triggerId);
      if(trigger&&!trigger.disabled)trigger.focus();
      else document.getElementById('resumeGameBtn')?.focus();
    },0);
    return true;
  }

  // Capture the menu-button press before the existing click handler opens the
  // destination modal. This lets us identify it as a child of the pause menu.
  document.addEventListener('click',e=>{
    const button=e.target&&e.target.closest?e.target.closest('button'):null;
    if(!button)return;

    const modalId=menuToModal[button.id];
    if(modalId&&menuIsOpen()){
      markMenuSubdialog(modalId,button.id);
      return;
    }

    const closingModal=closeToModal[button.id];
    if(closingModal&&active&&active.modalId===closingModal){
      // Do not let legacy/guide close handlers resume the game underneath the
      // menu. Closing a menu child always returns to the still-paused menu.
      e.preventDefault();
      e.stopImmediatePropagation();
      returnToGameMenu(closingModal);
      return;
    }

    // The newer Legacy layout also has a separate top-right "Close ×" button.
    // It is not rogueLegacyClose (the bottom checkpoint button can legitimately
    // say Continue Descent), so recognize it by its location/text when Legacy
    // was opened from the paused Game Menu.
    if(
      active&&active.modalId==='rogueLegacyModal'&&
      button.closest&&button.closest('#rogueLegacyModal')&&
      /^close\b/i.test((button.textContent||'').trim())
    ){
      e.preventDefault();
      e.stopImmediatePropagation();
      returnToGameMenu('rogueLegacyModal');
    }
  },true);

  // Escape closes the child screen first. A second Escape from the parent menu
  // can still use the existing Resume behavior.
  document.addEventListener('keydown',e=>{
    if((e.key||'').toLowerCase()!=='escape'||!active)return;
    const modal=document.getElementById(active.modalId);
    if(!modal||modal.classList.contains('hidden')){
      delete modal?.dataset?.fromGameMenu;
      active=null;
      document.body.classList.remove('sanctum-menu-subdialog-open');
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    returnToGameMenu(active.modalId);
  },true);

  // If another flow closes a child screen itself (for example completing a
  // load), clear the temporary layering marker without touching gameplay.
  const observer=new MutationObserver(()=>{
    if(!active)return;
    const modal=document.getElementById(active.modalId);
    if(!modal||modal.classList.contains('hidden')){
      if(modal)delete modal.dataset.fromGameMenu;
      active=null;
      document.body.classList.remove('sanctum-menu-subdialog-open');
      if(menuIsOpen())keepGamePaused();
    }
  });
  if(document.body)observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});

  window.__sanctumReturnToGameMenu=returnToGameMenu;
})();


/* source: priestDeckMenuScript */
(()=>{
  'use strict';
  if(window.__sanctumPriestDeckMenuInstalled)return;
  window.__sanctumPriestDeckMenuInstalled=true;

  function patchManaBlessingCard(card){
    if(!card||card.n!=='Mana Blessing')return card;
    card.v=3;
    card.e='Gain 3 shared Mana.';
    return card;
  }

  function applyManaBlessingBalance(){
    try{
      if(typeof PRIEST!=='undefined'&&Array.isArray(PRIEST)){
        PRIEST.forEach(patchManaBlessingCard);
      }
    }catch(_){}

    try{
      if(typeof S!=='undefined'&&S){
        const groups=[
          S.priestDeck,
          S.priestDiscard,
          ...(Array.isArray(S.players)?S.players.map(p=>p&&p.hand):[])
        ];
        groups.forEach(group=>{
          if(Array.isArray(group))group.forEach(patchManaBlessingCard);
        });
        if(S.lastPriestCardPlayed)patchManaBlessingCard(S.lastPriestCardPlayed);
      }
    }catch(_){}
  }

  // Patch the master definition immediately so every newly created game/deck
  // receives the 3-Mana version.
  applyManaBlessingBalance();

  // Existing saves and synchronized online states may contain older card copies.
  // Patch those copies before each render without changing any other card data.
  if(typeof render==='function'){
    const _priestDeckMenuRender=render;
    render=function(){
      applyManaBlessingBalance();
      return _priestDeckMenuRender.apply(this,arguments);
    };
    try{window.render=render}catch(_){}
  }

  function esc(value){
    return String(value??'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function ensurePriestDeckModal(){
    let modal=document.getElementById('priestDeckModal');
    if(modal)return modal;

    modal=document.createElement('div');
    modal.className='modal hidden';
    modal.id='priestDeckModal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','priestDeckTitle');
    modal.innerHTML=
      '<div class="modalbox priestDeckBox">'+
        '<div class="priestDeckTop">'+
          '<div><h2 id="priestDeckTitle">Priest Deck</h2>'+
          '<div class="priestDeckSubtitle">Complete Priest-card reference • Normal and Empowered effects</div></div>'+
          '<button class="btn" id="priestDeckClose" type="button">Close</button>'+
        '</div>'+
        '<div class="priestDeckGrid" id="priestDeckGrid"></div>'+
      '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#priestDeckClose')?.addEventListener('click',()=>{
      modal.classList.add('hidden');
    });
    return modal;
  }

  function renderPriestDeckReference(){
    applyManaBlessingBalance();
    const modal=ensurePriestDeckModal();
    const grid=modal.querySelector('#priestDeckGrid');
    if(!grid)return;

    let cards=[];
    try{
      if(typeof PRIEST!=='undefined'&&Array.isArray(PRIEST))cards=PRIEST;
    }catch(_){}

    const unique=[];
    const seen=new Set();
    cards.forEach(c=>{
      if(!c||!c.n||seen.has(c.n))return;
      seen.add(c.n);
      unique.push(c);
    });

    grid.innerHTML=unique.map(c=>{
      let art='';
      try{
        art=(typeof PRIEST_CARD_ARTS!=='undefined'&&PRIEST_CARD_ARTS&&PRIEST_CARD_ARTS[c.n])||c.art||'';
      }catch(_){art=c.art||''}
      const normal=c.e||'No normal effect text.';
      const empowered=c.x||'No Empowered effect text.';
      return '<article class="priestDeckReferenceCard">'+
        '<div class="priestDeckReferenceArt">'+(art?'<img src="'+esc(art)+'" alt="'+esc(c.n)+'">':'')+'</div>'+
        '<div class="priestDeckReferenceBody">'+
          '<div class="priestDeckReferenceHead">'+
            '<div class="priestDeckReferenceName">'+esc(c.n)+'</div>'+
            '<div class="priestDeckReferenceCost">'+esc(c.m??0)+' Mana</div>'+
          '</div>'+
          '<div class="priestDeckReferenceEffect"><b>Normal:</b> '+esc(normal)+'</div>'+
          '<div class="priestDeckReferenceEffect empowered"><b>Empowered:</b> '+esc(empowered)+'</div>'+
        '</div>'+
      '</article>';
    }).join('');
  }

  const modal=ensurePriestDeckModal();

  // Add the new button beside the other deck/reference buttons in the Tab menu.
  const host=document.querySelector('#pauseOverlay .pauseActions');
  if(host&&!document.getElementById('pausePriestDeckBtn')){
    const b=document.createElement('button');
    b.type='button';
    b.id='pausePriestDeckBtn';
    b.className='btn';
    b.textContent='Priest Deck';
    const demonBtn=document.getElementById('pauseDemonDeckBtn');
    host.insertBefore(b,demonBtn||document.getElementById('resumeGameBtn')||null);
    b.addEventListener('click',()=>{
      renderPriestDeckReference();
      modal.classList.remove('hidden');
      setTimeout(()=>modal.querySelector('#priestDeckClose')?.focus(),0);
    });
  }

  window.renderPriestDeckReference=renderPriestDeckReference;
  window.__sanctumApplyManaBlessingBalance=applyManaBlessingBalance;
})();


/* source: elementalBasicAttackRelicsPatch */
(()=>{
'use strict';
if(window.__elementalBasicAttackRelicsInstalled)return;
window.__elementalBasicAttackRelicsInstalled=true;

const FIRE='cinderbrand',POISON='serpentsFang';
const E={
 [FIRE]:{key:FIRE,k:FIRE,id:FIRE,n:'Cinderbrand',name:'Cinderbrand',t:'special',type:'Special',cat:'Basic Attack',category:'Basic Attack',v:0,
  e:'Your Basic Attack ignites its target. At the end of your turn, it takes Fire damage equal to half your current Basic Attack damage (rounded down, minimum 1).',
  txt:'Your Basic Attack ignites its target. At the end of your turn, it takes Fire damage equal to half your current Basic Attack damage (rounded down, minimum 1).'},
 [POISON]:{key:POISON,k:POISON,id:POISON,n:"Serpent's Fang",name:"Serpent's Fang",t:'special',type:'Special',cat:'Basic Attack',category:'Basic Attack',v:0,
  e:'Your Basic Attack applies Poison. On the second Poison Basic Attack hit against the same target, it immediately takes bonus damage equal to your current Basic Attack damage, then its Poison count resets.',
  txt:'Your Basic Attack applies Poison. On the second Poison Basic Attack hit against the same target, it immediately takes bonus damage equal to your current Basic Attack damage, then its Poison count resets.'}
};
E[FIRE].d=E[FIRE].desc=E[FIRE].e;E[POISON].d=E[POISON].desc=E[POISON].e;

function rk(v){return typeof v==='string'?v:(v&&typeof v==='object'?String(v.key||v.k||v.id||''):'')}
function rn(v){return v&&typeof v==='object'?String(v.n||v.name||''):''}
function active(k){
 if(typeof S==='undefined'||!S||!Array.isArray(S.activeRelics))return false;
 return S.activeRelics.some(function(v){return rk(v)===k||rn(v)===E[k].n});
}
function syncFlags(){
 if(typeof S==='undefined'||!S)return;
 S.elementalRelics=S.elementalRelics||{};
 if(active(FIRE))S.elementalRelics.fire=true;
 if(active(POISON))S.elementalRelics.poison=true;
}
function enabled(k){syncFlags();return !!(S&&S.elementalRelics&&S.elementalRelics[k])}
function insert(deck,k){if(!Array.isArray(deck)||deck.indexOf(k)>=0)return;deck.splice(Math.floor(Math.random()*(deck.length+1)),0,k)}
function seed(){
 if(typeof S==='undefined'||!S||!Array.isArray(S.relicDeck))return;
 S.elementalRelics=S.elementalRelics||{};
 if(S.elementalRelics.deckVersion===1){syncFlags();return}
 if(!active(FIRE))insert(S.relicDeck,FIRE);
 if(!active(POISON))insert(S.relicDeck,POISON);
 S.elementalRelics.deckVersion=1;syncFlags();
}

if(typeof relicByKey==='function'){
 const old=relicByKey;
 relicByKey=function(k){return E[k]||old.apply(this,arguments)};
 try{window.relicByKey=relicByKey}catch(_){}
}
if(typeof applyRelic==='function'){
 const old=applyRelic;
 applyRelic=function(rel){
  const k=rk(rel);
  if(!E[k])return old.apply(this,arguments);
  const before=Array.isArray(S&&S.activeRelics)?S.activeRelics.length:0;
  let out;
  try{out=old.apply(this,arguments)}catch(err){console.warn('Custom Relic base handler skipped',err)}
  S.activeRelics=Array.isArray(S.activeRelics)?S.activeRelics:[];
  if(S.activeRelics.length===before&&!active(k))S.activeRelics.push(k);
  S.elementalRelics=S.elementalRelics||{};
  if(k===FIRE)S.elementalRelics.fire=true;
  if(k===POISON)S.elementalRelics.poison=true;
  return out===undefined?rel:out;
 };
 try{window.applyRelic=applyRelic}catch(_){}
}

function nameOf(x){
 if(!x)return 'target';
 if(x.kind==='boss')return (x.boss&&x.boss.n)||(S&&S.boss&&S.boss.n)||'Boss';
 try{return demonName(x.d)}catch(_){return x.d&&x.d.n||'Demon'}
}
function alive(x){
 if(!x)return false;
 if(x.kind==='boss')return !!(S&&S.bossRevealed&&S.boss&&S.boss.cur>0&&x.boss===S.boss);
 if(!x.d||x.d.cur<=0)return false;
 try{return !!findDemonLocation(x.d)}catch(_){return true}
}
function poisonState(x){
 if(x.kind==='boss'){S.boss.status=S.boss.status||{};return S.boss.status}
 x.d.status=x.d.status||{};return x.d.status;
}
function addBurn(x,dmg,owner){
 S.elementalBurnQueue=Array.isArray(S.elementalBurnQueue)?S.elementalBurnQueue:[];
 S.elementalBurnQueue.push({owner:Number(owner)||0,kind:x.kind==='boss'?'boss':'demon',
  id:x.kind==='boss'?String((S.boss&& (S.boss.key||S.boss.n))||'boss'):String((x.d&&x.d.id)||''),
  damage:Math.max(1,Math.floor(Number(dmg)||0))});
}
function burnTarget(item){
 if(item.kind==='boss'){
  if(!S||!S.bossRevealed||!S.boss||S.boss.cur<=0)return null;
  return String(S.boss.key||S.boss.n||'boss')===String(item.id)?{kind:'boss',boss:S.boss}:null;
 }
 try{const h=allDemons().find(function(v){return String((v.d&&v.d.id)||'')===String(item.id)});return h?Object.assign({kind:'demon'},h):null}catch(_){return null}
}

const rawDeal=typeof dealDamageTarget==='function'?dealDamageTarget:null;
if(rawDeal){
 dealDamageTarget=function(x,amt,source,opts){
  source=source||'Effect';opts=opts||{};
  const isBasic=/Basic Attack\s*$/.test(String(source));
  const base=Math.max(0,Math.floor(Number(amt)||0));
  const owner=Number((S&&S.current)||0);
  const out=rawDeal.apply(this,arguments);
  if(!isBasic||!alive(x))return out;

  if(enabled('poison')){
   const st=poisonState(x);
   st.elementalPoisonHits=Math.max(0,Number(st.elementalPoisonHits)||0)+1;
   if(st.elementalPoisonHits>=2){
    st.elementalPoisonHits=0;
    const burst=Math.max(1,Math.floor(Number(typeof basicAttackDamage==='function'?basicAttackDamage():base)||base||1));
    try{log("Serpent's Fang erupts on "+nameOf(x)+' for '+burst+' Poison damage.','good')}catch(_){}
    rawDeal(x,burst,"Serpent's Fang Poison",{});
   }else try{log("Serpent's Fang poisons "+nameOf(x)+' (1/2).','good')}catch(_){}
  }
  if(enabled('fire')&&alive(x)){
   const burn=Math.max(1,Math.floor(base/2));
   addBurn(x,burn,owner);
   try{log('Cinderbrand ignites '+nameOf(x)+' for '+burn+' Fire damage at the end of this turn.','good')}catch(_){}
  }
  return out;
 };
 try{window.dealDamageTarget=dealDamageTarget}catch(_){}
}

function modalOpen(){
 return ['choiceModal','damageAmountModal','descendModal','relicModal','desecrationModal','consecrateModal','crucifixModal','rogueChoiceModal','rogueLegacyModal'].some(function(id){
  const el=document.getElementById(id);if(!el||el.classList.contains('hidden'))return false;
  try{return getComputedStyle(el).display!=='none'}catch(_){return true}
 });
}
function resolveBurns(owner){
 const q=Array.isArray(S&&S.elementalBurnQueue)?S.elementalBurnQueue:[],mine=[],keep=[];
 q.forEach(function(v){(Number(v.owner)===Number(owner)?mine:keep).push(v)});S.elementalBurnQueue=keep;
 let hit=false;
 mine.forEach(function(item){
  const x=burnTarget(item);if(!x||!alive(x))return;hit=true;
  try{log('Cinderbrand burns '+nameOf(x)+' for '+item.damage+' Fire damage.','good')}catch(_){}
  rawDeal(x,item.damage,'Cinderbrand Fire',{});
 });
 return hit;
}
let ending=false;
function finishEnd(old,args,n){
 if(!ending)return;
 if(modalOpen()&&n<600){setTimeout(function(){finishEnd(old,args,n+1)},100);return}
 ending=false;old.apply(window,args);
}
if(typeof endTurn==='function'&&rawDeal){
 const old=endTurn;
 endTurn=function(){
  if(ending)return false;seed();
  const had=resolveBurns(Number((S&&S.current)||0));
  try{render()}catch(_){}
  if(had&&modalOpen()){ending=true;finishEnd(old,Array.from(arguments),0);return false}
  return old.apply(this,arguments);
 };
 try{window.endTurn=endTurn}catch(_){}
}
if(typeof render==='function'){
 const old=render;
 render=function(){try{seed()}catch(err){console.warn('Could not seed elemental Relics',err)}return old.apply(this,arguments)};
 try{window.render=render}catch(_){}
}
try{seed()}catch(_){}
})();


/* source: demonMovementAuditFixes */
(()=>{
'use strict';
if(window.__sanctumDemonMovementAuditFixesInstalled)return;
window.__sanctumDemonMovementAuditFixesInstalled=true;

/*
 Movement audit fixes:
 1) A movement-stop effect blocks every forward move attempted during the
    Demon Phase, including start-of-phase pushes and same-phase bonus movement.
 2) Consecrated Hall stops are consumed in the Demon Phase in which they apply
    instead of incorrectly carrying into the following round.
 3) Lesser duplicates merge immediately after forward movement, matching the
    immediate-merge rule already used by spawns and backward movement.
*/

if(typeof applyRoomEntryEffects==='function'){
  applyRoomEntryEffects=function(d){
    let loc=findDemonLocation(d);
    if(!loc)return;

    if(loc.r===1&&roomDesecrated(1)){
      d.status=d.status||{};
      d.status.attackRoundBonus=(d.status.attackRoundBonus||0)+1;
      log(demonName(d)+' gains +1 Attack from the Desecrated Hall.','bad');
    }

    if(loc.r===1&&roomConsecrated(1)){
      d.status=d.status||{};
      const wasStopped=!!d.status.stop;
      applyStop(d);
      if(d.status.stop&&!wasStopped){
        log('Consecrated Hall stops '+demonName(d)+'.','good');
      }
    }

    if(loc.r===3&&roomDesecrated(3)){
      let before=d.cur;
      d.cur=Math.min(demonMaxHP(d),d.cur+1);
      if(d.cur>before)log(demonName(d)+' heals 1 HP in the Desecrated Crypt.','bad');
    }
  };
  try{window.applyRoomEntryEffects=applyRoomEntryEffects}catch(_){}
}

if(typeof moveOneForward==='function'){
  const auditedMoveOneForward=moveOneForward;
  moveOneForward=function(d,reason='Demon movement'){
    if(typeof S!=='undefined'&&S&&S.phase==='Demon'&&d&&d.status&&d.status.stop){
      return false;
    }

    const moved=auditedMoveOneForward.apply(this,arguments);

    if(moved&&d){
      try{
        if(findDemonLocation(d)&&typeof checkMerge==='function')checkMerge(d);
      }catch(err){
        console.warn('Immediate movement merge check failed',err);
      }
    }
    return moved;
  };
  try{window.moveOneForward=moveOneForward}catch(_){}
}

if(typeof triggerEnterRoom==='function'){
  triggerEnterRoom=function(d){
    let code=demonCode(d),v=demonValue(d);
    if(code==='roomAltar')damageAltar(v,demonName(d)+' enters a room');

    let loc=findDemonLocation(d);
    if(!loc)return;

    applyRoomEntryEffects(d);
    loc=findDemonLocation(d);
    if(!loc)return;

    let f=ensureBossFlags();
    if(bossIs("boneKing")&&loc.r===3){
      d.cur+=1;
      log(S.boss.n+' — Ossuary Court grants '+demonName(d)+' +1 HP in the Crypt.','bad');
    }

    let sporeCount=f.spores[loc.r]||0;
    if(bossIs("plagueFather")&&sporeCount>0){
      f.spores[loc.r]=sporeCount-1;
      addBossHpBonus(d,1,"Corruption Spores");
    }

    if(bossIs("gatebreaker")&&!f.breachUsed&&(loc.r===1||loc.r===2)){
      f.breachUsed=true;
      if(S.phase==='Demon'&&d.status&&d.status.stop){
        log(S.boss.n+' — Breach the Sanctum is halted because '+demonName(d)+' is stopped.','good');
      }else{
        let moved=moveOneForward(d,S.boss.n+' — Breach the Sanctum');
        if(moved)log(S.boss.n+' — Breach the Sanctum moves '+demonName(d)+' 1 additional room forward.','bad');
        else log(S.boss.n+' — Breach the Sanctum tries to move '+demonName(d)+', but the next room is full.','bad');
      }
    }
  };
  try{window.triggerEnterRoom=triggerEnterRoom}catch(_){}
}

if(typeof resolveStartDemonPhaseAbilities==='function'){
  resolveStartDemonPhaseAbilities=function(){
    let snapshot=allDemons().map(x=>x.d);
    for(let d of snapshot){
      let code=demonCode(d),v=demonValue(d);
      if(code==='spawnImp'){
        spawnSpecificImp(v);
      }else if(code==='phasePush'){
        let movedTargets=new Set();
        for(let k=0;k<v;k++){
          let t=null;
          for(let r=3;r>=0&&!t;r--){
            t=S.rooms[r].find(x=>!movedTargets.has(x.id))||null;
          }
          if(!t)break;
          movedTargets.add(t.id);
          let moved=moveOneForward(t,demonName(d)+' ability');
          if(moved){
            log(demonName(d)+' moves '+demonName(t)+' forward 1 room (automatic closest distinct target).','bad');
          }else if(t.status&&t.status.stop){
            log(demonName(d)+' cannot move '+demonName(t)+' because its movement is stopped.','good');
          }else{
            log(demonName(d)+' cannot move '+demonName(t)+' because the next room is full.','info');
          }
        }
      }
    }
  };
  try{window.resolveStartDemonPhaseAbilities=resolveStartDemonPhaseAbilities}catch(_){}
}

if(typeof moveDemons==='function'){
  const auditedMoveDemons=moveDemons;
  moveDemons=function(){
    const out=auditedMoveDemons.apply(this,arguments);

    try{
      allDemons().forEach(x=>{
        if(x&&x.d&&x.d.status&&x.d.status.stop)delete x.d.status.stop;
      });
    }catch(err){
      console.warn('Could not clear resolved Demon Phase stop flags',err);
    }
    return out;
  };
  try{window.moveDemons=moveDemons}catch(_){}
}
})();
