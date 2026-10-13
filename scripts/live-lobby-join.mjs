import { chromium } from 'playwright';

const url='http://127.0.0.1:4173/index.html';
const browser=await chromium.launch({headless:true});
const host=await browser.newPage({viewport:{width:1280,height:720}});
const guest=await browser.newPage({viewport:{width:1280,height:720}});
const reports=[];
const hostRosterRequests=[];
host.on('request',req=>{
  if(req.method()==='GET'&&req.url().includes('/rest/v1/players?')){
    hostRosterRequests.push({at:Date.now(),url:req.url()});
  }
});
let hostToken=null;
const roomCode={value:''};
for(const [label,page] of [['host',host],['guest',guest]]){
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')reports.push(label+' '+m.type()+': '+m.text());});
  page.on('pageerror',e=>reports.push(label+' error: '+e.message));
}
host.on('response',async response=>{
  if(!response.url().includes('/rpc/create_sanctum_game')||!response.ok())return;
  try{
    const d=await response.json();
    const row=Array.isArray(d)?d[0]:d;
    hostToken=row?.player_token||null;
  }catch{}
});
try{
  await Promise.all([host.goto(url,{waitUntil:'load',timeout:45000}),guest.goto(url,{waitUntil:'load',timeout:45000})]);
  await host.locator('#pname0').fill('Sanctum Host CI');
  await host.locator('#mpHostBtn').click();
  await host.waitForFunction(()=>/^[A-Z2-9]{6}$/.test(document.querySelector('.mpRoomCode')?.textContent?.trim()||''),null,{timeout:15000});
  roomCode.value=(await host.locator('.mpRoomCode').innerText()).trim();
  await host.waitForFunction(()=>document.querySelector('.mpRoster')?.textContent?.includes('Sanctum Host CI'),null,{timeout:10000});
  // Confirm that the host continues making fresh uncached roster requests
  // once per second even when no player has joined yet.
  await host.waitForTimeout(2400);
  const polls=hostRosterRequests.slice();
  if(!polls.some((a,i)=>polls.slice(i+1).some(b=>b.at-a.at>=650&&b.at-a.at<=1600))){
    throw new Error('Host did not poll roster approximately once per second: '+JSON.stringify(polls.map(x=>x.at)));
  }
  if(new Set(polls.map(r=>r.url)).size<2){
    throw new Error('Host roster requests reused a cached URL instead of fetching fresh');
  }
  await guest.locator('#pname0').fill('Sanctum Guest CI');
  await guest.locator('#mpRoomInput').fill(roomCode.value);
  const enteredCode=await guest.locator('#mpRoomInput').inputValue();
  console.log('LIVE JOIN INPUT:',JSON.stringify({roomCode:roomCode.value,enteredCode,sourceLength:roomCode.value.length,enteredLength:enteredCode.length}));
  await guest.locator('#mpJoinBtn').click();
  await guest.waitForFunction(()=>document.querySelector('.mpRoster')?.textContent?.includes('Sanctum Guest CI'),null,{timeout:15000});
  await host.waitForFunction(()=>document.querySelector('.mpRoster')?.textContent?.includes('Sanctum Guest CI'),null,{timeout:12000});
  const hostUI=await host.evaluate(()=>({status:document.querySelector('.mpStatus')?.textContent,roster:document.querySelector('.mpRoster')?.textContent,setupNames:[...document.querySelectorAll('#setupPlayers input')].map(x=>x.value)}));
  console.log('LIVE SUPABASE LOBBY PASS:',JSON.stringify(hostUI));

  // Exercise a multiplayer Priest Draft with real browser assets. The
  // recovery watchdog must not replace its cards once per second.
  await host.locator('#startBtn').click();
  await host.waitForFunction(()=>S?.started&&
    window.SanctumMultiplayerDev?.authoritativeActiveSeat===1,null,{timeout:20000});
  // Wardcraft must not interrupt the opening combat. The first shared Ward
  // draft will be offered on combat passage 3, not when the host starts a game.
  await guest.waitForFunction(()=>S?.started&&S?.wardcraft?.combatPassages===1,
    null,{timeout:20000});
  const wardOpening=await Promise.all([host,guest].map(page=>page.evaluate(()=>({
    count:S?.wardcraft?.combatPassages,
    offers:S?.wardcraft?.offers?.length,
    selected:S?.wardcraft?.selected,
    wardVote:!!(S?.multiplayerVote?.open&&S.multiplayerVote.options?.some(o=>String(o.actionKey||'').startsWith('ward:'))),
    visibleDrafts:document.querySelectorAll('#rogueChoiceGrid .mpGroupVoteOption.wardDraftChoice').length
  }))));
  if(wardOpening.some(w=>w.count!==1||w.offers!==0||w.selected||w.wardVote||w.visibleDrafts!==0))
    throw new Error('Opening multiplayer Ward draft occurred before passage 3: '+JSON.stringify(wardOpening));
  console.log('LIVE MULTIPLAYER WARD CADENCE PASS:',JSON.stringify(wardOpening));

  // Regression: the shared-state restore path used to replace Priest cards
  // with base definitions, deleting empowered status and merge discounts.
  await host.evaluate(()=>{
    const base=PRIEST.find(c=>c.n==='Holy Bolt');
    if(!base)throw new Error('Holy Bolt missing from Priest deck definitions');
    const priest=S.players[0];
    priest.hand=[
      {...base,id:'ci-empower-keep',empowered:false},
      {...base,id:'ci-empower-sacrifice',empowered:false}
    ];
    S.mergeManaDiscount=1;
    S.mergeBloodDiscount=1;
    empowerCard('ci-empower-keep');
    const card=S.players[0].hand.find(c=>c.id==='ci-empower-keep');
    if(!card?.empowered||card.empManaDiscount!==1||card.empBloodDiscount!==1){
      throw new Error('Local Priest empowerment was not applied');
    }
  });
  if(!await host.evaluate(()=>window.SanctumMultiplayerDev.push())){
    throw new Error('Could not synchronize empowered Priest card to Supabase');
  }
  const checkEmpowered=()=>S?.players?.[0]?.hand?.some(c=>
    c.id==='ci-empower-keep'&&c.empowered===true&&
    c.empManaDiscount===1&&c.empBloodDiscount===1&&
    c.empowerPaid===false);
  await guest.waitForFunction(checkEmpowered,null,{timeout:15000});
  await host.evaluate(()=>window.SanctumMultiplayerDev.refresh());
  await host.waitForFunction(checkEmpowered,null,{timeout:12000});
  await guest.evaluate(()=>window.SanctumMultiplayerDev.refresh());
  await guest.waitForFunction(checkEmpowered,null,{timeout:12000});
  const empoweredCardLabel=await host.locator('#handContent .empoweredCard').first().innerText();
  if(!empoweredCardLabel.includes('EMPOWERED')){
    throw new Error('Restored Priest card is not rendered as Empowered');
  }
  console.log('LIVE EMPOWERED PRIEST SYNC PASS: card and merge discounts survive refresh on both players.');

  await host.evaluate(()=>{
    const choices=PRIEST.slice(0,3).map(c=>({
      title:c.n,desc:c.e,reward:'Empowered: '+c.x,
      voteCard:c.n,voteEmpowered:c.x,cls:'rogueDraftCard',
      action:()=>{}
    }));
    if(!window.__sanctumMultiplayerGroupChoice(
      {eyebrow:'Priest Draft',title:'Choose One Card',text:'Select a Priest card.'},
      choices))throw new Error('Multiplayer Priest Draft choice was not accepted');
  });
  await host.waitForFunction(()=>
    document.querySelectorAll('#rogueChoiceGrid .mpGroupVoteOption.rogueDraftCard .rogueDraftArt img').length===3,
    null,{timeout:16000});
  await host.waitForFunction(()=>
    [...document.querySelectorAll('#rogueChoiceGrid .mpGroupVoteOption.rogueDraftCard .rogueDraftArt img')]
      .every(img=>img.complete&&img.naturalWidth>0),null,{timeout:15000});
  await host.evaluate(()=>{
    window.__sanctumDraftOriginalCards=[...document.querySelectorAll('#rogueChoiceGrid .mpGroupVoteOption.rogueDraftCard')];
  });
  await host.waitForTimeout(2400);
  const draftStable=await host.evaluate(()=>{
    const current=[...document.querySelectorAll('#rogueChoiceGrid .mpGroupVoteOption.rogueDraftCard')];
    return current.length===3&&
      current.every((card,i)=>card===window.__sanctumDraftOriginalCards[i])&&
      current.every(card=>card.querySelector('img')?.naturalWidth>0);
  });
  if(!draftStable)throw new Error('Priest Draft cards changed or lost artwork during 1-second recovery watchdog');
  console.log('LIVE PRIEST DRAFT PASS: artwork loaded and card elements stayed stable across watchdog refreshes.');
}catch(err){
  const before=await host.evaluate(()=>({
    status:document.querySelector('.mpStatus')?.textContent,
    roster:document.querySelector('.mpRoster')?.textContent
  })).catch(e=>({error:e.message}));
  try{
    await host.evaluate(()=>window.SanctumMultiplayerDev.refresh());
    await host.waitForTimeout(600);
  }catch(manualErr){console.error('MANUAL REFRESH ERROR:',manualErr.message);}
  const after=await host.evaluate(()=>({
    status:document.querySelector('.mpStatus')?.textContent,
    roster:document.querySelector('.mpRoster')?.textContent
  })).catch(e=>({error:e.message}));
  console.error('HOST MANUAL REFRESH CHECK:',JSON.stringify({before,after}));
  const details=await Promise.all([host,guest].map(p=>p.evaluate(()=>({status:document.querySelector('.mpStatus')?.textContent,input:document.querySelector('#mpRoomInput')?.value,roster:document.querySelector('.mpRoster')?.textContent,session:window.SanctumMultiplayerDev?.session,setupNames:[...document.querySelectorAll('#setupPlayers input')].map(x=>x.value)})).catch(e=>({error:e.message}))));
  console.error('LIVE SUPABASE LOBBY FAILURE:',err.message);
  console.error('DETAILS:',JSON.stringify(details));
  console.error('BROWSER:',JSON.stringify(reports.slice(-40)));
  process.exitCode=1;
}finally{
  if(hostToken&&roomCode.value){
    try{
      await host.evaluate(async ({room,token})=>{
        const client=window.supabase.createClient('https://nkucyukzxjofcypaqxor.supabase.co','sb_publishable_NXIee43RqgT7adfNiMJVyg_aPZhSALZ');
        await client.rpc('close_sanctum_game',{p_room_code:room,p_player_token:token});
      },{room:roomCode.value,token:hostToken});
    }catch(err){console.warn('Test room cleanup failed:',err.message);}
  }
  await browser.close();
}
