import assert from 'node:assert/strict';
import {advanceGait} from '../src/locomotion.js';
import {shotPattern} from '../src/ballistics.js';
import {traceEnemies, directionFromYawPitch} from '../shared/hitboxes.js';
import {applyShotDamage} from '../src/combat.js';
import {advanceShotCooldown,nextShotCooldown} from '../src/firing.js';

const fpsRates=[20,30,60,144];
for(const fps of fpsRates){
 const dt=1/fps;
 let gait={phase:0,motion:0,sprint:0,frequency:8.2};
 let maxPhaseJump=0, maxSprintJump=0, lastSprint=0, lastPhase=0;
 for(let i=0;i<fps*6;i++){
  const t=i*dt;
  const moving=t>=.3 && t<5.4;
  const sprint=t>=1.4 && t<3.2;
  gait=advanceGait(gait,dt,moving,sprint);
  const phaseStep=(gait.phase-lastPhase+Math.PI*2)%(Math.PI*2);
  maxPhaseJump=Math.max(maxPhaseJump,phaseStep);
  maxSprintJump=Math.max(maxSprintJump,Math.abs(gait.sprint-lastSprint));
  assert.ok([gait.phase,gait.motion,gait.sprint,gait.frequency].every(Number.isFinite));
  assert.ok(gait.motion>=0&&gait.motion<=1.000001);
  assert.ok(gait.sprint>=0&&gait.sprint<=1.000001);
  lastPhase=gait.phase;lastSprint=gait.sprint;
 }
 assert.ok(maxPhaseJump<.6,`Shift causes gait teleportation at ${fps} fps: ${maxPhaseJump}`);
 assert.ok(maxSprintJump<.4,`Sprint blend snaps at ${fps} fps: ${maxSprintJump}`);
 assert.ok(gait.sprint<.04,`Sprint not settled after release at ${fps} fps`);
 console.log(`PASS sprint ${fps} fps: phase increment < ${maxPhaseJump.toFixed(3)}, blend < ${maxSprintJump.toFixed(3)}`);
}

const weapons={m4:34,ak:43,mp9:23,pistol:38,knife:80};
for(const [id,dmg] of Object.entries(weapons)){
 const enemy={x:0,z:-5,health:100,alive:true};
 const origin={x:0,y:1.65,z:0};
 const pattern=shotPattern(id,0,false,false);
 const dir=directionFromYawPitch(pattern.yaw,pattern.pitch);
 const hit=traceEnemies(origin,dir,[enemy],40);
 assert.ok(hit,`${id} should hit at crosshair during stationary first shot`);
 const outcome=applyShotDamage(hit,dmg);
 assert.ok(outcome?.damage>0,`${id} damage missing`);
 assert.ok(enemy.health<100,`${id} does not damage`);
 assert.ok(shotPattern(id,12,true,false).cameraKick>=0);
 console.log(`PASS first-shot ${id}: ${outcome.damage} damage, aimed at crosshair`);
}
console.log('PASS locomotion and first-shot regressions');

// A renderização pode variar, mas os disparos automáticos devem manter RPM constante.
for(const dt of [1/20,1/30,1/60,1/144]){
 for(const [id,delay] of Object.entries({m4:.095,ak:.109,mp9:.07})){
  let cooldown=0,shots=0,elapsed=0;
  const seconds=6;
  while(elapsed<seconds-1e-8){
   cooldown=advanceShotCooldown(cooldown,dt);
   for(let i=0;i<3 && cooldown<=0;i++){
    cooldown=nextShotCooldown(cooldown,delay);shots++;
   }
   elapsed+=dt;
  }
  const expected=seconds/delay;
  assert.ok(Math.abs(shots-expected)<2,`${id} at ${Math.round(1/dt)}fps: ${shots} instead of ${expected.toFixed(1)}`);
 }
 console.log(`PASS automatic fire cadence at ${Math.round(1/dt)} FPS`);
}
