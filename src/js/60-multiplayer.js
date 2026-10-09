/* Clean rebuild module: Supabase multiplayer synchronization. Original execution order preserved. */

/* source: sanctumMultiplayerLobbyScript */
(()=>{
  'use strict';

  const SUPABASE_URL='https://nkucyukzxjofcypaqxor.supabase.co';
  const SUPABASE_KEY='sb_publishable_NXIee43RqgT7adfNiMJVyg_aPZhSALZ';
  const SESSION_KEY='sanctum_multiplayer_session_v1';

  let client=null;
  let channel=null;
  let rosterChannel=null;
  let session=null;
  let panel=null;
  let lastRosterSnapshot=null;
  let lastAppliedVersion=-1;
  let authoritativeActiveSeat=null;
  let lastPublishedHash='';
  let publishTimer=0;
  let publishBusy=false;
  let publishQueued=false;
  let applyingRemote=false;
  let startingOnline=false;
  let hooksInstalled=false;
  let heartbeatTimer=0;
  let heartbeatBusy=false;
  let lobbyRosterPollTimer=0;
  let lobbyRosterRefreshBusy=false;
  let sessionEnded=false;
  const voteActionRegistry=new Map();
  const resolvingVoteIds=new Set();
  const voteOpeningIds=new Set();
  let resolvingVoteTransition=false;
  let choiceAuthorityRepairBusy=false;
  let choiceRecoveryTimer=0;

  function applyMonkFirstRitualBalanceText(){
    try{
      if(typeof CHARACTERS==='undefined'||!CHARACTERS)return;
      Object.values(CHARACTERS).forEach(ch=>{
        if(!ch||!Array.isArray(ch.rituals)||!ch.rituals.length)return;
        const r=ch.rituals[0];
        if(!r||r.kind!=='palmJudgment')return;
        r.h='Deal 2 damage to a Demon or Boss. If it is a Demon, move it back exactly 1 room.';
        r.f='Deal 6 damage to a Demon or Boss. If it is a Demon, move it back exactly 2 rooms.';
      });
    }catch(err){
      console.warn('Could not update Monk Ritual text',err);
    }
  }
  applyMonkFirstRitualBalanceText();

  function syncMultiplayerViewportHeight(){
    const h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight||document.documentElement.clientHeight;
    if(Number.isFinite(h)&&h>0){
      document.documentElement.style.setProperty('--sanctum-viewport-height',Math.round(h)+'px');
    }
  }
  syncMultiplayerViewportHeight();
  window.addEventListener('resize',syncMultiplayerViewportHeight,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(syncMultiplayerViewportHeight,80),{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',syncMultiplayerViewportHeight,{passive:true});
    window.visualViewport.addEventListener('scroll',syncMultiplayerViewportHeight,{passive:true});
  }

  function loadSession(){
    try{
      const raw=localStorage.getItem(SESSION_KEY);
      session=raw?JSON.parse(raw):null;
    }catch(_){session=null}
  }
  function saveSession(){
    try{
      if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    }catch(_){}
  }
  function playerName(){
    const first=document.getElementById('pname0');
    return (first&&first.value&&first.value.trim())||'Priest';
  }
  function status(text,bad=false){
    if(!panel)return;
    const el=panel.querySelector('.mpStatus');
    if(el){
      el.textContent=text;
      el.style.border='1px solid '+(bad?'#813c3c':'#4e5e3e');
    }
  }
  function escapeHtml(v){
    return String(v??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function groupVoteCategory(meta={}){
    const s=((meta.title||'')+' '+(meta.eyebrow||'')).toLowerCase();
    return /route|passage|descent|boss gate/.test(s)?'passage':'reward';
  }

  function inferGroupVoteActionKey(meta={},choice={},index=0){
    const title=String(choice?.title||choice?.voteCard||'').trim();
    const category=groupVoteCategory(meta);

    if(choice?.voteCard)return 'draft:'+String(choice.voteCard);

    const exact={
      'Draft a Priest Card':'reward:draft',
      'Recover the Altar':'reward:recover',
      'Claim a Relic':'reward:relic',
      'Blood Cache':'reward:blood',
      'Confession':'sanctuary:confession',
      'Study the Reliquary':'sanctuary:draft',
      'Take Sacrament':'sanctuary:sacrament',
      'Reliquary':'boss_reward:reliquary',
      'Purification':'boss_reward:purification',
      'Arsenal of Faith':'boss_reward:arsenal',
      'Standard Battle':'route:battle',
      'Elite Procession':'route:elite',
      'Hellgate Swarm':'route:swarm',
      'Ruined Sanctuary':'route:sanctuary'
    };
    if(category==='passage'&&/^Enter Boss Floor\s+\d+/i.test(title))return 'route:boss';
    return exact[title]||'';
  }

  function serializeGroupVoteOption(choice,index,meta={}){
    return {
      index,
      title:String(choice?.title||choice?.voteCard||('Option '+(index+1))),
      desc:String(choice?.desc||''),
      reward:String(choice?.reward||''),
      icon:String(choice?.icon||'✦'),
      cls:String(choice?.cls||''),
      cardName:choice?.voteCard?String(choice.voteCard):'',
      empowered:choice?.voteEmpowered?String(choice.voteEmpowered):'',
      actionKey:inferGroupVoteActionKey(meta,choice,index)
    };
  }

  function reconstructGroupVoteAction(vote,opt,index){
    const title=String(opt?.title||'').trim();
    const key=String(opt?.actionKey||inferGroupVoteActionKey({
      title:vote?.title||'',
      eyebrow:vote?.eyebrow||''
    },opt,index)||'');

    if(key.startsWith('draft:')){
      const cardName=key.slice(6)||opt?.cardName||title;
      return ()=>{
        const i=typeof PRIEST!=='undefined'&&Array.isArray(PRIEST)
          ? PRIEST.findIndex(c=>c&&c.n===cardName)
          : -1;
        const c=i>=0?PRIEST[i]:null;
        if(!c)throw new Error('Could not rebuild drafted Priest card: '+cardName);
        const card={...c,id:`rogue-${i}-${uid()}`};
        S.priestDeck=shuffle([...(S.priestDeck||[]),card]);
        log(`${c.n} is added to the run deck and shuffled into the remaining random draws.`,'good');
        rogueState().lastReward=`Drafted ${c.n}`;
        render();
        rogueliteOpenRoute();
      };
    }

    const actions={
      'reward:draft':()=>rogueliteOpenDraft(rogueliteOpenRoute),
      'reward:recover':()=>{restoreAltarLogged(6,'Encounter recovery');addMana(2);rogueliteOpenRoute()},
      'reward:relic':()=>{const rel=rogueSilentRelic('Elite room-clear reward');showGameStatus(rel?`Relic claimed: ${rel.n}`:'The Relic deck is empty.','good');rogueliteOpenRoute()},
      'reward:blood':()=>{rogueGiveBlood(2);rogueAddCinders(1,'Blood Cache');rogueliteOpenRoute()},
      'sanctuary:confession':()=>{restoreAltarLogged(8,'Sanctuary Confession');rogueCleanseAll();log('All room Corruption is cleansed.','good');rogueliteOpenRoute()},
      'sanctuary:draft':()=>rogueliteOpenDraft(rogueliteOpenRoute),
      'sanctuary:sacrament':()=>{rogueGiveBlood(3);S.mana=Math.max(sharedManaRoundValue(),S.mana);render();rogueliteOpenRoute()},
      'boss_reward:reliquary':()=>{rogueSilentRelic('Boss room-clear reward');restoreAltarLogged(4,'Boss reward');rogueliteOpenRoute()},
      'boss_reward:purification':()=>{restoreAltarLogged(10,'Boss purification');rogueCleanseAll();render();rogueliteOpenRoute()},
      'boss_reward:arsenal':()=>{rogueGiveBlood(2);rogueliteOpenDraft(rogueliteOpenRoute)},
      'route:battle':()=>{const r=rogueState();r.floor=(Number(r.floor)||1)+1;rogueliteEnterCurrentFloor('battle')},
      'route:elite':()=>{const r=rogueState();r.floor=(Number(r.floor)||1)+1;rogueliteEnterCurrentFloor('elite')},
      'route:swarm':()=>{const r=rogueState();r.floor=(Number(r.floor)||1)+1;rogueliteEnterCurrentFloor('swarm')},
      'route:sanctuary':()=>{const r=rogueState();r.floor=(Number(r.floor)||1)+1;rogueliteEnterCurrentFloor('sanctuary')},
      'route:boss':()=>{const r=rogueState();r.floor=(Number(r.floor)||1)+1;rogueliteEnterCurrentFloor('boss')}
    };
    return actions[key]||null;
  }

  function groupVoteActions(vote){
    if(!vote)return null;
    const id=String(vote.id||'');
    let actions=voteActionRegistry.get(id);
    if(actions&&actions.length)return actions;

    actions=(vote.options||[]).map((opt,index)=>reconstructGroupVoteAction(vote,opt,index));
    if(actions.some(fn=>typeof fn==='function')){
      voteActionRegistry.set(id,actions);
      return actions;
    }
    return null;
  }

  function closeGroupVoteModal(){
    const modal=document.getElementById('rogueChoiceModal');
    if(!modal||modal.dataset.mpGroupVote!=='1')return;
    modal.classList.add('hidden');
    delete modal.dataset.mpGroupVote;
  }

  function transitionChoiceOwnerSeat(choice){
    if(!session||!S?.started)return null;

    // Backward compatibility for rooms that were already stuck under the old
    // Player-1-only build: the active authoritative Priest is the Priest who
    // cleared the passage, so recover ownership from S.current.
    if(choice?.mode==='player1'){
      return Number(S.current||0)+1;
    }

    const saved=Number(choice?.resolverSeat);
    if(Number.isInteger(saved)&&saved>=1&&saved<=Number(S.players?.length||4)){
      return saved;
    }
    return Number(S.current||0)+1;
  }

  async function waitForChoicePublishIdle(maxMs=4000){
    const started=Date.now();
    while(publishBusy){
      if(Date.now()-started>=maxMs)return false;
      await new Promise(resolve=>setTimeout(resolve,40));
    }
    return true;
  }

  async function ensureChoiceAuthority(choice,ownerSeat){
    if(!session||!S?.started||!choice||choice.open!==true)return false;
    ownerSeat=Number(ownerSeat);
    if(!Number.isInteger(ownerSeat)||ownerSeat<1||ownerSeat>Number(S.players?.length||4))return false;

    if(Number(authoritativeActiveSeat)===ownerSeat&&Number(S.current||0)+1===ownerSeat){
      return true;
    }

    // Only the device that currently owns server authority may perform the
    // handoff. The server validates this write against the OLD active seat;
    // the synchronized state then makes the saved choice owner authoritative.
    if(choiceAuthorityRepairBusy||!canWriteAuthoritativeTurn())return false;

    choiceAuthorityRepairBusy=true;
    const oldCurrent=Number(S.current||0);
    try{
      if(!(await waitForChoicePublishIdle())){
        try{await refreshRoom(true)}catch(_){}
        return false;
      }
      S.current=ownerSeat-1;
      const ok=await pushSharedState('choice_authority_handoff',{
        choice_id:String(choice.id||''),
        category:String(choice.category||'reward'),
        from_seat:Number(authoritativeActiveSeat||oldCurrent+1),
        to_seat:ownerSeat
      });
      if(!ok){
        S.current=oldCurrent;
        try{await refreshRoom(true)}catch(_){}
        return false;
      }

      authoritativeActiveSeat=ownerSeat;
      try{render()}catch(_){}
      return true;
    }catch(err){
      S.current=oldCurrent;
      console.error('Could not repair multiplayer choice authority',err);
      try{await refreshRoom(true)}catch(_){}
      return false;
    }finally{
      choiceAuthorityRepairBusy=false;
    }
  }

  function renderGroupVoteFromState(){
    const choice=S?.multiplayerVote;
    const modal=document.getElementById('rogueChoiceModal');

    // Group voting is disabled. The Priest who cleared the passage owns the
    // entire reward -> draft -> next-passage choice chain.

    if(!session||!S?.started||!choice||choice.open!==true){
      closeGroupVoteModal();
      return;
    }
    if(!modal)return;

    try{clearTurnTimerInterval()}catch(_){}

    const ownerSeat=transitionChoiceOwnerSeat(choice);

    // A synchronized next choice is a fresh interaction. Never inherit a stale
    // resolving flag from the choice that created it.
    if(!resolvingVoteIds.has(String(choice.id))&&voteOpeningIds.has(String(choice.id))===false){
      resolvingVoteTransition=false;
    }

    // Choice ownership is stronger than ordinary turn ownership. If a floor
    // transition moved S.current away from the stored chooser (the source of
    // the Priest Draft / Sanctuary freezes), the currently authoritative
    // device atomically hands authority back to the chooser before any button
    // is allowed to resolve.
    if(Number(authoritativeActiveSeat)!==Number(ownerSeat)||Number(S.current||0)+1!==Number(ownerSeat)){
      closeGroupVoteModal();
      if(canWriteAuthoritativeTurn()&&!choiceAuthorityRepairBusy){
        ensureChoiceAuthority(choice,ownerSeat);
      }
      return;
    }

    // Every other device stays on the synchronized board. It receives the
    // resulting reward / next passage through the normal shared-state update.
    if(Number(session.seat)!==Number(ownerSeat)){
      closeGroupVoteModal();
      return;
    }

    modal.dataset.mpGroupVote='1';

    const kind=choice.category==='passage'?'PASSAGE CHOICE':'REWARD CHOICE';
    const eyebrow=document.getElementById('rogueChoiceEyebrow');
    const title=document.getElementById('rogueChoiceTitle');
    const textEl=document.getElementById('rogueChoiceText');
    const grid=document.getElementById('rogueChoiceGrid');

    if(eyebrow)eyebrow.textContent='PLAYER '+ownerSeat+' • '+kind+' • '+(choice.eyebrow||'Group Choice');
    if(title)title.textContent=choice.title||'Choose for the Group';
    if(textEl){
      textEl.innerHTML=(choice.text||'')+
        '<div class="mpGroupVoteIntro"><b>You cleared the passage, so you choose for the group.</b> The selected reward and passage are synchronized to every player.</div>';
    }

    if(grid){
      grid.innerHTML='';
      (choice.options||[]).forEach((opt,i)=>{
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='rogueChoice mpGroupVoteOption '+(opt.cls||'');
        btn.dataset.mpVoteOption=String(i);
        btn.disabled=resolvingVoteTransition||resolvingVoteIds.has(String(choice.id));

        if(opt.cardName){
          const art=(typeof PRIEST_CARD_ARTS!=='undefined'&&PRIEST_CARD_ARTS[opt.cardName])||'';
          const artHtml=art?'<div class="mpVoteCardArt"></div>':'';
          btn.innerHTML=artHtml+
            '<h3>'+escapeHtml(opt.title)+'</h3>'+
            '<p>'+escapeHtml(opt.desc)+'</p>'+
            (opt.empowered?'<small><b>Empowered:</b> '+escapeHtml(opt.empowered)+'</small>':'')+
            (opt.reward?'<span class="nodeReward">'+escapeHtml(opt.reward)+'</span>':'');
          const artEl=btn.querySelector('.mpVoteCardArt');
          if(artEl)artEl.style.backgroundImage='url("'+String(art).replace(/"/g,'%22')+'")';
        }else{
          btn.innerHTML=
            '<div class="nodeIcon">'+escapeHtml(opt.icon||'✦')+'</div>'+
            '<h3>'+escapeHtml(opt.title)+'</h3>'+
            '<p>'+escapeHtml(opt.desc)+'</p>'+
            (opt.reward?'<span class="nodeReward">'+escapeHtml(opt.reward)+'</span>':'');
        }

        btn.onclick=()=>resolveTransitionOwnerChoice(i);
        grid.appendChild(btn);
      });
    }

    modal.classList.remove('hidden');
    setTimeout(()=>grid?.querySelector('button:not(:disabled)')?.focus(),0);
  }

  async function resolveTransitionOwnerChoice(optionIndex){
    const choice=S?.multiplayerVote;
    if(!session||!choice||choice.open!==true)return;

    const ownerSeat=transitionChoiceOwnerSeat(choice);
    if(Number(session.seat)!==Number(ownerSeat))return;

    const id=String(choice.id||'');
    if(!id||resolvingVoteIds.has(id)||resolvingVoteTransition)return;

    // The killer is already the authoritative active Priest at passage clear.
    // No handoff, vote RPC, or database permission change is required.
    if(!canWriteAuthoritativeTurn()){
      status('Synchronizing the passage-clear player…');
      try{await refreshRoom(true)}catch(_){}
      return;
    }

    const index=Number(optionIndex);
    const option=choice.options?.[index];
    const actions=groupVoteActions(choice);
    const fn=actions?.[index];
    if(!option||typeof fn!=='function'){
      status('This choice could not be rebuilt. Reloading the newest shared game…',true);
      try{await refreshRoom(true)}catch(_){}
      return;
    }

    resolvingVoteIds.add(id);
    resolvingVoteTransition=true;

    if(publishTimer){
      clearTimeout(publishTimer);
      publishTimer=0;
    }

    try{
      try{
        log(
          'PASSAGE CLEAR CHOICE — Player '+ownerSeat+' selects '+
          (option.title||('Option '+(index+1)))+' for the group.',
          'good'
        );
      }catch(_){}

      S.multiplayerVote=null;
      voteActionRegistry.delete(id);
        closeGroupVoteModal();

      // Apply the selected action to the shared state.
      const result=fn();
      if(result&&typeof result.then==='function')await result;

      // Some choices intentionally open their follow-up on a short timer
      // (notably entering a Sanctuary). Give those callbacks a deterministic
      // settle window so the next choice is captured in this same commit
      // instead of appearing locally after the server state has already moved.
      await new Promise(resolve=>setTimeout(resolve,180));

      const nextChoice=S?.multiplayerVote&&S.multiplayerVote.open===true
        ? S.multiplayerVote
        : null;
      const nextChoiceId=nextChoice?String(nextChoice.id):'';

      if(nextChoice){
        nextChoice.mode='passage_clear_owner';

        // Reward -> Priest Draft -> Passage stays with the Priest who cleared
        // the prior encounter. Once a Passage itself has been selected, any
        // new in-passage choice (for example Sanctuary) belongs to the active
        // Priest created by that floor transition.
        if(String(choice.category||'reward')!=='passage'){
          nextChoice.resolverSeat=ownerSeat;
        }else{
          const newOwner=Number(nextChoice.resolverSeat)||Number(S.current||0)+1;
          nextChoice.resolverSeat=newOwner;
        }

        // Guarantee the server's active-seat authority and the visible chooser
        // can never disagree in the state we are about to publish.
        S.current=Math.max(0,Number(nextChoice.resolverSeat)-1);
      }

      if(!(await waitForChoicePublishIdle())){
        status('Waiting for the shared game to finish synchronizing…');
        try{await refreshRoom(true)}catch(_){}
        return;
      }

      const committed=await pushSharedState('passage_clear_choice_resolved',{
        choice_id:id,
        chooser_seat:ownerSeat,
        selected_index:index,
        selected_title:String(option.title||('Option '+(index+1))),
        category:String(choice.category||'reward'),
        next_choice_id:nextChoiceId||null,
        next_category:nextChoice?.category||null
      });

      if(!committed){
        status('The choice could not synchronize. Reloading the shared game…',true);
        try{await refreshRoom(true)}catch(_){}
        return;
      }

      // The next Draft / Passage must not be rendered while the previous
      // choice is still flagged as resolving. Otherwise every new option is
      // created disabled and remains frozen even though Supabase is correct.
      resolvingVoteTransition=false;
      resolvingVoteIds.delete(id);

      if(nextChoiceId){
        voteOpeningIds.delete(nextChoiceId);
        renderGroupVoteFromState();
      }else{
        closeGroupVoteModal();
      }
    }catch(err){
      console.error('Could not resolve passage-clear choice',err);
      status('The passage choice could not complete. Reloading the shared game…',true);
      try{await refreshRoom(true)}catch(_){}
    }finally{
      // Idempotent cleanup also covers failures before the successful commit.
      resolvingVoteTransition=false;
      resolvingVoteIds.delete(id);
    }
  }

  window.__sanctumMultiplayerGroupChoice=function(meta,choices){
    if(!session||!S?.started||!Array.isArray(S.players)||S.players.length<2)return false;
    if(!Array.isArray(choices)||!choices.length)return false;

    // Only the authoritative active Priest creates the choice. At an encounter
    // clear, this is the Priest who defeated the final required Demon.
    if(!canWriteAuthoritativeTurn())return true;

    const ownerSeat=Number(S.current||0)+1;
    const choiceId='clear-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    const choice={
      id:choiceId,
      open:true,
      mode:'passage_clear_owner',
      category:groupVoteCategory(meta),
      eyebrow:String(meta?.eyebrow||''),
      title:String(meta?.title||'Choose for the Group'),
      text:String(meta?.text||''),
      resolverSeat:ownerSeat,
      options:choices.map((item,index)=>serializeGroupVoteOption(item,index,meta))
    };

    // A newly opened choice must always be owned by the same seat that is
    // authoritative in the state being published.
    S.current=ownerSeat-1;
    S.multiplayerVote=choice;
    voteActionRegistry.set(choiceId,choices.map(c=>c.action));
    voteOpeningIds.add(choiceId);

    if(publishTimer){
      clearTimeout(publishTimer);
      publishTimer=0;
    }

    // A reward can synchronously open a Priest Draft or Passage choice. Keep
    // the same passage-clear owner and let the outer resolution commit carry
    // that new choice to everyone.
    if(resolvingVoteTransition){
      return true;
    }

    (async()=>{
      if(!(await waitForChoicePublishIdle())){
        status('Could not prepare the shared choice. Reloading the newest game…',true);
        try{await refreshRoom(true)}catch(_){}
        return;
      }
      const ok=await pushSharedState('passage_clear_choice_open',{
        choice_id:choiceId,
        category:choice.category,
        options:choice.options.length,
        chooser_seat:ownerSeat
      });
      voteOpeningIds.delete(choiceId);

      if(!ok){
        if(S?.multiplayerVote?.id===choiceId)S.multiplayerVote=null;
        voteActionRegistry.delete(choiceId);
        status('Could not open the passage-clear choice. Reloading the shared game…',true);
        closeGroupVoteModal();
        try{await refreshRoom(true)}catch(_){}
        return;
      }

      renderGroupVoteFromState();
    })();

    return true;
  };

  function stopChoiceRecoveryWatchdog(){
    if(choiceRecoveryTimer){
      clearInterval(choiceRecoveryTimer);
      choiceRecoveryTimer=0;
    }
  }

  function startChoiceRecoveryWatchdog(){
    if(choiceRecoveryTimer)return;
    choiceRecoveryTimer=setInterval(()=>{
      if(!session||sessionEnded||!S?.started)return;
      const choice=S?.multiplayerVote;
      if(!choice||choice.open!==true)return;

      // Re-render/retry authority repair for any choice that has remained open.
      // This is intentionally idempotent: only the saved owner can see buttons,
      // and only the currently authoritative device can perform a repair.
      try{renderGroupVoteFromState()}catch(err){
        console.warn('Choice recovery watchdog refresh failed',err);
      }
    },1000);
  }

  startChoiceRecoveryWatchdog();

  const MP_ROOM_NAMES=['Gateway','Hall','Chapel','Crypt'];

  function ensureDemonReader(){
    let modal=document.getElementById('mpDemonReader');
    if(modal)return modal;
    modal=document.createElement('dialog');
    modal.id='mpDemonReader';
    modal.className='mpDemonReader';
    modal.setAttribute('aria-label','Demons in room');
    modal.innerHTML='<div class="mpDemonReaderCard">'+
      '<button class="mpDemonReaderClose" type="button">Close</button>'+
      '<div class="mpDemonReaderArt"><img alt=""></div>'+
      '<div class="mpDemonReaderBody">'+
        '<div class="mpDemonRoomHeader"></div>'+
        '<div class="mpDemonReaderDetails"></div>'+
        '<div class="mpDemonRoomList"></div>'+
      '</div>'+
    '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.mpDemonReaderClose').onclick=e=>{e.preventDefault();e.stopPropagation();closeDemonReader()};
    modal.addEventListener('click',e=>{if(e.target===modal)closeDemonReader()});
    modal.addEventListener('cancel',e=>{e.preventDefault();closeDemonReader()});
    return modal;
  }

  function closeDemonReader(){
    const modal=document.getElementById('mpDemonReader');
    if(!modal)return;
    try{if(modal.open)modal.close()}catch(_){}
  }

  function findBoardDemonLocation(id){
    for(let roomIndex=0;roomIndex<(S?.rooms||[]).length;roomIndex++){
      const room=S.rooms[roomIndex]||[];
      const demonIndex=room.findIndex(d=>String(d.id)===String(id));
      if(demonIndex>=0)return {d:room[demonIndex],roomIndex,demonIndex,room};
    }
    return null;
  }

  function renderRoomDemonDetails(modal,d,roomIndex){
    if(!modal||!d)return;
    modal.dataset.readerKind='demon';
    const img=modal.querySelector('.mpDemonReaderArt img');
    const header=modal.querySelector('.mpDemonRoomHeader');
    const details=modal.querySelector('.mpDemonReaderDetails');
    const list=modal.querySelector('.mpDemonRoomList');
    const room=(S?.rooms?.[roomIndex]||[]);
    const roomName=MP_ROOM_NAMES[roomIndex]||('Room '+(roomIndex+1));
    const name=typeof demonName==='function'?demonName(d):(d.greater?(d.g||d.n):d.n);
    const hp=Number(d.cur||0);
    const maxHp=typeof demonMaxHP==='function'?demonMaxHP(d):(d.greater?(d.ghp||d.hp):d.hp);
    const blood=typeof demonBlood==='function'?demonBlood(d):(d.b||0);
    const attack=typeof demonAttack==='function'?demonAttack(d):(d.a||0);
    const ability=typeof boardDemonAbilityText==='function'?boardDemonAbilityText(d):(d.ability||'No printed ability.');
    const art=typeof demonArt==='function'?demonArt(d):(d.gart||d.art||'');

    img.src=art;
    img.alt=name;
    header.innerHTML='<b>'+escapeHtml(roomName)+'</b><span>'+room.length+' Demon'+(room.length===1?'':'s')+' in this room</span>';
    details.innerHTML=
      '<div class="mpDemonReaderType">'+escapeHtml((d.family||'Demon')+(d.greater?' • Greater Demon':''))+'</div>'+
      '<div class="mpDemonReaderName">'+escapeHtml(name)+'</div>'+
      '<div class="mpDemonReaderStats">'+
        '<span class="hp">HP '+escapeHtml(hp)+' / '+escapeHtml(maxHp)+'</span>'+
        '<span class="blood">BLD '+escapeHtml(blood)+'</span>'+
        '<span class="attack">ATK '+escapeHtml(attack)+'</span>'+
      '</div>'+
      '<div class="mpDemonReaderAbility">'+escapeHtml(ability)+'</div>';

    list.innerHTML='';
    if(!room.length){
      list.innerHTML='<div class="mpDemonRoomEmpty">There are no Demons in this room.</div>';
      return;
    }

    room.forEach(other=>{
      const otherName=typeof demonName==='function'?demonName(other):(other.greater?(other.g||other.n):other.n);
      const otherArt=typeof demonArt==='function'?demonArt(other):(other.gart||other.art||'');
      const otherHp=Number(other.cur||0);
      const otherBlood=typeof demonBlood==='function'?demonBlood(other):(other.b||0);
      const otherAttack=typeof demonAttack==='function'?demonAttack(other):(other.a||0);
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='mpDemonRoomOption'+(String(other.id)===String(d.id)?' active':'');
      btn.setAttribute('aria-label','View '+otherName);
      btn.innerHTML=
        '<div class="mpDemonRoomOptionArt"><img alt="'+escapeHtml(otherName)+'"></div>'+
        '<div class="mpDemonRoomOptionName">'+escapeHtml(otherName)+'</div>'+
        '<div class="mpDemonRoomOptionStats">'+
          '<span class="hp">HP '+escapeHtml(otherHp)+'</span>'+
          '<span class="blood">BLD '+escapeHtml(otherBlood)+'</span>'+
          '<span class="attack">ATK '+escapeHtml(otherAttack)+'</span>'+
        '</div>';
      const thumb=btn.querySelector('img');
      if(thumb)thumb.src=otherArt;
      btn.onclick=e=>{
        e.preventDefault();
        e.stopPropagation();
        try{selectedDemonId=other.id}catch(_){}
        renderRoomDemonDetails(modal,other,roomIndex);
      };
      list.appendChild(btn);
    });
  }

  function openDemonReader(d,roomIndex=null){
    if(!d)return;
    const loc=roomIndex==null?findBoardDemonLocation(d.id):{d,roomIndex};
    if(!loc)return;
    const modal=ensureDemonReader();
    renderRoomDemonDetails(modal,d,loc.roomIndex);
    try{
      if(!modal.open)modal.showModal();
    }catch(_){
      modal.setAttribute('open','');
    }
    setTimeout(()=>modal.querySelector('.mpDemonReaderClose')?.focus(),0);
  }

  window.__sanctumOpenDemonReader=function(id){
    const loc=findBoardDemonLocation(id);
    if(!loc)return false;
    try{selectedDemonId=loc.d.id}catch(_){}
    openDemonReader(loc.d,loc.roomIndex);
    return true;
  };

  let demonTapDelegateInstalled=false;
  function installDemonTapDelegate(){
    demonTapDelegateInstalled=true;
  }

  function wireDemonInspectors(){
    if(!session||!S||!S.started)return;
    installDemonTapDelegate();
    document.querySelectorAll('#boardSection [data-demon]').forEach(el=>{
      const btn=el.querySelector('[data-demon-open]');
      if(btn){
        btn.title='Tap to view all Demons in this room';
        btn.setAttribute('aria-label','View all Demons in this room, starting with '+(el.querySelector('.name')?.textContent||'Demon'));
      }
    });
  }


  function renderBossReaderDetails(modal,b){
    if(!modal||!b)return;
    modal.dataset.readerKind='boss';
    modal.setAttribute('aria-label','Boss Demon details');

    const img=modal.querySelector('.mpDemonReaderArt img');
    const header=modal.querySelector('.mpDemonRoomHeader');
    const details=modal.querySelector('.mpDemonReaderDetails');
    const list=modal.querySelector('.mpDemonRoomList');
    const name=b.n||'Boss Demon';
    const hp=Math.max(0,Number(b.cur||0));
    const maxHp=Math.max(0,Number(b.hp||0));
    const blood=Math.max(0,Number(b.b||0));
    const drain=typeof bossDrainAmount==='function'?bossDrainAmount():blood;
    const rules=(b.rules||[]).filter(rule=>Array.isArray(rule)&&rule[0]!=='Boss Rule');
    const ruleHtml=rules.length
      ?'<div class="mpBossReaderRules">'+rules.map(rule=>
        '<div class="mpBossReaderRule"><b>'+escapeHtml(rule[0])+':</b> '+escapeHtml(rule[1]||'')+'</div>'
      ).join('')+'</div>'
      :'<div class="mpBossReaderRule">No additional printed ability.</div>';

    img.src=b.art||'';
    img.alt=name+' artwork';
    header.innerHTML='<b>Boss Room</b><span>Boss Demon</span>';
    details.innerHTML=
      '<div class="mpDemonReaderType">Boss Demon</div>'+
      '<div class="mpDemonReaderName">'+escapeHtml(name)+'</div>'+
      '<div class="mpDemonReaderStats">'+
        '<span class="hp">HP '+escapeHtml(hp)+' / '+escapeHtml(maxHp)+'</span>'+
        '<span class="blood">BLD '+escapeHtml(blood)+'</span>'+
      '</div>'+
      ruleHtml;
    list.innerHTML=
      '<div class="mpBossReaderMeta">'+
        'Boss Phase Altar Drain: '+escapeHtml(drain)+
        (drain!==blood?' (printed '+escapeHtml(blood)+')':'')+
        ' • Descent '+escapeHtml((S?.bossesDefeated||0)+1)+
        ' • '+escapeHtml(S?.bossesDefeated||0)+' defeated this run'+
      '</div>';
  }

  function openBossReader(){
    if(!S?.bossRevealed||!S?.boss)return false;
    const modal=ensureDemonReader();
    renderBossReaderDetails(modal,S.boss);
    try{
      if(!modal.open)modal.showModal();
    }catch(_){
      modal.setAttribute('open','');
    }
    setTimeout(()=>modal.querySelector('.mpDemonReaderClose')?.focus(),0);
    return true;
  }

  window.__sanctumOpenBossReader=openBossReader;

  function wireBossInspector(){
    if(!S||!S.started||!S.bossRevealed||!S.boss)return;
    const card=document.querySelector('#bossArea .bossCard');
    if(!card)return;
    card.classList.add('mpBossInspectable');
    let btn=card.querySelector('[data-boss-open]');
    if(btn)return;
    btn=document.createElement('button');
    btn.type='button';
    btn.className='mpBossTapTarget';
    btn.dataset.bossOpen='1';
    btn.title='Tap to view Boss Demon';
    btn.setAttribute('aria-label','Open '+(S.boss.n||'Boss Demon')+' details');
    let lastOpen=0;
    const open=e=>{
      if(e){e.preventDefault();e.stopPropagation();}
      const now=Date.now();
      if(now-lastOpen<350)return;
      lastOpen=now;
      openBossReader();
    };
    btn.onclick=open;
    btn.ontouchend=open;
    btn.onpointerup=open;
    card.appendChild(btn);
  }

  function stopHeartbeat(){
    if(heartbeatTimer){
      clearInterval(heartbeatTimer);
      heartbeatTimer=0;
    }
  }

  function lockEndedSession(reason='The host closed the game.'){
    if(sessionEnded)return;
    sessionEnded=true;
    stopHeartbeat();
    stopLobbyRosterPolling();
    stopChoiceRecoveryWatchdog();
    stopRosterSubscription();
    try{clearTurnTimerInterval()}catch(_){}
    document.body.classList.add('mpSessionEnded');
    document.body.classList.remove('mpWaitingTurn');

    document.querySelectorAll(
      '#handPanel button,#ritualPanel button,#boardSection button,#spawnBtn,#damageBtn,#killBtn,[data-adjust]'
    ).forEach(btn=>btn.disabled=true);

    const banner=ensureGameBanner();
    if(banner){
      banner.classList.remove('hidden','yourTurn','waiting');
      banner.classList.add('ended');
      banner.innerHTML='<b>ONLINE SESSION ENDED</b><span>'+escapeHtml(reason)+'</span>';
    }

    status(reason+' Start or join a new room to play again.',true);
    try{localStorage.removeItem(SESSION_KEY)}catch(_){}
    session=null;
    lastRosterSnapshot=null;
    authoritativeActiveSeat=null;
    lastAppliedVersion=-1;
    lastPublishedHash='';
  }

  async function heartbeat(){
    if(!session||heartbeatBusy||sessionEnded)return;
    heartbeatBusy=true;
    try{
      const sb=await ensureClient();
      const {data,error}=await sb.rpc('sanctum_heartbeat',{
        p_room_code:session.roomCode,
        p_player_token:session.playerToken
      });
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(!row||row.ok===false){
        const why=row&&row.room_status==='abandoned'
          ? 'The host closed the game. This multiplayer session has ended.'
          : 'This multiplayer session is no longer active.';
        lockEndedSession(why);
      }
    }catch(err){
      console.warn('Sanctum multiplayer heartbeat failed',err);
      /* A temporary network error does not immediately destroy the local session.
         The server-side stale-host check will decide whether the room is abandoned. */
    }finally{
      heartbeatBusy=false;
    }
  }

  function startHeartbeat(){
    stopHeartbeat();
    if(!session||sessionEnded)return;
    startChoiceRecoveryWatchdog();
    heartbeat();
    heartbeatTimer=setInterval(heartbeat,10000);
  }

  async function ensureClient(){
    if(client)return client;
    if(!window.supabase||!window.supabase.createClient){
      await new Promise((resolve,reject)=>{
        const prior=document.querySelector('script[data-sanctum-supabase]');
        if(prior){
          prior.addEventListener('load',resolve,{once:true});
          prior.addEventListener('error',reject,{once:true});
          return;
        }
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.async=true;
        s.dataset.sanctumSupabase='1';
        s.onload=resolve;
        s.onerror=()=>reject(new Error('Could not load online multiplayer service.'));
        document.head.appendChild(s);
      });
    }
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  async function fetchRoom(){
    if(!session?.gameId)return null;
    const sb=await ensureClient();
    const [g,p]=await Promise.all([
      sb.from('games')
        .select('id,room_code,status,state,state_version,max_players')
        .eq('id',session.gameId)
        .maybeSingle(),
      sb.from('players')
        .select('id,game_id,seat,display_name,character_key,is_host,connected,created_at,last_seen')
        .eq('game_id',session.gameId)
        .order('seat',{ascending:true})
    ]);
    if(g.error)throw g.error;
    if(p.error)throw p.error;
    if(!g.data)throw new Error('Online room no longer exists.');
    return {game:g.data,players:p.data||[]};
  }

  function renderRoster(snapshot){
    if(!panel)return;
    const roster=panel.querySelector('.mpRoster');
    if(!roster)return;
    if(!snapshot){roster.innerHTML='';return}
    const seats=[];
    for(let i=1;i<=snapshot.game.max_players;i++){
      const p=snapshot.players.find(x=>Number(x.seat)===i);
      if(p){
        const you=session&&p.id===session.playerId?' • YOU':'';
        const host=p.is_host?' • HOST':'';
        seats.push(`<div class="mpSeat"><b>Seat ${i}</b>${escapeHtml(p.display_name)}${host}${you}</div>`);
      }else{
        seats.push(`<div class="mpSeat empty"><b>Seat ${i}</b>Waiting…</div>`);
      }
    }
    roster.innerHTML=seats.join('');
  }


  function validSharedState(state){
    return !!(state&&typeof state==='object'&&state.started&&Array.isArray(state.players)&&Array.isArray(state.rooms));
  }

  function cleanStateForWire(){
    const state=JSON.parse(JSON.stringify(S,(key,value)=>
      (key==='art'||key==='gart')?undefined:value
    ));
    state.manualPaused=false;
    // Keep recent history for the pause-menu log without retransmitting an
    // ever-growing run log on every multiplayer state update.
    if(Array.isArray(state.log)&&state.log.length>60){
      state.log=state.log.slice(-60);
    }
    return state;
  }

  function stableStateHash(state){
    try{return JSON.stringify(state)}catch(_){return String(Date.now())}
  }

  function isMyTurn(){
    return !!(session&&S&&S.started&&Number(session.seat)===Number(S.current)+1);
  }

  function activeSeat(){
    return S&&S.started?Number(S.current||0)+1:null;
  }

  function canWriteAuthoritativeTurn(){
    return !!(session&&S&&S.started&&
      Number(session.seat)===Number(authoritativeActiveSeat));
  }

  function blockingGameplayModalOpen(){
    const ids=[
      'choiceModal','damageAmountModal','descendModal','relicModal',
      'desecrationModal','consecrateModal','crucifixModal',
      'rogueChoiceModal','rogueLegacyModal'
    ];
    return ids.some(id=>{
      const el=document.getElementById(id);
      return !!(el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none');
    });
  }

  function ensureGameBanner(){
    let el=document.getElementById('mpGameBanner');
    if(el)return el;
    const stats=document.getElementById('topStatusBar')||document.querySelector('.stats');
    if(!stats)return null;
    el=document.createElement('div');
    el.id='mpGameBanner';
    el.className='mpGameBanner hidden';
    stats.insertAdjacentElement('beforebegin',el);
    return el;
  }

  function setGameBanner(){
    const el=ensureGameBanner();
    if(!el)return;
    if(!session){
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const seat=activeSeat();
    const mine=isMyTurn();
    const started=!!(S&&S.started);
    el.classList.toggle('yourTurn',started&&mine);
    el.classList.toggle('waiting',started&&!mine);
    el.innerHTML=started
      ? `<b>ONLINE • ${escapeHtml(session.roomCode||'------')}</b><span>${mine?'YOUR TURN':`WAITING FOR PLAYER ${seat}`} • You are Player ${session.seat}</span>`
      : `<b>ONLINE • ${escapeHtml(session.roomCode||'------')}</b><span>Lobby • You are Player ${session.seat}</span>`;
  }

  function enforceTurnOwnership(){
    setGameBanner();
    if(!session||!S||!S.started){
      document.body.classList.remove('mpWaitingTurn');
      return;
    }

    const mine=isMyTurn();
    document.body.classList.toggle('mpWaitingTurn',!mine);

    const selectors=[
      '#handPanel button',
      '#ritualPanel button',
      '#boardSection [data-cons]',
      '#spawnBtn','#damageBtn','#killBtn',
      '[data-adjust]'
    ];
    const keepEnabled=new Set([
      'mobilePauseMenuBtn','priestPauseMenuBtn','rulesBtn','saveBtn','loadBtn','newGameBtn'
    ]);

    document.querySelectorAll(selectors.join(',')).forEach(btn=>{
      if(keepEnabled.has(btn.id))return;
      if(!mine){
        if(!btn.disabled)btn.dataset.mpDisabled='1';
        btn.disabled=true;
      }else if(btn.dataset.mpDisabled==='1'){
        btn.disabled=false;
        delete btn.dataset.mpDisabled;
      }
    });

    if(!mine){
      try{clearTurnTimerInterval()}catch(_){}
    }
  }

  function syncSetupFromRoster(snapshot){
    if(!snapshot||snapshot.game.status!=='lobby'||!snapshot.players.length)return;
    const count=document.getElementById('playerCount');
    if(!count)return;

    const existingChars=[];
    for(let i=0;i<4;i++)existingChars[i]=document.getElementById('pchar'+i)?.value||'';

    const wanted=Math.max(1,Math.min(4,snapshot.players.length));
    if(Number(count.value)!==wanted){
      count.value=String(wanted);
      try{setupPlayersUI()}catch(_){}
    }

    snapshot.players.forEach((p,i)=>{
      const name=document.getElementById('pname'+i);
      const char=document.getElementById('pchar'+i);
      if(name){
        name.value=p.display_name||('Player '+(i+1));
        name.readOnly=true;
      }
      if(char&&existingChars[i]&&[...char.options].some(o=>o.value===existingChars[i])){
        char.value=existingChars[i];
      }
    });

    const start=document.getElementById('startBtn');
    if(start&&session){
      if(!session.isHost){
        start.dataset.mpGuestLocked='1';
        start.disabled=true;
        start.title='Only the room host can start the online game.';
      }else if(start.dataset.mpGuestLocked==='1'){
        start.disabled=false;
        delete start.dataset.mpGuestLocked;
        start.removeAttribute('title');
      }
    }
  }

  function closeRemoteTransientUi(){
    try{
      if(choiceResolve){
        const resolve=choiceResolve;
        choiceResolve=null;
        resolve(null);
      }
    }catch(_){}
    [
      'choiceModal','damageAmountModal','consecrateModal',
      'crucifixModal','relicModal','descendModal'
    ].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  }

  async function applyRemoteGameRow(row,force=false){
    if(!session||!row)return;
    const version=Number(row.state_version||0);
    session.stateVersion=version;
    session.roomCode=row.room_code||session.roomCode;
    saveSession();

    if(!validSharedState(row.state)){
      lastAppliedVersion=Math.max(lastAppliedVersion,version);
      authoritativeActiveSeat=null;
      setGameBanner();
      return;
    }

    if(!force&&version<=lastAppliedVersion)return;

    applyingRemote=true;
    try{
      try{clearTurnTimerInterval()}catch(_){}
      closeRemoteTransientUi();
      S=JSON.parse(JSON.stringify(row.state));
      authoritativeActiveSeat=Number(S.current||0)+1;
      try{restoreStaticArtwork()}catch(_){}
      try{migratePriestBalance()}catch(_){}
      try{normalizeSanctumState()}catch(_){}
      selectedDemonId=null;
      try{crucifixDisplayQueue=[]}catch(_){}
      document.getElementById('setupModal')?.classList.add('hidden');

      lastAppliedVersion=version;
      lastPublishedHash=stableStateHash(cleanStateForWire());

      render();

      if(isMyTurn()){
        try{syncTurnTimerAfterLoad()}catch(_){
          try{startTurnTimer(S.turnTimerRemaining||60)}catch(__){}
        }
      }else{
        try{clearTurnTimerInterval()}catch(_){}
      }
      enforceTurnOwnership();
    }catch(err){
      console.error('Could not apply online Sanctum state',err);
      status('Online state arrived but could not be applied.',true);
    }finally{
      applyingRemote=false;
    }
  }

  async function pushSharedState(actionType='state_sync',payload={}){
    if(!session||!S||!S.started||applyingRemote)return false;
    if(actionType==='game_start'){
      if(!session.isHost)return false;
    }else if(!canWriteAuthoritativeTurn()){
      enforceTurnOwnership();
      return false;
    }
    const voteLifecycleCommit=
      actionType==='choice_authority_handoff'||
      actionType==='passage_clear_choice_open'||actionType==='passage_clear_choice_resolved';
    if(blockingGameplayModalOpen()&&!voteLifecycleCommit){
      schedulePublish(actionType,payload,250);
      return false;
    }
    if(publishBusy){
      publishQueued=true;
      return false;
    }

    const wire=cleanStateForWire();
    const hash=stableStateHash(wire);
    if(actionType==='state_sync'&&hash===lastPublishedHash)return true;

    publishBusy=true;
    try{
      const sb=await ensureClient();
      const actionId=(crypto&&crypto.randomUUID)?crypto.randomUUID():
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,ch=>{
          const v=Math.random()*16|0,n=ch==='x'?v:(v&3|8);return n.toString(16);
        });
      const {data,error}=await sb.rpc('update_sanctum_game_state',{
        p_room_code:session.roomCode,
        p_player_token:session.playerToken,
        p_expected_version:Number(session.stateVersion||0),
        p_state:wire,
        p_action_type:actionType,
        p_payload:payload||{},
        p_client_action_id:actionId
      });
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(!row)throw new Error('Online state update returned no result.');

      const serverVersion=Number(row.new_version||0);
      if(!row.accepted){
        status('Another device updated the room first. Reloading the newest board…',true);
        await refreshRoom(true);
        return false;
      }

      session.stateVersion=serverVersion;
      lastAppliedVersion=Math.max(lastAppliedVersion,serverVersion);
      authoritativeActiveSeat=Number(wire.current||0)+1;
      lastPublishedHash=hash;
      saveSession();
      setGameBanner();
      return true;
    }catch(err){
      console.error('Sanctum state publish failed',err);
      status(err.message||'Could not synchronize this action.',true);
      return false;
    }finally{
      publishBusy=false;
      if(publishQueued){
        publishQueued=false;
        schedulePublish('state_sync',{},180);
      }
    }
  }

  function schedulePublish(actionType='state_sync',payload={},delay=320){
    if(!session||!S||!S.started||applyingRemote||startingOnline||resolvingVoteTransition)return;
    clearTimeout(publishTimer);
    publishTimer=setTimeout(()=>pushSharedState(actionType,payload),delay);
  }

  function freshPriestShuffle(cards){
    const a=[...(cards||[])];
    const randomUnit=()=>{
      try{
        if(window.crypto&&crypto.getRandomValues){
          const u=new Uint32Array(1);
          crypto.getRandomValues(u);
          return u[0]/4294967296;
        }
      }catch(_){}
      return Math.random();
    };
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(randomUnit()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function randomizeOpeningPriestHands(){
    if(!S||!S.started||!Array.isArray(S.players)||!S.players.length)return false;
    if(!Array.isArray(S.priestDeck))S.priestDeck=[];

    // Preserve each player's intended opening hand size, including any
    // legitimate Legacy starting-hand bonus, while fully randomizing which
    // Priest cards occupy those slots.
    const handSizes=S.players.map(p=>Array.isArray(p.hand)?p.hand.length:0);
    const openingCards=[];
    S.players.forEach(p=>{
      if(Array.isArray(p.hand))openingCards.push(...p.hand);
      p.hand=[];
    });

    // Return opening cards before shuffling so online hands are drawn from the
    // complete expanded deck rather than only the original base set.
    S.priestDeck=freshPriestShuffle([...(S.priestDeck||[]),...openingCards]);

    S.players.forEach((p,seat)=>{
      const count=Math.max(0,handSizes[seat]||0);
      for(let n=0;n<count&&S.priestDeck.length;n++){
        p.hand.push(S.priestDeck.pop());
      }
    });

    S.priestOpeningHandsRandomized=true;
    S.priestOpeningShuffleNonce=(Number(S.priestOpeningShuffleNonce)||0)+1;
    const total=(S.priestDeck?.length||0)+S.players.reduce((sum,p)=>sum+(p.hand?.length||0),0);
    log('Priest opening hands randomized from the full '+total+'-card run deck.','good');
    return true;
  }
  function expandMultiplayerPriestStartingDeck(){
    if(!session||!S||!S.started||S.multiplayerPriestDeckExpanded)return;
    if(!Array.isArray(S.players)||!S.players.length||!Array.isArray(PRIEST)||!PRIEST.length)return;

    const playerCount=S.players.length;
    const makeCard=(def,tag)=>({
      ...def,
      id:`mp-priest-${tag}-${uid()}`,
      empowered:false,
      empowerPaid:false
    });
    const extras=[];

    // The base game already created one complete set of every Priest card.
    // Add one more complete set for each additional player so every player's
    // contribution contains one of every card.
    for(let seat=1;seat<playerCount;seat++){
      PRIEST.forEach((def,i)=>extras.push(makeCard(def,`set-${seat+1}-${i}`)));
    }

    // Every player also contributes 15 independently randomized duplicate cards.
    for(let n=0;n<15*playerCount;n++){
      const def=PRIEST[Math.floor(Math.random()*PRIEST.length)];
      extras.push(makeCard(def,`random-${n}`));
    }

    S.priestDeck=shuffle([...(S.priestDeck||[]),...extras]);
    S.multiplayerPriestDeckExpanded=true;
    S.multiplayerPriestCardsPerPlayer=PRIEST.length+15;
    S.multiplayerPriestStartingTotal=playerCount*(PRIEST.length+15);

    log(
      `ONLINE PRIEST DECK — ${playerCount} player${playerCount===1?'':'s'}: ${PRIEST.length} unique Priest cards + 15 random duplicates per player contribution (${S.multiplayerPriestStartingTotal} total starting cards before opening draws).`,
      'good'
    );
  }

  function installStateSyncHooks(){
    if(hooksInstalled)return;
    hooksInstalled=true;

    /* In online play every device owns one Priest seat. The shared board still
       advances with S.current, but the Priest/hand panel always renders the
       local player's Priest and cards. */
    if(typeof renderPlayer==='function'){
      const baseRenderPlayer=renderPlayer;
      renderPlayer=function(){
        if(!session||!S||!S.started||!Array.isArray(S.players)){
          return baseRenderPlayer.apply(this,arguments);
        }

        const localIndex=Math.max(0,Math.min(S.players.length-1,Number(session.seat||1)-1));
        if(!S.players[localIndex]){
          return baseRenderPlayer.apply(this,arguments);
        }

        const authoritativeCurrent=S.current;
        S.current=localIndex;
        try{
          const out=baseRenderPlayer.apply(this,arguments);

          const handPanel=document.getElementById('handPanel');
          if(handPanel){
            handPanel.dataset.multiplayerSeat=String(session.seat||localIndex+1);
            handPanel.classList.add('mpOwnHand');
          }

          const handContent=document.getElementById('handContent');
          if(handContent&&!handContent.querySelector('.mpOwnHandLabel')){
            const label=document.createElement('div');
            label.className='mpOwnHandLabel';
            const p=S.players[localIndex];
            label.innerHTML=`<b>YOUR HAND</b><span>Player ${localIndex+1} • ${escapeHtml(p.name||('Player '+(localIndex+1)))}</span>`;
            handContent.prepend(label);
          }

          return out;
        }finally{
          S.current=authoritativeCurrent;
        }
      };
      try{window.renderPlayer=renderPlayer}catch(_){}
    }

    if(typeof render==='function'){
      const baseRender=render;
      render=function(){
        applyMonkFirstRitualBalanceText();
        const out=baseRender.apply(this,arguments);
        try{wireDemonInspectors()}catch(_){}
        try{wireBossInspector()}catch(_){}
        try{enforceTurnOwnership()}catch(_){}
        try{renderGroupVoteFromState()}catch(_){}
        if(session&&S&&S.started&&!applyingRemote&&!startingOnline&&!resolvingVoteTransition){
          schedulePublish('state_sync',{},360);
        }
        return out;
      };
      try{window.render=render}catch(_){}
    }

    if(typeof startGame==='function'){
      const baseStart=startGame;
      startGame=function(){
        if(session&&!session.isHost){
          status('Only the room host can start an online game.',true);
          return false;
        }
        if(session&&lastRosterSnapshot)syncSetupFromRoster(lastRosterSnapshot);
        startingOnline=!!session;
        let ok=false;
        try{
          ok=baseStart.apply(this,arguments);
          if(ok&&S&&Array.isArray(S.players)){
            if(session)expandMultiplayerPriestStartingDeck();
            randomizeOpeningPriestHands();
            if(session){
              S.mana=typeof sharedManaRoundValue==='function'
                ? sharedManaRoundValue()
                : (S.players.length>=4?35:S.players.length===3?20:S.players.length===2?15:10);
            }
            render();
          }
        }finally{
          startingOnline=false;
        }
        if(ok&&session){
          lastPublishedHash='';
          schedulePublish('game_start',{players:lastRosterSnapshot?.players?.length||S.players.length},30);
        }
        return ok;
      };
      try{window.startGame=startGame}catch(_){}
    }

    setGameBanner();
  }

  function stopLobbyRosterPolling(){
    if(lobbyRosterPollTimer){
      clearInterval(lobbyRosterPollTimer);
      lobbyRosterPollTimer=0;
    }
    lobbyRosterRefreshBusy=false;
  }

  async function pollLobbyRoster(){
    if(!session||sessionEnded||lobbyRosterRefreshBusy)return;
    if(lastRosterSnapshot?.game?.status&&lastRosterSnapshot.game.status!=='lobby'){
      stopLobbyRosterPolling();
      return;
    }
    lobbyRosterRefreshBusy=true;
    try{
      await refreshRoom(false);
    }catch(err){
      console.warn('Lobby roster fallback refresh failed',err);
    }finally{
      lobbyRosterRefreshBusy=false;
    }
  }

  function startLobbyRosterPolling(){
    if(!session||sessionEnded||S?.started||lastRosterSnapshot?.game?.status==='playing'){
      stopLobbyRosterPolling();
      return;
    }
    if(lobbyRosterPollTimer)return;
    lobbyRosterPollTimer=setInterval(pollLobbyRoster,1200);
  }

  async function stopRosterSubscription(){
    if(client&&rosterChannel){
      try{await client.removeChannel(rosterChannel)}catch(_){}
    }
    rosterChannel=null;
  }

  async function startRosterSubscription(){
    if(!session?.gameId||sessionEnded)return;
    if(S?.started||lastRosterSnapshot?.game?.status==='playing'){
      await stopRosterSubscription();
      return;
    }
    if(rosterChannel)return;
    const sb=await ensureClient();
    rosterChannel=sb.channel('sanctum-roster-'+session.gameId)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'players',
        filter:'game_id=eq.'+session.gameId
      },()=>{
        refreshRoom(false).catch(err=>console.warn('Roster realtime refresh failed',err));
      })
      .subscribe(state=>{
        if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){
          console.warn('Roster realtime unavailable; lobby polling remains active.');
          startLobbyRosterPolling();
        }
      });
    startLobbyRosterPolling();
  }

  async function refreshRoom(forceState=false){
    if(!session)return;
    try{
      const snap=await fetchRoom();
      lastRosterSnapshot=snap;
      session.roomCode=snap.game.room_code;
      if(snap.game.status==='abandoned'||snap.game.status==='finished'){
        lockEndedSession(
          snap.game.status==='abandoned'
            ? 'The host closed the game. This multiplayer session has ended.'
            : 'This multiplayer session has ended.'
        );
        return;
      }
      saveSession();
      status(`Connected to room ${snap.game.room_code} • ${snap.players.length}/${snap.game.max_players} players • ${snap.game.status}`);
      document.body.classList.remove('mpSessionEnded');
    const code=panel?.querySelector('.mpRoomCode');
      if(code)code.textContent=snap.game.room_code;
      renderRoster(snap);
      syncSetupFromRoster(snap);
      panel?.classList.add('connected');
      if(snap.game.status==='lobby'){
        startRosterSubscription().catch(err=>console.warn('Roster subscription failed',err));
        startLobbyRosterPolling();
      }else{
        stopLobbyRosterPolling();
        stopRosterSubscription();
      }
      await applyRemoteGameRow(snap.game,forceState||lastAppliedVersion<0);
      enforceTurnOwnership();
    }catch(err){
      console.error('Sanctum multiplayer refresh failed',err);
      status(err.message||'Could not refresh online room.',true);
    }
  }

  async function subscribe(){
    if(!session?.gameId)return;
    const sb=await ensureClient();
    if(channel){try{await sb.removeChannel(channel)}catch(_){}}
    channel=sb.channel('sanctum-room-'+session.gameId)
      .on('postgres_changes',{
        event:'UPDATE',schema:'public',table:'games',
        filter:'id=eq.'+session.gameId
      },payload=>{
        const row=payload&&payload.new;
        if(row){
          if(row.status==='abandoned'||row.status==='finished'){
            lockEndedSession(
              row.status==='abandoned'
                ? 'The host closed the game. This multiplayer session has ended.'
                : 'This multiplayer session has ended.'
            );
            return;
          }
          status(`Connected to room ${row.room_code||session.roomCode} • live game sync`);
          if(row.status==='lobby'){
            refreshRoom(false).catch(err=>console.error('Lobby room refresh failed',err));
            return;
          }
          stopLobbyRosterPolling();
          if(row.status==='playing')stopRosterSubscription();
          applyRemoteGameRow(row).catch(err=>console.error(err));
        }else{
          refreshRoom().catch(err=>console.error(err));
        }
      })
      .subscribe();
  }

  async function host(){
    const btn=panel.querySelector('#mpHostBtn');
    btn.disabled=true;
    status('Creating online room…');
    try{
      const sb=await ensureClient();
      const {data,error}=await sb.rpc('create_sanctum_game',{
        p_display_name:playerName(),
        p_initial_state:{multiplayer:true,stage:'lobby'}
      });
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(!row)throw new Error('Room creation returned no data.');
      session={
        gameId:row.game_id,
        roomCode:row.room_code,
        playerId:row.player_id,
        playerToken:row.player_token,
        seat:Number(row.seat),
        stateVersion:Number(row.state_version||0),
        isHost:true
      };
      lastAppliedVersion=-1;
      lastPublishedHash='';
      saveSession();
      await subscribe();
      await refreshRoom(true);
      startHeartbeat();
    }catch(err){
      console.error(err);
      status(err.message||'Could not create room.',true);
    }finally{btn.disabled=false}
  }

  async function join(){
    const input=panel.querySelector('#mpRoomInput');
    const code=(input.value||'').trim().toUpperCase();
    if(code.length!==6){status('Enter the 6-character room code.',true);input.focus();return}
    const btn=panel.querySelector('#mpJoinBtn');
    btn.disabled=true;
    status('Joining online room…');
    try{
      const sb=await ensureClient();
      const {data,error}=await sb.rpc('join_sanctum_game',{
        p_room_code:code,
        p_display_name:playerName()
      });
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(!row)throw new Error('Join returned no data.');
      session={
        gameId:row.game_id,
        roomCode:row.room_code,
        playerId:row.player_id,
        playerToken:row.player_token,
        seat:Number(row.seat),
        stateVersion:Number(row.state_version||0),
        isHost:false
      };
      lastAppliedVersion=-1;
      lastPublishedHash='';
      saveSession();
      await subscribe();
      await refreshRoom(true);
      startHeartbeat();
    }catch(err){
      console.error(err);
      status(err.message||'Could not join room.',true);
    }finally{btn.disabled=false}
  }

  async function leave(){
    stopHeartbeat();
    stopLobbyRosterPolling();
    stopChoiceRecoveryWatchdog();
    await stopRosterSubscription();
    if(client&&channel){try{await client.removeChannel(channel)}catch(_){}}
    resolvingVoteTransition=false;
    choiceAuthorityRepairBusy=false;
    channel=null;session=null;lastRosterSnapshot=null;lastAppliedVersion=-1;authoritativeActiveSeat=null;lastPublishedHash='';sessionEnded=false;saveSession();
    try{clearTurnTimerInterval()}catch(_){}
    document.body.classList.remove('mpWaitingTurn');
    const handPanel=document.getElementById('handPanel');
    if(handPanel){
      handPanel.classList.remove('mpOwnHand');
      delete handPanel.dataset.multiplayerSeat;
    }
    document.querySelectorAll('.mpOwnHandLabel').forEach(el=>el.remove());
    document.querySelectorAll('[data-mp-disabled="1"]').forEach(btn=>{
      btn.disabled=false;
      delete btn.dataset.mpDisabled;
    });
    for(let i=0;i<4;i++){
      const name=document.getElementById('pname'+i);
      if(name)name.readOnly=false;
    }
    const start=document.getElementById('startBtn');
    if(start&&start.dataset.mpGuestLocked==='1'){
      start.disabled=false;
      delete start.dataset.mpGuestLocked;
      start.removeAttribute('title');
    }
    setGameBanner();
    panel?.classList.remove('connected');
    const code=panel?.querySelector('.mpRoomCode');
    if(code)code.textContent='------';
    renderRoster(null);
    status('Not connected. Host a room or enter a room code.');
  }

  function installPanel(){
    const setup=document.getElementById('setupModal');
    const box=setup?.querySelector('.modalbox');
    if(!box||document.getElementById('sanctumOnlinePanel'))return false;

    panel=document.createElement('section');
    panel.id='sanctumOnlinePanel';
    panel.innerHTML=`
      <div class="mpTitle">Online Multiplayer <small style="opacity:.55">DEV</small></div>
      <div class="mpActions">
        <div class="mpField">
          <label for="mpRoomInput">Join code</label>
          <input id="mpRoomInput" maxlength="6" autocomplete="off" spellcheck="false" placeholder="ABC234">
        </div>
        <div>
          <div style="font-size:9px;color:#8f816e;margin-bottom:2px">CURRENT ROOM</div>
          <div class="mpRoomCode">------</div>
        </div>
      </div>
      <div class="mpButtons">
        <button class="btn green" id="mpHostBtn" type="button">Host Online Game</button>
        <button class="btn blue" id="mpJoinBtn" type="button">Join Online Game</button>
        <button class="btn" id="mpLeaveBtn" type="button">Leave Online Room</button>
      </div>
      <div class="mpStatus">Not connected. Host a room or enter a room code.</div>
      <div class="mpRoster"></div>
      <div class="mpDevNote">Shared-board milestone: optimized online sync, each device always shows its own Priest hand, only the active Priest can act, the passage-clearing Priest controls synchronized rewards and passage choices, Demon and Boss cards open into a large mobile-friendly reading view, and the room automatically ends when the host disconnects.</div>
    `;

    const grid=box.querySelector('.setupgrid');
    if(grid)grid.insertAdjacentElement('beforebegin',panel);
    else box.appendChild(panel);

    panel.querySelector('#mpHostBtn').addEventListener('click',host);
    panel.querySelector('#mpJoinBtn').addEventListener('click',join);
    panel.querySelector('#mpLeaveBtn').addEventListener('click',leave);
    panel.querySelector('#mpRoomInput').addEventListener('input',e=>{
      e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
    });
    panel.querySelector('#mpRoomInput').addEventListener('keydown',e=>{
      if(e.key==='Enter')join();
    });

    loadSession();
    if(session){
      const code=panel.querySelector('.mpRoomCode');
      if(code)code.textContent=session.roomCode||'------';
      status('Reconnecting to '+(session.roomCode||'online room')+'…');
      lastAppliedVersion=-1;
      subscribe()
        .then(()=>refreshRoom(true))
        .then(()=>startHeartbeat())
        .catch(err=>status(err.message||'Reconnect failed.',true));
    }
    return true;
  }

  installStateSyncHooks();

  if(!installPanel()){
    let tries=0;
    const t=setInterval(()=>{
      if(installPanel()||++tries>80)clearInterval(t);
    },100);
  }

  window.SanctumMultiplayerDev={
    get session(){return session?{...session,playerToken:'[stored locally]'}:null},
    get isMyTurn(){return isMyTurn()},
    get authoritativeActiveSeat(){return authoritativeActiveSeat},
    refresh:()=>refreshRoom(true),
    push:()=>pushSharedState('state_sync',{manual:true})
  };
})();
