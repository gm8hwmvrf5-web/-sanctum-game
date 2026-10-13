import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:750}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',msg=>{if(msg.type()==='error'&&!/Supabase/i.test(msg.text()))errors.push(msg.text())});
await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
const result=await page.evaluate(async()=>{
 const errors=[];
 const ws=window.__sanctumWards;
 if(!ws||ws.definitions.length!==10)throw new Error('Missing the 10 Ward definitions');
 if(!ws.definitions.every(w=>w.mana>=0&&w.charges>=1&&w.color&&w.name&&w.desc))throw new Error('Invalid Ward data');
 const artworks=await Promise.all(ws.definitions.map(async ward=>{
   const response=await fetch('./assets/wards/ward-'+ward.key+'.webp',{cache:'no-store'});
   if(!response.ok)throw new Error('Missing high-resolution artwork for '+ward.name);
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<50000)throw new Error('Artwork seems undersized/blurry: '+ward.name);
   const img=await createImageBitmap(new Blob([bytes],{type:'image/webp'}));
   const good=img.width>=800&&img.height>=500;
   img.close();
   if(!good)throw new Error('Ward artwork dimensions too small: '+ward.name);
   return ward.key;
 }));
 if(artworks.length!==10)throw new Error('All ten Ward illustrations are required');
 document.querySelector('#playerCount').value='1';
 document.getElementById('startBtn').click();
 if(!S?.started)throw new Error('Game did not start');
 if(!S?.wardcraft?.offers||S.wardcraft.offers.length!==3)throw new Error('Initial Ward selection not shown');
 const selected=S.wardcraft.offers[0];
 await new Promise(resolve=>setTimeout(resolve,400));
 const draft=document.getElementById('rogueChoiceModal');
 if(draft.classList.contains('hidden')||!document.querySelector('#rogueChoiceGrid .wardDraftChoice'))throw new Error('Opening Ward selection popup is missing');
 const chosenButton=[...document.querySelectorAll('#rogueChoiceGrid .wardDraftChoice')].find(b=>b.textContent.includes(ws.definitions.find(w=>w.key===selected).name));
 if(!chosenButton)throw new Error('Opening Ward not visible as a draft option');
 const artPreview=chosenButton.querySelector('.ward-draft-art');
 if(!artPreview||!getComputedStyle(artPreview).backgroundImage.includes('ward-'+selected+'.webp'))
   throw new Error('Selected Ward popup is not using its dedicated artwork');
 chosenButton.click();
 if(S.wardcraft.selected!==selected)throw new Error('Selecting a Ward failed');
 S.mana=30;S.players[S.current].blood=8;render();
 const selectedWard=ws.definitions.find(x=>x.key===selected);
 const placementRoom=selectedWard.rooms?.[0]??0;
 if(!ws.place(placementRoom))throw new Error('Ward placement rejected');
 const room=document.getElementById('room'+placementRoom).closest('.room');
 if(!room.classList.contains('wardcraft-active')||!room.querySelector('.wardcraft-badge')||!room.querySelector('.wardcraft-illustration'))throw new Error('Room glow/illustration/badge not applied');
 if(!getComputedStyle(room.querySelector('.wardcraft-illustration')).backgroundImage.includes('ward-'+selected+'.webp'))
  throw new Error('Warded room is not using the selected Ward artwork');
 if(S.wardcraft.active.charges!==selectedWard.charges)throw new Error('Wrong Ward charges');
 const manaNow=S.mana,bloodNow=S.players[S.current].blood;
 if(manaNow!==30-selectedWard.mana||bloodNow!==8-selectedWard.blood)throw new Error('Ward cost incorrect');
 if(ws.place(placementRoom)!==false)throw new Error('Allowed second Ward in same turn');
 ws.expire('smoke test');
 render();
 if(room.classList.contains('wardcraft-active'))throw new Error('Room overlay remained after Ward expiry');
 // Verify first-frame Cinder damage, once-per-round gating and clean phase expiry.
 const d=S.rooms[0]?.[0];
 if(!d)throw new Error('No opening Demon to exercise a Ward');
 d.cur=Math.max(d.cur,25);
 S.wardcraft.active={key:'cinder',room:0,charges:2,phasesLeft:2,lastEnterRound:-1};
 S.phase='Demon';
 const health=d.cur,initialRound=S.round;
 triggerEnterRoom(d);
 const damaged=d.cur===health-3&&S.wardcraft.active?.charges===1;
 triggerEnterRoom(d);
 const once=d.cur===health-3&&S.wardcraft.active?.charges===1;
 if(!damaged||!once)throw new Error('Cinder Sigil entry trigger or once-per-round rule failed');
 S.phase='Priest';
 // All other ten Ward definitions remain serializable in save and multiplayer state.
 const cloned=JSON.parse(JSON.stringify(S.wardcraft));
 if(cloned.active?.key!=='cinder')throw new Error('Ward state not serializable');
 return {wardDefinitions:ws.definitions.length,artworksHD:artworks.length,offered:3,selected,placed:true,overlay:true,costs:true,cinderDamage:true,oncePerPhase:true,room:ROOM_NAMES[placementRoom],initialRound};
});
await browser.close();
if(errors.length)throw new Error('Wardcraft console errors: '+errors.join('; '));
console.log('WARDCRAFT BROWSER SMOKE PASSED:',JSON.stringify(result));
