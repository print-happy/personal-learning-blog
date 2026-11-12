import type MarkdownIt from 'markdown-it'
import katex from 'katex'
import sanitizeHtml from 'sanitize-html'
const MAX_FORMULA=16_384,MAX_TOTAL=131_072,MAX_COUNT=256
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const length=/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:em|ex|px|%)?$/
const dimensionProperties='height width min-width max-width top bottom left right vertical-align margin-left margin-right margin-top margin-bottom padding-left padding-right padding-top padding-bottom border-top-width border-bottom-width font-size'.split(' ')
const styles:Record<string,RegExp[]>={color:[/^(?:#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d., %]+\))$/i]}
for(const property of dimensionProperties)styles[property]=[length]
export function sanitizeMath(html:string){return sanitizeHtml(html,{
 allowedTags:['span','svg','path','line'],
 allowedAttributes:{span:['class','style','aria-hidden'],svg:['xmlns','width','height','viewBox','preserveAspectRatio'],path:['d'],line:['x1','x2','y1','y2','stroke-width']},
 allowedStyles:{span:styles},allowedSchemes:[],parser:{lowerCaseAttributeNames:false},
})}
const cache=new Map<string,string>();let cacheBytes=0
interface MathEnvironment {notesMath?:string[];notesMathBytes?:number}
function mathMarkup(source:string,display:boolean,env:MathEnvironment){
 const error=(message:string)=>'<span class="math-error" title="'+escape(message)+'">'+escape((display?'$$':'$')+source+(display?'$$':'$'))+'</span>'
 if(source.length>MAX_FORMULA)return error('公式过长，请拆分')
 env.notesMathBytes=(env.notesMathBytes||0)+source.length
 if(env.notesMathBytes>MAX_TOTAL||(env.notesMath?.length||0)>=MAX_COUNT)return error('本文公式较多，请拆分笔记后继续渲染')
 const key=(display?'D':'I')+source,cached=cache.get(key)
 if(cached){cache.delete(key);cache.set(key,cached);return cached}
 try{
  const rendered=katex.renderToString(source,{displayMode:display,output:'html',throwOnError:true,trust:false,strict:'ignore',maxSize:20,maxExpand:1000,macros:Object.create(null)})
  const result='<span class="notes-math'+(display?' math-block':'')+'" role="math" aria-label="'+escape(source)+'">'+sanitizeMath(rendered)+'</span>'
  if(result.length<262144){cache.set(key,result);cacheBytes+=2*(key.length+result.length);while(cache.size>128||cacheBytes>4*1024*1024){const oldest=cache.keys().next().value!;cacheBytes-=2*(oldest.length+cache.get(oldest)!.length);cache.delete(oldest)}}
  return result
 }catch{return error('公式无法解析，请检查 LaTeX 写法')}
}
function closeAt(source:string,from:number,delimiter:string,limit:number){
 let at=from
 while((at=source.indexOf(delimiter,at))>=0&&at<=limit){
  let slashes=0;for(let i=at-1;i>=0&&source[i]==='\\';i--)slashes++
  if(slashes%2===0)return at
  at+=delimiter.length
 }
 return -1
}
export function mathPlugin(md:MarkdownIt){
 md.inline.ruler.before('escape','notes_math',(state,silent)=>{
  const start=state.pos,source=state.src
  if(source[start]!=='$')return false
  const display=source[start+1]==='$',delimiter=display?'$$':'$',size=delimiter.length
  // Preserve currency, escaped dollars, empty and unfinished delimiters literally.
  if(source[start+size]==='$'||(!display&&/\s/.test(source[start+1]||' '))){if(!silent)state.pending+=delimiter;state.pos+=size;return true}
  const end=closeAt(source,start+size,delimiter,Math.min(source.length,start+MAX_FORMULA+size))
  if(end<0||end===start+size||(!display&&(/\s/.test(source[end-1])||/\d/.test(source[end+1]||'')||source.slice(start+1,end).includes('\n')))){
   if(!silent)state.pending+=delimiter;state.pos+=size;return true
  }
  if(!silent){const token=state.push(display?'notes_math_block':'notes_math_inline','',0);token.content=source.slice(start+size,end)}
  state.pos=end+size;return true
 })
 md.block.ruler.before('fence','notes_math',(state,startLine,endLine,silent)=>{
  const start=state.bMarks[startLine]+state.tShift[startLine]
  if(state.sCount[startLine]-state.blkIndent>=4||state.src.slice(start,start+2)!=='$$'||state.src[start+2]==='$')return false
  let closing=-1,last=startLine
  const maxLine=Math.min(endLine,startLine+256)
  for(;last<maxLine;last++){
   const from=last===startLine?start+2:state.bMarks[last]+state.tShift[last]
   const candidate=closeAt(state.src,from,'$$',state.eMarks[last])
   if(candidate>=0&&state.src.slice(candidate+2,state.eMarks[last]).trim()===''){closing=candidate;break}
  }
  if(closing<0)return false
  if(silent)return true
  const first=state.src.slice(start+2,last===startLine?closing:state.eMarks[startLine])
  const middle=last>startLine?state.getLines(startLine+1,last,state.blkIndent,false):''
  const tail=last>startLine?state.src.slice(state.bMarks[last]+state.tShift[last],closing):''
  const token=state.push('notes_math_block','',0);token.block=true;token.map=[startLine,last+1];token.content=(first+(last>startLine?'\n'+middle+tail:'')).trim()
  state.line=last+1;return true
 },{alt:['paragraph','reference','blockquote','list']})
 const render=(tokens:any[],index:number,_options:any,environment:MathEnvironment)=>{
  const list=environment.notesMath||(environment.notesMath=[]),token=tokens[index]
  const html=mathMarkup(token.content,token.type==='notes_math_block',environment),id=list.length
  list.push(html);return '<span class="notes-math-slot" data-math-index="'+id+'"></span>'+(token.block?'\n':'')
 }
 md.renderer.rules.notes_math_inline=render;md.renderer.rules.notes_math_block=render
}
export function restoreMath(html:string,environment:MathEnvironment){
 return html.replace(/<span class="notes-math-slot" data-math-index="(\d+)"><\/span>/g,(_,id)=>environment.notesMath?.[Number(id)]||'')
}
