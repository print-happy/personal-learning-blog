import { spawn } from 'node:child_process'
const env={...process.env,BLOG_BASE:'/',BLOG_TEST:'1',CONTENT_ROOT:'tests/fixtures/posts'}
function run(args,environment=env){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{env:environment,stdio:'inherit',windowsHide:true})
  child.on('error',reject);child.on('exit',code=>code?reject(new Error('Test build failed')):resolve())
})}
try{
  await run(['node_modules/tsx/dist/cli.mjs','scripts/prepare.ts'])
  await run(['node_modules/vitepress/bin/vitepress.js','build','docs'])
}finally{
  await run(['node_modules/tsx/dist/cli.mjs','scripts/prepare.ts'],process.env)
}
process.argv[2]='docs/.vitepress/test-dist'
process.argv[3]='4177'
process.env.PREVIEW_BASE='/'
await import('./serve.mjs')
