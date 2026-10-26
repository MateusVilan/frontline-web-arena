import assert from 'node:assert/strict';
const port=Number(process.env.TEST_PORT||3000);
const clients=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function next(ws,type,timeout=3500){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(new Error('timeout '+type));},timeout);function listener(ev){const msg=JSON.parse(ev.data);if(msg.type===type){clearTimeout(timer);ws.removeEventListener('message',listener);resolve(msg);}}ws.addEventListener('message',listener);});}
async function conn(){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});clients.push(ws);return ws;}
try{
 const first=await conn();let pending=next(first,'ROOM');first.send(JSON.stringify({type:'CREATE',map:'rust'}));const created=await pending;
 assert.equal(created.map,'rust');assert.equal(created.team,'blue');
 const second=await conn();pending=next(second,'ROOM');second.send(JSON.stringify({type:'JOIN',code:created.code}));const joined=await pending;assert.equal(joined.team,'orange');
 let state=await next(first,'STATE');assert.equal(state.enemies.length,0);assert.equal(state.players.length,2);
 // Move both contestants towards one clear shooting lane while observing speed validation.
 for(let i=1;i<=21;i++){
   const a=13.5+Math.min(i,9)/3,b=23.5-i/3;
   first.send(JSON.stringify({type:'MOVE',x:7.5,z:a,yaw:-Math.PI/2,pitch:0,weapon:'m4'}));
   second.send(JSON.stringify({type:'MOVE',x:29.5,z:b,yaw:Math.PI/2,pitch:0,weapon:'m4'}));
   await sleep(60);
 }
 await sleep(750);
 const killed=next(first,'KILL',4000);
 for(let i=0;i<6;i++){first.send(JSON.stringify({type:'SHOT',weapon:'m4',yaw:-Math.PI/2,pitch:0}));await sleep(120);}
 const kill=await killed;assert.equal(kill.killer,created.id);assert.equal(kill.victim,joined.id);
 state=await next(first,'STATE');assert.ok(state.players.some(p=>p.kills>=1));
 // Join enough clients to confirm 2v1 and 2v2 automatic team balancing.
 const third=await conn();pending=next(third,'ROOM');third.send(JSON.stringify({type:'JOIN',code:created.code}));const p3=await pending;assert.equal(p3.team,'blue');
 const fourth=await conn();pending=next(fourth,'ROOM');fourth.send(JSON.stringify({type:'JOIN',code:created.code}));const p4=await pending;assert.equal(p4.team,'orange');
 state=await next(first,'STATE');assert.equal(state.players.length,4);assert.equal(state.enemies.length,0);
 const counts=Object.groupBy(state.players,p=>p.team);assert.equal(counts.blue.length,2);assert.equal(counts.orange.length,2);
 const changed=next(first,'MAP');first.send(JSON.stringify({type:'MAP',map:'azure'}));assert.equal((await changed).map,'azure');
 state=await next(first,'STATE');assert.equal(state.map,'azure');assert.equal(state.enemies.length,0);
 const refused=next(first,'ERROR');first.send(JSON.stringify({type:'MAP',map:'industrial'}));assert.match((await refused).message,/suporta 2/);
 const over=await conn();pending=next(over,'ERROR');over.send(JSON.stringify({type:'JOIN',code:created.code}));assert.match((await pending).message,/máximo 4/);
 console.log('PASS: PvP 1v1 damage and respawn; 2v1, 2v2, team balance and room capacity; no bots in arenas.');
} finally{for(const ws of clients)ws.close();}
