<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { basicSetup } from 'codemirror'
const props=defineProps<{modelValue:string;disabled?:boolean}>()
const emit=defineEmits<{ 'update:modelValue':[string]; files:[File[]] }>()
const host=ref<HTMLElement>();let view:EditorView|undefined
function insert(text:string){if(!view)return;const {from,to}=view.state.selection.main;view.dispatch({changes:{from,to,insert:text},selection:{anchor:from+text.length}});view.focus()}
function link(){const selected=view?.state.sliceDoc(view.state.selection.main.from,view.state.selection.main.to)||'链接文字';insert('['+selected+'](https://)')}
defineExpose({insert,link})
onMounted(()=>{
 view=new EditorView({parent:host.value,state:EditorState.create({doc:props.modelValue,extensions:[
  basicSetup,history(),lineNumbers(),markdown(),keymap.of([...defaultKeymap,...historyKeymap,indentWithTab]),EditorView.lineWrapping,
  EditorView.contentAttributes.of({'aria-label':'Markdown 正文','spellcheck':'false'}),
  EditorView.updateListener.of(update=>{if(update.docChanged)emit('update:modelValue',update.state.doc.toString())}),
  EditorView.domEventHandlers({
   paste(event){const files=Array.from(event.clipboardData?.files||[]);if(files.length){event.preventDefault();emit('files',files);return true}return false},
   drop(event){const files=Array.from(event.dataTransfer?.files||[]);if(files.length){event.preventDefault();emit('files',files);return true}return false}
  })
 ]})})
})
watch(()=>props.modelValue,value=>{if(view&&value!==view.state.doc.toString())view.dispatch({changes:{from:0,to:view.state.doc.length,insert:value}})})
onBeforeUnmount(()=>view?.destroy())
</script>
<template><div ref="host"></div></template>

