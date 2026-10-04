const CACHE_NAME='sanctum-pwa-v6';
const CORE=[
 './','./index.html','./manifest.webmanifest',
 './icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png',
 './parts/game-001.part',
 './parts/game-002.part',
 './parts/game-003.part',
 './parts/game-004.part',
 './parts/game-005.part',
 './parts/game-006.part',
 './parts/game-007.part',
 './parts/game-008.part',
 './parts/game-009.part'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));return r;}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});