import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const manifest=JSON.parse(readFileSync('manifest.webmanifest','utf8'));
const prefix='https://gm8hwmvrf5-web.github.io/-sanctum-game/multiplayer-clean-rebuild/';
const pngDimension=(p)=>{
 const x=readFileSync(p);
 assert.equal(x.subarray(0,8).toString('hex'),'89504e470d0a1a0a',p+' PNG signature');
 return [x.readUInt32BE(16),x.readUInt32BE(20)];
};
for(const n of [180,192,512]){
 assert.deepEqual(pngDimension('icons/icon-'+n+'.png'),[n,n],n+'px original app artwork');
}
assert(html.includes('rel="icon" type="image/png" sizes="192x192" href="./icons/sanctum-icon-192-v101.png"'),'browser favicon');
assert(html.includes('rel="apple-touch-icon" sizes="180x180" href="./sanctum-iphone-icon-v101.png"'),'iPhone/iPad saved shortcut');
assert(html.includes('rel="manifest" href="./manifest.webmanifest?v=clean101"'),'PWA manifest');
assert(html.includes('<meta property="og:image" content="'+prefix+'icons/icon-512.png"'),'sharing preview icon');
assert(html.includes('<meta property="og:url" content="'+prefix+'"'),'live link identity');
assert(html.includes('<meta name="twitter:image" content="'+prefix+'icons/icon-512.png"'),'sharing fallback icon');
assert.deepEqual(manifest.icons.map(i=>i.src),[
 './icons/sanctum-icon-192-v101.png',
 './icons/sanctum-icon-512-v101.png'
]);
assert.equal(manifest.start_url,'./','existing install destination retained');
assert.equal(manifest.display,'standalone','existing PWA behavior retained');
assert(readFileSync('service-worker.js','utf8').includes("const CACHE_NAME='sanctum-clean-v103'"),'service worker icon cache update');
console.log('PASS: Sanctum icon used by favicon, iOS Home Screen, PWA manifest and link preview; all original icon assets valid.');
