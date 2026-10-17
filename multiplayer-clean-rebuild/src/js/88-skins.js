/* Purely local visual skin. Never modify S, save files, lobby rows or
 * multiplayer messages. Future kawaii artwork registers against the existing
 * Gothic artwork paths without changing any gameplay rendering logic. */
(()=>{
'use strict';
if(window.SanctumSkins)return;
const STORAGE_KEY='sanctum-visual-skin-v1';
const SKINS=['gothic','kawaii'];
const artwork=new Map();
const backgrounds=new Map();
const imageOriginals=new WeakMap();
const backgroundOriginals=new WeakMap();
let current='gothic';
let observer=null;
let queued=false;
function valid(value){return SKINS.includes(value)?value:'gothic'}
function read(){
 try{return valid(localStorage.getItem(STORAGE_KEY))}catch(_){return 'gothic'}
}
function save(value){
 try{localStorage.setItem(STORAGE_KEY,value)}catch(_){}
}
function urlKey(url){
 if(typeof url!=='string'||!url.trim())return '';
 try{
  const parsed=new URL(url,document.baseURI);
  return parsed.pathname+parsed.search;
 }catch(_){return url}
}
function registerArtwork(gothicPath,kawaiiPath){
 if(typeof gothicPath!=='string'||typeof kawaiiPath!=='string'||!gothicPath.trim()||!kawaiiPath.trim())return false;
 artwork.set(urlKey(gothicPath),kawaiiPath);
 refreshArtwork();
 return true;
}
function registerArtworkPack(mapping){
 if(!mapping||typeof mapping!=='object')return 0;
 let count=0;
 for(const [gothic,kawaii] of Object.entries(mapping)){
  if(typeof kawaii==='string'&&gothic.trim()&&kawaii.trim()){
   artwork.set(urlKey(gothic),kawaii);count++;
  }
 }
 if(count)refreshArtwork();
 return count;
}
function resolveArtwork(originalPath,skin=current){
 if(skin!=='kawaii')return originalPath;
 return artwork.get(urlKey(originalPath))||originalPath;
}
// Background slots support room art, wallpaper, and boards in later phases.
// Nothing changes when a kawaii replacement asset has not been registered.
function registerBackground(slot,selector,kawaiiUrl){
 if(typeof slot!=='string'||typeof selector!=='string'||typeof kawaiiUrl!=='string')return false;
 if(!slot||!selector||!kawaiiUrl)return false;
 try{document.querySelector(selector)}catch(_){return false}
 backgrounds.set(slot,{selector,kawaiiUrl});
 refreshArtwork();
 return true;
}
function useImage(img){
 let original=imageOriginals.get(img);
 const actual=img.getAttribute('src')||'';
 if(original===undefined){
  original=actual;
  imageOriginals.set(img,original);
 }
 const expected=resolveArtwork(original,current);
 // The real game may reuse an <img> for a new card. If its src is neither
 // its Gothic source nor our own mapped value, treat it as new source art.
 if(actual!==original&&actual!==expected){
  original=actual;
  imageOriginals.set(img,original);
 }
 const desired=resolveArtwork(original,current);
 if(actual!==desired){
  img.setAttribute('src',desired);
 }
}
function useBackground(record){
 let nodes;
 try{nodes=document.querySelectorAll(record.selector)}catch(_){return}
 for(const el of nodes){
  let originals=backgroundOriginals.get(el);
  if(!originals){originals=new Map();backgroundOriginals.set(el,originals)}
  if(!originals.has(record.selector))originals.set(record.selector,el.style.backgroundImage);
  if(current==='kawaii'){
   // The CSS owns the background geometry. Inline art is deliberately
   // absent until a replacement file is registered for this slot.
   el.style.backgroundImage='url("'+record.kawaiiUrl.replace(/"/g,'%22')+'")';
  }else{
   el.style.backgroundImage=originals.get(record.selector);
  }
 }
}
function refreshArtwork(){
 if(!document.body)return;
 document.querySelectorAll('img[src]').forEach(useImage);
 backgrounds.forEach(useBackground);
}
function queueRefresh(){
 if(queued)return;
 queued=true;
 queueMicrotask(()=>{queued=false;refreshArtwork()});
}
function updateMenu(){
 const select=document.getElementById('sanctumSkinSelect');
 if(select&&select.value!==current)select.value=current;
 const desc=document.getElementById('sanctumSkinDescription');
 if(desc)desc.textContent=current==='kawaii'
  ?'Kawaii UI is active! Pastel rooms, rounded controls and cute frames. Character, Boss and Relic artwork remains Gothic until the art-pack phases.'
  :'Original Gothic UI is active. Your choice is saved for this device.';
}
function set(value){
 current=valid(value);
 document.documentElement.setAttribute('data-sanctum-skin',current);
 document.body?.setAttribute('data-sanctum-skin',current);
 save(current);
 updateMenu();
 refreshArtwork();
 return current;
}
window.SanctumSkins={
 get:()=>current,
 set,
 resolveArtwork,
 registerArtwork,
 registerArtworkPack,
 registerBackground,
 refreshArtwork,
 artworkCount:()=>artwork.size
};
const selector=document.getElementById('sanctumSkinSelect');
if(selector)selector.addEventListener('change',()=>set(selector.value));
set(read());
if(document.body&&typeof MutationObserver!=='undefined'){
 observer=new MutationObserver(mutations=>{
  // Watch newly rendered cards and image changes, never game state.
  if(mutations.some(m=>m.type==='childList'||m.attributeName==='src'))
   queueRefresh();
 });
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
}
})();
