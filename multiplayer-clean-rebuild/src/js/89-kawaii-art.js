/* Phase 2: self-contained, lightweight SVG kawaii room and character art.
 * Device-only presentation; gameplay state / Supabase are never changed. */
(()=>{
'use strict';
const skins=window.SanctumSkins;
if(!skins||typeof DEMON_TYPES==='undefined'||typeof BOSSES==='undefined')return;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const url=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
const repeat=(n,fn)=>Array.from({length:n},(_,i)=>fn(i)).join('');
function hash(s){let x=2166136261;for(const c of s)x=Math.imul(x^c.charCodeAt(0),16777619);return x>>>0}
const colors=[
 ['#f8beda','#d394cb','#fff5e9','#94629c'],
 ['#c6e1ff','#a3b7e9','#fff3f9','#727aae'],
 ['#ffe3b6','#d3a6df','#fff9e8','#a178a4'],
 ['#bfeadf','#90c9d8','#fff8e7','#6d95a0'],
 ['#ddc8fa','#b9a3e2','#fff3fa','#856aaa'],
 ['#ffd3c0','#e0a7cb','#fff9df','#a8799c'],
 ['#d6eefb','#92bfdf','#fff0fb','#7195ac'],
 ['#f9c9e7','#df91b7','#fff3e6','#9b7198']
];
function sparkle(seed,w,h,n){
 return repeat(n,i=>{const x=20+(seed+i*89+i*i*11)%(w-40),y=17+(seed*3+i*59)%(h-34),s=i%4===0?7:4;
  return '<path d="M'+x+' '+(y-s)+'Q'+(x+1)+' '+(y-1)+' '+(x+s)+' '+y+'Q'+(x+1)+' '+(y+1)+' '+x+' '+(y+s)+'Q'+(x-1)+' '+(y+1)+' '+(x-s)+' '+y+'Q'+(x-1)+' '+(y-1)+' '+x+' '+(y-s)+'Z" fill="#fff9f6" opacity=".8"/>';
 });
}
function flower(x,y,col){
 return '<g transform="translate('+x+' '+y+')">'+repeat(5,i=>'<ellipse cy="-9" rx="6" ry="9" fill="'+col+'" transform="rotate('+(i*72)+')"/>')+'<circle r="5" fill="#fff0a5"/></g>';
}
function roomArt(i){
 const names=['Gateway','Hall','Chapel','Crypt','Boss Room'],c=colors[[0,1,2,4,7][i]],
 [top,base,light,edge]=c;
 const altar=[
 '<path d="M135 535V278Q135 151 240 139Q345 151 345 278V535Z" fill="url(#a)" stroke="'+edge+'" stroke-width="17"/><path d="M156 515V288Q156 169 240 159Q324 169 324 288V515" fill="none" stroke="#fff8ff" stroke-width="7"/><ellipse cx="240" cy="343" rx="62" ry="122" fill="#fff" opacity=".30"/>',
 '<path d="M128 531V205Q145 140 240 133Q335 140 352 205V531Z" fill="url(#a)" stroke="'+edge+'" stroke-width="18"/><path d="M164 523V213H317V523M206 213V521M275 213V521" stroke="#fff4f7" stroke-width="10" fill="none"/><path d="M204 531L228 212H252L279 531" fill="#f7aacd" opacity=".7"/>',
 '<path d="M145 515V236Q153 146 240 135Q328 146 337 236V515Z" fill="url(#a)" stroke="'+edge+'" stroke-width="16"/><path d="M178 291L240 160L302 291L240 430Z" fill="#fff1aa" stroke="#fff8f0" stroke-width="8"/><path d="M240 168V422M180 292H300" stroke="'+edge+'" stroke-width="7"/><path d="M240 400C181 360 188 415 240 454C292 415 299 360 240 400Z" fill="#f7a5d0"/>',
 '<path d="M128 532V275Q131 157 240 143Q349 157 352 275V532Z" fill="#7771a5" stroke="#e7dafa" stroke-width="16"/><path d="M161 511V268Q167 218 240 204Q313 218 320 268V511Z" fill="#b194be"/><circle cx="216" cy="322" r="15" fill="#fff7f9"/><circle cx="263" cy="322" r="15" fill="#fff7f9"/><path d="M214 380Q240 405 266 380" fill="none" stroke="#fff7f7" stroke-width="9" stroke-linecap="round"/>',
 '<path d="M122 533L125 270Q136 174 179 160L205 198L240 135L276 198L307 160Q353 181 361 270L367 533Z" fill="#9774b9" stroke="#fff0f8" stroke-width="17"/><path d="M153 511V293Q166 212 240 204Q314 212 326 293V511Z" fill="url(#a)" stroke="#f7afd5" stroke-width="10"/><path d="M240 363C171 320 169 379 240 428C311 379 309 320 240 363Z" fill="#ffe8f4" stroke="'+edge+'" stroke-width="7"/>'
 ][i];
 const candles=repeat(7,j=>{let x=18+j*73,y=553+(j%2)*36;return '<rect x="'+x+'" y="'+y+'" width="12" height="33" rx="5" fill="#fffaf5" stroke="'+edge+'" stroke-width="2"/><ellipse cx="'+(x+6)+'" cy="'+(y-10)+'" rx="5" ry="13" fill="#ffe59c"/>';});
 const flowers=repeat(12,j=>flower((j%2?447:34)+(j%3)*7-7,224+Math.floor(j/2)*72,j%2?top:light));
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 720" role="img" aria-label="Kawaii '+names[i]+'"><defs><linearGradient id="sky" x2=".4" y2="1"><stop stop-color="'+top+'"/><stop offset="1" stop-color="'+base+'"/></linearGradient><radialGradient id="a"><stop stop-color="#fffdf8"/><stop offset=".6" stop-color="'+light+'"/><stop offset="1" stop-color="'+edge+'"/></radialGradient></defs><rect width="480" height="720" fill="url(#sky)"/>'+sparkle(i*199+24,480,620,27)+repeat(8,j=>'<path d="M'+(j*69)+' 105V548M0 '+(155+j*57)+'H480" stroke="'+edge+'" stroke-width="3" opacity=".13"/>')+'<path d="M0 553L150 495H331L480 553V720H0Z" fill="'+light+'" opacity=".7"/>'+repeat(8,j=>'<path d="M'+(j*76-30)+' 720L'+(124+j*37)+' 500" stroke="'+edge+'" stroke-width="5" opacity=".15"/>')+'<path d="M28 610V145Q28 94 72 91H99V605M452 610V145Q452 94 408 91H380V605" fill="none" stroke="'+edge+'" stroke-width="24" opacity=".53"/>'+altar+candles+flowers+'<rect x="6" y="7" width="468" height="706" rx="18" stroke="#fff9fb" stroke-width="9" opacity=".72" fill="none"/></svg>';
}
function symbol(key,col,edge){
 if(/fire|cinder|ash|hell|infernal|molten/i.test(key))return '<path d="M-18 28Q-45 -6 -1 -51Q-5 -20 14 -29Q46 3 17 32Z" fill="#ffd090" stroke="'+edge+'" stroke-width="6"/>';
 if(/bone|grave|lich|wraith|undead|hollow|reaper|rot|ossuary/i.test(key))return '<path d="M-31 -16Q-31 -47 0 -44Q31 -47 31 -16Q31 9 16 15V28H-16V15Q-31 9 -31 -16Z" fill="#fff8f6" stroke="'+edge+'" stroke-width="6"/><circle cx="-12" cy="-9" r="7" fill="'+edge+'"/><circle cx="12" cy="-9" r="7" fill="'+edge+'"/>';
 if(/blood|thorn|vow|martyr|crimson|oracle|tempt/i.test(key))return '<path d="M0 29C-50 2 -25 -35 0 -13C25 -35 50 2 0 29Z" fill="#f4a1c2" stroke="#fff9f2" stroke-width="6"/>';
 if(/iron|warden|husk|gargoyle|overlord|gatebreaker|gatekeeper/i.test(key))return '<path d="M0 -41L31 -22V25L0 43L-31 25V-22Z" fill="'+col+'" stroke="#fff8f7" stroke-width="6"/><path d="M-17 0L-3 12L20 -19" stroke="#fff3c0" fill="none" stroke-width="7"/>';
 return '<path d="M0 -43L12 -11H43L17 8L29 40L0 20L-28 40L-18 8L-43 -11H-12Z" fill="#fff3b5" stroke="'+edge+'" stroke-width="6"/>';
}
function character(d,greater=false,boss=false){
 const seed=hash(d.key)+(greater?131:0),[main,mid,light,edge]=colors[seed%colors.length],
 w=boss?600:480,h=boss?450:360,s=boss?1.18:1;
 const family=(d.family||'')+' '+d.key;
 const ghost=/undead|wraith|grave|reaper|soul|plague|lich/i.test(family);
 const animal=/beast|hound|drake|moon|rift|thorn/i.test(family);
 const wings=boss||greater||/imp|fiend/i.test(family)?'<path d="M-58 44Q-162 7 -151 -71Q-111 -50 -96 -85Q-72 -20 -44 -16Z" fill="'+mid+'" stroke="'+edge+'" stroke-width="8"/><path d="M58 44Q162 7 151 -71Q111 -50 96 -85Q72 -20 44 -16Z" fill="'+mid+'" stroke="'+edge+'" stroke-width="8"/>':'';
 const ears=animal||seed%3===0?'<path d="M-84 -64L-92 -146Q-50 -144 -27 -103H27Q50 -144 92 -146L84 -64" fill="'+mid+'" stroke="'+edge+'" stroke-width="8"/><path d="M-75 -103L-80 -130L-56 -107M75 -103L80 -130L56 -107" stroke="#fff6f7" stroke-width="6" fill="none"/>':
 '<path d="M-76 -76Q-106 -129 -69 -152Q-66 -111 -39 -104M76 -76Q106 -129 69 -152Q66 -111 39 -104" fill="'+mid+'" stroke="'+edge+'" stroke-width="8"/>';
 const crown=boss||greater?'<path d="M-71 -115L-55 -166L-22 -137L0 -182L22 -137L55 -166L71 -115Z" fill="#ffe6ab" stroke="'+edge+'" stroke-width="8"/><path d="M-56 -126H56" stroke="#fffdf4" stroke-width="7"/>':'';
 const face='<ellipse cy="-36" rx="101" ry="96" fill="url(#fur)" stroke="'+edge+'" stroke-width="10"/><path d="M-84 -62Q0 -128 84 -62" fill="none" stroke="#fffafb" stroke-width="8" opacity=".6"/><ellipse cx="-35" cy="-14" rx="21" ry="27" fill="#332449"/><ellipse cx="35" cy="-14" rx="21" ry="27" fill="#332449"/><ellipse cx="-42" cy="-23" rx="9" ry="11" fill="#fff"/><ellipse cx="28" cy="-23" rx="9" ry="11" fill="#fff"/><ellipse cx="-74" cy="20" rx="17" ry="10" fill="#f7abc5"/><ellipse cx="74" cy="20" rx="17" ry="10" fill="#f7abc5"/><circle cx="0" cy="21" r="5" fill="#d47b9d"/><path d="M-9 31Q0 42 9 31" stroke="#76546e" stroke-width="6" stroke-linecap="round" fill="none"/>';
 const body='<ellipse cy="83" rx="76" ry="87" fill="'+mid+'" stroke="'+edge+'" stroke-width="10"/><ellipse cy="88" rx="50" ry="57" fill="#fff4f9" opacity=".82"/><ellipse cx="-64" cy="91" rx="25" ry="30" fill="'+main+'" stroke="'+edge+'" stroke-width="7"/><ellipse cx="64" cy="91" rx="25" ry="30" fill="'+main+'" stroke="'+edge+'" stroke-width="7"/>';
 const trinket='<path d="M0 131C-40 106 -27 91 0 104C27 91 40 106 0 131Z" fill="#fff2ba" stroke="'+edge+'" stroke-width="6"/>';
 const shadow=ghost?'<path d="M-67 94Q-100 152 -39 126Q-15 163 7 137Q32 169 58 124Q103 150 77 91" fill="'+main+'" opacity=".65"/>':'';
 const text=greater?d.g||d.n||d.name:d.n||d.name;
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Kawaii '+esc(text)+'"><defs><radialGradient id="bg"><stop stop-color="'+light+'"/><stop offset=".65" stop-color="'+main+'"/><stop offset="1" stop-color="'+edge+'"/></radialGradient><linearGradient id="fur" x2=".7" y2="1"><stop stop-color="#fffafd"/><stop offset=".55" stop-color="'+main+'"/><stop offset="1" stop-color="'+mid+'"/></linearGradient></defs><rect width="'+w+'" height="'+h+'" rx="13" fill="url(#bg)"/><circle cx="'+(w/2)+'" cy="'+(h*.39)+'" r="'+(boss?178:135)+'" fill="#fff7fb" opacity=".25"/>'+sparkle(seed,w,h,boss?24:17)+repeat(boss?13:8,i=>flower(26+(seed+i*91)%(w-52),23+(seed*5+i*61)%(h-44),i%2?main:light))+'<ellipse cx="'+(w/2)+'" cy="'+(h*.91)+'" rx="'+(boss?150:115)+'" ry="24" fill="'+edge+'" opacity=".2"/><g transform="translate('+(w/2)+' '+(boss?189:153)+') scale('+s+')">'+wings+shadow+body+ears+face+crown+trinket+'</g><g transform="translate('+(w*.8)+' '+(h*.25)+')">'+symbol(d.key,main,edge)+'</g><rect x="7" y="7" width="'+(w-14)+'" height="'+(h-14)+'" rx="12" fill="none" stroke="#fffafa" stroke-width="7" opacity=".72"/></svg>';
}
const paths={},named={};
for(const d of DEMON_TYPES){
 const lesser=url(character(d)),greater=url(character(d,true));
 if(d.art&&!paths[d.art])paths[d.art]=lesser;
 if(d.gart&&!paths[d.gart])paths[d.gart]=greater;
 if(d.n)named[d.n]=lesser;
 if(d.g)named[d.g]=greater;
}
for(const b of BOSSES){
 const art=url(character(b,false,true));
 if(b.art)paths[b.art]=art;
 if(b.n)named[b.n]=art;
}
skins.registerArtworkPack(paths);
if(skins.registerNamedArtworkPack)skins.registerNamedArtworkPack(named);
['gateway','hall','chapel','crypt','boss'].forEach((roomName,i)=>{
 document.documentElement.style.setProperty('--sanctum-cute-'+roomName,'url("'+url(roomArt(i))+'")');
});
skins.set(skins.get());
window.SanctumKawaiiArt={
 roomCount:5,
 demonCount:DEMON_TYPES.length,
 bossCount:BOSSES.length,
 nameCount:Object.keys(named).length,
 getDemonArtwork:(key,greater=false)=>{
  const d=DEMON_TYPES.find(x=>x.key===key);
  return d?url(character(d,greater)):null;
 }
};
})();
