import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const checks=[];
async function testViewport(width,height,phone=false){
 const page=await browser.newPage({viewport:{width,height},isMobile:phone,deviceScaleFactor:1});
 const errs=[];
 page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(800);
 await page.evaluate(()=>{
  const setup=document.getElementById('setupModal');
  document.getElementById('playerCount').value='1';
  document.getElementById('startBtn').click();
  // Existing tutorial and Ward draft are allowed to open after setup.
  if(typeof window.__sanctumGothicPreview?.mount==='function')window.__sanctumGothicPreview.mount();
 });
 await page.waitForTimeout(500);
 const result=await page.evaluate(()=>{
  const qs=x=>document.querySelector(x);
  const board=qs('#boardSection'),hud=qs('#topStatusBar'),priest=qs('#handPanel .handCharacterPriest');
  const action=qs('#gothicPreviewActions'),basic=qs('#basicBtn'),end=qs('#endBtn');
  const menu=qs('#gothicMenuBtn');
  const ward=qs('#wardcraftCast');
  const btns=[...action?.querySelectorAll('button')||[]].map(x=>x.id);
  if(!document.documentElement.classList.contains('gothicUiPreview'))throw Error('Preview stylesheet not enabled');
  if(!board||!priest||!hud||!qs('#gothicPreviewHeader'))throw Error('Missing core board/Priest/HUD');
  if(!qs('#gothicWardHeader').textContent.includes('WARDCRAFT'))throw Error('No Wardcraft header');
  if(qs('#gothicPreviewHeader').querySelector('#topStatusBar')!==hud)throw Error('Status HUD not integrated');
  const uniqueBasic=document.querySelectorAll('#basicBtn').length;
  const uniqueEnd=document.querySelectorAll('#endBtn').length;
  if(uniqueBasic!==1||uniqueEnd!==1)throw Error('Duplicate turn action buttons: basic='+uniqueBasic+' end='+uniqueEnd);
  if(action?.querySelectorAll('button').length!==5)throw Error('Unexpected action bar button count: '+action?.querySelectorAll('button').length);
  const visibleActions=[...action.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>b.id);
  if(visibleActions.join(',')!=='basicBtn,gothicWardPlaceholder,endBtn,gothicMenuBtn')
    throw Error('Incorrect initial button order: '+visibleActions.join(','));

  if(!action||basic?.parentElement!==action||end?.parentElement!==action||menu?.parentElement!==action||ward?.parentElement!==action)throw Error('Real game actions not relocated: '+JSON.stringify({started:S?.started,phase:S?.phase,action:!!action,basic:basic?.parentElement?.id,end:end?.parentElement?.id,menu:menu?.parentElement?.id,ward:ward?.parentElement?.id,priest:!!priest,hasRender:!!window.__sanctumGothicPreview}));
  if(!priest.querySelector('.gothicHandTitle')&&!qs('.gothicHandTitle'))throw Error('Priest card header missing');
  if(qs('#ritualPanel .ritual')&&!qs('#ritualPanel .gothicRitualHead'))throw Error('Rituals not converted');
  if(typeof basic.onclick!=='function'||typeof end.onclick!=='function')throw Error('Original gameplay button handlers lost');
  if(!qs('#sanctumOnlinePanel'))throw Error('Multiplayer lobby interface missing');
  // Fake a selected Ward only to exercise the presentation, not combat state.
  S.wardcraft=S.wardcraft||{};
  S.wardcraft.selected='cinder';S.wardcraft.active=null;S.wardcraft.offers=[];
  S.phase='Priest';S.rogue=S.rogue||{};S.rogue.enabled=true;S.rogue.nodeType='battle';S.rogue.pendingClear=false;
  S.mana=30;S.players[S.current].blood=6;
  render();
  const ready=qs('#wardcraftCast');
  if(!ready||ready.hidden||ready.parentElement!==qs('#gothicPreviewActions'))throw Error('Selected Ward action is not visible');
  const readyOrder=[...action.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>b.id);
  if(readyOrder.join(',')!=='basicBtn,wardcraftCast,endBtn,gothicMenuBtn')
    throw Error('Incorrect Ward-ready button order: '+readyOrder.join(','));
  // Existing button opens the real existing targeting modal.
  ready.click();
  if(qs('#wardCastModal')?.classList.contains('hidden'))throw Error('Ward placement modal failed to open');
  qs('#wardCastCancel')?.click();
  const rect=qs('#gothicPreviewHeader').getBoundingClientRect();
  const rooms=[...board.querySelectorAll('.room')].map(n=>Math.round(n.getBoundingClientRect().width));
  return {buttons:btns,headerWidth:Math.round(rect.width),rooms,rituals:qs('#ritualPanel .rituals')?.children.length,landscape:innerWidth>innerHeight};
 });
 if(errs.length)throw Error('Browser errors: '+errs.join('; '));
 checks.push({viewport:width+'x'+height,...result});
 await page.close();
}
await testViewport(1536,768);
await testViewport(844,390,true);
await browser.close();
console.log('GOTHIC UI PREVIEW SMOKE PASSED:',JSON.stringify(checks));
