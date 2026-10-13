/* Optional WebGL battlefield for the clean multiplayer rebuild.
 * Display-only: S remains the authoritative game state and normal 2D game
 * controls, combat, target selection, saving and Supabase never change here.
 */
(function(){
  'use strict';
  if(window.__sanctum3dInstalled)return;
  window.__sanctum3dInstalled=true;
  const board=document.getElementById('boardSection');
  if(!board)return;
  const parent=board.parentNode;
  const switcher=document.createElement('div');
  switcher.className='sanctum3d-switch';
  switcher.innerHTML='<button type="button" class="btn" id="sanctum3dToggle" aria-pressed="false">Enter 3D Cathedral</button><span class="sanctum3d-beta">3D battlefield preview · original gameplay</span>';
  parent.insertBefore(switcher,board);
  const panel=document.createElement('section');
  panel.id='sanctum3dPanel';
  panel.className='sanctum3d-panel';
  panel.setAttribute('aria-label','Interactive three dimensional Cathedral battlefield');
  panel.hidden=true;
  panel.innerHTML='<div class="sanctum3d-title"><strong>THE DAMNED SANCTUM <small>3D</small></strong><span>Drag to orbit · pinch or scroll to zoom · tap Demons to inspect</span><button type="button" class="btn" id="sanctum3dReset">Reset Camera</button></div>'+
    '<div class="sanctum3d-stage" id="sanctum3dStage"><canvas id="sanctum3dCanvas" aria-label="3D board: Gateway, Hall, Chapel, Crypt and Boss Room"></canvas><div class="sanctum3d-message" id="sanctum3dMessage" role="status">Preparing the 3D Cathedral…</div></div>'+
    '<div class="sanctum3d-rooms" id="sanctum3dRooms"></div>';
  parent.insertBefore(panel,board);
  const button=document.getElementById('sanctum3dToggle');
  const stage=document.getElementById('sanctum3dStage');
  const canvas=document.getElementById('sanctum3dCanvas');
  const message=document.getElementById('sanctum3dMessage');
  const roomsRow=document.getElementById('sanctum3dRooms');
  const roomNames=['Gateway','Hall','Chapel','Crypt','Boss Room'];
  const roomColors=[0x8b3339,0x385da5,0xb39a49,0x81838f,0xbb2739];
  let active=false, initializing=null, three=null, scene=null, camera=null, renderer=null;
  let loader=null, raycaster=null, pointer=null, resizeObserver=null;
  let animationId=0, timer=0, lastDraw=0, lastSize=[0,0], destroyed=false;
  let target=null, distance=56, theta=0, phi=0.95, homeDistance=56;
  let roomParts=[], figures=new Map(), textures=new Map(), hitTargets=[], pointers=new Map();
  let isDragging=false, priorPinch=0;
  const roomX=i=>(i-2)*10.6;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const statusText=t=>{message.textContent=t;message.hidden=!t;};
  const readState=()=>typeof S!=='undefined'&&S?S:null;
  const isMobile=()=>window.matchMedia('(max-width: 760px)').matches;

  roomNames.forEach((name,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='sanctum3d-room-chip';
    b.style.setProperty('--room-accent','#'+roomColors[i].toString(16).padStart(6,'0'));
    b.dataset.room=i;
    b.textContent=name;
    b.title='Focus camera on '+name;
    b.addEventListener('click',()=>{
      if(!active||!three)return;
      target.x=roomX(i);
      distance=clamp(isMobile()?31:29,23,95);
      setCamera();
      updateChipSelection(i);
    });
    roomsRow.appendChild(b);
  });

  function updateChipSelection(selected){
    roomsRow.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('selected',i===selected));
  }
  function setCamera(){
    if(!camera||!target)return;
    const sin=Math.sin(phi);
    camera.position.set(target.x+distance*sin*Math.sin(theta),target.y+distance*Math.cos(phi),target.z+distance*sin*Math.cos(theta));
    camera.lookAt(target);
  }
  function makeMaterial(color,extra){
    return new three.MeshStandardMaterial(Object.assign({color,roughness:0.88,metalness:0.12},extra||{}));
  }
  function block(group,w,h,d,x,y,z,material){
    const mesh=new three.Mesh(new three.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);
    group.add(mesh);
    return mesh;
  }
  function spriteText(value,wide=4.4,small=false){
    const c=document.createElement('canvas');
    c.width=512;c.height=112;
    const ctx=c.getContext('2d');
    ctx.fillStyle='rgba(10,8,13,0.88)';
    ctx.fillRect(2,2,508,108);
    ctx.strokeStyle='#a48a56';ctx.lineWidth=4;ctx.strokeRect(4,4,504,104);
    ctx.fillStyle='#f6ebd1';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=(small?'bold 37px Georgia':'bold 42px Georgia');
    let t=String(value||'');
    if(t.length>28)t=t.slice(0,27)+'…';
    ctx.fillText(t,256,56,468);
    const texture=new three.CanvasTexture(c);
    texture.colorSpace=three.SRGBColorSpace;
    const sprite=new three.Sprite(new three.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
    sprite.scale.set(wide,wide*(112/512),1);
    return sprite;
  }
  function floorRoom(index){
    const group=new three.Group();
    group.position.x=roomX(index);
    scene.add(group);
    const color=roomColors[index];
    const floorMat=makeMaterial(0x221f24,{emissive:color,emissiveIntensity:0.075});
    block(group,10.1,0.55,12.6,0,-0.40,0,floorMat);
    const borderMat=makeMaterial(0x9e8154,{metalness:0.55,roughness:0.38});
    block(group,10.2,0.22,0.20,0,-0.08,-6.23,borderMat);
    block(group,10.2,0.22,0.20,0,-0.08,6.23,borderMat);
    block(group,0.2,0.22,12.6,-5.02,-0.08,0,borderMat);
    block(group,0.2,0.22,12.6,5.02,-0.08,0,borderMat);
    const trackMat=makeMaterial(color,{emissive:color,emissiveIntensity:0.28,transparent:true,opacity:0.72});
    for(let a=-4;a<=4;a+=2){
      block(group,0.035,0.015,11.3,a,0,0,trackMat);
    }
    for(let z=-4;z<=4;z+=2){
      block(group,9.3,0.015,0.035,0,0,z,trackMat);
    }
    const columnMat=makeMaterial(0x46434b,{roughness:0.98});
    const columnAccent=makeMaterial(0x675744,{metalness:0.27});
    for(let x of [-4.5,4.5]){
      for(let z of [-5.5,5.5]){
        block(group,0.85,4.7,0.85,x,2.12,z,columnMat);
        block(group,1.18,0.25,1.18,x,0.2,z,columnAccent);
        block(group,1.22,0.36,1.22,x,4.55,z,columnAccent);
      }
    }
    block(group,10,0.50,0.45,0,4.79,-5.45,columnMat);
    const banner=makeMaterial(color,{emissive:color,emissiveIntensity:0.45});
    block(group,4,0.20,0.27,0,4.3,-5.48,banner);
    const sign=spriteText(roomNames[index].toUpperCase(),7.1);
    sign.position.set(0,5.55,-5.40);
    group.add(sign);
    const lamp=new three.PointLight(color,index===4?15:10,14,2);
    lamp.position.set(0,4,1);
    group.add(lamp);
    const stain=new three.Mesh(new three.CircleGeometry(4,32),new three.MeshBasicMaterial({color,transparent:true,opacity:0.08,depthWrite:false}));
    stain.rotation.x=-Math.PI/2;
    stain.position.y=-0.06;
    group.add(stain);
    const cracks=[];
    for(let n=0;n<5;n++){
      let mesh=block(group,0.045,0.028,2.1,(n-2)*1.72,0.02,((n*3)%6)-3,makeMaterial(0xb52c35,{emissive:0x6a070c,emissiveIntensity:0.7}));
      mesh.rotation.y=(n%2?0.62:-0.46);
      mesh.visible=false;
      cracks.push(mesh);
    }
    roomParts.push({group,floorMat,lamp,cracks,stain});
  }
  function buildSanctum(){
    scene=new three.Scene();
    scene.background=new three.Color(0x09090f);
    scene.fog=new three.FogExp2(0x09090f,0.012);
    scene.add(new three.HemisphereLight(0xb4bcd7,0x170c13,2.3));
    const moon=new three.DirectionalLight(0xb7c4ec,1.8);
    moon.position.set(-16,35,24);scene.add(moon);
    const ground=new three.Mesh(new three.PlaneGeometry(125,95),makeMaterial(0x110e15));
    ground.rotation.x=-Math.PI/2;ground.position.y=-0.8;scene.add(ground);
    for(let i=0;i<5;i++)floorRoom(i);
    const altar=new three.Group();
    altar.position.set(roomX(4),0,-3.4);
    scene.add(altar);
    const obsidian=makeMaterial(0x17131b,{metalness:0.2});
    block(altar,2.9,0.5,2.0,0,0.32,0,obsidian);
    block(altar,1.9,1.15,1.2,0,1.08,0,obsidian);
    block(altar,0.23,2.1,0.24,0,2.15,0,makeMaterial(0xc0a873,{metalness:0.78,roughness:0.22}));
    block(altar,1.5,0.23,0.24,0,2.64,0,makeMaterial(0xc0a873,{metalness:0.78,roughness:0.22}));
    const halo=new three.Mesh(new three.TorusGeometry(1.35,0.12,12,48),new three.MeshBasicMaterial({color:0xd3a56a,transparent:true,opacity:0.65}));
    halo.position.y=2.15;altar.add(halo);
    const fire=new three.PointLight(0xff9d53,15,10);fire.position.y=2;altar.add(fire);
    const altarLabel=spriteText('THE ALTAR',3.4,true);
    altarLabel.position.set(0,4.5,0);altar.add(altarLabel);
  }
  function getTexture(src){
    if(!src||typeof src!=='string')return null;
    if(textures.has(src))return textures.get(src);
    const t=loader.load(src,undefined,undefined,()=>{});
    t.colorSpace=three.SRGBColorSpace;
    t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    textures.set(src,t);
    return t;
  }
  function createFigure(id,isBoss){
    const g=new three.Group();
    scene.add(g);
    const dark=makeMaterial(isBoss?0x450d15:0x26202e,{metalness:0.28});
    const horn=makeMaterial(0xb8a887,{metalness:0.35});
    const eye=makeMaterial(isBoss?0xff183a:0xff9e56,{emissive:isBoss?0xd40c23:0xd07026,emissiveIntensity:2.5});
    const plinth=new three.Mesh(new three.CylinderGeometry(1.35,1.45,0.35,8),makeMaterial(isBoss?0x652331:0x514441,{metalness:0.4}));
    plinth.position.y=0.18;g.add(plinth);
    const torso=new three.Mesh(new three.ConeGeometry(0.63,1.50,7),dark);
    torso.rotation.z=Math.PI;torso.position.set(-0.33,1.20,0);g.add(torso);
    const skull=new three.Mesh(new three.IcosahedronGeometry(0.52,1),dark);
    skull.position.set(-0.33,2.22,0.05);g.add(skull);
    for(let side of [-1,1]){
      const hornMesh=new three.Mesh(new three.ConeGeometry(0.16,0.83,6),horn);
      hornMesh.position.set(-0.33+side*0.36,2.89,0.06);
      hornMesh.rotation.z=side*0.34;g.add(hornMesh);
      const eyeMesh=new three.Mesh(new three.SphereGeometry(0.095,8,8),eye);
      eyeMesh.position.set(-0.33+side*0.20,2.23,0.47);g.add(eyeMesh);
      const claw=new three.Mesh(new three.ConeGeometry(0.21,1.10,5),dark);
      claw.position.set(-0.33+side*0.82,1.38,0);
      claw.rotation.z=side*0.24+Math.PI;g.add(claw);
    }
    const plate=block(g,1.60,1.86,0.14,0.60,1.72,0.57,makeMaterial(0x8d744b,{metalness:0.55}));
    plate.userData={kind:isBoss?'boss':'demon',id};
    hitTargets.push(plate);
    const artPanel=new three.Mesh(new three.PlaneGeometry(1.43,1.62),new three.MeshBasicMaterial({color:0xffffff,side:three.DoubleSide}));
    artPanel.position.set(0.60,1.72,0.66);
    artPanel.userData={kind:isBoss?'boss':'demon',id};
    hitTargets.push(artPanel);
    g.add(artPanel);
    const ring=new three.Mesh(new three.TorusGeometry(1.52,0.055,8,48),new three.MeshBasicMaterial({color:isBoss?0xfe2541:0xae824a,transparent:true,opacity:0.72}));
    ring.rotation.x=Math.PI/2;ring.position.y=0.08;g.add(ring);
    const entry={id,g,ring,artPanel,nameplate:null,key:'',target:new three.Vector3(),isBoss,spawned:performance.now()};
    figures.set(id,entry);
    return entry;
  }
  function refreshFigure(entry,model,name,health,attack,blood,art){
    const key=[name,health,attack,blood,art].join('|');
    if(entry.key===key)return;
    entry.key=key;
    const t=getTexture(art);
    const old=entry.artPanel.material;
    entry.artPanel.material=new three.MeshBasicMaterial({color:t?0xffffff:0x48383c,map:t,side:three.DoubleSide});
    old.dispose();
    if(entry.nameplate){
      entry.g.remove(entry.nameplate);
      entry.nameplate.material.map.dispose();
      entry.nameplate.material.dispose();
    }
    const title=String(name||'Unknown Demon')+'  HP '+health+(entry.isBoss?'':'  ATK '+attack);
    entry.nameplate=spriteText(title,entry.isBoss?5.4:4.5,true);
    entry.nameplate.position.set(0,3.65,0.2);
    entry.g.add(entry.nameplate);
    entry.g.userData={kind:entry.isBoss?'boss':'demon',id:entry.id};
  }
  function disposeFigure(entry){
    scene.remove(entry.g);
    entry.g.traverse(obj=>{
      if(obj.isMesh){obj.geometry.dispose();if(obj.material){if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material.dispose();}}
      if(obj.isSprite){obj.material.map.dispose();obj.material.dispose();}
    });
    const id=entry.id;
    hitTargets=hitTargets.filter(mesh=>mesh.userData.id!==id);
    figures.delete(id);
  }
  function sync(){
    if(!active||!scene)return;
    const state=readState();
    if(!state)return;
    const all=new Set();
    for(let r=0;r<4;r++){
      const demons=Array.isArray(state.rooms?.[r])?state.rooms[r]:[];
      const part=roomParts[r];
      const corrupted=!!state.desecratedRooms?.[r]||(Number(state.corruption?.[r]||0)>=[3,4,5,6][r]);
      part.cracks.forEach(c=>{c.visible=corrupted;});
      const consecrated=!!state.consecrated?.[r];
      part.floorMat.emissiveIntensity=consecrated?0.36:corrupted?0.30:0.075;
      part.lamp.intensity=corrupted?16:consecrated?18:10;
      demons.forEach((d,i)=>{
        const id=String(d.id);
        all.add(id);
        const greater=!!d.greater;
        let f=figures.get(id);
        if(!f)f=createFigure(id,false);
        f.target.set(roomX(r)+([-2.3,2.2,-2.3,2.2][i%4]),0,([-2.5,-2.5,2.2,2.2][i%4]));
        f.g.scale.setScalar(greater?1.08:0.94);
        f.g.userData.room=r;
        const art=typeof demonArt==='function'?demonArt(d):(greater?d.gart:d.art);
        const name=typeof demonName==='function'?demonName(d):(greater?d.g:d.n);
        const atk=typeof demonAttack==='function'?demonAttack(d):(greater?d.gatk:d.atk);
        const blood=typeof demonBlood==='function'?demonBlood(d):(greater?d.gb:d.b);
        refreshFigure(f,d,name,d.cur,atk,blood,art);
      });
      const chip=roomsRow.querySelector('[data-room="'+r+'"]');
      if(chip)chip.textContent=roomNames[r]+' · '+demons.length+(corrupted?' ⚠':'');
    }
    const bossChip=roomsRow.querySelector('[data-room="4"]');
    if(state.bossRevealed&&state.boss){
      const b=state.boss,id='__sanctum_boss';
      all.add(id);
      let f=figures.get(id);
      if(!f)f=createFigure(id,true);
      f.target.set(roomX(4),0,2);
      f.g.scale.setScalar(1.68);
      refreshFigure(f,b,b.n,b.cur,0,b.b,b.art);
      if(bossChip)bossChip.textContent='Boss · HP '+b.cur;
    }else if(bossChip)bossChip.textContent='Boss Room · dormant';
    for(const [id,f] of Array.from(figures)){
      if(!all.has(id))disposeFigure(f);
    }
    const altarGlow=roomParts[4];
    if(altarGlow)altarGlow.floorMat.emissiveIntensity=state.bossRevealed?0.24:0.075;
  }
  function resize(){
    if(!renderer||!camera||!active)return;
    const width=Math.max(1,Math.floor(stage.clientWidth));
    const height=Math.max(1,Math.floor(stage.clientHeight));
    if(width===lastSize[0]&&height===lastSize[1])return;
    lastSize=[width,height];
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  }
  function draw(now){
    if(!active||destroyed)return;
    animationId=requestAnimationFrame(draw);
    if(document.hidden||!scene)return;
    if(now-lastDraw<32)return;
    lastDraw=now;
    resize();
    figures.forEach(f=>{
      f.g.position.lerp(f.target,0.14);
      if(!window.matchMedia('(prefers-reduced-motion:reduce)').matches){
        f.ring.rotation.z=now*0.00038;
        f.g.children.forEach(child=>{
          if(child.isSprite)child.position.y=(f.isBoss?3.65:3.65)+Math.sin(now*0.0019)*0.055;
        });
      }
    });
    renderer.render(scene,camera);
  }
  function beginPointer(e){
    if(!active)return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});
    isDragging=false;
    if(pointers.size===2){
      const p=Array.from(pointers.values());
      priorPinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
    }
  }
  function movePointer(e){
    const p=pointers.get(e.pointerId);
    if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    p.x=e.clientX;p.y=e.clientY;
    if(Math.hypot(p.x-p.startX,p.y-p.startY)>5)isDragging=true;
    if(pointers.size===2){
      const pair=Array.from(pointers.values());
      const pinch=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
      if(priorPinch>0)distance=clamp(distance+(priorPinch-pinch)*0.12,17,100);
      priorPinch=pinch;setCamera();return;
    }
    if(pointers.size===1&&isDragging){
      theta=clamp(theta-dx*0.005,-0.90,0.90);
      phi=clamp(phi-dy*0.004,0.38,1.34);
      setCamera();
    }
  }
  function clickAt(e){
    if(!renderer||!raycaster||!camera)return;
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(hitTargets,false);
    const picked=hits[0]?.object?.userData;
    if(!picked)return;
    if(picked.kind==='boss'){
      if(typeof window.__sanctumOpenBossReader==='function')window.__sanctumOpenBossReader();
      else document.querySelector('#bossArea [data-boss-open]')?.click();
    }else if(picked.kind==='demon'){
      if(typeof window.__sanctumOpenDemonReader==='function')window.__sanctumOpenDemonReader(picked.id);
      else document.querySelector('#boardSection [data-demon-open="'+CSS.escape(picked.id)+'"]')?.click();
    }
  }
  function endPointer(e){
    const p=pointers.get(e.pointerId);
    const wasTap=p&&pointers.size===1&&!isDragging&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<9;
    pointers.delete(e.pointerId);
    if(pointers.size<2)priorPinch=0;
    if(wasTap)clickAt(e);
  }
  async function loadThree(){
    // Loaded only on demand: the ordinary 2D game has zero WebGL overhead.
    return import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  }
  async function init(){
    if(scene)return true;
    if(initializing)return initializing;
    initializing=(async()=>{
      if(!canvas.getContext('webgl2')&&!canvas.getContext('webgl'))throw new Error('WebGL is not available on this device.');
      three=await loadThree();
      renderer=new three.WebGLRenderer({canvas,antialias:!isMobile(),alpha:false,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,isMobile()?1.35:1.7));
      renderer.outputColorSpace=three.SRGBColorSpace;
      renderer.toneMapping=three.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.45;
      camera=new three.PerspectiveCamera(45,1,0.1,230);
      target=new three.Vector3(0,0,0);
      homeDistance=window.innerWidth<540?75:window.innerWidth<950?59:48;
      distance=homeDistance;setCamera();
      loader=new three.TextureLoader();
      raycaster=new three.Raycaster();
      pointer=new three.Vector2();
      buildSanctum();
      canvas.addEventListener('pointerdown',beginPointer);
      canvas.addEventListener('pointermove',movePointer);
      canvas.addEventListener('pointerup',endPointer);
      canvas.addEventListener('pointercancel',endPointer);
      canvas.addEventListener('wheel',e=>{if(!active)return;e.preventDefault();distance=clamp(distance+e.deltaY*0.05,17,100);setCamera();},{passive:false});
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();disable();statusText('Graphics context lost. Switched back to the 2D board.');});
      window.addEventListener('resize',resize,{passive:true});
      if(typeof ResizeObserver!=='undefined'){
        resizeObserver=new ResizeObserver(resize);
        resizeObserver.observe(stage);
      }
      return true;
    })().catch(err=>{initializing=null;throw err;});
    return initializing;
  }
  async function enable(){
    if(active)return;
    button.disabled=true;
    panel.hidden=false;
    statusText('Preparing the 3D Cathedral…');
    try{
      await init();
      active=true;
      document.body.classList.add('sanctum3d-active');
      button.textContent='Return to 2D Board';
      button.setAttribute('aria-pressed','true');
      button.disabled=false;
      statusText('');
      resize();
      sync();
      if(!animationId)animationId=requestAnimationFrame(draw);
      if(timer)clearInterval(timer);
      timer=setInterval(sync,750);
    }catch(err){
      console.error('3D Cathedral failed to initialize',err);
      panel.hidden=true;
      document.body.classList.remove('sanctum3d-active');
      button.disabled=false;
      button.textContent='Enter 3D Cathedral';
      button.setAttribute('aria-pressed','false');
      const msg='3D view could not load ('+(err&&err.message||'network or graphics unavailable')+'). The 2D game remains playable.';
      alert(msg);
    }
  }
  function disable(){
    active=false;
    document.body.classList.remove('sanctum3d-active');
    panel.hidden=true;
    button.textContent='Enter 3D Cathedral';
    button.setAttribute('aria-pressed','false');
    button.disabled=false;
    if(animationId){cancelAnimationFrame(animationId);animationId=0;}
    if(timer){clearInterval(timer);timer=0;}
    lastSize=[0,0];
  }
  button.addEventListener('click',()=>active?disable():enable());
  document.getElementById('sanctum3dReset').addEventListener('click',()=>{
    if(!three||!target)return;
    target.set(0,0,0);theta=0;phi=0.95;
    distance=homeDistance;
    updateChipSelection(-1);setCamera();
  });
  // The original game still renders its hidden 2D DOM so every existing reader,
  // selection prompt, save and multiplayer callback works without translation.
  if(typeof render==='function'){
    const originalRender=render;
    render=function(){
      const result=originalRender.apply(this,arguments);
      if(active)Promise.resolve().then(sync);
      return result;
    };
    try{window.render=render;}catch(_){}
  }
  window.__sanctum3d={
    open:enable,close:disable,sync,
    isActive:()=>active,
    diagnostics:()=>({ready:!!scene,active,figures:figures.size,rooms:roomParts.length})
  };
})();