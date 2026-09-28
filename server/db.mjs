import fs from 'node:fs';
import {loadEnvFile} from 'node:process';
import pg from 'pg';
try { loadEnvFile('.env'); } catch (e) { if(e.code!=='ENOENT')throw e; }
export const pool = new pg.Pool({
 ...(process.env.DATABASE_URL ? {connectionString:process.env.DATABASE_URL} : {
 host:process.env.PGHOST||'localhost', port:Number(process.env.PGPORT)||5432,
 database:process.env.PGDATABASE||'triet_hanh', user:process.env.PGUSER||'postgres', password:process.env.PGPASSWORD,
 }),
 ...(process.env.PGSSL==='true' ? {ssl:{rejectUnauthorized:true,...(process.env.PGSSL_CA_FILE?{ca:fs.readFileSync(process.env.PGSSL_CA_FILE,'utf8')}:{})}} : {}),
 max:10, idleTimeoutMillis:30000, connectionTimeoutMillis:5000,
});
pool.on('error',error=>console.error('PostgreSQL connection error:',error.code||'UNKNOWN'));
