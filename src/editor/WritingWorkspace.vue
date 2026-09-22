<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Maximize, Minimize, Columns2, GripVertical } from 'lucide-vue-next'

const props=defineProps<{tab:string}>()
const workspace=ref<HTMLElement>(), panes=ref<HTMLElement>(), toggle=ref<HTMLButtonElement>()
const expanded=ref(false), dragging=ref(false), split=ref(50)
const wide=ref(true)
const leftClosed=computed(()=>split.value===0&&(expanded.value||wide.value))
const rightClosed=computed(()=>split.value===100&&(expanded.value||wide.value))
const columns=computed(()=>`minmax(0, ${split.value}fr) 14px minmax(0, ${100-split.value}fr)`)
let pointer:number|undefined, handle:HTMLElement|undefined, oldOverflow=''
let previousFocus:HTMLElement|null=null, active=true
let media:MediaQueryList|undefined
function viewportChanged(){wide.value=media?.matches??true}

function setSplit(value:number){split.value=Math.max(0,Math.min(100,value))}
function move(event:PointerEvent){
  if(event.pointerId!==pointer||!panes.value||!handle)return
  const rect=panes.value.getBoundingClientRect(), width=handle.getBoundingClientRect().width
  const value=(event.clientX-rect.left-width/2)/(rect.width-width)*100
  setSplit(value<1?0:value>99?100:value)
}
function start(event:PointerEvent){
  if(!event.isPrimary||event.button!==0)return
  event.preventDefault()
  handle=event.currentTarget as HTMLElement;pointer=event.pointerId
  handle.focus();handle.setPointerCapture(pointer);dragging.value=true
  move(event)
}
function stop(){
  const id=pointer, target=handle
  pointer=undefined;handle=undefined;dragging.value=false
  if(id!==undefined&&target?.hasPointerCapture(id))target.releasePointerCapture(id)
}
function resizeKey(event:KeyboardEvent){
  const step=event.shiftKey?10:2
  if(event.key==='ArrowLeft')setSplit(split.value-step)
  else if(event.key==='ArrowRight')setSplit(split.value+step)
  else if(event.key==='Home')setSplit(0)
  else if(event.key==='End')setSplit(100)
  else if(event.key==='Enter')setSplit(50)
  else return
  event.preventDefault()
}
function restore(){
  if(!expanded.value)return
  stop();expanded.value=false;document.body.style.overflow=oldOverflow
  void nextTick(()=>{if(active)(previousFocus?.isConnected?previousFocus:toggle.value)?.focus({preventScroll:true})})
}
async function exit(){
  if(document.fullscreenElement===workspace.value){try{await document.exitFullscreen()}catch{}}
  restore()
}
async function enter(){
  previousFocus=document.activeElement as HTMLElement
  oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';expanded.value=true
  // The fixed viewport layout also works where the browser disallows native fullscreen.
  try{await workspace.value?.requestFullscreen?.()}catch{}
  await nextTick();if(active&&expanded.value)toggle.value?.focus({preventScroll:true})
}
function fullscreenChanged(){if(document.fullscreenElement!==workspace.value)restore()}
function escape(event:KeyboardEvent){if(event.key==='Escape'&&expanded.value){event.preventDefault();void exit()}}
onMounted(()=>{media=matchMedia('(min-width:901px)');viewportChanged();media.addEventListener('change',viewportChanged);document.addEventListener('fullscreenchange',fullscreenChanged);window.addEventListener('keydown',escape)})
onBeforeUnmount(()=>{
  active=false;stop();restore()
  document.removeEventListener('fullscreenchange',fullscreenChanged);window.removeEventListener('keydown',escape)
  media?.removeEventListener('change',viewportChanged)
  if(document.fullscreenElement===workspace.value)void document.exitFullscreen().catch(()=>{})
})
</script>

<template>
  <div ref="workspace" class="writing-workspace" :class="{'is-expanded':expanded,'is-dragging':dragging}">
    <div class="workspace-toolbar">
      <span class="workspace-title">写作区</span>
      <div class="toolbar">
        <button class="button reset-split" @click="setSplit(50)" title="恢复左右各半"><Columns2 :size="16"/>恢复等宽</button>
        <button ref="toggle" class="button" :aria-pressed="expanded" @click="expanded?exit():enter()">
          <Minimize v-if="expanded" :size="16"/><Maximize v-else :size="16"/>{{expanded?'退出全屏':'全屏写作'}}
        </button>
      </div>
    </div>
    <div ref="panes" class="editor-workspace resizable-panes" :style="{'--pane-columns':columns}">
      <section id="markdown-pane" :class="['edit-pane',{'mobile-hidden':props.tab!=='edit','collapsed-pane':leftClosed}]" :inert="leftClosed" :aria-hidden="leftClosed||undefined">
        <div class="pane-heading"><span>Markdown</span><div class="toolbar"><slot name="tools"/></div></div>
        <div class="markdown-host"><slot name="markdown"/></div>
      </section>
      <div class="pane-splitter" role="separator" tabindex="0" aria-label="调整 Markdown 与预览宽度" aria-orientation="vertical" aria-controls="markdown-pane preview-pane" :aria-valuenow="Math.round(split)" :aria-valuemin="0" :aria-valuemax="100" :aria-valuetext="`Markdown ${Math.round(split)}%，预览 ${100-Math.round(split)}%`" title="拖动调整宽度；双击恢复等宽；方向键微调，Home / End 收起一侧" @pointerdown="start" @pointermove="move" @pointerup="stop" @pointercancel="stop" @lostpointercapture="stop" @keydown="resizeKey" @dblclick="setSplit(50)"><GripVertical :size="14" aria-hidden="true"/></div>
      <section id="preview-pane" :class="['preview-pane',{'mobile-hidden':props.tab!=='preview','collapsed-pane':rightClosed}]" :inert="rightClosed" :aria-hidden="rightClosed||undefined">
        <div class="pane-heading">实时预览</div><slot name="preview"/>
      </section>
    </div>
  </div>
</template>

<style scoped>
.writing-workspace{min-width:0}
.workspace-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.workspace-title{font-size:.875rem;color:var(--muted)}
.resizable-panes{grid-template-columns:var(--pane-columns);min-height:620px}
.edit-pane,.preview-pane{overflow:hidden;border:0}
.pane-heading{white-space:nowrap;overflow:hidden}
.pane-splitter{display:flex;align-items:center;justify-content:center;position:relative;z-index:1;min-width:0;cursor:col-resize;touch-action:none;user-select:none;background:var(--soft);border-inline:1px solid var(--line);color:var(--muted)}
.pane-splitter:hover,.pane-splitter:focus-visible,.is-dragging .pane-splitter{background:var(--accent-soft);color:var(--accent)}
.pane-splitter:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.collapsed-pane{visibility:hidden}
.is-dragging{user-select:none;cursor:col-resize}
.is-dragging :deep(iframe){pointer-events:none}
.is-expanded{position:fixed;inset:0;z-index:1000;width:100%;height:100dvh;background:var(--bg);display:flex;flex-direction:column;padding:0;min-width:0}
.is-expanded .workspace-toolbar{flex:none;min-height:62px;margin:0;padding:10px 16px;gap:8px;border-bottom:1px solid var(--line)}
.is-expanded .resizable-panes{flex:1;min-height:0;border:0;border-radius:0;overflow:hidden}
.is-expanded .edit-pane,.is-expanded .preview-pane{display:flex;flex-direction:column;min-height:0}
.is-expanded .pane-heading{flex-shrink:0}
.is-expanded .markdown-host{flex:1;min-height:0;overflow:hidden}
.is-expanded .markdown-host :deep(>div){height:100%}
.is-expanded :deep(.cm-editor){height:100%;min-height:0}
.is-expanded :deep(.cm-scroller){height:100%;min-height:0}
.is-expanded :deep(iframe){flex:1;height:0;min-height:0;width:100%}
@media(max-width:900px){
  .writing-workspace:not(.is-expanded) .resizable-panes{grid-template-columns:minmax(0,1fr)}
  .writing-workspace:not(.is-expanded) .pane-splitter,.writing-workspace:not(.is-expanded) .reset-split{display:none}
  .writing-workspace:not(.is-expanded) .collapsed-pane{visibility:visible}
  .is-expanded .resizable-panes{grid-template-columns:var(--pane-columns)}
  .is-expanded .editor-workspace .mobile-hidden{display:flex}
  .is-expanded .pane-heading{padding:10px 8px}
  .is-expanded .workspace-title{display:none}
  .is-expanded .workspace-toolbar{justify-content:flex-end}
}
</style>
