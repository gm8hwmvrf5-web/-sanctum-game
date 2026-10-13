import { chromium } from 'playwright';

// Actual Priest-card cast, lethal retaliation, round boundaries, and multiplayer
// protection sources. Every test runs against the production browser runtime.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1180,height:730}});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const result=await page.evaluate(async()=>{
   document.getElementById('playerCount').value='1';
   document.getElementById('startBtn').click();
   if(!S?.started)throw new Error('Game did not start');
   document.getElementById('rogueChoiceModal')?.classList.add('hidden');
   const baseline=JSON.stringify(S), report={};
   function check(ok,msg){if(!ok)throw new Error(msg);}
   function reset(protection=15){
     S=JSON.parse(baseline);
     S.rogue.enabled=false;S.multiplayerVote=null;S.phase='Priest';
     S.current=0;S.round=1;S.altar=protection;S.mana=20;
     S.altarBarrier=0;S.altarBarrierRound=0;S.altarShield=0;S.nextAltarBonus=0;
     S.players[0].blood=3;S.players[0].hand=[];
     S.altarTurnRenewals=[];S.altarDefeatBlessings=[];S.altarRoundRenewals=[];
     S.rooms=[[],[],[],[]];S.defeats=0;S.bossRevealed=false;S.runStatsShown=false;
     document.getElementById('rogueChoiceModal')?.classList.add('hidden');
     render();
   }
   function target({retaliate=false,hp=10}={}){
     const def=DEMON_TYPES.find(d=>d.key==='new_thorn_martyr')||DEMON_TYPES[0];
     const d={...def,id:'protection-test-'+Math.random().toString(36).slice(2),greater:false,cur:hp,hp,atk:2,
       a:retaliate?'hurtAltar':'',v:retaliate?1:0,status:{}};
     S.rooms[0].push(d);render();return d;
   }
   async function cast(name,emp=false,d=null){
     const def=PRIEST.find(c=>c.n===name);
     check(!!def,'Missing Priest card '+name);
     const card={...def,id:'protection-cast-'+name,empowered:emp,empowerPaid:!emp};
     S.players[0].hand=[card];S.mana=20;
     const original=chooseDamageTarget;
     if(d)chooseDamageTarget=async()=>({kind:'demon',d,r:0});
     try{await playCard(card);}finally{chooseDamageTarget=original;}
     return card;
   }
   // Holy Barrier must apply guard BEFORE the target reacts to being hit.
   reset(1);
   let thorn=target({retaliate:true,hp:6});
   await cast('Holy Barrier',false,thorn);
   check(S.altar===1&&S.phase!=='Defeat','Holy Barrier did not prevent lethal Thorn Martyr retaliation');
   check(S.altarBarrier===1,'Holy Barrier should have 1 remaining point after retaliation');
   check(document.getElementById('altarGuardStatus')?.textContent.includes('1 damage'),
     'Live Altar Guard indicator is missing');
   report.holyBarrierRetaliation=true;
   // Empowered version protects five points before the retaliation.
   reset(1);thorn=target({retaliate:true,hp:6});
   await cast('Holy Barrier',true,thorn);
   check(S.altar===1&&S.altarBarrier===4,'Empowered Holy Barrier should protect 5 before retaliation');
   report.empoweredBarrier=true;
   // Iron Faith is immediate and protects against ANY Altar damage source.
   reset(1);await cast('Iron Faith');
   damageAltar(2,'Crucifix');
   check(S.altar===1&&S.altarBarrier===0&&S.phase!=='Defeat','Iron Faith failed to absorb two Crucifix damage');
   report.ironFaithAnySource=true;
   // The card has a two-point budget, not immunity to a 5-point hit.
   reset(6);await cast('Iron Faith');
   damageAltar(5,'Boss phase attack');
   check(S.altar===3&&S.altarBarrier===0,'Barrier overflow of 3 damage was not applied');
   report.overflowDamage=true;
   // Multiple cards stack, all remaining guard expires at round boundary.
   reset(8);await cast('Iron Faith');await cast('Iron Faith');
   check(S.altarBarrier===4,'Multiple Iron Faith cards did not stack');
   damageAltar(3,'Demon');
   check(S.altar===8&&S.altarBarrier===1,'Stacked barrier reduction incorrect');
   S.round++;
   damageAltar(1,'Demon');
   check(S.altar===7&&S.altarBarrier===0,'Expired guard improperly persisted');
   report.stackAndExpire=true;
   // Shield of Faith's chosen lethal target counts toward its next-two-kills blessing.
   reset(10);let victim=target({hp:1});
   await cast('Shield of Faith',false,victim);
   check(S.altar===11&&S.altarDefeatBlessings.length===1&&S.altarDefeatBlessings[0].remaining===1,
     'Shield of Faith did not bless its own target kill');
   report.shieldOfFaithKill=true;
   // Divine Shield restores now and renews on each of the next two Priest turns.
   reset(10);await cast('Divine Shield');
   check(S.altar===12&&S.altarTurnRenewals.length===1,'Divine Shield immediate healing not applied');
   resolveAltarTurnRenewals();resolveAltarTurnRenewals();
   check(S.altar===14&&S.altarTurnRenewals.length===0,'Divine Shield renewal incorrect');
   report.divineShield=true;
   // Circle of Protection's delayed restoration is not falsely applied early.
   reset(10);await cast('Circle of Protection');
   check(S.altar===13&&S.altarRoundRenewals.length===1,'Circle immediate restoration missing');
   resolveAltarRoundRenewals();
   check(S.altar===13,'Circle restored before following round');
   S.round++;resolveAltarRoundRenewals();
   S.round++;resolveAltarRoundRenewals();
   check(S.altar===17&&S.altarRoundRenewals.length===0,'Circle of Protection round restoration incorrect');
   report.circleOfProtection=true;
   // Guard and renewals must survive the exact JSON state used by saves/online sync.
   reset(8);await cast('Iron Faith');await cast('Divine Shield');
   const cloned=JSON.parse(JSON.stringify(S));
   check(cloned.altarBarrier===2&&cloned.altarBarrierRound===1&&cloned.altarTurnRenewals.length===1,
     'Protection state was not serializable for saves and multiplayer');
   report.serializable=true;
   return report;
 });
 if(pageErrors.length)throw new Error('Browser errors: '+pageErrors.join(' / '));
 console.log('ALTAR PROTECTION AUDIT PASSED:',JSON.stringify(result));
}finally{await browser.close();}
