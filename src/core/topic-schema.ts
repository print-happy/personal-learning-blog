export interface PublicTopic { id:string; title:string; description:string; order:'updated'|'manual'; members:string[]; updatedAt:number }
export interface TopicCatalog { schema:1; topics:PublicTopic[] }
const idPattern=/^[a-zA-Z0-9-]{1,100}$/
export const validTopicId=(v:unknown):v is string=>typeof v==='string'&&idPattern.test(v)&&!['constructor','prototype'].includes(v)
export function validateCatalog(value:unknown):TopicCatalog{
 const c=value as TopicCatalog
 if(!c||c.schema!==1||!Array.isArray(c.topics)||c.topics.length>2000)throw new Error('专题目录无效')
 const ids=new Set<string>()
 const topics=c.topics.map(t=>{
  if(!t||!validTopicId(t.id)||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>160||typeof t.description!=='string'||t.description.length>4000||!['updated','manual'].includes(t.order)||!Array.isArray(t.members)||t.members.length>10000||t.members.some(s=>typeof s!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(s))||new Set(t.members).size!==t.members.length||!Number.isSafeInteger(t.updatedAt)||t.updatedAt<0||t.updatedAt>8640000000000000)throw new Error('专题内容无效')
  ids.add(t.id);return {id:t.id,title:t.title,description:t.description,order:t.order,members:[...t.members],updatedAt:t.updatedAt}
 })
 return {schema:1,topics}
}
export const topicKey=(t:PublicTopic)=>JSON.stringify([t.id,t.title,t.description,t.order,t.order==='manual'?t.members:[...t.members].sort()])
