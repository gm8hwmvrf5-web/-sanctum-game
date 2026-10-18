/* Local font-size controls. These settings never enter multiplayer state. */
(()=>{
  'use strict';

  const KEY='sanctum_font_settings_v1';
  const DEFAULTS={numbers:100,abilities:100};
  const BASE={
    numberBoard:10,
    numberPopup:9.5,
    numberReader:17,
    numberBoss:12,
    abilityBoard:9,
    abilityPopup:10,
    abilityReader:15,
    abilityBoss:10
  };

  const clamp=v=>Math.max(70,Math.min(180,Math.round(Number(v)||100)));

  function read(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {
        numbers:clamp(raw.numbers??DEFAULTS.numbers),
        abilities:clamp(raw.abilities??DEFAULTS.abilities)
      };
    }catch(_){
      return {...DEFAULTS};
    }
  }

  let settings=read();

  function px(base,percent){
    return (base*(percent/100)).toFixed(2)+'px';
  }

  function apply(){
    const root=document.documentElement;
    root.style.setProperty('--sanctum-number-board',px(BASE.numberBoard,settings.numbers));
    root.style.setProperty('--sanctum-number-popup',px(BASE.numberPopup,settings.numbers));
    root.style.setProperty('--sanctum-number-reader',px(BASE.numberReader,settings.numbers));
    root.style.setProperty('--sanctum-number-boss',px(BASE.numberBoss,settings.numbers));
    root.style.setProperty('--sanctum-ability-board',px(BASE.abilityBoard,settings.abilities));
    root.style.setProperty('--sanctum-ability-popup',px(BASE.abilityPopup,settings.abilities));
    root.style.setProperty('--sanctum-ability-reader',px(BASE.abilityReader,settings.abilities));
    root.style.setProperty('--sanctum-ability-boss',px(BASE.abilityBoss,settings.abilities));

    const n=document.getElementById('damageFontSize');
    const a=document.getElementById('abilityFontSize');
    const nv=document.getElementById('damageFontSizeValue');
    const av=document.getElementById('abilityFontSizeValue');
    if(n&&Number(n.value)!==settings.numbers)n.value=String(settings.numbers);
    if(a&&Number(a.value)!==settings.abilities)a.value=String(settings.abilities);
    if(nv)nv.textContent=settings.numbers+'%';
    if(av)av.textContent=settings.abilities+'%';
  }

  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(settings))}catch(_){}
  }

  function bind(){
    const numberSlider=document.getElementById('damageFontSize');
    const abilitySlider=document.getElementById('abilityFontSize');
    if(numberSlider&&!numberSlider.dataset.bound){
      numberSlider.dataset.bound='1';
      numberSlider.value=String(settings.numbers);
      numberSlider.addEventListener('input',()=>{
        settings.numbers=clamp(numberSlider.value);
        apply();
        save();
      });
    }
    if(abilitySlider&&!abilitySlider.dataset.bound){
      abilitySlider.dataset.bound='1';
      abilitySlider.value=String(settings.abilities);
      abilitySlider.addEventListener('input',()=>{
        settings.abilities=clamp(abilitySlider.value);
        apply();
        save();
      });
    }
    apply();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();

  window.SanctumFontSettings={
    get values(){return {...settings}},
    set(numbers,abilities){
      settings={numbers:clamp(numbers),abilities:clamp(abilities)};
      apply();
      save();
    }
  };
})();
