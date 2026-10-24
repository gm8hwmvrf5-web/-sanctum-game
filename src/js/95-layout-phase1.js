/* Layout Redesign — Phase 1 viewport shell.
   Never moves demons, changes combat state, or affects passage selection.
   Tabs choose which EXISTING room lane to inspect, not where the party travels. */
(()=>{
  'use strict';
  const app=document.querySelector('body > .app');
  const board=document.getElementById('boardSection');
  const status=document.getElementById('topStatusBar');
  const hand=document.getElementById('handPanel');
  if(!app||!board||!status||!hand)return;
  const rooms=[...board.children].filter(el=>el.classList.contains('room'));
  if(rooms.length!==5)return;

  app.classList.add('layoutPhase1');
  const nav=document.createElement('nav');
  nav.id='layoutRoomNav';
  nav.setAttribute('role','tablist');
  nav.setAttribute('aria-label','Inspect sanctum rooms (view only)');
  const names=['Gateway','Hall','Chapel','Crypt','Boss'];
  const tabs=rooms.map((room,i)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='layoutRoomTab';
    button.setAttribute('role','tab');
    button.id='layoutRoomTab'+i;
    room.id='layoutRoomView'+i;
    room.setAttribute('role','tabpanel');
    room.setAttribute('aria-labelledby',button.id);
    button.setAttribute('aria-controls',room.id);
    const name=document.createElement('span');
    name.textContent=names[i];
    const count=document.createElement('span');
    count.className='roomCount';
    count.setAttribute('aria-hidden','true');
    button.append(name,count);
    button.addEventListener('click',()=>focus(i));
    button.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(i+1)%rooms.length;
      else if(event.key==='ArrowLeft')next=(i+rooms.length-1)%rooms.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=rooms.length-1;
      else return;
      event.preventDefault();
      focus(next);
      tabs[next].focus();
    });
    nav.appendChild(button);
    return button;
  });
  board.prepend(nav);
  let focused=0;
  function focus(index){
    focused=index;
    rooms.forEach((room,i)=>{
      const active=i===index;
      room.classList.toggle('is-focused',active);
      room.setAttribute('aria-hidden',active?'false':'true');
      tabs[i].setAttribute('aria-selected',active?'true':'false');
      tabs[i].tabIndex=active?0:-1;
    });
    board.dataset.focusedRoom=names[index].toLowerCase();
  }
  // Use the existing game-owned Relic XP meter, never a duplicated counter.
  // Older Priest rendering patches relocate this element after each redraw.
  function keepRelicXpAtTop(){
    const meter=document.getElementById('relicXpMeterStat');
    if(meter&&meter.parentElement!==status){
      status.insertBefore(meter,document.getElementById('turnTimerStat')||null);
    }
  }
  function updateRoomCounts(){
    rooms.forEach((room,i)=>{
      const amount=i===4
        ?(room.querySelector('#bossArea .bossCard, #bossArea .boss, #bossArea .demon')?1:0)
        :room.querySelectorAll('.demons .demon').length;
      const count=tabs[i].querySelector('.roomCount');
      count.textContent=String(amount);
      tabs[i].setAttribute('aria-label',names[i]+', '+amount+' '+(amount===1?'enemy':'enemies')+', inspect room');
    });
  }
  let scheduled=false;
  function scheduleCounts(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;updateRoomCounts();});
  }
  if(typeof renderBoard==='function'){
    const previous=renderBoard;
    renderBoard=function(){
      const result=previous.apply(this,arguments);
      scheduleCounts();
      return result;
    };
  }
  if(typeof renderPlayer==='function'){
    const previous=renderPlayer;
    renderPlayer=function(){
      const result=previous.apply(this,arguments);
      keepRelicXpAtTop();
      return result;
    };
  }
  if(typeof rogueliteRenderHud==='function'){
    const previous=rogueliteRenderHud;
    rogueliteRenderHud=function(){
      const result=previous.apply(this,arguments);
      keepRelicXpAtTop();
      return result;
    };
  }
  focus(0);
  keepRelicXpAtTop();
  updateRoomCounts();
})();
