// Pure easing functions for gameplay animation. Time is always normalised [0, 1].
export const clamp01=v=>Math.max(0,Math.min(1,v));
export const smooth=v=>{v=clamp01(v);return v*v*(3-2*v);};
export const bump=(t,a,b,c,d)=>smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)));

export function weaponPose(id,inspectTime=0,reloadTime=0,recoil=0){
 const inspecting=inspectTime>0&&inspectTime<1;
 const inspect=inspecting?Math.sin(Math.PI*smooth(inspectTime)):0;
 const reload=reloadTime>0&&reloadTime<1;
 const lower=reload?bump(reloadTime,.02,.21,.72,.98):0;
 const magazine=reload?bump(reloadTime,.16,.38,.48,.68):0;
 const settle=reload?bump(reloadTime,.67,.78,.86,.98):0;
 const pistol=id==='pistol',knife=id==='knife';
 // Weapon-specific visual kick: the P250 snaps briefly, the AK is weightier,
 // and the MP9 stays lighter. This changes only the viewmodel, not hit detection.
 const kick=knife?.20:pistol?.72:id==='ak'?1.10:id==='mp9'?.68:.88;
 return {
  x:(pistol?-.055:knife?.015:0)*inspect+.025*lower,
  y:(pistol?-.035:knife?-.020:-.05)*inspect-.13*lower+.015*settle-.018*recoil*kick,
  z:(knife?.018:-.03)*inspect+.045*lower-.036*recoil*kick,
  pitch:-(pistol?.13:knife?.08:.19)*inspect+(pistol?.30:knife?.10:.18)*lower+.035*settle+.16*recoil*kick,
  yaw:(pistol?.58:knife?.34:.62)*inspect-(pistol?.27:knife?.08:.34)*lower,
  roll:(pistol?-.23:knife?.72:.26)*inspect+(pistol?-.25:knife?.08:.23)*lower-.09*recoil*kick,
  magDrop:magazine*(pistol?.22:.38),
  slideKick:pistol?Math.max(.075*recoil,.083*settle):0,
  reloadStrength:lower,
  inspectStrength:inspect
 };
}

export function enemyMotion(time,walking,hit=0){
 const phase=time*(walking?8.5:1.1),stride=walking?Math.sin(phase)*.44:0;
 const bob=walking?.016*Math.sin(phase*2):.006*Math.sin(phase);
 return {stride,bob,armSwing:walking?.045*Math.sin(phase):.007*Math.sin(phase),hitLean:.14*clamp01(hit)};
}
