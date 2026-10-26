import assert from 'node:assert/strict';
import {applyBulletDamage} from '../shared/pvp-rules.js';

// Server-authoritative PvP vest: body shots absorb damage; headshots don't.
let target={hp:100,armor:100};
const afterBody=applyBulletDamage(target,34,'torso');
assert.ok(afterBody.hp>66,'Body armor must absorb part of a torso hit');
assert.ok(afterBody.armor<100,'Armor must be consumed when protecting a player');
const hpAfterBody=target.hp;
applyBulletDamage(target,34,'head');
assert.equal(target.hp,hpAfterBody-34,'Headshots must bypass the vest');
const noVest={hp:100,armor:0};
applyBulletDamage(noVest,34,'torso');
assert.equal(noVest.hp,66,'Body damage without armor is unchanged');

const port=Number(process.env.TEST_PORT||3000);
const clients=[];
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function connect(){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);
 const inbox=[];
 ws.addEventListener('message',ev=>{try{inbox.push(JSON.parse(ev.data));}catch{}});
 await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
 });
 clients.push(ws);
 return {ws,inbox,send:(m)=>ws.send(JSON.stringify(m)),
  async next(type,match=()=>true,timeout=3000){const start=Date.now();while(Date.now()-start<timeout){const i=inbox.findIndex(m=>m.type===type&&match(m));if(i>=0)return inbox.splice(i,1)[0];await sleep(12);}throw Error(`Timeout ${type}`);},
 };
}
try{
 const host=await connect();
 host.send({type:'CREATE',map:'rust',name:'HOST'});
 const room=await host.next('ROOM');
 assert.equal(room.map,'rust');
 const guest=await connect();
 guest.send({type:'JOIN',code:room.code,name:'VISITANTE'});
 await guest.next('ROOM');
 host.send({type:'BUY',item:'armor'});
 const bought=await host.next('BUY_RESULT');
 assert.equal(bought.success,true);
 assert.equal(bought.money,150);
 assert.equal(bought.armor,100);
 host.send({type:'BUY',item:'health'});
 const noHealth=await host.next('BUY_RESULT');
 assert.equal(noHealth.success,false);
 assert.equal(noHealth.money,150);
 host.send({type:'SHOT',weapon:'m4',yaw:0,pitch:0,seq:1});
 const spent=await host.next('SHOT_RESULT',m=>m.seq===1);
 assert.equal(spent.accepted,true);
 assert.equal(spent.remaining,29);
 // Crucially reset the SAME map, not a different arena.
 host.send({type:'MAP',map:'rust'});
 const [hReset,gReset]=await Promise.all([host.next('MAP',m=>m.reset===true),guest.next('MAP',m=>m.reset===true)]);
 assert.equal(hReset.map,'rust');assert.equal(gReset.map,'rust');
 const state=await host.next('STATE',m=>m.map==='rust'&&m.players?.find(p=>p.id===room.id)?.money===800);
 const p=state.players.find(p=>p.id===room.id);
 assert.equal(p.money,800,'Money resets after restarting the same arena');
 assert.equal(p.armor,0,'The shop vest resets after restarting the same arena');
 host.send({type:'SHOT',weapon:'m4',yaw:0,pitch:0,seq:2});
 const firedAgain=await host.next('SHOT_RESULT',m=>m.seq===2);
 assert.equal(firedAgain.remaining,29,'Ammo resets after restarting the same arena');
 // Changing from PvP to cooperative with two people means same blue team.
 host.send({type:'MAP',map:'industrial'});
 await host.next('MAP',m=>m.map==='industrial'&&m.reset);
 const coop=await host.next('STATE',m=>m.map==='industrial');
 assert.ok(coop.players.every(p=>p.team==='blue'),'Co-op teammates must share the same team');
 console.log('PASS: PvP armor and headshots, shop confirmations, same-map reset, ammo reset, cooperative teams');
}finally{for(const client of clients)client.close();}
