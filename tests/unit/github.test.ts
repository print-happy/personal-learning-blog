import { describe,it,expect } from 'vitest'
import { GitHub,GitHubError,fingerprint,type Receipt,type PublishStatus } from '../../src/core/github'
import { newDraft } from '../../src/core/types'
const config={owner:'author',repo:'notes',branch:'main',workflow:'pages.yml'}
function setup(opts:{existing?:boolean;conflict?:boolean;uncertain?:boolean;confirm?:boolean;run?:string;deploy?:string;failBlob?:boolean}={}){
 const calls:{path:string;method:string;body:any;headers:any}[]=[];let head='base'
 const entries=opts.existing?[{path:'content/posts/test/index.md',sha:'old',mode:'100644',type:'blob'}]:[]
 const fetcher=async(url:any,init:any)=>{
  const path=new URL(url).pathname.replace('/repos/author/notes','');const body=init.body?JSON.parse(init.body):undefined;calls.push({path,method:init.method,body,headers:init.headers})
  const out=(data:any,status=200)=>new Response(JSON.stringify(data),{status})
  if(path.startsWith('/git/ref/'))return out({object:{sha:head}})
  if(path==='/git/commits/base')return out({tree:{sha:'tree-base'}})
  if(path.startsWith('/git/trees/')&&init.method==='GET')return out({tree:entries,truncated:false})
  if(path==='/git/blobs')return opts.failBlob?out({},403):out({sha:'blob-new'},201)
  if(path==='/git/trees')return out({sha:'tree-new'},201)
  if(path==='/git/commits')return out({sha:'commit-new'},201)
  if(path.startsWith('/git/refs/')){if(opts.conflict)return out({},422);if(opts.uncertain){if(opts.confirm)head='commit-new';throw new TypeError('network')}head='commit-new';return out({object:{sha:head}})}
  if(path.startsWith('/compare/'))return out({status:'diverged'})
  if(path.includes('/actions/workflows/'))return out({workflow_runs:opts.run?[{id:5,head_sha:'commit-new',head_branch:'main',run_attempt:1,status:opts.run==='running'?'in_progress':'completed',conclusion:opts.run}]:[]})
  if(path==='/deployments')return out([{id:9,sha:'commit-new',environment:'github-pages'}])
  if(path==='/deployments/9/statuses')return out(opts.deploy?[{state:opts.deploy,environment_url:'https://author.github.io/notes/'}]:[])
  throw new Error('Unexpected API '+path)
 }
 const client=new GitHub(config,'test-memory-only-token',fetcher as typeof fetch)
 const draft={...newDraft(),title:'Test',slug:'test',markdown:'## Hi',date:'2026-09-22'}
 return {client,draft,calls,entries}
}
describe('atomic GitHub publication',()=>{
 it('uses blobs, base tree, one commit, then a non-forced ref update',async()=>{
  const {client,draft,calls}=setup();const states:PublishStatus[]=[];const r=await client.publish(draft,s=>states.push(s))
  expect(r.confirmed).toBe(true);expect(states.at(-1)?.stage).toBe('saved')
  expect(calls.find(c=>c.path==='/git/trees'&&c.method==='POST')?.body.base_tree).toBe('tree-base')
  expect(calls.find(c=>c.path==='/git/commits'&&c.method==='POST')?.body.parents).toEqual(['base'])
  expect(calls.at(-1)?.body).toEqual({sha:'commit-new',force:false})
 })
 it('never overwrites an existing article without its loaded baseline',async()=>{
  const {client,draft,calls}=setup({existing:true});await expect(client.publish(draft)).rejects.toThrow('同地址');expect(calls.some(c=>c.method==='POST')).toBe(false)
 })
 it('detects edited article/resources before creating blobs',async()=>{
  const {client,draft,calls}=setup({existing:true});draft.remote={repository:'author/notes@main',slug:'test',fingerprint:'outdated'};await expect(client.publish(draft)).rejects.toThrow('远端文章');expect(calls.some(c=>c.method==='POST')).toBe(false)
 })
 it('refuses a racing branch update and never forces it',async()=>{
  const {client,draft,calls}=setup({conflict:true});await expect(client.publish(draft)).rejects.toBeInstanceOf(GitHubError);expect(calls.at(-1)?.body.force).toBe(false)
 })
 it('does not update the branch when resource upload fails',async()=>{
  const {client,draft,calls}=setup({failBlob:true});await expect(client.publish(draft)).rejects.toThrow();expect(calls.some(c=>c.method==='PATCH')).toBe(false)
 })
 it.each([false,true])('reconciles ambiguous network outcome (confirmed=%s)',async confirm=>{
  const {client,draft}=setup({uncertain:true,confirm});expect((await client.publish(draft)).confirmed).toBe(confirm)
 })
 it.each([['running',undefined,'building'],['failure',undefined,'failed'],['success',undefined,'saved'],['success','success','deployed'],['success','failure','failed']])('separates build %s and deployment %s',async(run,deploy,stage)=>{
  const {client}=setup({run,deploy});const r:Receipt={config,sha:'commit-new',slug:'test',confirmed:true};expect((await client.status(r)).stage).toBe(stage)
 })
 it('clears credentials and refuses subsequent requests',async()=>{const {client}=setup();client.clear();await expect(client.head()).rejects.toThrow('凭据已清除')})
 it('retains unrelated files using base_tree and deletes only the loaded article resource set',async()=>{
  const {client,draft,calls,entries}=setup({existing:true});draft.remote={repository:'author/notes@main',slug:'test',fingerprint:fingerprint(entries)};await client.publish(draft);const tree=calls.find(c=>c.path==='/git/trees'&&c.method==='POST')?.body.tree;expect(tree.every((e:any)=>e.path.startsWith('content/posts/test/'))).toBe(true)
 })
})

