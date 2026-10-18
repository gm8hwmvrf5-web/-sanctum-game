/* High-fidelity visual layer — runs after stable gameplay UI adapters.
   Keep all original events and Supabase handlers intact. */
(()=>{
'use strict';
const root=document.documentElement;
root.classList.add('gothicUiPixelSkin');
const crest=document.getElementById('gothicCenterCrest');
if(crest)crest.src='./assets/ui-gothic/faithful/crest.webp';
const rooms=['gateway','hall','chapel','crypt','boss'];
const frame=document.getElementById('boardSection');
if(frame){
 frame.querySelectorAll('.room').forEach((el,i)=>{
  if(rooms[i])el.dataset.mockupRoom=rooms[i];
 });
}
const game=document.getElementById('gothicPreviewActions');
if(game)game.setAttribute('aria-label','Priest commands: Basic Attack, Place Ward, End Turn, Menu');
})();
