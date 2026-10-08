/* Clean rebuild asset loader: use setup time to warm card art before gameplay. */
(()=>{
  'use strict';

  const started=new Set();
  const queued=new Set();
  const lowQueue=[];
  let activeLow=0;
  let backgroundScheduled=false;
  let setupScheduled=false;
  const LOW_CONCURRENCY=6;

  function validAsset(url){
    return typeof url==='string' && /^\.\/assets\/(?:embedded|bosses)\//.test(url);
  }

  function addFrom(value,set,depth=0){
    if(depth>5||value==null)return;
    if(validAsset(value)){set.add(value);return}
    if(Array.isArray(value)){
      value.forEach(v=>addFrom(v,set,depth+1));
      return;
    }
    if(typeof value==='object'){
      Object.values(value).forEach(v=>addFrom(v,set,depth+1));
    }
  }

  function coreGameplayArtwork(){
    const set=new Set();
    try{if(typeof CHARACTERS!=='undefined')addFrom(CHARACTERS,set)}catch(_){}
    try{if(typeof PRIEST_CARD_ARTS!=='undefined')addFrom(PRIEST_CARD_ARTS,set)}catch(_){}
    try{if(typeof DEMON_TYPES!=='undefined')addFrom(DEMON_TYPES,set)}catch(_){}
    return [...set];
  }

  function allArtwork(){
    const set=new Set(coreGameplayArtwork());
    const sources=[];
    try{if(typeof BOSSES!=='undefined')sources.push(BOSSES)}catch(_){}
    try{if(typeof CRUCIFIX!=='undefined')sources.push(CRUCIFIX)}catch(_){}
    try{if(typeof CHOICE_CRUCIFIX!=='undefined')sources.push(CHOICE_CRUCIFIX)}catch(_){}
    try{if(typeof CURSED_CRUCIFIX!=='undefined')sources.push(CURSED_CRUCIFIX)}catch(_){}
    sources.forEach(v=>addFrom(v,set));
    return [...set];
  }

  function preload(url,priority='low'){
    if(!validAsset(url)||started.has(url))return Promise.resolve();
    started.add(url);
    queued.delete(url);
    return new Promise(resolve=>{
      const img=new Image();
      img.decoding='async';
      try{img.fetchPriority=priority}catch(_){}
      img.onload=img.onerror=()=>resolve();
      img.src=url;
      if(img.complete)resolve();
    });
  }

  function enqueue(url){
    if(!validAsset(url)||started.has(url)||queued.has(url))return;
    queued.add(url);
    lowQueue.push(url);
  }

  function cardArt(card){
    if(!card)return'';
    try{
      return (typeof PRIEST_CARD_ARTS!=='undefined'&&PRIEST_CARD_ARTS?.[card.n])||card.art||'';
    }catch(_){return card.art||''}
  }

  function criticalArtwork(){
    const set=new Set();
    try{
      if(typeof S==='undefined'||!S?.started)return [];
      const player=Array.isArray(S.players)?S.players[S.current]:null;
      if(player){
        player.hand?.forEach(card=>{const art=cardArt(card);if(validAsset(art))set.add(art)});
        const ch=typeof CHARACTERS!=='undefined'?CHARACTERS?.[player.char]:null;
        if(validAsset(ch?.img))set.add(ch.img);
      }
      S.rooms?.forEach(room=>room?.forEach(d=>{
        const art=d?.greater?(d.gart||d.art):(d.art||d.gart);
        if(validAsset(art))set.add(art);
      }));
      if(S.bossRevealed&&validAsset(S.boss?.art))set.add(S.boss.art);

      /* Warm likely next draws so newly appearing cards do not flash blank. */
      S.priestDeck?.slice(-8).forEach(card=>{const art=cardArt(card);if(validAsset(art))set.add(art)});
      S.demonDeck?.slice(-8).forEach(d=>{
        const art=d?.greater?(d.gart||d.art):(d.art||d.gart);
        if(validAsset(art))set.add(art);
      });
    }catch(_){}
    return [...set];
  }

  function warmCritical(){
    criticalArtwork().forEach(url=>preload(url,'high'));
  }

  function pumpLow(){
    while(activeLow<LOW_CONCURRENCY&&lowQueue.length){
      const url=lowQueue.shift();
      queued.delete(url);
      if(started.has(url))continue;
      activeLow++;
      preload(url,'low').finally(()=>{
        activeLow--;
        if(lowQueue.length)setTimeout(pumpLow,0);
      });
    }
  }

  function warmSetupArtwork(){
    if(setupScheduled)return;
    setupScheduled=true;
    /* The setup screen is free loading time. Warm all artwork that can appear
       immediately in the opening hand/board before the player presses Start. */
    coreGameplayArtwork().forEach(enqueue);
    pumpLow();
  }

  function warmBackground(){
    if(backgroundScheduled)return;
    backgroundScheduled=true;
    const begin=()=>{
      const critical=new Set(criticalArtwork());
      allArtwork().forEach(url=>{
        if(!critical.has(url))enqueue(url);
      });
      pumpLow();
    };
    setTimeout(begin,700);
  }

  function sync(){
    warmCritical();
    try{if(typeof S!=='undefined'&&S?.started)warmBackground()}catch(_){}
  }

  if(typeof render==='function'){
    const baseRender=render;
    render=function(){
      const out=baseRender.apply(this,arguments);
      sync();
      return out;
    };
    try{window.render=render}catch(_){}
  }

  /* Begin warming as soon as the setup UI has painted, instead of waiting for
     the first turn. This removes the request-latency gap versus the embedded-art build. */
  setTimeout(warmSetupArtwork,120);

  window.SanctumAssetLoader={
    sync,
    warmCritical,
    warmSetupArtwork,
    warmBackground,
    get totalArtwork(){return allArtwork().length},
    get requestedArtwork(){return started.size},
    get queuedArtwork(){return lowQueue.length}
  };
})();
