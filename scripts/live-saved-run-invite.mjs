import {chromium} from 'playwright';

// Real Supabase smoke: load a single-player save, host it by join code,
// enroll three different Priest classes, and restore the scaled shared game.
// Leaves the original browser save alone and always closes the test room.
const url='http://127.0.0.1:4173/index.html';
const browser=await chromium.launch({headless:true});
const pages=[];
let roomCode='',hostToken='';
const errors=[];
const assert=(value,message)=>{if(!value)throw Error(message)};
try{
 for(let i=0;i<4;i++){
  const page=await browser.newPage({viewport:{width:1200,height:850}});
  pages.push(page);
  page.on('pageerror',e=>errors.push('Seat '+(i+1)+': '+e.message));
  await page.goto(url,{waitUntil:'load',timeout:45000});
 }
 const host=pages[0];
 host.on('response',async res=>{
  if(!res.url().includes('/rpc/create_sanctum_game')||!res.ok())return;
  try{const data=await res.json();hostToken=(Array.isArray(data)?data[0]:data)?.player_token||''}catch(_){}
 });
 await host.evaluate(()=>{
  window.confirm=()=>true;
  document.getElementById('playerCount').value='1';
  setupPlayersUI();
  document.getElementById('pname0').value='Saved Host';
  document.getElementById('pchar0').value='High Priestess';
  document.getElementById('startBtn').click();
  if(!S.started)throw Error('Could not start source solo game');
  clearTurnTimerInterval();
  S.rogue.floor=10;S.rogue.act=2;
  S.round=18;S.phase='Priest';S.current=0;S.mana=6;
  S.altar=24;S.players[0].blood=6;S.players[0].hand[0].id='preserve-original-hand';
  S.activeRelics=[RELICS[0].key];S.relicMods.basic=1;
  S.rogue.relicXp=21;S.rogue.passageRelics=2;
  S.bossRevealed=true;
  S.boss.hp=140;S.boss.cur=70;S.boss.baseHp=200;S.boss.scaledForPlayers=1;
  S.boss.status={elementalPoisonHits:1};
  const saved=compactSaveJSON();
  if(!applyLoadedSave(saved,'browser save',null))throw Error('Save load before invite failed');
  if(!S.started||S.round!==18)throw Error('Loaded state not preserved');
  localStorage.setItem('sanctum-save-v2',saved);
  if(!openGameMenu())throw Error('Could not open saved-run pause menu');
 });
 await host.locator('#pauseInviteFriendsBtn').click();
 await host.waitForFunction(()=>/^[A-Z2-9]{6}$/.test(
   document.querySelector('.mpRoomCode')?.textContent||''),null,{timeout:16000});
 roomCode=(await host.locator('.mpRoomCode').innerText()).trim();
 assert(roomCode.length===6,'Invite did not create a valid code');
 assert(await host.locator('#mpResumeSavedBtn').isVisible(),'Resume Saved Run not visible to host');
 assert(await host.locator('#startBtn').isDisabled(),'Normal New Game start must be disabled in saved lobby');
 for(let i=1;i<4;i++){
  const guest=pages[i];
  await guest.locator('#pname0').fill('Saved Guest '+i);
  await guest.locator('#mpRoomInput').fill(roomCode);
  await guest.locator('#mpJoinBtn').click();
  await guest.waitForFunction(seat=>window.SanctumMultiplayerDev?.session?.seat===seat,i+1,
   {timeout:16000});
  await guest.locator('#mpSavedPriestChooser').waitFor({state:'visible',timeout:12000});
  const picker=guest.locator('#mpSavedPriestSelect');
  assert(await picker.inputValue()==='', 'Guest default Priest cannot count as confirmed');
  assert(await guest.locator('#mpSavedPriestConfirmBtn').isDisabled(),
    'Confirmation must require an explicit Priest choice');
  if(i===1){
    assert(await guest.locator('#pchar0').isDisabled(),
      'Saved host Priest must be locked on guest devices');
    assert(await guest.locator('#pchar0').inputValue()==='High Priestess',
      'Guest should see the original host Priest');
    const reserved=await picker.locator('option[value="High Priestess"]').isDisabled();
    assert(reserved,'Saved host Priest must be marked unavailable for guests');
    await host.waitForFunction(()=>document.querySelector('#mpSavedRunNotice')?.textContent
      .includes('Waiting for Priest confirmation'),null,{timeout:10000});
    await host.locator('#mpResumeSavedBtn').click();
    await host.waitForFunction(()=>document.querySelector('.mpStatus')?.textContent
      .includes('Confirm Priest'),null,{timeout:10000});
    assert(await host.locator('#mpResumeSavedBtn').isVisible(),
      'Invalid incomplete party must remain in saved-run lobby');
  }
  const cls=['','Oracle','Crusader','Monk'][i];
  await picker.selectOption({label:cls});
  assert((await guest.locator('#mpSavedPriestConfirmation').innerText()).includes('Click Confirm Priest'),
    'Class selection must prompt for confirmation');
  await guest.locator('#mpSavedPriestConfirmBtn').click();
  await guest.waitForFunction(expected=>document.querySelector('#mpSavedPriestConfirmation')?.textContent
    .includes('Confirmed: '+expected),cls,{timeout:18000});
  await host.waitForFunction(({i,cls})=>document.querySelectorAll('.mpRoster .mpSeat')[i]?.textContent
    .includes('✓ '+cls),{i,cls},{timeout:16000});
 }
 await host.waitForFunction(()=>document.querySelectorAll('.mpRoster .mpSeat:not(.empty)').length===4,
  null,{timeout:20000});
 await host.waitForFunction(()=>['Oracle','Crusader','Monk'].every((klass,i)=>
    document.getElementById('pchar'+(i+1))?.value===klass),null,{timeout:18000});
 assert((await host.locator('#mpSavedRunNotice').innerText()).includes('Ready to resume'),
   'Host does not see all Priests confirmed');
 const originalLocal=await host.evaluate(()=>localStorage.getItem('sanctum-save-v2'));
 assert(originalLocal&&JSON.parse(originalLocal).state.players.length===1,
  'Original local solo save was overwritten during invitations');
 await host.locator('#mpResumeSavedBtn').click();
 await host.waitForFunction(()=>window.SanctumMultiplayerDev?.session
    &&!window.SanctumMultiplayerDev.savedInvitePending&&S.players?.length===4,
    null,{timeout:18000});
 const checks=await host.evaluate(()=>({
  players:S.players.map(p=>({name:p.name,char:p.char,cards:p.hand.length})),
  floor:S.rogue.floor,round:S.round,altar:S.altar,
  mana:S.mana,relicXp:S.rogue.relicXp,passageRelics:S.rogue.passageRelics,
  bossHp:S.boss.hp,bossCur:S.boss.cur,bossPoison:S.boss.status?.elementalPoisonHits,
  originalHand:S.players[0].hand.some(c=>c.id==='preserve-original-hand'),
  activeRelics:S.activeRelics.length,deckExpanded:S.multiplayerPriestDeckExpanded,
  turn:S.current,phase:S.phase
 }));
 assert(checks.players.length===4&&checks.players.every((p,i)=>p.cards>=4&&
  p.char===['High Priestess','Oracle','Crusader','Monk'][i]),
  'Saved-run party hands or Priest classes incorrect: '+JSON.stringify(checks.players));
 assert(checks.floor===10&&checks.round===18&&checks.altar===24&&checks.mana===28,
  'Saved-run party resources/progress incorrect: '+JSON.stringify(checks));
 assert(checks.bossHp===250&&checks.bossCur===125&&checks.bossPoison===1,
  'Boss party scaling must preserve damage and Poison: '+JSON.stringify(checks));
 assert(checks.originalHand&&checks.activeRelics===1&&checks.deckExpanded&&
  checks.relicXp===21&&checks.passageRelics===2,
  'Saved-run deck, Relics, or XP altered: '+JSON.stringify(checks));
 for(let i=1;i<4;i++){
  const guest=pages[i];
  await guest.waitForFunction(()=>S.started&&S.players.length===4&&
    S.rogue.floor===10&&S.boss.hp===250&&S.boss.status?.elementalPoisonHits===1,
    null,{timeout:20000});
  const state=await guest.evaluate(()=>({
   floor:S.rogue.floor,hand:S.players[window.SanctumMultiplayerDev.session.seat-1]?.hand.length,
   banner:document.getElementById('mpGameBanner')?.textContent||''
  }));
  assert(state.floor===10&&state.hand>=4,'Guest did not receive saved run state: '+JSON.stringify(state));
 }
 assert(!errors.length,'Browser exceptions: '+errors.join(' | '));
 console.log('LIVE SAVED-RUN INVITE PASSED:',JSON.stringify({
  roomCode,joined:4,originalSavePreserved:true,allGuestHands:true,
  bossHp:checks.bossHp,bossCur:checks.bossCur,bossPoison:checks.bossPoison,
  oldMana:6,scaledMana:checks.mana,floor:checks.floor,relicXp:checks.relicXp
 }));
}catch(e){console.error('SAVED-RUN INVITE FAILED:',e.stack||e.message);process.exitCode=1;
 const debug=await Promise.all(pages.map(p=>p.evaluate(()=>({
  session:window.SanctumMultiplayerDev?.session,
  status:document.querySelector('.mpStatus')?.textContent,
  room:document.querySelector('.mpRoomCode')?.textContent,
  players:S?.players?.length,modal:document.querySelector('#setupModal')?.className
 })).catch(err=>({error:err.message}))));console.error('INVITE DEBUG:',JSON.stringify(debug));
}finally{
 if(hostToken&&roomCode){
  try{await pages[0].evaluate(async ({room,token})=>{
   const sdk=window.supabase;
   const c=sdk.createClient('https://nkucyukzxjofcypaqxor.supabase.co',
    'sb_publishable_NXIee43RqgT7adfNiMJVyg_aPZhSALZ');
   await c.rpc('close_sanctum_game',{p_room_code:room,p_player_token:token});
  },{room:roomCode,token:hostToken})}catch(e){console.warn('Invite CI room cleanup:',e.message)}
 }
 await browser.close();
}
