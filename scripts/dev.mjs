import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
function prepare(){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/prepare.ts'],{stdio:'inherit',windowsHide:true});p.on('exit',code=>code?reject(new Error('Content preparation failed')):resolve())})}
await prepare()
const server=spawn(process.execPath,['node_modules/vitepress/bin/vitepress.js','dev','docs','--host','127.0.0.1'],{stdio:'inherit',windowsHide:true})
let timer,running=false,pending=false
async function changed(){if(running){pending=true;return}running=true;try{await prepare()}catch(e){console.error(e.message)}finally{running=false;if(pending){pending=false;void changed()}}}
const watcher=watch('content/posts',{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(changed,300)})
function stop(){watcher.close();clearTimeout(timer);server.kill()}
process.on('SIGINT',stop);process.on('SIGTERM',stop);server.on('exit',()=>{watcher.close();process.exit()})

