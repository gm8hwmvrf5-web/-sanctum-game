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
assert(html.includes('rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png?v=clean100"'),'browser favicon');
assert(html.includes('rel="apple-touch-icon" sizes="180x180" href="./icons/icon-180.png?v=clean100"'),'iPhone/iPad saved shortcut');
assert(html.includes('rel="manifest" href="./manifest.webmanifest?v=clean100"'),'PWA manifest');
assert(html.includes('<meta property="og:image" content="'+prefix+'icons/icon-512.png"'),'sharing preview icon');
assert(html.includes('<meta property="og:url" content="'+prefix+'"'),'live link identity');
assert(html.includes('<meta name="twitter:image" content="'+prefix+'icons/icon-512.png"'),'sharing fallback icon');
assert.deepEqual(manifest.icons.map(i=>i.src),[
 './icons/icon-192.png?v=clean100',
 './icons/icon-512.png?v=clean100'
]);
assert.equal(manifest.start_url,'./','existing install destination retained');
assert.equal(manifest.display,'standalone','existing PWA behavior retained');
assert(readFileSync('service-worker.js','utf8').includes("const CACHE_NAME='sanctum-clean-v100'"),'service worker icon cache update');
console.log('PASS: Sanctum icon used by favicon, iOS Home Screen, PWA manifest and link preview; all original icon assets valid.');
