/* Gothic HUD sharp vector icon presentation. No gameplay state changes. */
(()=>{
'use strict';
const glyphs={
  turnTimerStat:'<path d="M5 3h14M5 21h14M7 3v4c0 2 3 3 5 5-2 2-5 3-5 5v4M17 3v4c0 2-3 3-5 5 2 2 5 3 5 5v4"/>',
  manaStatBox:'<circle cx="12" cy="12" r="8"/><path d="m12 4 3 5-3 3-3-3 3-5Zm0 8 3 3-3 5-3-5 3-3Z"/>',
  altarStatBox:'<path d="M12 3v18M5 10h14M9 3l3-2 3 2M7 20h10"/><circle cx="12" cy="10" r="2"/>',
  gothicProgressChip:'<path d="M12 6c-3-2-5-2-9-2v15c4 0 6 0 9 2m0-15c3-2 5-2 9-2v15c-4 0-6 0-9 2M12 6v15"/>',
  gothicXpHud:'<path d="M12 2 20 7v10l-8 5-8-5V7Z"/><path d="M8.5 12h.01M15.5 12h.01M10 16c1.5 1 2.5 1 4 0"/>'
};
for(const [id,paths] of Object.entries(glyphs)){
 const stat=document.getElementById(id);
 if(!stat||stat.querySelector('.gothicHudIcon'))continue;
 const icon=document.createElement('span');
 icon.className='gothicHudIcon';
 icon.setAttribute('aria-hidden','true');
 icon.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false">'+paths+'</svg>';
 stat.prepend(icon);
}
}
// Keep labels legible at both desktop and iPhone landscape sizes; leave the
// existing accessible names and live stat values untouched.
for(const [id,label] of Object.entries({
 turnTimerStat:'TIMER',manaStatBox:'MANA',altarStatBox:'ALTAR',
 gothicProgressChip:'FLOOR',gothicXpHud:'RELIC XP'
})){
 const stat=document.getElementById(id);
 const field=stat?.querySelector(':scope > span:not(.gothicHudIcon), :scope > small');
 if(field)field.textContent=label;
}
})();
