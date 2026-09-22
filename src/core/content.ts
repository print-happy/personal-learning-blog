import { parseDocument, stringify } from 'yaml'
import type { Draft } from './types'
import { LIMITS } from './types'

export function safePath(input: string): string {
  let path: string
  try { path = decodeURIComponent(input).normalize('NFC') } catch { throw new Error('路径编码无效') }
  if (!path || path.length > 240 || /[\\:\x00-\x1f\x7f?#]/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.') || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p)))
    throw new Error('不安全的文件路径：' + input.slice(0,100))
  return path
}
export function validateSlug(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new Error('文章地址须为 1–80 个小写英文字母、数字或短横线')
  return slug
}
export function fileMime(path: string, bytes?: Uint8Array): string {
  const ext = path.toLowerCase().split('.').pop()
  const types: Record<string,string> = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', pdf:'application/pdf' }
  const mime = types[ext || '']
  if (!mime) throw new Error('仅支持 PNG、JPEG、GIF、WebP 和 PDF 资源：' + path)
  if (bytes) {
    const signature = Array.from(bytes.slice(0,12)); const text = new TextDecoder('latin1').decode(bytes.slice(0,12))
    const valid = ext === 'png' ? signature.slice(0,8).join() === '137,80,78,71,13,10,26,10' :
      ext === 'jpg' || ext === 'jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255 :
      ext === 'gif' ? /^GIF8[79]a/.test(text) : ext === 'webp' ? text.startsWith('RIFF') && text.slice(8) === 'WEBP' : text.startsWith('%PDF-')
    if (!valid) throw new Error('文件内容与扩展名不符：' + path)
  }
  return mime
}
export function parseMarkdown(source: string) {
  if (new TextEncoder().encode(source).length > LIMITS.markdown) throw new Error('Markdown 超过 2 MB')
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  let data: Record<string, unknown> = {}; let markdown = source.replace(/^\uFEFF/,'')
  if (match) {
    const doc = parseDocument(match[1], { schema: 'failsafe', uniqueKeys: true })
    if (doc.errors.length) throw new Error('文章头部格式无效：' + doc.errors[0].message)
    data = doc.toJS({ maxAliasCount: 20 }) || {}
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('文章头部应是键值信息')
    markdown = markdown.slice(match[0].length)
  }
  const title = typeof data.title === 'string' ? data.title.slice(0,160) : markdown.match(/^# (.+)$/m)?.[1] || ''
  const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : ''
  const tags = Array.isArray(data.tags) ? data.tags.filter((s): s is string => typeof s === 'string').slice(0,12).map(s=>s.slice(0,40)) : []
  return { title, date, tags, markdown }
}
export function serializeDraft(draft: Draft) {
  return '---\n' + stringify({ title: draft.title.trim(), date: draft.date, tags: draft.tags }) + '---\n\n' + draft.markdown
}
export function validateDraft(d: Draft) {
  validateSlug(d.slug)
  if (!d.title.trim() || d.title.length > 160) throw new Error('请填写标题（最多 160 字）')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(Date.parse(d.date)) || new Date(d.date).toISOString().slice(0,10) !== d.date) throw new Error('日期无效')
  if (d.tags.length > 12 || d.tags.some(t=>!t.trim() || t.length>40)) throw new Error('标签最多 12 个，每个最多 40 字')
  parseMarkdown(d.markdown)
  if (d.assets.length > LIMITS.files) throw new Error('资源超过 150 个')
  let total = 0; const paths = new Set<string>()
  for (const a of d.assets) {
    safePath(a.path)
    if (!a.path.startsWith('assets/')) throw new Error('资源必须在 assets/ 内')
    if (paths.has(a.path.toLowerCase())) throw new Error('资源路径重复：' + a.path)
    paths.add(a.path.toLowerCase())
    if (a.bytes.length > LIMITS.file) throw new Error('单个资源超过 20 MB：' + a.path)
    fileMime(a.path,a.bytes); total += a.bytes.length
  }
  if (total > LIMITS.total) throw new Error('资源总量超过 50 MB')
}

