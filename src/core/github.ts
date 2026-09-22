import { validateDraft, validateSlug, serializeDraft, parseMarkdown, safePath, fileMime } from './content'
import { draftProblems } from './importer'
import { newDraft, LIMITS, type Draft } from './types'
export interface RepoConfig { owner:string; repo:string; branch:string; workflow:string }
export interface Receipt { config:RepoConfig; sha:string; slug:string; confirmed:boolean }
export type PublishStage='preparing'|'uploading'|'saving'|'saved'|'building'|'deployed'|'failed'|'unknown'
export interface PublishStatus { stage:PublishStage; message:string; receipt?:Receipt; url?:string }
type TreeEntry={path:string;sha:string;mode:string;type:string;size?:number}
type Fetcher=typeof fetch
function encoded(path:string) { return path.split('/').map(encodeURIComponent).join('/') }
export function repositoryKey(c:RepoConfig){return c.owner+'/'+c.repo+'@'+c.branch}
export function validateConfig(c:RepoConfig) {
  if(!/^[A-Za-z0-9-]+$/.test(c.owner)||!/^[A-Za-z0-9_.-]+$/.test(c.repo)||c.repo==='.'||c.repo==='..')throw new Error('请填写有效的 GitHub 用户 / 组织和仓库名')
  if(!c.branch || /[\s~^:?*[\]\\]|\.\.|@\{|^\/|\/$|\.lock$/.test(c.branch))throw new Error('分支名无效')
  if(!/^[a-zA-Z0-9_.-]+\.ya?ml$/.test(c.workflow))throw new Error('工作流文件名无效')
}
export class GitHubError extends Error { constructor(public status:number, message:string){super(message)} }
export class GitHub {
  private root:string
  constructor(public config:RepoConfig, private token:string,private fetcher:Fetcher=(input,init)=>fetch(input,init)){
    validateConfig(config);if(!token.trim())throw new Error('请在此页面输入 GitHub token')
    this.root='https://api.github.com/repos/'+encodeURIComponent(config.owner)+'/'+encodeURIComponent(config.repo)
  }
  clear(){this.token=''}
  async request(path:string,method='GET',body?:unknown,account=false):Promise<any> {
    if(!this.token)throw new Error('凭据已清除，请重新输入')
    let response:Response
    try { response=await this.fetcher(account?'https://api.github.com/user':this.root+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+this.token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(45000)}) }
    catch{throw new GitHubError(0,'网络请求未完成。内容仍在本地；保存请求中断时请先核查状态')}
    if(!response.ok) {
      const messages:Record<number,string>={401:'凭据无效或已过期',403:'权限不足、分支保护或 API 频率限制；请查看仓库设置',404:'找不到仓库、分支或文件，或无权访问',409:'仓库状态冲突，请重新载入后比较',422:'远端已变化或不允许直接提交，请重新载入后比较',429:'请求过于频繁，请稍后刷新'}
      throw new GitHubError(response.status,messages[response.status]||'GitHub 请求失败（'+response.status+'）')
    }
    return response.status===204?null:response.json()
  }
  async head(){return (await this.request('/git/ref/heads/'+encoded(this.config.branch))).object.sha as string}
  async snapshot() {
    const head=await this.head();const commit=await this.request('/git/commits/'+head)
    const tree=await this.request('/git/trees/'+commit.tree.sha+'?recursive=1')
    if(tree.truncated)throw new Error('仓库目录过大，无法安全检查冲突。请使用本地发布')
    return {head,treeSha:commit.tree.sha as string,entries:tree.tree as TreeEntry[]}
  }
  async load(slug:string):Promise<Draft> {
    validateSlug(slug);const snap=await this.snapshot();const prefix='content/posts/'+slug+'/'
    const entries=snap.entries.filter(e=>e.path.startsWith(prefix)&&e.type==='blob')
    const article=entries.find(e=>e.path===prefix+'index.md')
    if(!article)throw new Error('该文章不存在')
    if(entries.length>LIMITS.files+1||entries.reduce((n,e)=>n+(e.size||0),0)>LIMITS.total)throw new Error('远端文章资源超限')
    const read=async(e:TreeEntry)=>{
      if(e.mode!=='100644'&&e.mode!=='100755')throw new Error('不支持符号链接资源')
      const b=await this.request('/git/blobs/'+e.sha)
      if(b.encoding!=='base64'||b.size>LIMITS.file)throw new Error('远端资源不可读取或超限')
      const binary=atob(b.content.replace(/\s/g,''));return Uint8Array.from(binary,c=>c.charCodeAt(0))
    }
    const draft=newDraft();Object.assign(draft,parseMarkdown(new TextDecoder().decode(await read(article))))
    draft.slug=slug
    let total=0
    for(const e of entries.filter(e=>e!==article)){
      const path=safePath(e.path.slice(prefix.length))
      if(!path.startsWith('assets/'))throw new Error('远端文章含非资源文件，请在本地处理')
      const bytes=await read(e);total+=bytes.length;if(total>LIMITS.total)throw new Error('远端资源超限')
      draft.assets.push({path,bytes,mime:fileMime(path,bytes)})
    }
    draft.remote={repository:repositoryKey(this.config),slug,fingerprint:fingerprint(entries)}
    return draft
  }
  async publish(draft:Draft,onStatus:(s:PublishStatus)=>void=()=>{}):Promise<Receipt> {
    validateDraft(draft);const missing=draftProblems(draft)
    if(missing.length)throw new Error('请先补齐本地资源：'+missing.join('、'))
    onStatus({stage:'preparing',message:'正在检查远端版本'})
    const snap=await this.snapshot();const prefix='content/posts/'+draft.slug+'/'
    const previous=snap.entries.filter(e=>e.path.startsWith(prefix)&&e.type==='blob')
    if(previous.length) {
      if(!draft.remote || draft.remote.repository!==repositoryKey(this.config)||draft.remote.slug!==draft.slug)throw new Error('同地址文章已存在。请先“载入远端文章”再编辑，或更改文章地址')
      if(draft.remote.fingerprint!==fingerprint(previous))throw new Error('远端文章或资源已更改。已停止保存，请导出本地草稿后重新载入并合并')
    } else if(draft.remote) throw new Error('远端文章已删除或发布目标已更改。请另存为新草稿后发布')
    const files=[{path:prefix+'index.md',bytes:new TextEncoder().encode(serializeDraft(draft))},...draft.assets.map(a=>({path:prefix+a.path,bytes:a.bytes}))]
    const tree:{path:string;mode:string;type:string;sha:string|null}[]=[]
    for(let i=0;i<files.length;i++){
      onStatus({stage:'uploading',message:'正在保存资源 '+(i+1)+' / '+files.length})
      const file=files[i];let binary=''
      for(let j=0;j<file.bytes.length;j+=8192)binary+=String.fromCharCode(...file.bytes.subarray(j,j+8192))
      const blob=await this.request('/git/blobs','POST',{content:btoa(binary),encoding:'base64'})
      tree.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha})
    }
    for(const old of previous)if(!files.some(f=>f.path===old.path))tree.push({path:old.path,mode:'100644',type:'blob',sha:null})
    const newTree=await this.request('/git/trees','POST',{base_tree:snap.treeSha,tree})
    const commit=await this.request('/git/commits','POST',{message:'docs: '+draft.title,tree:newTree.sha,parents:[snap.head]})
    const receipt:Receipt={config:{...this.config},sha:commit.sha,slug:draft.slug,confirmed:false}
    onStatus({stage:'saving',message:'正在提交文章与资源',receipt})
    try {
      await this.request('/git/refs/heads/'+encoded(this.config.branch),'PATCH',{sha:commit.sha,force:false})
      receipt.confirmed=true
    } catch(error) {
      if(error instanceof GitHubError && error.status!==0)throw error
      try {receipt.confirmed=await this.contains(receipt.sha)}catch{}
      if(!receipt.confirmed){onStatus({stage:'unknown',message:'保存结果暂时无法确认。请保留草稿并点击“刷新发布状态”，不要重复提交',receipt});return receipt}
    }
    draft.remote={repository:repositoryKey(this.config),slug:draft.slug,fingerprint:fingerprint(tree.filter(e=>e.sha!==null) as TreeEntry[])}
    onStatus({stage:'saved',message:'已保存到 GitHub，等待构建',receipt})
    return receipt
  }
  async contains(sha:string) {
    const head=await this.head();if(head===sha)return true
    const comparison=await this.request('/compare/'+sha+'...'+head)
    return comparison.status==='ahead'||comparison.status==='identical'
  }
  async assertOwner() {
    const user=await this.request('', 'GET', undefined, true)
    const repo=await this.request('')
    if(!user.id||repo.owner?.type!=='User'||user.id!==repo.owner.id||repo.permissions?.push!==true)
      throw new Error('只有此个人仓库的所有者可以通过写作台删除文章，请使用所有者的 Contents 读写令牌')
  }
  async remove(draft:Draft,onStatus:(s:PublishStatus)=>void=()=>{}):Promise<Receipt> {
    validateSlug(draft.slug)
    if(!draft.remote||draft.remote.repository!==repositoryKey(this.config)||draft.remote.slug!==draft.slug)
      throw new Error('请先载入要删除的远端文章，且不要更改文章地址或仓库')
    await this.assertOwner()
    const snap=await this.snapshot(), prefix='content/posts/'+draft.slug+'/'
    const previous=snap.entries.filter(e=>e.path.startsWith(prefix)&&e.type==='blob')
    if(!previous.some(e=>e.path===prefix+'index.md'))throw new Error('远端文章已不存在，请重新载入确认')
    if(fingerprint(previous)!==draft.remote.fingerprint)throw new Error('远端文章或资源已更改，请重新载入后再决定是否删除')
    const tree=previous.map(e=>({path:e.path,mode:e.mode,type:'blob',sha:null}))
    const next=await this.request('/git/trees','POST',{base_tree:snap.treeSha,tree})
    const commit=await this.request('/git/commits','POST',{message:'docs: remove '+draft.slug,tree:next.sha,parents:[snap.head]})
    const receipt:Receipt={config:{...this.config},sha:commit.sha,slug:draft.slug,confirmed:false}
    onStatus({stage:'saving',message:'正在提交文章及附件的删除记录',receipt})
    try {
      await this.request('/git/refs/heads/'+encoded(this.config.branch),'PATCH',{sha:commit.sha,force:false})
      receipt.confirmed=true
    } catch(error) {
      if(error instanceof GitHubError&&error.status!==0)throw error
      try{receipt.confirmed=await this.contains(receipt.sha)}catch{}
      if(!receipt.confirmed){onStatus({stage:'unknown',message:'删除结果暂不确定，请刷新发布状态，不要重复删除。本机草稿仍保留',receipt});return receipt}
    }
    onStatus({stage:'saved',message:'删除已提交，部署完成后文章会从网站移除。本机草稿与 Git 历史保留',receipt})
    return receipt
  }
  async status(receipt:Receipt):Promise<PublishStatus> {
    if(repositoryKey(receipt.config)!==repositoryKey(this.config))throw new Error('请使用该次发布的仓库与分支检查状态')
    if(!receipt.confirmed) {
      if(!await this.contains(receipt.sha))return {stage:'unknown',message:'该提交尚未确认进入目标分支。请检查 GitHub 后再重试，草稿仍保留',receipt}
      receipt.confirmed=true
    }
    const runs=await this.request('/actions/workflows/'+encodeURIComponent(this.config.workflow)+'/runs?head_sha='+encodeURIComponent(receipt.sha)+'&per_page=10')
    const run=runs.workflow_runs?.filter((r:any)=>r.head_sha===receipt.sha&&r.head_branch===this.config.branch).sort((a:any,b:any)=>b.run_attempt-a.run_attempt||b.id-a.id)[0]
    if(!run)return {stage:'saved',message:'内容已保存，暂未找到构建；请确认 Actions 已启用、分支与工作流匹配',receipt}
    const url='https://github.com/'+this.config.owner+'/'+this.config.repo+'/actions/runs/'+run.id
    if(run.status!=='completed')return {stage:'building',message:'GitHub 正在构建 / 部署',receipt,url}
    if(run.conclusion!=='success')return {stage:'failed',message:'内容已保存，但构建 / 部署失败（'+run.conclusion+'）',receipt,url}
    const deployments=await this.request('/deployments?sha='+receipt.sha+'&environment=github-pages&per_page=20')
    for(const d of deployments) {
      if(d.sha!==receipt.sha||d.environment!=='github-pages')continue
      const statuses=await this.request('/deployments/'+d.id+'/statuses?per_page=1')
      const state=statuses[0]
      if(state?.state==='success') {
        const safeURL=typeof state.environment_url==='string'&&state.environment_url.startsWith('https://')?state.environment_url:undefined
        return {stage:'deployed',message:'GitHub Pages 已确认部署完成',receipt,url:safeURL||url}
      }
      if(state?.state==='failure'||state?.state==='error')return {stage:'failed',message:'构建成功，Pages 部署失败',receipt,url}
    }
    return {stage:'saved',message:'构建成功，尚未取得 Pages 部署成功记录',receipt,url}
  }
}
export function fingerprint(entries:Pick<TreeEntry,'path'|'sha'>[]) {
  return entries.map(e=>e.path+':'+e.sha).sort().join('\n')
}
