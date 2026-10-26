// Weapon / enemy models tuned for viewmodel readability and closer visual consistency.
export function createWeapon(T,id,opts={}){
 const root=new T.Group(),movingParts={};
 const showArms=opts.viewArms!==false;
 const compactArms=opts.compactArms!==false;
 const mat=(color,metalness=0,roughness=.65)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const M={
  gun:mat(0x56636b,.62,.36),edge:mat(0xc8d1d5,.55,.28),dark:mat(0x20282d,.10,.76),black:mat(0x12171b,.18,.62),polymer:mat(0x343d42,.03,.86),
  olive:mat(0x272f34,.03,.89),cloth:mat(0x37454c,.02,.97),knuckle:mat(0x48585e,.03,.88),wood:mat(0x765132,.01,.58),woodHi:mat(0xa87748,.01,.48),
  barrel:mat(0x66747b,.70,.30),visor:mat(0x4a6876,.42,.22),rubber:mat(0x1e2327,.04,.94)
 };
 const sharedBox=new T.BoxGeometry(1,1,1);
 function addMesh(parent,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;}
 function box(parent,x,y,z,w,h,d,m){const o=addMesh(parent,sharedBox,m,x,y,z);o.scale.set(w,h,d);return o;}
 function tube(parent,x,y,z,r,len,m,sides=18,r2=r){const o=addMesh(parent,new T.CylinderGeometry(r2,r,len,sides),m,x,y,z);o.rotation.x=Math.PI/2;return o;}
 function rod(parent,ax,ay,az,bx,by,bz,r,m,sides=12){const d=new T.Vector3(bx-ax,by-ay,bz-az),o=addMesh(parent,new T.CylinderGeometry(r,r,d.length(),sides),m,(ax+bx)/2,(ay+by)/2,(az+bz)/2);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
 function shaped(parent,verts,depth,m){const shape=new T.Shape();for(let i=0;i<verts.length;i++){const [z,y]=verts[i];if(i===0)shape.moveTo(z,y);else shape.lineTo(z,y);}shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.008,bevelSize:.007,bevelSegments:1,steps:1,curveSegments:2});const mesh=addMesh(parent,geo,m,depth/2,0,0);mesh.rotation.y=-Math.PI/2;return mesh;}
 // Hands are attached to the gun. The sleeves are updated separately in camera space,
 // so an inspect/reload animation cannot pull the player's entire arm off the body.
 function glove(parent,x,y,z,side=1){
  const g=new T.Group();parent.add(g);g.position.set(x,y,z);
  g.rotation.z=side*.10;
  const palm=addMesh(g,new T.SphereGeometry(.074,12,9),M.olive,0,.008,0);
  palm.scale.set(1.00,.76,1.16);
  const knuckle=addMesh(g,new T.SphereGeometry(.074,12,8),M.knuckle,0,.038,-.037);
  knuckle.scale.set(1.02,.34,.59);
  // Four curled fingers resting around the firearm, rather than straight spikes.
  for(let k=0;k<4;k++){
    const fx=(k-1.5)*.031;
    rod(g,fx,.037,-.043,fx,-.010,-.091,.014,M.olive,8);
    const tip=addMesh(g,new T.SphereGeometry(.017,8,6),M.olive,fx,-.010,-.091);
    tip.scale.set(1,.85,1);
  }
  rod(g,side*.073,.002,.015,side*.100,-.035,-.031,.027,M.olive,8);
  const cuff=addMesh(g,new T.CylinderGeometry(.074,.082,.09,12),M.cloth,0,-.095,.064);
  cuff.rotation.x=-.33;
  return g;
 }
 function handAnchor(x,y,z,side=1){
  if(!showArms)return null;
  // Glove is attached at the exact socket used by the enemy's weapon model.
  return glove(root,x,y,z,side);
 }
 function rail(z0,z1,y=.19,w=.265){box(root,0,y,z0+(z1-z0)/2,w,.024,Math.abs(z1-z0),M.gun);for(let z=z0;z<z1;z+=.055)box(root,0,y+.019,z,w,.011,.027,M.edge);}
 const pistol=id==='pistol',knife=id==='knife',ak=id==='ak',smg=id==='mp9';
 if(knife){
  // Stainless balisong: real negative-space holes down the two machined handles,
  // inspired by the user's photographed silver butterfly knife.
  const satin=mat(0xc5cdd1,.81,.24),edge=mat(0xf3f6f7,.67,.23),
        cutout=mat(0x101416,.22,.68),screw=mat(0x86949c,.74,.25),
        bevel=mat(0x747f85,.65,.39),bladeMetal=mat(0xdce3e7,.84,.19);
  const blade=new T.Group();root.add(blade);
  // Blade tapers cleanly to a point; the grind bevel is separate and narrow.
  shaped(blade,[[.012,-.034],[-.24,.019],[-.56,.047],[-.92,-.031],[-.76,-.063],[-.31,-.075]],.047,bladeMetal);
  shaped(blade,[[-.23,-.014],[-.56,.024],[-.85,-.024],[-.60,-.054],[-.26,-.058]],.008,edge);
  box(root,0,-.023,.026,.077,.080,.122,bevel); // tang
  box(root,0,-.022,.090,.067,.071,.065,cutout);
  // Rounded extrusion profile and through-holes in the broad side of each handle.
  function perforatedHandle(side){
   const pivot=new T.Group();root.add(pivot);pivot.position.set(side*.042,-.020,.079);
   const sh=new T.Shape();
   sh.moveTo(-.035,-.045);sh.quadraticCurveTo(-.048,0,-.025,.050);
   sh.lineTo(.38,.050);sh.quadraticCurveTo(.425,.040,.425,0);
   sh.quadraticCurveTo(.425,-.050,.380,-.050);sh.lineTo(-.025,-.050);
   sh.quadraticCurveTo(-.035,-.050,-.035,-.045);
   for(let i=0;i<7;i++){
     const z=.072+i*.047, radius=(i===0||i===6)?.014:.018;
     const hole=new T.Path();hole.absarc(z,0,radius,0,Math.PI*2,false);
     sh.holes.push(hole);
   }
   const geo=new T.ExtrudeGeometry(sh,{depth:.033,steps:1,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,curveSegments:4});
   const plate=addMesh(pivot,geo,satin,-.0165,0,0);plate.rotation.y=-Math.PI/2;
   // Dark metal behind the cutouts is not filled: the background remains visible.
   box(pivot,0,-.048,.188,.038,.012,.35,bevel);
   box(pivot,0,.048,.188,.038,.011,.35,edge);
   for(const z of [.015,.395]){
     const screwHead=addMesh(pivot,new T.CylinderGeometry(.012,.012,.005,10),screw,side*.021,0,z);
     screwHead.rotation.z=Math.PI/2;
     box(pivot,side*.024,0,z,.003,.002,.016,cutout);
   }
   box(pivot,side*.017,0,.427,.024,.065,.029,bevel);
   return pivot;
  }
  movingParts.handleA=perforatedHandle(-1);
  movingParts.handleB=perforatedHandle(1);
  movingParts.handleA.rotation.y=.04;movingParts.handleB.rotation.y=-.04;
  for(const x of [-.048,.048]){
   const p=addMesh(root,new T.CylinderGeometry(.019,.019,.024,12),screw,x,-.020,.079);p.rotation.z=Math.PI/2;
  }
  movingParts.right=handAnchor(.064,-.140,.234,1);
  root.userData.gripSockets={right:new T.Vector3(.064,-.140,.234),left:new T.Vector3(-.04,-.020,.10)};
  return {root,magazine:null,movingParts,muzzleLocal:new T.Vector3(0,-.031,-.90)};
 }
 if(pistol){
  // V1.4.3 compact P250-style pistol. Main contours are bevelled EXTRUSIONS,
  // not a pile of intersecting cubes. The grip and trigger guard share a visual
  // silhouette; both hands meet at the same grip instead of floating apart.
  const slide=mat(0x58646b,.56,.38),slideTop=mat(0x929da4,.57,.29),
        edge=mat(0xb9c5ca,.58,.26),frame=mat(0x363e42,.12,.77),
        handle=mat(0x20282b,.03,.92),panelMat=mat(0x475257,.035,.87),
        deep=mat(0x13181b,.22,.60),hardware=mat(0x8a999f,.50,.32);
  const reciprocating=new T.Group();root.add(reciprocating);movingParts.slide=reciprocating;
  // Recognisable horizontal slide: pronounced rear shoulders and softened nose.
  shaped(reciprocating,[[.19,.120],[.14,.176],[-.25,.178],[-.58,.174],[-.74,.160],[-.81,.120],[-.850,.068],[-.842,.025],[-.81,.009],[.19,.009]],.159,slide);
  box(reciprocating,0,.178,-.330,.129,.012,.67,slideTop);
  box(reciprocating,0,.033,-.342,.172,.016,.93,deep);
  // Two ejection port edges show from the right side in the player's view.
  box(reciprocating,.087,.137,-.400,.006,.051,.196,deep);
  box(reciprocating,.092,.159,-.394,.003,.009,.161,edge);
  // Brighter slide chamfers and a distinct extractor to break up the dark block.
  for(const side of [-1,1]){
   box(reciprocating,side*.084,.162,-.375,.006,.010,.69,slideTop);
   box(reciprocating,side*.087,.046,-.427,.006,.008,.77,deep);
   box(reciprocating,side*.089,.123,-.53,.006,.030,.045,hardware);
  }
  // Machined bevel, ejection-port rim and inset markings visible from the side.
  for(const side of [-1,1]){
   box(reciprocating,side*.087,.151,-.355,.005,.014,.72,edge);
   box(reciprocating,side*.087,.072,-.364,.006,.014,.78,deep);
   box(reciprocating,side*.096,.106,-.47,.009,.033,.105,deep);
   box(reciprocating,side*.101,.135,-.466,.004,.008,.089,hardware);
   for(let k=0;k<3;k++)box(reciprocating,side*.094,.080,-.15-k*.033,.004,.008,.013,edge);
  }
  // Machined slide flank and stepped ejection port: real 3D depth, not a decal.
  for(const side of [-1,1]){
   box(reciprocating,side*.091,.089,-.395,.007,.008,.71,edge);
   box(reciprocating,side*.089,.154,-.392,.006,.006,.69,edge);
   // Six angled rear slide serrations make the back of the gun recognisable.
   for(let i=0;i<6;i++){
    const stripe=box(reciprocating,side*.096,.113,.106-i*.033,.004,.070,.010,deep);
    stripe.rotation.x=-.17;
   }
   // Forward milled ridge, slightly lighter than the slide side.
   box(reciprocating,side*.090,.095,-.676,.007,.012,.19,slideTop);
  }
  // Sights are compact, not floating posts.
  box(reciprocating,0,.201,-.783,.041,.027,.029,deep);
  box(reciprocating,0,.204,.122,.072,.029,.030,deep);
  box(reciprocating,0,.225,-.783,.012,.006,.009,edge);
  for(const side of [-1,1]){
   for(let i=0;i<7;i++)box(reciprocating,side*.085,.115,.132-i*.027,.005,.052,.010,deep);
   for(let i=0;i<5;i++)box(reciprocating,side*.085,.106,-.607-i*.029,.005,.040,.010,deep);
  }
  // Recessed concentric muzzle prevents the barrel sticking out like a tube.
  tube(root,0,.065,-.785,.034,.132,deep,18);
  tube(root,0,.065,-.851,.026,.017,hardware,18);
  tube(root,0,.065,-.859,.020,.008,deep,18);
  // One continuous frame including the trigger arch and beavertail.
  shaped(root,[[.21,.020],[-.36,.016],[-.691,.016],[-.747,-.026],[-.694,-.092],[-.36,-.122],[-.16,-.125],[-.110,-.206],[.008,-.210],[.090,-.142],[.144,-.076]],.140,frame);
  box(root,0,-.064,-.460,.136,.073,.340,frame);
  // Continuous rear tang / frame-to-grip shoulder. The old P250 had an obvious
  // dark triangular break between the slide and the grip in first-person screenshots.
  shaped(root,[[.205,.018],[.260,-.070],[.286,-.145],[.257,-.258],[.149,-.301],[.067,-.232],[.070,-.098]],.142,frame);
  box(root,0,-.177,.127,.125,.10,.124,frame);
  // Side panel highlights make the small grip legible at night, without bloom.
  box(root,.076,-.168,.144,.007,.062,.103,handle);
  box(root,-.076,-.168,.144,.007,.062,.103,handle);
  for(let i=0;i<3;i++)box(root,0,-.108,-.606+i*.057,.093,.008,.023,deep);
  // Visible lower-frame rail and beavertail prevent a monolithic black silhouette.
  for(const side of [-1,1]){
   box(root,side*.077,-.020,-.47,.007,.012,.39,slideTop);
   box(root,side*.085,-.165,.150,.008,.014,.072,edge);
   box(root,side*.084,-.49,.227,.009,.045,.080,deep);
  }
  // Trigger guard is a smooth four-sided loop with an actual hole.
  const guardPath=[[.022,-.124],[-.175,-.129],[-.241,-.172],[-.239,-.248],[-.162,-.268],[-.021,-.259],[.025,-.193]];
  for(let i=0;i<guardPath.length-1;i++){
    const [az,ay]=guardPath[i], [bz,by]=guardPath[i+1];
    rod(root,-.012,ay,az,-.012,by,bz,.014,frame,10);
  }
  rod(root,-.012,-.123,-.140,-.012,-.207,-.150,.010,hardware,10);
  // Little exposed hammer, pin and sculpted beavertail improve recognition.
  box(root,0,.027,.200,.082,.045,.058,deep);
  box(root,.086,-.076,.095,.011,.014,.060,hardware);
  shaped(root,[[.140,-.072],[.202,-.069],[.259,-.144],[.234,-.181],[.148,-.136]],.148,frame);
  // Anatomical grip rake. Separate inset side panels add depth without spikes.
  shaped(root,[[.195,-.077],[.256,-.153],[.319,-.430],[.303,-.572],[.193,-.668],[.086,-.637],[-.018,-.273]],.146,handle);
  for(const side of [-1,1]){
    const p=shaped(root,[[.163,-.194],[.228,-.211],[.286,-.434],[.272,-.546],[.192,-.613],[.104,-.572],[.056,-.288]],.006,panelMat);
    p.position.x=side*.082;
    for(let j=0;j<8;j++){
      const y=-.270-j*.038,z=.154+j*.016;
      box(root,side*.087,y,z,.003,.007,.050,deep);
    }
  }
  box(root,-.083,-.117,.013,.012,.025,.052,hardware); // safety / control
  box(root,.082,-.161,.090,.011,.032,.055,hardware); // release button
  box(root,-.080,-.054,-.299,.009,.016,.084,deep); // takedown catch
  const magazine=new T.Group();root.add(magazine);movingParts.mag=magazine;
  box(magazine,0,-.552,.219,.110,.159,.104,deep);
  box(magazine,0,-.649,.226,.143,.032,.120,hardware);
  movingParts.right=handAnchor(.094,-.370,.190,1);
  movingParts.left=handAnchor(-.074,-.396,.194,-1);
  root.userData.gripSockets={right:new T.Vector3(.090,-.372,.183),left:new T.Vector3(-.080,-.398,.188)};
  return {root,magazine,movingParts,muzzleLocal:new T.Vector3(0,.065,-.867)};
 }

 const end=pistol?-.28:smg?-.69:ak?-1.12:-1.16;
 shaped(root,pistol?[[.14,-.067],[.18,.082],[-.04,.086],[-.25,.078],[-.32,-.001],[-.20,-.12]]:[[.24,-.082],[.21,.115],[-.05,.15],[-.27,.155],[-.44,.10],[end*.65,.08],[end*.66,-.11],[-.34,-.15]],pistol?.21:.29,M.gun);
 box(root,0,pistol?.085:.158,pistol?-.045:-.18,pistol?.205:.286,.047,pistol?.39:.53,M.edge);
 box(root,0,pistol?.117:.195,pistol?-.048:-.19,pistol?.19:.285,.035,pistol?.42:.48,M.black);
 if(!pistol){
  box(root,-.153,-.022,-.15,.010,.036,.23,M.black);box(root,-.163,-.018,-.095,.007,.008,.09,M.edge);
  for(const z of [-.38,-.09,.09]){const pin=addMesh(root,new T.SphereGeometry(.013,8,6),M.edge,-.154,-.09,z);pin.scale.set(.35,1,1);}box(root,-.151,-.155,.014,.007,.015,.10,M.polymer);
 }
 if(pistol){
  // Less toy-like P250 style pistol.
  tube(root,0,.010,-.31,.041,.17,M.barrel); // barrel
  box(root,0,.16,-.17,.13,.055,.19,M.black); // rear slide block
  box(root,0,.18,.06,.11,.042,.19,M.dark); // front slide taper block
  box(root,-.106,.032,-.14,.012,.018,.078,M.black);box(root,-.108,.040,-.14,.010,.007,.045,M.edge);
  shaped(root,[[.07,-.10],[.12,-.16],[.16,-.46],[.10,-.57],[-.04,-.24]],.12,M.polymer); // grip
  box(root,0,-.15,-.035,.105,.20,.135,M.rubber);
  rod(root,-.03,-.03,-.02,.03,-.03,-.02,.008,M.edge); // trigger
  shaped(root,[[-.02,.03],[-.12,.02],[-.16,-.05],[-.07,-.10],[.01,-.07]],.01,M.edge); // trigger guard
  box(root,0,.24,-.26,.032,.03,.03,M.edge);box(root,0,.23,.12,.028,.025,.028,M.edge); // sights
  movingParts.right=handAnchor(.10,-.33,.07,1);
  root.scale.setScalar(.60);root.position.set(.34,-.31,-.84);root.rotation.y=-.09;
  return {root,magazine:null,movingParts,muzzleLocal:new T.Vector3(0,.02,-.42)};
 }else{
  const front=smg?-.86:ak?-1.34:-1.49;
  box(root,0,.020,(front-.47)/2,smg?.21:.255,.21,Math.abs(front+.47),ak?M.wood:M.gun);
  box(root,0,.117,(front-.47)/2,smg?.19:.23,.038,Math.abs(front+.47),ak?M.woodHi:M.edge);
  if(!ak){for(const side of [-1,1])for(let i=0;i<7;i++){const zz=front+.15+i*(Math.abs(front+.47)-.15)/7;box(root,side*(smg?.109:.128),.025,zz,.012,.05,.063,M.black);}}
  else {for(let i=0;i<6;i++){const zz=front+.10+i*.115;box(root,-.132,-.013,zz,.012,.018,.052,M.woodHi);}}
  tube(root,0,.016,front-.20,.039,.52,M.barrel);
  if(!smg){tube(root,0,.016,front-.46,ak?.058:.069,ak?.19:.36,ak?M.gun:M.black); if(!ak)tube(root,0,.016,front-.63,.074,.021,M.edge);}
  rail(front+.13,-.35,ak?.16:.19,ak?.17:.25);
  if(ak){for(let j=0;j<7;j++)box(root,.132,.107,front+.22+j*.099,.007,.010,.044,M.woodHi);tube(root,0,.08,front+.20,.032,.36,M.gun,12);box(root,0,.19,front+.06,.06,.12,.06,M.black);}else{for(let j=0;j<9;j++){const zz=front+.20+j*(Math.abs(front+.47)-.22)/9;box(root,0,.151,zz,.185,.009,.034,M.dark);}}
  box(root,-.15,.022,-.15,.012,.07,.21,M.black); box(root,-.16,.047,-.15,.006,.035,.145,M.edge);
  if(!ak && !smg){box(root,0,.24,-.27,.13,.055,.14,M.black); tube(root,0,.29,-.28,.074,.165,M.black); tube(root,0,.29,-.375,.084,.017,M.edge); tube(root,0,.29,-.387,.051,.011,M.visor);}else if(smg){box(root,0,.198,-.31,.095,.037,.095,M.black);box(root,0,.228,-.32,.06,.048,.022,M.edge);}else {box(root,0,.21,-.22,.13,.045,.12,M.black); box(root,0,.235,front+.22,.025,.1,.045,M.gun);}
  if(!smg){tube(root,0,.015,.23,.06,ak?.36:.47,M.barrel);if(ak){shaped(root,[[.32,.075],[.78,.10],[.92,-.04],[.80,-.17],[.32,-.13]],.22,M.wood);box(root,0,-.06,.88,.25,.27,.048,M.dark);}else{box(root,0,.018,.58,.20,.20,.31,M.polymer);shaped(root,[[.48,.10],[.86,.10],[.94,-.06],[.90,-.29],[.75,-.29],[.70,-.11],[.48,-.08]],.26,M.dark);box(root,0,-.078,.94,.30,.35,.045,M.black);}}
  else {rod(root,-.12,-.07,.19,-.20,-.08,.64,.019,M.barrel);rod(root,.12,-.07,.19,.20,-.08,.64,.019,M.barrel);box(root,0,-.08,.64,.32,.19,.053,M.dark);}
 }
 // Weapon-specific profile accents: clearer identification even at low quality.
 if(ak){
  const akWood=mat(0x94633a,.02,.60),akHighlight=mat(0xbd8856,.05,.50);
  box(root,0,.015,-.98,.267,.197,.54,akWood);
  for(const side of [-1,1])for(let i=0;i<3;i++){
   box(root,side*.137,.044,-.99+i*.13,.009,.016,.086,akHighlight);
  }
  // Classic slanted muzzle brake and distinctive receiver cover.
  box(root,0,.171,-.15,.232,.055,.43,M.black);
  tube(root,0,.013,-1.86,.058,.115,M.gun,12);
 }else if(smg){
  // MP9: short vertical foregrip, compact angular upper and skeleton stock.
  box(root,0,-.24,-.75,.082,.32,.095,M.polymer);
  box(root,0,-.38,-.75,.099,.065,.10,M.black);
  box(root,0,.17,-.72,.175,.068,.29,M.polymer);
  for(const side of [-1,1])rod(root,side*.12,-.04,.20,side*.21,-.07,.58,.010,M.barrel,8);
 }else{
  // M4A1-S: telescoping stock, pronounced top optic housing and suppressor.
  box(root,0,.065,.77,.27,.23,.15,M.polymer);
  box(root,0,-.09,.72,.27,.11,.20,M.black);
  box(root,0,.22,-.45,.19,.025,.38,M.black);
  for(let i=0;i<5;i++)box(root,0,.239,-.60+i*.073,.168,.008,.034,M.edge);
 }
 shaped(root,[[.09,-.115],[.15,-.16],[.19,-.43],[.12,-.52],[-.035,-.25]],.13,M.polymer);
 rod(root,-.065,-.19,.09,-.065,-.30,-.055,.014,M.edge);rod(root,-.065,-.30,-.055,-.065,-.19,-.17,.014,M.edge);
 const mag=new T.Group();root.add(mag);movingParts.mag=mag;
 if(ak){shaped(mag,[[-.24,-.19],[-.04,-.22],[-.11,-.51],[-.25,-.63],[-.40,-.60],[-.34,-.41]],.22,M.black);box(mag,0,-.62,-.33,.23,.045,.18,M.gun);}
 else {shaped(mag,[[-.35,-.18],[-.15,-.18],[-.14,-.61],[-.31,-.64]],smg?.15:.20,M.dark); for(let i=0;i<5;i++)box(mag,-.106,-.28-i*.065,-.245,.009,.012,.11,M.edge);}
 box(root,-.115,-.27,.075,.007,.07,.035,M.black);box(root,-.119,-.214,.032,.010,.025,.042,M.edge);
 movingParts.right=handAnchor(.11,-.31,.10,1); if(!pistol)movingParts.left=handAnchor(-.12,-.14,smg?-.55:ak?-.82:-.90,-1);
 root.scale.setScalar(smg?.64:ak?.66:.66);root.position.set(.35,-.35,smg?-1.02:ak?-1.16:-1.14);root.rotation.y=-.16;
 if(smg)root.rotation.y=-.14;
 root.userData.gripSockets={right:new T.Vector3(.11,-.31,.10),left:new T.Vector3(-.12,-.14,smg?-.55:ak?-.82:-.90)};
 const muzzleLocal=new T.Vector3(0,.02,smg?-1.02:ak?-1.42:-1.54);
 return {root,magazine:mag,movingParts,muzzleLocal};
}

// Camera-relative first-person arms: gun/glove follow recoil or inspect, but the
// sleeves still lead back to the player. No skinned meshes or per-frame geometry
// allocations are needed; only segment transforms are changed each frame.
export function createViewArmRig(T,weaponId){
 // V1.4.9: articulated cloth sleeves with a tapered, faceted profile. The old
 // uniform-radius tubes made the forearms look like two floating rubber pipes.
 // Grip points are still resolved every frame from the actual weapon sockets.
 const root=new T.Group();
 const oneHand=weaponId==='knife';
 const cuffMat=new T.MeshStandardMaterial({color:0x1d2529,metalness:.02,roughness:.91});
 const elbowMat=new T.MeshStandardMaterial({color:0x333c41,metalness:.015,roughness:.98});
 const wrinkleMat=new T.MeshStandardMaterial({color:0x535d62,metalness:.02,roughness:.91,transparent:true,opacity:.68});
 const sleeveMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:.018,side:T.FrontSide});
 const axisY=new T.Vector3(0,1,0);
 function sleeveGeometry(){
  const radial=12;
  const rings=[[-.5,.76,1],[-.36,.84,.95],[-.23,.90,1.02],[0,.96,.96],[.24,1.01,1.03],[.39,1.09,1],[.5,1.12,1.02]];
  const positions=[],colors=[],indices=[];
  for(let j=0;j<rings.length;j++){
   const [y,rx,rz]=rings[j];
   for(let i=0;i<=radial;i++){
    const a=Math.PI*2*i/radial;
    const fold=1+.038*Math.sin(i*2.3+j*1.8);
    positions.push(Math.cos(a)*rx*fold,y,Math.sin(a)*rz*fold);
    const shade=.82+.10*Math.max(0,Math.cos(a+.4))+.035*Math.sin(a*3.0+j);
    colors.push(.038*shade,.048*shade,.055*shade);
    if(i<radial&&j<rings.length-1){
     const k=j*(radial+1)+i, next=k+radial+1;
     indices.push(k,next,k+1,k+1,next,next+1);
    }
   }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
 }
 const sharedSleeve=sleeveGeometry();
 const sharedCuff=new T.CylinderGeometry(.95,.85,1,12,1);
 const sharedElbow=new T.SphereGeometry(1,12,9);
 const sharedWrinkle=new T.TorusGeometry(1,.018,4,12,Math.PI*1.4);
 const makeMesh=(geo,mat)=>{const m=new T.Mesh(geo,mat);m.frustumCulled=false;root.add(m);return m;};
 const arms=[];
 for(const side of (oneHand?[1]:[-1,1])){
  const forearm=makeMesh(sharedSleeve,sleeveMat);
  const upper=makeMesh(sharedSleeve,sleeveMat);
  const wristCuff=makeMesh(sharedCuff,cuffMat);
  const elbow=makeMesh(sharedElbow,elbowMat);
  const shoulder=makeMesh(sharedElbow,elbowMat);
  const wrinkle=makeMesh(sharedWrinkle,wrinkleMat);
  arms.push({side,forearm,upper,wristCuff,elbow,shoulder,wrinkle});
 }
 // At the bottom/outside the camera, under the visible part of the sleeve.
 const anchors={[-1]:new T.Vector3(-.57,-1.74,.32),[1]:new T.Vector3(.65,-1.76,.36)};
 const wrist=new T.Vector3(),elbowPoint=new T.Vector3(),diff=new T.Vector3(),cuffEnd=new T.Vector3(),cuffStart=new T.Vector3();
 const connect=(part,a,b,radius,thickness=1)=>{
  diff.subVectors(b,a);const len=diff.length();
  part.position.copy(a).addScaledVector(diff,.5);
  part.quaternion.setFromUnitVectors(axisY,diff.multiplyScalar(1/Math.max(.0001,len)));
  part.scale.set(radius,len,radius*thickness);
 };
 function update(camera,viewRoot){
  camera.updateMatrixWorld(true);
  const sockets=viewRoot.userData.gripSockets;
  if(!sockets)return;
  for(const arm of arms){
   wrist.copy(sockets[arm.side<0?'left':'right']);
   viewRoot.localToWorld(wrist);camera.worldToLocal(wrist);
   const shoulder=anchors[arm.side];
   elbowPoint.copy(wrist).lerp(shoulder,.54);
   elbowPoint.x+=arm.side*.11;
   elbowPoint.y-=.035;
   elbowPoint.z+=.030;
   connect(arm.forearm,wrist,elbowPoint,.113,.91);
   connect(arm.upper,elbowPoint,shoulder,.133,.91);
   cuffEnd.copy(wrist).lerp(elbowPoint,.14);
   connect(arm.wristCuff,wrist,cuffEnd,.114,.91);
   arm.elbow.position.copy(elbowPoint);
   arm.elbow.scale.set(.104,.092,.090);
   arm.shoulder.position.copy(shoulder);
   arm.shoulder.scale.set(.122,.128,.118);
   // A subtle fold near the elbow follows the sleeve, not the camera.
   arm.wrinkle.position.copy(elbowPoint).lerp(wrist,.15);
   arm.wrinkle.quaternion.copy(arm.forearm.quaternion);
   arm.wrinkle.scale.set(.105,.080,.101);
   arm.wrinkle.rotateZ(arm.side*.20);
  }
 }
 return {root,arms,update};
}

export function createEnemy(T,weaponId='m4',opts={}){
 const root=new T.Group();
 const mat=(color,roughness=.82,metalness=.02)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const m={uniform:mat(0x526956),sleeve:mat(0x3d5145),vest:mat(0x252e32,.86),plate:mat(0x415158,.65,.13),helmet:mat(0x2a3837,.65),visor:mat(0x182c32,.27,.17),skin:mat(0x9d8068),glove:mat(0x627369),boot:mat(0x171f22)};
 const cube=new T.BoxGeometry(1,1,1),round=new T.SphereGeometry(1,12,9);
 function box(parent,x,y,z,w,h,d,material){const q=new T.Mesh(cube,material);q.position.set(x,y,z);q.scale.set(w,h,d);parent.add(q);return q;}
 function ball(parent,x,y,z,rx,ry,rz,material){const q=new T.Mesh(round,material);q.position.set(x,y,z);q.scale.set(rx,ry,rz);parent.add(q);return q;}
 function segment(parent,from,to,r1,r2,material){const a=new T.Vector3(...from),b=new T.Vector3(...to),dir=b.clone().sub(a);const q=new T.Mesh(new T.CylinderGeometry(r1,r2,dir.length(),9),material);q.position.copy(a.add(b).multiplyScalar(.5));q.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());parent.add(q);return q;}
 box(root,0,.95,0,.46,.24,.28,m.uniform);box(root,0,1.31,0,.53,.63,.31,m.uniform);box(root,0,1.30,-.182,.48,.52,.115,m.vest);box(root,0,1.30,-.244,.26,.25,.025,m.plate);
 for(const s of [-1,1])box(root,s*.202,1.31,-.253,.047,.45,.025,m.uniform);
 ball(root,0,1.86,-.015,.20,.21,.20,m.skin);ball(root,0,1.99,.025,.245,.15,.235,m.helmet);box(root,0,1.865,-.193,.31,.085,.033,m.visor);box(root,0,1.79,-.18,.30,.085,.055,m.vest);
 const legs=[];for(const s of [-1,1]){const leg=new T.Group();leg.position.set(s*.145,.91,.035);root.add(leg);box(leg,0,-.235,0,.205,.50,.235,m.sleeve);ball(leg,0,-.49,0,.103,.115,.12,m.uniform);box(leg,0,-.645,0,.18,.29,.21,m.uniform);box(leg,0,-.81,-.093,.235,.14,.33,m.boot);legs.push(leg);} 
 // The right hand is the anchor, rather than the middle of the enemy's chest.
 // Child gun geometry is offset by its actual grip socket so the handle coincides
 // with this mount when the enemy turns or walks.
 const rightHandWeaponMount=new T.Group();root.add(rightHandWeaponMount);
 rightHandWeaponMount.position.set(.135,1.40,-.435);
 const held=createWeapon(T,weaponId,{viewArms:false});
 const rightGrip=held.root.userData.gripSockets.right;
 const leftGrip=held.root.userData.gripSockets.left;
 const scale=weaponId==='pistol'?.60:weaponId==='knife'?.62:weaponId==='mp9'?.49:.48;
 held.root.scale.setScalar(scale);
 held.root.rotation.set(0,0,0);
 held.root.position.copy(rightGrip).multiplyScalar(-scale);
 rightHandWeaponMount.add(held.root);
 // Multiplayer and solo muzzle flash: attached to the actual muzzle, not the chest.
 let muzzleFlash=null;
 if(opts.muzzleTexture && weaponId!=='knife'){
  muzzleFlash=new T.Sprite(new T.SpriteMaterial({map:opts.muzzleTexture,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  muzzleFlash.position.copy(held.muzzleLocal);
  muzzleFlash.scale.set(.36,.36,1);
  muzzleFlash.visible=false;
  held.root.add(muzzleFlash);
 }
 const actualRight=new T.Vector3(...rightHandWeaponMount.position.toArray());
 const actualLeft=new T.Vector3(
   actualRight.x+(leftGrip.x-rightGrip.x)*scale,
   actualRight.y+(leftGrip.y-rightGrip.y)*scale,
   actualRight.z+(leftGrip.z-rightGrip.z)*scale
 );
 // Arms form uninterrupted chains from the shoulders to the weapon sockets.
 const arms=[];
 function attachedArm(shoulder,elbow,wrist){
   // Rotate about each shoulder rather than the root, so arms never detach from torso.
   const group=new T.Group();root.add(group);group.position.set(...shoulder);
   const rel=point=>point.map((v,i)=>v-shoulder[i]);
   const elbowLocal=rel(elbow),wristLocal=rel(wrist.toArray());
   ball(group,0,0,0,.113,.132,.13,m.uniform);
   segment(group,[0,0,0],elbowLocal,.103,.094,m.uniform);
   ball(group,...elbowLocal,.087,.088,.091,m.uniform);
   segment(group,elbowLocal,wristLocal,.086,.077,m.sleeve);
   ball(group,...wristLocal,.076,.068,.092,m.glove);
   arms.push(group);
 }
 attachedArm([-.30,1.51,-.025],[-.35,1.30,-.43],actualLeft);
 attachedArm([.30,1.51,-.025],[.385,1.27,-.22],actualRight);
 for(const sign of [-1,1])box(root,sign*.26,.97,-.02,.1,.17,.18,m.vest);
 root.userData={arms,legs,rifle:rightHandWeaponMount,phase:0,weaponId,gun:held.root,muzzleFlash,firePulse:0,gripMount:rightHandWeaponMount,gripPosition:actualRight,leftHandPosition:actualLeft};
 return root;
}

// An independent, easily identifiable BLUE teammate model. Unlike enemies this
// character wears a peaked helmet, a blue jacket, cyan patches and a backpack.
export function createTeammate(T,weaponId='m4',opts={}){
 const root=new T.Group(),m={};
 const material=(color,metalness=0)=>new T.MeshStandardMaterial({color,roughness:.75,metalness});
 m.jacket=material(0x246b94);m.sleeve=material(0x194f73);m.dark=material(0x162b3e);
 m.vest=material(0x254454);m.accent=material(0x3ce0e9,.15);m.helmet=material(0x174a71);
 m.face=material(0xc29b7d);m.glove=material(0x2b3846);m.boot=material(0x15222a);
 const cube=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,10,8);
 function box(parent,x,y,z,w,h,d,mat){const o=new T.Mesh(cube,mat);o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);return o;}
 function ball(parent,x,y,z,sx,sy,sz,mat){const o=new T.Mesh(sphere,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
 function limb(parent,from,to,r,mat){const a=new T.Vector3(...from),b=new T.Vector3(...to),d=b.clone().sub(a);const o=new T.Mesh(new T.CylinderGeometry(r,r*.9,d.length(),9),mat);o.position.copy(a.add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());parent.add(o);return o;}
 // Distinct silhouette: lighter athletic jacket, smaller plate carrier and pack.
 box(root,0,1.28,0,.49,.66,.31,m.jacket);box(root,0,1.28,-.187,.43,.48,.095,m.vest);
 box(root,0,1.42,-.24,.32,.095,.034,m.accent);
 box(root,0,1.10,.23,.41,.52,.17,m.dark); // equipment pack
 box(root,0,.95,0,.47,.17,.29,m.dark);
 for(const s of [-1,1]){
  box(root,s*.246,1.40,-.09,.073,.25,.26,m.accent);
  box(root,s*.16,1.00,-.27,.11,.11,.075,m.vest);
 }
 ball(root,0,1.80,0,.182,.19,.17,m.face);
 ball(root,0,1.96,.02,.222,.11,.21,m.helmet);
 box(root,0,1.91,-.165,.43,.035,.18,m.helmet); // cap visor: not enemy helmet
 box(root,0,1.80,-.162,.23,.072,.032,m.dark);
 const legs=[];
 for(const s of [-1,1]){const leg=new T.Group();leg.position.set(s*.141,.91,.035);root.add(leg);
  box(leg,0,-.24,0,.195,.49,.22,m.dark);box(leg,0,-.50,-.02,.19,.11,.24,m.accent);
  box(leg,0,-.66,0,.175,.32,.205,m.sleeve);box(leg,0,-.83,-.10,.235,.15,.32,m.boot);
  legs.push(leg);
 }
 const weaponMount=new T.Group();root.add(weaponMount);weaponMount.position.set(.135,1.40,-.435);
 const held=createWeapon(T,weaponId,{viewArms:false});
 const rightGrip=held.root.userData.gripSockets.right,leftGrip=held.root.userData.gripSockets.left;
 const scale=weaponId==='pistol'?.60:weaponId==='knife'?.62:weaponId==='mp9'?.49:.48;
 held.root.scale.setScalar(scale);held.root.rotation.set(0,0,0);held.root.position.copy(rightGrip).multiplyScalar(-scale);
 weaponMount.add(held.root);
 let muzzleFlash=null;
 if(opts.muzzleTexture&&weaponId!=='knife'){
  muzzleFlash=new T.Sprite(new T.SpriteMaterial({map:opts.muzzleTexture,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  muzzleFlash.position.copy(held.muzzleLocal);muzzleFlash.scale.set(.36,.36,1);muzzleFlash.visible=false;held.root.add(muzzleFlash);
 }
 const rightHand=weaponMount.position.clone();const leftHand=rightHand.clone().add(leftGrip.clone().sub(rightGrip).multiplyScalar(scale));
 const arms=[];
 function arm(s,elbow,wrist){const shoulder=[s*.31,1.51,-.02],g=new T.Group();g.position.set(...shoulder);root.add(g);
  const rel=v=>[v[0]-shoulder[0],v[1]-shoulder[1],v[2]-shoulder[2]];
  const e=rel(elbow),w=rel(wrist.toArray());
  ball(g,0,0,0,.105,.12,.11,m.jacket);limb(g,[0,0,0],e,.09,m.sleeve);ball(g,...e,.085,.085,.085,m.jacket);
  limb(g,e,w,.07,m.sleeve);ball(g,...w,.07,.06,.085,m.glove);arms.push(g);
 }
 arm(-1,[-.31,1.32,-.32],leftHand);arm(1,[.34,1.28,-.29],rightHand);
 // High-contrast ally marker above the cap. Deliberately not visible through walls.
 const tag=new T.Group();tag.position.set(0,2.35,0);root.add(tag);
 box(tag,0,.0,0,.35,.07,.04,m.accent);
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');
  ctx.fillStyle='#0b3047';ctx.fillRect(0,0,256,64);ctx.strokeStyle='#3ce0e9';ctx.lineWidth=4;ctx.strokeRect(2,2,252,60);
  ctx.fillStyle='#e9ffff';ctx.font='bold 34px Arial';ctx.textAlign='center';ctx.fillText('ALIADO',128,44);
  const tex=new T.CanvasTexture(c);const label=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthTest:true,depthWrite:false}));
  label.position.set(0,.22,0);label.scale.set(.77,.19,1);label.userData.ownedTexture=tex;tag.add(label);
 }
 root.userData={arms,legs,rifle:weaponMount,phase:0,weaponId,gun:held.root,muzzleFlash,firePulse:0,teammate:true,gripMount:weaponMount};
 return root;
}

export function animateEnemy(obj,walking,dt){
 if(!obj)return;
 const state=obj.userData;
 if(state.arenaFighter){state.phase+=dt*(walking?8:1.1);state.firePulse=Math.max(0,(state.firePulse||0)-dt);state.rifle.rotation.x=state.firePulse>0?.14:0;state.rifle.position.y=1.33+(walking?.017*Math.sin(state.phase):0);return;}
 state.phase+=dt*(walking?8:1.4);
 state.firePulse=Math.max(0,(state.firePulse||0)-dt);
 if(state.muzzleFlash){state.muzzleFlash.visible=state.firePulse>0;state.muzzleFlash.material.rotation=state.phase*2;}
 const stride=walking?Math.sin(state.phase)*.44:0;
 const hit=Math.max(0,Math.min(1,(state.hitPulse||0)/.28));
 const sway=walking?.026*Math.sin(state.phase):.006*Math.sin(state.phase);
 const breathing=walking?.012*Math.sin(state.phase*2):.008*Math.sin(state.phase*.55);
 state.legs[0].rotation.x=stride;
 state.legs[1].rotation.x=-stride;
 state.arms[0].rotation.x=sway-hit*.07-breathing*.45;
 state.arms[1].rotation.x=-sway-hit*.06-breathing*.35;
 state.arms[0].rotation.z=.018*Math.sin(state.phase)+hit*.028;
 state.arms[1].rotation.z=-.018*Math.sin(state.phase)-hit*.024;
 state.rifle.position.y=1.40+(walking?.012*Math.sin(state.phase*2):0)-hit*.018;
 state.rifle.position.z=-.435+(walking?.01*Math.sin(state.phase):0);
 state.rifle.rotation.x=.015+breathing*.6-hit*.06+(state.firePulse>0?.13:0);
 state.rifle.rotation.z=.015*Math.sin(state.phase*.5)-hit*.05;
 obj.rotation.z=hit*.12;
}

// Lightweight distant enemy LOD: only 13 meshes instead of the detailed 60-90
// piece character+gun model. Rendered when far away; full rig returns nearby.
export function createDistantEnemy(T,weaponId='m4'){
 const root=new T.Group();
 const uniform=new T.MeshStandardMaterial({color:0x526956,roughness:.85});
 const plate=new T.MeshStandardMaterial({color:0x26383b,roughness:.8});
 const gloves=new T.MeshStandardMaterial({color:0x394d45,roughness:.9});
 const gun=new T.MeshStandardMaterial({color:0x20272b,roughness:.62,metalness:.18});
 const skin=new T.MeshStandardMaterial({color:0xa0836c,roughness:.92});
 const cube=new T.BoxGeometry(1,1,1);
 const sphere=new T.SphereGeometry(1,8,6);
 function b(x,y,z,w,h,d,mat){const o=new T.Mesh(cube,mat);o.position.set(x,y,z);o.scale.set(w,h,d);root.add(o);return o;}
 function s(x,y,z,w,h,d,mat){const o=new T.Mesh(sphere,mat);o.position.set(x,y,z);o.scale.set(w,h,d);root.add(o);return o;}
 b(0,1.30,0,.47,.64,.31,uniform);b(0,1.28,-.19,.43,.55,.13,plate);
 b(-.15,.59,0,.20,1.02,.22,uniform);b(.15,.59,0,.20,1.02,.22,uniform);
 b(-.15,.095,-.09,.24,.18,.32,gun);b(.15,.095,-.09,.24,.18,.32,gun);
 s(0,1.84,-.015,.20,.21,.2,skin);s(0,1.98,.025,.235,.15,.22,plate);
 b(-.33,1.35,-.23,.19,.49,.21,uniform);b(.33,1.35,-.23,.19,.49,.21,uniform);
 s(-.19,1.39,-.46,.1,.1,.1,gloves);s(.18,1.37,-.45,.1,.1,.1,gloves);
 b(.09,1.39,weaponId==='pistol' ? -.56 : -.75,weaponId==='pistol'?.16:.21,.12,weaponId==='pistol'?.40:.70,gun);
 return root;
}

// Adjust only the existing cheap arena rifle mesh when a remote player changes
// weapon. Avoids rebuilding a whole character every time they press 1–5.
export function setArenaFighterWeapon(fighter,id){
 if(!fighter?.userData?.arenaFighter||!fighter.userData.rifle)return false;
 if(fighter.userData.weaponId===id)return false;
 const visual={m4:[.22,.16,.65,-.49],ak:[.23,.18,.67,-.47],mp9:[.23,.20,.38,-.32],pistol:[.16,.16,.23,-.24],knife:[.055,.055,.48,-.41]}[id] || [.22,.16,.65,-.49];
 const gun=fighter.userData.rifle;
 gun.scale.set(visual[0],visual[1],visual[2]);
 gun.position.set(.13,1.33,visual[3]);
 fighter.userData.weaponId=id;
 return true;
}

// Multiplayer PvP characters use one static mesh per material, rather than
// individually rendering every cuboid. Arms/legs stay in the same poses, while
// the gun remains a separately animated mesh. ~5 draw calls instead of ~14.
export function createArenaFighter(T,team='blue',weaponId='m4'){
 const root=new T.Group(),orange=team==='orange';
 const materials=[
  new T.MeshLambertMaterial({color:orange?0xb95f36:0x266fa0}),
  new T.MeshLambertMaterial({color:orange?0x59382e:0x213c54}),
  new T.MeshBasicMaterial({color:orange?0xffc16d:0x4ee8ec}),
  new T.MeshLambertMaterial({color:0xc8a88d})
 ];
 const blocks=[[],[],[],[]];
 const box=(kind,x,y,z,sx,sy,sz)=>blocks[kind].push({x,y,z,sx,sy,sz});
 box(0,0,1.36,0,.50,.68,.32);box(1,0,1.32,-.19,.39,.42,.10);
 box(3,0,1.80,0,.32,.30,.30);box(1,0,2.00,0,.38,.16,.35);
 box(2,0,2.25,0,.38,.075,.14);
 for(const k of [-1,1]){
  box(1,k*.16,.56,0,.20,.87,.22);
  box(0,k*.36,1.26,-.10,.16,.55,.20);
  box(1,k*.16,.07,-.12,.25,.15,.32);
 }
 const cube=new T.BoxGeometry(1,1,1),staticMeshes=[];
 const matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),identity=new T.Quaternion();
 for(let kind=0;kind<blocks.length;kind++){
  if(!blocks[kind].length)continue;
  const positions=[],normals=[],uvs=[];
  for(const item of blocks[kind]){
   position.set(item.x,item.y,item.z);scale.set(item.sx,item.sy,item.sz);
   matrix.compose(position,identity,scale);
   const instance=cube.clone().toNonIndexed();instance.applyMatrix4(matrix);
   positions.push(...instance.getAttribute('position').array);
   normals.push(...instance.getAttribute('normal').array);
   uvs.push(...instance.getAttribute('uv').array);
   instance.dispose();
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geo.computeBoundingSphere();
  const mesh=new T.Mesh(geo,materials[kind]);root.add(mesh);staticMeshes.push(mesh);
 }
 cube.dispose();
 const gunGeo=new T.BoxGeometry(1,1,1);
 const gun=new T.Mesh(gunGeo,materials[1]);gun.position.set(.13,1.33,-.45);gun.scale.set(.22,.16,.60);gun.rotation.y=.12;root.add(gun);
 root.userData={weaponId:null,team,arenaFighter:true,phase:0,firePulse:0,parts:staticMeshes,arms:[],legs:[],rifle:gun};
 setArenaFighterWeapon(root,weaponId);
 return root;
}
