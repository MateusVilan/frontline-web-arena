import {MAPS, getGrid,SIZE,blocked,lineOfSight,angleDelta,navigateEnemy} from '../shared/maps.js';
import {getInviteCode,makeInviteUrl,isLocalOrigin} from './invite-links.js';
import {buildWorld} from './world.js';
import {createWeapon,createViewArmRig,createEnemy,createTeammate,createArenaFighter,setArenaFighterWeapon,createDistantEnemy,animateEnemy} from './models.js';
import {addRemoteSample,sampleRemote} from './remote-sync.js';
import {simulationDelta} from './timestep.js';
import {movementVector} from './movement.js';
import {traceEnemies} from '../shared/hitboxes.js';
import {applyShotDamage} from './combat.js';
import {weaponPose} from './animation.js';
import {viewmodelPose} from './viewmodel.js';
import {advanceGait} from './locomotion.js';
import {advanceShotCooldown,nextShotCooldown} from './firing.js';
import {clearance2D,weaponWallPose} from './wallclip.js';
import {shotPattern} from './ballistics.js';
import {directionFromYawPitch} from '../shared/hitboxes.js';
import {addLookImpulse,relaxSway,equipDip} from './weapon-motion.js';
import {butterflyMotion} from './butterfly-motion.js';

const el=id=>document.getElementById(id);
const ui={canvas:el('scene'),overlay:el('overlay'),hud:el('hud'),modal:el('modal'),loading:el('loading'),status:el('status'),roomBanner:el('room-banner'),notifications:el('notifications'),pauseTip:el('pause-tip'),crosshair:el('crosshair'),hitmarker:el('hitmarker')};
let T=null;
const urlSources=[
  '/public/vendor/three.module.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.186.1/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js',
  'https://unpkg.com/three@0.186.1/build/three.module.js'
];
for(const url of urlSources){try{T=await import(/* @vite-ignore */url);break;}catch(e){console.warn('Three.js indisponível em',url,e.message);}}
if(!T){ui.loading.innerHTML='<strong>NÃO FOI POSSÍVEL CARREGAR O MOTOR 3D</strong><p>O motor 3D não foi carregado.<br>Fecha o jogo e executa novamente INICIAR_JOGO_WINDOWS.bat para reparar os componentes.</p>';}else{
  try{start(T);ui.loading.remove();}catch(e){console.error(e);ui.loading.innerHTML=`<strong>ERRO AO INICIAR O JOGO</strong><p>${e.message}</p>`;}
}
function start(T){
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const weapons={m4:{label:'M4A1-S',mag:30,reserve:90,damage:34,delay:.095,reload:1.55,auto:true},ak:{label:'AK-47',mag:30,reserve:90,damage:43,delay:.109,reload:1.75,auto:true},pistol:{label:'P250',mag:13,reserve:52,damage:38,delay:.24,reload:1.2,auto:false},mp9:{label:'MP9',mag:30,reserve:120,damage:23,delay:.07,reload:1.42,auto:true},knife:{label:'BUTTERFLY KNIFE',mag:0,reserve:0,damage:80,delay:.43,reload:0,auto:false}};
 const bindsDefault={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',crouch:'ControlLeft',jump:'Space',reload:'KeyR',inspect:'KeyE',shop:'KeyB',m4:'Digit1',pistol:'Digit2',ak:'Digit3',mp9:'Digit4',knife:'Digit5'};
 const bindNames={forward:'Avançar',back:'Recuar',left:'Mover esquerda',right:'Mover direita',crouch:'Agachar',jump:'Saltar',reload:'Recarregar',inspect:'Inspecionar',shop:'Loja',m4:'M4A1-S',pistol:'P250',ak:'AK-47',mp9:'MP9',knife:'Faca'};
 let binds={...bindsDefault};try{binds={...binds,...JSON.parse(localStorage.getItem('frontline_binds')||'{}')}}catch{}
 let sensitivity=Number(localStorage.getItem('frontline_sense')||0.00215);
 let savedFov=Math.max(65,Math.min(95,Number(localStorage.getItem('frontline_fov')||78)||78));
 let viewOffset={x:0,y:0,z:0};
 try{const v=JSON.parse(localStorage.getItem('frontline_view_offset_ref_148b')||'{}');for(const key of ['x','y','z'])if(Number.isFinite(v[key]))viewOffset[key]=Math.min(.25,Math.max(-.25,v[key]));}catch{}
 const validQuality=['leve','equilibrada','alta','ultra'];
 let quality=validQuality.includes(localStorage.getItem('frontline_quality'))?localStorage.getItem('frontline_quality'):'equilibrada';
 let masterVolume=clamp(Number(localStorage.getItem('frontline_master_volume')||0.85),0,1);
 let sfxVolume=clamp(Number(localStorage.getItem('frontline_sfx_volume')||0.9),0,1);
 let footstepVolume=clamp(Number(localStorage.getItem('frontline_footstep_volume')??0.38),0,1);
 const crosshairPalette={lime:'#bdff67',white:'#f4f8fa',cyan:'#70e8f4',gold:'#ffd186'};
 let reticleColor=localStorage.getItem('frontline_reticle_color')||'lime';
 if(!crosshairPalette[reticleColor])reticleColor='lime';
 let hudScale=clamp(Number(localStorage.getItem('frontline_hud_scale')||100)||100,80,120);
 let radarMode=localStorage.getItem('frontline_radar_mode')||'normal';
 if(!['normal','compacto','oculto'].includes(radarMode))radarMode='normal';
 const applyHUDPrefs=()=>{
   document.documentElement.style.setProperty('--reticle-color',crosshairPalette[reticleColor]);
   document.documentElement.style.setProperty('--hud-scale',String(hudScale/100));
   document.documentElement.style.setProperty('--radar-scale',String((hudScale/100)*(radarMode==='compacto'?.72:1)));
   document.documentElement.dataset.radarMode=radarMode;
 };
 applyHUDPrefs();
 // One-time migration: older builds had overly loud footstep settings.
 if(localStorage.getItem('frontline_step_mix_v151')!=='1'){
   footstepVolume=Math.min(footstepVolume,.42);
   localStorage.setItem('frontline_footstep_volume',String(footstepVolume));
   localStorage.setItem('frontline_step_mix_v151','1');
 }
 let adaptiveScale=1;const benchmark={active:false,start:0,duration:20,samples:[],frameMs:[]};
 let netLastArrival=0,netIntervalSamples=[],netPingSamples=[],netSeqDrops=0,lastStateSeq=-1,shieldUntil=0,scoreUpdateAt=0,lastTeamScore='',lastTeamCount='',myTeam='blue',mySlot=0,selectedMap='industrial',mapId=selectedMap,scene=new T.Scene(),camera=new T.PerspectiveCamera(savedFov,1,.045,120),renderer=null,world=null,mode='solo',status='menu',socket=null,roomCode='',myId='',host=false,reconnectToken='',reconnectTimer=null,reconnectDeadline=0,reconnectAttempts=0;
 let roomLobby=null;let scorePlayers=[];let scoreVisible=false;let scoreKeyDown=false;let lastRenderScore='';
 let shotSeq=0;const pendingShots=[];let lastShotAck=0;
 // Local prediction keeps weapons responsive while per-shot server replies
 // repair rare rejects without losing newer shots still in flight.
 function resetShotPrediction(){pendingShots.length=0;lastShotAck=shotSeq;}
 function predictedAmmo(weapon,authoritative){
  const pending=pendingShots.filter(s=>s.weapon===weapon).length;
  return Math.max(0,Math.min(weapons[weapon].mag,authoritative-pending));
 }

 let localEnemies=[],otherPlayers=new Map(),enemyObjs=new Map(),marks=[],shotTimer=0,elapsed=0,lastFrame=performance.now(),netTimer=0,footTimer=0,wave=1,kills=0,money=800,armor=0,health=100,messageTimeout=0,audio=null,noiseBuffer=null,heldMouse=false,pendingMouseShot=false,crosshairKick=0,hitmarkerTimer=0,damageAlpha=0,pingClock=0,netBufferMs=96,masterGain=null,sfxGain=null,footGain=null,stepVariant=0,enemyStepVariant=0,lastEnemyStepTime=-100;let impactFx=[];
 let radarBackdrop=null;const canvas=ui.canvas;const keys=new Set();const walkAudio={step:0};const crosshairBars=[...ui.crosshair.querySelectorAll(':scope > b')];
 let gait={phase:0,motion:0,sprint:0,frequency:8.2};let lastCrosshairGap=-1;
 let viewSway={x:0,y:0},equipTimer=0;
 const player={x:3.5,z:3.5,yaw:0,pitch:0,height:1.65,jump:0,vy:0,crouch:0,swing:0,moving:false,weapon:'m4',ammo:{},reserve:{},reloading:0,reloadDuration:0,inspect:0,inspectDuration:2.25,recoil:0,shots:0,lastShot:-100,knifeDraw:0};
 for(const [id,w] of Object.entries(weapons)){player.ammo[id]=w.mag;player.reserve[id]=id==='knife'?0:Infinity;}
 try{renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});}catch(e){throw Error('O navegador não disponibilizou WebGL. Ativa a aceleração de hardware no Opera/Chrome. '+e.message);}
 renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 function applyGraphicsQuality(){
   // Presets are explicit; NEVER silently lower the quality chosen by the user.
   // Ultra retains the original dynamic sun shadows and full device-resolution.
   // Alta trades only expensive real-time shadows and 8% internal resolution
   // for a large performance gain while preserving map textures and model detail.
   const dpr=devicePixelRatio||1;
   const ratios={leve:0.62,equilibrada:0.78,alta:0.92,ultra:Math.min(dpr,1.15)};
   const ratio=(ratios[quality]||.92)*adaptiveScale;
   renderer.setPixelRatio(Math.max(.45,ratio));
   renderer.shadowMap.enabled=quality==='ultra';
   renderer.shadowMap.needsUpdate=true;
   renderer.setSize(innerWidth,innerHeight,false);
 }
 applyGraphicsQuality();
 camera.rotation.order='YXZ';
 // The old camera-mounted point light affected every wall fragment at every frame.
 // Make only the held weapon a little brighter via its materials instead.
 scene.add(camera);
 const raycaster=new T.Raycaster();const tmpV=new T.Vector3(),up=new T.Vector3(0,0,1);
 let decals=[];let gunViews=new Map();const enemyMeshes=new Map();const tracers=[];const dyingEnemies=[];const casings=[];
 function buildMap(id){lastStateSeq=-1;netLastArrival=0;netIntervalSamples.length=0;netPingSamples.length=0;netSeqDrops=0;radarBackdrop=null;if(world)world.dispose();for(const bot of enemyMeshes.values()){if(bot.userData.lowDetail)disposeEnemyObject(bot.userData.lowDetail);disposeEnemyObject(bot);}for(const remote of otherPlayers.values())disposeEnemyObject(remote.obj);for(const c of dyingEnemies)disposeEnemyObject(c.mesh);scene=new T.Scene();scene.add(camera);mapId=id;world=buildWorld(T,scene,id);for(const k of [...enemyMeshes.keys()])enemyMeshes.delete(k);otherPlayers.clear();marks.forEach(d=>d.parent?.remove(d));marks=[];for(const t of tracers){scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();}tracers.length=0;for(const corpse of dyingEnemies)scene.remove(corpse.mesh);dyingEnemies.length=0;for(const c of casings){scene.remove(c.mesh);c.mesh.geometry.dispose();c.mesh.material.dispose();}casings.length=0;for(const fx of impactFx){scene.remove(fx.obj);fx.obj.geometry?.dispose?.();fx.obj.material?.dispose?.();}impactFx.length=0;}
 const muzzleTex=(()=>{
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const grad=g.createRadialGradient(64,64,2,64,64,52);
  grad.addColorStop(0,'rgba(255,255,248,1)');grad.addColorStop(.16,'rgba(255,238,177,.9)');
  grad.addColorStop(.48,'rgba(255,175,68,.48)');grad.addColorStop(1,'rgba(255,113,28,0)');
  g.fillStyle=grad;g.fillRect(0,0,128,128);
  for(let i=0;i<8;i++){
    g.save();g.translate(64,64);g.rotate(Math.PI*i/4);
    g.beginPath();g.moveTo(-4,0);g.lineTo(0,-(i%2?42:55));g.lineTo(4,0);g.closePath();
    g.fillStyle=i%2?'rgba(255,235,163,.55)':'rgba(255,252,226,.68)';g.fill();g.restore();
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
 })();
 function attachMuzzleFlash(view,id){const flashMat=new T.SpriteMaterial({map:muzzleTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending});const flash=new T.Sprite(flashMat);flash.visible=false;flash.scale.set(id==='pistol'?.22:id==='knife'?.18:.34,id==='pistol'?.22:id==='knife'?.18:.34,1);const p=view.muzzleLocal||new T.Vector3(0,0,-1);flash.position.copy(p);view.root.add(flash);const flare=new T.PointLight(id==='pistol'?0xffd38c:0xffc875,id==='pistol'?1.0:1.25,id==='pistol'?2.0:2.5,2);flare.visible=false;flare.position.copy(p).add(new T.Vector3(0,0,.06));view.root.add(flare);view.flash=flash;view.flashLight=flare;view.flashTimer=0;}
 function spawnTracer(from,to,color=0xf1d9a0){const geo=new T.BufferGeometry().setFromPoints([from.clone(),to.clone()]);const mat=new T.LineBasicMaterial({color,transparent:true,opacity:.58});const line=new T.Line(geo,mat);scene.add(line);tracers.push({line,time:.045});if(tracers.length>24){const old=tracers.shift();scene.remove(old.line);old.line.geometry.dispose();old.line.material.dispose();}}
 function triggerViewFlash(id){if(id==='knife')return;const gun=gunViews.get(id);if(!gun?.flash)return;gun.flash.visible=true;if(gun.flashLight)gun.flashLight.visible=true;gun.flashTimer=.055;const s=id==='pistol'?.21:id==='mp9'?.26:.33;gun.flash.scale.setScalar(s+.10*Math.random());gun.flash.material.rotation=Math.random()*Math.PI*2;gun.flash.material.opacity=id==='pistol'?.88:.96;}
 const casingMat=new T.MeshStandardMaterial({color:0xc2a46b,metalness:.65,roughness:.30});
 function spawnCasing(){
  if(player.weapon==='knife')return;
  const view=gunViews.get(player.weapon);
  if(!view)return;
  // Cápsula nasce perto da janela de ejeção da arma, não a meio do ecrã.
  const ejectLocal=player.weapon==='pistol'?new T.Vector3(.105,.11,-.30):
   player.weapon==='mp9'?new T.Vector3(.135,.10,-.27):new T.Vector3(.17,.08,-.20);
  camera.updateMatrixWorld(true);
  const worldPos=view.root.localToWorld(ejectLocal);
  const dir=new T.Vector3(.65,.70,.17).applyQuaternion(camera.quaternion).normalize();
  const mesh=new T.Mesh(new T.CylinderGeometry(.008,.008,.037,7),casingMat);
  mesh.rotation.z=Math.PI/2;mesh.position.copy(worldPos);scene.add(mesh);
  casings.push({mesh,velocity:dir.multiplyScalar(1.15+Math.random()*.5),life:1.25});
  if(casings.length>12){const old=casings.shift();scene.remove(old.mesh);old.mesh.geometry.dispose();}
 }
 function tickCasings(dt){for(let i=casings.length-1;i>=0;i--){const c=casings[i];c.life-=dt;c.velocity.y-=8*dt;c.mesh.position.addScaledVector(c.velocity,dt);c.mesh.rotation.x+=dt*13;c.mesh.rotation.z+=dt*18;
   if(c.life<=0||c.mesh.position.y<-.015){scene.remove(c.mesh);c.mesh.geometry.dispose();casings.splice(i,1);}}}
 function pulseCrosshair(amount=.35){crosshairKick=Math.min(1,Math.max(crosshairKick,amount));}
 function updateCrosshair(dt){crosshairKick=Math.max(0,crosshairKick-dt*4.2);const gap=Math.round(5+gait.motion*1.5+gait.sprint*1.4+crosshairKick*8);if(crosshairBars[0]&&gap!==lastCrosshairGap){lastCrosshairGap=gap;crosshairBars[0].style.transform=`translate(-50%,calc(-50% - ${gap}px))`;crosshairBars[1].style.transform=`translate(-50%,calc(-50% + ${gap}px))`;crosshairBars[2].style.transform=`translate(calc(-50% - ${gap}px),-50%)`;crosshairBars[3].style.transform=`translate(calc(-50% + ${gap}px),-50%)`;}if(hitmarkerTimer>0){hitmarkerTimer=Math.max(0,hitmarkerTimer-dt);ui.hitmarker.classList.add('show');if(hitmarkerTimer===0){ui.hitmarker.classList.remove('show');ui.hitmarker.classList.remove('head');}}}
 function showHitmarker(head=false){hitmarkerTimer=head?.15:.10;ui.hitmarker.classList.toggle('head',!!head);ui.hitmarker.classList.add('show');}
 function spawnImpact(point,normal,color=0xffd79a,size=.20){const pts=[];for(let i=0;i<6;i++){const dir=new T.Vector3((Math.random()-.5),(Math.random()-.5),(Math.random()-.5)).normalize();const tangent=dir.sub(normal.clone().multiplyScalar(dir.dot(normal))).normalize().multiplyScalar(size*(.35+Math.random()*.55));pts.push(point.clone().addScaledVector(normal,.015),point.clone().add(tangent).addScaledVector(normal,.015));}const geo=new T.BufferGeometry().setFromPoints(pts);const mat=new T.LineBasicMaterial({color,transparent:true,opacity:.95});const lines=new T.LineSegments(geo,mat);scene.add(lines);impactFx.push({obj:lines,life:.09,max:.09});
 const particles=[];
 for(let i=0;i<6;i++){const u=new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();u.addScaledVector(normal,.85).normalize().multiplyScalar(.045+.13*Math.random());particles.push(point.x+u.x,point.y+u.y,point.z+u.z);}
 const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.Float32BufferAttribute(particles,3));
 const dustMat=new T.PointsMaterial({color,size:.032,opacity:.66,transparent:true,depthWrite:false});
 const dust=new T.Points(dustGeo,dustMat);scene.add(dust);impactFx.push({obj:dust,life:.18,max:.18});
 while(impactFx.length>12){const old=impactFx.shift();scene.remove(old.obj);old.obj.geometry.dispose();old.obj.material.dispose();}}
 function getGun(id){
  if(!gunViews.has(id)){
   const w=createWeapon(T,id,{viewArms:true,compactArms:true});
   const armRig=createViewArmRig(T,id);
   w.armRig=armRig;
   // Small material-level fill only on first-person arms/weapon, no scene point light.
   const bright=new Set();for(const root of [w.root,armRig.root])root.traverse?.(mesh=>{
     const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
     for(const m of mats){if(!m||bright.has(m)||!m.isMeshStandardMaterial)continue;bright.add(m);
       if(m.emissive){m.emissive.setHex(0x121719);m.emissiveIntensity=.34;}
     }
   });
   attachMuzzleFlash(w,id);
   gunViews.set(id,w);
   camera.add(w.root);
   camera.add(armRig.root);
   armRig.root.visible=false;
  }
  return gunViews.get(id);
 }
 function getWeaponWallAvoid(id=player.weapon){
  // Plan-view sweep covers the whole width/length of the held weapon, not only the crosshair.
  // In the last builds, the model could be further forward than the old ray distance.
  const direction=new T.Vector3();camera.getWorldDirection(direction);
  const length=Math.hypot(direction.x,direction.z);
  if(length<.1)return {avoid:0,hide:false,clearance:3};
  const dist=clearance2D(world.grid,player.x,player.z,direction.x/length,direction.z/length);
  return weaponWallPose(dist,id);
 }
 function resetPlayer(id=mapId,slot=0){resetShotPrediction();const sp=MAPS[id].spawn[slot];player.x=sp[0];player.z=sp[1];player.yaw=Math.PI;player.pitch=0;player.jump=0;player.vy=0;player.crouch=0;player.weapon='m4';player.ammo={};player.reserve={};for(const [name,w] of Object.entries(weapons)){player.ammo[name]=w.mag;player.reserve[name]=name==='knife'?0:Infinity;}player.reloading=0;player.inspect=0;player.swing=0;player.shots=0;player.lastShot=-100;player.recoil=0;player.knifeDraw=0;gait={phase:0,motion:0,sprint:0,frequency:8.2};viewSway={x:0,y:0};equipTimer=0;health=100;armor=0;money=800;kills=0;wave=1;}
 function spawnSolo(){const enemyLoadout=['m4','ak','mp9','m4'];localEnemies=MAPS[mapId].enemies.slice(0,4).map((p,i)=>({id:i+1,x:p[0],z:p[1],yaw:Math.PI,health:100,alive:true,alert:0,fire:1.6+i*.25,walk:false,weapon:enemyLoadout[i%enemyLoadout.length]}));}
 function eventMessage(msg){ui.notifications.textContent=msg;clearTimeout(messageTimeout);messageTimeout=setTimeout(()=>ui.notifications.textContent='',2100);}
 function benchmarkSummary(){if(!benchmark.samples.length)return null;
  const min=Math.min(...benchmark.samples),max=Math.max(...benchmark.samples),avg=benchmark.samples.reduce((a,b)=>a+b,0)/benchmark.samples.length;
  // Slowest 1% of measured frames: useful for the stutters that average FPS hides.
  const ordered=benchmark.frameMs.slice().sort((a,b)=>b-a);
  const worst=ordered.slice(0,Math.max(1,Math.ceil(ordered.length*.01)));
  const lowOne=worst.length?1000/(worst.reduce((a,b)=>a+b,0)/worst.length):0;
  return{min:Math.round(min),avg:Math.round(avg),max:Math.round(max),lowOne:Math.round(lowOne),seconds:Math.max(1,Math.round((performance.now()-benchmark.start)/1000))};} 
 function networkMetrics(){
  if(mode!=='multi')return '';
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const mean=avg(netIntervalSamples);
  const jitter=netIntervalSamples.length>1?avg(netIntervalSamples.map(x=>Math.abs(x-mean))):0;
  return ['Jogadores remotos: '+otherPlayers.size,'Ping médio: '+Math.round(avg(netPingSamples))+' ms','Intervalo snapshots: '+Math.round(mean)+' ms','Variação de rede: '+Math.round(jitter)+' ms','Snapshots perdidos: '+netSeqDrops].join('\n');
 }
 function benchmarkReport(summary){const ratio=renderer.getPixelRatio?renderer.getPixelRatio():1;return ['FRONTLINE.WEB V1.5.6','Mapa: '+MAPS[mapId].name,'Modo: '+(mode==='solo'?'solo':'multiplayer'),'Qualidade: '+quality,'Escala interna: '+ratio.toFixed(2),'Janela: '+innerWidth+'x'+innerHeight,'FPS min/médio/máx: '+summary.min+'/'+summary.avg+'/'+summary.max,'1% low (quebras): '+summary.lowOne+' FPS','Draw calls: '+(renderer.info?.render?.calls||0),'Triângulos desenhados: '+(renderer.info?.render?.triangles||0),'Resolução real: '+renderer.domElement.width+'x'+renderer.domElement.height,'Navegador: '+navigator.userAgent,networkMetrics()].filter(Boolean).join('\n');}
 function finishBenchmark(){benchmark.active=false;const summary=benchmarkSummary();if(!summary){eventMessage('SEM DADOS DE FPS');return;}const report=benchmarkReport(summary);openModal('TESTE DE FPS',`<p>Perfeito. Envia-me uma captura deste resultado, ou copia e cola o texto abaixo.</p><pre style="white-space:pre-wrap;background:#07151b;border:1px solid #43656b;border-radius:8px;padding:12px;color:#d7e5e7;font-size:12px">${report}</pre><p><button id="copy-benchmark">COPIAR RESULTADO</button></p>`);const btn=el('copy-benchmark');if(btn)btn.onclick=()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(report).then(()=>eventMessage('RESULTADO COPIADO')).catch(()=>window.prompt('Copia o resultado:',report));else window.prompt('Copia o resultado:',report);};}
 function startBenchmark(seconds=20){benchmark.active=true;benchmark.start=performance.now();benchmark.duration=seconds;benchmark.samples.length=0;benchmark.frameMs.length=0;closeModal();eventMessage('TESTE FPS '+seconds+'s · fica parado e roda a câmara devagar');}
 function addKillFeed(text){
  const feed=el('killfeed');if(!feed)return;
  const item=document.createElement('div');item.className='killfeed-line';
  const words=document.createElement('span');words.className='killfeed-label';words.textContent=text;
  if(/HEADSHOT/i.test(text)){item.classList.add('headshot');}
  if(/^TU\b/.test(text)){item.classList.add('my-kill');}
  const glyph=document.createElement('span');glyph.className='killfeed-glyph';glyph.textContent='✕';
  item.append(glyph,words);feed.prepend(item);
  while(feed.children.length>4)feed.lastChild.remove();
  setTimeout(()=>item.remove(),4500);
 }
 function flashDamage(amount=1){damageAlpha=Math.max(damageAlpha,Math.min(1,amount));}

 function textStatus(s){ui.status.textContent=s;}
 const roomModeSelect=el('room-mode-select'),roomMapSelect=el('room-map-select');
 function refreshRoomMaps(){
   const coop=roomModeSelect.value==='coop',items=coop?[['industrial','BLOCO INDUSTRIAL'],['harbor','PORTO NOTURNO']]:[['rust','ARENA FERRUGEM'],['azure','TERMINAL AZUL']];
   const current=roomMapSelect.value;roomMapSelect.replaceChildren();
   for(const [id,name] of items){const opt=document.createElement('option');opt.value=id;opt.textContent=name;roomMapSelect.add(opt);}
   roomMapSelect.value=items.some(i=>i[0]===current)?current:items[0][0];
 }
 roomModeSelect.addEventListener('change',refreshRoomMaps);refreshRoomMaps();
 const lobbyMode=el('lobby-mode'),lobbyMap=el('lobby-map');
 let updatingLobbyControls=false;
 const roomModeCaps={'1v1':{size:2,blue:1,orange:1},'2v1':{size:3,blue:2,orange:1},'2v2':{size:4,blue:2,orange:2}};
 function openLobby(){mode='multi';status='lobby';el('room-lobby').classList.remove('hidden');ui.overlay.classList.add('hidden');el('pause-menu').classList.add('hidden');ui.hud.classList.add('hidden');ui.pauseTip.classList.add('hidden');setInviteVisible(false);if(document.pointerLockElement===canvas)document.exitPointerLock?.();}
 function drawLobby(data){
   if(!data||!roomCode||data.code!==roomCode)return;
   roomLobby=data;
   if(data.started){el('room-lobby').classList.add('hidden');return;}
   el('lobby-code').textContent=roomCode;
   const info=roomModeCaps[data.mode]||roomModeCaps['1v1'];
   el('lobby-summary').textContent=`${data.mode.toUpperCase()} · ${MAPS[data.map]?.name||data.map} · ${data.players.length}/${info.size}`;
   el('lobby-host-config').classList.toggle('hidden',!host);
   el('lobby-start').classList.toggle('hidden',!host);
   updatingLobbyControls=true;lobbyMode.value=data.mode;lobbyMap.value=data.map;updatingLobbyControls=false;
   const counts={blue:data.players.filter(p=>p.team==='blue').length,orange:data.players.filter(p=>p.team==='orange').length};
   const allOnline=data.players.every(p=>p.online);
   const ready=data.players.length===info.size&&counts.blue===info.blue&&counts.orange===info.orange&&allOnline;
   el('lobby-start').disabled=!ready;
   el('lobby-message').textContent=ready?'EQUIPAS PRONTAS · O ANFITRIÃO PODE COMEÇAR':`À espera: ${counts.blue}/${info.blue} AZUL · ${counts.orange}/${info.orange} LARANJA · ${data.players.length}/${info.size} JOGADORES`;
   const list=el('lobby-players');list.replaceChildren();
   for(const playerInfo of data.players){
     const row=document.createElement('div');row.className='lobbyPlayerRow '+playerInfo.team;
     const name=document.createElement('span');name.className='lobbyPlayerName';name.textContent=(playerInfo.id===myId?'TU · ':'')+playerInfo.name+(playerInfo.host?' ★':'')+(playerInfo.online?'':' · OFFLINE');
     const select=document.createElement('select');select.setAttribute('aria-label','Equipa de '+playerInfo.name);select.disabled=!host;for(const team of ['blue','orange']){const opt=document.createElement('option');opt.value=team;opt.textContent=team==='blue'?'AZUL':'LARANJA';select.add(opt);}select.value=playerInfo.team;
     select.onchange=()=>send({type:'LOBBY_TEAM',id:playerInfo.id,team:select.value});
     row.append(name,select);list.append(row);
   }
 }
 function sendLobbyConfig(){if(!updatingLobbyControls&&host&&roomLobby&&!roomLobby.started)send({type:'LOBBY_CONFIG',mode:lobbyMode.value,map:lobbyMap.value});}
 lobbyMode.onchange=sendLobbyConfig;lobbyMap.onchange=sendLobbyConfig;
 el('lobby-start').onclick=()=>send({type:'LOBBY_START'});
 el('lobby-copy').onclick=()=>copyRoomInvite();
 el('lobby-leave').onclick=()=>leaveToMenu();

 function hideScore(){scoreKeyDown=false;scoreVisible=false;el('scoreboard').classList.add('hidden');}
 function updateScoreboard(force=false){
   if(!force&&!scoreVisible)return;
   const pvp=mode==='multi' && !!MAPS[mapId]?.pvp;
   const title=MAPS[mapId]?.name||'ARENA';
   const sorted=scorePlayers.slice().sort((a,b)=>(b.kills||0)-(a.kills||0));
   const key=JSON.stringify([title,pvp,wave,kills,myId,sorted.map(p=>[p.id,p.name,p.team,p.hp,p.kills,p.deaths,p.weapon,p.online])]);
   if(!force&&key===lastRenderScore)return;
   lastRenderScore=key;
   el('score-map-name').textContent=title;
   el('score-solo').classList.toggle('hidden',pvp);
   el('score-summary').textContent=pvp?'PARTIDA MULTIPLAYER  ·  '+roomCode:'MODO SOLO  ·  '+title;
   const buildRows=(team)=>{
     const players=sorted.filter(p=>p.team===team);
     const host=el(team==='blue'?'score-blue-list':'score-orange-list');
     host.replaceChildren();
     if(!players.length){const none=document.createElement('div');none.className='scoreNone';none.textContent='À espera de jogadores';host.append(none);}
     for(const p of players){
       const r=document.createElement('div');r.className='scoreRow'+(p.id===myId?' me':'');
       const name=document.createElement('span');name.className='scoreName';name.textContent=(p.id===myId?'TU · ':'')+String(p.name||p.id||'JOGADOR').slice(0,16)+(p.online===false?' · OFFLINE':'');
       const weapon=document.createElement('span');weapon.className='scoreWeapon';weapon.textContent=weapons[p.weapon]?.label||'ARMA';
       const hp=document.createElement('span');hp.className='scoreHp';hp.textContent=Math.max(0,Math.round(p.hp||0))+' HP';
       const frags=document.createElement('strong');frags.className='scoreKills';frags.textContent=`${p.kills||0} / ${p.deaths||0}`;frags.title='Eliminações / Mortes';
       r.append(name,weapon,hp,frags);host.append(r);
     }
     el(team==='blue'?'score-blue-total':'score-orange-total').textContent=players.reduce((n,p)=>n+(p.kills||0),0);
   };
   buildRows('blue');buildRows('orange');
   el('scoreboard').classList.toggle('soloScore',!pvp);
   if(!pvp){el('score-solo').textContent=`ONDA ${wave}     ·     ABATES ${kills}     ·     VIDA ${Math.max(0,Math.ceil(health))}     ·     $${money}`;}
 }
 function showScore(){if(status==='menu')return;scoreVisible=true;el('scoreboard').classList.remove('hidden');updateScoreboard(true);}
 function updatePauseHostTools(){
   const visible=mode==='multi'&&host;
   el('pause-host-tools').classList.toggle('hidden',!visible);
   if(visible)el('pause-map-choice').value=mapId;
 }
 function pauseGame(){
   if(status!=='playing')return;
   status='paused';heldMouse=false;pendingMouseShot=false;resetKeys();
   ui.overlay.classList.add('hidden');ui.pauseTip.classList.add('hidden');
   hideScore();
   el('pause-mode').textContent=mode==='solo'?'MODO SOLO':(MAPS[mapId]?.pvp?'PVP ONLINE':'COOPERATIVO');
   el('pause-map').textContent=MAPS[mapId]?.name||'MAPA';
   el('pause-room').textContent=roomCode||'SEM SALA';
   updatePauseHostTools();
   el('pause-menu').classList.remove('hidden');
   if(document.pointerLockElement===canvas)document.exitPointerLock?.();
 }
 function leaveToMenu(){
   status='menu';resetKeys();pendingMouseShot=false;
   el('pause-menu').classList.add('hidden');el('room-lobby').classList.add('hidden');roomLobby=null;hideScore();
   ui.hud.classList.add('hidden');ui.overlay.classList.remove('hidden');ui.pauseTip.classList.add('hidden');
   if(document.pointerLockElement===canvas)document.exitPointerLock?.();
   disconnect();setInviteVisible(false);mode='solo';scorePlayers=[];roomCode='';lastRenderScore='';
   el('solo').innerHTML='JOGAR A SOLO <span>↗</span>';
   textStatus('Pronto para jogar a solo ou criar uma sala multiplayer.');
 }
 el('pause-resume').onclick=()=>resume();
 el('pause-settings').onclick=()=>showSettings();
 el('pause-score').onclick=()=>showScore();
 el('pause-map-apply').onclick=()=>{
   if(mode!=='multi'||!host||socket?.readyState!==WebSocket.OPEN)return;
   const nextMap=el('pause-map-choice').value;
   if(!MAPS[nextMap])return;
   // Host-only action. The server validates capacity and sends the reset to all clients.
   send({type:'MAP',map:nextMap});
   el('pause-room').textContent='A PREPARAR O MAPA…';
 };
 el('pause-menu-exit').onclick=()=>leaveToMenu();
 el('score-close').onclick=()=>hideScore();
 function startPlay(kind,{autoLock=true}={}){el('room-lobby').classList.add('hidden');initAudio();preloadGunSounds();mode=kind;pingClock=0;netBufferMs=96;el('net-meter').textContent=kind==='solo'?'LOCAL':'PING --';status='playing';el('pause-menu').classList.add('hidden');hideScore();el('solo').innerHTML='CONTINUAR PARTIDA <span>→</span>';ui.overlay.classList.add('hidden');ui.hud.classList.remove('hidden');ui.pauseTip.classList.remove('hidden');setTimeout(()=>ui.pauseTip.classList.add('hidden'),2600);resetKeys();setInviteVisible(kind==='multi'&&!!roomCode);el('room-indicator').textContent=kind==='solo'?'SOLO':roomCode;el('room-indicator').title=kind==='solo'?'Modo a solo':'Clica para copiar o código da sala';updateHUD();if(autoLock&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();}
 function newSolo(){if(MAPS[selectedMap]?.pvp){selectedMap='industrial';updateMapSelection();}disconnect();scorePlayers=[];lastRenderScore='';buildMap(selectedMap);resetPlayer();spawnSolo();startPlay('solo');}
 function resume(){if(status!=='paused')return;if(mode==='multi'&&socket?.readyState!==WebSocket.OPEN){textStatus('Sem ligação ao servidor. Sai para o menu e volta a entrar na sala.');el('pause-room').textContent='SEM LIGAÇÃO';return;}status='playing';el('pause-menu').classList.add('hidden');hideScore();ui.overlay.classList.add('hidden');ui.pauseTip.classList.add('hidden');canvas.requestPointerLock?.();}
 const nickInput=el('player-nick');
 const savedNick=localStorage.getItem('frontline_player_nick');
 if(savedNick)nickInput.value=savedNick;
 function playerNickname(){
   const name=nickInput.value.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,16)||'JOGADOR';
   nickInput.value=name;
   localStorage.setItem('frontline_player_nick',name);
   return name;
 }
 nickInput.addEventListener('change',playerNickname);
 const STORED_SESSION_KEY='frontline_active_room_v1';
 let lastStoredSessionWrite=0;
 function readStoredSession(){
  try{const data=JSON.parse(sessionStorage.getItem(STORED_SESSION_KEY)||'null');
   return data&&/^[A-Z2-9]{6}$/.test(data.code)&&/^[0-9a-f]{48}$/.test(data.token)&&Number.isFinite(data.until)&&data.until>Date.now()?data:null;
  }catch{return null;}
 }
 function saveStoredSession(force=false){
  if(!roomCode||!reconnectToken||(!force&&Date.now()-lastStoredSessionWrite<2000))return;
  lastStoredSessionWrite=Date.now();
  try{sessionStorage.setItem(STORED_SESSION_KEY,JSON.stringify({code:roomCode,token:reconnectToken,until:Date.now()+24000}));}catch{}
 }
 function clearStoredSession(){try{sessionStorage.removeItem(STORED_SESSION_KEY);}catch{}el('recover-banner').classList.add('hidden');}
 function offerStoredSession(){const saved=readStoredSession();
  if(saved){el('recover-banner').classList.remove('hidden');return;}
  clearStoredSession();
 }
 el('recover-session').onclick=()=>{
  const stored=readStoredSession();if(!stored)return offerStoredSession();
  roomCode=stored.code;reconnectToken=stored.token;
  mode='multi';status='paused';reconnectDeadline=Date.now()+11000;
  el('recover-banner').classList.add('hidden');
  textStatus('A recuperar a sala '+roomCode+'…');openSocket('RESUME');
 };
 offerStoredSession();
 function cancelReconnect(){
  if(reconnectTimer!==null){clearTimeout(reconnectTimer);reconnectTimer=null;}
  reconnectDeadline=0;reconnectAttempts=0;
  el('reconnect-indicator').classList.add('hidden');
 }
 function scheduleReconnect(){
  if(reconnectTimer!==null||!reconnectToken||!roomCode||mode!=='multi'||status==='menu')return;
  if(Date.now()>=reconnectDeadline){
   el('reconnect-indicator').textContent='Não foi possível recuperar a ligação. Sai para o menu e volta a entrar com o convite.';
   el('reconnect-indicator').classList.remove('hidden');
   el('pause-room').textContent='LIGAÇÃO PERDIDA';
   reconnectDeadline=0;reconnectToken='';clearStoredSession();return;
  }
  const delay=Math.min(2400,400*Math.pow(1.7,Math.min(5,reconnectAttempts)));
  el('reconnect-indicator').textContent='LIGAÇÃO INTERROMPIDA · A TENTAR RECUPERAR A SALA…';
  el('reconnect-indicator').classList.remove('hidden');
  reconnectTimer=setTimeout(()=>{
   reconnectTimer=null;reconnectAttempts++;
   openSocket('RESUME');
  },delay);
 }
 function openSocket(action,code=''){
  const proto=location.protocol==='https:'?'wss':'ws';
  const url=`${proto}://${location.host}/ws`;
  let connection;
  try{connection=new WebSocket(url);}catch(e){textStatus('Erro: '+e.message);if(action==='RESUME')scheduleReconnect();return;}
  socket=connection;
  connection.addEventListener('open',()=>{
   if(socket!==connection)return;
   if(action==='CREATE')connection.send(JSON.stringify({type:'CREATE',map:roomMapSelect.value,mode:roomModeSelect.value,lobby:roomModeSelect.value!=='coop',name:playerNickname()}));
   else if(action==='JOIN')connection.send(JSON.stringify({type:'JOIN',code,name:playerNickname()}));
   else if(action==='RESUME')connection.send(JSON.stringify({type:'RESUME',code:roomCode,session:reconnectToken}));
  });
  connection.addEventListener('message',ev=>{
   if(socket!==connection)return;
   let m;try{m=JSON.parse(ev.data);}catch{return;}
   if(action==='RESUME'&&m.type==='ERROR'){
    cancelReconnect();reconnectToken='';clearStoredSession();
    el('pause-room').textContent='LIGAÇÃO PERDIDA';
    el('reconnect-indicator').textContent=m.message;
    el('reconnect-indicator').classList.remove('hidden');
    connection.close();return;
   }
   onNetwork(m);
  });
  connection.addEventListener('error',()=>{
   if(socket===connection&&action!=='RESUME')textStatus('Erro de rede. Confirma que o servidor está aberto.');
  });
  connection.addEventListener('close',()=>{
   if(socket!==connection)return;
   socket=null;
   if(mode==='multi'&&status!=='menu'&&reconnectToken&&roomCode){
    if(status==='playing')pauseGame();
    el('pause-room').textContent='A RECUPERAR';
    if(status==='lobby')el('lobby-message').textContent='LIGAÇÃO INTERROMPIDA · A RECUPERAR SALA…';else el('pause-menu').classList.remove('hidden');
    if(!reconnectDeadline)reconnectDeadline=Date.now()+15000;
    scheduleReconnect();
   }else if(action!=='RESUME')textStatus('Desligado do servidor.');
  });
 }
 function joinRoom(action){
  if(!window.WebSocket)return textStatus('Este navegador não suporta WebSocket.');
  const code=el('room-code').value.trim().toUpperCase();
  disconnect();textStatus('A contactar o servidor…');openSocket(action,code);
 }
 function disconnect(){
  resetShotPrediction();cancelReconnect();clearStoredSession();reconnectToken='';
  if(socket){const old=socket;socket=null;try{if(old.readyState===WebSocket.OPEN)old.send(JSON.stringify({type:'LEAVE'}));old.close();}catch{}}
  roomCode='';myId='';ui.roomBanner.classList.add('hidden');
 }
 function send(m){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(m));}
 function onNetwork(m){if(m.type==='ERROR'){textStatus(m.message);if(status!=='menu')eventMessage(m.message);if(status==='paused')el('pause-room').textContent='AÇÃO RECUSADA';return;}
  if(m.type==='NOTICE'){eventMessage(m.message);textStatus(m.message);return;}
  if(m.type==='ROOM'){resetShotPrediction();cancelReconnect();reconnectToken=m.session||'';lastStateSeq=-1;shieldUntil=performance.now()+1200;scoreUpdateAt=0;roomCode=m.code;saveStoredSession(true);el('recover-banner').classList.add('hidden');myId=m.id;host=m.host;myTeam=m.team||'blue';mySlot=m.slot||0;selectedMap=m.map;updateMapSelection();buildMap(m.map);resetPlayer(m.map,mySlot);localEnemies=[];el('generated-code').textContent=m.code;ui.roomBanner.classList.remove('hidden');textStatus(`Sala ${m.code} · ${m.host?'Anfitrião':'Jogador convidado'}`);if(m.lobby){openLobby();}else startPlay('multi');eventMessage(m.lobby?'SALA '+m.code+' · ESCOLHE AS EQUIPAS':m.host?'SALA '+m.code+' · CLICA NO CÓDIGO NO CANTO PARA COPIAR':'ENTRASTE NA SALA '+m.code);return;}
  if(m.type==='RESUMED'){
   resetShotPrediction();cancelReconnect();
   if(m.code!==roomCode)return;
   // Session tokens are one-time-use. Persist the rotated token immediately.
   if(typeof m.session==='string'&&/^[0-9a-f]{48}$/.test(m.session))reconnectToken=m.session;
   const fromRefresh=ui.overlay.classList.contains('hidden')===false;
   saveStoredSession(true);
   myId=m.id;host=!!m.host;myTeam=m.team||'blue';mySlot=m.slot||0;
   if(m.map!==mapId){selectedMap=m.map;updateMapSelection();buildMap(m.map);resetPlayer(m.map,mySlot);}
   if(weapons[m.weapon]){player.weapon=m.weapon;getGun(m.weapon);}
   if(m.ammo&&typeof m.ammo==='object')for(const [id,w] of Object.entries(weapons)){
    if(Number.isFinite(m.ammo[id]))player.ammo[id]=predictedAmmo(id,m.ammo[id]);
   }
   player.reloading=m.reloading===player.weapon?Math.max(0,(Number(m.reloadRemaining)||0)/1000):0;
   player.reloadDuration=weapons[player.weapon].reload;
   player.x=m.x;player.z=m.z;health=m.hp;armor=m.armor;shieldUntil=performance.now()+1200;
   lastStateSeq=-1;netLastArrival=0;
   if(m.lobby){openLobby();}else if(fromRefresh){startPlay('multi',{autoLock:false});pauseGame();}
   el('pause-room').textContent='RECUPERADO · '+m.code;
   el('reconnect-indicator').textContent='Ligação recuperada! Clica em VOLTAR AO JOGO.';
   el('reconnect-indicator').classList.remove('hidden');
   el('net-meter').textContent='ONLINE';
   textStatus('Ligação restaurada à sala '+m.code);
   eventMessage('LIGAÇÃO RECUPERADA');return;
  }
  if(m.type==='SHOT_RESULT'){
   if(!Number.isSafeInteger(m.seq)||m.seq<=lastShotAck||!weapons[m.weapon]||!Number.isFinite(m.remaining))return;
   lastShotAck=m.seq;
   // The server processes messages in order. Keep more recent predicted
   // shots subtracted until their own acknowledgements arrive.
   for(let i=pendingShots.length-1;i>=0;i--)if(pendingShots[i].seq<=m.seq)pendingShots.splice(i,1);
   player.ammo[m.weapon]=predictedAmmo(m.weapon,m.remaining);
   updateHUD();return;
  }
  if(m.type==='AMMO_SYNC'){
   if(m.ammo&&typeof m.ammo==='object')for(const [id,w] of Object.entries(weapons)){
    if(Number.isFinite(m.ammo[id]))player.ammo[id]=predictedAmmo(id,m.ammo[id]);
   }
   if(m.reloading===player.weapon){player.reloading=Math.max(0,(Number(m.reloadRemaining)||0)/1000);player.reloadDuration=weapons[player.weapon].reload;}
   else if(!m.reloading)player.reloading=0;
   updateHUD();return;
  }
  if(m.type==='MOVE_CORRECTION'){
   // Snap only when the server rejects a predicted move. Normal positions still
   // use the small-drift tolerance in STATE to avoid shaking the camera.
   if(Number.isFinite(m.x)&&Number.isFinite(m.z)&&mode==='multi'){
     player.x=m.x;player.z=m.z;
   }
   return;
  }
  if(m.type==='LOBBY'){if(m.code!==roomCode)return;if(status==='lobby'||status==='paused'&&roomLobby){if(status==='paused')openLobby();drawLobby(m);}return;}
  if(m.type==='LOBBY_STARTED'){
    selectedMap=m.map;updateMapSelection();
    if(mapId!==m.map)buildMap(m.map);
    resetPlayer(m.map,mySlot);localEnemies=[];roomLobby=null;
    startPlay('multi',{autoLock:false});eventMessage('PARTIDA INICIADA · CLICA NO JOGO PARA MIRAR');return;
  }
  if(m.type==='HOST'){host=true;updatePauseHostTools();if(roomLobby)drawLobby(roomLobby);eventMessage('AGORA ÉS O ANFITRIÃO');return;}
  if(m.type==='TEAM'){myTeam=m.team||'blue';mySlot=m.slot||0;return;}
  if(m.type==='BUY_RESULT'){
   if(Number.isFinite(m.hp))health=m.hp;
   if(Number.isFinite(m.armor))armor=m.armor;
   if(Number.isFinite(m.money))money=m.money;
   eventMessage(m.message||(m.success?'COMPRA CONCLUÍDA':'COMPRA RECUSADA'));
   updateHUD();return;
  }
  if(m.type==='MAP'){
   selectedMap=m.map;updateMapSelection();
   // A host can restart the CURRENT map too: position, viewmodels, reload
   // animations, ammo and scores must all reset on every room reset.
   if(mapId!==m.map || m.reset){
    resetShotPrediction();buildMap(m.map);resetPlayer(m.map,mySlot);
    localEnemies=[];scorePlayers=[];lastTeamScore='';lastTeamCount='';
    eventMessage(m.reset?'NOVA PARTIDA · EQUIPAMENTO REPÔSTO':'MAPA ALTERADO');
    if(status==='paused'){el('pause-room').textContent=roomCode;el('pause-map').textContent=MAPS[m.map]?.name||'MAPA';updatePauseHostTools();}
    updateHUD();
   }
   return;
  }
  if(m.type==='STATE'){
   if(roomCode&&reconnectToken)saveStoredSession();
   if(mapId!==m.map){selectedMap=m.map;updateMapSelection();buildMap(m.map);resetPlayer(m.map,mySlot);localEnemies=[];}
   if(Number.isInteger(m.seq)){if(m.seq<=lastStateSeq)return;if(lastStateSeq>=0)netSeqDrops+=Math.max(0,m.seq-lastStateSeq-1);lastStateSeq=m.seq;}
   wave=m.wave;kills=m.kills;scorePlayers=Array.isArray(m.players)?m.players:[];if(scoreVisible)updateScoreboard();
   const arrival=performance.now();
   if(netLastArrival>0){const interval=arrival-netLastArrival;if(interval>0&&interval<1500){netIntervalSamples.push(interval);if(netIntervalSamples.length>60)netIntervalSamples.shift();}}
   netLastArrival=arrival;
   for(const p of m.players){
    if(p.id===myId){
     if(p.hp<health)flashDamage(.65);health=p.hp;armor=p.armor;money=p.money;
     if(Math.hypot(player.x-p.x,player.z-p.z)>2.2){player.x=p.x;player.z=p.z;}
    }else{
     if(p.online===false)continue;
     let item=otherPlayers.get(p.id);
     if(!item){
      const mesh=MAPS[mapId].pvp?createArenaFighter(T,p.team||'blue',p.weapon||'m4'):createTeammate(T,p.weapon||'m4',{muzzleTexture:muzzleTex});scene.add(mesh);
      item={obj:mesh,x:p.x,z:p.z,yaw:p.yaw||0,jump:p.jump||0,samples:[]};otherPlayers.set(p.id,item);
     }
     if(item.obj.userData.weaponId!==p.weapon){
      if(MAPS[mapId].pvp)setArenaFighterWeapon(item.obj,p.weapon||'m4');
      else {scene.remove(item.obj);disposeEnemyObject(item.obj);item.obj=createTeammate(T,p.weapon||'m4',{muzzleTexture:muzzleTex});scene.add(item.obj);}
     }
     addRemoteSample(item.samples,p,arrival);
    }
   }
   for(const [id,it] of otherPlayers)if(!m.players.some(p=>p.id===id&&p.online!==false)){
    scene.remove(it.obj);disposeEnemyObject(it.obj);otherPlayers.delete(id);
   }
   localEnemies=MAPS[mapId]?.pvp?[]:m.enemies;
   if(MAPS[mapId]?.pvp){
     const blues=m.players.filter(p=>p.team==='blue'),oranges=m.players.filter(p=>p.team==='orange');
     const bs=blues.reduce((sum,p)=>sum+(p.kills||0),0),os=oranges.reduce((sum,p)=>sum+(p.kills||0),0);
     const score=`AZUL ${bs} — ${os} LARANJA`,count=`${blues.length}v${oranges.length} · EQUIPA ${myTeam==='blue'?'AZUL':'LARANJA'}`;
     if(score!==lastTeamScore){el('pvp-teams').textContent=score;lastTeamScore=score;}
     if(count!==lastTeamCount){el('pvp-count').textContent=count;lastTeamCount=count;}
   }
   // The normal 120 ms HUD update will refresh life and ammo; do not
   // touch the DOM 20 times/sec just because a network packet arrived.
   return;
  }
  if(m.type==='PONG'){const ping=Math.max(0,Math.round(performance.now()-m.time));netPingSamples.push(ping);if(netPingSamples.length>24)netPingSamples.shift();const avgPing=Math.round(netPingSamples.slice(-5).reduce((s,v)=>s+v,0)/Math.min(5,netPingSamples.length));const quality=avgPing<90?'good':avgPing<170?'moderate':'poor';el('net-meter').dataset.quality=quality;el('net-meter').title=quality==='poor'?'Ligação lenta: o lag vem da rede, não dos FPS':quality==='moderate'?'Ping intermédio':'Ligação estável';netBufferMs=MAPS[mapId]?.pvp?Math.max(65,Math.min(120,60+ping*.22)):Math.max(90,Math.min(180,86+ping*.42));el('net-meter').textContent=`PING ${avgPing} ms`;return;}
  if(m.type==='ENEMY_FIRE'){playRemoteShot(m.weapon||'m4',m.x,m.z);const enemy=enemyMeshes.get(m.id);if(enemy)enemy.userData.firePulse=.10;return;}
  if(m.type==='FIRE'&&m.id!==myId){playRemoteShot(m.weapon||'m4',m.x,m.z);const remote=otherPlayers.get(m.id)?.obj;if(remote)remote.userData.firePulse=.10;return;}
  if(m.type==='RESPAWN'){
    const shieldMs=Number.isFinite(m.shield)?Math.max(0,m.shield):1800;
    shieldUntil=performance.now()+shieldMs;
    if(Number.isFinite(m.x)&&Number.isFinite(m.z)){player.x=m.x;player.z=m.z;}
    health=Number.isFinite(m.hp)?m.hp:100;
    armor=Number.isFinite(m.armor)?m.armor:0;
    player.jump=0;player.vy=0;player.crouch=0;
    damageAlpha=0;
    eventMessage(`REAPARECESTE · ${(shieldMs/1000).toFixed(1)}s DE PROTEÇÃO`);
    updateHUD();return;
  }
  if(m.type==='KILL'){const you=m.killer===myId;const nick=id=>scorePlayers.find(p=>p.id===id)?.name||String(id||'').slice(0,4);addKillFeed((you?'TU':nick(m.killer))+' ✕ '+(m.victim===myId?'TU':nick(m.victim))+' · '+(weapons[m.weapon]?.label||m.weapon));return;}
  if(m.type==='HIT'){showHitmarker(m.zone==='head');eventMessage(m.zone==='head'?'HEADSHOT':'ACERTO');}
 }
 function updateMapSelection(){document.querySelectorAll('.map-tile').forEach(b=>b.classList.toggle('selected',b.dataset.map===selectedMap));}
 document.querySelectorAll('.map-tile').forEach(b=>b.onclick=()=>{selectedMap=b.dataset.map;updateMapSelection();if(status==='menu')buildMap(selectedMap);if(mode==='multi'&&host)send({type:'MAP',map:selectedMap});});
 el('solo').onclick=()=>status==='paused'?resume():newSolo();el('room-indicator').onclick=()=>{if(roomCode){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(roomCode).then(()=>eventMessage('CÓDIGO '+roomCode+' COPIADO')).catch(()=>window.prompt('Copia o código da sala:',roomCode));else window.prompt('Copia o código da sala:',roomCode);}};el('create').onclick=()=>joinRoom('CREATE');el('join').onclick=()=>{const code=el('room-code').value.trim();if(!/^[A-Za-z0-9]{6}$/.test(code))return textStatus('Introduz um código válido com 6 caracteres.');joinRoom('JOIN');};el('room-code').oninput=()=>el('room-code').value=el('room-code').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
 const invitedRoom=getInviteCode(location.search);
 if(invitedRoom){el('room-code').value=invitedRoom;textStatus(`CONVITE ${invitedRoom} PRONTO · clica em ENTRAR para te juntares à sala.`);}
 const inviteButtons=[el('hud-invite'),el('pause-invite'),el('copy-invite')];
 function setInviteVisible(yes){for(const btn of inviteButtons)btn.classList.toggle('hidden',!yes);}
 function copyRoomInvite(){
   if(!roomCode)return;
   const url=makeInviteUrl(location.origin,roomCode);
   if(isLocalOrigin(location.origin)){window.alert('Este jogo está no teu computador. Publica-o no Render e depois copia o convite a partir do link online.');return;}
   const fallback=()=>window.prompt('Copia o link da tua sala:',url);
   if(!navigator.clipboard?.writeText)return fallback();
   navigator.clipboard.writeText(url).then(()=>{
     for(const btn of inviteButtons){btn.dataset.previousLabel=btn.dataset.previousLabel||btn.textContent;btn.textContent='✓ LINK COPIADO';}
     setTimeout(()=>{for(const btn of inviteButtons){if(btn.dataset.previousLabel){btn.textContent=btn.dataset.previousLabel;delete btn.dataset.previousLabel;}}},1600);
   }).catch(fallback);
 }
 inviteButtons.forEach(btn=>btn.onclick=copyRoomInvite);
 setInviteVisible(false);
 function updateHUD(){
   el('radar-label').textContent=MAPS[mapId].name+' · RADAR';
   el('round-count').classList.toggle('hidden',!!MAPS[mapId].pvp);el('pvp-score').classList.toggle('hidden',!MAPS[mapId].pvp);el('wave').textContent=wave;el('kills').textContent=kills;el('money').textContent='$'+money.toLocaleString('en-US');
   el('hp').textContent=Math.ceil(health);el('hp-track-fill').style.width=clamp(health,0,100)+'%';
   el('health-state').textContent=health<=25?'CRÍTICO':health<=55?'FERIDO':'OPERACIONAL';
   el('hp-panel').classList.toggle('critical',health<=25);
   el('armor-label').textContent=armor?'COLETE '+Math.round(armor):'SEM COLETE';
   const w=weapons[player.weapon],knife=player.weapon==='knife';
   el('ammo').textContent=knife?'∞':player.ammo[player.weapon];
   el('reserve').textContent=knife?'':' / ∞';
   el('weapon-label').textContent=w.label;
   el('ammo-track-fill').style.width=knife?'100%':`${clamp(player.ammo[player.weapon]/w.mag*100,0,100)}%`;
   el('reload-indicator').textContent=player.reloading>0?'A RECARREGAR':!knife&&player.ammo[player.weapon]<=5?'POUCAS BALAS':`${w.damage} DMG`;
   el('ammo-panel').classList.toggle('ammo-low',!knife&&player.ammo[player.weapon]<=5);
 }
 function openModal(title,html){el('modal-title').textContent=title;el('modal-body').innerHTML=html;ui.modal.classList.remove('hidden');document.exitPointerLock?.();}
 function closeModal(){ui.modal.classList.add('hidden');if(status==='playing')ui.pauseTip.classList.remove('hidden');}
 el('modal-close').onclick=closeModal;
 el('settings-btn').onclick=showSettings;
 function showSettings(){openModal('DEFINIÇÕES',`<p><label for="quality">Qualidade gráfica / desempenho</label></p><select id="quality" style="width:100%;padding:9px;background:#0b1f28;color:white;border:1px solid #6a858c;border-radius:6px"><option value="leve">LEVE — máximo FPS, escala 62%</option><option value="equilibrada">EQUILIBRADA — escala 78%</option><option value="alta">ALTA OTIMIZADA — escala 92%, sem sombras dinâmicas</option><option value="ultra">ULTRA — resolução total + sombras (mais pesada)</option></select><p>Sensibilidade do rato: <span id="sens-val">${sensitivity.toFixed(4)}</span></p><input style="width:100%" id="sensitivity" type="range" min="0.0007" max="0.005" step="0.0001" value="${sensitivity}"/><p>Campo de visão (FOV): <span id="fov-val">${camera.fov}°</span></p><input style="width:100%" id="fov-setting" type="range" min="65" max="95" step="1" value="${camera.fov}"/><div class="settingsSection"><h3>HUD · ESTILO ARENA PRO+</h3><p>Tamanho do HUD: <span id="hud-scale-value">${Math.round(hudScale)}%</span></p><input id="hud-scale" type="range" min="80" max="120" step="5" value="${hudScale}"/><p><label for="reticle-color">Cor da mira</label></p><select id="reticle-color"><option value="lime">VERDE · ARENA</option><option value="white">BRANCO · CLÁSSICO</option><option value="cyan">AZUL CIANO</option><option value="gold">DOURADO</option></select><p><label for="radar-mode">Radar</label></p><select id="radar-mode"><option value="normal">NORMAL</option><option value="compacto">COMPACTO</option><option value="oculto">OCULTAR</option></select><p class="settingsNote">Estas preferências são guardadas neste navegador e não alteram os tiros nem o servidor.</p></div><p><strong>Posição da arma (primeira pessoa)</strong></p><p style="color:#9bb5ba;font-size:12px">Ajusta todas as armas. Não altera a direção real dos tiros.</p><p>Horizontal: <span id="view-x-val">${viewOffset.x.toFixed(2)}</span></p><input style="width:100%" id="view-x" type="range" min="-0.25" max="0.25" step="0.01" value="${viewOffset.x}"/><p>Altura: <span id="view-y-val">${viewOffset.y.toFixed(2)}</span></p><input style="width:100%" id="view-y" type="range" min="-0.25" max="0.25" step="0.01" value="${viewOffset.y}"/><p>Profundidade: <span id="view-z-val">${viewOffset.z.toFixed(2)}</span></p><input style="width:100%" id="view-z" type="range" min="-0.25" max="0.25" step="0.01" value="${viewOffset.z}"/><p><button id="view-reset" style="padding:7px 12px;background:#19333b;color:#dbe8e9;border:1px solid #64848c;border-radius:6px">REPOR POSIÇÃO</button></p><p><strong>Som</strong></p><p>Volume geral: <span id="master-val">${Math.round(masterVolume*100)}%</span></p><input style="width:100%" id="master-volume" type="range" min="0" max="1" step="0.01" value="${masterVolume}"/><p>Efeitos / tiros: <span id="sfx-val">${Math.round(sfxVolume*100)}%</span></p><input style="width:100%" id="sfx-volume" type="range" min="0" max="1" step="0.01" value="${sfxVolume}"/><p>Passos: <span id="foot-val">${Math.round(footstepVolume*100)}%</span></p><input style="width:100%" id="foot-volume" type="range" min="0" max="1" step="0.01" value="${footstepVolume}"/><p><strong>Diagnóstico de desempenho</strong></p><p><button id="benchmark-btn" style="background:#173841;color:#d8eded;border:1px solid #527780;border-radius:5px;padding:9px 13px">TESTE FPS 20s</button></p><p style="color:#a3babc;font-size:12px">Depois envia-me uma captura do resultado. Se quiseres ajudar ainda mais, manda também uma captura do Gestor de Tarefas &gt; Desempenho enquanto o jogo está aberto.</p><p>Seleciona uma ação e prime a nova tecla. As alterações ficam guardadas neste navegador.</p><div id="binds"></div><p><button id="bind-reset">REPOR TECLAS</button></p>`);
  const slider=el('sensitivity');slider.oninput=()=>{sensitivity=Number(slider.value);el('sens-val').textContent=sensitivity.toFixed(4);localStorage.setItem('frontline_sense',sensitivity);};
  const fov=el('fov-setting');fov.oninput=()=>{camera.fov=Number(fov.value);camera.updateProjectionMatrix();el('fov-val').textContent=camera.fov+'°';localStorage.setItem('frontline_fov',camera.fov);};
  el('quality').value=quality;el('quality').onchange=e=>{quality=e.target.value;localStorage.setItem('frontline_quality',quality);applyGraphicsQuality();};
  const hudScaleInput=el('hud-scale');hudScaleInput.oninput=()=>{hudScale=clamp(Number(hudScaleInput.value),80,120);el('hud-scale-value').textContent=hudScale+'%';localStorage.setItem('frontline_hud_scale',String(hudScale));applyHUDPrefs();};
  el('reticle-color').value=reticleColor;el('reticle-color').onchange=ev=>{const value=ev.target.value;if(!crosshairPalette[value])return;reticleColor=value;localStorage.setItem('frontline_reticle_color',value);applyHUDPrefs();};
  el('radar-mode').value=radarMode;el('radar-mode').onchange=ev=>{const value=ev.target.value;if(!['normal','compacto','oculto'].includes(value))return;radarMode=value;localStorage.setItem('frontline_radar_mode',value);applyHUDPrefs();};
  const saveViewOffset=()=>localStorage.setItem('frontline_view_offset_ref_148b',JSON.stringify(viewOffset));
  for(const k of ['x','y','z']){const input=el('view-'+k);if(input)input.oninput=()=>{viewOffset[k]=Number(input.value);el('view-'+k+'-val').textContent=viewOffset[k].toFixed(2);saveViewOffset();};}
  el('view-reset').onclick=()=>{viewOffset={x:0,y:0,z:0};for(const k of ['x','y','z']){el('view-'+k).value='0';el('view-'+k+'-val').textContent='0.00';}saveViewOffset();};
  const bindVolume=(id,labelId,key,onSet)=>{const input=el(id);if(!input)return;input.oninput=()=>{const value=clamp(Number(input.value),0,1);onSet(value);el(labelId).textContent=Math.round(value*100)+'%';localStorage.setItem(key,String(value));updateAudioMix();};};
  bindVolume('master-volume','master-val','frontline_master_volume',v=>masterVolume=v);
  bindVolume('sfx-volume','sfx-val','frontline_sfx_volume',v=>sfxVolume=v);
  bindVolume('foot-volume','foot-val','frontline_footstep_volume',v=>footstepVolume=v);
  function renderBinds(){el('binds').innerHTML=Object.keys(bindsDefault).map(k=>`<div class="bind-row"><span>${bindNames[k]}</span><button data-bind="${k}">${binds[k]}</button></div>`).join('');document.querySelectorAll('[data-bind]').forEach(b=>b.onclick=()=>{b.textContent='PREMIR…';const action=b.dataset.bind;const handler=e=>{e.preventDefault();e.stopPropagation();binds[action]=e.code;localStorage.setItem('frontline_binds',JSON.stringify(binds));window.removeEventListener('keydown',handler,true);renderBinds();};window.addEventListener('keydown',handler,true);});}
  el('bind-reset').onclick=()=>{binds={...bindsDefault};localStorage.setItem('frontline_binds',JSON.stringify(binds));renderBinds();};
  const benchBtn=el('benchmark-btn');if(benchBtn)benchBtn.onclick=()=>startBenchmark(20);
  renderBinds();
 }
function showShop(){openModal('LOJA · ARSENAL DE TESTES',`<p>As cinco armas estão desbloqueadas para poderes experimentar as viewmodels. A loja já permite comprar proteção e recuperar vida.</p><div class="shop-row"><span><strong>COLETE</strong><br><small>$650 · proteção 100</small></span><button data-buy="armor">COMPRAR</button></div><div class="shop-row"><span><strong>KIT MÉDICO</strong><br><small>$400 · recuperar 50 HP</small></span><button data-buy="health">COMPRAR</button></div>`);document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const item=b.dataset.buy;if(mode==='multi')send({type:'BUY',item});else if(item==='armor'&&money>=650){money-=650;armor=100;}else if(item==='health'&&money>=400){money-=400;health=Math.min(100,health+50);}updateHUD();closeModal();});}
 function resetKeys(){keys.clear();heldMouse=false;}
 function equip(id){if(!weapons[id]||player.weapon===id)return;shotTimer=0;player.weapon=id;if(mode==='multi'&&status==='playing')send({type:'MOVE',x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch,jump:player.jump,weapon:id,moving:player.moving});player.reloading=0;player.inspect=0;heldMouse=false;player.shots=0;player.lastShot=-100;player.recoil=0;equipTimer=.27;player.knifeDraw=id==='knife'?.55:0;viewSway={x:0,y:0};getGun(id);updateHUD();}
 function reload(){if(status!=='playing'||player.weapon==='knife'||player.reloading>0)return;const w=weapons[player.weapon];if(player.ammo[player.weapon]>=w.mag)return;player.reloading=w.reload;player.reloadDuration=w.reload;player.inspect=0;if(mode==='multi')send({type:'RELOAD',weapon:player.weapon});playActionSound();}
 function inspect(){if(status==='playing'&&!player.reloading){const d=player.weapon==='knife'?2.8:2.3;player.inspect=d;player.inspectDuration=d;}}
 function jump(){if(status==='playing'&&player.jump<=0.0001&&player.vy===0&&player.crouch<.3){player.vy=4.8;player.jump=.002;}}
 function look(e){if(document.pointerLockElement!==canvas||status!=='playing')return;player.yaw-=e.movementX*sensitivity;player.pitch=clamp(player.pitch-e.movementY*sensitivity,-1.36,1.36);viewSway=addLookImpulse(viewSway,e.movementX,e.movementY,sensitivity);}
 document.addEventListener('mousemove',look);
 window.addEventListener('keydown',e=>{
  if(e.code==='Tab' && (status==='playing'||status==='paused') && ui.modal.classList.contains('hidden')){e.preventDefault();if(!scoreKeyDown){scoreKeyDown=true;showScore();}return;}
  if(e.code==='Escape'&&scoreVisible){e.preventDefault();hideScore();return;}
  if(status==='paused'&&e.code==='Escape'&&ui.modal.classList.contains('hidden')){e.preventDefault();resume();return;}
  if(status!=='playing'||!ui.modal.classList.contains('hidden'))return;const used=Object.values(binds).includes(e.code);if(used||e.code==='Escape'){e.preventDefault();}
  keys.add(e.code);if(e.repeat)return;
  if(e.code===binds.jump)jump();if(e.code===binds.reload)reload();if(e.code===binds.inspect)inspect();if(e.code===binds.shop)showShop();
  for(const id of ['m4','ak','pistol','mp9','knife'])if(e.code===binds[id])equip(id);
  if(e.code==='Escape'){
   heldMouse=false;pendingMouseShot=false;resetKeys();
   pauseGame();
  }
 });
 window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab')hideScore();});window.addEventListener('blur',()=>{resetKeys();pendingMouseShot=false;hideScore();});
 document.addEventListener('pointerlockchange',()=>{
   const locked=document.pointerLockElement===canvas;
   if(!locked){heldMouse=false;if(status==='playing'&&ui.modal.classList.contains('hidden'))pauseGame();}
   if(locked&&pendingMouseShot&&status==='playing'){player.inspect=0;pendingMouseShot=false;shoot();}
 });
 canvas.addEventListener('click',()=>{if(status==='playing'&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
 canvas.addEventListener('mousedown',e=>{if(e.button===0&&status==='playing'){if(document.pointerLockElement!==canvas){pendingMouseShot=true;canvas.requestPointerLock?.();return;}heldMouse=true;player.inspect=0;shoot();}});
 window.addEventListener('mouseup',()=>{heldMouse=false;});window.addEventListener('contextmenu',e=>{if(status==='playing')e.preventDefault();});
 function initAudio(){
   if(!audio){
     try{
       audio=new(window.AudioContext||window.webkitAudioContext)();
       masterGain=audio.createGain();sfxGain=audio.createGain();footGain=audio.createGain();
       sfxGain.connect(masterGain);footGain.connect(masterGain);masterGain.connect(audio.destination);
       const len=audio.sampleRate*.25; noiseBuffer=audio.createBuffer(1,len,audio.sampleRate); const data=noiseBuffer.getChannelData(0); for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);
       updateAudioMix();
     }catch{}
   }
   if(audio?.state==='suspended')audio.resume();
 }
 function updateAudioMix(){if(!audio||!masterGain||!sfxGain||!footGain)return;masterGain.gain.setTargetAtTime(masterVolume,audio.currentTime,.01);sfxGain.gain.setTargetAtTime(sfxVolume,audio.currentTime,.01);footGain.gain.setTargetAtTime(footstepVolume,audio.currentTime,.01);}
 function playSound(freq=250,duration=.08,type='square',volume=.035){initAudio();if(!audio||!sfxGain)return;const o=audio.createOscillator(),g=audio.createGain(),f=audio.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.35),audio.currentTime+duration);f.type='lowpass';f.frequency.setValueAtTime(Math.max(180,freq*6),audio.currentTime);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(f);f.connect(g);g.connect(sfxGain);o.start();o.stop(audio.currentTime+duration+.01);}
 function playNoise(duration=.06,volume=.05,filterHz=1200,destination='sfx'){initAudio();if(!audio||!noiseBuffer)return;const src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();src.buffer=noiseBuffer;f.type='bandpass';f.frequency.setValueAtTime(filterHz,audio.currentTime);f.Q.value=.7;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);src.connect(f);f.connect(g);g.connect(destination==='foot'?footGain:sfxGain);src.start();src.stop(audio.currentTime+duration+.01);}
 function playFootstepAt(x,z,{enemy=false,knife=false}={}){
  if(footstepVolume<=0)return;
  // Nearby footsteps only: the sound should be useful, never dominate the shots.
  const distance=Number.isFinite(x)&&Number.isFinite(z)?Math.hypot(player.x-x,player.z-z):0;
  if(enemy&&distance>12)return;
  initAudio();if(!audio||!footGain)return;
  // Several bots could otherwise layer six near-identical footfalls into a loud rattle.
  if(enemy&&audio.currentTime-lastEnemyStepTime<.11)return;
  const falloff=enemy?Math.pow(Math.max(0,1-distance/12),1.65):1;
  if(falloff<.07)return;
  const variant=enemy?(++enemyStepVariant%3)+1:(++stepVariant%4)+1;
  const buffer=shotBuffers.get(enemy?'foot_boot_'+variant:'foot_soft_'+variant);
  if(!buffer)return; // No noisy synthetic fallback when a sample is still loading.
  if(enemy)lastEnemyStepTime=audio.currentTime;
  const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
  src.buffer=buffer;
  src.playbackRate.value=(knife?1.06:1)*(.96+Math.random()*.07);
  filter.type='lowpass';filter.frequency.value=enemy?1150:1450;
  gain.gain.value=(enemy?.23:.33)*falloff*(.90+Math.random()*.12);
  src.connect(filter);filter.connect(gain);gain.connect(footGain);src.start();
 }

 // Local sampled sounds. The old waveform-only gunshot sounded like an arcade beep.
 const shotBuffers=new Map(),soundLoading=new Set();
 function loadShotSample(id){
   if(shotBuffers.has(id)||soundLoading.has(id))return;
   initAudio();if(!audio)return;
   soundLoading.add(id);
   fetch('/public/audio/'+id+'.wav').then(r=>{if(!r.ok)throw new Error('audio '+id+' '+r.status);return r.arrayBuffer()})
     .then(data=>audio.decodeAudioData(data)).then(buffer=>shotBuffers.set(id,buffer))
     .catch(e=>console.warn('Som não carregado:',id,e.message)).finally(()=>soundLoading.delete(id));
 }
 function preloadGunSounds(){for(const id of ['m4','ak','mp9','pistol','knife','reload','impact_concrete','impact_wood','impact_metal','foot_soft_1','foot_soft_2','foot_soft_3','foot_soft_4','foot_boot_1','foot_boot_2','foot_boot_3'])loadShotSample(id);}
 function playActionSound(){const buffer=shotBuffers.get('reload');if(!audio||!buffer)return;const src=audio.createBufferSource(),g=audio.createGain(),f=audio.createBiquadFilter();src.buffer=buffer;src.playbackRate.value=.97+Math.random()*.08;f.type='highpass';f.frequency.value=480;g.gain.value=.19;src.connect(f);f.connect(g);g.connect(sfxGain);src.start();}
 function playImpactAudio(surface='concrete',distance=5){if(!audio)return;const buffer=shotBuffers.get('impact_'+surface);if(!buffer)return;const src=audio.createBufferSource(),g=audio.createGain(),f=audio.createBiquadFilter();src.buffer=buffer;src.playbackRate.value=.94+Math.random()*.12;f.type='bandpass';f.frequency.value=surface==='wood'?1800:surface==='metal'?2600:2100;g.gain.value=Math.min(.17,.12/(1+distance*.10));src.connect(f);f.connect(g);g.connect(sfxGain);src.start();}
 function playRemoteShot(weapon,x,z){const d=(Number.isFinite(x)&&Number.isFinite(z))?Math.hypot(player.x-x,player.z-z):8;playShot(.082/(1+d*.20),weapon);}
 function playShot(volume=.08,weapon=player.weapon){initAudio();if(!audio)return;const id=weapon==='knife'?'knife':weapon;const buffer=shotBuffers.get(id);if(!buffer){playNoise(.030,Math.min(.12,volume*.85),id==='knife'?1100:2300);return;}const source=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter(),air=audio.createBiquadFilter();source.buffer=buffer;source.playbackRate.value=.982+Math.random()*.040;filter.type='lowpass';filter.frequency.value=id==='knife'?6200:12500;air.type='highshelf';air.frequency.value=id==='knife'?2200:3600;air.gain.value=id==='knife'?1.5:2.3;gain.gain.value=id==='knife'?Math.min(.34,volume*3.8):Math.min(.48,volume*4.2);source.connect(filter);filter.connect(air);air.connect(gain);gain.connect(sfxGain);source.start();}
 const decalTex=(kind)=>{
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const center=64;
  if(kind==='knife'){
    g.strokeStyle='rgba(21,22,22,.82)';g.lineWidth=7;g.lineCap='round';g.beginPath();g.moveTo(24,99);g.quadraticCurveTo(67,64,111,20);g.stroke();
    g.strokeStyle='rgba(210,209,200,.75)';g.lineWidth=1.8;g.beginPath();g.moveTo(22,96);g.quadraticCurveTo(67,61,108,18);g.stroke();
    for(const k of [-1,1]){g.strokeStyle='rgba(25,25,25,.46)';g.lineWidth=1.8;g.beginPath();g.moveTo(64,63);g.lineTo(64+k*27,63+k*12);g.stroke();}
  }else{
    const wood=kind==='wood',floor=kind==='floor';const grad=g.createRadialGradient(center,center,1,center,center,48);
    grad.addColorStop(0,wood?'rgba(24,11,7,.98)':'rgba(10,12,12,.96)');
    grad.addColorStop(.22,wood?'rgba(35,19,13,.91)':'rgba(18,22,23,.86)');
    grad.addColorStop(.40,floor?'rgba(80,81,76,.5)':wood?'rgba(129,88,53,.48)':'rgba(127,112,95,.38)');
    grad.addColorStop(.82,'rgba(75,70,66,.07)');grad.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=grad;g.fillRect(0,0,128,128);
    g.strokeStyle=wood?'rgba(52,27,14,.6)':'rgba(15,22,23,.4)';g.lineWidth=1.8;
    for(let k=0;k<6;k++){const a=2*Math.PI*k/6;const r=14+(k%3)*3;g.beginPath();g.moveTo(center+Math.cos(a)*10,center+Math.sin(a)*10);g.lineTo(center+Math.cos(a)*r*1.9,center+Math.sin(a)*r*1.9);g.stroke();}
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
 };
 const bulletTexture=decalTex('concrete'),floorTexture=decalTex('floor'),woodTexture=decalTex('wood'),knifeTexture=decalTex('knife');
 function getImpactSurface(hit){
   if(!hit?.object)return 'concrete';
   if(hit.object===world.ground)return 'concrete';
   const g=hit.object.geometry?.parameters;
   if(g?.height>1.3&&g?.height<1.5&&g?.width<1.1)return 'wood';
   return 'concrete';
 }
 function addMark(hit,kind='bullet'){
   if(!hit?.face)return;
   const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
   const floor=Math.abs(normal.y)>.7;
   const tex=kind==='knife'?knifeTexture:floor?floorTexture:getImpactSurface(hit)==='wood'?woodTexture:bulletTexture;
   const sz=kind==='knife'?.31:floor?.11:getImpactSurface(hit)==='wood'?.145:.125;
   const material=new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
   const mesh=new T.Mesh(new T.PlaneGeometry(sz,kind==='knife'?sz*.86:sz),material);
   mesh.position.copy(hit.point).addScaledVector(normal,.012);
   mesh.quaternion.setFromUnitVectors(up,normal);mesh.rotateZ(Math.random()*Math.PI*2);
   scene.add(mesh);marks.push(mesh);
   if(marks.length>45){const old=marks.shift();scene.remove(old);old.geometry.dispose();old.material.dispose();}
 };
 function shoot(){if(status!=='playing'||player.reloading>0||shotTimer>0)return;const w=weapons[player.weapon];if(player.weapon!=='knife'&&player.ammo[player.weapon]<=0){reload();return;}
  player.inspect=0;shotTimer=nextShotCooldown(shotTimer,w.delay);player.recoil=1;
  const heldWeapon=player.weapon;
  const resetTime=heldWeapon==='pistol'?.48:.38;
  if(elapsed-player.lastShot>resetTime)player.shots=0;
  const pattern=shotPattern(heldWeapon,player.shots,player.moving,player.crouch>.4);
  player.lastShot=elapsed;
  if(heldWeapon==='knife')player.swing=.34;
  triggerViewFlash(heldWeapon);pulseCrosshair(heldWeapon==='knife'?.18:heldWeapon==='pistol'?.44:heldWeapon==='mp9'?.38:heldWeapon==='ak'?.56:.46);
  if(heldWeapon!=='knife'){player.ammo[heldWeapon]--;player.shots++;playShot(.10,heldWeapon);spawnCasing();}else{playShot(.07,'knife');}
  const fireYaw=player.yaw+pattern.yaw,firePitch=clamp(player.pitch+pattern.pitch,-1.30,1.30);
  const shotDir=directionFromYawPitch(fireYaw,firePitch);const direction=new T.Vector3(shotDir.x,shotDir.y,shotDir.z).normalize();
  raycaster.set(camera.position,direction);raycaster.far=heldWeapon==='knife'?1.6:40;const hits=raycaster.intersectObjects(world.solids,true);const nearest=hits[0];
  const hit=traceEnemies(camera.position,direction,localEnemies,raycaster.far,nearest?.distance??Infinity);
  if(mode==='multi'){
   if(heldWeapon==='knife')send({type:'KNIFE',weapon:heldWeapon,yaw:fireYaw,pitch:firePitch});
   else{
    const seq=++shotSeq;
    pendingShots.push({seq,weapon:heldWeapon});
    // Avoid unbounded local state if the connection is lost; RESUMED resets it.
    if(pendingShots.length>64)pendingShots.splice(0,pendingShots.length-64);
    send({type:'SHOT',weapon:heldWeapon,yaw:fireYaw,pitch:firePitch,seq});
   }
  }
  // Visible camera kick, kept subtle enough to remain controllable.
  if(heldWeapon!=='knife'){player.pitch=clamp(player.pitch+pattern.cameraKick*.62,-1.36,1.36);player.yaw-=pattern.yaw*.22;}
  if(mode==='solo' && hit){const outcome=applyShotDamage(hit,w.damage);const target=outcome.enemy;target.alert=3.7;target.hitPulse=.28;showHitmarker(outcome.head);spawnImpact(hit.point||camera.position.clone().add(direction.clone().multiplyScalar(hit.distance)),hit.normal||direction.clone().negate(),hit.zone==='head'?0xffd47f:0xf0f7ff,.18);if(outcome.killed){addKillFeed(`TU  ·  ${hit.zone==='head'?'HEADSHOT  ·  ':''}${weapons[player.weapon].label}  ✕  BOT`);const corpseMesh=enemyMeshes.get(target.id);if(corpseMesh){enemyMeshes.delete(target.id);removeEnemyLOD(corpseMesh);corpseMesh.visible=true;dyingEnemies.push({mesh:corpseMesh,life:.55,angle:corpseMesh.rotation.y});}kills++;money+=300;eventMessage(hit.zone==='head'?'HEADSHOT · +$300':'ELIMINAÇÃO · +$300');}else if(hit.zone==='head')eventMessage('HEADSHOT');}
  const tracerTo=hit?camera.position.clone().add(direction.clone().multiplyScalar(hit.distance)):nearest?nearest.point.clone():camera.position.clone().add(direction.clone().multiplyScalar(raycaster.far));
  if(heldWeapon!=='knife'){
   // Começa na boca da arma; sem efeito visual que atravesse o inimigo ou a parede.
   const activeView=getGun(heldWeapon);
   camera.updateMatrixWorld(true);
   const muzzle=activeView.root.localToWorld(activeView.muzzleLocal.clone());
   const origin=tracerTo.distanceTo(muzzle)>.12 ? muzzle : camera.position.clone().add(direction.clone().multiplyScalar(.18));
   if(origin.distanceTo(tracerTo)>.09)spawnTracer(origin,tracerTo,heldWeapon==='ak'?0xffd18a:heldWeapon==='mp9'?0xfff0a2:0xe8f3ff);
  }
  if(nearest&&!hit){addMark(nearest,player.weapon==='knife'?'knife':'bullet');const normal=nearest.face.normal.clone().transformDirection(nearest.object.matrixWorld).normalize();const surface=getImpactSurface(nearest);spawnImpact(nearest.point,normal,surface==='wood'?0xd4a473:0xd2c6a4,.11);if(player.weapon!=='knife')playImpactAudio(surface,nearest.distance);}
  if(player.weapon!=='knife'&&player.ammo[player.weapon]===0)reload();updateHUD();}
 function localAI(dt){
  for(const e of localEnemies){
   if(!e.alive)continue;
   const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz)||1;
   const desired=Math.atan2(-dx,-dz);
   e.alert=Math.max(0,e.alert-dt);
   const visible=d<17&&Math.abs(angleDelta(desired,e.yaw))<Math.PI*.32&&lineOfSight(mapId,e.x,e.z,player.x,player.z);
   if(visible)e.alert=10.0;
   e.sightTime=visible?Math.min(2,(e.sightTime||0)+dt):0;
   if(e.alert>0){
     e.walk=navigateEnemy(mapId,e,{x:player.x,z:player.z},dt,1.24);
     if(!e.walk)e.yaw+=angleDelta(desired,e.yaw)*Math.min(1,dt*3);
   }else{e.walk=false;e.yaw+=Math.sin(elapsed*.45+e.id)*dt*.20;}
   if(e.walk){e.stepTimer=(e.stepTimer??(.20+Math.random()*.06))-dt;if(e.stepTimer<=0){e.stepTimer=.39+Math.random()*.07;playFootstepAt(e.x,e.z,{enemy:true});}}else e.stepTimer=.14+Math.random()*.05;
   e.fire-=dt;
   if(visible&&e.sightTime>.19&&d<12&&e.fire<=0){e.fire=1.1+Math.random()*.8;playRemoteShot(e.weapon||'m4',e.x,e.z);const mesh=enemyMeshes.get(e.id);if(mesh)mesh.userData.firePulse=.11;
     const accuracy=clamp(.94-d*.023-(player.moving?.09:0)-(player.crouch>.4?-.08:0),.40,.91);
     if(Math.random()>accuracy)continue;
     const damage=5+Math.random()*6,absorb=Math.min(armor,damage*.5);
     armor-=absorb;health-=damage-absorb;flashDamage(.60);
     if(health<=0){health=100;const spawn=MAPS[mapId].spawn[0];player.x=spawn[0];player.z=spawn[1];eventMessage('ELIMINADO · REAPARECIMENTO');}
   }
  }
  if(localEnemies.length&&localEnemies.every(e=>!e.alive)){
   wave++;money+=500;const enemyPool=['m4','ak','mp9','m4','ak','mp9','m4','ak'];localEnemies=MAPS[mapId].enemies.slice(0,Math.min(8,3+wave)).map((p,i)=>({id:i+1,x:p[0],z:p[1],yaw:Math.PI,health:90+wave*10,alive:true,alert:0,fire:1.2+i*.25,walk:false,weapon:enemyPool[i%enemyPool.length]}));eventMessage(`ONDA ${wave} · +$500`);
  }
 }
 function disposeEnemyObject(obj){if(!obj)return;obj.traverse(n=>{n.geometry?.dispose?.();n.userData?.ownedTexture?.dispose?.();if(Array.isArray(n.material))n.material.forEach(m=>m?.dispose?.());else n.material?.dispose?.();});}
 function removeEnemyLOD(mesh){const lod=mesh?.userData?.lowDetail;if(lod){scene.remove(lod);disposeEnemyObject(lod);mesh.userData.lowDetail=null;}}
 function syncEnemies(dt){const seen=new Set();for(const e of localEnemies){if(!e.alive)continue;seen.add(e.id);let mesh=enemyMeshes.get(e.id);if(!mesh){mesh=createEnemy(T,e.weapon||'m4',{muzzleTexture:muzzleTex});scene.add(mesh);const low=createDistantEnemy(T,e.weapon||'m4');low.visible=false;scene.add(low);mesh.userData.lowDetail=low;enemyMeshes.set(e.id,mesh);}mesh.position.lerp(tmpV.set(e.x,0,e.z),Math.min(1,dt*12));mesh.rotation.y=e.yaw;const low=mesh.userData.lowDetail;if(low){
   low.position.copy(mesh.position);low.rotation.y=e.yaw;
   // Hysteresis prevents flickering and expensive detailed/low-detail swaps
   // when the player is close to the distance threshold.
   const distance=Math.hypot(e.x-player.x,e.z-player.z);
   const far=(mode==='multi'&&quality!=='ultra')?true:(mesh.userData.lowDetailActive?distance>7.4:distance>9.0);
   mesh.userData.lowDetailActive=far;mesh.visible=!far;low.visible=far;
  }
  mesh.userData.hitPulse=e.hitPulse||0;e.hitPulse=Math.max(0,(e.hitPulse||0)-dt);
  // Invisible detailed rigs do not need 60-90 individual limb updates.
  if(mesh.visible)animateEnemy(mesh,e.walk,dt);
   if(mode==='multi'&&e.walk){e.stepTimer=(e.stepTimer??.18)-dt;if(e.stepTimer<=0){e.stepTimer=.39+Math.random()*.06;playFootstepAt(e.x,e.z,{enemy:true});}}
  }for(const [id,obj] of enemyMeshes)if(!seen.has(id)){enemyMeshes.delete(id);removeEnemyLOD(obj);if(mode==='multi'){obj.visible=true;dyingEnemies.push({mesh:obj,life:.55});}else {scene.remove(obj);disposeEnemyObject(obj);}}}
 function move(dt){const down=name=>keys.has(binds[name]);const front=Number(down('forward'))-Number(down('back'));const side=Number(down('right'))-Number(down('left'));const running=false;player.crouch+=((down('crouch')?1:0)-player.crouch)*Math.min(1,dt*10);const knifeMove=player.weapon==='knife';const speed=player.crouch>.4?1.70:knifeMove?4.75:3.25;
  const wantsMove=Math.abs(front)+Math.abs(side)>0;
  const beforeX=player.x,beforeZ=player.z;
  const {dx,dz}=movementVector(player.yaw,front,side,speed,dt);
  // X/Z separately resolve wall sliding. Axes exactly follow camera yaw.
  if(!blocked(mapId,player.x+dx,player.z,.24))player.x+=dx;
  if(!blocked(mapId,player.x,player.z+dz,.24))player.z+=dz;
  player.moving=wantsMove && Math.hypot(player.x-beforeX,player.z-beforeZ)>.0001;
  gait=advanceGait(gait,dt,player.moving,running);
  if(player.jump>0||player.vy>0){player.vy-=12*dt;player.jump=Math.max(0,player.jump+player.vy*dt);if(player.jump===0)player.vy=0;}
  camera.position.set(player.x,player.height-.55*player.crouch+player.jump,player.z);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
  if(player.moving){footTimer-=dt;if(footTimer<=0&&player.jump===0){footTimer=player.crouch>.4?.52:knifeMove?.30:.39;if(player.crouch<.4)playFootstepAt(player.x,player.z,{knife:knifeMove});}}else footTimer=0;
 }
 function updateWeapon(dt){
  for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.time-=dt;t.line.material.opacity=.58*Math.max(0,t.time/.045);if(t.time<=0){scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();tracers.splice(i,1);}}
  for(let i=impactFx.length-1;i>=0;i--){const fx=impactFx[i];fx.life-=dt;fx.obj.material.opacity=Math.max(0,fx.life/fx.max);fx.obj.scale.setScalar(1+(1-fx.life/fx.max)*.35);if(fx.life<=0){scene.remove(fx.obj);fx.obj.geometry.dispose();fx.obj.material.dispose();impactFx.splice(i,1);}}
  tickCasings(dt);updateCrosshair(dt);viewSway=relaxSway(viewSway,dt);equipTimer=Math.max(0,equipTimer-dt);player.knifeDraw=Math.max(0,player.knifeDraw-dt);const equipBlend=equipDip(equipTimer,.27);damageAlpha=Math.max(0,damageAlpha-dt*1.8);el('damage-vignette').style.opacity=damageAlpha.toFixed(2);
  const wallState=getWeaponWallAvoid(player.weapon);const wallAvoid=wallState.avoid;
  for(const [id,gun] of gunViews){
   gun.root.visible=id===player.weapon;
   if(gun.armRig)gun.armRig.root.visible=id===player.weapon;
   if(gun.flashTimer>0){gun.flashTimer=Math.max(0,gun.flashTimer-dt);const on=gun.flashTimer>0;gun.flash.visible=on;if(gun.flashLight)gun.flashLight.visible=on&&quality==='ultra';if(gun.flashLight)gun.flashLight.intensity=(player.weapon==='pistol'?0.8:1.1)*(gun.flashTimer/.055);}
   else {if(gun.flash)gun.flash.visible=false;if(gun.flashLight)gun.flashLight.visible=false;}
   if(id!==player.weapon)continue;
   const walk=gait.motion;
   const cycle=Math.sin(gait.phase);
   const config=viewmodelPose(id);
   const inspectTime=player.inspect>0?1-player.inspect/player.inspectDuration:0;
   const reloadTime=player.reloading>0?1-player.reloading/player.reloadDuration:0;
   const pose=weaponPose(id,inspectTime,reloadTime,player.recoil);
   const ax=wallAvoid*(id==='knife'?.16:id==='pistol'?.20:.21);
   const ay=wallAvoid*(id==='knife'?.27:id==='pistol'?.31:.25);
   const az=wallState.retract;
   const nearWall=wallAvoid*wallAvoid;
   const shrink=1-nearWall*.08; // keep glove dimensions stable by a wall
   gun.root.scale.setScalar(config.scale*shrink);
   gun.root.position.set(config.x+viewOffset.x+walk*cycle*.008+ax+pose.x-viewSway.x*.26,
     config.y+viewOffset.y+walk*Math.abs(cycle)*.007-player.jump*.035-ay+pose.y-viewSway.y*.22-equipBlend*.17,
     config.z+viewOffset.z+az+pose.z+equipBlend*.045);
   gun.root.rotation.set(config.pitch+pose.pitch+wallAvoid*.16-viewSway.y*.48+equipBlend*.16,
     config.yaw+pose.yaw-wallAvoid*.10-viewSway.x*.62,
     config.roll+pose.roll-wallAvoid*(id==='knife'?.58:id==='pistol'?.42:.34)-viewSway.x*.22+equipBlend*.10);
   // Never hide the equipped weapon: disappearing guns were caused by wallState.hide.
   if(id==='knife'){
    const handleA=gun.movingParts?.handleA,handleB=gun.movingParts?.handleB;
    if(player.swing>0){const f=1-player.swing/.34;const slash=Math.sin(Math.PI*f);gun.root.position.x-=.13*slash;gun.root.position.y+=.05*slash;gun.root.rotation.z-=.56*slash;gun.root.rotation.x+=.32*slash;}
    if(handleA&&handleB){
      const drawing=player.knifeDraw>0;
      const drawProgress=drawing?1-player.knifeDraw/.55:1;
      const flip=butterflyMotion(inspectTime,drawProgress);
      handleA.rotation.x=flip.handleAX;
      handleB.rotation.x=flip.handleBX;
      handleA.rotation.y=flip.handleAY;
      handleB.rotation.y=flip.handleBY;
      gun.root.rotation.z+=flip.rootRoll;
      gun.root.rotation.y+=flip.rootYaw;
      gun.root.rotation.x+=flip.rootPitch;
      gun.root.position.y+=flip.lift;
      gun.root.position.x+=flip.shift;
    }
   }
   if(id==='pistol'){
     // Distinct P250 inspect: turn the slide outwards, check the chamber,
     // briefly retract the slide, and settle back into the ready position.
     const ease=v=>{const x=clamp(v,0,1);return x*x*(3-2*x);};
     const inspectActive=player.inspect>0;
     const hold=inspectActive?ease(inspectTime/.20)*(1-ease((inspectTime-.72)/.22)):0;
     const chamber=inspectActive?ease((inspectTime-.30)/.12)*(1-ease((inspectTime-.50)/.12)):0;
     gun.root.rotation.y+=.12*hold;
     gun.root.rotation.x-=.15*hold;
     gun.root.rotation.z-=.11*hold;
     gun.root.position.y+=.045*hold;
     gun.root.position.x-=.06*hold;
     if(gun.movingParts?.slide)gun.movingParts.slide.position.z=pose.slideKick+.095*chamber;
   }
   if(gun.magazine){gun.magazine.position.y=-pose.magDrop;gun.magazine.rotation.x=pose.magDrop*.5;}
   // The hands are gun-local; the forearms are camera-local, joined at the grip
   // every frame. Inspect, shooting and reloads cannot disconnect the wrists.
   gun.armRig?.update(camera,gun.root);
  }
  player.recoil*=Math.exp(-dt*22);
  if(player.recoil<.002)player.recoil=0;
  player.swing=Math.max(0,player.swing-dt);
  if(player.inspect>0)player.inspect=Math.max(0,player.inspect-dt);
  if(player.reloading>0){player.reloading=Math.max(0,player.reloading-dt);if(player.reloading===0){const w=weapons[player.weapon],needed=w.mag-player.ammo[player.weapon];player.ammo[player.weapon]+=needed;playActionSound();updateHUD();}}
  // Cadência independente dos FPS: preservar o tempo restante do último frame.
  shotTimer=advanceShotCooldown(shotTimer,dt);
  if(heldMouse&&document.pointerLockElement===canvas&&weapons[player.weapon].auto&&player.reloading===0&&player.ammo[player.weapon]>0){
   let burst=0;
   while(shotTimer<=0&&burst<3&&player.reloading===0){
    const before=shotTimer;
    shoot();burst++;
    if(shotTimer<=before)break;
   }
  }else shotTimer=Math.max(0,shotTimer);
  for(let i=dyingEnemies.length-1;i>=0;i--){const c=dyingEnemies[i];c.life-=dt;const t=Math.max(0,1-c.life/.55);c.mesh.rotation.z=-Math.min(Math.PI*.46,t*t*1.5);c.mesh.position.y=-.30*t;
   if(c.life<=0){scene.remove(c.mesh);disposeEnemyObject(c.mesh);dyingEnemies.splice(i,1);}}
 }
 function radar(){
  const c=el('radar'),g=c.getContext('2d'),grid=getGrid(mapId),s=c.width/SIZE;
  if(!radarBackdrop||radarBackdrop.map!==mapId||radarBackdrop.width!==c.width){
   const backing=document.createElement('canvas');backing.width=backing.height=c.width;
   const ctx=backing.getContext('2d');ctx.fillStyle='#07131a';ctx.fillRect(0,0,c.width,c.height);
   for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++)if(grid[z][x]){
    ctx.fillStyle=grid[z][x]===2?'#ac855b':'#607882';ctx.fillRect(x*s,z*s,s-.6,s-.6);
   }
   radarBackdrop={map:mapId,width:c.width,canvas:backing};
  }
  g.drawImage(radarBackdrop.canvas,0,0);
  for(const e of localEnemies)if(e.alive){g.fillStyle='#e97672';g.fillRect((e.x-.25)*s,(e.z-.25)*s,3.5,3.5);}
  for(const p of otherPlayers.values()){g.fillStyle='#83e8ef';g.beginPath();g.arc(p.x*s,p.z*s,3,0,Math.PI*2);g.fill();}
  g.save();g.translate(player.x*s,player.z*s);g.rotate(-player.yaw);g.fillStyle='#f7de90';g.beginPath();g.moveTo(0,-6);g.lineTo(4,4);g.lineTo(-4,4);g.closePath();g.fill();g.restore();
 }
 function updateOthers(dt){const renderTime=performance.now()-netBufferMs;for(const p of otherPlayers.values()){const pose=sampleRemote(p.samples,renderTime,65);if(!pose)continue;if((pose.x!==p.samples[p.samples.length-1]?.x||pose.z!==p.samples[p.samples.length-1]?.z)&&blocked(mapId,pose.x,pose.z,.23))continue;p.x=pose.x;p.z=pose.z;p.yaw=pose.yaw;p.jump=pose.jump;p.obj.position.set(p.x,p.jump,p.z);p.obj.rotation.y=p.yaw;animateEnemy(p.obj,pose.moving,dt);
   if(pose.moving){p.stepTimer=(p.stepTimer??.15)-dt;if(p.stepTimer<=0){p.stepTimer=.40;playFootstepAt(p.x,p.z,{enemy:true});}}
  }}
 function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
 window.addEventListener('resize',resize);resize();buildMap(selectedMap);getGun('m4');resetPlayer();camera.position.set(player.x,player.height,player.z);camera.rotation.set(0,player.yaw,0,'YXZ');spawnSolo();
 let last=performance.now();let runtimeCrashed=false;let hudClock=0,radarClock=0;
 let fpsCount=0,fpsStart=last,lastIdleRender=-Infinity;
 function loop(now){if(runtimeCrashed)return;try{const rawFrameMs=now-last;const dt=simulationDelta(rawFrameMs);last=now;elapsed+=dt;
  if(benchmark.active&&status==='playing'&&rawFrameMs>0&&rawFrameMs<1500&&now-benchmark.start>1000)benchmark.frameMs.push(rawFrameMs);
  if(status==='playing'){
   for(let remaining=dt;remaining>1e-6;){const step=Math.min(.04,remaining);move(step);remaining-=step;}
   if(mode==='solo')localAI(dt);else{netTimer+=dt;pingClock+=dt;if(pingClock>=2){pingClock=0;send({type:'PING',time:performance.now()});}if(netTimer>=(MAPS[mapId]?.pvp?.040:.050)){netTimer=0;send({type:'MOVE',x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch,jump:player.jump,weapon:player.weapon,moving:player.moving});}}
   updateWeapon(dt);syncEnemies(dt);updateOthers(dt);
   hudClock+=dt;radarClock+=dt;
   if(hudClock>.12){hudClock=0;updateHUD();}
   if(radarClock>(MAPS[mapId]?.pvp?.26:.18)){radarClock=0;radar();}
  }
  if(status==='playing'||now-lastIdleRender>=50){
    renderer.render(scene,camera);
    lastIdleRender=now;
    fpsCount++;
  }if(now-fpsStart>=1000){const fps=Math.round(fpsCount*1000/(now-fpsStart));el('fps-meter').textContent='FPS '+fps;fpsCount=0;fpsStart=now;
   if(benchmark.active){benchmark.samples.push(fps);if((performance.now()-benchmark.start)/1000>=benchmark.duration)finishBenchmark();}
   }
  requestAnimationFrame(loop);
 }catch(err){runtimeCrashed=true;console.error(err);ui.loading.innerHTML=`<strong>ERRO DURANTE O JOGO</strong><p>${err?.message||err}</p>`;ui.loading.style.display='grid';}}
 requestAnimationFrame(loop);
}
