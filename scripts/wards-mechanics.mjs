import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:740}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
const report=await page.evaluate(()=>{
 document.getElementById('playerCount').value='1';
 document.getElementById('startBtn').click();
 const W=window.__sanctumWards;
 if(!S.started||!W)throw Error('Ward game not initialized');
 const original=JSON.stringify(S);
 const result={};
 let counter=0;
 function demon(props={}){
   return {id:'ward-spec-'+(++counter),key:'spec',n:'Ward Trial Demon',g:'Greater Ward Trial Demon',
    family:'Test',hp:40,ghp:60,cur:40,b:2,gb:3,atk:5,gatk:7,a:'',ga:'',ability:'Test ability',
    gability:'Test ability',v:0,gv:0,greater:false,art:'',gart:'',status:{},...props};
 }
 function reset(key,room=0,phase='Priest'){
    S=JSON.parse(original);
    S.rogue.enabled=false;
    S.phase=phase;S.round=1;S.defeats=0;S.bossRevealed=false;
    S.rooms=[[],[],[],[]];S.corruption=[0,0,0,0];S.desecratedRooms=[false,false,false,false];
    S.mana=10;S.altar=20;S.players[0].blood=0;
    const w=W.definitions.find(x=>x.key===key);
    if(!w)throw Error('Unknown ward '+key);
    S.wardcraft={selected:null,offers:[],floor:1,lastPlacementRound:-1,
      active:{key,room,charges:w.charges,phasesLeft:2,lastEnterRound:-1}};
 }
 function assert(test,msg){if(!test)throw Error(msg);}
 // Offensive entry
 reset('cinder',0,'Demon');{const d=demon();S.rooms[0].push(d);triggerEnterRoom(d);assert(d.cur===37&&S.wardcraft.active.charges===1,'Cinder damage');result.cinder=true;}
 // Offensive defeat
 reset('thorns');{const a=demon(),b=demon(),c=demon();S.rooms[0]=[a,b,c];defeatDemon(a);assert(b.cur===38&&c.cur===38,'Thorns adjacent damage');result.thorns=true;}
 // Restraint
 reset('chains',0,'Demon');{const d=demon();S.rooms[0].push(d);triggerEnterRoom(d);assert(d.status.wardBoundThroughRound===2,'Chains duration');result.chains=true;}
 // Backward movement
 reset('bell',1,'Demon');{const d=demon();S.rooms[1].push(d);triggerEnterRoom(d);assert(S.rooms[0].some(x=>x.id===d.id),'Bell movement');result.bell=true;}
 // Suppression
 reset('silence');{const d=demon({a:'phaseManaDrain',v:2});S.rooms[0].push(d);triggerEnterRoom(d);assert(demonCode(d)===null,'Silence ability suppression');result.silence=true;}
 // Altar healing
 reset('lantern');{const d=demon();S.rooms[0].push(d);defeatDemon(d);assert(S.altar===23,'Lantern altar heal');result.lantern=true;}
 // Attack weakening
 reset('vigil',0,'Demon');{const d=demon();S.rooms[0].push(d);assert(moveOneForward(d)===true,'Vigil movement');assert(S.rooms[1][0].id===d.id&&demonAttack(d)===3,'Vigil attack reduction');result.vigil=true;}
 // Corruption reduction
 reset('absolution');{const d=demon();S.rooms[0].push(d);S.corruption[0]=3;S.desecratedRooms[0]=true;defeatDemon(d);assert(S.corruption[0]===1,'Absolution double cleanse');result.absolution=true;}
 // Mana recovery
 reset('siphon');{const d=demon();S.rooms[0].push(d);S.mana=1;defeatDemon(d);assert(S.mana===4,'Siphon mana gain');result.siphon=true;}
 // Killer blood
 reset('chalice');{const d=demon();S.rooms[0].push(d);defeatDemon(d);assert(S.players[0].blood===4,'Chalice killer blood bonus');result.chalice=true;}
 return result;
});
await browser.close();
if(errors.length)throw Error(errors.join('; '));
if(Object.keys(report).length!==10||!Object.values(report).every(Boolean))throw Error('Incomplete Ward mechanic test');
console.log('ALL TEN WARD EFFECTS VERIFIED:',JSON.stringify(report));
