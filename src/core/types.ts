export interface Asset { path: string; bytes: Uint8Array; mime: string }
export interface RemoteBase { repository: string; slug: string; fingerprint: string }
export interface Draft { id: string; title: string; slug: string; date: string; tags: string[]; markdown: string; assets: Asset[]; updatedAt: number; remote?: RemoteBase }
export interface Heading { id: string; text: string; level: number }
// Copy the content schema explicitly: Vue proxies and unrelated UI fields never enter storage.
export function cloneDraft(d: Draft): Draft {
  return { id:d.id,title:d.title,slug:d.slug,date:d.date,tags:[...d.tags],markdown:d.markdown,updatedAt:d.updatedAt,
    assets:d.assets.map(a=>({path:a.path,mime:a.mime,bytes:a.bytes.slice()})),
    ...(d.remote?{remote:{repository:d.remote.repository,slug:d.remote.slug,fingerprint:d.remote.fingerprint}}:{}) }
}
export interface PostMeta { slug: string; title: string; date: string; tags: string[]; text?: string }
export const LIMITS = { markdown: 2 * 1024 * 1024, file: 20 * 1024 * 1024, total: 50 * 1024 * 1024, files: 150, pages: 40, imagePixels: 16_000_000, zip: 30 * 1024 * 1024 };
export function newDraft(): Draft { return { id: crypto.randomUUID(), title: '', slug: '', date: new Date().toLocaleDateString('sv-SE'), tags: [], markdown: '', assets: [], updatedAt: Date.now() } }
