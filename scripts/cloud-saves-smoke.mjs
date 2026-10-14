import {chromium} from 'playwright';

// Cloud account browser regression: two independent devices with a mocked
// Supabase API; does not create real users or modify production save data.
const accounts=new Map(),cloud=new Map();
function fail(message){throw Error(message)}
const backend=async(_source,args)=>{
 const op=args.op,email=args.email,slot=Number(args.slot||args.payload?.slot)||0,key=email+':'+slot;
 if(op==='signup'){
  if(accounts.has(email))return {error:{message:'Account already exists'}};
  const user={id:'user-'+accounts.size,email};
  accounts.set(email,{user,password:args.password});return {data:{user,session:{user}}};
 }
 if(op==='signin'){
  const a=accounts.get(email);
  return a?.password===args.password?{data:{user:a.user,session:{user:a.user}}}:
   {error:{message:'Invalid login credentials'}};
 }
 const account=accounts.get(email);
 if(!account)return {error:{message:'Not authenticated'}};
 if(op==='user')return {data:{user:account.user}};
 if(op==='list')return {data:[...cloud.values()].filter(x=>x.user_id===account.user.id)
  .map(({save_data,...meta})=>meta).sort((a,b)=>a.slot-b.slot)};
 if(op==='upsert'){
  if(args.payload.user_id!==account.user.id)fail('Cross-account save attempted');
  cloud.set(key,structuredClone(args.payload));return {data:null};
 }
 if(op==='load')return {data:{save_data:cloud.get(key)?.save_data||null}};
 if(op==='delete'){cloud.delete(key);return {data:null}};
 return {error:{message:'Unknown request '+op}};
};
const install=async(context)=>{
 await context.exposeBinding('__sanctumCloudBackend',backend);
 await context.addInitScript(()=>{
  function userEmail(){return localStorage.getItem('__mock_account_email')||''}
  function makeClient(_url,_key,opts={}){
   let listener=null;
   const notify=()=>listener?.('SIGNED_IN',userEmail()?{user:{email:userEmail()}}:null);
   return {
    auth:{
     onAuthStateChange(callback){listener=callback;return {data:{subscription:{unsubscribe(){listener=null}}}}},
     async signUp({email,password}){
      const r=await window.__sanctumCloudBackend({op:'signup',email,password});
      if(!r.error){localStorage.setItem('__mock_account_email',email);notify()}
      return {...r,data:r.data||null};
     },
     async signInWithPassword({email,password}){
      const r=await window.__sanctumCloudBackend({op:'signin',email,password});
      if(!r.error){localStorage.setItem('__mock_account_email',email);notify()}
      return {...r,data:r.data||null};
     },
     async getSession(){
      const email=userEmail();
      if(!email)return {data:{session:null}};
      const r=await window.__sanctumCloudBackend({op:'user',email});
      return {data:{session:r.data?.user?{user:r.data.user}:null}};
     },
     async getUser(){
      const email=userEmail();if(!email)return {data:{user:null},error:{message:'Signed out'}};
      const r=await window.__sanctumCloudBackend({op:'user',email});
      return {data:{user:r.data?.user||null},error:r.error||null};
     },
     async signOut(){localStorage.removeItem('__mock_account_email');notify();return {error:null}}
    },
    from(table){
     if(table!=='sanctum_cloud_saves')fail('Unexpected Supabase table '+table);
     let filter={},type='list',payload;
     const q={
      select(){type='list';return this},
      eq(k,v){filter[k]=v;return this},
      order(){return this.execute()},
      maybeSingle(){type='load';return this.execute()},
      upsert(row){type='upsert';payload=row;return this.execute()},
      delete(){type='delete';return this},
      async execute(){
       return window.__sanctumCloudBackend({op:type,email:userEmail(),slot:filter.slot,payload});
      },
      then(resolve,reject){return this.execute().then(resolve,reject)}
     };
     return q;
    }
   };
  }
  window.supabase={createClient:makeClient};
 });
};
const browser=await chromium.launch({headless:true});
const a=await browser.newContext({viewport:{width:1150,height:800},acceptDownloads:true});
const b=await browser.newContext({viewport:{width:844,height:390},acceptDownloads:true});
const errors=[];
try{
 await install(a);await install(b);
 const pc=await a.newPage(),phone=await b.newPage();
 pc.on('pageerror',e=>errors.push('PC: '+e.message));
 phone.on('pageerror',e=>errors.push('phone: '+e.message));
 pc.on('dialog',d=>d.accept());
 phone.on('dialog',d=>d.accept());
 await pc.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
 await pc.evaluate(()=>{
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  if(!S.started)throw Error('PC game did not start');
  S.round=7;S.altar=19;
  if(S.rogue)S.rogue.floor=5;
  clearTurnTimerInterval();
  window.openGameMenu();
 });
 await pc.locator('#pauseCloudSavesBtn').click();
 await pc.locator('#cloudEmail').fill('cross-device@example.test');
 await pc.locator('#cloudPassword').fill('password-test-123');
 await pc.locator('#cloudSignupBtn').click();
 await pc.locator('#cloudAccountSignedIn').waitFor({state:'visible'});
 await pc.locator('.cloud-slot').first().getByRole('button',{name:'Save Current Run'}).click();
 await pc.waitForFunction(()=>SanctumCloudSaves.slotCount===1);
 let meta=cloud.get('cross-device@example.test:1');
 if(meta?.round_number!==7||meta.save_data?.state?.altar!==19)fail('PC cloud slot lost the game state. '+JSON.stringify({round:meta?.round_number,altar:meta?.save_data?.state?.altar,slotKeys:[...cloud.keys()],stateType:typeof meta?.save_data,game:await pc.evaluate(()=>({round:S.round,altar:S.altar}))}));
 if(!meta.save_data.state||meta.save_data.state.players.length!==1)fail('Cloud slot did not save full run.');
 if(JSON.stringify(meta.save_data).includes('data:image/'))fail('Save contained uncompressed art.');
 // Verify browser save migration/upload without touching game state.
 await pc.evaluate(()=>save());
 await pc.locator('#cloudRefreshBtn').click();
 await pc.locator('.cloud-slot').nth(1).getByRole('button',{name:'Upload Browser Save'}).click();
 await pc.waitForFunction(()=>SanctumCloudSaves.slotCount===2);
 if(!cloud.has('cross-device@example.test:2'))fail('Browser save upload failed.');
 // Independent device, no local game to import.
 await phone.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
 await phone.evaluate(()=>window.openGameMenu());
 await phone.locator('#pauseCloudSavesBtn').click();
 await phone.locator('#cloudEmail').fill('cross-device@example.test');
 await phone.locator('#cloudPassword').fill('password-test-123');
 await phone.locator('#cloudLoginBtn').click();
 await phone.locator('#cloudAccountSignedIn').waitFor({state:'visible'});
 await phone.waitForFunction(()=>SanctumCloudSaves.slotCount===2);
 await phone.locator('.cloud-slot').first().getByRole('button',{name:'Load',exact:true}).click();
 await phone.waitForFunction(()=>S.started&&S.round===7&&S.altar===19);
 const result=await phone.evaluate(()=>({
  round:S.round,altar:S.altar,players:S.players.length,
  savedLocal:!!localStorage.getItem('sanctum-save-v2'),
  session:!!SanctumCloudSaves.signedIn
 }));
 if(result.round!==7||result.altar!==19||!result.savedLocal||result.players!==1)
  fail('Cross-device cloud load did not restore the run.');
 // Never replace an active live multiplayer session.
 await phone.evaluate(()=>{
  window.SanctumMultiplayerDev={session:{gameId:'mock-online-room'}};
  window.openGameMenu();
 });
 await phone.locator('#pauseCloudSavesBtn').click();
 const disabled=await phone.locator('.cloud-slot').first().getByRole('button',{name:'Load',exact:true}).isDisabled();
 if(!disabled)fail('Cloud load must be disabled during online multiplayer.');
 await phone.locator('#cloudSignOutBtn').click();
 await phone.locator('#cloudAccountGuest').waitFor({state:'visible'});
 if(errors.length)fail(errors.join('; '));
 console.log('CLOUD SAVE BROWSER SMOKE PASSED:',JSON.stringify({...result,
  uploadedBrowserSave:true,multiplayerProtected:true,independentDevice:true,signOut:true}));
}finally{await a.close();await b.close();await browser.close();}
