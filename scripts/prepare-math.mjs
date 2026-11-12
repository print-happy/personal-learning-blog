import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
export async function prepareMath(){
 const root=path.dirname(fileURLToPath(import.meta.resolve('katex/package.json')))
 let css=await fs.readFile(path.join(root,'dist/katex.min.css'),'utf8')
 const faces=[...css.matchAll(/src:([^;}]+)([;}])/g)]
 for(const match of faces){
  const file=/url\(fonts\/([\w-]+\.woff2)\)/.exec(match[1])?.[1]
  if(!file)throw Error('Expected local WOFF2 math font')
  const bytes=await fs.readFile(path.join(root,'dist/fonts',file))
  css=css.replace(match[0],`src:url(data:font/woff2;base64,${bytes.toString('base64')}) format("woff2")${match[2]}`)
 }
 if(/url\((?!data:)/.test(css))throw Error('Unexpected external math resource')
 css+='\n.notes-math{font-size:1em;line-height:normal;white-space:normal}.notes-math.math-block{display:block;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:0.3em 0}.notes-math .katex-display{margin:0.5em 0}.notes-math svg{max-width:none}.math-error{color:#a52b35;white-space:pre-wrap;overflow-wrap:anywhere}.dark .math-error{color:#ffb4b4}@media print{.notes-math.math-block{break-inside:avoid;overflow:visible}.math-error{color:#a52b35}}'
 await fs.writeFile('docs/.vitepress/generated/math.css',css)
 await fs.mkdir('docs/public/licenses',{recursive:true})
 await fs.copyFile(path.join(root,'LICENSE'),'docs/public/licenses/KaTeX.txt')
}
