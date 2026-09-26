import {test,expect} from '@playwright/test'

test('help opens separately and keeps the current draft and publishing credential',async({page})=>{
  await page.goto('/editor.html')
  await page.getByLabel('标题',{exact:true}).fill('还在写的草稿')
  await page.locator('.cm-content').fill('## 正文\n\n打开帮助时保留这段文字。')
  await page.getByText('发布设置',{exact:true}).click()
  await page.getByTestId('token').fill('mock-help-token-only')
  const opened=page.waitForEvent('popup')
  await page.getByRole('link',{name:'写作帮助（新标签页打开）'}).click()
  const help=await opened
  await expect(help).toHaveURL(/\/help\.html$/)
  await expect(help.getByRole('heading',{name:'写作与发布',exact:true})).toBeVisible()
  for(const id of ['local','import','web','publish','manage','troubleshooting'])await expect(help.locator('#'+id)).toBeVisible()
  await expect(help.getByRole('navigation',{name:'帮助目录'}).getByRole('link')).toHaveCount(6)
  await help.getByRole('link',{name:'网页发布与访问令牌',exact:true}).first().click()
  await expect(help).toHaveURL(/#publish$/)
  await expect(page.getByLabel('标题',{exact:true})).toHaveValue('还在写的草稿')
  await expect(page.locator('.cm-content')).toContainText('打开帮助时保留这段文字。')
  await expect(page.getByTestId('token')).toHaveValue('mock-help-token-only')
  await help.setViewportSize({width:390,height:844})
  expect(await help.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
