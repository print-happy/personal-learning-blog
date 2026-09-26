import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
test('paste, drop, link insertion and resource deletion work in the editor',async({page})=>{
 await page.goto('/editor.html');await page.locator('.cm-content').waitFor()
 const bytes=Array.from(await fs.readFile('tests/fixtures/figure.png'))
 await page.locator('.cm-content').evaluate((el,bytes)=>{
  const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(bytes)],'pasted.png',{type:'image/png'}))
  el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}))
 },bytes)
 await expect(page.locator('.asset-row')).toHaveCount(1)
 await page.locator('.cm-content').evaluate((el,bytes)=>{
  const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(bytes)],'dropped.png',{type:'image/png'}))
  el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}))
 },bytes)
 await expect(page.locator('.asset-row')).toHaveCount(2)
 await expect(page.frameLocator('iframe[title="文章实时预览"]').locator('img')).toHaveCount(2)
 await page.getByRole('button',{name:'插入链接',exact:true}).click()
 await expect(page.locator('.cm-content')).toContainText('[链接文字](https://)')
 page.once('dialog',d=>d.accept())
 await page.locator('.asset-row').first().getByRole('button',{name:/删除/}).click()
 await expect(page.locator('.asset-row')).toHaveCount(1)
 await expect(page.locator('.notice.error').filter({hasText:'附件无法读取'})).toBeVisible();await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.locator('.notice[role=alert]')).toHaveCount(0)
})
test('review gate, atomic save and deployment result through mocked GitHub',async({page})=>{
 let head='base',writes=0
 const requests:any[]=[]
 await page.route('https://api.github.com/**',async route=>{
  const request=route.request();const p=new URL(request.url()).pathname.replace('/repos/author/blog','')
  const body=request.postDataJSON();requests.push({path:p,method:request.method(),body})
  const json=(data:any)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  if(p.startsWith('/git/ref/'))return json({object:{sha:head}})
  if(p==='/git/commits/base')return json({tree:{sha:'tree-base'}})
  if(p==='/git/trees/tree-base')return json({tree:[],truncated:false})
  if(p==='/git/blobs'){writes++;return json({sha:'blob'})}
  if(p==='/git/trees')return json({sha:'tree-new'})
  if(p==='/git/commits')return json({sha:'new-commit'})
  if(p.startsWith('/git/refs/')){expect(body.force).toBe(false);head='new-commit';return json({object:{sha:head}})}
  if(p.includes('/actions/workflows/'))return json({workflow_runs:[{id:1,head_sha:'new-commit',head_branch:'main',run_attempt:1,status:'completed',conclusion:'success'}]})
  if(p==='/deployments')return json([{id:2,sha:'new-commit',environment:'github-pages'}])
  if(p==='/deployments/2/statuses')return json([{state:'success',environment_url:'https://author.github.io/blog/'}])
  throw new Error('Unexpected API call '+p)
 })
 await page.goto('/editor.html');await page.getByLabel('标题',{exact:true}).fill('Mock publication');await page.getByLabel('文章地址',{exact:true}).fill('mock-note')
 await page.locator('.cm-content').fill('## Ready\n\nThis is a test.')
 await page.getByText('发布设置',{exact:true}).click()
 await page.getByLabel('用户 / 组织',{exact:true}).fill('author');await page.getByLabel('仓库',{exact:true}).fill('blog')
 await page.getByTestId('token').fill('mock-token-only')
 const publish=page.getByRole('button',{name:'发布文章',exact:true})
 await expect(publish).toBeDisabled();expect(writes).toBe(0)
 await page.getByLabel('已检查预览').check()
 await publish.click();try{await expect(page.locator('.status-line')).toContainText('部署完成')}catch(e){console.log('Publication error:',await page.locator('.notice[role=alert]').allTextContents(),'API paths:',requests.map(r=>r.path));throw e}
 expect(writes).toBe(1);expect(requests.find(r=>r.path==='/git/trees'&&r.method==='POST').body.base_tree).toBe('tree-base')
 const stored=await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('learning-blog');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
  return new Promise<string>((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').getAll();r.onsuccess=()=>{resolve(JSON.stringify(localStorage)+JSON.stringify(r.result));db.close()};r.onerror=()=>reject(r.error)})
 })
 expect(stored).not.toContain('mock-token-only')
 expect(JSON.stringify(requests)).not.toContain('mock-token-only')
 await page.reload();await expect(page.getByTestId('token')).toHaveValue('');await expect(page.getByRole('button',{name:'刷新发布状态'})).toBeVisible()
})

