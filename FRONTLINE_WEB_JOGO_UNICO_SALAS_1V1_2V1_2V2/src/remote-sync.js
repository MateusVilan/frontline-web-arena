// Snapshot interpolation for players on another PC.
// Uses an intentionally small display buffer to absorb network jitter;
// never extrapolates through walls or invents positions during packet loss.
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const MAX_REMOTE_SAMPLES=8;
export function addRemoteSample(samples, p, time){
  const s={t:time,x:p.x,z:p.z,yaw:p.yaw||0,jump:p.jump||0,moving:!!p.moving};
  if(!Number.isFinite(s.x)||!Number.isFinite(s.z)||!Number.isFinite(s.yaw))return samples;
  if(samples.length){
    const prev=samples[samples.length-1];
    if(Math.hypot(s.x-prev.x,s.z-prev.z)>4.5)samples.length=0; // respawn / teleport
    else s.t=Math.max(s.t,prev.t+1);
  }
  samples.push(s);
  while(samples.length>MAX_REMOTE_SAMPLES)samples.shift();
  return samples;
}
export function sampleRemote(samples,renderTime,maxExtrapolateMs=0){
  if(!samples.length)return null;
  if(samples.length===1||renderTime<=samples[0].t)return {...samples[0]};
  if(renderTime>=samples[samples.length-1].t){
    const last=samples[samples.length-1];
    if(maxExtrapolateMs<=0||samples.length<2||!last.moving)return {...last};
    const prev=samples[samples.length-2];
    const age=Math.min(Math.max(0,renderTime-last.t),Math.min(65,maxExtrapolateMs));
    const interval=last.t-prev.t;
    if(interval<20||interval>180)return {...last};
    const vx=(last.x-prev.x)/interval,vz=(last.z-prev.z)/interval;
    // Maximum 0.25 map units, never a distant prediction or respawn leap.
    const dx=clamp(vx*age,-.25,.25),dz=clamp(vz*age,-.25,.25);
    return {...last,x:last.x+dx,z:last.z+dz};
  }
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    if(renderTime>b.t)continue;
    const alpha=clamp((renderTime-a.t)/Math.max(1,b.t-a.t),0,1);
    const delta=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
    return {t:renderTime,x:mix(a.x,b.x,alpha),z:mix(a.z,b.z,alpha),yaw:a.yaw+delta*alpha,jump:mix(a.jump,b.jump,alpha),moving:a.moving||b.moving};
  }
  return {...samples[samples.length-1]};
}
