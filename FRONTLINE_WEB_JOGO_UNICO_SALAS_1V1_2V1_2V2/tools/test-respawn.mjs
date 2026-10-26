import assert from 'node:assert/strict';
import {respawnState,canReceiveBotDamage} from '../shared/respawn.js';
import {MAPS} from '../shared/maps.js';

const now=100000;
const p={slot:1,x:22,z:30,hp:-5,armor:44,jump:.8,moving:true,moveCredit:3,
 lastMove:100,spawnShield:0,lastCorrection:54,history:[{x:22,z:30,t:99}],ammo:{m4:9},money:1200,weapon:'m4'};
const spawn=MAPS.harbor.spawn[p.slot];
const msg=respawnState(p,spawn,now,1800);
assert.deepEqual(msg,{type:'RESPAWN',x:spawn[0],z:spawn[1],shield:1800,hp:100,armor:0});
assert.equal(p.x,spawn[0]);assert.equal(p.z,spawn[1]);
assert.equal(p.hp,100);assert.equal(p.armor,0);
assert.equal(p.jump,0);assert.equal(p.moving,false);
assert.deepEqual(p.history,[]);assert.equal(p.moveCredit,.45);
assert.equal(p.lastMove,now);assert.equal(p.lastCorrection,0);
assert.equal(p.spawnShield,now+1800);
assert.equal(canReceiveBotDamage(p,now+1000),false,'Bots cannot damage a recently respawned player');
assert.equal(canReceiveBotDamage(p,now+1800),true,'Bot damage resumes when the shield expires');
assert.equal(p.ammo.m4,9,'Respawn must not silently refill the magazine');
assert.equal(p.money,1200,'Respawn should preserve earned money');
assert.equal(p.weapon,'m4');
assert.throws(()=>respawnState(p,[NaN,0]),TypeError);
console.log('PASS: PvP/co-op respawns, second-player spawn, fresh shield, movement and history reset, keep ammunition/money.');
