import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const errors=[];
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle',timeout:60000});
 await page.locator('#difficultySetupSelect').waitFor();
 assert.equal(await page.locator('#difficultySetupSelect option').count(),5);
 assert.equal(await page.locator('#difficultyPauseSelect option').count(),5);
 await page.locator('#difficultySetupSelect').selectOption('hell');
 const setup=await page.evaluate(()=>document.getElementById('difficultySetupInfo').textContent);
 assert(setup.includes('10%'),setup);
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>window.__sanctumDifficulty?.level()==='hell'&&S.started,{timeout:10000});
 // Every new run must resolve one starting Law before opening Pause.
 await page.waitForFunction(()=>S.rogue?.laws?.offer?.keys?.length===3,{timeout:10000});
 await page.locator('#rogueChoiceGrid .lawDraftChoice').first().click();
 await page.waitForFunction(()=>S.phase==='Priest'&&S.rogue?.laws?.active?.length===1);
 let snap=await page.evaluate(()=>{
  const d=S.rooms.flat()[0];
  return {difficulty:S.difficulty,round:S.round,enemyHp:demonMaxHP(d),enemyAttack:demonAttack(d),baseHp:d.hp,baseAttack:d.atk,roundMultiplier:window.__sanctumDifficulty.multiplier(),save:JSON.parse(compactSaveJSON()).state.difficulty};
 });
 assert.equal(snap.difficulty,'hell');
 assert.equal(snap.roundMultiplier,1.1);
 assert.equal(snap.save,'hell');
 assert(snap.enemyHp>=Math.round(snap.baseHp*1.1),'Expected HP scaling on real Demon');
 await page.evaluate(()=>document.getElementById('pauseBtn').click());
 await page.locator('#difficultyPauseSelect').waitFor({state:'visible'});
 await page.locator('#difficultyPauseSelect').selectOption('easy');
 await page.waitForFunction(()=>S.difficulty==='easy');
 const after=await page.evaluate(()=>{
  const d=S.rooms.flat()[0];
  return {mode:S.difficulty,hp:demonMaxHP(d),attack:demonAttack(d),bossFactor:bossHpFactor(),saved:JSON.parse(compactSaveJSON()).state.difficulty};
 });
 assert.equal(after.mode,'easy');assert.equal(after.saved,'easy');
 assert(after.hp<=snap.enemyHp,'HP should decrease after selecting Easy');
 await page.locator('#difficultyPauseSelect').selectOption('tormented');
 const tormented=await page.evaluate(()=>({
  mode:S.difficulty,
  multipliers:Array.from({length:4},(_,i)=>{const players=S.players;S.players=Array.from({length:i+1},()=>({}));const value=bossHpFactor();S.players=players;return value}),
  summary:document.getElementById('difficultyPauseInfo').textContent
 }));
 assert.equal(tormented.mode,'tormented');
 assert.deepEqual(tormented.multipliers,[1,1.15,1.3,1.45]);
 assert(tormented.summary.includes('145%'));
 // Mobile landscape: controls remain accessible with responsive layout.
 await page.setViewportSize({width:844,height:390});
 assert(await page.locator('#difficultyPauseSelect').isVisible(),'Difficulty menu hidden on iPhone landscape');
 await page.locator('#difficultyPauseSelect').scrollIntoViewIfNeeded();
 const width=await page.locator('#difficultyPauseSelect').evaluate(el=>el.getBoundingClientRect().width);
 assert(width>110,'Difficulty selector too small on mobile landscape');
 assert.deepEqual(errors,[],'Browser errors during difficulty menu use');
 console.log('PASS: Actual browser setup selector, live mode changes, saved difficulty, Tormented party HP factors, and mobile landscape menu.');
}finally{
 await browser.close();
}
