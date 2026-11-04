import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root='docs/.vitepress/dist';
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p)}}walk(root);
for(const p of files){
 if(/(?:editor|library|help)\.html$/.test(p))throw new Error('Authoring route in public output');
 if(!/\.(html|js)$/.test(p))continue;
 let text=fs.readFileSync(p,'utf8');
 if(/learning-notes-credentials|plugin:secure-github|oauth\/access_token|Iv23li|notes-client-id|account-token|learning-notes-v2/.test(text))throw new Error('Private app code in public output');
 if(p.endsWith('.html')){
  const hashes=[...text.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+createHash('sha256').update(m[1]).digest('base64')+"'");
  const csp="default-src 'self'; script-src 'self' "+hashes.join(' ')+"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
  text=text.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+csp+'">');fs.writeFileSync(p,text);
 }
}
console.log('Read-only site: '+files.length+' files inspected; authoring routes and credential code absent; CSP applied.');
