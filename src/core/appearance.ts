export interface Appearance { image:string; opacity:number }
export function validateAppearance(value:unknown):void {
  const v=value as Appearance
  if(!v||typeof v.image!=='string'||v.image.length>8*1024*1024||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>0.45||
    (v.image!==''&&!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image)))throw new Error('背景图片或透明度无效')
}
