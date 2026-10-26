import assert from 'node:assert/strict';
const port=Number(process.env.TEST_PORT||3000);
const open=async()=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});return ws;};
const wait=(ws,type,timeout=2200)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',receive);reject(new Error(`Timeout waiting for ${type}`));},timeout);const receive=(e)=>{let p;try{p=JSON.parse(e.data);}catch{return;}if(p.type!==type)return;clearTimeout(timer);ws.removeEventListener('message',receive);resolve(p);};ws.addEventListener('message',receive);});
const pause=(ms)=>new Promise(r=>setTimeout(r,ms));
const ws=[];
try{
 const a=await open();ws.push(a);
 let promised=wait(a,'ROOM');a.send(JSON.stringify({type:'CREATE',map:'rust'}));const room=await promised;assert.equal(room.host,true);
 const b=await open();ws.push(b);promised=wait(b,'ROOM');b.send(JSON.stringify({type:'JOIN',code:room.code}));assert.equal((await promised).team,'orange');
 const c=await open();ws.push(c);promised=wait(c,'ROOM');c.send(JSON.stringify({type:'JOIN',code:room.code}));assert.equal((await promised).team,'blue');
 // Non-host cannot switch the map; the actual host stays host after a guest leaves.
 c.send(JSON.stringify({type:'MAP',map:'azure'}));await pause(120);
 let latest=await wait(a,'STATE');assert.equal(latest.map,'rust');
 promised=wait(c,'TEAM');b.send(JSON.stringify({type:'LEAVE'}));const rebalanced=await promised;
 assert.equal(rebalanced.team,'orange','two remaining blue players must be split between teams');
 promised=wait(a,'STATE');latest=await promised;
 assert.equal(latest.players.length,2);
 assert.equal(latest.players.filter(p=>p.team==='orange').length,1);
 // The surviving original host can still switch maps.
 promised=wait(c,'MAP');a.send(JSON.stringify({type:'MAP',map:'azure'}));assert.equal((await promised).map,'azure');
 // Host leaves, surviving player alone receives new host rights.
 promised=wait(c,'HOST');a.send(JSON.stringify({type:'LEAVE'}));await promised;
 promised=wait(c,'MAP');c.send(JSON.stringify({type:'MAP',map:'rust'}));assert.equal((await promised).map,'rust');
 console.log('PASS: PvP host ownership, solo host transfer, rebalanced teams after guest exit.');
}finally{for(const s of ws)try{s.close();}catch{}}
