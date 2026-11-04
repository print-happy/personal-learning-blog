<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import { Search, Sun, Moon, Monitor, ArrowUpRight, X, Printer } from 'lucide-vue-next'
import site from '../../../site.config'
import postData from '../generated/posts.json'
import topicData from '../generated/topics.json'
import type {PublicTopic} from '../../../src/core/topic-schema'


import { validateAppearance } from '../../../src/core/appearance'
import type { PostMeta } from '../../../src/core/types'
const background=ref({image:'',opacity:0.18})
const backdrop=computed(()=>({backgroundImage:background.value.image?'url("'+background.value.image+'")':'none',opacity:background.value.opacity}))
onMounted(async()=>{try{const r=await fetch(withBase('/appearance.json'));if(r.ok){const value=await r.json();validateAppearance(value);background.value=value}}catch{}})
const topics:PublicTopic[]=topicData as PublicTopic[]
const currentTopic=computed(()=>topics.find(t=>t.id===fm.value.topicId))
const topicPosts=computed(()=>{const t=currentTopic.value;if(!t)return [];const rows=posts.filter(p=>t.members.includes(p.slug));return t.order==='manual'?rows.sort((a,b)=>t.members.indexOf(a.slug)-t.members.indexOf(b.slug)):rows})
function modified(p:{updatedAt?:number,date?:unknown}){return p.updatedAt?new Date(p.updatedAt).toISOString().slice(0,10):String(p.date||'').slice(0,10)}
const posts:PostMeta[]=postData
const {frontmatter:fm}=useData()
const mode=ref('system'), query=ref(''), selectedTag=ref(''), searchResults=ref<PostMeta[]>([]), searchError=ref('')
const dialog=ref<HTMLDialogElement>(),searchInput=ref<HTMLInputElement>()
let searchData:PostMeta[]|undefined;let media:MediaQueryList|undefined
const tags=computed(()=>[...new Set(posts.flatMap(p=>p.tags))])
const listed=computed(()=>posts.filter(p=>!selectedTag.value||p.tags.includes(selectedTag.value)))
const filtered=computed(()=>searchResults.value.slice(0,30))
function theme(){const dark=mode.value==='dark'||(mode.value==='system'&&!!media?.matches);document.documentElement.classList.toggle('dark',dark)}
function cycleTheme(){mode.value=mode.value==='system'?'light':mode.value==='light'?'dark':'system';try{localStorage.setItem('blog-theme',mode.value)}catch{}theme()}
async function search(){
  searchError.value=''
  try{if(!searchData){const r=await fetch(withBase('/search.json'));if(!r.ok)throw new Error();searchData=await r.json()}const term=query.value.trim().toLocaleLowerCase();searchResults.value=term?searchData!.filter(p=>(p.title+' '+p.tags.join(' ')+' '+p.text).toLocaleLowerCase().includes(term)):[]}
  catch{searchError.value='搜索暂时不可用，请重试'}
}
async function openSearch(){dialog.value?.showModal();await nextTick();searchInput.value?.focus();await search()}
function keyboard(e:KeyboardEvent){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();void openSearch()}}
function print(){window.print()}
onMounted(()=>{try{mode.value=localStorage.getItem('blog-theme')||'system'}catch{}media=matchMedia('(prefers-color-scheme:dark)');media.addEventListener('change',theme);theme();document.addEventListener('keydown',keyboard)})
onBeforeUnmount(()=>{media?.removeEventListener('change',theme);document.removeEventListener('keydown',keyboard)})
</script>
<template>
  <div class="page-background" :style="backdrop" aria-hidden="true"></div>
  <a class="skip-link" href="#main">跳至正文</a>
  <header class="site-header">
    <a class="brand" :href="withBase('/')">{{ site.title }}</a>
    <nav aria-label="主导航">
      <a :href="withBase('/articles.html')" :aria-current="fm.layout==='articles'?'page':undefined">文章</a>
      <a :href="withBase('/topics.html')" :aria-current="['topics','topic'].includes(fm.layout)?'page':undefined">专题</a>
      <a :href="withBase('/about.html')" :aria-current="fm.layout==='about'?'page':undefined">关于</a>
    </nav>
    <div class="header-actions">

      <button class="icon-button" aria-label="搜索文章" title="搜索 Ctrl K" @click="openSearch"><Search :size="19"/></button>
      <button class="icon-button" :aria-label="'主题：'+({system:'跟随系统',light:'日间',dark:'夜间'}[mode])+'，点击切换'" @click="cycleTheme"><Monitor v-if="mode==='system'" :size="19"/><Sun v-else-if="mode==='light'" :size="19"/><Moon v-else :size="19"/></button>
    </div>
  </header>
  <main id="main" class="main">
    <template v-if="fm.layout==='topics'||fm.layout==='topic'">
 <template v-if="currentTopic"><a :href="withBase('/topics.html')">所有专题</a><div class="page-heading"><h1>{{currentTopic.title}}</h1><span class="muted">{{topicPosts.length}} 篇</span></div><p style="white-space:pre-wrap">{{currentTopic.description}}</p>
 <div class="post-list"><a v-for="post in topicPosts" :key="post.slug" class="post-row" :href="withBase('/posts/'+post.slug+'.html')"><time class="archive-date">{{modified(post)}}</time><div><h2>{{post.title}}</h2><span v-for="tag in post.tags" :key="tag" class="tag">{{tag}}</span></div><ArrowUpRight :size="20"/></a></div><p v-if="!topicPosts.length" class="empty-posts">暂无文章</p></template>
 <template v-else><div class="page-heading"><h1>专题</h1></div><div class="post-list"><a v-for="t in topics" :key="t.id" class="post-row" :href="withBase('/topics/'+encodeURIComponent(t.id)+'.html')"><span class="muted">{{t.members.length}} 篇</span><div><h2>{{t.title}}</h2><p>{{t.description}}</p></div><ArrowUpRight :size="20"/></a></div><p v-if="!topics.length" class="empty-posts">暂无专题</p></template>
 </template>
 <template v-else-if="fm.layout==='home'||fm.layout==='articles'">
      <div class="page-heading"><span class="eyebrow">{{fm.layout==='topics'?'TOPICS':'ARCHIVE'}}</span><h1>{{fm.layout==='home'?'文章':fm.title}}</h1><span class="muted">{{posts.length}} 篇</span></div>
      <div v-if="posts.length" class="tag-filters" aria-label="按标签筛选"><button :class="{selected:!selectedTag}" @click="selectedTag=''">全部</button><button v-for="tag in tags" :key="tag" :class="{selected:selectedTag===tag}" @click="selectedTag=tag">{{tag}} <span>{{posts.filter(p=>p.tags.includes(tag)).length}}</span></button></div>
      <p v-if="!listed.length" class="empty-posts">暂无文章</p>
      <div class="post-list"><a v-for="post in listed" :key="post.slug" class="post-row" :href="withBase('/posts/'+post.slug+'.html')"><time class="archive-date">{{modified(post)}}</time><div><h2>{{post.title}}</h2><div class="post-meta"><span v-for="tag in post.tags" :key="tag" class="tag">{{tag}}</span></div></div><ArrowUpRight class="post-arrow" :size="20"/></a></div>
    </template>
    <template v-else-if="fm.layout==='article'">
      <div class="article-layout">
        <article class="article"><a class="back-link" :href="withBase('/articles.html')">所有文章</a><header class="article-heading"><h1>{{fm.title}}</h1><div class="post-meta"><time>{{modified(fm)}}</time><span v-for="tag in fm.tags" :key="tag" class="tag">{{tag}}</span><button class="print-button" @click="print"><Printer :size="15"/>导出 PDF</button></div></header>
          <nav class="tag-filters" aria-label="收录专题"><a v-for="t in topics.filter(t=>t.members.includes(fm.slug))" :key="t.id" :href="withBase('/topics/'+encodeURIComponent(t.id)+'.html')">{{t.title}}</a></nav>
          <div class="prose" v-html="fm.body"></div>
          <section v-if="fm.pdfs?.length" class="original-pdfs"><h2>附件</h2><div v-for="pdf in fm.pdfs" :key="pdf.url"><a :href="pdf.url" target="_blank" rel="noopener noreferrer">打开 {{pdf.name}}</a><a class="button small" :href="pdf.url" download>下载原文件</a><iframe :src="pdf.url" :title="pdf.name+' 原 PDF 阅读器'" loading="lazy"></iframe></div></section>
        </article>
        <aside class="toc" v-if="fm.headings?.length"><span>本页内容</span><a v-for="h in fm.headings" :key="h.id" :href="'#'+h.id" :class="{sub:h.level>2}">{{h.text}}</a></aside>
      </div>
    </template>
    <template v-else-if="fm.layout==='about'"><div class="about-page"><span class="eyebrow">ABOUT</span><h1>关于</h1><p>这里记录我的学习笔记与阅读心得。</p><p><a href="https://github.com/print-happy" target="_blank" rel="noopener noreferrer">GitHub</a></p></div></template>
    <template v-else><div class="about-page"><h1>页面未找到</h1><a :href="withBase('/')">回到首页</a></div></template>
  </main>
  <footer class="site-footer"><span>{{site.title}}</span><a :href="withBase('/about.html')">关于本站</a></footer>
  <dialog ref="dialog" class="search-dialog" @click="e=>{if(e.target===dialog)dialog?.close()}"><div class="search-top"><Search :size="21"/><input ref="searchInput" v-model="query" aria-label="搜索关键词" placeholder="搜索笔记" @input="search"/><button class="icon-button" aria-label="关闭搜索" @click="dialog?.close()"><X :size="20"/></button></div><div class="search-results"><p v-if="searchError">{{searchError}}</p><p v-else-if="!query.trim()" class="muted">输入标题、标签或正文关键词</p><p v-else-if="!filtered.length" class="muted">没有找到相关笔记</p><a v-for="p in filtered" :key="p.slug" :href="withBase('/posts/'+p.slug+'.html')" @click="dialog?.close()"><strong>{{p.title}}</strong><small>{{p.date}} · {{p.tags.join(' / ')}}</small></a></div><div class="search-bottom">Esc 关闭</div></dialog>
</template>
