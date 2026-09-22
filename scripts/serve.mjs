import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
const root=path.resolve(process.argv[2]||'docs/.vitepress/dist')
const port=Number(process.argv[3]||4173)
const base=process.env.PREVIEW_BASE||'/'
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.pdf':'application/pdf','.wasm':'application/wasm','.bcmap':'application/octet-stream','.woff2':'font/woff2'}
http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1')
  if(!url.pathname.startsWith(base)){res.writeHead(404);res.end('Not found');return}
  const raw=decodeURIComponent(url.pathname.slice(base.length));if(raw.includes('\0')||raw.includes('\\'))throw new Error()
  const file=path.resolve(root,raw||'index.html');if(file!==root&&!file.startsWith(root+path.sep))throw new Error()
  const stat=await fs.stat(file);if(!stat.isFile())throw new Error()
  const bytes=await fs.readFile(file)
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(bytes)
 } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('页面未找到')}
}).listen(port,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:'+port+base))

