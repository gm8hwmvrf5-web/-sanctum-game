import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const engine=fs.readFileSync('src/js/10-engine.js','utf8');
const data=fs.readFileSync('src/js/00-data.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

function fn(source,name){
 const at=source.indexOf('function '+name+'(');
 assert(at>=0,'Missing function: '+name);
 const open=source.indexOf('{',at);
 let depth=0;
 for(let i=open;i<source.length;i++){
  if(source[i]==='{')depth++;
  else if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);
 }
 throw Error('Unbalanced function '+name);
}
function element(){
 const classes=new Set(['hidden']);
 return {
  classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
  textContent:'',className:'',disabled:false,children:[],
  set innerHTML(value){this.children=[];this._html=value},
  get innerHTML(){return this._html||''},
  appendChild(e){this.children.push(e)},
  querySelectorAll(q){assert.equal(q,'button');return this.children},
  focus(){this.focused=true}
 };
}
const elements=Object.fromEntries([
 'crucifixModal','crucifixCard','crucifixType','crucifixName',
 'crucifixEffect','crucifixResult','crucifixClose','crucifixChoiceArea'
].map(k=>[k,element()]));
const document={getElementById:id=>elements[id]||null,createElement:()=>element()};
const state=()=>({
 started:true,phase:'Priest',round:4,altar:20,mana:6,current:0,
 players:[{name:'Player 1',blood:7,hand:[{id:'c1'},{id:'c2'},{id:'c3'}]},{name:'Player 2',blood:6,hand:[{id:'c4'},{id:'c5'}]}],
 rooms:[[],[],[],[]],corruption:[1,1,1,1],desecratedRooms:[false,false,false,false],
 roomStop:{},pendingCrucifixTransfers:0
});
const logs=[];
const ctx={
 S:state(),document,console,Math,
 setTimeout:fn=>fn(),log:(...args)=>logs.push(args),
 render:()=>{},showGameStatus:()=>{},
 healAltar:n=>{ctx.S.altar=Math.min(30,ctx.S.altar+n)},
 damageAltar:n=>{ctx.S.altar=Math.max(0,ctx.S.altar-n)},
 addMana:n=>{ctx.S.mana=Math.max(0,Math.min(10,ctx.S.mana+n))},
 addCorruption:i=>{ctx.S.corruption[i]++},
 setRoomCorruption:(i,v,s)=>{(s||ctx.S).corruption[i]=Math.max(0,v)},
 discardRandom:p=>{if(p?.hand?.length)p.hand.pop()},
 drawPriest:(p,n)=>{if(p)for(let i=0;i<n;i++)p.hand.push({id:'draw'+i})},
 spawnOne:()=>{ctx.S.rooms[0].push({id:'spawned'})},
 crucifixBanishRandomDemon:()=>{},
};
vm.createContext(ctx);
for(const name of ['crucifixPartyBlood','crucifixSpendPartyBlood','crucifixGiveAllBlood','renderChoiceCrucifix'])
 vm.runInContext(fn(engine,name),ctx,{timeout:5000});
const a=data.indexOf('const CHOICE_CRUCIFIX=[');
const b=data.indexOf('\n];',a)+3;
assert(a>0&&b>a,'Missing choice Crucifix catalog');
vm.runInContext(data.slice(a,b)+'\nglobalThis.choiceCards=CHOICE_CRUCIFIX;',ctx,{timeout:5000});
const cards=ctx.choiceCards.filter(c=>c.choice);
assert.equal(cards.length,13,'Audit every choice-based Crucifix');
let tested=0;
for(const card of cards){
 for(let i=0;i<card.choices.length;i++){
  ctx.S=state();
  for(const k of Object.keys(elements)){
   elements[k].children=[];
   elements[k].disabled=false;
   elements[k].classList.add('hidden');
  }
  elements.crucifixClose.classList.remove('hidden');
  ctx.renderChoiceCrucifix(card);
  const buttons=elements.crucifixChoiceArea.children;
  assert.equal(buttons.length,card.choices.length,card.n+' all choices shown');
  const button=buttons[i];
  assert.equal(button.disabled,false,card.n+' / '+card.choices[i].label+' enabled with full resources');
  const before=JSON.stringify(ctx.S);
  button.onclick();
  assert.equal(elements.crucifixChoiceArea.classList.contains('hidden'),true,card.n+' resolves option '+i);
  assert.equal(elements.crucifixClose.classList.contains('hidden'),false,card.n+' Close reappears');
  assert.notEqual(JSON.stringify(ctx.S),before,card.n+' choice must have a real effect');
  tested++;
 }
}
// Explicit regression: the pictured Unpaid Vow paths alter the exact resources.
const vow=cards.find(x=>x.n==='The Unpaid Vow');
assert(vow,'Unpaid Vow missing');
ctx.S=state();
vow.choices[0].fx(ctx.S);
assert.equal(ctx.S.players[0].blood,6);
assert.equal(ctx.S.players[1].blood,5);
assert.equal(ctx.S.altar,25);
ctx.S=state();
vow.choices[1].fx(ctx.S);
assert.equal(ctx.S.altar,18);
assert.equal(ctx.S.players[0].blood,8);
assert.equal(ctx.S.players[1].blood,7);
// Shared Blood spend must charge exactly the party cost in predictable seat order.
ctx.S=state();ctx.S.players[0].blood=1;ctx.S.players[1].blood=2;
assert.equal(ctx.crucifixPartyBlood(),3);
assert.equal(ctx.crucifixSpendPartyBlood(3),true);
assert.equal(ctx.crucifixPartyBlood(),0);
assert.equal(ctx.crucifixSpendPartyBlood(1),false);
assert.equal(ctx.crucifixPartyBlood(),0);
// Disabled and failed Crucifix choice paths remain recoverable.
ctx.S=state();ctx.S.players[0].blood=0;ctx.S.players[1].blood=0;
ctx.renderChoiceCrucifix(vow);
assert.equal(elements.crucifixChoiceArea.children[0].disabled,true,'Vow Honor must disable without Blood');
ctx.S=state();
const fail={n:'Failure Test',t:'double',txt:'',choices:[
 {label:'Faulty',desc:'',fx:s=>{s.mana=0;throw new Error('injected choice failure')}},
 {label:'Working',desc:'',fx:s=>{s.mana+=1;return 'Recovered'}}
]};
ctx.renderChoiceCrucifix(fail);
const choiceArea=elements.crucifixChoiceArea;
choiceArea.children[0].onclick();
assert.equal(ctx.S.mana,6,'Failed action must roll back resources');
assert.equal(choiceArea.children[0].disabled,false,'Failed action must re-enable choices');
assert.equal(choiceArea.classList.contains('hidden'),false,'Choice modal remains usable');
choiceArea.children[1].onclick();
assert.equal(ctx.S.mana,7,'Recovered action must apply exactly once');
assert.equal(elements.crucifixClose.classList.contains('hidden'),false);
assert(/sanctum-clean-v\d+/.test(sw),'Service worker must use a versioned cache');
console.log('PASS: all '+tested+' choice-based Crucifix paths across '+cards.length+' cards, Unpaid Vow, party blood, modal completion, and error recovery.');
