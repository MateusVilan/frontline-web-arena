/** Histórico curto de posições validado pelo servidor, para compensação de lag.
 * Tempos são do relógio do servidor. Nunca se aceitam posições retroativas do cliente.
 */
export const MAX_REWIND_MS = 125;
const HISTORY_WINDOW_MS = 550;
export function rememberPosition(p,at){
  if(!Number.isFinite(at))return;
  const h=p.history||(p.history=[]);
  const last=h[h.length-1];
  if(last&&at<last.at)return;
  const sample={at,x:p.x,z:p.z,crouch:!!p.crouch};
  if(last&&at===last.at)h[h.length-1]=sample;
  else h.push(sample);
  while(h.length>2&&h[1].at<at-HISTORY_WINDOW_MS)h.shift();
}
export function historicalPosition(p,at){
 const h=p.history;
 if(!h?.length)return {x:p.x,z:p.z,crouch:!!p.crouch};
 if(at<=h[0].at)return h[0];
 for(let i=1;i<h.length;i++)if(at<=h[i].at){
  const a=h[i-1],b=h[i],f=Math.max(0,Math.min(1,(at-a.at)/Math.max(1,b.at-a.at)));
  // Agachar não é uma coordenada: mantém-se o estado anterior até a mudança ocorrer.
  return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,crouch:f>=1?b.crouch:a.crouch};
 }
 return h[h.length-1];
}
/** Compensação apenas para a latência medida pelo servidor, com limite anti-abuso. */
export function rewindAt(now,measuredRoundTripMs){
 const rtt=Number.isFinite(measuredRoundTripMs)?Math.max(0,measuredRoundTripMs):0;
 return now-Math.min(MAX_REWIND_MS,rtt/2);
}
