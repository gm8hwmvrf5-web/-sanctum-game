import {chromium} from 'playwright';

// Balance 1.1 browser regression on the real clean rebuild, covering Sanctuary
// offers, Priest taxes, party-wide Blood and renewal caps, class skills, and HP.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const browserErrors=[];
page.on('pageerror',e=>browserErrors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 const report=await page.evaluate(async()=>{
  window.alert=()=>{};
  const check=(ok,message)=>{if(!ok)throw Error(message)};
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  check(S?.started&&S?.rogue?.enabled,'Could not start roguelite game');
  const baseline=JSON.stringify(S);
  const classes=Object.keys(CHARACTERS);
  const report={sanctuary:true,bloodOverflow:true,priestTax:true,basicRelic:true,bossHp:true,renewals:true,monk:true};
  const reset=(n=1,floor=1)=>{
   clearTurnTimerInterval();
   S=JSON.parse(baseline);S.started=true;S.rogue.enabled=true;S.rogue.floor=floor;
   S.phase='Priest';S.round=1;S.altar=10;S.current=0;
   S.players=Array.from({length:n},(_,i)=>({
    name:'Balance '+i,char:classes[i%classes.length],blood:0,hand:[],basic:false,
    ritualUsed:[false,false,false],discardUsed:false,consecrateUsed:false
   }));
   S.rooms=[[],[],[],[]];S.queue=[];S.desecratedRooms=[false,false,false,false];
   S.corruption=[0,0,0,0];S.consecrated=[false,false,false,false];
   S.mana=sharedManaRoundValue();S.bossRevealed=false;
   S.relicMods={basic:0,hand:0,ritual:0,crit:0};
   S.boss={...BOSSES[0],cur:100,hp:100,baseHp:100};
   S.bossFlags={spores:{}};
   S.altarTurnRenewals=[];S.altarRoundRenewals=[];S.altarDefeatBlessings=[];
   S.rogue.sanctuaryVisits={};
  };
  const random=Math.random;
  try{
   reset();S.rogue.floor=1;
   Math.random=()=>0;
   let opts=window.__sanctumBalanceReadouts().routeOptions;
   check(opts.length===3&&opts.includes('sanctuary'),'One-third eligible Sanctuary offer failed');
   Math.random=()=>0.99;
   opts=window.__sanctumBalanceReadouts().routeOptions;
   check(opts.length===3&&!opts.includes('sanctuary'),'Sanctuary appeared outside one-third offer chance');
   Math.random=()=>0;
   S.rogue.sanctuaryVisits['1:1']=true;
   opts=window.__sanctumBalanceReadouts().routeOptions;
   check(opts.length===3&&!opts.includes('sanctuary'),'Sanctuary offered twice within same Act');
   S.rogue.floor=5; // Next non-boss route is Act 2.
   opts=window.__sanctumBalanceReadouts().routeOptions;
   check(opts.includes('sanctuary'),'New Act should make Sanctuary eligible again');
   S.rogue.floor=15; // Next cycle, Act 1.
   opts=window.__sanctumBalanceReadouts().routeOptions;
   check(opts.includes('sanctuary'),'New cycle must restore Sanctuary eligibility');
  }finally{Math.random=random}
  for(let n=1;n<=4;n++){
   reset(n);
   const possessor=DEMON_TYPES.find(d=>d.key==='fiend_possessor');
   check(!!possessor,'Possessor data missing');
   S.rooms[0]=Array.from({length:3},(_,i)=>({
    ...possessor,id:'tax-'+i,greater:true,cur:possessor.ghp,status:{}
   }));
   S.desecratedRooms[2]=true;S.corruption[2]=roomDesecrationThreshold(2);
   const expected=n<=2?2:3;
   check(priestTax()===expected,'Possessor tax cap incorrect for '+n+' Priest(s)');
   S.rooms[0]=[];S.desecratedRooms=[false,false,false,false];S.corruption=[0,0,0,0];
   check(priestTax()===0,'Card tax not removed when Possessors leave');
   reset(n);S.altar=1;S.players.forEach(p=>p.blood=10);S.consecrated[2]=true;
   distributeKillBlood(12,0);
   check(S.altar===5&&S.bloodOverflowHealedAmount===4,
    'Blood overflow must heal exactly 4 in a round incl. Chapel bonus for '+n+' players');
   distributeKillBlood(12,0);
   check(S.altar===5,'Second kill exceeded party-wide Blood overflow cap');
   S.round++;
   distributeBlood(5);
   check(S.altar===9&&S.bloodOverflowHealedAmount===4,
    'Overflow cap did not reset next round');
  }
  for(const [raw,effective] of [[0,2],[5,7],[6,7],[7,8],[8,8],[9,9]]){
   reset();S.relicMods.basic=raw;
   check(basicAttackDamage()===effective,'Basic Attack raw Relic '+raw+' should deal '+effective);
   S.rogue.legacyBasicAttackBonus=3;
   check(basicAttackDamage()===effective+3,'Legacy Basic Attack should not be diminished');
  }
  for(const [n,factor] of [[1,.70],[2,.85],[3,1.05],[4,1.25]]){
   reset(n);
   check(Math.abs(bossHpFactor()-factor)<0.000001,'Boss HP factor '+n+' Priest(s)');
   S.boss={...BOSSES[0],hp:120,baseHp:120,cur:120};
   scaleBossForPlayers();
   check(S.boss.hp===Math.round(120*factor),'Boss HP scaling '+n+' Priest(s)');
  }
  reset();S.altar=0;
  addAltarRoundRenewal(5,1,'First renewal');
  addAltarRoundRenewal(5,1,'Second renewal');
  S.round++;
  resolveAltarRoundRenewals();
  check(S.altar===6&&S.altarRenewalHealedAmount===6,'Two round renewals exceeded 6 Altar cap');
  addAltarTurnRenewal(4,1,'Turn renewal');
  resolveAltarTurnRenewals();
  check(S.altar===6,'Turn renewal must share the existing round renewal cap');
  healAltar(3,'Immediate healing');
  check(S.altar===9,'Immediate healing was accidentally capped');
  addAltarDefeatBlessing(2,1,'On-kill blessing');
  resolveAltarDefeatBlessings();
  check(S.altar===11,'On-defeat Altar reward was accidentally capped');
  S.round++;
  addAltarTurnRenewal(4,1,'Next round renewal');
  resolveAltarTurnRenewals();
  check(S.altar===15&&S.altarRenewalHealedAmount===4,'Renewal cap failed to reset next round');
  S.round++;S.altar=0;S.consecrated[2]=true;
  addAltarTurnRenewal(6,1,'Consecrated renewal');
  resolveAltarTurnRenewals();
  check(S.altar===6,'Consecrated Chapel must not exceed 6 automatic renewal healing');
  reset();S.players[0].char='Monk';
  const monk=CHARACTERS.Monk;
  check(monk.rituals[0].h.includes('4 to a Boss')&&monk.rituals[0].f.includes('8 to a Boss'),'Monk Palm card text');
  check(monk.rituals[2].h.includes('Gain 2 Demon Blood')&&monk.rituals[2].f.includes('Gain 3 Demon Blood'),'Monk Inner Peace text');
  const origChoose=chooseDamageTarget;
  try{
   chooseDamageTarget=async()=>({kind:'boss',boss:S.boss});
   S.bossRevealed=true;S.boss.cur=100;S.boss.hp=100;
   await resolveRitual(monk.rituals[0],false);
   check(S.boss.cur===96,'Monk Lesser Palm must deal exactly 4 base Boss damage');
   await resolveRitual(monk.rituals[0],true);
   check(S.boss.cur===88,'Monk Greater Palm must deal exactly 8 base Boss damage');
  }finally{chooseDamageTarget=origChoose}
  reset();S.players[0].char='Monk';S.players[0].blood=1;
  await resolveRitual(monk.rituals[2],false);
  check(S.players[0].blood===3,'Monk Lesser Inner Peace should grant 2 Blood');
  const cardsBefore=S.players[0].hand.length;
  await resolveRitual(monk.rituals[2],true);
  check(S.players[0].blood===6,'Monk Greater Inner Peace should grant 3 Blood');
  check(S.players[0].hand.length===cardsBefore+2,'Monk Greater Inner Peace should draw 2 Priest cards');
  const snapshot=JSON.parse(JSON.stringify(S));
  check(Number.isFinite(snapshot.bloodOverflowHealedAmount)&&Number.isFinite(snapshot.altarRenewalHealedAmount),
   'Balance counters are not JSON serializable for Supabase');
  return {...report,classes:classes.length,partySizes:4,sanctuaryOfferProbability:'1/3',bloodOverflowCap:4,
   priestTaxCaps:[2,2,3,3],bossHpFactors:[.70,.85,1.05,1.25],autoRenewalCap:6};
 });
 console.log('BALANCE 1.1 BROWSER SMOKE PASSED:',JSON.stringify(report));
 if(browserErrors.length)throw Error('Browser JS errors: '+browserErrors.join('; '));
}finally{await browser.close()}
