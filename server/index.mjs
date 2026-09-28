import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {pool} from './db.mjs';import {api} from './api.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url)).replace(/[\\/]$/,'');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
try {await pool.query('SELECT id FROM scores LIMIT 0');}
catch(e){console.error('Chưa kết nối được PostgreSQL hoặc chưa tạo bảng:',e.code||'UNKNOWN');console.error('Kiểm tra .env, tạo database triet_hanh rồi chạy npm run db:init.');await pool.end();process.exit(1);}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://'+req.headers.host);
 if(url.pathname.startsWith('/api/')){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2048){res.writeHead(413);res.end();return;}chunks.push(chunk);}
 const response=await api(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),{DB:pool});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
 if(req.method==='HEAD'){res.end();return;}const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
 }catch(e){console.error('Request error:',e.code||'UNKNOWN');if(!res.headersSent)res.writeHead(500);res.end('Server error');}
});
const port=Number(process.env.PORT)||3000;
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('Triết Hành + PostgreSQL: http://localhost:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(async()=>{await pool.end();process.exit(0);});});
