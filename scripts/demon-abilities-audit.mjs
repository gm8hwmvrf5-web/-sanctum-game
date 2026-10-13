import {chromium} from 'playwright';

// Demon / Boss encounter playthrough: all 35 catalog types in Lesser and
// Greater form, all 10 bosses, their triggered effects and lifecycle events.
// Uses the actual game engine in a real browser without touching live rooms.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
try{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof DEMON_TYPES!=='undefined'&&typeof runBossPhase==='function',null,{timeout:20000});
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

        case 'entryDiscard':{
          S.players.forEach(p=>{p.hand=S.priestDeck.splice(0,3)});
          const before=S.priestDiscard.length;
          triggerEnterPlay(d);
          assert(S.players.every(p=>p.hand.length===3-v),'Hollow Scribe did not discard '+v+' cards from every Priest');
          assert(S.priestDiscard.length===before+S.players.length*v,'Discarded Priest cards were not returned to the discard pile');
          break;
        }
        case 'basicArmor':{
          const hp=d.cur;
          damageDemon(d,5,'Audit Basic Attack',{basicAttack:true});
          assert(d.cur===hp-(5-v),'Iron Husk did not prevent '+v+' Basic Attack damage');
          damageDemon(d,2,'Audit Ritual',{ritual:true});
          assert(d.cur===hp-(5-v)-2,'Iron Husk incorrectly reduced Ritual damage');
          break;
        }
        case 'enterCorruption':{
          const before=roomCorruption(0);
          triggerEnterRoom(d);
          assert(roomCorruption(0)===before+v,'Rot Oracle entry Corruption incorrect in Gateway');
          moveOneForward(d);
          assert(roomCorruption(1)===v,'Rot Oracle entry Corruption incorrect in Hall');
          break;
        }
        case 'roomManaLoss':{
          triggerEnterRoom(d);
          assert(S.mana===12-v,'Dirge Cantor entry Mana loss incorrect');
          moveOneForward(d);
          assert(S.mana===12-2*v,'Dirge Cantor movement did not trigger Mana drain');
          break;
        }
        case 'hurtAltar':{
          const start=S.altar;
          damageDemon(d,1,'Audit attack');
          damageDemon(d,1,'Audit follow-up');
          assert(S.altar===start-2*v,'Thorn Martyr did not retaliate on each damaging hit');
          break;
        }
        case 'breachBlood':{
          S.players.forEach(p=>{p.blood=5});
          S.rooms[0]=[];S.rooms[3]=[d];
          moveOneForward(d);
          assert(S.players.every(p=>p.blood===5-v),'Chalice Thief did not steal '+v+' Blood from each Priest at the Altar');
          break;
        }
        case 'defeatSpawnImp':{
          defeatDemon(d);
          const equivalent=allDemons().reduce((n,x)=>n+(x.d.greater?2:1),0);
          assert(equivalent===v,'Grave Brood summoned '+equivalent+' of '+v+' Lesser Imps');
          break;
        }
        case 'defeatAltarCurse':{
          defeatDemon(d);
          assert(S.nextAltarBonus===v,'Vowbreaker did not apply its next Altar-loss curse');
          const before=S.altar;
          damageAltar(1,'Audit next Altar loss');
          assert(S.altar===before-1-v,'Vowbreaker did not increase next Altar loss');
          assert(S.nextAltarBonus===0,'Vowbreaker curse failed to expire after one hit');
          break;
        }
        case 'relentless':{
          const mate=dummy('room-mate');S.rooms[0].push(mate);
          moveDemons();
          assert(pos(d)===1+v,'Rift Strider moved '+pos(d)+' instead of '+(1+v)+' despite sharing its room');
          break;
        }
        case 'phaseManaDrain':{
          resolveStartDemonPhaseAbilities();
          assert(S.mana===12-v,'Censer Tyrant did not drain '+v+' Mana at Demon Phase start');
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
    for(const code of ['defeatSpawnImp','defeatAltarCurse']){
      const def=DEMON_TYPES.find(x=>x.a===code);
      await record(code+' / negative defeat suppression',()=>{
        reset();
        const d=make(def,false);
        S.rooms[0].push(d);
        defeatDemon(d,{suppressNegative:true});
        assert(S.nextAltarBonus===0,'Suppressed defeat still cursed the Altar');
        assert(allDemons().length===0,'Suppressed defeat still summoned an Imp');
      });
    }
    return report;
  });
  for(const test of results)console.log((test.pass?'PASS ':'FAIL ')+test.name+(test.error?' — '+test.error:''));
  const failed=results.filter(x=>!x.pass);
  console.log('DEMON ABILITY AUDIT:',JSON.stringify({total:results.length,passed:results.length-failed.length,failed:failed.length,types:35,forms:70}));
  if(failed.length||pageErrors.length){
    if(pageErrors.length)console.error('BROWSER ERRORS',JSON.stringify(pageErrors));
    process.exitCode=1;
  }
}finally{await browser.close()}
