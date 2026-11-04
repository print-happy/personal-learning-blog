import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import hljs from 'highlight.js/lib/common'
import type { Heading } from './types'
export interface RenderOptions { resolveAsset?: (url: string, image: boolean) => string | undefined; highlight?: boolean }
export function renderMarkdown(source: string, options: RenderOptions = {}) {
  const headings: Heading[] = []; const missing: string[] = []
  const md = new MarkdownIt({ html:false, linkify:false, breaks:false, typographer:false,
    highlight(code, lang) {
      return options.highlight !== false && lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language:lang, ignoreIllegals:true }).value : ''
    }
  })
  // Content is never compiled as a Vue template, at preview or at build time.
  const tokens = md.parse(source, {})
  let index = 0
  for (let i=0;i<tokens.length;i++) {
    const t = tokens[i]
    if (t.type === 'heading_open') {
      const id = 'section-' + (++index); t.attrSet('id', id)
      headings.push({ id, text:tokens[i+1]?.content || '', level:Number(t.tag.slice(1)) })
    }
    for (const c of t.children || []) {
      if (c.type !== 'image' && c.type !== 'link_open') continue
      const attr = c.type === 'image' ? 'src' : 'href'; const url = c.attrGet(attr) || ''
      if (options.resolveAsset) {
        const resolved = options.resolveAsset(url, c.type === 'image')
        if (resolved === undefined) { missing.push(url); c.attrSet(attr,''); }
        else c.attrSet(attr,resolved)
      }
      if (c.type === 'link_open') c.attrSet('rel','noopener noreferrer')
      else { c.attrSet('loading','lazy'); c.attrSet('decoding','async') }
    }
  }
  const raw = md.renderer.render(tokens, md.options, {})
  const html = sanitizeHtml(raw, {
    allowedTags:['p','br','hr','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','strong','em','s','a','img','pre','code','span','table','thead','tbody','tr','th','td'],
    allowedAttributes:{ '*':['id'], a:['href','title','rel'], img:['src','alt','title','loading','decoding'], code:['class'], span:['class'], th:['align'],td:['align'],ol:['start'] },
    allowedSchemes:['http','https','mailto'], allowedSchemesByTag:{img:['blob','data','http','https']},
    allowProtocolRelative:false, enforceHtmlBoundary:true
  })
  return { html, headings, missing:[...new Set(missing)] }
}
export function localResource(url: string): string | null {
  if (/^(https?:|mailto:|#)/i.test(url)) return null
  return url.replace(/^\.\//,'').split('#')[0]
}
