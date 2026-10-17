import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('src/js/35-difficulty.js','utf8');
const engine=fs.readFileSync('src/js/10-engine.js','utf8');
const rogue=fs.readFileSync('src/js/30-roguelite.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

function extract(source,name){
 const i=source.indexOf('function '+name+'(');
 assert(i>=0,'missing '+name);
 const open=source.indexOf('{',i);
 let depth=0;
 for(let j=open;j<source.length;j++){
  if(source[j]==='{')depth++;
  else if(source[j]==='}'&&--depth===0)return source.slice(i,j+1);
 }
 throw Error('unbalanced '+name);
}
function select(value='standard'){
 return {
  value,disabled:false,title:'',_callbacks:{},
  addEventListener(type,fn){this._callbacks[type]=fn},
  change(value){this.value=value;this._callbacks.change?.()}
 };
}
const controls={
 difficultySetupSelect:select(),
 difficultyPauseSelect:select(),
 difficultySetupInfo:{textContent:''},
 difficultyPauseInfo:{textContent:''}
};
const fakeDemon=()=>({hp:20,ghp:40,atk:10,gatk:20,cur:20,greater:false,status:{extraHpBonus:0}});
const newS=(difficulty='standard',round=1)=>({
 difficulty,started:true,round,rooms:[[fakeDemon()],[],[],[]],
 boss:{hp:100,cur:100,baseHp:100,difficultyHpDelta:0},bossRevealed:true,
 players:[{name:'Priest 1'}],log:[]
});
const ctx={
 S:newS(),Math,document:{getElementById:id=>controls[id]||null},
 render(){return 'rendered'},startGame(){ctx.S=newS();return true},
 demonMaxHP(d){return (d.greater?d.ghp:d.hp)+(d.status?.extraHpBonus||0)},
 demonAttack(d){return (d.greater?d.gatk:d.atk)+(d.status?.attackBonus||0)},
 bossDrainAmount(){return 5},
 log(){},
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(src,ctx,{timeout:5000});
const getDemon=()=>ctx.S.rooms[0][0];
const setMode=m=>{controls.difficultyPauseSelect.change(m);assert.equal(ctx.S.difficulty,m)};
assert.equal(ctx.__sanctumDifficulty.level(),'standard');
assert.equal(ctx.demonMaxHP(getDemon()),20);
assert.equal(ctx.demonAttack(getDemon()),10);
assert.equal(ctx.bossDrainAmount(),5);
for(const [mode,mult] of [['easy',.95],['standard',1],['hard',1.05],['hell',1.10],['tormented',1.10]]){
 ctx.S=newS();setMode(mode);
 assert.equal(ctx.demonMaxHP(getDemon()),Math.round(20*mult),mode+' HP round 1');
 assert.equal(ctx.demonAttack(getDemon()),Math.round(10*mult),mode+' ATK round 1');
 assert.equal(ctx.S.boss.hp,Math.round(100*mult),mode+' boss HP round 1');
 assert.equal(ctx.bossDrainAmount(),Math.round(5*mult),mode+' boss drain round 1');
 const firstHp=getDemon().cur;
 ctx.S.round=2;ctx.render();
 assert.equal(ctx.demonMaxHP(getDemon()),Math.round(20*mult*mult),mode+' HP round 2');
 assert.equal(ctx.demonAttack(getDemon()),Math.round(10*mult*mult),mode+' ATK round 2');
 assert.equal(ctx.S.boss.hp,Math.round(100*mult*mult),mode+' boss HP round 2');
 assert.equal(ctx.S.boss.cur,ctx.S.boss.hp,mode+' full boss stays full');
 assert.equal(getDemon().cur,ctx.demonMaxHP(getDemon()),mode+' full demon stays full');
 assert.equal(ctx.bossDrainAmount(),Math.max(1,Math.round(5*mult*mult)),mode+' boss attack round 2');
 ctx.render();assert.equal(getDemon().cur,ctx.demonMaxHP(getDemon()),mode+' repeat render no HP inflation');
 if(mode==='standard')assert.equal(firstHp,20);
}
// Damage is preserved when round changes or difficulty changes mid-run.
ctx.S=newS('standard',1);
getDemon().cur=15;ctx.S.boss.cur=72;
setMode('hard');
assert.equal(getDemon().cur,16,'hard buff adds only incremental HP, does not heal existing damage');
assert.equal(ctx.S.boss.cur,77,'boss keeps same absolute damage');
setMode('standard');
assert.equal(getDemon().cur,15);
assert.equal(ctx.S.boss.cur,72);
ctx.S.round=2;setMode('hell');
assert.equal(getDemon().cur,19);
assert.equal(ctx.S.boss.cur,93);
ctx.S.round=2;ctx.render();
assert.equal(getDemon().cur,19,'repeat rendering must not repeatedly buff');
// Existing saved games use Standard if difficulty is missing.
ctx.S=newS();delete ctx.S.difficulty;ctx.render();
assert.equal(ctx.S.difficulty,'standard');
assert.equal(ctx.demonMaxHP(getDemon()),20);
// Old saves and cloud snapshots preserve the difficulty in JSON.
ctx.S=newS('tormented',5);
ctx.render();
const saved=JSON.parse(JSON.stringify(ctx.S));
ctx.S=saved;ctx.render();
assert.equal(ctx.S.difficulty,'tormented');
assert.equal(ctx.S.rooms[0][0].cur,ctx.demonMaxHP(getDemon()));
// Boss HP percentages for solo to four players, unchanged for Standard.
vm.runInContext(extract(engine,'bossHpFactor'),ctx,{timeout:5000});
vm.runInContext(extract(engine,'scaleBossForPlayers'),ctx,{timeout:5000});
for(const [mode,factors] of [
 ['standard',[.70,.85,1.05,1.25]],
 ['tormented',[1,1.15,1.30,1.45]]
]){
 for(let n=1;n<=4;n++){
  ctx.S=newS(mode);
  ctx.S.players=Array.from({length:n},()=>({}));
  assert.equal(ctx.bossHpFactor(),factors[n-1],mode+' player factor '+n);
  ctx.scaleBossForPlayers(false);
  assert.equal(ctx.S.boss.hp,Math.round(100*factors[n-1]),mode+' Boss starting HP before round bonus');
  ctx.render();
  assert.equal(ctx.S.boss.hp,Math.round(Math.round(100*factors[n-1])*(mode==='tormented'?1.1:1)));
 }
}
// Multiplayer non-active users cannot change in-progress difficulty.
ctx.S=newS('hard');
ctx.SanctumMultiplayerDev={session:{roomCode:'TEST'},isMyTurn:false};
ctx.render();
assert.equal(controls.difficultyPauseSelect.disabled,true);
controls.difficultyPauseSelect.change('hell');
assert.equal(ctx.S.difficulty,'hard');
ctx.SanctumMultiplayerDev.isMyTurn=true;
ctx.render();
assert.equal(controls.difficultyPauseSelect.disabled,false);
controls.difficultyPauseSelect.change('hell');
assert.equal(ctx.S.difficulty,'hell');
// New game starts with selected option, and setup text can be changed.
ctx.SanctumMultiplayerDev=null;
ctx.S.started=false;
controls.difficultySetupSelect.change('tormented');
ctx.startGame();
assert.equal(ctx.S.difficulty,'tormented');
assert.equal(ctx.demonMaxHP(getDemon()),22);
assert(src.includes('difficultyHpDelta'));
assert(rogue.includes("S.difficulty==='tormented'?1:"));
assert(html.includes('id="difficultyPauseSelect"'));
assert(html.includes('id="difficultySetupSelect"'));
assert(html.includes('src/js/35-difficulty.js?v=clean70'));
assert(sw.includes('sanctum-clean-v70'));
assert(sw.includes("'./src/js/35-difficulty.js'"));
console.log('PASS: all five difficulty modes, 2-round progression, boss HP by player count, damage preservation, save/load, multiplayer ownership and menus.');
