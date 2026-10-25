import test from 'node:test';
import assert from 'node:assert/strict';
import {teamCounts,teamsReady,distributeTeams,teamForJoin,switchTeam} from '../public/teams.js';
import {canStartRoom} from '../public/combat.js';

function room(mode){return {mode,state:'lobby',players:new Map()}}
function add(r,id,team){r.players.set(id,{id,team,ws:{readyState:1}})}
test('No 2v1 o host consegue escolher quem joga sozinho',()=>{
 const r=room('2v1');add(r,'1','A');add(r,'2','A');add(r,'3','B');
 assert.ok(teamsReady(r));assert.ok(canStartRoom(r));
 assert.ok(switchTeam(r,'1'));
 assert.equal(r.players.get('1').team,'B');
 assert.equal(r.players.get('3').team,'A');
 assert.ok(teamsReady(r));assert.ok(canStartRoom(r));
});
test('Permite mudar de equipa se existir vaga',()=>{
 const r=room('2v2');add(r,'1','A');add(r,'2','A');
 assert.equal(teamForJoin(r),'B');
 assert.ok(switchTeam(r,'1'));assert.equal(r.players.get('1').team,'B');
 assert.deepEqual(teamCounts(r),{A:1,B:1});assert.equal(teamForJoin(r),'A');
});
test('Sem jogadores suficientes, nem equipas erradas, partida não começa',()=>{
 const r=room('2v1');add(r,'1','A');add(r,'2','B');add(r,'3','B');
 assert.ok(!canStartRoom(r));distributeTeams(r);assert.ok(canStartRoom(r));
});
test('Um convidado não pode usar troca de equipa fora do lobby',()=>{
 const r=room('1v1');add(r,'1','A');add(r,'2','B');
 r.state='playing';assert.equal(switchTeam(r,'1'),false);
 assert.equal(switchTeam(r,'invalid'),false);
});
