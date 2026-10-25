import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../public/maps.js';
import {canStartRoom,traceHit,shotSpread,canFireNow} from '../public/combat.js';

function person(id,team,x,z,crouch=false){return {id,team,x,z,crouch,alive:true};}
test('Uma sala não inicia com participantes desligados',()=>{
 const players=new Map([['1',{team:'A',ws:{readyState:1}}],['2',{team:'B',ws:null}]]);
 const room={mode:'1v1',players};assert.equal(canStartRoom(room),false);
 players.get('2').ws={readyState:1};assert.equal(canStartRoom(room),true);
 players.get('2').ws.readyState=3;assert.equal(canStartRoom(room),false);
});
test('Acertar num inimigo sem obstáculos marca tiro na cabeça',()=>{
 const attacker=person('a','A',3.5,10.5),target=person('b','B',5.5,10.5);
 const result=traceHit(MAPS.dockyard,[attacker,target],attacker,-Math.PI/2,0,10);
 assert.equal(result?.player,target);assert.equal(result?.head,true);
});
test('Não causa dano em colegas de equipa',()=>{
 const attacker=person('a','A',3.5,10.5),friend=person('b','A',5.5,10.5);
 assert.equal(traceHit(MAPS.dockyard,[attacker,friend],attacker,-Math.PI/2,0,10),null);
});
test('Paredes bloqueiam os disparos',()=>{
 const attacker=person('a','A',5.5,3.5),target=person('b','B',11.5,3.5);
 assert.equal(traceHit(MAPS.dockyard,[attacker,target],attacker,-Math.PI/2,0,20),null);
});
test('Distância da faca é limitada',()=>{
 const attacker=person('a','A',3.5,10.5),target=person('b','B',5.5,10.5);
 assert.equal(traceHit(MAPS.dockyard,[attacker,target],attacker,-Math.PI/2,0,1.85),null);
});
test('Dispersão do tiro é maior em movimento; agachado reduz; faca não dispersa',()=>{
 const standing=shotSpread('rifle',0,false,()=>1);
 const running=shotSpread('rifle',5,false,()=>1);
 const crouch=shotSpread('rifle',5,true,()=>1);
 assert.ok(running.yaw>standing.yaw);
 assert.ok(crouch.yaw<running.yaw);
 assert.deepEqual(shotSpread('knife',5,false,()=>1),{yaw:0,pitch:0});
});
test('Dispersão é limitada para qualquer velocidade',()=>{
 const low=shotSpread('pistol',1000,false,()=>1);
 const medium=shotSpread('pistol',5,false,()=>1);
 assert.deepEqual(low,medium);
});

test('Não dispara enquanto equipa, recarrega ou está morto',()=>{
 const p={weapon:'rifle',alive:true,shotAt:0,equipReadyAt:1700,reloadAt:0};
 assert.equal(canFireNow(p,1650),false);
 assert.equal(canFireNow(p,1700),true);
 p.reloadAt=2100;assert.equal(canFireNow(p,1900),false);
 p.alive=false;assert.equal(canFireNow(p,2400),false);
});
test('Troca de arma não ignora intervalo entre disparos',()=>{
 const p={weapon:'pistol',alive:true,shotAt:1000,equipReadyAt:0,reloadAt:0};
 assert.equal(canFireNow(p,1200),false);
 assert.equal(canFireNow(p,1250),true);
});

test('Um colega bloqueia um projétil dirigido a adversário atrás dele, sem sofrer dano',()=>{
 const attacker=person('a','A',3.5,10.5);
 const ally=person('b','A',5.5,10.5);
 const enemy=person('c','B',6.5,10.5);
 assert.equal(traceHit(MAPS.dockyard,[enemy,attacker,ally],attacker,-Math.PI/2,0,12),null);
 ally.alive=false;
 assert.equal(traceHit(MAPS.dockyard,[enemy,attacker,ally],attacker,-Math.PI/2,0,12)?.player,enemy);
});
