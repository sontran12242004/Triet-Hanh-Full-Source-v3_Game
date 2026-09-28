import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {api} from '../server/api.mjs';
test('PostgreSQL schema + API: checkpoint save, JSONB, update, duplicates, sorting and repeated initialization',async()=>{
 const db=new PGlite();try{
 await db.exec(fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const env={DB:db},entry={id:'postgres-test-run-01',name:'Sơn',gender:'male',mode:'full',rulesVersion:2,score:500,duration:60,mistakes:0,npcCount:1,answers:Array.from({length:5},(_,q)=>`0:0:${q}`)};
 const post=x=>api(new Request('http://localhost/api/leaderboard',{method:'POST',body:JSON.stringify(x)}),env);
 assert.equal((await post(entry)).status,200);
 await post(entry);assert.equal((await db.query('SELECT count(*)::int AS n FROM scores')).rows[0].n,1);
 const second={...entry,score:975,duration:100,mistakes:1,npcCount:2,answers:[...entry.answers,...Array.from({length:5},(_,q)=>`0:1:${q}`)]};assert.equal((await post(second)).status,200);
 await post(entry);const saved=(await db.query('SELECT * FROM scores WHERE id=$1',[entry.id])).rows[0];assert.equal(saved.npc_count,2);assert.equal(saved.score,975);assert.equal(saved.answers_json.length,10);
 assert.equal((await post({...entry,id:'postgres-test-run-02',name:'An',score:500})).status,200);
 const ranked=await (await api(new Request('http://localhost/api/leaderboard'),env)).json();assert.equal(ranked.length,2);assert.equal(ranked[0].name,'Sơn');
 assert.equal((await post({...entry,score:9999})).status,400);
 await db.exec(fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));assert.equal((await db.query('SELECT count(*)::int AS n FROM scores')).rows[0].n,2);
 }finally{await db.close();}
});
