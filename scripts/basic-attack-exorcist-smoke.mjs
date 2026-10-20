import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Only test the changed Attack/Relic and Exorcist paths; do not run a balance audit.
const engine=fs.readFileSync('src/js/10-engine.js','utf8');
const rogue=fs.readFileSync('src/js/30-roguelite.js','utf8');
const data=fs.readFileSync('src/js/00-data.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');
function extract(source,name){
 const start=source.indexOf('function '+name+'(');
 assert(start!==-1,'Missing function '+name);
 const brace=source.indexOf('{',start);
 let depth=0;
 for(let i=brace;i<source.length;i++){
  if(source[i]==='{')depth++;
  else if(source[i]==='}'&&!--depth)return (source.slice(Math.max(0,start-6),start)==='async '?'async ':'')+source.slice(start,i+1);
 }
 throw new Error('Unbalanced function '+name);
}
const logs=[];
let target={kind:'boss'};
let amount=null;
const ctx={
 S:{
  difficulty:'standard',relicMods:{basic:0,hand:0,ritual:0,crit:0},activeRelics:[],relicDeck:['xp-one','xp-two','xp-three'],
  rogue:{enabled:true,legacyBasicAttackBonus:0,relicXp:0,xpRelics:0,passageRelics:0,pendingBasicRelicXp:0}
 },
 log:(...args)=>logs.push(args),
 rogueState:()=>ctx.S.rogue,
 rogueLegacyBasicAttackBonus:()=>ctx.S.rogue.legacyBasicAttackBonus,
 rogueliteRenderHud:()=>{},
 pullRelic:()=>{ctx.S.relicDeck.pop();ctx.S.activeRelics.push('xp-test');return {key:'xp-test'}},
 chooseDamageTarget:async()=>target,
 allDemons:()=>[],
 chooseVisualDemonTargets:async()=>null,
 ritualIsHalved:()=>false,
 ritualScale:n=>Math.ceil(n*1.2),
 ritualBoost:n=>Math.ceil(n*1.2)+(ctx.S.relicMods.ritual||0),
 damageBoss:n=>{amount=n},
 damageDemon:(d,n)=>{amount=n},
 dealDamageTarget:(x,n)=>{amount=n}
};
ctx.window=ctx;
vm.createContext(ctx);
for(const fn of ['basicAttackCap','basicAttackDamage','applyRelic','resolveRitual'])
 vm.runInContext(extract(engine,fn),ctx,{timeout:5000});
const overStart=rogue.indexOf('window.basicAttackDamage=function(){');
const overEnd=rogue.indexOf('\n};',overStart);
assert(overStart>=0&&overEnd>overStart);
vm.runInContext(rogue.slice(overStart,overEnd+3),ctx,{timeout:5000});
assert.equal(ctx.basicAttackDamage(),2,'Baseline attack must be 2');
ctx.S.rogue.legacyBasicAttackBonus=2;
assert.equal(ctx.basicAttackDamage(),4,'Legacy bonus must count toward the cap');
ctx.applyRelic({key:'within',n:'Within Cap',effect:'Basic +1',mods:{basic:1}});
assert.equal(ctx.basicAttackDamage(),5);
ctx.applyRelic({key:'toward',n:'Toward Cap',effect:'Basic +2',mods:{basic:2}});
assert.equal(ctx.basicAttackDamage(),7);
assert.equal(ctx.S.rogue.pendingBasicRelicXp,0,'Below cap must not award XP');
ctx.applyRelic({key:'hybrid',n:'Hybrid',effect:'Basic +1, hand +1',mods:{basic:1,hand:1}});
assert.equal(ctx.basicAttackDamage(),8,'Easy/Standard attacks cap at 8');
assert.equal(ctx.S.rogue.pendingBasicRelicXp,0,'Reaching exactly 8 should not award XP');
assert.equal(ctx.S.relicMods.hand,1,'Hybrid non-basic bonus must remain active');
ctx.applyRelic({key:'over',n:'Over Cap',effect:'Basic +1',mods:{basic:1}});
assert.equal(ctx.basicAttackDamage(),8);
assert.equal(ctx.S.rogue.pendingBasicRelicXp,20,'Crossing 8 grants one XP conversion');
ctx.applyRelic({key:'over-two',n:'Over Cap +2',effect:'Basic +2',mods:{basic:2}});
assert.equal(ctx.basicAttackDamage(),8);
assert.equal(ctx.S.rogue.pendingBasicRelicXp,40,'Excess +2 grants one XP conversion, not two');
for(const [difficulty,cap] of [['easy',8],['standard',8],['hard',10],['hell',10],['tormented',10]]){
 ctx.S.difficulty=difficulty;
 assert.equal(ctx.basicAttackCap(),cap,difficulty+' cap');
 assert.equal(ctx.basicAttackDamage(),cap,difficulty+' capped attack');
}
ctx.S.difficulty='standard';
// Test the actual XP handler and check that awarded XP respects Relic thresholds.
vm.runInContext('let rogueRelicXpGrantInProgress=false;',ctx,{timeout:5000});
for(const fn of ['rogueRelicXpCount','rogueRelicXpNeed','rogueGrantRelicXp','rogueFlushBasicRelicXp'])
 vm.runInContext(extract(rogue,fn),ctx,{timeout:5000});
assert.equal(ctx.rogueFlushBasicRelicXp(),1,'40 XP should grant the first Relic');
assert.equal(ctx.S.rogue.relicXp,20,'Overflow XP must persist');
assert.equal(ctx.S.rogue.xpRelics,1,'Earned Relic raises XP tier');
assert.equal(ctx.rogueRelicXpNeed(),30);
assert.equal(ctx.S.rogue.pendingBasicRelicXp,0);
// If an XP-unlocked Relic is itself capped, the 20 XP must arrive after tier increment.
ctx.S.rogue.relicXp=30;
ctx.pullRelic=()=>{
 ctx.S.relicDeck.pop();
 ctx.applyRelic({key:'chain',n:'Chained Relic',effect:'Basic +1',mods:{basic:1}});
 return {key:'chain'};
};
assert.equal(ctx.rogueGrantRelicXp(0,'No-op'),0);
assert.equal(ctx.rogueGrantRelicXp(1,'Threshold check'),1);
assert.equal(ctx.S.rogue.xpRelics,2);
assert.equal(ctx.S.rogue.relicXp,21,'Converted XP must count toward the new tier');
// Check real Exorcist Ritual damage, non-damage control, and availability.
ctx.S.relicMods.ritual=0;
ctx.S.players=[{hand:[]}];
ctx.currentPlayer=()=>ctx.S.players[0];
ctx.damageTargets=()=>[target];
vm.runInContext(extract(engine,'ritualUnavailableReason'),ctx,{timeout:5000});
for(const [full,expected] of [[false,3],[true,6]]){
 for(const kind of ['boss','demon']){
  target=kind==='boss'?{kind:'boss'}:{kind:'demon',d:{greater:false,status:{}}};
  amount=null;
  await ctx.resolveRitual({kind:'castHell',n:'Cast Into Hell'},full);
  assert.equal(amount,expected,'Cast Into Hell '+kind+' '+full);
 }
}
let damageCalls=0,damageChoiceCalls=0;
ctx.damageDemon=()=>{damageCalls++};
ctx.dealDamageTarget=()=>{damageCalls++};
ctx.chooseDamageTarget=async()=>{damageChoiceCalls++;return target};
ctx.demonCode=()=>'';ctx.demonValue=()=>0;
ctx.demonName=d=>d.n;
ctx.render=()=>{};
for(const fn of ['stopIsBlocked','applyStop','moveDemons'])
 vm.runInContext(extract(engine,fn),ctx,{timeout:5000});
ctx.allDemons=()=>[];
assert.match(ctx.ritualUnavailableReason({kind:'severUnholy'}),/no Greater Demons/i);
await ctx.resolveRitual({kind:'severUnholy',n:'Sever the Unholy'},false);
await ctx.resolveRitual({kind:'severUnholy',n:'Sever the Unholy'},true);
assert.equal(damageCalls,0,'No fallback or direct Sever damage');
assert.equal(damageChoiceCalls,0,'Sever should not show fallback damage targeting');
for(const full of [false,true]){
 const greater={id:'greater1',greater:true,hp:20,cur:20,n:'Test Greater Demon',status:{}};
 ctx.allDemons=()=>[{d:greater}];
 ctx.chooseVisualDemonTargets=async()=>({d:greater});
 assert.equal(ctx.ritualUnavailableReason({kind:'severUnholy'}),'');
 damageCalls=0;
 await ctx.resolveRitual({kind:'severUnholy',n:'Sever the Unholy'},full);
 assert.equal(greater.greater,false,'Sever converts Greater to Lesser');
 assert.equal(greater.cur,20,'Sever preserves HP if within lesser maximum');
 assert.equal(damageCalls,0,'Sever '+full+' must not damage');
 assert.equal(!!greater.status.stop,full,
  'Only the Greater roll should prevent movement');
}
// Two distinct targets may be converted. Greater stops exactly those
// targets; Lesser converts the same number without stopping them.
for(const full of [false,true]){
 const targets=Array.from({length:3},(_,i)=>({
  id:'sever-target-'+i,n:'Sever Target '+i,greater:true,hp:12,cur:12,
  status:{}
 }));
 const choices=[];
 ctx.allDemons=()=>targets.map(d=>({d,r:0}));
 ctx.chooseVisualDemonTargets=async (_,options)=>{
  const first=options.find(x=>x.d?.greater);
  if(first)choices.push(first.d.id);
  return first||null;
 };
 damageCalls=0;
 await ctx.resolveRitual({kind:'severUnholy',n:'Sever the Unholy'},full);
 assert.deepEqual(choices,['sever-target-0','sever-target-1'],
  'Sever must select at most 2 distinct Greater Demons');
 assert.equal(targets[0].greater,false);
 assert.equal(targets[1].greater,false);
 assert.equal(targets[2].greater,true,'Unselected Greater Demon is unchanged');
 assert.equal(targets[0].status.stop===true,full);
 assert.equal(targets[1].status.stop===true,full);
 assert.equal(!!targets[2].status.stop,false);
 assert.equal(damageCalls,0);
 if(full){
  // Exercise the actual Demon movement function to show both converted
  // Demons remain in their rooms during the next Demon Phase.
  ctx.S.rooms=[targets,[],[],[]];ctx.S.roomStop={};
  ctx.findDemonLocation=d=>{
   const i=ctx.S.rooms[0].findIndex(x=>x.id===d.id);
   return i>=0?{r:0,i}:null;
  };
  const moving=[];
  ctx.moveOneForward=d=>{moving.push(d.id);return true};
  ctx.moveDemons();
  assert.deepEqual(moving,['sever-target-2'],
   'Only the unselected Greater Demon should move');
  assert.equal(!!targets[0].status.stop,false,
   'Temporary movement-stop status is consumed after Demon Phase');
  assert.equal(!!targets[1].status.stop,false);
 }
}
ctx.allDemons=()=>[];
ctx.dealDamageTarget=(x,n)=>{amount=n};
ctx.damageDemon=(d,n)=>{amount=n};
// Elite passages give incoming demons the printed GREATER stat directly,
// without a Lesser merge. Confirm Final Exorcism uses that exact status.
ctx.demonMaxHP=d=>d.greater?d.ghp:d.hp;
ctx.S.rogue.nodeType='elite';
ctx.S.rogue.bossFloor=false;
ctx.S.rogue.floor=3;
vm.runInContext(extract(engine,'demonHasGreaterStat'),ctx,{timeout:5000});
vm.runInContext(extract(rogue,'rogueliteMakeEliteGreater'),ctx,{timeout:5000});
const eliteDemon={id:'natural-elite',n:'Lesser Test Demon',g:'Greater Test Demon',hp:6,ghp:14,cur:6,greater:false,status:{}};
assert.equal(ctx.demonHasGreaterStat(eliteDemon),false);
assert.equal(ctx.rogueliteMakeEliteGreater(eliteDemon,ctx.S.rogue),true);
assert.equal(ctx.demonHasGreaterStat(eliteDemon),true,'New Elite spawn must have Greater stat');
assert.equal(eliteDemon.greater,true,'Elite spawn must not require merging');
for(const [full,expected] of [[false,6],[true,8]]){
 target={kind:'demon',d:eliteDemon};
 amount=null;
 await ctx.resolveRitual({kind:'finalExorcism',n:'Final Exorcism'},full);
 assert.equal(amount,expected,'Direct Elite Greater spawn Final Exorcism '+full);
}
ctx.S.rogue.nodeType='battle';
assert.equal(ctx.demonHasGreaterStat({greater:false,status:{}}),false);
assert.equal(ctx.demonHasGreaterStat({greater:true,status:{}}),true);
assert.equal(ctx.demonHasGreaterStat({greater:false,status:{ultraForm:true}}),true);
assert(engine.includes("demonHasGreaterStat(d)?' • GREATER'"),'Board and targeting must use the same Greater check');
for(const [label,t] of [
 ['normal',{kind:'demon',d:{greater:false,status:{}}}],
 ['greater',{kind:'demon',d:{greater:true,status:{}}}],
 ['ultra',{kind:'demon',d:{greater:true,status:{ultraForm:true}}}],
 ['ultra-flag-only',{kind:'demon',d:{greater:false,status:{ultraForm:true}}}],
 ['boss',{kind:'boss'}]
]){
 target=t;
 for(const [full,base] of [[false,2],[true,4]]){
  amount=null;
  await ctx.resolveRitual({kind:'finalExorcism',n:'Final Exorcism'},full);
  const boosted=label!=='normal';
  assert.equal(amount,base+(boosted?4:0),'Final Exorcism '+label+' '+full);
 }
}
ctx.S.relicMods.ritual=2;
target={kind:'boss'};amount=null;
await ctx.resolveRitual({kind:'finalExorcism',n:'Final Exorcism'},false);
assert.equal(amount,8,'Ritual-power bonus remains applied');
assert(data.includes('h:"Deal 3 damage to a Demon or Boss.",f:"Deal 6 damage to a Demon or Boss.'));
assert(data.includes('h:"Turn up to 2 Greater Demons into Lesser forms.",f:"Turn up to 2 Greater Demons into Lesser forms. They do not move this Demon Phase."'));
assert(!data.match(/Sever the Unholy[^\n]*Deal no damage/),
 'Sever must no longer display a damage disclaimer');
assert(data.includes('h:"Deal 2 damage to a normal Demon; deal +4 damage to Greater Demons, Ultra Demons, and Bosses (6 total).'));
assert(/sanctum-clean-v\d+/.test(worker),"A versioned service-worker cache is required");
assert(engine.includes('Basic Attack is capped at 8 on Easy/Standard or 10 on Hard/Hell/Tormented;'));
assert(engine.includes('before+addedBasic>basicAttackCap()'));
assert(rogue.includes('return Math.min(basicAttackCap(),2+relicBonus+rogueLegacyBasicAttackBonus());'));
console.log('Focused difficulty-based 8/10 Basic Attack caps, 20-XP conversion, XP tier, hybrid Relic and Exorcist ritual checks passed.');
