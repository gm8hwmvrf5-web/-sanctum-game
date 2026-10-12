import {chromium} from 'playwright';

// Comprehensive normal + Empowered Priest-card playthrough. Uses the real
// playCard/empowerCard actions, real modal buttons, and actual card effects.
// No Supabase rooms are created; every scenario runs in an isolated browser
// sandbox with a fresh game state and full draw decks.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof startGame==='function'&&typeof playCard==='function');
  const report=await page.evaluate(async()=>{
    const results=[];
    let alerts=[];
    window.alert=s=>{alerts.push(String(s))};
    const assert=(condition,message)=>{
      if(!condition)throw new Error(message);
    };
    const test=(name,fn)=>results.push({name,fn});
    const fresh=(c,empowered)=>{
      clearTurnTimerInterval();
      S=freshState();
      S.started=true;
      S.phase='Priest';
      S.round=1;
      S.current=0;
      S.altar=5;
      S.mana=sharedManaRoundValue();
      S.players=Array.from({length:2},(_,i)=>({
        name:'Audit Priest '+(i+1),char:Object.keys(CHARACTERS)[i],
        blood:i===0?9:0,hand:[],basic:false,ritualUsed:[false,false,false],
        forceEmpower:false,discardUsed:false,consecrateUsed:false
      }));
      S.mana=sharedManaRoundValue();
      S.boss={...BOSSES[0],cur:BOSSES[0].hp};
      S.rogue={enabled:false};
      S.priestDeck=buildPriestDeck();
      S.demonDeck=buildDemonDeck();
      S.relicDeck=RELICS.map(r=>r.key);
      resetCrucifixDeck();
      const makeDemon=(idx,id)=>{
        const d={...DEMON_TYPES[idx%DEMON_TYPES.length],id,cur:110,
          hp:110,b:10,greater:false,status:{}};
        return d;
      };
      S.rooms[0]=[makeDemon(3,'audit-demon-1'),makeDemon(4,'audit-demon-2'),
        makeDemon(5,'audit-demon-3')];
      S.rooms[1]=[makeDemon(6,'audit-demon-4'),
        makeDemon(7,'audit-demon-5'),makeDemon(8,'audit-demon-6')];
      S._audit={names:[],choices:[]};
      if(c.k==='execute')S.rooms[0][0].cur=empowered?6:2;
      if(c.k==='echo')S.lastPriestCardPlayed={...PRIEST.find(x=>x.n==='Holy Bolt')};
      const p=S.players[0];
      if(empowered){
        p.hand.push({...c,id:'audit-keep'},{...c,id:'audit-sacrifice'});
        empowerCard('audit-keep');
        assert(p.hand.length===1&&p.hand[0].empowered===true,
          'Empower merge did not leave one playable card');
      }else{
        p.hand=[{...c,id:'audit-keep',empowered:false}];
      }
      render();
      return {
        mana:S.mana,altar:S.altar,blood:p.blood,otherBlood:S.players[1].blood,
        otherHand:S.players[1].hand.length,hand:p.hand.length,
        deck:S.priestDeck.length,demonDeck:S.demonDeck.length,
        demonDiscard:S.demonDiscard.length,
        cur:S.rooms[0][0].cur,secondCur:S.rooms[0][1].cur,
        thirdCur:S.rooms[0][2].cur,
        firstBlood:demonBlood(S.rooms[0][0]),
        defeated:S.defeats
      };
    };
    let interactions=0;
    let choosing=true;
    let chooseMode='normal';
    // Click the very same buttons that a human would click in the game.
    // Done / Cancel are only used in explicit opt-out test scenarios.
    const auto=setInterval(()=>{
      if(!choosing)return;
      const reveal=document.getElementById('cardRevealModal');
      let target=null;
      if(reveal&&!reveal.classList.contains('hidden')){
        target=reveal.querySelector('#cardRevealGrid [data-reveal-pick]');
      }
      const modal=document.getElementById('choiceModal');
      if(!target&&modal&&!modal.classList.contains('hidden')){
        const grid=modal.querySelector('#choiceGrid');
        if(grid){
          const all=[...grid.querySelectorAll('button.choice,div.choice')].filter(el=>!el.disabled);
          if(chooseMode==='cancel')target=document.getElementById('choiceCancel');
          else if(chooseMode==='damageAlternative'&&
              document.getElementById('choiceTitle')?.textContent.includes('choose effect'))
            target=all[1]||all[0];
          else if(chooseMode==='protection'&&
              document.getElementById('choiceTitle')?.textContent.includes('choose what kind'))
            target=all[1]||all[0];
          else if(chooseMode==='maxConversion'&&
              document.getElementById('choiceTitle')?.textContent.includes('choose how much Mana'))
            target=all[all.length-1];
          else target=all.find(el=>!el.classList.contains('damageTargetDone')&&
              !/DONE/i.test(el.textContent?.slice(0,22)||''))||all[0];
        }
      }
      if(target){interactions++;target.click()}
    },5);

    const run=async(c,empowered,mode='normal')=>{
      chooseMode=mode;alerts=[];interactions=0;
      const before=fresh(c,empowered);
      chooseMode=mode;
      const started=Date.now();
      await Promise.race([
        playCard('audit-keep',false),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Card interaction timed out')),3500))
      ]);
      assert(Date.now()-started<3500,'Card interaction took too long');
      const p=S.players[0],v=empowered?c.xv:c.v;
      assert(alerts.length===0,'Unexpected alert: '+alerts.join('; '));
      assert(!p.hand.some(x=>x.id==='audit-keep'),'Played card remained in hand');
      assert(S.priestDiscard.some(x=>x.id==='audit-keep'),'Played card missing from discard');
      assert(S.priestDiscard.find(x=>x.id==='audit-keep')?.empowered!==true,
        'Played card did not return to unempowered discard state');
      const costMana=c.m;
      // The Empowered blood surcharge follows the real on-card merge rules.
      const costBlood=empowered?empowerBloodCost(c):0;
      const expectedMana=before.mana-costMana;
      assert(p.blood>=0&&S.mana>=0,'Resources became negative');
      const target=S.rooms.flat().find(d=>d.id==='audit-demon-1');
      const second=S.rooms.flat().find(d=>d.id==='audit-demon-2');
      const effect=(condition,message)=>assert(condition,c.n+(empowered?' [Empowered]':' [Normal]')+': '+message);
      switch(c.k){
        case 'damage':effect(target?.cur===before.cur-v,'Direct damage should equal '+v);break;
        case 'multiDamage':
          effect(target?.cur===before.cur-v,'First target damage incorrect');
          effect(second?.cur===before.secondCur-v,'Second target damage incorrect');
          break;
        case 'mark':effect(target?.status.mark===v,'Mark should grant +'+v);break;
        case 'roomDamage':
          effect(target?.cur===before.cur-v&&second?.cur===before.secondCur-v,'Room damage incorrect');
          break;
        case 'purify':
          effect(target?.status.abilityRemoved===true,'Demon ability was not removed');
          effect(target?.cur===before.cur-v,'Purify damage incorrect');
          break;
        case 'peekDemon':
          effect(S.demonDiscard.length===before.demonDiscard+(empowered?c.xbanish:c.banish),
            'Banish count incorrect');
          effect(S.demonDeck.length===before.demonDeck-(empowered?c.xbanish:c.banish),
            'Banish did not remove cards from Demon deck');
          break;
        case 'altarTurnRenewal':
          effect(S.altar===before.altar+v,'Altar restoration incorrect');
          effect(S.altarTurnRenewals.some(x=>x.amount===(empowered?c.xregen:c.regen)&&
            x.remaining===(empowered?c.xticks:c.ticks)),'Lingering Altar healing missing');
          break;
        case 'altarBarrierDamage':
          effect(target?.cur===before.cur-v,'Attack portion incorrect');
          effect(S.altarBarrier===(empowered?c.xguard:c.guard),'Barrier portion incorrect');
          break;
        case 'stop':
          effect(S.rooms.flat().filter(d=>d.status.stop).length===v,'Stop count incorrect');
          break;
        case 'altarDefeatBlessingDamage':
          effect(target?.cur===before.cur-v,'Damage portion incorrect');
          effect(S.altarDefeatBlessings.some(x=>x.amount===(empowered?c.xdefeatHeal:c.defeatHeal)&&
            x.remaining===(empowered?c.xcharges:c.charges)),
            'On-defeat Altar healing missing');
          break;
        case 'altarRoundRenewal':
          effect(S.altar===before.altar+v,'Immediate healing incorrect');
          effect(S.altarRoundRenewals.some(x=>x.amount===(empowered?c.xroundHeal:c.roundHeal)&&
            x.remaining===(empowered?c.xrounds:c.rounds)),
            'Scheduled round restoration missing');
          break;
        case 'execute':
          effect(!target&&S.defeats===before.defeated+1,'Eligible Demon not executed');
          break;
        case 'iron':
          effect(S.altarBarrier===v,'Barrier did not match amount');
          effect(p.hand.length===before.hand-1+(empowered?1:0),
            'Empowered bonus card draw incorrect');break;
        case 'mana':
          effect(S.mana===Math.min(sharedManaRoundValue(),expectedMana+v),
            'Mana gain incorrect; expected '+Math.min(sharedManaRoundValue(),expectedMana+v)+' got '+S.mana);
          break;
        case 'sharedDraw':
          effect(S.players[1].hand.length===v,'Other player drew '+S.players[1].hand.length+' instead of '+v);
          break;
        case 'quickPrayer':
          effect(p.hand.length===v,'Drew '+p.hand.length+' rather than '+v);
          effect(p.hand.every(x=>quickPrayerCategoryMatches(x,mode==='protection'?'protection':'attack')),
            'Drawn cards were not in requested category');break;
        case 'altarChoice':
          if(mode==='damageAlternative')
            effect(target?.cur===before.cur-v,'Chosen damage effect incorrect');
          else effect(S.altar===before.altar+v,'Chosen Altar restoration incorrect');
          break;
        case 'echo':
          effect(target?.cur===before.cur-(empowered?7:3),
            'Holy Echo did not repeat last card using intended strength');
          effect(S.lastPriestCardPlayed?.n==='Holy Bolt',
            'Holy Echo should not replace the recorded previous card');
          break;
        case 'drainBlood':
        case 'drainBloodDraw':
        case 'drainBloodMana':
          effect(target&&demonBlood(target)===before.firstBlood-v,
            'Demon Blood drain incorrect');
          if(c.k==='drainBloodDraw')
            effect(p.hand.length===(empowered?c.xdraw:c.draw),'Draw-from-drain count incorrect');
          if(c.k==='drainBloodMana')
            effect(S.mana===Math.min(sharedManaRoundValue(),expectedMana+
              (empowered?c.xmanaGain:c.manaGain)),'Mana from drain incorrect');
          break;
        case 'multiDrainBlood':
          effect(S.rooms.flat().filter(d=>d.status.bloodDrained===1).length===v,
            'Did not drain '+v+' distinct Demons');break;
        case 'manaToBlood':{
          const available=Math.min(v,expectedMana-(expectedMana%2));
          effect(S.mana===expectedMana-available,
            'Mana conversion wrong; expected spend '+available+' got '+(expectedMana-S.mana));
          effect(S.players.reduce((n,z)=>n+z.blood,0)-before.blood-before.otherBlood===
            available/2-costBlood,'Blood conversion incorrect');
          break;
        }
        default:throw new Error('Uncovered Priest kind: '+c.k);
      }
      // Effect-specific Mana comparisons, apart from intentional Mana gain or spending.
      if(!['mana','drainBloodMana','manaToBlood'].includes(c.k)){
        effect(S.mana===expectedMana,'Card Mana cost incorrect: got '+S.mana+' expected '+expectedMana);
      }
      // Base Blood drain and effects can raise Blood, so limit this assertion.
      if(!['drainBlood','drainBloodDraw','drainBloodMana','multiDrainBlood',
            'manaToBlood','execute'].includes(c.k)){
        effect(p.blood===before.blood-costBlood,'Empowered Blood surcharge incorrect');
      }
      return {interactions,playCost:costMana,bloodCost:costBlood};
    };

    const completed=[];
    try{
      for(const c of PRIEST){
        for(const empowered of [false,true]){
          const name=c.n+' / '+(empowered?'Empowered':'Normal');
          try{
            const details=await run(c,empowered,
              c.k==='manaToBlood'?'maxConversion':'normal');
            completed.push({name,pass:true,...details});
          }catch(err){
            completed.push({name,pass:false,error:err.message,alerts:[...alerts]});
          }
        }
      }
      for(const [name,cardName,mode] of [
        ['Quick Prayer / Protection draw','Quick Prayer','protection'],
        ['Quick Prayer / Empowered Protection draw','Quick Prayer','protectionEmp'],
        ['Consecration / damage choice','Consecration','damageAlternative']
      ]){
        try{
          const c=PRIEST.find(x=>x.n===cardName);
          const details=await run(c,mode==='protectionEmp',mode==='protectionEmp'?'protection':mode);
          completed.push({name,pass:true,...details});
        }catch(err){completed.push({name,pass:false,error:err.message})}
      }
      // Explicit cancellation check: a canceled targeted Priest card must
      // refund its cost and return to the same hand with no damage.
      try{
        const c=PRIEST.find(x=>x.n==='Holy Bolt');
        const before=fresh(c,false);
        chooseMode='cancel';alerts=[];
        await Promise.race([
          playCard('audit-keep'),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error('Cancel timed out')),3500))
        ]);
        assert(S.mana===before.mana,'Cancelled Priest card spent Mana');
        assert(S.players[0].hand.some(x=>x.id==='audit-keep'),
          'Cancelled Priest card vanished');
        assert(S.rooms[0][0].cur===before.cur,'Cancelled Priest card dealt damage');
        completed.push({name:'Cancelled target selection / full rollback',pass:true});
      }catch(err){completed.push({name:'Cancelled target selection / full rollback',pass:false,error:err.message})}
    }finally{
      choosing=false;clearInterval(auto);clearTurnTimerInterval();
    }
    return completed;
  });
  for(const test of report){
    console.log((test.pass?'PASS ':'FAIL ')+test.name+
      (test.error?' — '+test.error:'')+
      (test.alerts?.length?' ALERTS '+test.alerts.join('; '):''));
  }
  const failed=report.filter(t=>!t.pass);
  console.log('PRIEST PLAYTHROUGH:',JSON.stringify({
    passed:report.length-failed.length,failed:failed.length,total:report.length,
    normal:report.filter(t=>t.name.endsWith('/ Normal')&&t.pass).length,
    empowered:report.filter(t=>t.name.endsWith('/ Empowered')&&t.pass).length,
    dialogs:report.reduce((n,t)=>n+(t.interactions||0),0)
  }));
  if(failed.length||errors.length){
    if(errors.length)console.error('BROWSER ERRORS:',JSON.stringify(errors));
    process.exitCode=1;
  }
}finally{
  await browser.close();
}