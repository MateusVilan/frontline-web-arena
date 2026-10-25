/** Resolução manual real, independente do DPR do monitor e sem modo automático. */
export function pixelRatio(deviceRatio,resolution){
 const dpr=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
 const scale=Number.isFinite(resolution)?Math.max(50,Math.min(100,resolution)):80;
 return Math.max(.5,Math.min(2,dpr*scale/100));
}
