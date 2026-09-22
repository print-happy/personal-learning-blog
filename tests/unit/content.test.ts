import { describe,it,expect } from 'vitest'
import { zipSync,strToU8 } from 'fflate'
import { safePath,parseMarkdown,fileMime,validateDraft } from '../../src/core/content'
import { renderMarkdown } from '../../src/core/markdown'
import { importFiles,unpackZip,exportDraft,draftProblems } from '../../src/core/importer'
import { newDraft } from '../../src/core/types'
import fs from 'node:fs'
const gif=Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),x=>x.charCodeAt(0))
describe('untrusted content',()=>{
 it.each(['../escape.png','/abs.png','C:/evil','a\\b','a/%2e%2e/b','%2fetc','a/.git/config','CON.png','a//b','a?b'])('rejects %s',p=>expect(()=>safePath(p)).toThrow())
 it('does not execute HTML, Vue expressions, event attributes or unsafe links',()=>{
  const input='<script>window.pwned=1</script>\n\n<img src=x onerror=alert(1)>\n\n{{ globalThis.localStorage }}\n\n<Demo @click="alert(1)" />\n\n[x](javascript:alert(1))\n\n![x](data:image/svg+xml;base64,PHN2Zz4=)'
  const {html}=renderMarkdown(input)
  expect(html).not.toMatch(/<script|<img src="x"|onerror="|<Demo|href="javascript|src="data:/)
  expect(html).toContain('&lt;script&gt;')
  expect(html).toContain('{{ globalThis.localStorage }}')
 })
 it('allowlists metadata and rejects alias expansion',()=>{
   expect(parseMarkdown('---\ntitle: hi\nlayout: evil\nhead: [bad]\n---\nBody')).toEqual({title:'hi',date:'',tags:[],markdown:'Body'})
   expect(()=>parseMarkdown('---\na: &a [x,x,x]\nb: &b [*a,*a,*a]\nc: [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]\n---\nx')).toThrow()
 })
 it('rejects HTML disguised as an image',()=>expect(()=>fileMime('evil.png',strToU8('<script>alert(1)</script>'))).toThrow())
 it('disambiguates heading anchors and highlights code',()=>{const r=renderMarkdown('## Same\n\n## Same\n\n~~~ts\nconst x = 1\n~~~');expect(r.headings.map(h=>h.id)).toEqual(['section-1','section-2']);expect(r.html).toContain('hljs-keyword')})
})
describe('portable import and zip',()=>{
 it('handles reference links and spaced paths without rewriting prose',()=>{
  const d=importFiles([{path:'a.md',bytes:strToU8('# A\n\na gif.gif is just text.\n\n![one](<a gif.gif>)\n\n![two][pic]\n\n[pic]: a%20gif.gif')},{path:'a gif.gif',bytes:gif}])
  expect(d.markdown).toContain('a gif.gif is just text.');expect(draftProblems(d)).toEqual([]);expect(d.assets).toHaveLength(1)
 })
 it('preserves an unreferenced original PDF through export and reimport',()=>{
  const original=new Uint8Array(fs.readFileSync('tests/fixtures/text.pdf'))
  const d=importFiles([{path:'a.md',bytes:strToU8('# A')},{path:'original.pdf',bytes:original}]);d.slug='test';d.title='Test'
  const restored=importFiles(unpackZip(exportDraft(d)));expect(restored.assets[0].bytes).toEqual(original)
 })
 it('imports nested relative GIF and preserves original bytes through export',()=>{
  const d=importFiles([{path:'pack/article/note.md',bytes:strToU8('# Sample\n\n![motion](../images/a.gif)')},{path:'pack/images/a.gif',bytes:gif}])
  expect(d.assets[0].bytes).toEqual(gif);expect(d.markdown).toContain('assets/001-a.gif');expect(draftProblems(d)).toEqual([])
  const files=unpackZip(exportDraft({...d,title:'Sample',slug:'sample'}))
  expect(files.find(f=>f.path==='assets/001-a.gif')?.bytes).toEqual(gif)
  expect(importFiles(files).title).toBe('Sample')
 })
 it('reports missing images in an md-only import',()=>{
  const d=importFiles([{path:'a.md',bytes:strToU8('# A\n\n![x](missing.png)')}])
  expect(draftProblems(d)).toEqual(['missing.png'])
 })
 it('rejects ZIP traversal and oversized inflated entries',()=>{
  expect(()=>unpackZip(zipSync({'../escape.md':strToU8('# x')}))).toThrow()
  const huge=new Uint8Array(21*1024*1024);expect(()=>unpackZip(zipSync({'big.md':huge}))).toThrow()
 })
 it('requires explicit article selection for multi-md imports',()=>{const files=[{path:'a.md',bytes:strToU8('# A')},{path:'b.md',bytes:strToU8('# B')}];expect(()=>importFiles(files)).toThrow();expect(importFiles(files,'b.md').title).toBe('B')})
 it('rejects case-colliding resources and invalid dates',()=>{const d=newDraft();Object.assign(d,{title:'T',slug:'t',date:'2026-02-31'});expect(()=>validateDraft(d)).toThrow();d.date='2026-02-28';d.assets=[{path:'assets/A.gif',bytes:gif,mime:'image/gif'},{path:'assets/a.gif',bytes:gif,mime:'image/gif'}];expect(()=>validateDraft(d)).toThrow()})
})
