/* Phase 2 — character-in-room presentation. No gameplay state mutation.
 * Existing priest/demon art, renderers, targeting, and multiplayer are authoritative.
 * This module adds a decorative third-person priest and battlefield readouts. */
(()=>{
  'use strict';
  const app=document.querySelector('body > .app.layoutPhase1');
  const board=document.getElementById('boardSection');
  if(!app||!board||!document.getElementById('layoutRoomNav'))return;
  app.classList.add('layoutPhase2');

  const stage=document.createElement('div');
  stage.id='layoutBattlefieldAtmosphere';
  stage.setAttribute('aria-hidden','true');
  stage.innerHTML='<div class="layoutDepthHaze"></div><div class="layoutGroundPlane"></div><div class="layoutGroundSigil"></div>';
  board.insertAdjacentElement('afterend',stage);

  const actor=document.createElement('div');
  actor.id='layoutThirdPersonActor';
  actor.className='layoutThirdPersonActor';
  actor.setAttribute('aria-label','Current priest character');
  actor.setAttribute('role','img');
  // SVG back-facing 3/4 body model; textures/portraits remain separately owned by game.
  // The illustration itself is static so it never intercepts demon targeting.
  actor.innerHTML=`
    <div class="layoutActorAura" aria-hidden="true"></div>
    <svg class="layoutActorFigure" viewBox="0 0 230 356" role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="layoutRobe" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#3a343c"/><stop offset=".3" stop-color="#1b1924"/>
          <stop offset=".7" stop-color="#101018"/><stop offset="1" stop-color="#05060d"/>
        </linearGradient>
        <linearGradient id="layoutCowl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#77655b"/><stop offset=".28" stop-color="#3c3335"/>
          <stop offset=".82" stop-color="#14131b"/><stop offset="1" stop-color="#080a0f"/>
        </linearGradient>
        <linearGradient id="layoutGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fbdfa4"/><stop offset=".48" stop-color="#bd8841"/>
          <stop offset="1" stop-color="#614019"/>
        </linearGradient>
        <linearGradient id="layoutSteel" x1="0" y1="0" x2="1" y2=".7">
          <stop offset="0" stop-color="#9ca5a8"/><stop offset=".35" stop-color="#57646b"/>
          <stop offset="1" stop-color="#1f2833"/>
        </linearGradient>
        <radialGradient id="layoutSpell"><stop offset="0" stop-color="#fff8df" stop-opacity=".95"/>
          <stop offset=".27" stop-color="#e7cf91" stop-opacity=".65"/>
          <stop offset="1" stop-color="#cb9150" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="124" cy="341" rx="80" ry="10" fill="#030609" opacity=".8"/>
      <!-- boots and legs -->
      <path d="M86 257 L84 319 Q74 334 67 337 Q60 343 69 348 L106 348 L107 312 L116 276 Z" fill="#17181e" stroke="#786147" stroke-width="2"/>
      <path d="M132 274 L131 321 Q133 333 145 340 L174 341 Q181 345 171 350 L132 349 L114 293 Z" fill="#14151c" stroke="#715942" stroke-width="2"/>
      <path d="M69 339 Q84 335 105 340 M136 339 L171 342" stroke="#8e724e" stroke-width="2" fill="none"/>
      <!-- deep tapered robe, skirt split and stitched edging -->
      <path d="M91 112 Q64 133 57 175 Q43 233 39 308 L59 324 L72 292 L80 336 L116 323 L137 337 L155 290 L171 325 L193 305 Q180 219 159 164 Q150 128 138 115 Z"
        fill="url(#layoutRobe)" stroke="#89704c" stroke-width="3" stroke-linejoin="round"/>
      <path d="M109 153 Q92 229 81 333 L116 323 Q130 248 132 177 Z" fill="#30222b" opacity=".9"/>
      <path d="M148 154 Q153 238 172 322" fill="none" stroke="#be8647" stroke-width="3" opacity=".7"/>
      <path d="M77 159 L56 296 M157 172 L186 305" stroke="#b79a73" stroke-width="2" opacity=".4"/>
      <path d="M74 277 Q109 309 175 278" fill="none" stroke="#594533" stroke-width="2" stroke-dasharray="4 7" opacity=".7"/>
      <!-- armoured shoulders -->
      <path d="M87 107 Q57 109 43 139 L50 168 L78 172 L92 144 Z" fill="url(#layoutSteel)" stroke="#bb9964" stroke-width="4"/>
      <path d="M144 110 Q174 109 193 133 L194 164 L163 178 L141 143 Z" fill="url(#layoutSteel)" stroke="#c59e63" stroke-width="4"/>
      <path d="M48 143 L72 156 M162 155 L189 144" stroke="#d9c699" stroke-width="2" opacity=".65"/>
      <!-- hanging sleeve left -->
      <path d="M49 163 Q32 197 35 224 L46 256 L67 254 L73 218 L78 170 Z" fill="url(#layoutRobe)" stroke="#806748" stroke-width="3"/>
      <path d="M164 173 Q183 185 198 231 L189 258 L171 252 L160 216 Z" fill="url(#layoutRobe)" stroke="#7f6140" stroke-width="3"/>
      <!-- belt and broad back sigil -->
      <path d="M75 236 Q120 251 166 235 L169 248 Q123 269 74 250 Z" fill="#352a28" stroke="#aa814a" stroke-width="3"/>
      <rect x="113" y="238" width="19" height="17" rx="2" fill="url(#layoutGold)" stroke="#48301b" stroke-width="2"/>
      <path d="M122 240 V252 M116 246 H127" stroke="#241912" stroke-width="2"/>
      <path d="M113 161 L122 178 L132 161 L127 191 L142 199 L126 207 L122 227 L116 208 L100 199 L116 190 Z"
        fill="#c3a571" opacity=".8" stroke="#f2d69a" stroke-width="1.5"/>
      <path d="M122 174 L122 210 M107 195 L137 195" stroke="#382b2a" stroke-width="3"/>
      <!-- back of head and hood -->
      <path d="M85 112 Q80 68 96 48 Q108 31 126 35 Q148 40 159 66 L154 115 L136 130 L100 125 Z"
        fill="url(#layoutCowl)" stroke="#b5a080" stroke-width="3.5"/>
      <path d="M98 57 Q115 43 140 54 Q155 70 145 110 Q126 115 103 110 Q94 86 98 57Z"
        fill="#101118" stroke="#534947" stroke-width="2"/>
      <path d="M98 54 Q118 31 141 52 Q148 72 150 95" fill="none" stroke="#b5a07b" stroke-width="4" opacity=".72"/>
      <path d="M100 108 Q121 119 144 107" fill="none" stroke="#7b624e" stroke-width="3"/>
      <!-- left glove -->
      <path d="M45 249 L66 248 L66 264 Q64 276 53 278 Q43 268 45 249Z" fill="#40332c" stroke="#9d815b" stroke-width="2"/>
      <!-- right hand and illuminated censer -->
      <path d="M171 246 L191 249 L189 263 Q178 280 171 264Z" fill="#352d2b" stroke="#a28a62" stroke-width="2"/>
      <path d="M184 250 L207 151" stroke="#291b17" stroke-width="9" stroke-linecap="round"/>
      <path d="M184 250 L207 151" stroke="url(#layoutGold)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="208" cy="145" r="25" fill="url(#layoutSpell)" class="layoutSpellGlow"/>
      <path d="M200 143 L208 128 L216 143 L208 163Z" fill="#c4ab7f" stroke="#f0d39b" stroke-width="3"/>
      <path d="M203 145 H213 M208 136 V154" stroke="#fff0cc" stroke-width="2"/>
    </svg>
    <div class="layoutActorIdentity"><img id="layoutActorPortrait" alt="" decoding="async"/>
      <span><strong id="layoutActorName">PRIEST</strong><small id="layoutActorSlot">The Sanctum</small></span>
    </div>`;
  stage.insertAdjacentElement('afterend',actor);

  const encounter=document.createElement('div');
  encounter.id='layoutEncounterLabel';
  encounter.className='layoutEncounterLabel';
  encounter.setAttribute('role','status');
  encounter.setAttribute('aria-live','off');
  encounter.innerHTML='<span class="layoutEncounterEyebrow">SANCTUM ENCOUNTER</span><strong id="layoutEncounterTitle">GATEWAY</strong><small id="layoutEncounterSubtitle">Awaiting the exorcism</small>';
  actor.insertAdjacentElement('afterend',encounter);

  const portrait=document.getElementById('layoutActorPortrait');
  const actorName=document.getElementById('layoutActorName');
  const actorSlot=document.getElementById('layoutActorSlot');
  const encounterTitle=document.getElementById('layoutEncounterTitle');
  const encounterSubtitle=document.getElementById('layoutEncounterSubtitle');
  const roomNames=['Gateway','Hall','Chapel','Crypt','Boss Room'];
  const classColors={
    Exorcist:'#c7986e',Oracle:'#a69ae4',Crusader:'#c9b176',
    'High Priestess':'#aac0dc',Monk:'#a2b9a4',Abbess:'#cda8ba'
  };
  let lastPortrait='';
  function updateStage(){
    const active=typeof S!=='undefined'&&S&&S.started&&Array.isArray(S.players)&&S.players.length>0;
    actor.classList.toggle('layoutActorWaiting',!active);
    let priest=null;
    if(active){
      try{priest=typeof currentPlayer==='function'?currentPlayer():S.players[S.current||0]}catch(_){}
    }
    if(priest){
      const className=String(priest.char||'Exorcist');
      const classArt=(typeof CHARACTERS!=='undefined'&&CHARACTERS[className])||null;
      const src=classArt&&typeof classArt.img==='string'?classArt.img:'';
      if(src!==lastPortrait){portrait.src=src;lastPortrait=src;}
      actor.style.setProperty('--layout-priest-accent',classColors[className]||'#d4b47d');
      actorName.textContent=className.toUpperCase();
      actorSlot.textContent=(priest.name||('Player '+(Number(S.current||0)+1)))+' • Active Priest';
      actor.setAttribute('aria-label','Third-person priest: '+className);
    }else{
      actorName.textContent='PRIEST';
      actorSlot.textContent='Choose a character';
      actor.setAttribute('aria-label','Third-person priest silhouette');
      if(lastPortrait){portrait.removeAttribute('src');lastPortrait='';}
    }
    const focus=board.dataset.focusedRoom||'gateway';
    const index=Math.max(0,['gateway','hall','chapel','crypt','boss'].indexOf(focus));
    encounterTitle.textContent=roomNames[index].toUpperCase();
    let count=0;
    if(active&&index<4&&Array.isArray(S.rooms)&&Array.isArray(S.rooms[index]))count=S.rooms[index].length;
    if(active&&index===4&&S.bossRevealed&&S.boss&&Number(S.boss.cur)>0)count=1;
    // Navigation counters reflect the live board even though the engine
    // redraws the demon nodes directly (rather than via renderBoard).
    const tabs=document.querySelectorAll('#layoutRoomNav .layoutRoomTab');
    tabs.forEach((tab,i)=>{
      const amount=active?(i<4?(Array.isArray(S.rooms?.[i])?S.rooms[i].length:0)
        :(S.bossRevealed&&S.boss&&Number(S.boss.cur)>0?1:0)):0;
      const badge=tab.querySelector('.roomCount');
      if(badge)badge.textContent=String(amount);
      tab.setAttribute('aria-label',roomNames[i]+', '+amount+' '+(amount===1?'enemy':'enemies')+', inspect room');
    });
    encounterSubtitle.textContent=!active?'Choose a priest to begin':count>0
      ?count+' '+(count===1?'demon':'demons')+' in sight • Tap to inspect'
      :'No demons in sight • Watch the next spawn';
    app.classList.toggle('layoutActiveCombat',active&&count>0);
  }

  if(typeof renderPlayer==='function'){
    const before=renderPlayer;
    renderPlayer=function(){const result=before.apply(this,arguments);updateStage();return result;};
  }
  if(typeof render==='function'){
    const before=render;
    render=function(){const result=before.apply(this,arguments);updateStage();return result;};
  }
  if(typeof rogueliteRenderHud==='function'){
    const before=rogueliteRenderHud;
    rogueliteRenderHud=function(){const result=before.apply(this,arguments);updateStage();return result;};
  }
  // Phase 1's view-only tabs change the focused room without mutating game state.
  if(typeof MutationObserver==='function'){
    new MutationObserver(updateStage).observe(board,{attributes:true,attributeFilter:['data-focused-room']});
  }
  updateStage();
})();
