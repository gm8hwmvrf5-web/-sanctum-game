import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Focused blood-bond regression: no full game audit or Supabase connection.
const mod=fs.readFileSync('src/js/88-linked-demons.js','utf8');
const engine=fs.readFileSync('src/js/10-engine.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
let roll=0,serial=0,damage=0;
const log=[];
const math=Object.create(Math);
math.random=()=>roll;
const S={rooms:[[],[],[],[]],queue:[],phase:'Priest',difficulty:'standard'};
const near=d=>S.rooms.some(room=>room.includes(d));
const ctx={S,Math:math,window:null,
 log:(...x)=>log.push(x),
 demonName:d=>d.n,
 document:{querySelectorAll:()=>[]},
 render:()=>{},
 demonMaxHP:d=>d.hp+(Number(d?.status?.extraHpBonus)||0),
 demonAttack:d=>d.atk,
 placeEnteringDemon(d){S.rooms[0].push(d);return 0},
 defeatDemon(d){for(const room of S.rooms){const i=room.indexOf(d);if(i>=0)room.splice(i,1)};return true},
 moveOneForward(d){let r=S.rooms.findIndex(room=>room.includes(d));if(r<0)return false;
 S.rooms[r].splice(S.rooms[r].indexOf(d),1);if(r===3)return true;
 S.rooms[r+1].push(d);return true;},
 checkMerge(){return false}
};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(mod,ctx,{timeout:5000});
const feat=ctx.__sanctumLinkedDemons;
assert.equal(feat.chance,.15);
function d(key){return {id:'bond-'+(++serial),key,n:key,hp:10,cur:10,atk:3,status:{}}}
const a=d('A'),b=d('B'),c=d('C');
ctx.placeEnteringDemon(a);
assert.equal(ctx.demonAttack(a),3,'Cannot bond a lone Demon');
ctx.placeEnteringDemon(b);
assert.equal(feat.partner(a),b,'Entering Demon bonds to an existing Demon');
assert.equal(feat.partner(b),a,'Pairing must be reciprocal');
assert.equal(ctx.demonAttack(a),4,'Active bond adds +1 Attack');
assert.equal(ctx.demonAttack(b),4);
assert.equal(a.status.bloodBondPartnerId,b.id,'Bond stored in state');
assert.equal(JSON.parse(JSON.stringify(S)).rooms[0][0].status.bloodBondPartnerId,b.id,'Bond serializes');
roll=.15;ctx.placeEnteringDemon(c);
assert.equal(feat.partner(c),null,'15% boundary must not create bond');
const before=ctx.demonMaxHP(b);
ctx.defeatDemon(a);
assert.equal(feat.partner(b),null,'Defeat breaks both halves of the bond');
assert.equal(ctx.demonAttack(b),5,'Survivor gets permanent +2 Rage Attack, no +1 link bonus');
assert.equal(ctx.demonMaxHP(b),before+2,'Survivor gets 20% of 10 as extra maximum HP');
assert.equal(b.cur,12,'Survivor heals by its bonus max HP');
assert.equal(b.status.bloodBondSpent,true,'Survivor cannot re-link');
assert.equal(feat.tryLink(b),false);
assert.equal(ctx.demonAttack(c),3);
ctx.render();
assert.equal(ctx.demonAttack(b),5,'Render must not stack Rage');
const copy=JSON.parse(JSON.stringify(S));
S.rooms=copy.rooms;ctx.render();
assert.equal(ctx.demonAttack(S.rooms[0][0]),5,'Saved/reloaded Rage survives');
S.rooms=[[],[],[],[]];roll=0;
const e=d('E'),f=d('F');
ctx.placeEnteringDemon(e);ctx.placeEnteringDemon(f);
S.rooms[0]=[];S.rooms[3]=[e,f];
assert.equal(ctx.moveOneForward(e),true,'Demon reaches Altar');
assert.equal(feat.partner(f),null,'Altar escape dissolves link');
assert.equal(ctx.demonAttack(f),3,'Altar escape does NOT enrage partner');
S.rooms=[[],[],[],[]];roll=0;
const g=d('G'),h=d('H');ctx.placeEnteringDemon(g);ctx.placeEnteringDemon(h);
assert(feat.isLinked(g));
ctx.checkMerge=function(){S.rooms[0].splice(S.rooms[0].indexOf(g),1);return true};
const i=d('I');
ctx.placeEnteringDemon(i);
assert.equal(feat.isLinked(i),false,'New card does not inherit stale bond');
assert(html.includes('./src/js/88-linked-demons.js?v=clean75'));
assert(html.includes('./src/styles/linked-demons.css?v=clean75'));
assert(sw.includes("'./src/js/88-linked-demons.js'"));
assert(sw.includes("'./src/styles/linked-demons.css'"));
assert(/sanctum-clean-v\d+/.test(sw));
assert(engine.includes('function defeatDemon('));
console.log('PASS: Blood Bonds link, display +1 ATK, survive save, break on defeat into +2 ATK/+20% HP Rage, and dissolve on Altar exit.');
