import fs from 'node:fs';import {pool} from '../server/db.mjs';
try {await pool.query(fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));console.log('Đã tạo bảng scores và index xếp hạng trong PostgreSQL.');}
catch(e){console.error('Không khởi tạo được database:',e.code||'UNKNOWN','— Kiểm tra .env và tạo database triet_hanh trước.');process.exitCode=1;}
finally {await pool.end();}
