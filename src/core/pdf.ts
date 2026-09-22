import * as pdfjs from 'pdfjs-dist'
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { LIMITS, newDraft, type Asset } from './types'
import { fileMime } from './content'
pdfjs.GlobalWorkerOptions.workerSrc = workerURL
import { organizeText } from './pdf-text'
export interface PageReport { page: number; kind:'text'|'scan'|'complex'; characters:number; images:number; warnings:string[] }
function canvasPNG(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve,reject)=>canvas.toBlob(async blob=>blob?resolve(new Uint8Array(await blob.arrayBuffer())):reject(new Error('页面图片生成失败')),'image/png'))
}
async function imagePNG(img: any): Promise<Uint8Array | null> {
  if(!img||!img.width||!img.height) return null
  if(img.width*img.height>LIMITS.imagePixels) throw new Error('PDF 中独立图片超过 1600 万像素')
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d')!
  if(img.bitmap) ctx.drawImage(img.bitmap,0,0)
  else if(img.data) {
    const rgba=new Uint8ClampedArray(img.width*img.height*4)
    for(let i=0;i<img.width*img.height;i++){
      if(img.kind===pdfjs.ImageKind.RGBA_32BPP){rgba.set(img.data.subarray(i*4,i*4+4),i*4);continue}
      if(img.kind===pdfjs.ImageKind.RGB_24BPP){rgba[i*4]=img.data[i*3];rgba[i*4+1]=img.data[i*3+1];rgba[i*4+2]=img.data[i*3+2]}
      else {const row=Math.floor(i/img.width);const col=i%img.width;const v=(img.data[row*Math.ceil(img.width/8)+(col>>3)]>>(7-(col&7)))&1;rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=v*255}
      rgba[i*4+3]=255
    }
    ctx.putImageData(new ImageData(rgba,img.width,img.height),0,0)
  } else return null
  const bytes=await canvasPNG(canvas);canvas.width=canvas.height=0;return bytes
}
export async function importPDF(file: File, base: string, originalOnly=false, progress:(page:number,total:number)=>void=()=>{}, signal?:AbortSignal) {
  if(file.size>LIMITS.file) throw new Error('PDF 超过 20 MB')
  const bytes=new Uint8Array(await file.arrayBuffer());fileMime('original.pdf',bytes)
  const draft=newDraft();draft.title=file.name.replace(/\.pdf$/i,'');draft.slug='pdf-'+Date.now().toString(36)
  draft.assets=[{path:'assets/original.pdf',bytes,mime:'application/pdf'}]
  const original='[阅读 / 下载原 PDF](assets/original.pdf)'
  draft.markdown=original;const reports:PageReport[]=[]
  if(originalOnly)return {draft,reports}
  const task=pdfjs.getDocument({ data:bytes.slice(), enableXfa:false,
    cMapUrl:base+'pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:base+'pdfjs/standard_fonts/',wasmUrl:base+'pdfjs/wasm/' })
  const abort=()=>{void task.destroy()};signal?.addEventListener('abort',abort,{once:true})
  let totalBytes=bytes.length
  const add=(asset:Asset)=>{totalBytes+=asset.bytes.length;if(asset.bytes.length>LIMITS.file||totalBytes>LIMITS.total||draft.assets.length>=LIMITS.files)throw new Error('转换资源超限，请选择“保留原 PDF”');draft.assets.push(asset)}
  const parts=[original,'> PDF 转换草稿。请对照原文件检查标题、顺序、表格、公式与图片位置。']
  try {
    const doc=await task.promise
    if(doc.numPages>LIMITS.pages)throw new Error('转换最多 40 页，请选择“保留原 PDF”')
    for(let n=1;n<=doc.numPages;n++){
      if(signal?.aborted)throw new Error('已取消转换')
      progress(n,doc.numPages)
      const page=await doc.getPage(n); const text=await page.getTextContent()
      const items=text.items.filter((x):x is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in x)
      const characters=items.reduce((sum,x)=>sum+x.str.trim().length,0)
      const organized=organizeText(items)
      const warnings:string[]=[]
      const viewport0=page.getViewport({scale:1})
      const scale=Math.min(1.5,1600/viewport0.width,2200/viewport0.height)
      const viewport=page.getViewport({scale});const canvas=document.createElement('canvas')
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
      await page.render({canvas,viewport}).promise
      const ops=await page.getOperatorList();let imageCount=0;let failedImage=false;let vectors=0;const seen=new Set<string>()
      const images:string[]=[]
      for(let i=0;i<ops.fnArray.length;i++){
        const op=ops.fnArray[i];const args=ops.argsArray[i]
        if(op===pdfjs.OPS.constructPath)vectors++
        let img:any
        if(op===pdfjs.OPS.paintImageXObject || op===pdfjs.OPS.paintImageXObjectRepeat){
          const id=args[0] as string;if(seen.has(id))continue;seen.add(id)
          try{img=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('图片读取超时')),5000);(id.startsWith('g_')?page.commonObjs:page.objs).get(id,(value:unknown)=>{clearTimeout(timer);resolve(value)})})}catch{failedImage=true;continue}
        } else if(op===pdfjs.OPS.paintInlineImageXObject)img=args[0]
        else if(op===pdfjs.OPS.paintImageMaskXObject || op===pdfjs.OPS.paintInlineImageXObjectGroup) {failedImage=true;continue}
        else continue
        if(characters<8)continue
        const out=await imagePNG(img)
        if(out){const path='assets/page-'+n+'-image-'+(++imageCount)+'.png';add({path,bytes:out,mime:'image/png'});images.push('![第 '+n+' 页图片 '+imageCount+']('+path+')')}
        else failedImage=true
      }
      const complex=organized.complex||failedImage||vectors>25
      const kind:PageReport['kind']=characters<8?'scan':complex?'complex':'text'
      const chunk=['## 第 '+n+' 页']
      if(characters>=8)chunk.push(organized.markdown)
      if(images.length){chunk.push(...images);warnings.push('独立图片已提取，需检查其位置；裁剪、遮罩与叠加效果以原 PDF 为准')}
      if(kind!=='text'){
        const path='assets/page-'+n+'.png';add({path,bytes:await canvasPNG(canvas),mime:'image/png'})
        chunk.push('![第 '+n+' 页原貌]('+path+')')
        warnings.push(kind==='scan'?'本页文字很少或无法提取，保留页面图像；未进行 OCR':'检测到复杂布局或图形，附页面图像供对照；文本顺序及表格、公式需人工检查')
      } else warnings.push('文本按位置整理为段落、标题或列表；请校对阅读顺序')
      reports.push({page:n,kind,characters,images:imageCount,warnings})
      parts.push(chunk.join('\n\n'));canvas.width=canvas.height=0;page.cleanup()
    }
    draft.markdown=parts.join('\n\n---\n\n');return {draft,reports}
  } catch(error) {
    if(signal?.aborted)throw new Error('已取消转换')
    const name=(error as Error).name
    throw new Error(name==='PasswordException'?'PDF 有密码保护，请先在本地解锁，或选择保留原 PDF':(error as Error).message || '转换失败；可选择保留原 PDF')
  } finally {signal?.removeEventListener('abort',abort);await task.destroy()}
}

