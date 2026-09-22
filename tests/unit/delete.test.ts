import {describe,it,expect} from 'vitest'
import {GitHub,fingerprint} from '../../src/core/github'
import {newDraft} from '../../src/core/types'
function fixture(owner=true,stale=false,race=false,uncertain=false){
 const entries=[{path:'content/posts/note/index.md',sha:'a',mode:'100644',type:'blob'},{path:'content/posts/note/assets/p.pdf',sha:'b',mode:'100644',type:'blob'},{path:'content/posts/other/index.md',sha:'c',mode:'100644',type:'blob'}]
 const calls:any[]=[]
 const fetcher=async(url:any,init:any)=>{
  const path=new URL(url).pathname.replace('/repos/author/blog','');calls.push({path,method:init.method,body:init.body&&JSON.parse(init.body)})
  const out=(v:any,status=200)=>new Response(JSON.stringify(v),{status})
  if(path==='/user')return out({id:owner?1:2})
  if(path==='')return out({owner:{id:1,type:'User'},permissions:{push:true}})
  if(path.startsWith('/git/ref/'))return out({object:{sha:'old'}})
  if(path==='/git/commits/old')return out({tree:{sha:'base'}})
  if(path==='/git/trees/base')return out({tree:entries})
  if(path==='/git/trees')return out({sha:'tree'})
  if(path==='/git/commits')return out({sha:'new'})
  if(path.startsWith('/git/refs/')){if(uncertain)throw Error('offline');return out({},race?422:200)}
  if(path.startsWith('/compare/'))return out({status:'diverged'})
  throw Error(path)
 }
 const draft={...newDraft(),slug:'note',title:'Note',remote:{repository:'author/blog@main',slug:'note',fingerprint:stale?'stale':fingerprint(entries.slice(0,2))}}
 const client=new GitHub({owner:'author',repo:'blog',branch:'main',workflow:'pages.yml'},'mock',fetcher as typeof fetch)
 return {client,draft,calls}
}
describe('owner article deletion',()=>{
 it('removes only loaded article and attachments in an atomic non-force commit',async()=>{const {client,draft,calls}=fixture();expect((await client.remove(draft)).confirmed).toBe(true);expect(calls.find(c=>c.path==='/git/trees').body).toEqual({base_tree:'base',tree:[{path:'content/posts/note/index.md',mode:'100644',type:'blob',sha:null},{path:'content/posts/note/assets/p.pdf',mode:'100644',type:'blob',sha:null}]});expect(calls.at(-1).body).toEqual({sha:'new',force:false});expect(draft.markdown).toBeDefined()})
 it('rejects a non-owner with write access before writes',async()=>{const {client,draft,calls}=fixture(false);await expect(client.remove(draft)).rejects.toThrow('所有者');expect(calls.every(c=>c.method==='GET')).toBe(true)})
 it('rejects changed article before writes',async()=>{const {client,draft,calls}=fixture(true,true);await expect(client.remove(draft)).rejects.toThrow('已更改');expect(calls.every(c=>c.method==='GET')).toBe(true)})
 it('rejects changed destination',async()=>{const {client,draft,calls}=fixture();draft.slug='other';await expect(client.remove(draft)).rejects.toThrow('先载入');expect(calls).toHaveLength(0)})
 it('does not force a racing branch update',async()=>{const {client,draft,calls}=fixture(true,false,true);await expect(client.remove(draft)).rejects.toThrow();expect(calls.at(-1).body.force).toBe(false)})
 it('retains receipt on ambiguous delete result',async()=>{const {client,draft}=fixture(true,false,false,true);expect((await client.remove(draft)).confirmed).toBe(false)})
})
