import { createStore, get, set, del, keys } from 'idb-keyval'
import { cloneDraft, type Draft } from './types'
let database: ReturnType<typeof createStore> | undefined
const store = () => database ||= createStore('learning-blog','drafts')
let pending: Promise<void> = Promise.resolve()
export async function saveDraft(draft: Draft) {
  const copy = cloneDraft(draft); copy.updatedAt=Date.now()
  const write = pending.catch(()=>{}).then(()=>set(copy.id,copy,store()))
  pending=write;await write;return copy.updatedAt
}
export async function listDrafts(): Promise<Draft[]> {
  const s=store(); const all=await Promise.all((await keys(s)).map(key=>get<Draft>(key,s)))
  return all.filter((d):d is Draft=>!!d).sort((a,b)=>b.updatedAt-a.updatedAt)
}
export async function deleteDraft(id:string){ await del(id,store()) }
