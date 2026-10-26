import assert from 'node:assert/strict';
const PORT=Number(process.env.TEST_PORT||3000);
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
const inbox=[];
ws.addEventListener('message',ev=>{try{const data=JSON.parse(ev.data);if(['ROOM','RESUMED','FIRE','AMMO_SYNC','ERROR'].includes(data.type))inbox.push(data);}catch{}});
async function next(type,timeout=2000,predicate=()=>true){const start=Date.now();while(Date.now()-start<timeout){const idx=inbox.findIndex(x=>x.type===type&&predicate(x));if(idx!==-1)return inbox.splice(idx,1)[0];await sleep(15);}throw new Error(`Did not receive ${type}`);}
const send=m=>ws.send(JSON.stringify(m));
const fires=()=>inbox.filter(m=>m.type==='FIRE').length;
const move=weapon=>send({type:'MOVE',x:7.5,z:13.5,yaw:0,pitch:0,weapon,moving:false});
try{
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 send({type:'CREATE',map:'rust',name:'Tester'});
 const created=await next('ROOM');assert.equal(created.map,'rust');
 for(let i=0;i<30;i++){
  send({type:'SHOT',weapon:'m4',yaw:0,pitch:0});
  await sleep(115);
 }
 assert.equal(fires(),30,'exactly thirty M4 shots were accepted');
 send({type:'SHOT',weapon:'m4',yaw:0,pitch:0});
 const dry=await next('AMMO_SYNC');
 assert.equal(dry.ammo.m4,0,'server refuses an empty magazine');
 assert.equal(fires(),30,'thirty-first M4 shot did not fire');
 send({type:'RELOAD',weapon:'m4'});
 await sleep(170);
 send({type:'SHOT',weapon:'m4',yaw:0,pitch:0});
 const whileReload=await next('AMMO_SYNC');
 assert.equal(whileReload.reloading,'m4','server rejects shots while reloading');
 assert.ok(whileReload.reloadRemaining>0);
 assert.equal(fires(),30);
 await sleep(1560);
 const complete=await next('AMMO_SYNC',2000,m=>m.ammo.m4===30&&!m.reloading);
 assert.equal(complete.ammo.m4,30);
 send({type:'SHOT',weapon:'m4',yaw:0,pitch:0});
 await sleep(100);
 assert.equal(fires(),31,'firing resumes when reload completes');
 move('pistol');await sleep(260);
 send({type:'SHOT',weapon:'pistol',yaw:0,pitch:0});await sleep(280);
 send({type:'RELOAD',weapon:'pistol'});
 move('ak');await sleep(100);
 move('pistol');await sleep(100);
 const replacement=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
 await new Promise((resolve,reject)=>{replacement.addEventListener('open',resolve,{once:true});replacement.addEventListener('error',reject,{once:true});});
 const resume=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('RESUMED timeout')),2000);const handler=e=>{const m=JSON.parse(e.data);if(m.type==='RESUMED'){clearTimeout(timer);replacement.removeEventListener('message',handler);resolve(m);}};replacement.addEventListener('message',handler);});
 const resumedPending=resume();replacement.send(JSON.stringify({type:'RESUME',code:created.code,session:created.session}));
 const recovered=await resumedPending;
 assert.equal(recovered.ammo.m4,29,'magazine is not refilled by refreshing');
 assert.equal(recovered.ammo.pistol,12,'weapon ammo persists across recovery');
 assert.equal(recovered.reloading,null,'weapon switch cancels reload');
 replacement.close();
 console.log('PASS: server-authoritative ammo, empty magazine, reload timing, switch cancellation, session recovery');
}finally{ws.close();}
