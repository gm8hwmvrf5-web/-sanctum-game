/* Active Relics HUD: replaces the always-visible Relic summary, not the Relic XP meter.
   Presentation-only; never changes S, relic ownership, turns or multiplayer state. */
(()=>{
  'use strict';
  const POPUP_ID='activeRelicsModal', BUTTON_ID='activeRelicsButton';
  const popup=document.createElement('div');
  popup.id=POPUP_ID;
  popup.className='modal hidden';
  popup.setAttribute('role','dialog');
  popup.setAttribute('aria-modal','true');
  popup.setAttribute('aria-labelledby','activeRelicsTitle');
  popup.innerHTML=
    '<div class="modalbox activeRelicsBox" role="document">'+
      '<div class="activeRelicsHeading"><div><div class="activeRelicsEyebrow">SANCTUM RELIQUARY</div>'+
        '<h2 id="activeRelicsTitle">Equipped Relics</h2>'+
        '<p id="activeRelicsCount" class="activeRelicsCount"></p></div>'+
        '<button type="button" class="btn activeRelicsClose" id="activeRelicsClose" aria-label="Close equipped relics">✕ Close</button></div>'+
      '<div id="activeRelicsList" class="activeRelicsList"></div>'+
    '</div>';
  document.body.appendChild(popup);
  const list=popup.querySelector('#activeRelicsList');
  const counter=popup.querySelector('#activeRelicsCount');
  const closeButton=popup.querySelector('#activeRelicsClose');
  let focusBeforeOpen=null;

  function ownedRelicKeys(){
    return Array.isArray(S?.activeRelics)?S.activeRelics:[];
  }
  function idOf(entry){
    return typeof entry==='string'?entry:String(entry?.key||entry?.k||entry?.id||'');
  }
  function definitionFor(entry,key){
    if(typeof entry==='object'&&entry&&(entry.effect||entry.n||entry.name))return entry;
    let info=null;
    if(typeof relicByKey==='function')info=relicByKey(key);
    if(!info&&Array.isArray(window.__sanctumExtraRelics)){
      info=window.__sanctumExtraRelics.find(v=>v&&String(v.key||v.k||v.id||'')===key)||null;
    }
    return info;
  }
  function equipped(){
    const groups=new Map();
    for(const entry of ownedRelicKeys()){
      const key=idOf(entry);
      if(!key)continue;
      const found=groups.get(key);
      if(found){found.count++;continue;}
      groups.set(key,{key,def:definitionFor(entry,key),count:1});
    }
    return [...groups.values()];
  }
  function node(cls,textValue,tag='div'){
    const e=document.createElement(tag);
    e.className=cls;
    e.textContent=String(textValue);
    return e;
  }
  function refresh(){
    const groups=equipped();
    const count=groups.reduce((sum,g)=>sum+g.count,0);
    counter.textContent=count===1?'1 relic currently equipped':count+' relics currently equipped';
    list.replaceChildren();
    if(!groups.length){
      const empty=node('activeRelicsEmpty','No Relics equipped yet. Relics you acquire during this run will appear here with their effects.');
      list.appendChild(empty);
      return;
    }
    for(const item of groups){
      const def=item.def;
      const card=node('activeRelicItem','');
      const heading=node('activeRelicItemHeader','');
      heading.appendChild(node('activeRelicName',def?.n||def?.name||item.key,'h3'));
      if(item.count>1)heading.appendChild(node('activeRelicStack','×'+item.count,'span'));
      card.appendChild(heading);
      if(def?.cat||def?.category)card.appendChild(node('activeRelicCategory',def.cat||def.category));
      card.appendChild(node('activeRelicEffect',def?.effect||def?.description||'This relic is active in your run. Its effect description is unavailable.'));
      list.appendChild(card);
    }
  }
  function close(){
    if(popup.classList.contains('hidden'))return;
    popup.classList.add('hidden');
    if(focusBeforeOpen&&focusBeforeOpen.isConnected)focusBeforeOpen.focus();
    focusBeforeOpen=null;
  }
  function open(){
    focusBeforeOpen=document.activeElement;
    refresh();
    popup.classList.remove('hidden');
    closeButton.focus();
  }
  closeButton.addEventListener('click',close);
  popup.addEventListener('click',event=>{
    if(event.target===popup)close();
  });
  document.addEventListener('keydown',event=>{
    if(popup.classList.contains('hidden'))return;
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }else if(event.key==='Tab'){
      // Keep keyboard focus within this short modal.
      const buttons=[closeButton];
      if(event.shiftKey||document.activeElement!==buttons[0]){
        event.preventDefault();closeButton.focus();
      }
    }
  },true);

  function updateButton(){
    const cinders=document.getElementById('actionCinderBadge');
    const tracker=cinders?.closest('.ritualTracker');
    if(!cinders||!tracker)return;
    let btn=document.getElementById(BUTTON_ID);
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.id=BUTTON_ID;
      btn.className='btn activeRelicsButton';
      btn.setAttribute('aria-haspopup','dialog');
      btn.setAttribute('aria-controls',POPUP_ID);
      btn.addEventListener('click',open);
    }
    const count=ownedRelicKeys().length;
    btn.textContent='Relics ('+count+')';
    btn.setAttribute('aria-label','View '+count+' equipped relic'+(count===1?'':'s')+' and their effects');
    // Cinders is re-appended by older render patches. Reattach adjacent to it every render.
    if(btn.parentElement!==tracker||btn.nextElementSibling!==cinders){
      tracker.insertBefore(btn,cinders);
    }
  }

  // These wrappers run after all older Priest/relic reflow patches, so the button
  // survives new hands, relic draws, loaded saves, and Supabase render refreshes.
  if(typeof renderPlayer==='function'){
    const priorRenderPlayer=renderPlayer;
    renderPlayer=function(){
      const result=priorRenderPlayer.apply(this,arguments);
      updateButton();
      if(!popup.classList.contains('hidden'))refresh();
      return result;
    };
  }
  if(typeof rogueliteRenderHud==='function'){
    const priorRogueHud=rogueliteRenderHud;
    rogueliteRenderHud=function(){
      const result=priorRogueHud.apply(this,arguments);
      updateButton();
      if(!popup.classList.contains('hidden'))refresh();
      return result;
    };
  }
  updateButton();
})();
