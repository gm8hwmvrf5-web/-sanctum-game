const CACHE_NAME='sanctum-clean-v30';
const CORE=[
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/base.css',
  './src/styles/roguelite.css',
  './src/styles/mobile.css',
  './src/styles/multiplayer.css',
  './src/styles/accessibility.css',
  './src/styles/wards.css',
  './src/js/00-data.js',
  './src/js/10-engine.js',
  './src/js/15-asset-loader.js',
  './src/js/20-ui-foundation.js',
  './src/js/25-font-settings.js',
  './src/js/30-roguelite.js',
  './src/js/40-priest-ui.js',
  './src/js/50-mobile.js',
  './src/js/60-multiplayer.js',
  './src/js/70-multiplayer-patches.js',
  './src/js/80-wards.js',
  './assets/wards/ward-cinder.webp',
  './assets/wards/ward-thorns.webp',
  './assets/wards/ward-chains.webp',
  './assets/wards/ward-bell.webp',
  './assets/wards/ward-silence.webp',
  './assets/wards/ward-lantern.webp',
  './assets/wards/ward-vigil.webp',
  './assets/wards/ward-absolution.webp',
  './assets/wards/ward-siphon.webp',
  './assets/wards/ward-chalice.webp',
  './assets/bosses/boss-sprite.webp',
  './assets/embedded/demon-art-pending.svg',
  './assets/embedded/new_hollow_scribe.webp',
  './assets/embedded/new_iron_husk.webp',
  './assets/embedded/new_rot_oracle.webp',
  './assets/embedded/new_dirge_cantor.webp',
  './assets/embedded/new_thorn_martyr.webp',
  './assets/embedded/new_chalice_thief.webp',
  './assets/embedded/new_grave_brood.webp',
  './assets/embedded/new_vowbreaker.webp',
  './assets/embedded/new_rift_strider.webp',
  './assets/embedded/new_censer_tyrant.webp',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
  );
  self.clients.claim();
});

async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone());
    return response;
  }catch(err){
    const cached=await caches.match(request,{ignoreSearch:false});
    if(cached)return cached;
    if(request.mode==='navigate'){
      const fallback=await caches.match('./index.html');
      if(fallback)return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  // Only cache assets belonging to this game. Fetch events also fire for
  // cross-origin requests made by controlled pages; caching Supabase REST GETs
  // served an outdated lobby roster forever after the first player joined.
  // Leave Supabase, Realtime, CDNs, and all other external traffic to the network.
  if(url.origin!==self.location.origin)return;
  const isSource=url.pathname.includes('/src/');
  const isHtml=request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');
  if(isSource||isHtml){
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(
    caches.match(request).then(hit=>hit||fetch(request).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
      }
      return response;
    }))
  );
});
