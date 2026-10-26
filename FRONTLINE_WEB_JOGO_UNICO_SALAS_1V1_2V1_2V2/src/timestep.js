// Keep large browser frame delays from speeding the player through walls,
// but do not turn a 13 FPS browser into slow-motion by discarding half of time.
export function simulationDelta(milliseconds){
 const ms=Number(milliseconds);
 return !Number.isFinite(ms)||ms<=0?0:Math.min(.12,ms/1000);
}
export function simulationSteps(milliseconds){
 const dt=simulationDelta(milliseconds);
 const steps=[];let remain=dt;
 while(remain>1e-8){const step=Math.min(remain,.04);steps.push(step);remain-=step;}
 return steps;
}
