/** Triết Hành return gate, extracted from deployment v14 (2026-09-28).
 * Canvas 2D ES module. No images, external libraries or database needed.
 */
export class BackPortal {
  constructor({width=1440,height=900,mapNames=['Trung Quốc','Hy Lạp','Pháp','Đức','Anh','Ý'],font='GameSans, system-ui, sans-serif',reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}) {
    if(!(width>0&&height>0)||!Array.isArray(mapNames)||!mapNames.length)throw new TypeError('Invalid portal configuration');
    this.width=width;this.height=height;this.mapNames=[...mapNames];this.font=font;this.reducedMotion=reducedMotion;this.cooldown=0;this.inside=false;
  }
  isVisible(mapIndex) {return Number.isInteger(mapIndex)&&mapIndex>0&&mapIndex<this.mapNames.length;}
  get position(){return {x:this.width*.28,y:this.height*.90};}
  get spawnPoint(){return {x:this.width*.5,y:this.height*.82};}
  contains(player,mapIndex){return this.isVisible(mapIndex)&&Number.isFinite(player?.x)&&Number.isFinite(player?.y)&&player.y>this.height*.87&&player.y<=this.height&&Math.abs(player.x-this.width*.28)<95*(this.width/1440);}
  /** dt in seconds; changeMap must return true when the transition succeeds.
   * Call only while gameplay is active (not inside a quiz/dialog).
   */
  update({player,mapIndex,dt=0,changeMap}) {
    this.cooldown=Math.max(0,this.cooldown-Math.max(0,Number.isFinite(dt)?dt:0));
    const entered=this.contains(player,mapIndex);
    if(!entered){this.inside=false;return false;}
    if(this.inside||this.cooldown>0)return false;
    if(typeof changeMap!=='function')throw new TypeError('changeMap callback is required');
    this.inside=true;
    if(changeMap(mapIndex-1)!==true){this.inside=false;return false;}
    this.cooldown=.5;return true;
  }
  /** Draw in the same logical coordinate system used for player positions. */
  draw(ctx,{mapIndex,time=0}={}) {
    if(!this.isVisible(mapIndex))return;
    const {x,y}=this.position,sx=this.width/1440,sy=this.height/900;
    const pulse=this.reducedMotion?0:Math.sin(time*2.2)*3;
    ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
    ctx.shadowColor='#74dbe2';ctx.shadowBlur=18;ctx.strokeStyle='#a9edf0';ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(0,0,65+pulse,18,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.35;
    ctx.beginPath();ctx.ellipse(0,0,49-pulse,12,0,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle='#142a32ed';ctx.beginPath();ctx.roundRect(-135,-59,270,34,8);ctx.fill();
    ctx.font='600 17px '+this.font;ctx.fillStyle='#c0f4f5';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText('← Về '+this.mapNames[mapIndex-1],0,-36);
    ctx.restore();
  }
}
