import { z } from 'zod';
import { digest } from './verification';
import { publicUrl } from './public-web';
import type { SourceEvidence, SourceEvidenceDetail } from './types';

const timestamp=z.iso.datetime({offset:true});
const cursorSchema=z.object({createdAt:timestamp,id:z.uuid()}).strict();
export const SOURCE_PAGE_SIZE=25;
export function evidenceCursor(raw:string|null):z.infer<typeof cursorSchema>|null {
  if(raw===null)return null;
  if(raw.length>512||!raw.length||!/^[A-Za-z0-9_-]+$/.test(raw))throw new Error('Invalid evidence cursor');
  try{return cursorSchema.parse(JSON.parse(Buffer.from(raw,'base64url').toString('utf8')));}
  catch{throw new Error('Invalid evidence cursor');}
}
export function nextEvidenceCursor(source:SourceEvidence):string {
  return Buffer.from(JSON.stringify({createdAt:source.recordedAt,id:source.id})).toString('base64url');
}
const metadata=z.object({id:z.uuid(),title:z.string().nullable(),source_url:z.string(),created_at:timestamp,
  content_sha256:z.string().regex(/^[a-f0-9]{64}$/),captured_at:timestamp,
  status:z.union([z.number().int(),z.string().regex(/^\d{3}$/).transform(Number)]).pipe(z.number().int().min(100).max(599)),
});
export function sourceMetadata(record:unknown):SourceEvidence {
  const row=metadata.parse(record);const url=publicUrl(row.source_url);
  return {id:row.id,sourceUrl:url.href,recordedAt:row.created_at,capturedAt:row.captured_at,status:row.status,sha256:row.content_sha256,
    phase:row.title==='Independent source check'?'verification':row.title==='Research source'?'research':'source'};
}
export function sourceDetail(record:unknown):SourceEvidenceDetail {
  const row=z.object({content:z.object({url:z.string(),status:z.number().int(),capturedAt:timestamp,text:z.string().max(16000),sha256:z.string()})}).parse(record);
  const source=sourceMetadata(record);
  if(publicUrl(row.content.url).href!==source.sourceUrl||row.content.status!==source.status||row.content.capturedAt!==source.capturedAt||row.content.sha256!==source.sha256||digest(row.content.text)!==source.sha256)throw new Error('Evidence integrity check failed');
  return {...source,text:row.content.text,integrity:'verified'};
}
