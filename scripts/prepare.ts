import fs from 'node:fs/promises'
import path from 'node:path'
import { stringify } from 'yaml'
import site from '../site.config'
import { parseMarkdown, safePath, fileMime, validateSlug } from '../src/core/content'
import { renderMarkdown, localResource } from '../src/core/markdown'
import { LIMITS, type PostMeta } from '../src/core/types'
const root=process.cwd();const base=process.env.BLOG_BASE || site.base
if(!/^\/(?:[a-zA-Z0-9_.-]+\/)*$/.test(base))throw new Error('BLOG_BASE 必须是 / 或 /仓库名/ 形式')
const generated=['docs/posts','docs/public/posts','docs/.vitepress/generated']
for(const dir of generated){const target=path.resolve(root,dir);if(!target.startsWith(root+path.sep))throw new Error('路径越界');await fs.rm(target,{recursive:true,force:true});await fs.mkdir(target,{recursive:true})}
const posts:PostMeta[]=[];const search:PostMeta[]=[]
const contentRoot=process.env.CONTENT_ROOT||'content/posts'
await fs.mkdir(contentRoot,{recursive:true})
const entries=await fs.readdir(contentRoot,{withFileTypes:true})
for(const entry of entries){
  if(!entry.isDirectory())throw new Error('文章根目录仅允许文章文件夹')
  const slug=validateSlug(entry.name);const folder=contentRoot+'/'+slug
  const markdown=await fs.readFile(folder+'/index.md','utf8');const parsed=parseMarkdown(markdown)
  if(!parsed.title||!parsed.date)throw new Error(slug+' 缺少 title 或 date')
  let total=0,count=0
  const assetPaths=new Set<string>()
  const copy=async(dir:string,prefix:string)=>{
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw new Error('不允许符号链接：'+entry.name)
      const name=safePath(prefix+entry.name)
      if(entry.isDirectory())await copy(dir+'/'+entry.name,name+'/')
      else {
        const bytes=await fs.readFile(dir+'/'+entry.name);total+=bytes.length;count++
        if(bytes.length>LIMITS.file||total>LIMITS.total||count>LIMITS.files)throw new Error(slug+' 资源超限')
        fileMime(name,bytes);assetPaths.add(name)
        const dest='docs/public/posts/'+slug+'/'+name;await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes)
      }
    }
  }
  try{await fs.access(folder+'/assets');await copy(folder+'/assets','assets/')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  const rendered=renderMarkdown(parsed.markdown,{resolveAsset(url,image){
    const local=localResource(url);if(local===null)return image?undefined:url
    let asset:string;try{asset=safePath(local)}catch{return undefined}
    return assetPaths.has(asset)?base+'posts/'+slug+'/'+asset.split('/').map(encodeURIComponent).join('/')+(url.includes('#')?'#'+encodeURIComponent(url.split('#')[1]):''):undefined
  }})
  if(rendered.missing.length)throw new Error(slug+' 缺少本地资源或含外链图片：'+rendered.missing.join(', '))
  const pdfs=[...assetPaths].filter(p=>p.endsWith('.pdf')).map(p=>({name:p.split('/').pop(),url:base+'posts/'+slug+'/'+p.split('/').map(encodeURIComponent).join('/')}))
  const frontmatter={layout:'article',title:parsed.title,date:parsed.date,tags:parsed.tags,slug,body:rendered.html,headings:rendered.headings,pdfs}
  await fs.writeFile('docs/posts/'+slug+'.md','---\n'+stringify(frontmatter)+'---\n')
  const meta={slug,title:parsed.title,date:parsed.date,tags:parsed.tags};posts.push(meta)
  search.push({...meta,text:parsed.markdown.replace(/[#*>\x60[\]()]/g,' ').slice(0,100000)})
}
posts.sort((a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug))
await fs.writeFile('docs/.vitepress/generated/posts.json',JSON.stringify(posts))
await fs.writeFile('docs/public/search.json',JSON.stringify(search))
const pdfRoot=path.dirname(import.meta.resolve('pdfjs-dist/package.json').replace(/^file:\/\/\//,process.platform==='win32'?'':'/'))
for(const dir of ['cmaps','standard_fonts','wasm']){
  await fs.mkdir('docs/public/pdfjs',{recursive:true})
  await fs.cp(path.join(decodeURIComponent(pdfRoot),dir),'docs/public/pdfjs/'+dir,{recursive:true})
}
if(site.origin) {
  const origin=new URL(site.origin);if(!['https:','http:'].includes(origin.protocol))throw new Error('origin 无效')
}
console.log('Prepared '+posts.length+' posts; base='+base)

