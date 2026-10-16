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
  else if(source[i]==='}'&&!--depth)return source.slice(start,i+1);
 }
 throw new Error('Unbalanced function '+name);
}
const logs=[];
let target={kind:'boss'};
let amount=null;
const ctx={
 S:{
  relicMods:{basic:0,hand:0,ritual:0,crit:0},activeRelics:[],relicDeck:['xp-one','xp-two','xp-three'],
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
for(const fn of ['basicAttackDamage','applyRelic','resolveRitual'])
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
assert.equal(ctx.S.rogue.pendingBasicRelicXp,0,'Reaching exactly 5 should not award XP');
ctx.applyRelic({key:'over',n:'Over Cap',effect:'Basic +2',mods:{basic:2}});
assert.equal(ctx.basicAttackDamage(),5);
assert.equal(ctx.S.rogue.pendingBasicRelicXp,20,'Excess +2 should give XP only once');
ctx.applyRelic({key:'hybrid',n:'Hybrid',effect:'Basic +1, hand +1',mods:{basic:1,hand:1}});
assert.equal(ctx.S.rogue.pendingBasicRelicXp,40);
assert.equal(ctx.S.relicMods.hand,1,'Hybrid non-basic bonus must remain active');
// Test the actual XP handler and check that awarded XP respects Relic thresholds.
vm.runInContext('let rogueRelicXpGrantInProgress=false;',ctx,{timeout:5000});
for(const fn of ['rogueRelicXpNeed','rogueGrantRelicXp','rogueFlushBasicRelicXp'])
 vm.runInContext(extract(rogue,fn),ctx,{timeout:5000});
assert.equal(ctx.rogueFlushBasicRelicXp(),1,'40 XP should grant the first Relic');
assert.equal(ctx.S.rogue.relicXp,5,'Overflow XP must persist');
assert.equal(ctx.S.rogue.xpRelics,1,'Earned Relic raises XP tier');
assert.equal(ctx.rogueRelicXpNeed(),45);
assert.equal(ctx.S.rogue.pendingBasicRelicXp,0);
// If an XP-unlocked Relic is itself capped, the 20 XP must arrive after tier increment.
ctx.S.rogue.relicXp=45;
ctx.pullRelic=()=>{
 ctx.S.relicDeck.pop();
 ctx.applyRelic({key:'chain',n:'Chained Relic',effect:'Basic +1',mods:{basic:1}});
 return {key:'chain'};
};
assert.equal(ctx.rogueGrantRelicXp(0,'No-op'),0);
assert.equal(ctx.rogueGrantRelicXp(1,'Threshold check'),1);
assert.equal(ctx.S.rogue.xpRelics,2);
assert.equal(ctx.S.rogue.relicXp,21,'Converted XP must count toward the new tier');
// Check damage directly through the real Exorcist cases in resolveRitual().
ctx.S.relicMods.ritual=0;
for(const [full,expected] of [[false,4],[true,8]]){
 target={kind:'boss'};amount=null;
 await ctx.resolveRitual({kind:'castHell',n:'Cast Into Hell'},full);
 assert.equal(amount,expected,'Cast Into Hell '+full);
}
for(const [full,expected] of [[false,2],[true,4]]){
 target={kind:'boss'};amount=null;
 await ctx.resolveRitual({kind:'severUnholy',n:'Sever the Unholy'},full);
 assert.equal(amount,expected,'Sever the Unholy fallback '+full);
}
const greater={id:'greater1',greater:true,hp:20,cur:20,n:'Test Greater Demon'};
ctx.allDemons=()=>[{d:greater}];
ctx.chooseVisualDemonTargets=async()=>({d:greater});
target={kind:'demon',d:greater};amount=null;
await ctx.resolveRitual({kind:'severUnholy',n:'Sever the Unholy'},true);
assert.equal(amount,2,'Sever Greater conversion damage');
assert.equal(greater.greater,false,'Greater converts to Lesser');
ctx.allDemons=()=>[];
for(const [full,expected] of [[false,3],[true,8]]){
 target={kind:'boss'};amount=null;
 await ctx.resolveRitual({kind:'finalExorcism',n:'Final Exorcism'},full);
 assert.equal(amount,expected,'Final Exorcism vs Boss '+full);
}
for(const [full,expected] of [[false,7],[true,12]]){
 target={kind:'demon',d:{greater:true}};amount=null;
 await ctx.resolveRitual({kind:'finalExorcism',n:'Final Exorcism'},full);
 assert.equal(amount,expected,'Final Exorcism vs Greater '+full);
}
assert(data.includes('h:"Deal 4 damage to a Demon or Boss.",f:"Deal 8 damage.'));
assert(data.includes('If none exist, deal 2 damage to any target.'));
assert(data.includes('then deal 2 damage to each. If none exist, deal 4 damage'));
assert(data.includes('h:"Deal 3 damage to a Demon or Boss; +4 damage'));
assert(worker.includes("sanctum-clean-v65"));
assert(engine.includes('Attack damage is capped at 5; if this Relic would exceed the cap, gain 20 Relic XP instead.'));
console.log('Focused Basic Attack cap, 20-XP conversion, XP tier, hybrid Relic and Exorcist ritual checks passed.');
