/* Sanctum account and private cloud saves.
 * Separate Supabase Auth client: existing anonymous room/turn client stays unchanged.
 * No game state changes except explicit, confirmed loads. */
(()=>{
 'use strict';
 if(window.SanctumCloudSaves)return;
 const URL='https://nkucyukzxjofcypaqxor.supabase.co';
 const KEY='sb_publishable_NXIee43RqgT7adfNiMJVyg_aPZhSALZ';
 const TABLE='sanctum_cloud_saves';
 const root=document.getElementById('cloudSaveModal');
 const byId=id=>document.getElementById(id);
 if(!root)return;
 let client=null,user=null,slots=[],busy=false,authListener=null;
 const authView=byId('cloudAccountGuest'),accountView=byId('cloudAccountSignedIn');
 const statusEl=byId('cloudSaveStatus'),slotList=byId('cloudSaveSlots');
 const authEmail=byId('cloudEmail'),authPassword=byId('cloudPassword');
 const safeErr=error=>{
  if(!error)return 'Unknown cloud service error.';
  const message=String(error.message||error).slice(0,260);
  if(/Failed to fetch|NetworkError|offline/i.test(message))return 'Cannot reach Supabase. Check your internet connection.';
  return message;
 };
 function say(message,failed=false){
  statusEl.textContent=message;
  statusEl.classList.toggle('cloud-error',!!failed);
 }
 function setBusy(value){
  busy=!!value;
  root.querySelectorAll('button').forEach(btn=>{
   if(btn.id==='cloudSaveClose')return;
   btn.disabled=busy;
  });
 }
 function onlineRoom(){
  try{return !!window.SanctumMultiplayerDev?.session}catch(_){return false}
 }
 function snapshot(raw){
  const parsed=typeof raw==='string'?JSON.parse(raw):raw;
  const state=parsed?.state||parsed;
  if(!state||!Array.isArray(state.players)||!state.started||!Array.isArray(state.rooms))
   throw Error('This is not a started Sanctum saved game.');
  const cleaned=JSON.parse(JSON.stringify(parsed,(key,value)=>
   (key==='art'||key==='gart')?undefined:value));
  return {parsed:cleaned,state,round:Math.max(1,Math.floor(Number(state.round)||1)),
   floor:Math.max(1,Math.floor(Number(state.rogue?.floor||state.rogue?.floorNumber||state.floor)||1)),
   priests:state.players.map(p=>String(p?.name||p?.char||'Priest')).join(', ').slice(0,160)};
 }
 function labelTime(time){
  if(!time)return 'Time unavailable';
  const d=new Date(time);
  return Number.isNaN(d.getTime())?'Time unavailable':d.toLocaleString();
 }
 function element(tag,className,value){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(value!=null)node.textContent=String(value);
  return node;
 }
 function btn(label,callback,disabled=false){
  const node=element('button','btn',label);node.type='button';node.disabled=disabled||busy;
  node.addEventListener('click',callback);return node;
 }
 function render(){
  authView.hidden=!!user;
  accountView.hidden=!user;
  byId('cloudAccountEmail').textContent=user?.email||'';
  slotList.replaceChildren();
  if(!user)return;
  const browserReady=!!(typeof readBrowserSave==='function'&&readBrowserSave().raw);
  for(let number=1;number<=3;number++){
   const existing=slots.find(s=>Number(s.slot)===number);
   const row=element('article','cloud-slot');
   const heading=element('div','cloud-slot-head');
   heading.appendChild(element('strong','', 'Slot '+number));
   heading.appendChild(element('span',existing?'cloud-slot-filled':'cloud-slot-empty',existing?'Saved':'Empty'));
   row.appendChild(heading);
   row.appendChild(element('div','cloud-slot-detail',existing?
    ('Round '+existing.round_number+' • Floor '+existing.floor_number+
     (existing.priest_names?' • '+existing.priest_names:'')+
     ' • '+labelTime(existing.updated_at)):
    'No cloud save in this slot.'));
   const actions=element('div','cloud-slot-actions');
   actions.appendChild(btn(existing?'Overwrite with Current Run':'Save Current Run',()=>saveSlot(number,'current'),!S?.started||onlineRoom()));
   actions.appendChild(btn('Upload Browser Save',()=>saveSlot(number,'browser'),!browserReady||onlineRoom()));
   actions.appendChild(btn('Load',()=>loadSlot(number),!existing||onlineRoom()));
   actions.appendChild(btn('Delete',()=>deleteSlot(number),!existing));
   row.appendChild(actions);slotList.appendChild(row);
  }
  const caveat=byId('cloudRoomNotice');
  if(caveat)caveat.hidden=!onlineRoom();
 }
 function showUser(next){
  user=next||null;
  authPassword.value='';
  render();
 }
 function close(){
  root.classList.add('hidden');
  byId('pauseCloudSavesBtn')?.focus();
 }
 async function sdk(){
  if(window.supabase?.createClient)return window.supabase;
  await new Promise((resolve,reject)=>{
   const script=document.querySelector('script[data-sanctum-supabase]');
   if(script){
    if(window.supabase?.createClient){resolve();return;}
    script.addEventListener('load',resolve,{once:true});
    script.addEventListener('error',()=>reject(Error('Could not load Supabase.')),{once:true});
    return;
   }
   const next=document.createElement('script');
   next.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
   next.async=true;next.dataset.sanctumSupabase='1';
   next.onload=resolve;
   next.onerror=()=>reject(Error('Could not load Supabase.'));
   document.head.appendChild(next);
  });
  if(!window.supabase?.createClient)throw Error('The Supabase SDK is unavailable.');
  return window.supabase;
 }
 async function connect(){
  if(client)return client;
  const lib=await sdk();
  client=lib.createClient(URL,KEY,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
    storageKey:'sanctum_cloud_account_auth_v1'}
  });
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
   // Avoid additional Supabase calls inside auth callbacks.
   user=session?.user||null;
   setTimeout(()=>{if(!root.classList.contains('hidden')){render();refresh().catch(console.warn)}},0);
  });
  authListener=subscription;
  return client;
 }
 async function ensureUser(){
  await connect();
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user){showUser(null);throw Error('Please sign in to your Sanctum account first.');}
  showUser(data.user);
  return data.user;
 }
 async function refresh(){
  if(!client)return;
  const {data:sessionData}=await client.auth.getSession();
  if(!sessionData?.session){
   slots=[];showUser(null);
   say('Sign in or create an account to save your runs on other devices.');
   return;
  }
  const {data,error:authError}=await client.auth.getUser();
  if(authError||!data?.user){
   slots=[];showUser(null);say('Your session expired. Please sign in again.',true);return;
  }
  user=data.user;
  const {data:rows,error}=await client.from(TABLE)
   .select('slot,label,round_number,floor_number,priest_names,updated_at')
   .eq('user_id',user.id).order('slot',{ascending:true});
  if(error)throw error;
  slots=rows||[];render();
  say('Signed in. Your three private cloud-save slots are ready.');
 }
 async function run(fn){
  if(busy)return;
  setBusy(true);
  try{await fn()}catch(error){console.warn('Sanctum cloud saves:',error);say(safeErr(error),true)}
  finally{setBusy(false);render()}
 }
 async function account(action){
  await run(async()=>{
   const email=authEmail.value.trim(),password=authPassword.value;
   if(!email||!email.includes('@'))throw Error('Enter a valid email address.');
   if(password.length<6)throw Error('Enter a password of at least 6 characters.');
   await connect();
   const response=action==='signup'?
    await client.auth.signUp({email,password}):
    await client.auth.signInWithPassword({email,password});
   if(response.error)throw response.error;
   authPassword.value='';
   if(response.data?.session?.user){
    showUser(response.data.user);await refresh();
   }else{
    say('Account created. If email confirmation is enabled, open the confirmation email, then return and sign in.');
   }
  });
 }
 async function saveSlot(number,source){
  await run(async()=>{
   if(onlineRoom())throw Error('Cloud saves are disabled in active multiplayer rooms. Use the room session to continue together.');
   const who=await ensureUser();
   let raw;
   if(source==='browser'){
    const info=readBrowserSave();
    if(!info.raw)throw Error('No browser save exists on this device.');
    raw=info.raw;
   }else{
    if(!S?.started)throw Error('Start or load a game before saving.');
    raw=compactSaveJSON();
   }
   const snap=snapshot(raw);
   const previous=slots.find(row=>Number(row.slot)===number);
   if(previous&&!window.confirm('Overwrite cloud slot '+number+'? The previous cloud save will be replaced.'))return;
   const payload={user_id:who.id,slot:number,label:'Saved Run',
    round_number:snap.round,floor_number:snap.floor,priest_names:snap.priests,
    save_data:snap.parsed,updated_at:new Date().toISOString()};
   const {error}=await client.from(TABLE).upsert(payload,{onConflict:'user_id,slot'});
   if(error)throw error;
   await refresh();
   say('Cloud slot '+number+' saved. Sign in on another device to load it.');
  });
 }
 async function loadSlot(number){
  await run(async()=>{
   if(onlineRoom())throw Error('Cannot replace game state during an active multiplayer room.');
   const who=await ensureUser();
   const {data,error}=await client.from(TABLE).select('save_data')
    .eq('user_id',who.id).eq('slot',number).maybeSingle();
   if(error)throw error;
   if(!data?.save_data)throw Error('Cloud slot '+number+' is empty.');
   const parsed=snapshot(data.save_data);
   // applyLoadedSave already confirms replacement when the current run is active.
   close();
   if(!applyLoadedSave(JSON.stringify(parsed.parsed),'cloud save slot '+number,null)){
    say('Cloud save was not loaded.',true);
    root.classList.remove('hidden');
    return;
   }
   try{localStorage.setItem('sanctum-save-v2',compactSaveJSON())}catch(_){}
   showGameStatus('Cloud slot '+number+' loaded on this device.','good');
  });
 }
 async function deleteSlot(number){
  await run(async()=>{
   const who=await ensureUser();
   if(!window.confirm('Permanently delete cloud save slot '+number+'? This does not delete local saves.'))return;
   const {error}=await client.from(TABLE).delete().eq('user_id',who.id).eq('slot',number);
   if(error)throw error;
   await refresh();say('Cloud slot '+number+' deleted.');
  });
 }
 async function open(){
  root.classList.remove('hidden');
  say('Connecting to your account…');
  await run(async()=>{await connect();await refresh()});
 }
 byId('pauseCloudSavesBtn')?.addEventListener('click',open);
 byId('cloudSaveClose')?.addEventListener('click',close);
 byId('cloudLoginBtn')?.addEventListener('click',()=>account('login'));
 byId('cloudSignupBtn')?.addEventListener('click',()=>account('signup'));
 byId('cloudSignOutBtn')?.addEventListener('click',()=>run(async()=>{
  await connect();
  const {error}=await client.auth.signOut();if(error)throw error;
  slots=[];showUser(null);
  say('Signed out. Local browser saves are unchanged.');
 }));
 byId('cloudRefreshBtn')?.addEventListener('click',()=>run(refresh));
 authPassword?.addEventListener('keydown',e=>{if(e.key==='Enter')account('login')});
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!root.classList.contains('hidden')){
   e.preventDefault();e.stopImmediatePropagation();close();
  }
 },true);
 window.SanctumCloudSaves={
  open,close,refresh,saveSlot,loadSlot,
  get signedIn(){return !!user},
  get slotCount(){return slots.length}
 };
})();
