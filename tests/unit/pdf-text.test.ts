import { it,expect } from 'vitest'
import { organizeText,type TextPiece } from '../../src/core/pdf-text'
const item=(str:string,x:number,y:number,size=12):TextPiece=>({str,transform:[size,0,0,size,x,y],width:str.length*size*.5,height:size})
it('reconstructs headings, paragraphs and lists from coordinates',()=>{
 const r=organizeText([item('A heading',50,750,24),item('First line of the paragraph.',50,700),item('Second line.',50,684),item('• A list item',50,646),item('1. Numbered item',50,622)])
 expect(r.markdown).toContain('## A heading');expect(r.markdown).toContain('paragraph. Second line.');expect(r.markdown).toContain('- A list item');expect(r.markdown).toContain('1. Numbered item')
})
it('flags columns instead of silently claiming faithful ordering',()=>expect(organizeText([item('Left',40,700),item('Right',340,700)]).complex).toBe(true))
it('joins Chinese fragments without extra spaces',()=>expect(organizeText([item('学习',40,700),item('笔记',70,700)]).markdown).toBe('学习笔记'))

