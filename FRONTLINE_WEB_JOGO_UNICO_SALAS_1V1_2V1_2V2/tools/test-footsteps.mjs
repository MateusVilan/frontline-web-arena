import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../public/audio/',import.meta.url);
const ids=[...Array.from({length:4},(_,i)=>`foot_soft_${i+1}`),...Array.from({length:3},(_,i)=>`foot_boot_${i+1}`)];
for(const id of ids){
  const file=fs.readFileSync(new URL(id+'.wav',root));
  assert.equal(file.toString('ascii',0,4),'RIFF');
  assert.equal(file.toString('ascii',8,12),'WAVE');
  assert.equal(file.readUInt16LE(22),1,'mono samples');
  assert.equal(file.readUInt32LE(24),22050);
  const samples=file.subarray(44);let peak=0,rms=0,n=0;
  for(let i=0;i+1<samples.length;i+=2){const v=samples.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));rms+=v*v;n++;}
  rms=Math.sqrt(rms/n);
  assert.ok(peak>=.35&&peak<=.5,`${id}: bounded peak`);
  assert.ok(rms<.13,`${id}: moderate rms`);
  assert.ok(n/22050>=.17&&n/22050<.25,`${id}: short duration`);
  console.log(`PASS ${id}: ${Math.round(n/22.05)} ms, peak ${peak.toFixed(3)}, RMS ${rms.toFixed(3)}`);
}
const src=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
assert.ok(src.includes('frontline_step_mix_v151'),'one-time footstep volume migration');
assert.ok(src.includes('if(player.crouch<.4)playFootstepAt'),'crouch should be silent');
assert.ok(src.includes('lastEnemyStepTime<.11'),'enemy footstep congestion limit');
assert.ok(!src.includes("'step_concrete','step_heavy'"),'old samples unused');
console.log('PASS: step samples, volume migration, crouch and overlap');
