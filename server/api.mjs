const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const database=env=>{if(!env.DB)throw new Error('Database unavailable');return env.DB;};
export async function api(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/api/check-name'){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const name=(url.searchParams.get('name')||'').trim();
  if(!name||name.length>24)return json({error:'Invalid name'},400);
  const db=database(env);
  const result=await db.query('SELECT 1 FROM scores WHERE LOWER(TRIM(name))=LOWER($1) LIMIT 1',[name]);
  return json({exists:result.rows.length>0});
 }
 if(url.pathname==='/api/admin'){
  const adminKey=request.headers.get('x-admin-key')||url.searchParams.get('key')||'';
  if(adminKey!==(env.ADMIN_KEY||process.env.ADMIN_KEY||''))return json({error:'Unauthorized'},401);
  const db=database(env),action=url.searchParams.get('action')||'list';
  try{
   if(request.method==='GET'&&action==='list'){const r=await db.query('SELECT id,name,gender,mode,score,duration,mistakes,answered,npc_count,rules_version,created_at,updated_at FROM scores ORDER BY updated_at DESC');return json({players:r.rows,total:r.rows.length});}
   if(request.method==='GET'&&action==='stats'){const r=await db.query("SELECT COUNT(*) AS total_players,COUNT(*) FILTER (WHERE npc_count=18) AS completed,COALESCE(AVG(score),0) AS avg_score,COALESCE(MAX(score),0) AS max_score,COALESCE(AVG(duration),0) AS avg_duration FROM scores WHERE rules_version=2");return json(r.rows[0]);}
   if(request.method==='DELETE'&&action==='delete'){const id=url.searchParams.get('id');if(!id)return json({error:'Missing id'},400);const r=await db.query('DELETE FROM scores WHERE id=$1',[id]);return json({deleted:r.rowCount>0,id});}
   if(request.method==='DELETE'&&action==='delete-by-name'){const name=(url.searchParams.get('name')||'').trim();if(!name)return json({error:'Missing name'},400);const r=await db.query('DELETE FROM scores WHERE LOWER(TRIM(name))=LOWER($1)',[name]);return json({deleted:r.rowCount,name});}
   if(request.method==='DELETE'&&action==='clear-all'){const r=await db.query('DELETE FROM scores');return json({deleted:r.rowCount});}
   return json({error:'Unknown action'},400);
  }catch(e){console.error('Admin API error',e.code||'UNKNOWN');return json({error:'Server error'},503);}
 }
 if(url.pathname!=='/api/leaderboard')return json({error:'Not found'},404);
 try{
  const db=database(env);
  if(request.method==='GET'){
   const mode='full';
   const result=await db.query('SELECT name, gender, score, duration, npc_count, answered FROM scores WHERE mode = $1 AND rules_version = 2 ORDER BY score DESC, duration ASC, created_at ASC LIMIT 50', [mode]);
   return json(result.rows);
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Invalid origin'},403);
  if(Number(request.headers.get('content-length')||0)>2048)return json({error:'Too large'},413);
  const raw=await request.text();if(raw.length>2048)return json({error:'Too large'},413);
  let x;try{x=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
  const rules=x?.rulesVersion??1;if(![1,2].includes(rules))return json({error:'Invalid game version'},400);const maps=rules===2?6:4,questions=rules===2?5:4,total=maps*3*questions;
  if(!x||!Array.isArray(x.answers)||x.answers.length>total||x.answers.some(k=>typeof k!=='string'||!(rules===2?/^([0-5]):([0-2]):([0-4])$/:/^([0-3]):([0-2]):([0-3])$/).test(k))||new Set(x.answers).size!==x.answers.length)return json({error:'Invalid progress'},400);
  const answered=x.answers.length;let npcCount=0;for(let m=0;m<maps;m++)for(let n=0;n<3;n++)if(Array.from({length:questions},(_,i)=>i).every(q=>x.answers.includes(`${m}:${n}:${q}`)))npcCount++;
  if(npcCount<1||x.npcCount!==npcCount)return json({error:'Incomplete NPC'},400);
  if(!x||(x.mode!==undefined&&x.mode!=='full')||!['male','female'].includes(x.gender)||typeof x.name!=='string'||!x.name.trim()||x.name.length>24||/[\u0000-\u001f]/.test(x.name)||typeof x.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(x.id)||!Number.isInteger(x.mistakes)||x.mistakes<0||x.mistakes>maps*2||!Number.isInteger(x.duration)||x.duration<1||x.duration>31536000||x.score!==Math.max(0,answered*100-x.mistakes*25))return json({error:'Invalid result'},400);
  await db.query('INSERT INTO scores (id,name,gender,mode,score,duration,mistakes,created_at,answered,npc_count,answers_json,rules_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET score=excluded.score,duration=excluded.duration,mistakes=excluded.mistakes,answered=excluded.answered,npc_count=excluded.npc_count,answers_json=excluded.answers_json,updated_at=CURRENT_TIMESTAMP WHERE excluded.npc_count > scores.npc_count AND excluded.rules_version = scores.rules_version', [x.id,x.name.trim(),x.gender,'full',x.score,x.duration,x.mistakes,Date.now(),answered,npcCount,JSON.stringify(x.answers),rules]);
  return json({ok:true});
 }catch(error){console.error('Leaderboard storage error',error.code||'UNKNOWN');return json({error:'Bảng xếp hạng tạm thời chưa kết nối được.'},503);}
}
