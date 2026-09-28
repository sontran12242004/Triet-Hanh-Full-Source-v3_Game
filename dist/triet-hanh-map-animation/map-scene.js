/** Standalone renderer extracted from Triết Hành deployment v11.
 * No dependencies. Static images + procedural Canvas 2D/WebGL animation.
 */
export const MAPS=Object.freeze([
 {id:'china',name:'Trung Quốc'}, {id:'greece',name:'Hy Lạp'},
 {id:'france',name:'Pháp'}, {id:'germany',name:'Đức'},
 {id:'england',name:'Anh'}, {id:'italy',name:'Ý'}
].map(Object.freeze));
const DEFAULT_ASSETS=new URL('./assets/',import.meta.url);
function mapIndex(value){
 const index=typeof value==='number'?value:MAPS.findIndex(m=>m.id===value);
 if(!Number.isInteger(index)||index<0||index>=MAPS.length)throw new RangeError('Unknown map: '+value);
 return index;
}
function loadImage(url){return new Promise((resolve,reject)=>{
 const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);
 image.onerror=()=>reject(new Error('Cannot load asset: '+url));image.src=String(url);
});}
export async function createMapScene(canvas,options={}){
 if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('A canvas is required');
 const W=1440,H=900,ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Canvas 2D is unavailable');
 if(!canvas.width||!canvas.height){canvas.width=W;canvas.height=H;}
 let world=mapIndex(options.map??'china');
 let reduced=options.reducedMotion??globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 const base=new URL(options.assetBase??DEFAULT_ASSETS,globalThis.location?.href??import.meta.url);
 if(!base.pathname.endsWith('/'))base.pathname+='/';
 const images=await Promise.all([...MAPS.map(m=>loadImage(new URL('maps/'+m.id+'.webp',base))),loadImage(new URL('sprites/koi.webp',base))]);
 const assets={maps:images.slice(0,6),koi:images[6]};
 const particles=Array.from({length:25},(_,i)=>({x:((i*73.13)%100)/100*W,y:((i*49.27)%100)/100*H,s:1+(i%4),phase:i*2.4}));
// Animate the painted background with continuous UV displacement: no duplicated
// foliage, hard scan lines or moving buildings. Only China allocates this GPU layer.
let chinaMotion=null,chinaMotionAttempted=false,ambienceTime=0;
function prepareChinaMotion(){
 chinaMotionAttempted=true;
 const surface=document.createElement('canvas');surface.width=W;surface.height=H;
 let gl;try{gl=surface.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:true});}catch{return;}
 if(!gl||typeof gl.createShader!=='function')return;
 const vertex='attribute vec2 p;varying vec2 uv;void main(){uv=(p+1.0)*0.5;gl_Position=vec4(p.x,-p.y,0.0,1.0);}';
 const fragment=`precision mediump float;
 uniform sampler2D art;uniform float time;varying vec2 uv;
 float region(vec2 p,vec2 c,vec2 r){vec2 d=(p-c)/r;return 1.0-smoothstep(0.40,1.0,dot(d,d));}
 float crown(vec2 p,vec2 c,vec2 r){return region(p,c,r)*clamp((c.y+r.y-p.y)/(2.0*r.y),0.0,1.0);}
 void main(){
 vec2 p=uv;vec4 original=texture2D(art,p);
 float wind=sin(time*.83)+.36*sin(time*1.71+.7);
 float foliage=0.0;
 foliage+=crown(p,vec2(.057,.242),vec2(.072,.085));
 foliage+=crown(p,vec2(.088,.107),vec2(.039,.065));
 foliage+=crown(p,vec2(.391,.369),vec2(.052,.081));
 foliage+=crown(p,vec2(.218,.768),vec2(.051,.089));
 foliage+=crown(p,vec2(.160,.974),vec2(.056,.079));
 foliage+=crown(p,vec2(.833,.577),vec2(.053,.062));
 foliage+=crown(p,vec2(.853,.717),vec2(.048,.077));
 foliage+=crown(p,vec2(.903,.883),vec2(.054,.081));
 foliage+=crown(p,vec2(.935,.407),vec2(.042,.070));
 foliage+=crown(p,vec2(.770,.080),vec2(.045,.087));
 foliage+=crown(p,vec2(.753,.245),vec2(.028,.075));
 foliage+=crown(p,vec2(.024,.707),vec2(.061,.080));
 foliage+=crown(p,vec2(.188,.593),vec2(.054,.063));
 foliage+=crown(p,vec2(.969,.934),vec2(.055,.066));
 float grass=region(p,vec2(.290,.878),vec2(.098,.041))+region(p,vec2(.680,.868),vec2(.071,.033))+region(p,vec2(.337,.709),vec2(.071,.027))+region(p,vec2(.683,.723),vec2(.075,.028));
 float green=smoothstep(.00,.10,original.g-original.b)*smoothstep(-.13,.04,original.g-original.r);
 float sway=foliage*(wind+.2*sin(time*2.3+p.y*36.0))*.0038;
 p.x+=sway+grass*green*sin(time*1.6+p.x*17.0)*.00105;
 p.y+=foliage*sin(time*.83+.6)*.00035;
 float banks=(1.0-smoothstep(.10,.135,uv.x))*smoothstep(.43,.46,uv.y)+smoothstep(.91,.95,uv.x)*smoothstep(.32,.37,uv.y);
 float aqua=smoothstep(.035,.14,original.g-original.r)*smoothstep(.02,.12,original.b-original.r);
 float water=clamp(banks*aqua,0.0,1.0);
 p.x+=water*(sin(uv.y*185.0-time*2.2)+.35*sin(uv.y*320.0+time*1.4))*.0015;
 p.y+=water*sin(uv.x*155.0+uv.y*93.0-time*1.8)*.00105;
 float falls=region(uv,vec2(.981,.232),vec2(.020,.042))+region(uv,vec2(.978,.798),vec2(.020,.034));
 float foam=smoothstep(.56,.87,min(original.r,min(original.g,original.b)))*falls;
 p.y+=foam*sin(uv.y*260.0-time*5.0)*.0018;
 vec4 color=texture2D(art,clamp(p,vec2(.001),vec2(.999)));
 float sparkle=pow(max(0.0,sin(uv.y*230.0-time*2.1)*sin(uv.x*147.0+time*.7)),8.0);
 color.rgb+=water*(sparkle*.105-.009)+foam*.045*sin(uv.y*320.0-time*7.0);
 gl_FragColor=vec4(color.rgb,1.0);
 }`;
 const shaders=[];let program,texture,buffer;
 try{
  const compile=(type,source)=>{const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Ambient shader unavailable');return s;};
  program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Ambient shader unavailable');gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,assets.maps[0]);gl.uniform1i(gl.getUniformLocation(program,'art'),0);gl.viewport(0,0,W,H);
  chinaMotion={surface,gl,time:gl.getUniformLocation(program,'time')};
  surface.addEventListener('webglcontextlost',e=>{e.preventDefault();chinaMotion=null;});
  surface.addEventListener('webglcontextrestored',()=>{chinaMotionAttempted=false;});
 }catch{if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
 finally{shaders.forEach(s=>gl.deleteShader(s));}
}
const chinaPetals=Array.from({length:36},(_,i)=>({
 source:i%3,seed:i*2.399,delay:(i*.6180339)%1,life:13+i%7,size:2.2+(i%5)*.65
}));
let chinaFishLayer=null;
function prepareChinaFish(){
 const mask=document.createElement('canvas');mask.width=W;mask.height=H;
 const mc=mask.getContext('2d');mc.drawImage(assets.maps[0],0,0,W,H);
 const pixels=mc.getImageData(0,0,W,H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const k=(y*W+x)*4,r=pixels.data[k],g=pixels.data[k+1],b=pixels.data[k+2];
  const river=(x<W*.135&&y>H*.44)||(x>W*.91&&y>H*.33);
  pixels.data[k+3]=river?255*Math.max(0,Math.min(1,(g-r-10)/23,(b-r-5)/22)):0;
 }
 mc.putImageData(pixels,0,0);
 const layer=document.createElement('canvas');layer.width=W;layer.height=H;
 chinaFishLayer={mask,layer,c:layer.getContext('2d')};
}
const chinaFish=[
 {x:.070,y:.874,rx:.017,ry:.062,speed:.30,phase:.4,size:40},
 {x:.066,y:.875,rx:.018,ry:.057,speed:-.25,phase:2.8,size:33},
 {x:.052,y:.605,rx:.026,ry:.021,speed:.34,phase:1.5,size:32},
 {x:.971,y:.689,rx:.011,ry:.043,speed:-.31,phase:.7,size:36},
 {x:.968,y:.864,rx:.014,ry:.030,speed:.29,phase:3.7,size:34}
];
function drawChinaFish(t){
 if(!assets.koi)return;
 if(!chinaFishLayer)prepareChinaFish();
 const {mask,layer,c}=chinaFishLayer;c.clearRect(0,0,W,H);
 for(const fish of chinaFish){
  const a=t*fish.speed+fish.phase;
  const x=W*(fish.x+fish.rx*Math.cos(a)),y=H*(fish.y+fish.ry*Math.sin(a));
  const heading=Math.atan2(H*fish.ry*Math.cos(a)*fish.speed,-W*fish.rx*Math.sin(a)*fish.speed);
  const h=fish.size*assets.koi.height/assets.koi.width;
  c.save();c.translate(x+2,y+3);c.rotate(heading);c.globalAlpha=.16;c.fillStyle='#083e40';c.beginPath();c.ellipse(0,0,fish.size*.34,h*.22,0,0,Math.PI*2);c.fill();c.restore();
  c.save();c.translate(x,y);c.rotate(heading);c.globalAlpha=.72+.10*Math.sin(a);
  // Bend the tail more than the head using overlapping narrow sprite columns.
  const cols=20,sw=assets.koi.width/cols;
  for(let i=0;i<cols;i++){
   const u=i/cols,tail=Math.max(0,(.63-u)/.63);
   const bend=Math.sin(t*7.5+fish.phase+u*5)*tail*tail*fish.size*.095;
   c.drawImage(assets.koi,i*sw,0,Math.min(sw+1,assets.koi.width-i*sw),assets.koi.height,-fish.size/2+u*fish.size,-h/2+bend,fish.size/cols+.6,h);
  }
  // Reflected cyan sheen places each fish below the water surface.
  c.globalAlpha=.19;c.strokeStyle='#c4fff0';c.lineWidth=1;c.beginPath();c.moveTo(-fish.size*.2,-h*.12);c.quadraticCurveTo(0,-h*.28,fish.size*.3,-h*.04);c.stroke();c.restore();
  for(let j=0;j<2;j++){
   const pulse=(t*.65+fish.phase+j*.5)%1;
   c.save();c.translate(x-Math.cos(heading)*(fish.size*.38+pulse*12),y-Math.sin(heading)*(fish.size*.38+pulse*12));c.rotate(heading);
   c.globalAlpha=(1-pulse)*.18;c.strokeStyle='#d5fff2';c.lineWidth=.8;c.beginPath();c.ellipse(0,0,3+pulse*5,2+pulse*6,0,Math.PI*.55,Math.PI*1.45);c.stroke();c.restore();
  }
 }
 // Shoreline, rocks, lily pads and bridges occlude the fish automatically.
 c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);c.globalCompositeOperation='source-over';ctx.drawImage(layer,0,0);
}

function drawChinaAmbience(t){
 if(reduced)return;
 if(!chinaMotionAttempted)prepareChinaMotion();
 if(chinaMotion){const {gl,surface,time}=chinaMotion;gl.uniform1f(time,t%600);gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(surface,0,0);}
 drawChinaFish(t);
 // Petals originate at the flowering trees, in three sparse, staggered layers.
 const origins=[[.026,.69],[.183,.566],[.964,.915]];
 for(const petal of chinaPetals){
  const age=(t/petal.life+petal.delay)%1,elapsed=age*petal.life;
  const [sx,sy]=origins[petal.source],depth=.55+petal.size*.18;
  const gust=(Math.sin(t*.83)-Math.sin((t-elapsed)*.83))/.83;
  const x=sx*W+elapsed*(13+depth*8)+gust*5+Math.sin(elapsed*1.5+petal.seed)*9;
  const y=sy*H+elapsed*(5+depth*3)+Math.sin(elapsed*.9+petal.seed)*12;
  if(x>W+15||y>H+15)continue;
  const fade=Math.min(1,age*9,(1-age)*6);
  ctx.save();ctx.translate(x,y);ctx.rotate(elapsed*.55+petal.seed);
  ctx.scale(.25+.75*Math.abs(Math.sin(elapsed*2+petal.seed)),1);
  ctx.globalAlpha=fade*(.48+depth*.18);ctx.fillStyle=petal.source===1?'#fff2dc':petal.source===2?'#f5b5c7':'#ffd1db';
  ctx.beginPath();ctx.ellipse(0,0,petal.size,petal.size*.57,.3,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha*=.35;ctx.fillStyle='#fff6e9';ctx.beginPath();ctx.ellipse(-petal.size*.22,-petal.size*.16,petal.size*.52,petal.size*.19,.3,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}
// Scene-specific ambience for Greece, France, Germany and England.
const worldAtmospheres={
 1:{kind:'coast',strength:.0050,crowns:[[.147,.071,.045,.056],[.363,.067,.052,.061],[.267,.265,.045,.063],[.608,.280,.044,.066],[.833,.204,.045,.064],[.908,.443,.045,.058],[.145,.574,.052,.070],[.795,.691,.055,.078],[.173,.866,.056,.070],[.902,.875,.067,.071]],origins:[[.145,.57],[.794,.69]],colors:['#a6b782','#d6d7a0'],count:12},
 2:{kind:'autumn',strength:.0060,crowns:[[.025,.150,.033,.12],[.313,.068,.052,.083],[.335,.175,.045,.066],[.311,.274,.034,.070],[.683,.125,.033,.085],[.023,.590,.044,.075],[.039,.762,.061,.09],[.035,.938,.049,.070],[.982,.620,.029,.097],[.979,.803,.032,.101]],origins:[[.027,.57],[.04,.74],[.978,.61],[.335,.17]],colors:['#e4a63f','#c66d29','#f4c663'],count:26,lamps:[[.050,.583],[.102,.850],[.958,.575],[.905,.853],[.321,.337],[.714,.348]]},
 3:{kind:'night',strength:.0038,crowns:[[.045,.503,.049,.068],[.061,.672,.066,.09],[.041,.933,.059,.079],[.918,.603,.058,.079],[.952,.908,.050,.084],[.277,.089,.040,.073],[.297,.180,.035,.088],[.713,.232,.041,.089]],origins:[],colors:[],count:0,lamps:[[.107,.750],[.192,.943],[.820,.943],[.893,.750],[.873,.617],[.128,.607],[.233,.377],[.279,.300],[.464,.284],[.535,.284],[.716,.306],[.882,.382]],chimneys:[[.956,.078]]},
 4:{kind:'garden',strength:.0055,crowns:[[.027,.560,.045,.076],[.040,.780,.061,.104],[.966,.610,.048,.090],[.971,.798,.034,.065],[.329,.207,.025,.048],[.678,.098,.033,.069],[.709,.214,.032,.067],[.026,.067,.041,.065],[.912,.029,.037,.048]],origins:[[.071,.716],[.927,.756],[.719,.290]],colors:['#fff1da','#f6d3d3','#f3b5b8'],count:18}
};
function makeWorldFragment(config){
 const patches=config.crowns.map(([x,y,rx,ry])=>`foliage+=crown(p,vec2(${x.toFixed(4)},${y.toFixed(4)}),vec2(${rx.toFixed(4)},${ry.toFixed(4)}));`).join('\n');
 const material=config.kind==='autumn'
 ? 'smoothstep(.045,.15,c.r-c.g)*smoothstep(.08,.23,c.g-c.b)*smoothstep(.38,.64,c.r)'
 :config.kind==='night'
 ? 'smoothstep(.025,.075,c.b-c.r)*smoothstep(.005,.045,c.g-c.r)*(1.0-smoothstep(.34,.48,max(c.r,max(c.g,c.b))))'
 :'smoothstep(.003,.065,c.g-c.r)*smoothstep(.025,.14,c.g-c.b)';
 return `precision mediump float;uniform sampler2D art;uniform float time;varying vec2 uv;
 float crown(vec2 p,vec2 c,vec2 r){vec2 d=(p-c)/r;return (1.0-smoothstep(.22,1.0,dot(d,d)))*clamp((c.y+r.y-p.y)/(2.0*r.y),0.0,1.0);}
 vec2 movingMaterial(vec2 p){
 vec3 c=texture2D(art,p).rgb;float foliage=0.0;${patches}
 // Architecture occupies the upper plaza. No animation is allowed in it.
 foliage*=smoothstep(.46,.49,p.y)*(${material});
 float water=0.0;
 ${config.kind==='coast'?`water=clamp((1.0-smoothstep(.09,.15,p.x)+smoothstep(.91,.96,p.x))*smoothstep(.065,.19,c.b-c.r)*smoothstep(.065,.18,c.g-c.r),0.0,1.0);`:''}
 return clamp(vec2(foliage,water),0.0,1.0);
 }
 void main(){
 vec3 original=texture2D(art,uv).rgb;vec2 material=movingMaterial(uv);
 float breeze=sin(time*.82)+.32*sin(time*1.31+uv.y*3.0);
 vec2 shift=vec2(material.x*breeze*${config.strength.toFixed(5)},material.x*sin(time*.8+uv.x*4.0)*.00040);
 ${config.kind==='coast'?`shift+=material.y*vec2((sin(uv.y*150.0-time*1.65)+.32*sin(uv.y*280.0-time*2.7))*.0015,sin(uv.x*130.0+uv.y*72.0-time*1.6)*.0011);`:''}
 vec2 destination=clamp(uv+shift,vec2(.001),vec2(.999));
 vec2 valid=min(material,movingMaterial(destination));
 // Both pixels must belong to the same moving material. Stone, trunks, roads,
 // roofs, columns and railings are copied exactly from the original image.
 float blend=max(valid.x,valid.y);
 vec3 color=mix(original,texture2D(art,destination).rgb,blend);
 ${config.kind==='coast'?`float glint=pow(max(0.0,sin(uv.y*210.0-time*1.8)*sin(uv.x*149.0+uv.y*23.0-time*.8)),7.0);color+=valid.y*(glint*.13-.008);`:''}
 gl_FragColor=vec4(color,1.0);
 }`;
}
const worldMotionCache=new Map();
function prepareWorldMotion(index){
 const record={renderer:null};worldMotionCache.set(index,record);
 const surface=document.createElement('canvas');surface.width=W;surface.height=H;
 let gl;try{gl=surface.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:true});}catch{return record;}
 if(!gl||typeof gl.createShader!=='function')return record;
 const vertex='attribute vec2 p;varying vec2 uv;void main(){uv=(p+1.0)*0.5;gl_Position=vec4(p.x,-p.y,0.0,1.0);}';
 const shaders=[];let program,texture,buffer;
 try{
  const compile=(type,source)=>{const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Ambient shader unavailable');return s;};
  program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,makeWorldFragment(worldAtmospheres[index])));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Ambient shader unavailable');gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,assets.maps[index]);gl.uniform1i(gl.getUniformLocation(program,'art'),0);gl.viewport(0,0,W,H);
  record.renderer={surface,gl,time:gl.getUniformLocation(program,'time')};
  surface.addEventListener('webglcontextlost',e=>{e.preventDefault();record.renderer=null;});
  surface.addEventListener('webglcontextrestored',()=>worldMotionCache.delete(index));
 }catch{if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
 finally{shaders.forEach(s=>gl.deleteShader(s));}
 return record;
}
function ambientGlow(x,y,r,color,opacity){
 ctx.save();const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,color);glow.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=opacity;ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function drawWorldAmbience(index,t){
 if(reduced)return;
 const config=worldAtmospheres[index];if(!config)return;
 const {renderer}=worldMotionCache.get(index)||prepareWorldMotion(index);
 if(renderer){const {gl,surface,time}=renderer;gl.uniform1f(time,t);gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(surface,0,0);}
 // Warm lamps shimmer locally, without flashing the entire scene.
 (config.lamps||[]).forEach(([x,y],i)=>ambientGlow(x*W,y*H,config.kind==='night'?32:22,'#ffc878',.19+.024*Math.sin(t*1.6+i)+.009*Math.sin(t*3.1+i)));
 if(config.kind==='night'){
  for(const [n,[x,y]] of config.chimneys.entries())for(let i=0;i<12;i++){
   const age=(t*.07+i/12+n*.3)%1;
   ambientGlow(x*W+age*26+Math.sin(t*.5+i)*3,y*H-age*108,5+age*22,'#a6b7ca',Math.sin(age*Math.PI)*.065);
  }
  // Low mist stays along the gardens; the central route remains readable.
  for(let i=0;i<5;i++){
   ctx.save();ctx.translate((i%2?W*.93:W*.06)+Math.sin(t*.12+i)*28,H*(.65+i*.063));ctx.scale(2.9,.40);
   ambientGlow(0,0,58,'#aec4df',.055+.018*Math.sin(t*.3+i));ctx.restore();
  }
 }
 // A leaf falls, lands and settles; it never floats indefinitely across buildings.
 for(let i=0;i<config.count;i++){
  const seed=i*2.399,life=13+i%7,age=(t/life+i*.618034)%1;
  const [sx,sy]=config.origins[i%config.origins.length],direction=sx>.8?-1:1;
  const flight=Math.min(1,age/.78),elapsed=flight*life*.78;
  const drift=direction*elapsed*(12+i%4);
  const x=sx*W+drift+Math.sin(elapsed*.85+seed)*15;
  const y=sy*H+elapsed*(config.kind==='autumn'?16:10)+Math.sin(elapsed*1.1+seed)*8*(1-flight);
  if(y>H+15||x<0||x>W)continue;
  const size=(config.kind==='autumn'?3.6:2.3)+(i%4)*.5,fade=Math.min(1,age*12,(1-age)*5);
  // The shadow becomes tighter as the leaf approaches the ground.
  if(config.kind!=='coast'){
   ctx.save();ctx.globalAlpha=fade*flight*.12;ctx.fillStyle='#403726';ctx.beginPath();ctx.ellipse(x+3,y+10*(1-flight)+2,size*.85,size*.24,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.save();ctx.translate(x,y);ctx.rotate(seed+elapsed*.7);
  ctx.scale(age>.78?1:.32+.68*Math.abs(Math.sin(elapsed*1.7+seed)),age>.78?.45:1);
  ctx.globalAlpha=fade*.84;ctx.fillStyle=config.colors[i%config.colors.length];ctx.beginPath();ctx.ellipse(0,0,size,size*(config.kind==='garden'?.59:.35),.3,0,Math.PI*2);ctx.fill();
  if(config.kind==='autumn'){ctx.strokeStyle='#865126';ctx.globalAlpha*=.45;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(-size*.7,0);ctx.lineTo(size*.65,0);ctx.stroke();}ctx.restore();
 }
}


 let running=false,disposed=false,frameId=0,lastTime=null,elapsed=0;
 function ensureAlive(){if(disposed)throw new Error('Scene has been destroyed');}
 function render(time=elapsed){
  ensureAlive();if(!Number.isFinite(time)||time<0)throw new RangeError('Time must be nonnegative seconds');
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(canvas.width/W,canvas.height/H);ctx.drawImage(assets.maps[world],0,0,W,H);
  if(!reduced){
   if(world===0)drawChinaAmbience(time);
   else if(worldAtmospheres[world])drawWorldAmbience(world,time);
   else particles.forEach((p,i)=>{
    const x=(p.x+time*(8+i%4)+Math.sin(time*.5+p.phase)*13)%(W+20)-10,y=(p.y+time*(4+i%3))%H;
    ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#ffe4a0';ctx.translate(x,y);ctx.rotate(time*.5+p.phase);ctx.fillRect(0,0,p.s*2,p.s);ctx.restore();
   });
  }
  ctx.restore();
 }
 function tick(ms){
  if(!running||disposed)return;
  if(lastTime!==null&&!document.hidden)elapsed+=Math.min((ms-lastTime)/1000,.04);
  lastTime=ms;render(elapsed);frameId=requestAnimationFrame(tick);
 }
 const api={
  render,
  start(){ensureAlive();if(!running){running=true;lastTime=null;frameId=requestAnimationFrame(tick);}return api;},
  stop(){running=false;cancelAnimationFrame(frameId);lastTime=null;return api;},
  setMap(id){ensureAlive();world=mapIndex(id);render(elapsed);return api;},
  setReducedMotion(value){ensureAlive();reduced=!!value;render(elapsed);return api;},
  resize(width,height){ensureAlive();if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw new RangeError('Invalid size');canvas.width=Math.round(width);canvas.height=Math.round(height);render(elapsed);return api;},
  get map(){return MAPS[world].id;},
  get reducedMotion(){return reduced;},
  destroy(){if(disposed)return;api.stop();disposed=true;
   const renderers=[chinaMotion,...[...worldMotionCache.values()].map(r=>r.renderer)];
   for(const r of renderers)r?.gl.getExtension('WEBGL_lose_context')?.loseContext();
   worldMotionCache.clear();chinaMotion=null;chinaFishLayer=null;
  }
 };
 render(0);if(options.autoStart!==false)api.start();return api;
}
