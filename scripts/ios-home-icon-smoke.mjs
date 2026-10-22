import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const root='sanctum-iphone-icon-v101.png';
const rootFallback='apple-touch-icon.png';
const oldApple='icons/icon-180.png';
const manifest=JSON.parse(readFileSync('manifest.webmanifest','utf8'));
const old=readFileSync(oldApple);
function icon(path,size){
 const x=readFileSync(path);
 assert.equal(x.subarray(0,8).toString('hex'),'89504e470d0a1a0a',path+' must be actual PNG');
 assert.equal(x.readUInt32BE(16),size,path+' width');
 assert.equal(x.readUInt32BE(20),size,path+' height');
 return x;
}
assert(icon(root,180).equals(old),'new iPhone asset must be the user’s existing original icon');
assert(icon(rootFallback,180).equals(old),'Safari fallback must use same Sanctum artwork');
assert(icon('apple-touch-icon-precomposed.png',180).equals(old));
assert(icon('icons/sanctum-icon-192-v101.png',192).equals(readFileSync('icons/icon-192.png')));
assert(icon('icons/sanctum-icon-512-v101.png',512).equals(readFileSync('icons/icon-512.png')));
assert.deepEqual(manifest.icons.map(x=>x.src),[
 './icons/sanctum-icon-192-v101.png',
 './icons/sanctum-icon-512-v101.png'
]);
assert.equal(manifest.start_url,'./','existing saved-game origin/start URL must remain unchanged');
assert.equal(manifest.display,'standalone','app mode must remain available');
const sw=readFileSync('service-worker.js','utf8');
assert(sw.includes("sanctum-clean-v102"),'fresh offline cache required');
for(const path of [root,rootFallback,'icons/sanctum-icon-192-v101.png','icons/sanctum-icon-512-v101.png']){
 assert(sw.includes("'./"+path+"'"),'cache new icon path '+path);
}
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [
  ['iPhone portrait',{width:390,height:844}],
  ['iPhone landscape',{width:844,height:390}],
  ['iPad landscape',{width:1024,height:768}]
 ]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:label.includes('iPhone')});
  const page=await context.newPage();
  try{
   await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
   const info=await page.evaluate(async()=>{
    const root=document.querySelector('link[rel="apple-touch-icon"]');
    const manifestLink=document.querySelector('link[rel="manifest"]');
    const src=root?.getAttribute('href');
    const r=await fetch(src);
    const ctype=r.headers.get('Content-Type')||'';
    const bytes=await r.arrayBuffer();
    return {root:src,
      manifestHref:manifestLink?.getAttribute('href'),
      resolved:new URL(src,location.href).pathname,
      status:r.status,contentType:ctype,byteLength:bytes.byteLength};
   });
   assert.equal(info.root,'./sanctum-iphone-icon-v101.png',label+' cache-fresh Home Screen icon');
   assert(info.resolved.endsWith('/sanctum-iphone-icon-v101.png'));
   assert(info.manifestHref?.includes('clean101'));
   assert.equal(info.status,200,'iOS icon endpoint must load');
   assert(info.byteLength>1000,'Icon must contain PNG data');
   assert(info.contentType.includes('image/png'),'Icon served with PNG MIME: '+info.contentType);
   console.log('PASS '+label+': iOS icon is present, resolves and serves real original PNG.');
  }finally{await context.close();}
 }
}finally{await browser.close();}
