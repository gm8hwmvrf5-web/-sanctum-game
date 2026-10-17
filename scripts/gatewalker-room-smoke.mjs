import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Focused Gatewalker destination regression. Do not run a full gameplay audit.
const engine=fs.readFileSync('src/js/10-engine.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');
function extract(name){
 const start=engine.indexOf('function '+name+'(');
 assert(start>=0,'Missing '+name);
 const brace=engine.indexOf('{',start);
 let depth=0;
 for(let i=brace;i<engine.length;i++){
  if(engine[i]==='{')depth++;
  else if(engine[i]==='}'&&--depth===0)return engine.slice(start,i+1);
 }
 throw new Error('Unterminated '+name);
}
let roll=0.05,pick=0,entries=0;
const logged=[];
const S={rooms:[[],[],[],[]],queue:[],round:7,cryptPressureLastArrivalRound:3};
const math=Object.create(Math);
math.random=()=>roll;
const ctx={
 S,Math:math,ROOM_NAMES:['Gateway','Hall','Chapel','Crypt'],
 secureRandomIndex:n=>{assert(n>0&&n<=2);return pick%n},
 log:(...args)=>logged.push(args),
 demonName:d=>d.n,
 triggerEnterPlay:()=>{entries++},
 triggerEnterRoom:()=>{},
 roomDesecrated:()=>false,
 roomConsecrated:()=>false,
 findDemonLocation:d=>S.rooms.flatMap((room,r)=>room.map((item,i)=>({d:item,r,i}))).find(x=>x.d===d)||null,
 checkMerge:()=>{},
 damageDemon:()=>{throw new Error('unexpected damage')}
};
vm.createContext(ctx);
vm.runInContext(extract('pickEnteringDemonRoom'),ctx,{timeout:5000});
vm.runInContext(extract('placeEnteringDemon'),ctx,{timeout:5000});
let serial=0;
function demon(){return {id:'gate-test-'+(++serial),n:'Gate Test Demon',hp:5,cur:5,status:{}}}
function reset(){
 S.rooms=[[],[],[],[]];S.queue=[];
 S.cryptPressureLastArrivalRound=3;
 roll=0.05;pick=0;entries=0;
}
reset();
let d=demon();
assert.equal(ctx.placeEnteringDemon(d),1,'First Gatewalker destination is Hall');
assert.equal(d.status.gatewalker,true,'Hall spawn receives Gatewalker marker');
assert.equal(JSON.parse(JSON.stringify(d)).status.gatewalker,true,'Gatewalker marker survives serialization');
assert.equal(S.rooms[3].length,0,'Crypt remains empty on Hall spawn');
assert.equal(S.cryptPressureLastArrivalRound,3,'Gatewalker does not fake a Crypt arrival');
reset();pick=1;d=demon();
assert.equal(ctx.placeEnteringDemon(d),2,'Second Gatewalker destination is Chapel');
assert.equal(d.status.gatewalker,true,'Chapel spawn receives Gatewalker marker');
assert.equal(S.rooms[3].length,0);
reset();roll=0.099999;pick=1;d=demon();
assert.equal(ctx.placeEnteringDemon(d),2,'10% threshold still permits Gatewalker');
reset();roll=0.10;d=demon();
assert.equal(ctx.placeEnteringDemon(d),0,'10% probability boundary uses Gateway');
assert.equal(!!d.status.gatewalker,false,'Gateway spawn has no Gatewalker marker');
reset();S.rooms[1]=Array.from({length:4},demon);pick=0;d=demon();
assert.equal(ctx.placeEnteringDemon(d),2,'Full Hall reroutes Gatewalker to Chapel');
reset();S.rooms[2]=Array.from({length:4},demon);pick=0;d=demon();
assert.equal(ctx.placeEnteringDemon(d),1,'Full Chapel reroutes Gatewalker to Hall');
reset();S.rooms[1]=Array.from({length:4},demon);
S.rooms[2]=Array.from({length:4},demon);d=demon();
assert.equal(ctx.placeEnteringDemon(d),0,'Full alternates fall back to Gateway');
assert.equal(!!d.status.gatewalker,false,'Fallback does not gain Gatewalker marker');
assert.equal(S.rooms[3].length,0,'Even with both alternates full, no Crypt spawn');
S.rooms[0]=Array.from({length:4},demon);d=demon();
assert.equal(ctx.placeEnteringDemon(d),-1,'All allowed rooms full uses Gate Queue');
assert.equal(S.queue[0],d,'Queued Demon remains intact');
assert.equal(S.rooms[3].length,0,'Queue fallback never enters Crypt');
// Confirm 10% selection can only be Hall/Chapel across a fixed sampling grid.
reset();
let selected=0;
for(let i=0;i<1000;i++){
 roll=i/1000;pick=i%2;
 const room=ctx.pickEnteringDemonRoom();
 assert.notEqual(room,3,'Gatewalker cannot pick Crypt');
 if(room===1||room===2)selected++;
}
assert.equal(selected,100,'Gatewalker chance remains exactly 10% in 1000 evenly spaced samples');
assert(/sanctum-clean-v\d+/.test(worker),'Service worker must have a versioned cache');
console.log('PASS: Gatewalker retains 10% chance; only Hall/Chapel, room-capacity fallback, queue, and persistent marker work.');
