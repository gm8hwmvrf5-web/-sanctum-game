import { chromium } from 'playwright';

const url='http://127.0.0.1:4173/index.html';
const browser=await chromium.launch({headless:true});
const host=await browser.newPage({viewport:{width:1280,height:720}});
const guest=await browser.newPage({viewport:{width:1280,height:720}});
const reports=[];
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
  await guest.locator('#pname0').fill('Sanctum Guest CI');
  await guest.locator('#mpRoomInput').fill(roomCode.value);
  const enteredCode=await guest.locator('#mpRoomInput').inputValue();
  console.log('LIVE JOIN INPUT:',JSON.stringify({roomCode:roomCode.value,enteredCode,sourceLength:roomCode.value.length,enteredLength:enteredCode.length}));
  await guest.locator('#mpJoinBtn').click();
  await guest.waitForFunction(()=>document.querySelector('.mpRoster')?.textContent?.includes('Sanctum Guest CI'),null,{timeout:15000});
  await host.waitForFunction(()=>document.querySelector('.mpRoster')?.textContent?.includes('Sanctum Guest CI'),null,{timeout:12000});
  const hostUI=await host.evaluate(()=>({status:document.querySelector('.mpStatus')?.textContent,roster:document.querySelector('.mpRoster')?.textContent,setupNames:[...document.querySelectorAll('#setupPlayers input')].map(x=>x.value)}));
  console.log('LIVE SUPABASE LOBBY PASS:',JSON.stringify(hostUI));
}catch(err){
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
