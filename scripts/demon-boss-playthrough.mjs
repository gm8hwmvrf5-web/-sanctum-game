import {chromium} from 'playwright';

// Demon / Boss encounter playthrough: all 25 catalog types in Lesser and
// Greater form, all 10 bosses, their triggered effects and lifecycle events.
// Uses the actual game engine in a real browser without touching live rooms.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
try{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof DEMON_TYPES!=='undefined'&&typeof runBossPhase==='function',null,{timeout:20000});
  // Open the actual Demon Deck UI and verify all Lesser/Greater pairs use
  // the existing gothic card components and have loadable image assets.
  await page.evaluate(()=>document.getElementById('demonDeckBtn').click());
  const gallery=await page.evaluate(async()=>{
    const cards=[...document.querySelectorAll('#demonDeckGrid .deckpair')];
    const images=[...document.querySelectorAll('#demonDeckGrid .deckface img')];
    const all=await Promise.all(images.map(async img=>{
      img.loading='eager';
      try{await img.decode()}catch(_){}
      return {src:img.getAttribute('src'),valid:img.complete&&img.naturalWidth>0};
    }));
    document.getElementById('demonDeckClose').click();
    return {pairs:cards.length,images:images.length,
      missing:all.filter(x=>!x.valid).map(x=>x.src)};
  });
  console.log('DEMON CODEX UI:',JSON.stringify(gallery));
  if(gallery.pairs!==35||gallery.images!==70||gallery.missing.length){
    throw new Error('Demon codex cards or artwork missing: '+JSON.stringify(gallery));
  }
  const results=await page.evaluate(async()=>{
    const report=[];
    window.alert=()=>{};
    const assert=(c,msg)=>{if(!c)throw new Error(msg)};
    const record=async(name,fn)=>{
      try{await fn();report.push({name,pass:true})}
      catch(e){report.push({name,pass:false,error:e.message})}
      finally{try{clearTurnTimerInterval()}catch(_){}}
    };
    const reset=()=>{
      try{clearTurnTimerInterval()}catch(_){}
      S=freshState();
      S.started=true;S.phase='Priest';S.round=1;S.altar=28;
      S.players=[0,1].map(i=>({
        name:'Audit '+i,char:Object.keys(CHARACTERS)[i],
        hand:[],blood:0,basic:false,ritualUsed:[false,false,false],
        forceEmpower:false,discardUsed:false,consecrateUsed:false
      }));
      S.mana=12;
      S.priestDeck=buildPriestDeck();
      S.demonDeck=buildDemonDeck();
      S.relicDeck=[];
      resetCrucifixDeck();
      S.boss={...BOSSES[0],cur:BOSSES[0].hp};
      S.rogue={enabled:false};
    };
    const make=(def,greater=false,id='audit-target')=>({
      ...def,id,greater,cur:greater?def.ghp:def.hp,status:{}
    });
    const dummy=(id='dummy')=>make(DEMON_TYPES[0],false,id);
    const pos=d=>findDemonLocation(d)?.r;
    const checkAbility=(def,greater)=>{
      reset();
      const d=make(def,greater),v=greater?(def.gv??def.v):def.v;
      const k=greater?(def.ga||def.a):def.a;
      S.rooms[0].push(d);
      assert(demonCode(d)===k,'Ability key differs from catalog');
      assert(demonValue(d)===v,'Ability strength differs from catalog');
      assert(demonMaxHP(d)===(greater?def.ghp:def.hp),'HP differs from card');
      assert(baseDemonAttack(d)===(greater?def.gatk:def.atk),'Attack differs from card');
      assert(demonBlood(d)===(greater?def.gb:def.b),'Blood differs from card');
      assert(!!demonArt(d),'Card artwork missing');
      switch(k){
        case 'defeatBlood':{
          const blood=demonBlood(d);
          defeatDemon(d);
          // The printed kill reward belongs to the killer; this separate
          // Defeat Blood ability distributes extra Blood round-robin.
          assert(S.players[0].blood===Math.min(10,blood+Math.ceil(v/2)),
            'Killer Blood plus extra round-robin amount incorrect');
          assert(S.players[1].blood===blood/2+Math.floor(v/2),
            'Teammate Blood plus extra round-robin amount incorrect');
          assert(S.defeats===1,'Defeat was not counted');
          break;
        }
        case 'altarPlus':{
          S.rooms[0]=[];S.rooms[3]=[d];
          const before=S.altar,printedAttack=baseDemonAttack(d);
          moveOneForward(d);
          assert(S.altar===before-printedAttack-v,
            'Breach should add '+v+' Altar loss to printed Attack');
          assert(!findDemonLocation(d),'Breached Demon remained on board');
          break;
        }
        case 'defeatPush':{
          const target=dummy();S.rooms[1].push(target);
          defeatDemon(d);
          assert(pos(target)===1+v,'Defeat push advanced '+(pos(target)-1)+' vs '+v);
          break;
        }
        case 'defeatRuin':{
          const target=dummy();S.rooms[3].push(target);
          defeatDemon(d);
          assert(target.status.ruinBonus===v,'Ruin bonus not placed');
          const before=S.altar;
          moveOneForward(target);
          assert(S.altar===before-baseDemonAttack(target)-v,
            'Defeat Ruin did not increase Altar breach damage');
          break;
        }
        case 'fast':{
          moveDemons();
          assert(pos(d)===1+v,'Fast Demon moved to '+pos(d)+' instead of '+(1+v));
          break;
        }
        case 'endHeal':{
          d.cur=demonMaxHP(d)-v-1;
          resolveEndDemonPhaseAbilities();
          assert(d.cur===demonMaxHP(d)-1,'End phase heal must restore '+v);
          resolveEndDemonPhaseAbilities();
          assert(d.cur===demonMaxHP(d),'Healing exceeded maximum HP');
          break;
        }
        case 'ignoreDamage':{
          // This is a three-hit test. Increase only the test creature's HP
          // so that the second hit doesn't kill it before the third.
          d.hp=30;d.ghp=30;d.cur=30;
          const hp=d.cur;
          damageDemon(d,5,'Audit damage');
          assert(d.cur===hp-(5-v),'First hit should block '+v);
          damageDemon(d,4,'Second audit hit');
          assert(d.cur===hp-(5-v)-4,'Second hit should not be blocked');
          resetRoundDemonStatuses();
          const before=d.cur;
          damageDemon(d,3,'Next-round hit');
          assert(d.cur===before-(3-v),'Reduction did not reset next round');
          break;
        }
        case 'enterMana':{
          triggerEnterPlay(d);
          assert(S.mana===12-v,'Entering play did not drain '+v+' Mana');
          break;
        }
        case 'stopWard':{
          for(let i=0;i<v;i++){
            applyStop(d);
            assert(!d.status.stop,'Movement stop was not blocked at charge '+(i+1));
          }
          applyStop(d);
          assert(d.status.stop===true,'Stop was not applied after wards were consumed');
          delete d.status.stop;
          resetRoundDemonStatuses();
          applyStop(d);
          assert(!d.status.stop,'Movement-stop protection did not refresh next round');
          break;
        }
        case 'undeadAttack':{
          const other=make(DEMON_TYPES[5],false,'new-undead');
          S.rooms[0].push(other);
          triggerEnterPlay(other);
          assert(other.status.attackRoundBonus===v,'New Undead did not gain '+v+' Attack');
          resetRoundDemonStatuses();
          assert(!other.status.attackRoundBonus,'Undead bonus did not expire');
          break;
        }
        case 'roomAltar':{
          const start=S.altar;
          triggerEnterRoom(d);
          assert(S.altar===start-v,'Entering Gateway did not drain '+v+' Altar');
          moveOneForward(d);
          assert(S.altar===start-v*2,'Entering Hall did not drain '+v+' Altar');
          break;
        }
        case 'packAttack':{
          const alone=demonAttack(d);
          const another=dummy('pack-mate');
          S.rooms[0].push(another);
          assert(demonAttack(d)===alone+v,'Pack Attack bonus incorrect');
          S.rooms[0].pop();
          assert(demonAttack(d)===alone,'Pack bonus did not disappear');
          break;
        }
        case 'defeatMana':{
          defeatDemon(d);
          assert(S.mana===12-v,'Defeating Demon should drain '+v+' shared Mana');
          break;
        }
        case 'ritualArmor':{
          const hp=d.cur;
          damageDemon(d,5,'Ritual audit',{ritual:true});
          assert(d.cur===hp-(5-v),'Ritual resistance incorrect');
          damageDemon(d,4,'Normal audit');
          assert(d.cur===hp-(5-v)-4,'Non-Ritual damage was reduced');
          break;
        }
        case 'attackMove':{
          S.rooms[0]=[];
          const other=dummy();S.rooms[1].push(other);S.rooms[3].push(d);
          moveOneForward(d);
          assert(other.status.attackMoveBonus===v,
            'Altar attack did not grant '+v+' movement to next Demon');
          break;
        }
        case 'defeatAttack':{
          const target=dummy();S.rooms[1].push(target);
          defeatDemon(d);
          assert(target.status.attackBonus===v,
            'Defeat should grant next Demon +'+v+' lasting Attack');
          assert(demonAttack(target)===baseDemonAttack(target)+v,
            'Next Demon attack did not include lasting bonus');
          break;
        }
        case 'priestTax':{
          assert(priestTax()===v,'Priest Mana tax should be +'+v);
          defeatDemon(d);
          assert(priestTax()===0,'Priest tax remained after Demon defeat');
          break;
        }
        case 'hurtMana':{
          damageDemon(d,2,'Audit hit');
          assert(S.mana===12-v,'Damage trigger should drain '+v+' shared Mana');
          damageDemon(d,1,'Second hit');
          assert(S.mana===12-2*v,'Second hit should trigger another '+v+' Mana loss');
          break;
        }
        case 'phasePush':{
          const other=dummy();S.rooms[1].push(other);
          const first=pos(d)+pos(other);
          resolveStartDemonPhaseAbilities();
          const advanced=pos(d)+pos(other)-first;
          assert(advanced===v,'Start phase moved Demons '+advanced+' vs '+v+' spaces');
          break;
        }
        case 'roomAttack':{
          const mate=dummy();
          S.rooms[0].push(mate);
          assert(demonAttack(mate)===baseDemonAttack(mate)+v,
            'Room support bonus did not apply to ally');
          assert(demonAttack(d)===baseDemonAttack(d)+v,
            'Room support should also apply to source Demon');
          break;
        }
        case 'ritualHalf':{
          for(let i=0;i<v;i++)assert(ritualIsHalved(d),
            'First Ritual '+(i+1)+' was not halved');
          assert(!ritualIsHalved(d),'Ritual remained halved after '+v+' uses');
          resetRoundDemonStatuses();
          assert(ritualIsHalved(d),'Ritual-halving did not reset next round');
          break;
        }
        case 'entryDiscard':{
          const before=S.priestDiscard.length;
          for(let i=0;i<3;i++){
            S.players[0].hand.push({...PRIEST[i],id:'discard-A-'+i});
            S.players[1].hand.push({...PRIEST[i+3],id:'discard-B-'+i});
          }
          triggerEnterPlay(d);
          assert(S.players.every(p=>p.hand.length===3-v),
            'Entry discard did not remove '+v+' card(s) from each Priest');
          assert(S.priestDiscard.length===before+v*2,
            'Randomly discarded Priest cards did not reach discard pile');
          break;
        }
        case 'basicArmor':{
          d.cur=20;d.hp=20;d.ghp=20;
          damageDemon(d,6,'Basic Attack test',{basicAttack:true});
          assert(d.cur===20-(6-v),'Basic Attack did not resist '+v+' damage');
          damageDemon(d,3,'Priest direct damage');
          assert(d.cur===20-(6-v)-3,'Non-Basic damage was incorrectly reduced');
          break;
        }
        case 'enterCorruption':{
          triggerEnterRoom(d);
          assert(roomCorruption(0)===v,'Entry corruption expected '+v+' got '+roomCorruption(0)+' code '+demonCode(d)+' room '+JSON.stringify(findDemonLocation(d))+' log '+S.log.slice(0,2).map(x=>x.msg).join('; '));
          break;
        }
        case 'roomManaLoss':{
          triggerEnterRoom(d);
          assert(S.mana===12-v,'Room entry expected '+(12-v)+' Mana got '+S.mana+' code '+demonCode(d)+' log '+S.log.slice(0,2).map(x=>x.msg).join('; '));
          moveOneForward(d);
          assert(S.mana===12-v*2,'Next room entry failed to drain Mana again');
          break;
        }
        case 'hurtAltar':{
          const before=S.altar;
          damageDemon(d,1,'Direct attack');
          assert(S.altar===before-v,'Damage retaliation should drain '+v+' Altar');
          break;
        }
        case 'breachBlood':{
          S.players.forEach(p=>p.blood=3);
          S.rooms[0]=[];S.rooms[3]=[d];
          moveOneForward(d);
          assert(S.players.every(p=>p.blood===3-v),
            'Altar breach did not steal '+v+' Blood from each Priest');
          break;
        }
        case 'defeatSpawnImp':{
          defeatDemon(d);
          const imps=allDemons().filter(x=>x.d.key==='imp_lesser').map(x=>x.d);
          const equivalents=imps.reduce((n,x)=>n+(x.greater?2:1),0);
          assert(equivalents===v,'Defeat should summon '+v+' Imp copies');
          break;
        }
        case 'defeatAltarCurse':{
          defeatDemon(d);
          assert(S.nextAltarBonus===v,'Death curse did not add '+v+' to next Altar loss');
          const before=S.altar;damageAltar(1,'test attack');
          assert(S.altar===before-1-v,'Next Altar damage ignored curse');
          assert(S.nextAltarBonus===0,'Death curse did not consume itself');
          break;
        }
        case 'relentless':{
          const companion=dummy('traveler');
          S.rooms[0].push(companion);
          moveDemons();
          assert(pos(d)===1+v,
            'Relentless movement should travel '+(1+v)+' rooms even when accompanied');
          break;
        }
        case 'phaseManaDrain':{
          resolveStartDemonPhaseAbilities();
          assert(S.mana===12-v,'Start phase expected '+(12-v)+' Mana got '+S.mana+' code '+demonCode(d)+' log '+S.log.slice(0,3).map(x=>x.msg).join('; '));
          break;
        }
        case 'spawnImp':{
          const before=allDemons().length;
          resolveStartDemonPhaseAbilities();
          const newImps=allDemons().filter(x=>x.d.id!==d.id).map(x=>x.d);
          // Two imps can immediately merge into one Greater Imp as part
          // of normal gameplay; count the two physical copies consumed.
          const equivalent=newImps.reduce((n,x)=>n+(x.greater?2:1),0);
          assert(equivalent===v,
            'Summoning created '+equivalent+' Lesser-Imp equivalents instead of '+v);
          break;
        }
        default:throw new Error('Uncovered Demon ability '+k);
      }
    };
    assert(DEMON_TYPES.length===35,'Expected 35 Demon types');
    assert(BOSSES.length===10,'Expected 10 Bosses');
    for(const def of DEMON_TYPES){
      for(const greater of [false,true]){
        await record((greater?def.g:def.n)+' / '+(greater?'Greater':'Lesser')+
          ' / '+def.key,()=>checkAbility(def,greater));
      }
    }
    // Every physical Demon must move along the actual board and arrive at the
    // Altar using its final printed Attack, including a hidden Crucifix.
    for(const def of DEMON_TYPES){
      for(const greater of [false,true]){
        await record(def.key+' '+(greater?'Greater':'Lesser')+' / Altar and Crucifix',()=>{
          reset();
          const d=make(def,greater);d.crucifixAttached=true;
          S.rooms[3].push(d);
          S.crucifixDeck=['Holy Respite'];
          S.crucifixDiscard=CRUCIFIX.filter(x=>x.n!=='Holy Respite').map(x=>x.n);
          S.altar=20;
          const start=S.altar,baseAttack=demonAttack(d),
            bonus=demonCode(d)==='altarPlus'?demonValue(d):0;
          moveOneForward(d);
          assert(!findDemonLocation(d),'Demon did not leave Crypt on Altar breach');
          assert(S.demonDeck.some(x=>x.id===d.id),'Breached Demon not recycled into Demon deck');
          assert(!d.crucifixAttached,'Hidden Crucifix was not cleared after breach');
          assert(S.crucifixDiscard.includes('Holy Respite'),'Attached Crucifix was not drawn');
          assert(S.altar===Math.min(30,start-baseAttack-bonus+3),
            'Altar / Holy Respite resolution incorrect: got '+S.altar+
              ', expected '+(start-baseAttack-bonus+3));
        });
      }
    }

    // Boss phase actively resolves unique summon / recall / healing rules.
    for(const def of BOSSES){
      await record(def.n+' / Boss activation',async()=>{
        reset();
        S.boss={...def,cur:def.hp};
        S.bossRevealed=true;resetBossRoundFlags();
        S.altar=30;
        const before=30,drain=bossDrainAmount();
        const previously=make(DEMON_TYPES[1],false,'old-defeated');
        if(['boneKing','dreadReaper'].includes(def.key)){
          S.defeated=[previously];S.defeats=1;
        }
        if(def.key==='plagueFather'){
          const a=dummy('wounded-a'),b=make(DEMON_TYPES[2],false,'wounded-b');
          a.cur=a.hp-2;b.cur=b.hp-2;
          S.rooms[0]=[a];S.rooms[2]=[b];
        }
        // Isolate each Boss activation from unrelated freshly drawn Demon
        // entry effects; ability interactions have separate dedicated tests.
        S.demonDeck=[
          make(DEMON_TYPES[0],false,'fixed-imp'),
          make(DEMON_TYPES[1],false,'fixed-fire-imp'),
          make(DEMON_TYPES[2],false,'fixed-carrion-imp')
        ];
        const top=S.demonDeck.at(-1)?.id,second=S.demonDeck.at(-2)?.id;
        let clicks=0;
        const auto=setInterval(()=>{
          const modal=document.getElementById('cardRevealModal');
          if(modal&&!modal.classList.contains('hidden')){
            const buttons=modal.querySelectorAll('[data-reveal-pick]');
            if(buttons[1]){clicks++;buttons[1].click()}
          }
        },5);
        try{
          await Promise.race([runBossPhase(),
            new Promise((_,rej)=>setTimeout(()=>rej(new Error('Boss activation timed out')),4000))]);
        }finally{clearInterval(auto)}
        clearTurnTimerInterval();
        assert(S.altar===before-drain,
          'Boss drain expected '+drain+', got '+(before-S.altar));
        assert(S.round===2,'Boss phase did not advance to next round');
        assert(S.phase==='Priest','Boss phase did not yield to Priest turn');
        const spawned=S.rooms[0].filter(d=>d.status?.summoned||d.status?.noMerge);
        if(['blackSovereign','devourer','lordOfAsh'].includes(def.key))
          assert(spawned.length===1,'Boss should summon one Demon');
        if(def.key==='gatebreaker')assert(spawned.length===2,'Gatebreaker should summon 2 Demons');
        if(def.key==='lordOfAsh')assert(spawned[0]?.key==='imp_fire','Lord of Ash should summon Fire Imp');
        if(['boneKing','dreadReaper'].includes(def.key)){
          assert(S.defeats===0,'Boss recall did not reverse a defeat');
          assert(S.rooms[0].some(d=>d.id==='old-defeated'),'Boss recall did not restore Demon');
        }
        if(def.key==='plagueFather'){
          assert(S.rooms[0][0].cur===S.rooms[0][0].hp-1,
            'Pestilent Bloom failed in Gateway: cur '+S.rooms[0][0].cur+
            ', printed hp '+S.rooms[0][0].hp);
          assert(S.rooms[2][0].cur===S.rooms[2][0].hp-1,
            'Pestilent Bloom failed in Chapel: cur '+S.rooms[2][0].cur+
            ', printed hp '+S.rooms[2][0].hp);
        }
        if(def.key==='crimsonOracle'){
          assert(clicks>0,'Blood Prophecy choice was not shown');
          assert(S.demonDeck.at(-1).id===second,'Blood Prophecy selected card did not become top of deck');
          assert(S.demonDeck.at(-2).id===top,'Blood Prophecy did not swap revealed cards');
        }
        if(def.key==='fallenSeraph')
          assert(S.mana===sharedManaRoundValue()-2,
            'Fallen Seraph should drain 2 Mana at start of new round');
      });
    }
    // Boss passive abilities must affect later targeted damage or Demon moves.
    const bossPassives={
      blackSovereign:()=>{
        const r={kind:'castHell'};
        assert(applyBossRitualRestriction(r,true)===false,'First ritual was not halved');
        assert(applyBossRitualRestriction(r,true)===true,'Subsequent ritual should be full');
      },
      soulTyrant:()=>{
        assert(applyBossRitualRestriction({kind:'holdLine'},true)===false,
          'First support ritual was not halved');
        assert(applyBossRitualRestriction({kind:'holdLine'},true)===true,
          'Second support ritual should be full');
      },
      boneKing:()=>{
        const d=dummy();d.cur=d.hp;S.rooms[3]=[d];
        triggerEnterRoom(d);
        assert(d.cur===d.hp+1,'Crypt entry did not grant 1 HP');
        assert(demonMaxHP(d)===d.hp+1,'Crypt Demon maximum HP not raised');
      },
      fallenSeraph:()=>{
        const before=S.boss.cur;
        damageBoss(10,'Test ritual',true);
        damageBoss(10,'Test ritual',true);
        assert(S.boss.cur===before-15,'First ritual should deal half damage; second full');
      },
      plagueFather:()=>{
        const d=dummy();S.rooms[0]=[d];
        defeatDemon(d);
        assert(S.bossFlags.spores[0]===1,'Demon defeat did not create spore');
        const newcomer=make(DEMON_TYPES[2],false,'new');
        S.rooms[0]=[newcomer];triggerEnterRoom(newcomer);
        assert(newcomer.cur===newcomer.hp+1,'Next Demon did not receive spore HP');
        assert(S.bossFlags.spores[0]===0,'Spore was not consumed');
      },
      crimsonOracle:()=>{
        const a=dummy('omen-1'),b=dummy('omen-2');
        S.rooms[0]=[a,b];
        triggerEnterPlay(a);triggerEnterPlay(b);
        assert(a.cur===a.hp+2,'First arriving Demon did not gain 2 HP');
        assert(b.cur===b.hp,'Later arrival should not gain Omen HP');
      },
      gatebreaker:()=>{
        const d=dummy();S.rooms[0]=[d];
        moveOneForward(d);
        assert(pos(d)===2,'First Hall entry should move 1 more room to Chapel');
        const another=dummy('second');S.rooms[0].push(another);
        moveOneForward(another);
        assert(pos(another)===1,'Breach should activate once per round');
      },
      lordOfAsh:()=>{
        const a=dummy('first'),b=dummy('second');S.rooms[3]=[a,b];
        const start=S.altar;moveOneForward(a);
        assert(S.altar===start-a.atk-1,'First breach did not receive +1 Altar loss');
        const mid=S.altar;moveOneForward(b);
        assert(S.altar===mid-b.atk,'Later breach incorrectly gained bonus');
      },
      dreadReaper:()=>{
        const hp=S.boss.cur;
        damageBoss(5,'First damage');damageBoss(5,'Second damage');
        assert(S.boss.cur===hp-8,'Reaper should prevent 2 from first hit only');
      },
      devourer:()=>{
        const hp=S.boss.cur;
        damageBoss(5,'Ritual test',true);
        damageBoss(5,'Basic test',false);
        assert(S.boss.cur===hp-9,'Ritual damage should be reduced by one');
        const d=dummy();S.rooms[0]=[d];
        defeatDemon(d);
        assert(S.boss.cur===hp-8,'Defeat of lesser Demon did not heal Boss by 1');
      }
    };
    for(const def of BOSSES){
      await record(def.n+' / Passive abilities',()=>{
        reset();S.boss={...def,cur:def.hp};
        S.bossRevealed=true;resetBossRoundFlags();
        S.altar=30;bossPassives[def.key]();
      });
    }
    for(const def of BOSSES){
      await record(def.n+' / Boss damage and defeat',()=>{
        reset();S.boss={...def,hp:100,baseHp:100,cur:100};
        S.bossRevealed=true;resetBossRoundFlags();
        S.relicDeck=[];
        damageBoss(10,'Audit hit',false);
        assert(S.boss.cur<100,'Boss ignored damage');
        damageBoss(500,'Defeat audit',false);
        assert(S.boss.cur===0,'Boss not defeated after lethal damage');
        assert(S.bossDefeatHandled||S.pendingBossChoice||S.bossesDefeated>0,
          'Boss defeat did not register');
      });
    }
    return report;
  });
  for(const test of results){
    console.log((test.pass?'PASS ':'FAIL ')+test.name+(test.error?' — '+test.error:''));
  }
  const failed=results.filter(x=>!x.pass);
  console.log('DEMON BOSS PLAYTHROUGH:',JSON.stringify({
    total:results.length,passed:results.length-failed.length,failed:failed.length,
    lesser:results.filter(x=>x.name.includes(' / Lesser / ')&&x.pass).length,
    greater:results.filter(x=>x.name.includes(' / Greater / ')&&x.pass).length,
    altarCrucifix:results.filter(x=>x.name.includes(' / Altar and Crucifix')&&x.pass).length,
    bossPhases:results.filter(x=>x.name.includes(' / Boss activation')&&x.pass).length,
    bossPassives:results.filter(x=>x.name.includes(' / Passive abilities')&&x.pass).length,
    bossDefeats:results.filter(x=>x.name.includes(' / Boss damage and defeat')&&x.pass).length
  }));
  if(failed.length||pageErrors.length){
    if(pageErrors.length)console.error('BROWSER ERRORS',JSON.stringify(pageErrors));
    process.exitCode=1;
  }
}finally{await browser.close()}
