import { chromium } from 'playwright';

// Run deterministic mechanics checks in the real browser runtime. These do
// not create online rooms or change any live player's Supabase game.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:780}});
try{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof startGame==='function'&&typeof DEMON_TYPES!=='undefined');
  await page.selectOption('#playerCount','1');
  await page.evaluate(()=>setupPlayersUI());
  await page.evaluate(()=>{if(!startGame())throw new Error('Initial game failed');clearTurnTimerInterval()});
  const results=await page.evaluate(()=>{
    const outcomes=[];
    const check=(condition,message)=>{if(!condition)throw new Error(message)};
    const fresh=(n=2)=>{
      try{clearTurnTimerInterval()}catch{}
      S=freshState();
      S.started=true;
      S.phase='Priest';
      S.boss={...BOSSES[0],cur:BOSSES[0].hp};
      S.players=Array.from({length:n},(_,i)=>({
        name:'Tester '+(i+1),
        char:Object.keys(CHARACTERS)[i],
        blood:0,hand:[],basic:false,ritualUsed:[false,false,false],
        forceEmpower:false,discardUsed:false,consecrateUsed:false
      }));
      S.priestDeck=buildPriestDeck();
      S.demonDeck=buildDemonDeck();
      S.relicDeck=RELICS.map(r=>r.key);
      resetCrucifixDeck();
      S.rogue={enabled:false};
    };
    const demon=(i,id)=>({...DEMON_TYPES[i],id,greater:false,cur:DEMON_TYPES[i].hp,status:{}});
    const test=(name,run,n=2)=>{
      try{fresh(n);run();outcomes.push({name,pass:true})}
      catch(err){outcomes.push({name,pass:false,error:err.message})}
    };

    test('Complete starting card/deck catalog',()=>{
      check(PRIEST.length>=32,'Priest definition count '+PRIEST.length);
      check(DEMON_TYPES.length===35,'Demon definition count '+DEMON_TYPES.length);
      check(BOSSES.length===10,'Boss definition count '+BOSSES.length);
      check(CRUCIFIX.length===36,'Crucifix catalog count '+CRUCIFIX.length);
      check(S.priestDeck.length===PRIEST.length,'Priest deck size mismatch');
      check(new Set(S.priestDeck.map(c=>c.n)).size===PRIEST.length,'Priest deck should start with unique definitions');
      check(S.demonDeck.length===140,'Demon physical card deck not 140');
      check(new Set(S.demonDeck.map(d=>d.id)).size===140,'Demon physical IDs repeat');
      check(S.crucifixDeck.length===36,'Crucifix deck is missing cards');
    });
    test('Exactly 15 percent of 140 Demons carry hidden Crucifixes',()=>{
      check(S.demonDeck.filter(d=>d.crucifixAttached).length===21,'Exactly 21 of 140 Demons must be marked');
    });
    test('Mana pool caps and refill by player count',()=>{
      for(const [n,cap] of [[1,10],[2,15],[3,20],[4,35]]){
        S.players=Array.from({length:n},(_,i)=>({
          name:'Test '+i,char:Object.keys(CHARACTERS)[i],
          hand:[],blood:0,basic:false,ritualUsed:[false,false,false],
          discardUsed:false,consecrateUsed:false
        }));
        check(sharedManaRoundValue()===cap,'Unexpected round mana cap for '+n+' Priests');
        S.mana=cap-2;addMana(99);
        check(S.mana===cap,'Mana gain did not respect '+n+'-Priest cap');
        addMana(-100);
        check(S.mana===0,'Negative mana should clamp to zero');
      }
    });
    test('Empowered card keeps identity, discounts and payment flags',()=>{
      const p=S.players[0],def=PRIEST[0];
      p.hand=[{...def,id:'a'},{...def,id:'b'}];S.mergeManaDiscount=1;S.mergeBloodDiscount=1;
      empowerCard('a');
      check(p.hand.length===1&&p.hand[0].empowered===true,'Merge did not produce one Empowered card');
      check(p.hand[0].id==='a','Merge lost physical card identity');
      check(p.hand[0].empManaDiscount===1&&p.hand[0].empBloodDiscount===1,'Discounts not stored');
      check(S.priestDiscard.some(c=>c.id==='b'&&!c.empowered),'Sacrificed card missing from discard');
      S=JSON.parse(JSON.stringify(S));
      migratePriestBalance();normalizeSanctumState();
      check(S.players[0].hand[0].empowered===true,'Empowered flag lost after state migration');
      check(S.players[0].hand[0].empManaDiscount===1,'Stored Mana discount lost after migration');
    });
    test('Player turn change does not remove Empowered card',()=>{
      const p=S.players[0],c=PRIEST[0];
      p.hand=[{...c,id:'merged',empowered:true,empowerPaid:false,empManaDiscount:1,empBloodDiscount:0}];
      S.current=0;beginTurn(true);clearTurnTimerInterval();
      check(p.hand[0].empowered===true&&p.hand[0].empManaDiscount===1,'Begin turn removed Empowered status');
    });
    test('Standard Demons advance one room and corrupt the previous room',()=>{
      const d=demon(0,'move');S.rooms[0].push(d);
      moveDemons();
      check(S.rooms[0].length===0&&S.rooms[1].some(x=>x.id==='move'),'Demon did not advance Gateway -> Hall');
      check(roomCorruption(0)===1,'Gateway did not gain Corruption when Demon left');
    });
    test('Full rooms and stop effects prevent Demon movement',()=>{
      const d=demon(0,'blocked');S.rooms[0].push(d);
      for(let i=0;i<4;i++)S.rooms[1].push(demon((i+1)%25,'hall-'+i));
      check(moveOneForward(d)===false,'A Demon moved into a fully occupied Hall');
      check(S.rooms[0].some(x=>x.id==='blocked'),'Blocked Demon left the Gateway');
      const stopped=demon(0,'stopped');S.rooms[0]=[stopped];S.rooms[1]=[];
      stopped.status.stop=true;moveDemons();
      check(S.rooms[0].some(x=>x.id==='stopped'),'Stopped Demon moved');
    });
    test('Desecration persists until Corruption reaches zero',()=>{
      const threshold=roomDesecrationThreshold(0);
      for(let i=0;i<threshold;i++)addCorruption(0,'Test movement');
      check(roomDesecrated(0),'Gateway not Desecrated at threshold');
      for(let i=threshold;i>1;i--){
        reduceRoomCorruptionOnDemonDefeat(0);
        check(roomDesecrated(0),'Desecration cleared before tracker hit zero');
      }
      reduceRoomCorruptionOnDemonDefeat(0);
      check(roomCorruption(0)===0&&!roomDesecrated(0),'Desecration not cleared at zero');
    });
    test('Consecration spends resources, cleanses and has turn lockout',()=>{
      const p=S.players[0];p.blood=2;S.mana=7;setRoomCorruption(1,roomDesecrationThreshold(1));
      check(consecrateRoom(1)===true,'Allowed consecration was rejected');
      check(S.mana===4&&p.blood===1,'Consecration cost not applied');
      check(roomCorruption(1)===0&&!roomDesecrated(1)&&roomConsecrated(1),'Consecration did not cleanse room');
      check(consecrateRoom(0)===false,'One player consecrated twice in one turn');
      closeConsecrateModal();
    });
    test('Demon Blood rewards: killer full, other players half',()=>{
      distributeKillBlood(4,0);
      check(S.players[0].blood===4&&S.players[1].blood===2,'Multiplayer Blood payout incorrect');
    });
    test('Physical Crucifix transfers to next spawned Demon',()=>{
      S.pendingCrucifixTransfers=1;
      const next=demon(0,'new');delete next.crucifixAttached;
      check(applyPendingCrucifixTransferToSpawn(next),'Transferred Crucifix not attached to next unmarked Demon');
      check(next.crucifixAttached&&S.pendingCrucifixTransfers===0,'Crucifix transfer balance incorrect');
    });
    test('Extra Crucifix goes back into remaining deck if next Demon is already marked',()=>{
      S.pendingCrucifixTransfers=1;
      const next=demon(0,'new');next.crucifixAttached=true;
      S.demonDeck.forEach(d=>delete d.crucifixAttached);
      applyPendingCrucifixTransferToSpawn(next);
      check(S.pendingCrucifixTransfers===0,'Pending Crucifix not consumed');
      check(S.demonDeck.filter(d=>d.crucifixAttached).length===1,'Extra hidden Crucifix not reassigned to deck');
    });
    test('Merging two attached Demons does not delete a hidden Crucifix',()=>{
      S.demonDeck.forEach(d=>delete d.crucifixAttached);
      const a=demon(0,'attached-a'),b=demon(0,'attached-b');
      a.crucifixAttached=true;b.crucifixAttached=true;
      S.rooms[0]=[a,b];check(checkMerge(a),'Two identical Demons did not merge');
      const remaining=S.rooms.flat().filter(d=>d.crucifixAttached).length+
        S.queue.filter(d=>d.crucifixAttached).length+
        S.demonDeck.filter(d=>d.crucifixAttached).length+
        (S.pendingCrucifixTransfers||0);
      check(remaining===2,'Demon merge lost '+(2-remaining)+' attached Crucifix(es)');
    });
    test('Basic Attack and Crit relic modifiers stack',()=>{
      const r={key:'audit-relic',n:'Audit Relic',effect:'Test',mods:{basic:2,crit:15,hand:1}};
      applyRelic(r);
      check(basicAttackDamage()===4,'Basic damage modifier incorrect');
      check(basicAttackCritChance()===30,'Crit chance modifier incorrect');
      check(handLimit()===8,'Hand size relic modifier incorrect');
    });
    test('Boss HP scales by player count',()=>{
      for(const [n,factor] of [[1,.7],[2,.7],[3,.9],[4,1.1]]){
        S.players=Array.from({length:n},(_,i)=>({name:'Priest '+i,hand:[],blood:0}));
        S.boss={hp:100,baseHp:100,cur:100,b:12};
        scaleBossForPlayers();
        check(S.boss.hp===Math.round(100*factor),'Boss HP scaling incorrect for '+n+' players');
      }
    });
    test('Boss-stage normal spawning skips alternate Demon Phases',()=>{
      S.bossRevealed=true;S.players=S.players.slice(0,2);
      S.bossStageRoundsElapsed=0;check(normalSpawnCount()===0,'Boss stage must skip first spawn phase');
      S.bossStageRoundsElapsed=1;check(normalSpawnCount()===1,'2-player boss stage must spawn one on next phase');
      S.bossStageRoundsElapsed=2;check(normalSpawnCount()===0,'Boss stage must skip alternate spawn');
    });
    test('Altar barrier absorbs damage before Protection',()=>{
      S.altar=30;S.altarBarrier=3;S.altarBarrierRound=S.round;
      damageAltar(5,'Audit demon');
      check(S.altar===28&&S.altarBarrier===0,'Barrier did not block first 3 incoming Altar damage');
    });

    return outcomes;
  });
  for(const outcome of results){
    console.log((outcome.pass?'PASS ':'FAIL ')+outcome.name+(outcome.error?' — '+outcome.error:''));
  }
  const failed=results.filter(r=>!r.pass);
  console.log('MECHANICS AUDIT:',JSON.stringify({passed:results.length-failed.length,failed:failed.length,total:results.length}));
  if(failed.length)process.exitCode=1;
}finally{
  await browser.close();
}
