/* Sanctum of the Damned — Phase 4: walk the descent.
 * Presentation adapter ONLY: route selections use the original authoritative
 * Rogue Choice buttons (solo AND synced passage-owner multiplayer). No separate
 * vote, reward or route actions are created here.
 */
(()=>{
  'use strict';
  const app=document.querySelector('body > .app.layoutPhase3');
  const board=document.getElementById('boardSection');
  const modal=document.getElementById('rogueChoiceModal');
  const grid=document.getElementById('rogueChoiceGrid');
  const title=document.getElementById('rogueChoiceTitle');
  const tabs=document.getElementById('layoutRoomNav');
  if(!app||!board||!modal||!grid||!title||!tabs)return;

  app.classList.add('layoutPhase4');
  const state=()=>typeof S!=='undefined'&&S&&typeof S==='object'?S:null;
  const hasRun=()=>!!state()?.started&&!!state()?.rogue?.enabled;
  const floor=()=>hasRun()?Math.max(1,Math.floor(Number(state().rogue.floor)||1)):null;
  const roomNames=['gateway','hall','chapel','crypt','boss'];
  const routeLabels={
    battle:'Standard Battle',elite:'Elite Procession',swarm:'Hellgate Swarm',
    sanctuary:'Ruined Sanctuary',boss:'Boss Gate',repository:'Sinking Repository'
  };

  const passage=document.createElement('div');
  passage.id='layoutPassagePlaque';
  passage.className='layoutPassagePlaque';
  passage.setAttribute('role','status');
  passage.setAttribute('aria-live','off');
  const passageOverline=document.createElement('small');
  passageOverline.id='layoutPassageFloor';
  const passageName=document.createElement('strong');
  passageName.id='layoutPassageName';
  passage.append(passageOverline,passageName);
  tabs.insertAdjacentElement('afterend',passage);

  // A purely visual cinematic, always click-through: it never pauses a turn,
  // captures input, or delays the route's real multiplayer state transition.
  const veil=document.createElement('div');
  veil.id='layoutTravelVeil';
  veil.className='layoutTravelVeil';
  veil.setAttribute('aria-hidden','true');
  const hall=document.createElement('div');
  hall.className='layoutTravelHall';
  const gate=document.createElement('div');
  gate.className='layoutTravelGate';
  const gateGlow=document.createElement('div');
  gateGlow.className='layoutTravelGateGlow';
  gate.appendChild(gateGlow);
  const announcement=document.createElement('div');
  announcement.className='layoutTravelAnnouncement';
  const heading=document.createElement('strong');
  heading.id='layoutTravelHeading';
  heading.textContent='ENTERING THE NEXT CHAMBER';
  const sub=document.createElement('span');
  sub.id='layoutTravelSubtitle';
  sub.textContent='The descent continues';
  announcement.append(heading,sub);
  hall.append(gate,announcement);
  veil.appendChild(hall);
  app.appendChild(veil);

  let lastFloor=null;
  let traveling=false;
  let animationTimeout=0;
  let travelNonce=0;
  let decorating=false;

  function routeKind(button,index){
    const vote=state()?.multiplayerVote;
    const fromVote=vote?.open===true&&Array.isArray(vote.options)?
      String(vote.options[index]?.actionKey||''):'';
    if(fromVote.startsWith('route:')){
      const k=fromVote.slice(6);
      if(Object.prototype.hasOwnProperty.call(routeLabels,k))return k;
    }
    const label=(button.querySelector('h3')?.textContent||button.textContent||'').trim().toLowerCase();
    if(label.includes('boss'))return 'boss';
    if(label.includes('elite'))return 'elite';
    if(label.includes('swarm'))return 'swarm';
    if(label.includes('sanctuary'))return 'sanctuary';
    if(label.includes('repository'))return 'repository';
    return 'battle';
  }
  function routeDialogActive(){
    if(modal.classList.contains('hidden'))return false;
    const currentTitle=(title.textContent||'').trim().toLowerCase();
    // These are the TWO existing next-passage choice titles. Law, Ward,
    // reward, draft, shop and boss-reward choices must remain untouched.
    return currentTitle==='choose your route'||currentTitle==='the boss gate opens';
  }
  function decorateRoutes(){
    if(decorating)return;
    decorating=true;
    try{
      const active=routeDialogActive();
      modal.classList.toggle('layoutDoorChoice',active);
      if(!active)return;
      const buttons=[...grid.querySelectorAll('button.rogueChoice')];
      buttons.forEach((btn,i)=>{
        const kind=routeKind(btn,i);
        if(btn.dataset.layoutDoor!==kind)btn.dataset.layoutDoor=kind;
        if(!btn.querySelector('.layoutPortalArch')){
          const arch=document.createElement('span');
          arch.className='layoutPortalArch';
          arch.setAttribute('aria-hidden','true');
          const archInner=document.createElement('span');
          archInner.className='layoutPortalInner';
          const archStairs=document.createElement('span');
          archStairs.className='layoutPortalSteps';
          arch.append(archInner,archStairs);
          btn.prepend(arch);
        }
        btn.setAttribute('title','Enter '+(btn.querySelector('h3')?.textContent||routeLabels[kind]));
      });
    }finally{decorating=false;}
  }
  function reducedMotion(){
    return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function startTravel(label='THE NEXT CHAMBER'){
    // Deliberately no authoritative state write. All peers render from
    // S.rogue.floor and S.rogue.nodeType as already synchronized by Supabase.
    travelNonce++;
    const nonce=travelNonce;
    traveling=true;
    sub.textContent=label;
    veil.classList.remove('is-travelling');
    void veil.offsetWidth; // restart a CSS-only animation for successive passages
    veil.classList.add('is-travelling');
    app.classList.add('layoutWalking');
    if(animationTimeout)clearTimeout(animationTimeout);
    animationTimeout=setTimeout(()=>{
      if(nonce!==travelNonce)return;
      veil.classList.remove('is-travelling');
      app.classList.remove('layoutWalking');
      traveling=false;
      animationTimeout=0;
    },reducedMotion()?180:1050);
  }
  // Intercept only for animation. The real button's own onclick ALWAYS runs,
  // including asynchronous multiplayer passage-owner resolution.
  grid.addEventListener('click',event=>{
    if(!routeDialogActive())return;
    const candidate=event.target?.closest?.('button.rogueChoice');
    if(!candidate||!grid.contains(candidate)||candidate.disabled)return;
    const chosen=candidate.querySelector('h3')?.textContent?.trim()||'THE NEXT CHAMBER';
    startTravel(chosen.toUpperCase());
  },true);

  function focusRoom(index){
    const nav=document.getElementById('layoutRoomNav');
    const button=nav?.querySelector('#layoutRoomTab'+index);
    if(!button)return;
    // The Phase 1 tabs update the actual focus/ARIA room view, not game S.
    if(board.dataset.focusedRoom!==roomNames[index])button.click();
  }
  function syncScene(){
    const currentFloor=floor();
    const run=hasRun();
    if(!run){
      lastFloor=null;
      app.removeAttribute('data-layout-node');
      passage.hidden=true;
      return;
    }
    const r=state().rogue;
    const kind=String(r.nodeType||'battle').toLowerCase();
    const current=Object.prototype.hasOwnProperty.call(routeLabels,kind)?kind:'battle';
    app.dataset.layoutNode=current;
    const cyc=Math.max(1,Math.floor(Number(r.cycle)||1));
    const act=Math.max(1,Math.floor(Number(r.act)||1));
    passageOverline.textContent='CYCLE '+cyc+' · ACT '+act+' · FLOOR '+currentFloor;
    passageName.textContent=routeLabels[current].toUpperCase();
    passage.hidden=false;
    if(lastFloor===null){
      lastFloor=currentFloor;
      // Loading directly into a boss floor should show the boss chamber.
      focusRoom(r.bossFloor||current==='boss'?4:0);
      return;
    }
    if(currentFloor!==lastFloor){
      const previous=lastFloor;
      lastFloor=currentFloor;
      focusRoom(r.bossFloor||current==='boss'?4:0);
      // Trigger a visual walkthrough even for other multiplayer clients.
      // A locally chosen door may already be animating; do not restart it.
      if(!traveling&&currentFloor>previous)
        startTravel('FLOOR '+currentFloor+' · '+routeLabels[current].toUpperCase());
    }
  }

  if(typeof render==='function'){
    const priorRender=render;
    render=function(){
      const result=priorRender.apply(this,arguments);
      syncScene();
      return result;
    };
  }
  if(typeof rogueliteRenderHud==='function'){
    const priorHud=rogueliteRenderHud;
    rogueliteRenderHud=function(){
      const result=priorHud.apply(this,arguments);
      syncScene();
      return result;
    };
  }
  if(typeof MutationObserver==='function'){
    // Multiplayer redraws its choice grid when a published choice arrives.
    // Don't rebuild the options or modify their click handlers.
    const observer=new MutationObserver(()=>decorateRoutes());
    observer.observe(modal,{attributes:true,attributeFilter:['class']});
    observer.observe(grid,{childList:true});
  }
  decorateRoutes();
  syncScene();
})();
