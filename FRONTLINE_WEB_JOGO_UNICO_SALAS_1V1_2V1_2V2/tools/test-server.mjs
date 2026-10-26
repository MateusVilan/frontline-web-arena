import assert from 'node:assert/strict';
const testPort=Number(process.env.TEST_PORT||3000);
const base=`http://127.0.0.1:${testPort}`;
const health=await fetch(base+'/health');assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
for(const p of ['/', '/src/main.js', '/src/world.js', '/src/models.js', '/src/movement.js', '/shared/maps.js']){
 const r=await fetch(base+p);assert.equal(r.status,200,p);
}
const clients=[];
function connect(){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${testPort}/ws`);ws.addEventListener('open',()=>{clients.push(ws);resolve(ws);},{once:true});ws.addEventListener('error',reject,{once:true});});}
function next(ws,type,timeout=2500){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(new Error(`Timed out ${type}`));},timeout);function listener(e){const v=JSON.parse(e.data);if(v.type===type){clearTimeout(timer);ws.removeEventListener('message',listener);resolve(v);}}ws.addEventListener('message',listener);});}
const a=await connect();let pending=next(a,'ROOM');a.send(JSON.stringify({type:'CREATE',map:'industrial'}));const r=await pending;assert.match(r.code,/^[A-Z2-9]{6}$/);assert.equal(r.host,true);console.log('Room created:',r.code);
const b=await connect();pending=next(b,'ROOM');b.send(JSON.stringify({type:'JOIN',code:r.code}));const joined=await pending;assert.equal(joined.code,r.code);assert.equal(joined.host,false);
const state=await next(a,'STATE');assert.equal(state.players.length,2);assert.ok(state.enemies.length>0);console.log('Players:',state.players.length,'enemies:',state.enemies.length);
pending=next(a,'MAP');a.send(JSON.stringify({type:'MAP',map:'harbor'}));assert.equal((await pending).map,'harbor');
pending=next(a,'PONG');a.send(JSON.stringify({type:'PING',time:12345}));assert.equal((await pending).time,12345);
let p=next(b,'STATE');b.send(JSON.stringify({type:'MOVE',x:4.5,z:3.5,yaw:0,pitch:0,weapon:'m4',moving:false}));const s=await p;assert.equal(s.map,'harbor');
for(const c of clients)c.close();
console.log('PASS: HTTP static files, room creation/join, snapshots, map change, ping/pong, movement, two WebSocket clients.');
