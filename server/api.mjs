const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const database=env=>{if(!env.DB)throw new Error('Database unavailable');return env.DB;};
export async function api(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/api/check-name'){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const name=(url.searchParams.get('name')||'').trim();
  if(!name||name.length>24)return json({error:'Invalid name'},400);
  const db=database(env);
  const result=await db.query(`SELECT 1 FROM scores WHERE LOWER(TRIM(name))=LOWER($1) UNION SELECT 1 FROM players WHERE name_lower=LOWER(TRIM($1)) LIMIT 1`,[name]);
  return json({exists:result.rows.length>0});
 }
 if(url.pathname==='/api/player'){
  const db=database(env);
  try{
   if(request.method==='GET'){
    const name=(url.searchParams.get('name')||'').trim();
    if(!name||name.length>24)return json({error:'Invalid name'},400);
    const r=await db.query('SELECT name,gender,game_state,created_at,updated_at FROM players WHERE name_lower=LOWER(TRIM($1))',[name]);
    if(r.rows.length===0)return json({exists:false});
    return json({exists:true,player:{name:r.rows[0].name,gender:r.rows[0].gender,gameState:r.rows[0].game_state,createdAt:r.rows[0].created_at,updatedAt:r.rows[0].updated_at}});
   }
   if(request.method==='POST'){
    const raw=await request.text();
    let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
    const action=body?.action||'update';
    const name=(body?.name||'').trim();
    const gender=body?.gender==='female'?'female':'male';
    if(!name||name.length>24)return json({error:'Invalid name'},400);
    if(action==='create'){
     const gs=body?.gameState&&typeof body.gameState==='object'?body.gameState:{};
     const r=await db.query(`INSERT INTO players (name_lower,name,gender,game_state,updated_at) VALUES (LOWER(TRIM($1)),$1,$2,$3,CURRENT_TIMESTAMP) ON CONFLICT (name_lower) DO UPDATE SET name=excluded.name,gender=excluded.gender,game_state=excluded.game_state,updated_at=CURRENT_TIMESTAMP RETURNING name,gender,game_state`,[name,gender,JSON.stringify(gs)]);
     return json({ok:true,player:r.rows[0]});
    }
    if(action==='update'){
     const gs=body?.gameState;
     if(!gs||typeof gs!=='object')return json({error:'Invalid gameState'},400);
     const r=await db.query('UPDATE players SET game_state=$1,updated_at=CURRENT_TIMESTAMP WHERE name_lower=LOWER(TRIM($2))',[JSON.stringify(gs),name]);
     if(r.rowCount===0)return json({ok:false,deleted:true,message:'Người chơi đã bị xóa bởi quản trị viên.'});
     return json({ok:true});
    }
    return json({error:'Unknown action'},400);
   }
   return json({error:'Method not allowed'},405);
  }catch(e){console.error('Player API error',e.code||'UNKNOWN');return json({error:'Server error'},500);}
 }
 if(url.pathname==='/api/admin'){
  const adminKey=request.headers.get('x-admin-key')||url.searchParams.get('key')||'';
  if(adminKey!==(env.ADMIN_KEY||process.env.ADMIN_KEY||''))return json({error:'Unauthorized'},401);
  const db=database(env),action=url.searchParams.get('action')||'list';
  try{
   if(request.method==='GET'&&action==='list'){
    const r=await db.query(`SELECT COALESCE(s.id,p.name_lower) AS id,COALESCE(p.name,s.name) AS name,COALESCE(p.gender,s.gender) AS gender,COALESCE(s.mode,'full') AS mode,COALESCE(s.score,0) AS score,COALESCE(s.duration,0) AS duration,COALESCE(s.mistakes,0) AS mistakes,COALESCE(s.answered,jsonb_array_length(COALESCE(p.game_state->'answers','[]'::jsonb)),0) AS answered,COALESCE(s.npc_count,0) AS npc_count,COALESCE(s.rules_version,2) AS rules_version,COALESCE(s.created_at,(EXTRACT(EPOCH FROM p.created_at)*1000)::bigint) AS created_at,COALESCE(p.updated_at,s.updated_at) AS updated_at FROM players p FULL OUTER JOIN scores s ON p.name_lower=LOWER(TRIM(s.name)) ORDER BY updated_at DESC`);
    return json({players:r.rows,total:r.rows.length});
   }
   if(request.method==='GET'&&action==='stats'){
    const r=await db.query(`SELECT (SELECT COUNT(*) FROM players) AS total_players,COUNT(*) FILTER (WHERE npc_count=18) AS completed,COALESCE(AVG(score),0) AS avg_score,COALESCE(MAX(score),0) AS max_score,COALESCE(AVG(duration),0) AS avg_duration FROM scores WHERE rules_version=2`);
    return json(r.rows[0]);
   }
   if(request.method==='DELETE'&&action==='delete'){
    const id=url.searchParams.get('id');
    let name=(url.searchParams.get('name')||'').trim();
    if(!id&&!name)return json({error:'Missing id or name'},400);
    if(!name&&id){
     const s=await db.query('SELECT name FROM scores WHERE id=$1',[id]);
     if(s.rows.length)name=s.rows[0].name;
     else{const p=await db.query('SELECT name FROM players WHERE name_lower=LOWER(TRIM($1))',[id]);if(p.rows.length)name=p.rows[0].name;}
    }
    let del=0;
    if(id){const r=await db.query('DELETE FROM scores WHERE id=$1',[id]);del+=r.rowCount;}
    if(name){const r1=await db.query('DELETE FROM scores WHERE LOWER(TRIM(name))=LOWER($1)',[name]);const r2=await db.query('DELETE FROM players WHERE name_lower=LOWER(TRIM($1))',[name]);del+=(r1.rowCount+r2.rowCount);}
    return json({deleted:del>0,id,name});
   }
   if(request.method==='DELETE'&&action==='delete-by-name'){
    const name=(url.searchParams.get('name')||'').trim();
    if(!name)return json({error:'Missing name'},400);
    const r1=await db.query('DELETE FROM scores WHERE LOWER(TRIM(name))=LOWER($1)',[name]);
    const r2=await db.query('DELETE FROM players WHERE name_lower=LOWER(TRIM($1))',[name]);
    return json({deleted:r1.rowCount>0||r2.rowCount>0,name});
   }
   if(request.method==='DELETE'&&action==='clear-all'){
    const r1=await db.query('DELETE FROM scores');
    const r2=await db.query('DELETE FROM players');
    return json({deleted:r1.rowCount+r2.rowCount});
   }
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
  const pCheck=await db.query('SELECT 1 FROM players WHERE name_lower=LOWER(TRIM($1))',[x.name]);
  if(pCheck.rows.length===0)return json({error:'Người chơi không tồn tại hoặc đã bị xóa.',deleted:true},403);
  await db.query('INSERT INTO scores (id,name,gender,mode,score,duration,mistakes,created_at,answered,npc_count,answers_json,rules_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET score=excluded.score,duration=excluded.duration,mistakes=excluded.mistakes,answered=excluded.answered,npc_count=excluded.npc_count,answers_json=excluded.answers_json,updated_at=CURRENT_TIMESTAMP WHERE excluded.npc_count > scores.npc_count AND excluded.rules_version = scores.rules_version', [x.id,x.name.trim(),x.gender,'full',x.score,x.duration,x.mistakes,Date.now(),answered,npcCount,JSON.stringify(x.answers),rules]);
  return json({ok:true});
 }catch(error){console.error('Leaderboard storage error',error.code||'UNKNOWN');return json({error:'Bảng xếp hạng tạm thời chưa kết nối được.'},503);}
}
