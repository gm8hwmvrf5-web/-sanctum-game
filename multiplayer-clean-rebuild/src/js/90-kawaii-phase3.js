/* Kawaii skin Phase 3 – Priest classes/cards, Relics, Wards and status icons.
 * Presentational only. Never writes S, Supabase, game saves, or card stats.
 * Each illustration is generated once as an SVG data URL, sized to the
 * existing frames to preserve phone landscape layout and load speed. */
(()=>{
'use strict';
if(window.SanctumKawaiiPhase3)return;
const skins=window.SanctumSkins;
if(!skins||typeof PRIEST_CARD_ARTS==='undefined'||typeof CHARACTERS==='undefined'||typeof RELICS==='undefined')return;
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const image=svg=>'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
const repeat=(n,fn)=>Array.from({length:n},(_,i)=>fn(i)).join('');
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
const palettes=[
 ['#f7b4d2','#a76fae','#ffefba','#fff9fa'],
 ['#b6dffa','#777dc8','#f9c8ee','#fbf5ff'],
 ['#ffe1b4','#d68aa5','#e5c9fc','#fff6e7'],
 ['#c2ebd7','#77b9bc','#f9c8e9','#fafff3'],
 ['#d6c5fd','#a58aca','#ffcfda','#fff7ff'],
 ['#ffcab4','#b48bd0','#ffe3a1','#fffbef'],
 ['#c7eaf5','#75a8d9','#eec6f7','#fffafa'],
 ['#f3cae6','#aa85bd','#fef3c4','#fcf6ff']
];
function stars(seed,w,h,n=17){
 return repeat(n,i=>{
  const x=22+(seed+i*79+i*i*11)%(w-44),y=14+(seed*3+i*59)%(h-32),r=i%4===0?7:4;
  return '<path d="M'+x+' '+(y-r)+'Q'+(x+1)+' '+(y-1)+' '+(x+r)+' '+y+'Q'+(x+1)+' '+(y+1)+' '+x+' '+(y+r)+'Q'+(x-1)+' '+(y+1)+' '+(x-r)+' '+y+'Q'+(x-1)+' '+(y-1)+' '+x+' '+(y-r)+'Z" fill="#fffaf1" opacity=".78"/>';
 });
}
function flower(x,y,c){
 return '<g transform="translate('+x+' '+y+')">'+repeat(5,i=>'<ellipse ry="10" rx="6" cy="-10" transform="rotate('+(i*72)+')" fill="'+c+'"/>')+'<circle r="5" fill="#fff5b8"/></g>';
}
function emblem(key,palette){
 const c=palette[0],d=palette[1],gold=palette[2];
 const k=String(key).toLowerCase();
 if(/lightning|spark|storm|thunder|bolt/.test(k))
  return '<path d="M17 -83L-48 6H-3L-24 90L58 -20H9L17 -83Z" fill="'+gold+'" stroke="'+d+'" stroke-width="9" stroke-linejoin="round"/>';
 if(/shield|ward|guardian|protect|barrier|vigil|faith|iron/.test(k))
  return '<path d="M0 -90L73 -57L65 28Q54 79 0 103Q-54 79 -65 28L-73 -57Z" fill="'+c+'" stroke="'+gold+'" stroke-width="10"/><path d="M0 -51V51M-38 0H38" stroke="#fff9f2" stroke-width="12" stroke-linecap="round"/>';
 if(/prayer|holy|sacred|bless|consecr|saint|seraph|sunburst|nova|echo/.test(k))
  return '<circle cy="3" r="68" fill="'+gold+'" stroke="'+d+'" stroke-width="9"/><path d="M0 -92V-13M0 18V96M-94 0H-18M18 0H94M-70 -65L-21 -22M21 22L70 65M-71 65L-21 21M21 -21L71 -65" stroke="#fff7ec" stroke-width="13" stroke-linecap="round"/>';
 if(/sword|steel|spear|smite|attack|blade|wrath|judgment|brand/.test(k))
  return '<path d="M-19 -92L27 -89L25 40L0 73L-22 40Z" fill="#f1f7ff" stroke="'+d+'" stroke-width="9"/><path d="M-61 32H61M-6 65V98" stroke="'+gold+'" stroke-width="17" stroke-linecap="round"/>';
 if(/blood|tithe|chalice|vamp|siphon|crimson|leech|sanguine/.test(k))
  return '<path d="M0 -94Q-18 -35 -49 12Q-79 64 -25 92Q0 108 25 92Q79 64 49 12Q18 -35 0 -94Z" fill="#f5a4c0" stroke="'+d+'" stroke-width="10"/><ellipse cx="-17" cy="33" rx="13" ry="29" fill="#fff6fb" opacity=".8"/>';
 if(/relic|ledger|xp|book|archive|abacus|distill|mana|essence|decanter/.test(k))
  return '<path d="M-72 -82Q-34 -94 0 -69Q34 -94 72 -82V79Q32 65 0 91Q-32 65 -72 79Z" fill="'+c+'" stroke="'+d+'" stroke-width="9"/><path d="M0 -68V85M-54 -39H-17M19 -39H55M-52 -15H-17M18 -15H52" stroke="#fff9f8" stroke-width="6" stroke-linecap="round"/>';
 if(/fire|cinder|flame|dawn/.test(k))
  return '<path d="M0 -92Q-84 -27 -49 60Q-14 107 33 86Q94 47 23 -27Q29 11 -10 18Q-23 -5 0 -92Z" fill="#ffce9b" stroke="'+d+'" stroke-width="9"/><path d="M1 0Q-33 37 0 75Q33 38 1 0Z" fill="#fff5d3"/>';
 if(/poison|fang|serpent|thorn|grave|rot/.test(k))
  return '<path d="M0 -77C48 -67 69 -18 47 29C23 73 -31 101 -65 58Q-84 26 -50 3Q-18 -20 14 10Q35 27 11 47" stroke="'+d+'" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="1" cy="-36" r="11" fill="'+gold+'"/>';
 if(/bell|silence|vow|absolution/.test(k))
  return '<path d="M-60 50Q-34 22 -38 -23Q-41 -76 0 -81Q41 -76 38 -23Q34 22 60 50Z" fill="'+c+'" stroke="'+d+'" stroke-width="10"/><circle cy="68" r="15" fill="'+gold+'"/>';
 return '<path d="M0 -97L24 -33H93L38 9L62 82L0 36L-62 82L-38 9L-93 -33H-24Z" fill="'+gold+'" stroke="'+d+'" stroke-width="10"/>';
}
function frame(title,key,kind='card'){
 const seed=hash(key),p=palettes[seed%palettes.length],[pink,purple,gold,light]=p;
 const w=kind==='relic'?360:kind==='ward'?470:480,h=kind==='relic'?360:kind==='ward'?530:360;
 let body='<g transform="translate('+(w/2)+' '+(h*.51)+') scale('+(kind==='ward'?1.18:.88)+')">'+emblem(key,p)+'</g>';
 if(kind==='priest'){
  const priestPals=palettes[(seed+2)%palettes.length];
  body='<g transform="translate('+(w/2)+' '+(h*.54)+')">'+
   '<ellipse cy="73" rx="98" ry="87" fill="'+purple+'" stroke="#fff8f8" stroke-width="9"/>'+
   '<path d="M-83 -35Q-98 -141 0 -161Q98 -141 83 -35L105 59L-104 59Z" fill="'+pink+'" stroke="'+purple+'" stroke-width="8"/>'+
   '<ellipse cy="-25" rx="73" ry="69" fill="#fff3e6" stroke="#fffaf5" stroke-width="8"/>'+
   '<ellipse cx="-27" cy="-29" rx="14" ry="20" fill="#45335c"/><ellipse cx="27" cy="-29" rx="14" ry="20" fill="#45335c"/>'+
   '<circle cx="-31" cy="-36" r="6" fill="#fff"/><circle cx="23" cy="-36" r="6" fill="#fff"/>'+
   '<ellipse cx="-54" cy="0" rx="12" ry="7" fill="#f7a4bc"/><ellipse cx="54" cy="0" rx="12" ry="7" fill="#f7a4bc"/>'+
   '<path d="M-8 3Q0 16 8 3" stroke="#95697a" stroke-width="5" stroke-linecap="round" fill="none"/>'+
   '<circle cx="0" cy="-154" r="25" fill="'+gold+'" stroke="#fffef5" stroke-width="7"/>'+
   '<path d="M-14 -153H14M0 -169V-138" stroke="#fff9ef" stroke-width="6"/>'+
   '<g transform="translate(90 46) scale(.35)">'+emblem(key,priestPals)+'</g>'+
   '</g>';
 }
 const halo=repeat(7,i=>flower(28+(seed+i*47)%(w-44),28+(i*63+seed)%(h-54),i%2?pink:gold));
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Kawaii '+esc(title)+'"><defs>'+
 '<radialGradient id="p"><stop stop-color="'+light+'"/><stop offset=".63" stop-color="'+pink+'"/><stop offset="1" stop-color="'+purple+'"/></radialGradient>'+
 '</defs><rect width="'+w+'" height="'+h+'" rx="16" fill="url(#p)"/>'+
 '<circle cx="'+(w/2)+'" cy="'+(h*.51)+'" r="'+(h*.39)+'" stroke="#fff7fa" stroke-width="8" fill="#fffae9" fill-opacity=".2"/>'+
 stars(seed,w,h,kind==='ward'?26:16)+halo+body+
 '<rect x="8" y="8" width="'+(w-16)+'" height="'+(h-16)+'" rx="15" fill="none" stroke="#fff7fb" stroke-width="8" opacity=".87"/>'+
 '</svg>';
}
const priestArts={};const portraits={};
for(const [name,path] of Object.entries(PRIEST_CARD_ARTS)){
 const art=image(frame(name,name,'priest'));
 priestArts[path]=art;
}
for(const [name,c] of Object.entries(CHARACTERS)){
 if(!c.img)continue;
 portraits[c.img]=image(frame(name,name,'priest'));
}
const relics=[
 ...RELICS,
 ...(Array.isArray(window.__sanctumExtraRelics)?window.__sanctumExtraRelics:[])
];
const relicImages=new Map();
const relicByName=new Map();
for(const relic of relics){
 const key=String(relic.key||relic.k||relic.id||relic.n),name=String(relic.n||relic.name||key);
 if(!relicImages.has(key)){
  const art=image(frame(name,key,'relic'));
  relicImages.set(key,art);relicByName.set(name,art);
 }
}
const wardKeys=['cinder','thorns','chains','bell','silence','lantern','vigil','absolution','siphon','chalice'];
const wardImages=new Map();
for(const key of wardKeys){
 const art=image(frame(key+' Ward',key,'ward'));
 wardImages.set(key,art);
 document.documentElement.style.setProperty('--sanctum-cute-ward-'+key,'url("'+art+'")');
}
const iconKinds=['fire','poison','lightning','gatewalker','blood','mana','relic','altar'];
for(const kind of iconKinds){
 const icon=image(frame(kind+' Icon',kind,'relic'));
 document.documentElement.style.setProperty('--sanctum-cute-icon-'+kind,'url("'+icon+'")');
}
// <img> based Priest portraits and Priest-deck cards are handled by
// the existing central skin mapper, without altering immutable game data.
skins.registerArtworkPack({...priestArts,...portraits});
const cssPriest=Object.entries(PRIEST_CARD_ARTS).map(([name,path])=>[name,path,priestArts[path]]);
const cssNames=new Map(cssPriest.map(([name,path,art])=>[path,art]));
const priestNodes=new WeakMap();
function refreshPriest(){
 const active=skins.get()==='kawaii';
 document.querySelectorAll('.cardArt[style]').forEach(el=>{
  // Hand cards render via background-image, not <img src>.
  const original=el.style.backgroundImage||'';
  let existing=priestNodes.get(el);
  if(!existing||existing.original!==original){existing={original};priestNodes.set(el,existing)}
  const match=Object.entries(PRIEST_CARD_ARTS).find(([,path])=>original.includes(path));
  const art=match&&cssNames.get(match[1]);
  if(art&&active){
   const desired='url("'+art+'")';
   if(el.style.getPropertyValue('--sanctum-kawaii-priest-art')!==desired)
    el.style.setProperty('--sanctum-kawaii-priest-art',desired);
  }else if(el.style.getPropertyValue('--sanctum-kawaii-priest-art')){
   el.style.removeProperty('--sanctum-kawaii-priest-art');
  }
 });
}
function ensureRelicArt(host,key,src){
 if(!host||!src)return;
 let img=host.querySelector(':scope > .sanctum-kawaii-relic-art');
 if(!img){
  img=document.createElement('img');
  img.className='sanctum-kawaii-relic-art';
  img.alt='Kawaii Relic illustration';
  img.setAttribute('aria-hidden','true');
  host.prepend(img);
 }
 if(img.dataset.relicKey!==key){
  img.dataset.relicKey=key;
  img.src=src;
 }
}
function refreshRelics(){
 const modal=document.getElementById('relicModal');
 if(modal){
  const name=document.getElementById('relicName')?.textContent?.trim();
  const src=relicByName.get(name);
  if(src)ensureRelicArt(modal.querySelector('.relicCard'),name,src);
 }
 document.querySelectorAll('#relicDeckReferenceGrid .relicDeckReferenceCard').forEach(card=>{
  const name=card.querySelector('.relicDeckReferenceName')?.textContent?.trim();
  const src=relicByName.get(name);
  if(src)ensureRelicArt(card,name,src);
 });
}
let refreshQueued=false;
function refresh(){
 refreshQueued=false;
 refreshPriest();
 refreshRelics();
}
function queue(){
 if(refreshQueued)return;
 refreshQueued=true;
 queueMicrotask(refresh);
}
const observer=new MutationObserver(muts=>{
 if(muts.some(m=>m.type==='childList'||m.attributeName==='style'))queue();
});
observer.observe(document.body,{childList:true,subtree:true});
// The central skin set() changes data-sanctum-skin. Observe it separately
// so switching styles updates Priest CSS variables on existing cards.
const skinObserver=new MutationObserver(queue);
skinObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-sanctum-skin']});
queue();
window.SanctumKawaiiPhase3={
 priestCardCount:Object.keys(priestArts).length,
 priestClassCount:Object.keys(portraits).length,
 relicCount:relicImages.size,
 wardCount:wardImages.size,
 iconCount:iconKinds.length,
 getPriestArt:name=>{const path=PRIEST_CARD_ARTS[name];return path?priestArts[path]:null},
 getRelicArt:key=>relicImages.get(key)||null,
 getWardArt:key=>wardImages.get(key)||null,
 refresh
};
})();