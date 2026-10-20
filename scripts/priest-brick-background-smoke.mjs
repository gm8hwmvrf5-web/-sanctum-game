import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Focused visual-container regression. No full gameplay audit or live room.
const browser=await chromium.launch({headless:true});
try {
 for(const [label,viewport] of [
  ['desktop',{width:1440,height:900}],
  ['iPad landscape',{width:1024,height:768}],
  ['iPhone landscape',{width:844,height:390}]
 ]){
  const context=await browser.newContext({viewport,isMobile:label==='iPhone landscape',hasTouch:label==='iPhone landscape'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
   await page.evaluate(()=>{
    document.getElementById('playerCount').value='1';
    document.getElementById('startBtn').click();
    if(!S.started)throw Error('New Game failed');
    if(S.rogue?.laws?.offer?.keys?.length===3){
     window.__sanctumLawChoose(S.rogue.laws.offer.keys[0]);
     document.getElementById('rogueChoiceModal').classList.add('hidden');
    }
    clearTurnTimerInterval();
    render();
   });
   const report=await page.evaluate(()=>{
    const style=selector=>{
     const e=document.querySelector(selector);
     if(!e)return null;
     const css=getComputedStyle(e),r=e.getBoundingClientRect();
     return {background:css.backgroundColor,image:css.backgroundImage,
      border:css.borderTopWidth,shadow:css.boxShadow,width:r.width,height:r.height};
    };
    const ancestor=style('body > .app > #handPanel');
    const priest=style('#handPanel .handCharacterPriest');
    const rituals=style('#handPanel .handCharacterPriest > #ritualPanel.panel');
    const card=document.querySelector('#handContent .hand.carouselTrack > .card');
    const ritualCards=[...document.querySelectorAll('#handPanel .handCharacterPriest .rituals > .ritual')];
    const buttons=[...document.querySelectorAll('#handPanel .handCharacterPriest .rituals button[data-rit]')];
    const wall=getComputedStyle(document.body,'::before');
    return {shells:[ancestor,priest,rituals],
     brick:wall.backgroundImage,
     priestCard:card&&{background:getComputedStyle(card).backgroundColor,
      image:getComputedStyle(card).backgroundImage},
     ritualCards:ritualCards.map(el=>({color:getComputedStyle(el).backgroundColor,image:getComputedStyle(el).backgroundImage})),
     ritualButtonCount:buttons.length,
     buttonsAligned:buttons.length===3&&Math.max(...buttons.map(el=>el.getBoundingClientRect().bottom))-Math.min(...buttons.map(el=>el.getBoundingClientRect().bottom))<=2,
     endBesideConsecrate:document.getElementById('endBtn')?.nextElementSibling===document.getElementById('consecrateBtn'),
     board:style('#boardSection'),status:style('#topStatusBar'),
     screenW:window.innerWidth,scrollWidth:document.documentElement.scrollWidth};
   });
   assert(report.shells.every(s=>s&&s.background==='rgba(0, 0, 0, 0)'&&s.image==='none'&&s.border==='0px'&&s.shadow==='none'),
    label+' backplates should reveal brick, not black: '+JSON.stringify(report.shells));
   assert(report.brick.includes('url('),label+' original brick background remains');
   assert(report.priestCard&&(report.priestCard.background!=='rgba(0, 0, 0, 0)'||report.priestCard.image!=='none'),
    label+' visible Priest cards retain their art/frame/fill');
   assert.equal(report.ritualCards.length,3,label+' three Ritual cards still rendered');
   assert(report.ritualCards.every(x=>x.color!=='rgba(0, 0, 0, 0)'||x.image!=='none'),label+' readable Ritual card fills remain');
   assert.equal(report.ritualButtonCount,3);
   assert(report.buttonsAligned,label+' Ritual buttons remain aligned');
   assert(report.endBesideConsecrate,label+' turn action order preserved');
   assert(report.scrollWidth<=report.screenW+3,label+' no horizontal clipping');
   assert.deepEqual(errors,[],label+' browser errors');
   console.log('PASS '+label+': transparent hand/Priest/Ritual shells over original brick; intact cards, buttons and alignment.');
  }finally{await context.close()}
 }
}finally{await browser.close()}
