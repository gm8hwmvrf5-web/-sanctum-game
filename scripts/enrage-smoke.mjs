import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const errors=[];
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const values=await page.evaluate(()=>{
  window.alert=()=>{};
  const check=(ok,message)=>{if(!ok)throw new Error(message)};
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  check(S.started&&S.rogue.enabled,'Startup failed');
  clearTurnTimerInterval();
  S.rogue.encounterGoal=100;
  S.difficulty='standard';
  S.round=1;
  S.rogue.nodeType='battle';
  S.rogue.bossFloor=false;
  S.phase='Priest';
  const make=(i)=>({...DEMON_TYPES[i],id:'enrage-test-'+i,hp:15,ghp:25,atk:3,gatk:5,greater:false,cur:15,status:{}});
  const [a,b,c,d]=[make(1),make(2),make(3),make(4)];
  S.rooms=[[a,b,c],[d],[],[]];
  S.queue=[];
  S.enrageRuleVersion=1;
  S.enrageKillsThisTurn=0;S.enrageActiveTurnBonus=0;
  render();
  const hp0=demonMaxHP(c),atk0=demonAttack(c),cur0=c.cur;
  // A Priest's two real kills must not apply Enrage until next turn.
  defeatDemon(a);
  check(S.enrageKillsThisTurn===1,'First kill credited exactly once');
  check(demonMaxHP(c)===hp0&&demonAttack(c)===atk0,'Enrage must not apply immediately');
  defeatDemon(b);
  check(S.enrageKillsThisTurn===2,'Two kills credited exactly twice');
  check(demonMaxHP(c)===hp0&&demonAttack(c)===atk0,'Still no immediate buff');
  // First new turn applies only that turn's kill count, never a permanent stack.
  beginTurn(true);clearTurnTimerInterval();
  check(S.enrageActiveTurnBonus===2&&S.enrageKillsThisTurn===0,'Next turn consumes two kills');
  check(c.status.enrageHpBonus===2&&c.status.enrageAttackBonus===2,'Enrage statuses are +2/+2');
  check(demonMaxHP(c)===hp0+2&&demonAttack(c)===atk0+2,'Displayed HP and attack both increase +2');
  check(c.cur===cur0+2,'Existing unhurt Demon receives +2 current HP');
  // Saving/restoring cannot add a second stack, erase bonus, or reset history.
  const saved=JSON.parse(JSON.stringify(S));
  S=saved;
  normalizeSanctumState();render();
  const c2=S.rooms[0].find(x=>x.id===c.id);
  check(S.enrageActiveTurnBonus===2&&demonMaxHP(c2)===hp0+2,'Save/reload preserves temporary Enrage exactly');
  const maxBefore=demonMaxHP(c2),curBefore=c2.cur;
  for(let n=0;n<4;n++)render();
  check(demonMaxHP(c2)===maxBefore&&c2.cur===curBefore,'Multiplayer-compatible render never stacks Enrage');
  // New arrivals inherit exactly the active turn bonus.
  const newcomer=make(0);
  S.rooms[2].push(newcomer);
  triggerEnterPlay(newcomer);
  check(newcomer.status.enrageHpBonus===2&&newcomer.status.enrageAttackBonus===2,'Spawned Demon gains current turn Enrage');
  check(demonMaxHP(newcomer)===17&&demonAttack(newcomer)===5,'Spawned Demon has +2/+2');
  // Damage remains as damage as Enrage fades in a no-kill turn.
  c2.cur-=4;
  const damageTaken=demonMaxHP(c2)-c2.cur;
  beginTurn(true);clearTurnTimerInterval();
  check(S.enrageActiveTurnBonus===0,'No-kill turn clears previous Enrage');
  check(demonMaxHP(c2)===hp0&&demonAttack(c2)===atk0,'Buff expires completely after one turn');
  check(demonMaxHP(c2)-c2.cur===damageTaken,'Removing Enrage preserves combat damage');
  check(newcomer.status.enrageHpBonus===0,'Enrage also expires on newly summoned Demons');
  // Demon Phase kills should not count as Priest kills.
  S.phase='Demon';
  defeatDemon(d);
  check(S.enrageKillsThisTurn===0,'Demon Phase defeat does not earn new Priest Enrage');
  beginTurn(true);clearTurnTimerInterval();
  check(S.enrageActiveTurnBonus===0,'No Demon-phase Enrage generated');
  // Across consecutive kill turns, the bonus is REPLACED, not accumulated.
  S.enrageKillsThisTurn=1;
  beginTurn(true);clearTurnTimerInterval();
  check(demonMaxHP(c2)===hp0+1&&demonAttack(c2)===atk0+1,'+1 turn after +0');
  S.enrageKillsThisTurn=3;
  beginTurn(true);clearTurnTimerInterval();
  check(demonMaxHP(c2)===hp0+3&&demonAttack(c2)===atk0+3,'+3 replaces +1 rather than stacks to +4');
  beginTurn(true);clearTurnTimerInterval();
  check(demonMaxHP(c2)===hp0&&demonAttack(c2)===atk0,'Enrage fades after consecutive turns');
  // Migration from older permanent-stacking saves strips stale HP and Attack.
  const legacy=make(0);
  legacy.cur=18;
  legacy.status.enrageHpBonus=3;
  legacy.status.enrageAttackBonus=3;
  S.rooms=[[legacy],[],[],[]];
  S.enrageRuleVersion=0;
  S.enrageKillsThisTurn=2;
  migrateTemporaryEnrageState();
  check(S.enrageRuleVersion===1&&S.enrageKillsThisTurn===0,'Legacy version migrated');
  check(legacy.cur===15&&!('enrageHpBonus' in legacy.status)&&!('enrageAttackBonus' in legacy.status),'Old permanent stack removed safely');
  // Fresh passage clears bonus, including all queued kill counts.
  S.enrageKillsThisTurn=5;S.enrageActiveTurnBonus=3;
  const oldFloor=S.rogue.floor;
  S.rogue.floor=oldFloor+1;
  S.rogue.encounterGoal=100;
  rogueliteEnterCurrentFloor('battle');
  clearTurnTimerInterval();
  check(S.enrageKillsThisTurn===0&&S.enrageActiveTurnBonus===0,'Passage transition resets Enrage');
  // The state remains JSON-serializable for Supabase snapshots.
  const roundtrip=JSON.parse(JSON.stringify(S));
  check(roundtrip.enrageRuleVersion===1&&roundtrip.enrageActiveTurnBonus===0,'Snapshot serializes Enrage markers');
  return {base:{maxHp:hp0,attack:atk0},twoKills:{maxHp:hp0+2,attack:atk0+2},newArrival:true,fadePreservesDamage:true,saveLoad:true,passageReset:true};
 });
 assert.deepEqual(errors,[],'Browser runtime errors');
 console.log('PASS: real Enrage kill timing, +1 per kill HP/Attack, new arrivals, save/reload, no double-stack, damage-preserving fade, Demon Phase exclusion, legacy migration, and passage reset.',JSON.stringify(values));
}finally{await browser.close()}
