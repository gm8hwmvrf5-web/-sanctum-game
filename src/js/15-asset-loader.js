/* Clean rebuild asset loader: prioritize visible art, then warm the rest without blocking gameplay. */
(()=>{
  'use strict';

  const started=new Set();
  const lowQueue=[];
  let activeLow=0;
  let backgroundScheduled=false;
  const LOW_CONCURRENCY=2;

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

  function allArtwork(){
    const set=new Set();
    const sources=[];
    try{if(typeof CHARACTERS!=='undefined')sources.push(CHARACTERS)}catch(_){}
    try{if(typeof PRIEST_CARD_ARTS!=='undefined')sources.push(PRIEST_CARD_ARTS)}catch(_){}
    try{if(typeof DEMON_TYPES!=='undefined')sources.push(DEMON_TYPES)}catch(_){}
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
    return new Promise(resolve=>{
      const img=new Image();
      img.decoding='async';
      try{img.fetchPriority=priority}catch(_){}
      img.onload=img.onerror=()=>resolve();
      img.src=url;
      if(img.complete)resolve();
    });
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

      /* Warm the next few likely draws so newly appearing cards do not flash blank. */
      S.priestDeck?.slice(-6).forEach(card=>{const art=cardArt(card);if(validAsset(art))set.add(art)});
      S.demonDeck?.slice(-6).forEach(d=>{
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
      if(started.has(url))continue;
      activeLow++;
      preload(url,'low').finally(()=>{
        activeLow--;
        if(lowQueue.length){
          if(typeof requestIdleCallback==='function')requestIdleCallback(pumpLow,{timeout:800});
          else setTimeout(pumpLow,40);
        }
      });
    }
  }

  function warmBackground(){
    if(backgroundScheduled)return;
    backgroundScheduled=true;
    const begin=()=>{
      const critical=new Set(criticalArtwork());
      allArtwork().forEach(url=>{
        if(!critical.has(url)&&!started.has(url))lowQueue.push(url);
      });
      pumpLow();
    };
    setTimeout(()=>{
      if(typeof requestIdleCallback==='function')requestIdleCallback(begin,{timeout:1800});
      else begin();
    },2200);
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

  window.SanctumAssetLoader={
    sync,
    warmCritical,
    warmBackground,
    get totalArtwork(){return allArtwork().length},
    get requestedArtwork(){return started.size}
  };
})();
