import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const required=[
  'index.html','service-worker.js','manifest.webmanifest',
  'src/styles/base.css','src/styles/roguelite.css','src/styles/mobile.css','src/styles/multiplayer.css',
  'src/js/00-data.js','src/js/10-engine.js','src/js/20-ui-foundation.js','src/js/30-roguelite.js',
  'src/js/40-priest-ui.js','src/js/50-mobile.js','src/js/60-multiplayer.js','src/js/70-multiplayer-patches.js'
];

for(const file of required){
  if(!fs.existsSync(path.join(root,file))) throw new Error('Missing required file: '+file);
}

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(index.includes('parts/game-')) throw new Error('Clean index still references stitched game parts.');
if(index.includes('data:image/')) throw new Error('Clean index still contains embedded image data.');
if(!index.includes('</body>')||!index.includes('</html>')) throw new Error('Index markup is incomplete.');

const ordered=[
 'src/js/00-data.js','src/js/10-engine.js','src/js/20-ui-foundation.js','src/js/30-roguelite.js',
 'src/js/40-priest-ui.js','src/js/50-mobile.js','src/js/60-multiplayer.js','src/js/70-multiplayer-patches.js'
];
let last=-1;
for(const file of ordered){
  const i=index.indexOf('./'+file);
  if(i<0) throw new Error('Index does not reference '+file);
  if(i<=last) throw new Error('Script order is incorrect at '+file);
  last=i;
}

for(const dir of ['src/js','src/styles']){
  for(const name of fs.readdirSync(path.join(root,dir))){
    const file=path.join(root,dir,name);
    if(!fs.statSync(file).isFile()) continue;
    const text=fs.readFileSync(file,'utf8');
    if(/data:image\\/[^;]+;base64,/i.test(text)) throw new Error('Base64 image payload remains in '+path.relative(root,file));
    if(text.includes('parts/game-')) throw new Error('Legacy stitched-part reference remains in '+path.relative(root,file));
  }
}

const sourceFiles=[
  'src/styles/base.css','src/styles/roguelite.css','src/styles/mobile.css','src/styles/multiplayer.css',
  'src/js/00-data.js','src/js/10-engine.js','src/js/20-ui-foundation.js','src/js/30-roguelite.js',
  'src/js/40-priest-ui.js','src/js/50-mobile.js','src/js/60-multiplayer.js','src/js/70-multiplayer-patches.js'
];
for(const source of sourceFiles){
  const text=fs.readFileSync(path.join(root,source),'utf8');
  const refs=[...text.matchAll(/(?:\.\.\/\.\.\/|\.\/)assets\/embedded\/([a-f0-9-]+\.webp)/gi)].map(m=>m[1]);
  for(const ref of refs){
    if(!fs.existsSync(path.join(root,'assets/embedded',ref))) throw new Error('Missing extracted asset '+ref+' referenced by '+source);
  }
}

const embeddedDir=path.join(root,'assets/embedded');
const embedded=fs.existsSync(embeddedDir)?fs.readdirSync(embeddedDir).filter(x=>x.endsWith('.webp')):[];
if(embedded.length!==98) throw new Error('Expected 98 extracted WebP assets, found '+embedded.length);

const multiplayer=fs.readFileSync(path.join(root,'src/js/60-multiplayer.js'),'utf8');
if(!multiplayer.includes('supabase.co')) throw new Error('Supabase multiplayer configuration is missing.');
if(!multiplayer.includes('pushSharedState')) throw new Error('Multiplayer state publishing logic is missing.');
if(!multiplayer.includes('applyRemoteGameRow')) throw new Error('Multiplayer state receive/apply logic is missing.');

const engine=fs.readFileSync(path.join(root,'src/js/10-engine.js'),'utf8');
for(const symbol of ['startGame','moveDemons','defeatDemon','resolveRitual','render']){
  if(!engine.includes('function '+symbol) && !engine.includes(symbol+'=')) throw new Error('Core engine symbol missing: '+symbol);
}

console.log('Clean rebuild validation passed.');
console.log('Extracted WebP assets:',embedded.length);
console.log('JavaScript modules:',fs.readdirSync(path.join(root,'src/js')).filter(x=>x.endsWith('.js')).length);
console.log('Stylesheets:',fs.readdirSync(path.join(root,'src/styles')).filter(x=>x.endsWith('.css')).length);
