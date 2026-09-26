import { defineConfig } from 'vitepress'
import site from '../../site.config'
const base=process.env.BLOG_BASE||site.base
export default defineConfig({
  title:site.title,description:site.description,lang:'zh-CN',base,cleanUrls:false,appearance:false,
  lastUpdated:false,ignoreDeadLinks:false,cacheDir:'./.vitepress/cache',outDir:process.env.BLOG_TEST?'./.vitepress/test-dist':'./.vitepress/dist',metaChunk:true,router:{prefetchLinks:false},
  head:[
    ['link',{rel:'icon',type:'image/svg+xml',href:base+'favicon.svg'}],
    ['meta',{name:'referrer',content:'strict-origin-when-cross-origin'}],
    ['script',{}, "(function(){try{var t=localStorage.getItem('blog-theme')||'system';document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches))}catch(e){}})()"]
  ],
  sitemap:site.origin?{hostname:site.origin}:undefined,
  vite:{build:{chunkSizeWarningLimit:850},ssr:{noExternal:['sanitize-html']}},
  markdown:{html:false,headers:{level:[2]}},
})
