export interface TextPiece { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }
export function organizeText(items: TextPiece[]) {
  const source=items.filter(t=>t.str.trim())
  if(!source.length) return { markdown:'', complex:false }
  const sizes=source.map(t=>Math.hypot(t.transform[2],t.transform[3])||t.height).sort((a,b)=>a-b)
  const normal=sizes[Math.floor(sizes.length/2)] || 12
  const lines: {y:number;x:number;size:number;end:number;text:string}[]=[]
  let complex=false
  for(const item of [...source].sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
    const [,,,,x,y]=item.transform;const size=Math.hypot(item.transform[2],item.transform[3])||item.height
    if(Math.abs(item.transform[1])>0.01 || Math.abs(item.transform[2])>0.01) complex=true
    let line=lines.find(l=>Math.abs(l.y-y)<Math.min(normal,size)*0.3)
    if(!line){line={y,x,size,end:x,text:''};lines.push(line)}
    const gap=x-line.end
    if(line.text && gap>normal*4) complex=true
    const space=line.text&&gap>normal*0.15&&!/[\u3400-\u9fff]$/.test(line.text)&&!/^[\u3400-\u9fff]/.test(item.str)?' ':''
    line.text+=space+item.str;line.end=x+item.width;line.size=Math.max(line.size,size)
  }
  const blocks:string[]=[]; let paragraph=''
  const flush=()=>{if(paragraph){blocks.push(paragraph);paragraph=''}}
  for(let i=0;i<lines.length;i++){
    const line=lines[i];const text=line.text.trim().replace(/([\\\x60*_{}[\]<>])/g,'\\$1')
    const bullet=text.match(/^(?:[•●▪·]|[-–])\s+(.+)$/)
    const numbered=text.match(/^(\d{1,3})[.)]\s+(.+)$/)
    if(line.size>normal*1.24&&text.length<120){flush();blocks.push((line.size>normal*1.6?'## ':'### ')+text)}
    else if(bullet||numbered){flush();blocks.push(bullet?'- '+bullet[1]:numbered![1]+'. '+numbered![2])}
    else {
      if(i&&lines[i-1].y-line.y>normal*1.8) flush()
      paragraph+=(paragraph&&!/[\u3400-\u9fff]$/.test(paragraph)&&!/^[\u3400-\u9fff]/.test(text)?' ':'')+text
    }
  }
  flush()
  return {markdown:blocks.join('\n\n'),complex}
}
