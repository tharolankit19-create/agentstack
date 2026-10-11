import 'server-only';
import { checked,ownedJob,type Admin } from './store';
import { evidenceCursor,nextEvidenceCursor,sourceMetadata,sourceDetail,SOURCE_PAGE_SIZE } from './evidence';
import type { SourceEvidencePage,SourceEvidenceDetail } from './types';

const columns='id,title,source_url,content_sha256,created_at,status:content->>status,captured_at:content->>capturedAt';
export async function sourceEvidencePage(admin:Admin,user:string,job:string,cursor:string|null):Promise<SourceEvidencePage|null> {
  const after=evidenceCursor(cursor);
  if(!await ownedJob(admin,user,job))return null;
  let query=admin.from('task_evidence').select(columns).eq('mission_id',job).eq('user_id',user).eq('kind','source')
    .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(SOURCE_PAGE_SIZE+1);
  // Both interpolated values have been strictly validated as ISO timestamps / UUIDs.
  if(after)query=query.or(`created_at.gt.${after.createdAt},and(created_at.eq.${after.createdAt},id.gt.${after.id})`);
  const records=checked(await query);if(!records)throw new Error('Evidence storage unavailable');
  const sources=records.slice(0,SOURCE_PAGE_SIZE).map(sourceMetadata);
  return {sources,nextCursor:records.length>SOURCE_PAGE_SIZE?nextEvidenceCursor(sources[sources.length-1]):null};
}
export async function sourceEvidenceDetail(admin:Admin,user:string,job:string,id:string):Promise<SourceEvidenceDetail|null> {
  if(!await ownedJob(admin,user,job))return null;
  const record=checked(await admin.from('task_evidence').select(columns+',content').eq('id',id).eq('mission_id',job).eq('user_id',user).eq('kind','source').maybeSingle());
  return record?sourceDetail(record):null;
}
