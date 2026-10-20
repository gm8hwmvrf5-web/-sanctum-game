/* Per-device display aspect ratio. Never stored in S or Supabase. */
(()=>{
 'use strict';
 if(window.SanctumAspectRatio)return;
 const KEY='sanctum_display_aspect_v1';
 const OPTIONS=new Set(['auto','19.5:9','4:3']);
 const NOTES={
  auto:'Automatic matches your screen. Change this at any time; it only affects your device, not multiplayer gameplay.',
  '19.5:9':'Widescreen layout selected. The game uses a 19.5:9 display width when space allows; menus and cards stay scrollable.',
  '4:3':'Tablet layout selected. The game uses a compact 4:3 display width when space allows; menus and cards stay scrollable.'
 };
 const sanitize=value=>OPTIONS.has(value)?value:'auto';
 let current='auto';
 try{current=sanitize(localStorage.getItem(KEY))}catch(_){}
 function apply(){
  const root=document.documentElement;
  if(current==='auto')delete root.dataset.sanctumAspect;
  else root.dataset.sanctumAspect=current;
  const select=document.getElementById('aspectRatioSelect');
  if(select&&select.value!==current)select.value=current;
  const hint=document.getElementById('aspectRatioHint');
  if(hint)hint.textContent=NOTES[current];
 }
 function set(value){
  current=sanitize(value);
  apply();
  try{localStorage.setItem(KEY,current)}catch(_){}
 }
 function bind(){
  const select=document.getElementById('aspectRatioSelect');
  if(select&&!select.dataset.aspectBound){
   select.dataset.aspectBound='1';
   select.addEventListener('change',()=>set(select.value));
  }
  apply();
 }
 // Apply stored preference immediately when this script executes, rather
 // than waiting for game startup or multiplayer reconciliation.
 apply();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
 else bind();
 window.SanctumAspectRatio={
  get value(){return current;},
  set,apply
 };
})();
