/** Convites de sala: não dependem do servidor e não guardam dados pessoais. */
export function validRoomCode(value){ return /^[A-Z0-9]{6}$/.test(String(value??'').trim().toUpperCase()); }
export function getInviteCode(search){
  try{
    const value=new URLSearchParams(search).get('room');
    const code=String(value??'').trim().toUpperCase();
    return validRoomCode(code)?code:'';
  }catch{return '';}
}
export function makeInviteUrl(origin,code){
  if(!validRoomCode(code))throw new Error('Código de sala inválido');
  const url=new URL('/',origin);
  url.searchParams.set('room',String(code).trim().toUpperCase());
  return url.href;
}
export function isLocalOrigin(origin){
  try{return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(origin).hostname);}catch{return false;}
}
