import { Unzip, UnzipInflate, zipSync, strToU8 } from 'fflate'
import { safePath, fileMime, parseMarkdown, serializeDraft, validateDraft } from './content'
import { renderMarkdown, localResource } from './markdown'
import { LIMITS, newDraft, type Draft, type Asset } from './types'
export interface InputFile { path: string; bytes: Uint8Array }
export function unpackZip(bytes: Uint8Array): InputFile[] {
  if (bytes.length > LIMITS.zip) throw new Error('ZIP 超过 30 MB')
  const entries: InputFile[] = []; const paths = new Set<string>(); let total=0; let count=0
  const unzip = new Unzip(file => {
    if (++count > LIMITS.files + 20) throw new Error('ZIP 文件过多')
    const path = safePath(file.name.replace(/\/$/,''))
    if (file.name.endsWith('/')) return
    if (paths.has(path.toLowerCase())) throw new Error('ZIP 含重复路径')
    paths.add(path.toLowerCase())
    if (file.originalSize && file.originalSize > LIMITS.file) throw new Error('ZIP 内文件超过 20 MB')
    const chunks: Uint8Array[] = []; let size=0
    file.ondata=(error, chunk, final) => {
      if (error) throw new Error('ZIP 解压失败')
      size += chunk.length; total += chunk.length
      if (size > LIMITS.file || total > LIMITS.total) { file.terminate(); throw new Error('ZIP 解压体积超限') }
      chunks.push(chunk)
      if (final) { const bytes = new Uint8Array(size); let offset=0; for(const chunk of chunks){ bytes.set(chunk,offset);offset+=chunk.length } entries.push({path,bytes}) }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  // Feed small chunks to bound the amount produced before the budget check.
  for (let i=0;i<bytes.length;i+=1024) unzip.push(bytes.subarray(i,i+1024), i+1024>=bytes.length)
  return entries
}
function normalizeRelative(base: string, ref: string) {
  let decoded: string
  try { decoded = decodeURIComponent(ref) } catch { throw new Error('图片路径编码无效') }
  if (/^[\\/]|[:\\\x00-\x1f]/.test(decoded)) throw new Error('不支持绝对资源路径：'+ref)
  const parts=base.split('/').filter(Boolean)
  for (const part of decoded.split('/')) { if(part==='..'){if(!parts.length)throw new Error('资源路径越界');parts.pop()} else if(part!=='.'&&part)parts.push(part) }
  return safePath(parts.join('/'))
}
export function importFiles(files: InputFile[], markdownPath?: string): Draft {
  if (files.length>LIMITS.files+1) throw new Error('导入文件超过 151 个')
  let total=0; const map=new Map<string, InputFile>(); const casePaths=new Set<string>()
  for (const f of files) {
    f.path=safePath(f.path); total+=f.bytes.length
    if (f.bytes.length>LIMITS.file || total>LIMITS.total) throw new Error('导入文件体积超限')
    if (casePaths.has(f.path.toLowerCase())) throw new Error('重复文件名：'+f.path)
    casePaths.add(f.path.toLowerCase()); map.set(f.path,f)
  }
  const candidates=files.filter(f=>/\.md$/i.test(f.path))
  const selected=markdownPath ? map.get(markdownPath) : candidates.length===1 ? candidates[0] : undefined
  if(!selected) throw new Error(candidates.length>1?'请在文章选择框中选择一个 Markdown 文件':'没有找到 Markdown 文件')
  const parsed=parseMarkdown(new TextDecoder('utf-8',{fatal:true}).decode(selected.bytes))
  const d=newDraft(); Object.assign(d,parsed); if(!d.date)d.date=new Date().toLocaleDateString('sv-SE')
  d.slug=selected.path.split('/').pop()!.replace(/\.md$/i,'').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/^-+|-+$/g,'')
  if(!d.slug || d.slug==='index') d.slug='note-'+Date.now().toString(36)
  const base=selected.path.split('/').slice(0,-1).join('/')
  const replacements=new Map<string,string>()
  const sourceAssets=new Map<string,Asset>()
  // Parse with markdown-it so ordinary, angle-bracket and reference-style links share one resolver.
  renderMarkdown(d.markdown,{resolveAsset(url,image){
    const ref=localResource(url); if(ref===null) return url
    const source=normalizeRelative(base,ref); const file=map.get(source)
    if(!file) return undefined
    const mime=fileMime(source,file.bytes)
    if(image&&!mime.startsWith('image/')) throw new Error('图片引用不是图片：'+source)
    const name=source.split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g,'-')
    let asset=sourceAssets.get(source)
    if(!asset){ asset={path:'assets/'+String(d.assets.length+1).padStart(3,'0')+'-'+name,bytes:file.bytes,mime}; d.assets.push(asset) }
    sourceAssets.set(source,asset);replacements.set(url,asset.path); return asset.path
  }})
  // Replace only exact URL spellings; longest first also supports reference definition destinations.
  for(const [from,to] of [...replacements].sort((a,b)=>b[0].length-a[0].length)) {
    const spellings=[from,decodeURIComponent(from)]
    for(const spelling of new Set(spellings)) {
      const escaped=spelling.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
      d.markdown=d.markdown.replace(new RegExp('(\\]\\(<?)'+escaped+'(?=>?(?:[\\s)]))','g'),'$1'+to)
      d.markdown=d.markdown.replace(new RegExp('(^[ \\t]{0,3}\\[[^\\]\\n]+\\]:[ \\t]*<?)'+escaped+'(?=>?(?:\\s|$))','gm'),'$1'+to)
    }
  }
  // Preserve unreferenced resources too, including the original PDF in an exported draft.
  for(const file of files){
    if(file===selected||sourceAssets.has(file.path)||!(/\.(png|jpe?g|gif|webp|pdf)$/i.test(file.path)))continue
    const mime=fileMime(file.path,file.bytes)
    const name=file.path.split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g,'-')
    d.assets.push({path:'assets/'+String(d.assets.length+1).padStart(3,'0')+'-'+name,bytes:file.bytes,mime})
  }
  return d
}
export function draftProblems(d: Draft): string[] {
  const available=new Set(d.assets.map(a=>a.path))
  const result=renderMarkdown(d.markdown,{resolveAsset(url,image){
    const ref=localResource(url)
    if(ref===null) return image ? undefined : url
    let path:string;try{path=safePath(ref)}catch{return undefined}
    return available.has(path)?path:undefined
  }})
  return result.missing
}
export function exportDraft(d: Draft): Uint8Array {
  validateDraft(d)
  const files: Record<string,Uint8Array> = { 'index.md':strToU8(serializeDraft(d)) }
  for (const a of d.assets) files[a.path]=a.bytes
  return zipSync(files,{level:6})
}
export async function readFiles(files: FileList | File[]): Promise<InputFile[]> {
  let total=0; const list=Array.from(files)
  if(list.length>LIMITS.files+1) throw new Error('导入文件过多')
  for(const f of list){total+=f.size;if(f.size>LIMITS.file||total>LIMITS.total)throw new Error('导入文件体积超限')}
  return Promise.all(list.map(async f=>({path:f.webkitRelativePath||f.name,bytes:new Uint8Array(await f.arrayBuffer())})))
}
