const CACHE_NAME='sanctum-pwa-v12';
const CORE=[
 './','./index.html','./manifest.webmanifest',
 './icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'
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
  const isGamePart=url.pathname.includes('/parts/game-');
  const isHtml=request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');
  if(isGamePart||isHtml){
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(
    caches.match(request).then(hit=>hit||fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
      return response;
    }))
  );
});
