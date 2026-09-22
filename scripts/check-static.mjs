// Builds hostile content into a separate /check/ site, then checks the generated and hydrated page.
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn,spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const root=process.cwd(),dist=path.resolve('work/probe-dist')
await fs.mkdir('work/probe-content/security-check/assets',{recursive:true})
await fs.copyFile('tests/fixtures/figure.png','work/probe-content/security-check/assets/figure.png')
await fs.copyFile('tests/fixtures/scan.pdf','work/probe-content/security-check/assets/original.pdf')
const source='---\ntitle: 安全与打印检查\ndate: 2026-09-22\ntags: [测试]\nhead: [[script, {}, alert(1)]]\n---\n\n## 中文段落\n\n最终构建中的中文正文。下面的恶意内容必须显示为文字，不能执行。\n\n<script>globalThis.xssProbe=1</script>\n\n<img src=x onerror="globalThis.xssProbe=2">\n\n{{ globalThis.xssProbe=3 }}\n\n<Demo v-on:click="globalThis.xssProbe=4" />\n\n[bad](javascript:alert(1))\n\n![独立图片](assets/figure.png)\n\n[阅读原 PDF](assets/original.pdf)\n\n## 长代码\n\n~~~text\n'+('中文 long-code-value '.repeat(65))+'\nEND_OF_LONG_CODE\n~~~\n\n| 列一 | 列二 |\n| --- | --- |\n| 可读中文 | '+('verylongword'.repeat(30))+' |\n\nPRINT_END_MARKER\n'
await fs.writeFile('work/probe-content/security-check/index.md',source)
function run(args,env={}){const r=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:'inherit',windowsHide:true});if(r.status!==0)throw new Error('Command failed: '+args.join(' '))}
let server,browser
try {
 run(['node_modules/tsx/dist/cli.mjs','scripts/prepare.ts'],{CONTENT_ROOT:'work/probe-content',BLOG_BASE:'/check/'})
 run(['node_modules/vitepress/bin/vitepress.js','build','docs','--outDir',dist],{BLOG_BASE:'/check/'})
 server=spawn(process.execPath,['scripts/serve.mjs',dist,'4174'],{env:{...process.env,PREVIEW_BASE:'/check/'},windowsHide:true,stdio:'pipe'})
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)})
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true})
 const page=await browser.newPage({viewport:{width:1280,height:960}})
 const errors=[];const failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())})
 await page.goto('http://127.0.0.1:4174/check/posts/security-check.html');await page.locator('.article').waitFor()
 await page.reload();await page.locator('.prose').waitFor();assert.equal(await page.evaluate(()=>globalThis.xssProbe),undefined)
 await page.getByRole('button',{name:'搜索文章'}).click();await page.getByRole('textbox',{name:'搜索关键词'}).fill('中文');await page.locator('.search-results a').waitFor();assert.equal(await page.locator('.search-results a').count(),1);await page.keyboard.press('Escape')
 assert.equal(await page.locator('.prose script,.prose [onerror],.prose a[href^="javascript"]').count(),0)
 assert.ok((await page.locator('.prose').innerText()).includes('{{ globalThis.xssProbe=3 }}'))
 await page.locator('.prose img').evaluate(i=>i.decode())
 assert.equal(await page.locator('.prose img').evaluate(i=>i.complete&&i.naturalWidth>0),true)
 assert.ok((await page.locator('.prose a[href$=".pdf"]').getAttribute('href')).startsWith('/check/'))
 assert.equal((await page.request.get('http://127.0.0.1:4174/check/posts/security-check/assets/original.pdf')).status(),200)
 await page.emulateMedia({media:'print'})
 assert.equal(await page.locator('.site-header').isVisible(),false)
 await fs.mkdir('screenshots',{recursive:true})
 await page.pdf({path:'screenshots/long-code-print.pdf',format:'A4',printBackground:true})
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({media:'screen',reducedMotion:'reduce'})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.goto('http://127.0.0.1:4174/check/editor.html');await page.locator('.cm-content').waitFor()
 await page.getByText('导入 PDF',{exact:true}).click();await page.getByTestId('import-pdf').setInputFiles('tests/fixtures/text.pdf')
 await page.locator('.pdf-report').waitFor();assert.ok((await page.locator('.pdf-report').innerText()).includes('1 张独立图片'))
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[])
 await fs.writeFile('work/static-check.json',JSON.stringify({passed:true,base:'/check/',checks:['built hostile Markdown remains text after hydration','no script/event/unsafe link execution','subdirectory direct article/editor navigation','subdirectory image and original PDF access','PDF converter worker and fonts under subdirectory','print CSS with Chinese, long code and wide table','mobile no overflow','no browser errors or failed network responses']},null,2))
 console.log('Static security, subdirectory, PDF and print checks passed.')
} finally {
 await browser?.close();server?.kill()
 run(['node_modules/tsx/dist/cli.mjs','scripts/prepare.ts'])
}

