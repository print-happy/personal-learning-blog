<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { useData } from 'vitepress'
import { Download, Upload, ImagePlus, Link, FileText, Plus, Save, Send, RefreshCw, Trash2 } from 'lucide-vue-next'
import MarkdownEditor from './MarkdownEditor.vue'
import WritingWorkspace from './WritingWorkspace.vue'
import { newDraft, cloneDraft, LIMITS, type Draft, type Asset } from '../core/types'
import { fileMime, validateDraft } from '../core/content'
import { importFiles, unpackZip, exportDraft, readFiles, draftProblems, type InputFile } from '../core/importer'
import { renderMarkdown, localResource } from '../core/markdown'
import { saveDraft, listDrafts, deleteDraft } from '../core/drafts'
import { GitHub, type RepoConfig, type PublishStatus, type Receipt } from '../core/github'
import type { PageReport } from '../core/pdf'
import site from '../../site.config'
const {site:siteData}=useData()
const draft=ref<Draft>(newDraft()), saved=ref<Draft[]>([]), notice=ref(''), error=ref(''), saveNote=ref('本地草稿')
const busy=ref(false), reviewed=ref(false), tab=ref('edit'), markdownEditor=ref<InstanceType<typeof MarkdownEditor>>()
const importing=ref<InputFile[]>([]), mdChoices=ref<string[]>([]), chosenMD=ref(''), reports=ref<PageReport[]>([])
const originalOnly=ref(false), lastPDF=ref<File>(), conversionProgress=ref(''), converting=ref(false)
const config=ref<RepoConfig>({...site.github}),token=ref(''),receipt=ref<Receipt>(),status=ref<PublishStatus>(),remoteSlug=ref('')
const settingsOpen=ref(false),preview=ref(''), problems=ref<string[]>([]),urls=ref<Record<string,string>>({})
const previewImages=ref<Record<string,string>>({})
const tagInput=computed({get:()=>draft.value.tags.join('，'),set:(v:string)=>{draft.value.tags=v.split(/[,，]/).map(x=>x.trim()).filter(Boolean)}})
const assetInput=ref<HTMLInputElement>(), replaceInput=ref<HTMLInputElement>();let replacing=''
let saveTimer:ReturnType<typeof setTimeout>|undefined, previewTimer:ReturnType<typeof setTimeout>|undefined, pollTimer:ReturnType<typeof setTimeout>|undefined
let abort:AbortController|undefined;let alive=true;let hydration=false;let savedRevision=0;let revision=0
function fail(e:unknown){error.value=e instanceof Error?e.message:'操作失败，请重试';notice.value='';if(error.value==='请先填写发布设置中的访问令牌')settingsOpen.value=true}
function download(bytes:Uint8Array,name:string,mime='application/zip'){const url=URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function escape(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}
function updatePreview() {
  try {
    if(new TextEncoder().encode(draft.value.markdown).length>LIMITS.markdown)throw new Error('正文超过 2 MB，请缩短后继续')
    const rendered=renderMarkdown(draft.value.markdown,{resolveAsset(url,image){const ref=localResource(url);return ref===null?(image?undefined:url):(image?previewImages.value[ref]:urls.value[ref])}})
    problems.value=draftProblems(toRaw(draft.value))
    preview.value='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><style>body{font:16px/1.85 Segoe UI,Microsoft YaHei,sans-serif;color:#273738;background:#fff;padding:24px;margin:0;overflow-wrap:anywhere}h1{font-size:27px;line-height:1.45}h2{font-size:22px;margin-top:1.8em}h3{font-size:18px}img{max-width:100%;border-radius:14px}pre{background:#f1f5f5;border-radius:14px;padding:18px;white-space:pre-wrap;font:13px/1.7 Consolas,monospace}code{font-family:Consolas,monospace}blockquote{background:#edf5f5;border-radius:12px;padding:15px;margin:20px 0}a{color:#246d72}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:9px;text-align:left}hr{border:0;border-top:1px solid #ddd;margin:26px 0}.hljs-keyword{color:#92529b}.hljs-string{color:#39715d}</style></head><body><h1>'+escape(draft.value.title||'未命名草稿')+'</h1>'+rendered.html+'</body></html>'
  } catch(e){fail(e)}
}
function refreshAssets(){Object.values(urls.value).forEach(URL.revokeObjectURL);const next:Record<string,string>={};for(const a of draft.value.assets)next[a.path]=URL.createObjectURL(new Blob([a.bytes.slice().buffer as ArrayBuffer],{type:a.mime}));urls.value=next;const previews:Record<string,string>={};for(const a of draft.value.assets){if(a.mime.startsWith('image/')){let binary='';for(let i=0;i<a.bytes.length;i+=8192)binary+=String.fromCharCode(...a.bytes.subarray(i,i+8192));previews[a.path]='data:'+a.mime+';base64,'+btoa(binary)}}previewImages.value=previews;updatePreview()}
async function persist(silent=false) {
  if(hydration)return
  clearTimeout(saveTimer)
  const atRevision=revision
  try {const timestamp=await saveDraft(toRaw(draft.value));savedRevision=Math.max(savedRevision,atRevision);saveNote.value='已保存于 '+new Date(timestamp).toLocaleTimeString('zh-CN');saved.value=await listDrafts();if(!silent)notice.value='草稿已保存在此浏览器'}
  catch{saveNote.value='草稿未保存';error.value='浏览器存储不可用或空间不足，请立即下载文章包备份';throw new Error(error.value)}
}
async function switchDraft(next:Draft) {
  try {if(draft.value.title||draft.value.markdown||draft.value.assets.length)await persist(true)
    hydration=true;draft.value=next;revision++;reports.value=[];refreshAssets();reviewed.value=false;await Promise.resolve();hydration=false;await persist(true)
  }catch(e){hydration=false;fail(e)}
}
async function fresh(){await switchDraft(newDraft())}
async function restore(d:Draft){await switchDraft(cloneDraft(d))}
async function removeDraft(d:Draft){if(!confirm('删除此浏览器中的草稿“'+(d.title||'未命名')+'”？'))return;try{await deleteDraft(d.id);saved.value=await listDrafts();if(d.id===draft.value.id){hydration=true;draft.value=newDraft();refreshAssets();await Promise.resolve();hydration=false}}catch(e){fail(e)}}
async function readImport(event:Event) {
  error.value='';const input=event.target as HTMLInputElement
  try {if(!input.files?.length)return
    const first=input.files[0]
    const files=input.files.length===1&&/\.zip$/i.test(first.name)?(first.size>LIMITS.zip?(()=>{throw new Error('ZIP 超过 30 MB')})():unpackZip(new Uint8Array(await first.arrayBuffer()))):await readFiles(input.files)
    importing.value=files;mdChoices.value=files.filter(f=>/\.md$/i.test(f.path)).map(f=>f.path)
    if(mdChoices.value.length===1){chosenMD.value=mdChoices.value[0];await finishImport()}
    else if(!mdChoices.value.length)throw new Error('没有找到 Markdown 文件')
    else chosenMD.value=mdChoices.value[0]
  }catch(e){fail(e)}finally{input.value=''}
}
async function finishImport(){try{const next=importFiles(toRaw(importing.value),chosenMD.value);await switchDraft(next);mdChoices.value=[];importing.value=[];notice.value='已导入'}catch(e){fail(e)}}
async function addAssets(files:File[],replace=false) {
  error.value=''
  try {
    let total=draft.value.assets.reduce((n,a)=>n+a.bytes.length,0)
    if(draft.value.assets.length+files.length>LIMITS.files)throw new Error('资源超过 150 个')
    const added:Asset[]=[]
    for(const file of files){
      if(file.size>LIMITS.file)throw new Error('单个资源超过 20 MB')
      total+=file.size;if(total>LIMITS.total)throw new Error('资源总量超过 50 MB')
      const bytes=new Uint8Array(await file.arrayBuffer());const mime=fileMime(file.name,bytes)
      const extension=file.name.split('.').pop()!.toLowerCase()
      const asset={path:'assets/'+crypto.randomUUID().slice(0,12)+'.'+extension,bytes,mime}
      added.push(asset)
    }
    if(replace&&added[0]){
      const index=draft.value.assets.findIndex(a=>a.path===replacing)
      if(index>=0){draft.value.markdown=draft.value.markdown.split(replacing).join(added[0].path);draft.value.assets.splice(index,1,added[0])}
    } else {draft.value.assets.push(...added);for(const a of added)insertAsset(a)}
    revision++;reviewed.value=false;refreshAssets();await persist(true)
  }catch(e){fail(e)}
}
function insertAsset(a:Asset){markdownEditor.value?.insert((a.mime.startsWith('image/')?'!':'')+'['+(a.mime.startsWith('image/')?'图片':a.path.split('/').pop())+']('+a.path+')\n\n')}
function selectReplacement(a:Asset){if(a.mime==='application/pdf'){error.value='原 PDF 保留，不支持替换';return}replacing=a.path;replaceInput.value?.click()}
async function removeAsset(a:Asset){if(a.mime==='application/pdf'){error.value='原 PDF 必须保留';return}if(!confirm('删除资源？引用它的正文也需要修改。'))return;draft.value.assets=draft.value.assets.filter(x=>x.path!==a.path);revision++;reviewed.value=false;refreshAssets();try{await persist(true)}catch{}}
async function pdfChange(event:Event){const input=event.target as HTMLInputElement;if(input.files?.[0]){lastPDF.value=input.files[0];await convertPDF()}input.value=''}
async function convertPDF() {
  if(!lastPDF.value)return
  converting.value=true;error.value='';abort=new AbortController()
  const timeout=setTimeout(()=>abort?.abort(),120000)
  try {const {importPDF}=await import('../core/pdf');const result=await importPDF(lastPDF.value,siteData.value.base,originalOnly.value,(p,n)=>conversionProgress.value='正在处理第 '+p+' / '+n+' 页',abort.signal);await switchDraft(result.draft);reports.value=result.reports;notice.value=originalOnly.value?'已添加 PDF':'已导入，请检查预览'}
  catch(e){fail(e)}finally{converting.value=false;conversionProgress.value='';clearTimeout(timeout)}
}
function cancelPDF(){abort?.abort()}
function exportPackage(){try{download(exportDraft(toRaw(draft.value)),draft.value.slug+'.zip');notice.value='已下载'}catch(e){fail(e)}}
function storeReceipt(r:Receipt){receipt.value=r;try{localStorage.setItem('blog-publish-receipt',JSON.stringify(r))}catch{}}
function updateStatus(s:PublishStatus){status.value=s;if(s.receipt)storeReceipt(s.receipt)}
async function loadRemote(){
  busy.value=true;error.value=''
  let client:GitHub|undefined
  try{client=new GitHub(toRaw(config.value),token.value);const next=await client.load(remoteSlug.value);await switchDraft(next);notice.value='已打开文章'}
  catch(e){fail(e)}finally{client?.clear();busy.value=false}
}
async function publish(){
  if(!reviewed.value||busy.value)return
  busy.value=true;error.value='';clearTimeout(pollTimer);receipt.value=undefined;status.value=undefined;let client:GitHub|undefined
  try {
    const snapshot=cloneDraft(draft.value);validateDraft(snapshot)
    if(draftProblems(snapshot).length)throw new Error('请先补齐缺失资源')
    await persist(true);client=new GitHub({...toRaw(config.value)},token.value)
    const r=await client.publish(snapshot,updateStatus);storeReceipt(r)
    if(snapshot.remote){draft.value.remote=snapshot.remote;await persist(true)}
    if(r.confirmed)void refreshStatus(true)
  }catch(e){fail(e);if(!(receipt.value as Receipt|undefined)?.confirmed)status.value={stage:'failed',message:error.value||'发布失败，请重试'} }
  finally{client?.clear();busy.value=false}
}
async function removeRemote(){
  if(busy.value||converting.value||!draft.value.remote)return
  busy.value=true;error.value='';let client:GitHub|undefined
  try {
    const snapshot=cloneDraft(draft.value)
    client=new GitHub({...toRaw(config.value)},token.value)
    await client.assertOwner()
    if(!confirm('删除已发布文章“'+snapshot.title+'”（'+snapshot.slug+'）？\n目标：'+config.value.owner+'/'+config.value.repo+'，分支 '+config.value.branch+'\n文章及全部图片、PDF 附件将在部署完成后下线。本地草稿会保留。'))return
    await persist(true);clearTimeout(pollTimer);receipt.value=undefined;status.value=undefined
    const r=await client.remove(snapshot,updateStatus);storeReceipt(r)
    if(r.confirmed)void refreshStatus(true)
  }catch(e){fail(e)}finally{client?.clear();busy.value=false}
}
async function refreshStatus(automatic=false){
  if(!receipt.value)return
  let client:GitHub|undefined
  try {client=new GitHub(receipt.value.config,token.value);const s=await client.status(toRaw(receipt.value));updateStatus(s);if(automatic&&!['deployed','failed','unknown'].includes(s.stage))pollTimer=setTimeout(()=>{if(alive&&token.value)void refreshStatus(true)},15000)}
  catch(e){if(!automatic)fail(e);else status.value={stage:'saved',message:'内容保存记录已保留，状态查询暂不可用。请稍后刷新',receipt:receipt.value}}
  finally{client?.clear()}
}
function clearToken(){token.value='';clearTimeout(pollTimer)}
function beforeLeave(e:BeforeUnloadEvent){clearToken();if(revision>savedRevision){e.preventDefault();e.returnValue=''}}
watch(()=>[draft.value.title,draft.value.slug,draft.value.date,draft.value.tags.join(','),draft.value.markdown],()=>{
 if(hydration)return
 revision++;reviewed.value=false;saveNote.value='正在保存…'
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{void persist(true).catch(()=>{})},900)
 clearTimeout(previewTimer);previewTimer=setTimeout(updatePreview,180)
})
watch(config,()=>{reviewed.value=false;try{localStorage.setItem('blog-repository',JSON.stringify(config.value))}catch{}},{deep:true})
onMounted(async()=>{
  try{const stored=localStorage.getItem('blog-repository');if(stored)config.value={...site.github,...JSON.parse(stored)};const r=localStorage.getItem('blog-publish-receipt');if(r)receipt.value=JSON.parse(r)}catch{}
  try{saved.value=await listDrafts();if(saved.value.length){hydration=true;draft.value=cloneDraft(saved.value[0]);saveNote.value='已恢复最近草稿';await Promise.resolve();hydration=false}}catch{error.value='浏览器草稿存储不可用，请使用文章包备份'}
  refreshAssets();window.addEventListener('beforeunload',beforeLeave);window.addEventListener('pagehide',clearToken)
})
onBeforeUnmount(()=>{alive=false;clearToken();clearTimeout(saveTimer);clearTimeout(previewTimer);abort?.abort();Object.values(urls.value).forEach(URL.revokeObjectURL);if(revision>savedRevision)void persist(true).catch(()=>{});window.removeEventListener('beforeunload',beforeLeave);window.removeEventListener('pagehide',clearToken)})
</script>
<template>
  <div class="editor-head"><h1>写作</h1><span class="save-note" aria-live="polite">{{saveNote}}</span><div class="toolbar"><button class="button" :disabled="busy||converting" @click="fresh"><Plus :size="16"/>新建</button><button class="button" @click="persist().catch(fail)"><Save :size="16"/>保存草稿</button><button class="button" @click="exportPackage"><Download :size="16"/>下载文章包</button></div></div>
  <div v-if="error" class="notice error" role="alert">{{error}} <button class="small" @click="error=''">关闭</button></div>
  <div v-if="notice" class="notice" role="status">{{notice}}</div>
  <div :inert="busy||converting">
    <div class="editor-meta"><label>标题<input v-model="draft.title" class="title-input" maxlength="160" placeholder="这篇笔记的标题"/></label><label>文章地址<input v-model="draft.slug" placeholder="my-first-note" maxlength="80" autocomplete="off"/></label><label>日期<input v-model="draft.date" type="date"/></label><label class="full">标签<input v-model="tagInput" placeholder="用逗号分隔"/></label></div>
    <div class="mobile-tabs"><button :class="{selected:tab==='edit'}" @click="tab='edit'">编辑</button><button :class="{selected:tab==='preview'}" @click="tab='preview'">预览</button></div>
    <WritingWorkspace :tab="tab">
      <template #tools><button title="插入链接" aria-label="插入链接" @click="markdownEditor?.link()"><Link :size="16"/></button><button title="插入图片" aria-label="插入图片" @click="assetInput?.click()"><ImagePlus :size="16"/></button></template>
      <template #markdown><MarkdownEditor ref="markdownEditor" v-model="draft.markdown" @files="addAssets($event)"/></template>
      <template #preview><iframe title="文章实时预览" sandbox="" :srcdoc="preview"></iframe></template>
    </WritingWorkspace>
  </div>
  <div v-if="problems.length" class="notice error">以下附件无法读取：{{problems.join('、')}}。请重新添加后发布。</div>
  <div class="editor-bottom">
    <div>
      <section class="panel"><h2>附件与导入</h2><div class="toolbar">
        <label class="button file-label"><Upload :size="16"/>Markdown / ZIP<input class="visually-hidden" data-testid="import-md" type="file" accept=".md,.zip" :disabled="busy||converting" @change="readImport"/></label>
        <label class="button file-label"><Upload :size="16"/>文件夹<input class="visually-hidden" data-testid="import-folder" type="file" webkitdirectory multiple :disabled="busy||converting" @change="readImport"/></label>
        <button class="button" :disabled="busy||converting" @click="assetInput?.click()"><ImagePlus :size="16"/>添加附件</button>
        <input ref="assetInput" class="visually-hidden" data-testid="asset-input" type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.pdf" @change="e=>{const i=e.target as HTMLInputElement;if(i.files)addAssets(Array.from(i.files));i.value=''}"/>
        <input ref="replaceInput" class="visually-hidden" type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.pdf" @change="e=>{const i=e.target as HTMLInputElement;if(i.files)addAssets(Array.from(i.files),true);i.value=''}"/>
      </div>
      <div v-if="mdChoices.length>1" class="toolbar"><label>选择文章<select v-model="chosenMD"><option v-for="m in mdChoices" :key="m">{{m}}</option></select></label><button @click="finishImport">导入这一篇</button></div>
      <div class="asset-list"><p v-if="!draft.assets.length" class="resource-empty">暂无附件</p><div v-for="a in draft.assets" :key="a.path" class="asset-row"><img v-if="a.mime.startsWith('image/')" :src="urls[a.path]" alt=""/><FileText v-else :size="24"/><span class="asset-name">{{a.path.split('/').pop()}}<br/><span class="muted">{{(a.bytes.length/1024).toFixed(0)}} KB</span></span><div class="toolbar"><button @click="insertAsset(a)">插入</button><button v-if="a.mime!=='application/pdf'" @click="selectReplacement(a)">替换</button><button @click="download(a.bytes,a.path.split('/').pop()!,a.mime)">下载</button><button v-if="a.mime!=='application/pdf'" :aria-label="'删除 '+a.path" @click="removeAsset(a)"><Trash2 :size="13"/></button></div></div></div>
      <details style="margin-top:20px"><summary>导入 PDF</summary><div><label class="check-label"><input v-model="originalOnly" type="checkbox"/>仅作为附件</label><div class="toolbar"><label class="button file-label"><FileText :size="16"/>选择 PDF<input class="visually-hidden" data-testid="import-pdf" type="file" accept=".pdf" :disabled="busy||converting" @change="pdfChange"/></label><button v-if="lastPDF" :disabled="converting" @click="convertPDF">重新导入</button><button v-if="converting" @click="cancelPDF">取消</button></div><p v-if="converting" role="status">{{conversionProgress||'正在打开 PDF…'}}</p>
      <a v-if="urls['assets/original.pdf']" class="original-preview" :href="urls['assets/original.pdf']" target="_blank" rel="noopener noreferrer">查看原文件</a><details v-if="reports.length" style="margin-top:16px"><summary>查看导入结果</summary><ol class="pdf-report"><li v-for="r in reports" :key="r.page">第 {{r.page}} 页 · {{({text:'文字',scan:'图像',complex:'复杂布局'})[r.kind]}} · {{r.characters}} 字<p v-if="r.warnings.length" class="muted">{{r.warnings.join('；')}}</p></li></ol></details></div></details></section>
      <section class="panel" style="margin-top:20px"><details><summary>本地草稿（{{saved.length}}）</summary><div><p class="muted">草稿保存在当前浏览器，建议定期下载备份。</p><div v-for="d in saved" :key="d.id" class="draft-item"><button :disabled="busy||converting" @click="restore(d)">{{d.title||'未命名草稿'}}<small>{{new Date(d.updatedAt).toLocaleString('zh-CN')}}</small></button><button :disabled="busy||converting" :aria-label="'删除草稿 '+d.title" @click="removeDraft(d)"><Trash2 :size="15"/></button></div></div></details></section>
    </div>
    <section class="panel"><h2>发布</h2><details :open="settingsOpen" @toggle="settingsOpen=($event.target as HTMLDetailsElement).open"><summary>发布设置</summary><div class="settings-grid"><label>用户 / 组织<input v-model="config.owner" autocomplete="off" :disabled="busy"/></label><label>仓库<input v-model="config.repo" autocomplete="off" :disabled="busy"/></label><label>分支<input v-model="config.branch" :disabled="busy"/></label><label>工作流文件<input v-model="config.workflow" :disabled="busy"/></label></div>
      <label style="margin-top:20px">访问令牌<input v-model="token" type="password" placeholder="GitHub 访问令牌" autocomplete="new-password" spellcheck="false" :disabled="busy" data-testid="token"/></label>
      <p class="muted small">刷新页面后需重新填写。</p>
      <button class="small" :disabled="busy" @click="clearToken">清除</button></details>
      <details style="margin-top:18px"><summary>管理已有文章</summary><div class="toolbar"><label style="flex:1">已发布文章地址<input v-model="remoteSlug" placeholder="my-first-note" :disabled="busy"/></label><button :disabled="busy||converting" @click="loadRemote">打开文章</button></div><p class="muted small">删除文章仅限博主操作。</p><button class="button" :disabled="busy||converting||!draft.remote||!token" @click="removeRemote"><Trash2 :size="16"/>删除已发布文章</button></details>
      <label class="check-label"><input v-model="reviewed" type="checkbox" :disabled="busy||converting"/>已检查预览</label><button class="button primary" :disabled="!reviewed||busy||converting||!!problems.length" @click="publish"><Send :size="16"/>{{busy?'正在保存…':'发布文章'}}</button>
      <div v-if="status" class="status-line" role="status"><strong>{{({preparing:'准备中',uploading:'保存资源',saving:'提交中',saved:'已保存',building:'构建中',deployed:'部署完成',failed:'未完成',unknown:'待核查'})[status.stage]}}</strong><p>{{status.message}}<a v-if="status.url" :href="status.url" target="_blank" rel="noopener noreferrer">查看结果</a></p></div>
      <div v-if="receipt" class="toolbar" style="margin-top:16px"><button class="button" :disabled="busy" @click="refreshStatus()"><RefreshCw :size="15"/>刷新发布状态</button><small class="muted">提交 {{receipt.sha.slice(0,7)}}</small></div>

    </section>
  </div>
</template>


