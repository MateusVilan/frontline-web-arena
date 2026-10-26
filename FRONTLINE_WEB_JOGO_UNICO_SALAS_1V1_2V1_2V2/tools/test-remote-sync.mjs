import assert from 'node:assert/strict';
import {addRemoteSample,sampleRemote} from '../src/remote-sync.js';
const samples=[];
addRemoteSample(samples,{x:0,z:0,yaw:Math.PI-.10,moving:true},0);
addRemoteSample(samples,{x:2,z:4,yaw:-Math.PI+.10,moving:true},100);
const mid=sampleRemote(samples,50);
assert.equal(mid.x,1);assert.equal(mid.z,2);
assert.ok(Math.abs(Math.abs(mid.yaw)-Math.PI)<.01,'yaw takes short arc over wrap boundary');
assert.equal(sampleRemote(samples,-100).x,0);
assert.equal(sampleRemote(samples,200).x,2,'no extrapolation past final known position');
for(let i=0;i<20;i++)addRemoteSample(samples,{x:2+i*.01,z:4},201+i*10);
assert.ok(samples.length<=8);
addRemoteSample(samples,{x:30,z:30},500);
assert.equal(samples.length,1,'teleports reset interpolation');
addRemoteSample(samples,{x:NaN,z:10},550);
assert.equal(samples.length,1,'reject invalid packets');
console.log('PASS: jitter interpolation, yaw wrap, teleport, clamp and invalid state');

// With a small delay, the renderer can smooth packet gaps without predicting far.
const timeline=[];
addRemoteSample(timeline,{x:5,z:5,yaw:0,moving:true},100);
addRemoteSample(timeline,{x:5.25,z:5,yaw:0,moving:true},150);
assert.ok(sampleRemote(timeline,190,65).x>5.25,'bounded prediction avoids freezing until next packet');
assert.ok(sampleRemote(timeline,900,65).x<=5.50,'prediction limited to 0.25 map units');
assert.equal(sampleRemote(timeline,900).x,5.25,'default remains no prediction');
const idle=[];addRemoteSample(idle,{x:7,z:3,moving:false},100);addRemoteSample(idle,{x:7,z:3,moving:false},150);
assert.equal(sampleRemote(idle,200,65).x,7,'stationary actors never drift');
console.log('PASS: bounded extrapolation never predicts too far, idle remains stable.');
