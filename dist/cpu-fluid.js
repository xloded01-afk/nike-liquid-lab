/* Canvas compatibility renderer. A real, low-resolution fluid simulation:
 * double-buffered velocity + density, pressure projection and vorticity.
 * Used only when WebGL 2 / floating-point targets are unavailable. */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export class CanvasFluid {
  constructor(canvas,hero,images,materials,config,options){
    this.canvas=canvas;this.hero=hero;this.images=images;this.materials=materials;this.config=config;this.options=options;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.mask=document.createElement('canvas');this.maskCtx=this.mask.getContext('2d');
    this.composite=document.createElement('canvas');this.compositeCtx=this.composite.getContext('2d');
    this.base=document.createElement('canvas');this.baseCtx=this.base.getContext('2d');
    this.layers=[0,1,2].map(()=>document.createElement('canvas'));
    this.weights=[1,0,0];this.targetWeights=[1,0,0];this.queue=[];this.lastPointer=null;
    this.running=false;this.visible=true;this.time=0;this.lastMaterialTime=0;this.lastInput=0;this.activeUntil=0;
    this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(hero);
    this.intersection=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting;if(this.visible)this.start();});this.intersection.observe(hero);
    hero.addEventListener('pointermove',e=>this.pointer(e));hero.addEventListener('pointerdown',e=>this.pointer(e,true));
    hero.addEventListener('pointerleave',()=>{this.lastPointer=null;});hero.addEventListener('pointercancel',()=>{this.lastPointer=null;});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.start();});this.start();
  }
  resize(){
    const w=this.hero.clientWidth,h=this.hero.clientHeight;if(w===this.width&&h===this.height)return;
    this.width=w;this.height=h;this.aspect=w/h;
    const previous=this.d,oldNx=this.nx,oldNy=this.ny;
    const res=w<681?140:170;this.nx=Math.round(res*Math.max(this.aspect,1));this.ny=Math.round(res*Math.max(1/this.aspect,1));
    const n=this.nx*this.ny;
    for(const key of ['u','v','u2','v2','d','d2','curl','div','p','p2'])this[key]=new Float32Array(n);
    if(previous){for(let y=1;y<this.ny-1;y++)for(let x=1;x<this.nx-1;x++)this.d[y*this.nx+x]=previous[Math.min(oldNy-1,Math.floor(y/this.ny*oldNy))*oldNx+Math.min(oldNx-1,Math.floor(x/this.nx*oldNx))];}
    const ratio=Math.min(devicePixelRatio||1,1.25);this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);
    for(const c of [this.base,this.composite,...this.layers]){c.width=this.canvas.width;c.height=this.canvas.height;}
    const scale=Math.min(1,900/w);this.mask.width=Math.round(w*scale);this.mask.height=Math.round(h*scale);this.maskPixels=this.maskCtx.createImageData(this.mask.width,this.mask.height);
    const mobile=w<681,lw=w*(mobile?.94:.91),lh=Math.min(h*(mobile?.18:.345),lw*.33125),lx=(w-lw)/2,ly=h*(mobile?.255:.27);
    const sw=w*(mobile?1.04:.60),sh=sw*this.images[2].height/this.images[2].width,sx=(w-sw)/2+(mobile?0:w*.025),sy=h*(mobile?.295:.265);
    const b=this.baseCtx;b.setTransform(ratio,0,0,ratio,0,0);b.fillStyle='#f8f8f5';b.fillRect(0,0,w,h);
    b.drawImage(this.images[0],lx,ly,lw,lh);b.globalCompositeOperation='source-in';b.fillStyle='#0c0d0b';
    // Paint the wordmark into a small temporary canvas to keep the paper opaque.
    const word=document.createElement('canvas');word.width=Math.round(lw*ratio);word.height=Math.round(lh*ratio);const wc=word.getContext('2d');wc.drawImage(this.images[0],0,0,word.width,word.height);wc.globalCompositeOperation='source-in';wc.fillStyle='#0c0d0b';wc.fillRect(0,0,word.width,word.height);
    b.globalCompositeOperation='source-over';b.fillStyle='#f8f8f5';b.fillRect(0,0,w,h);b.drawImage(word,lx,ly,lw,lh);b.drawImage(this.images[2],sx,sy,sw,sh);
    this.layers.forEach((layer,i)=>{const c=layer.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.fillStyle='#060705';c.fillRect(0,0,w,h);c.drawImage(this.materials[i][0],lx,ly,lw,lh);c.drawImage(this.materials[i][1],sx,sy,sw,sh);});
    this.lastPointer=null;this.render();
  }
  sample(a,x,y){const nx=this.nx,ny=this.ny;x=clamp(x,.5,nx-1.5);y=clamp(y,.5,ny-1.5);const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,i=iy*nx+ix;return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+nx]*(1-fx)+a[i+nx+1]*fx)*fy;}
  pointer(event,tap=false){
    if(event.target.closest('a,button,dialog')){this.lastPointer=null;return;}
    if(event.pointerType==='touch'&&!tap&&event.buttons===0)return;
    const r=this.hero.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;
    if(x<0||x>1||y<.21||y>.80){this.lastPointer=null;return;}
    const now=performance.now();if(this.lastPointer&&now-this.lastPointer.t>160)this.lastPointer=null;
    if(!this.lastPointer){this.lastPointer={x,y,t:now};if(!tap)return;}
    const dx=x-this.lastPointer.x,dy=y-this.lastPointer.y,dist=Math.hypot(dx*this.aspect,dy);
    if(!tap&&dist<.0005)return;
    if(this.options.reduced()){this.reset();this.queue.push([x,y,0,0]);}
    else{const steps=Math.max(1,Math.min(16,Math.ceil(dist/(this.config.brushRadius*.3))));for(let i=1;i<=steps;i++)this.queue.push([this.lastPointer.x+dx*i/steps,this.lastPointer.y+dy*i/steps,dx/steps,dy/steps]);if(this.queue.length>96)this.queue.splice(0,this.queue.length-96);}
    this.lastPointer={x,y,t:now};this.lastInput=now;this.activeUntil=now+6500;this.start();
  }
  splats(){
    const nx=this.nx,ny=this.ny,r=this.config.brushRadius*ny;
    for(const [x,y,dx,dy] of this.queue.splice(0,24)){
      const cx=x*nx,cy=y*ny,rr=r*(1+Math.min(Math.hypot(dx*this.aspect,dy)*4,.3));
      const minX=Math.max(1,Math.floor(cx-rr*1.8)),maxX=Math.min(nx-2,Math.ceil(cx+rr*1.8));
      const minY=Math.max(1,Math.floor(cy-rr*1.8)),maxY=Math.min(ny-2,Math.ceil(cy+rr*1.8));
      for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++){
        const q=((ix-cx)**2+(iy-cy)**2)/(rr*rr),g=Math.exp(-q*2.5),i=iy*nx+ix;
        this.d[i]=Math.min(1.9,this.d[i]+g*.92);this.u[i]+=dx*nx*this.config.impulse*g;this.v[i]+=dy*ny*this.config.impulse*g;
      }
    }
  }
  step(dt){
    const nx=this.nx,ny=this.ny,cfg=this.config;
    const decay=Math.exp(-cfg.velocityDecay*dt);
    for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x,bx=x-this.u[i]*dt,by=y-this.v[i]*dt;this.u2[i]=this.sample(this.u,bx,by)*decay;this.v2[i]=this.sample(this.v,bx,by)*decay;}
    [this.u,this.u2]=[this.u2,this.u];[this.v,this.v2]=[this.v2,this.v];this.splats();
    if(!this.options.reduced()){
      const u=this.u,v=this.v,c=this.curl;
      for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x;c[i]=(v[i+1]-v[i-1]-u[i+nx]+u[i-nx])*.5;}
      for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x;let fx=(Math.abs(c[i+nx])-Math.abs(c[i-nx]))*.5,fy=(Math.abs(c[i+1])-Math.abs(c[i-1]))*.5;const len=Math.hypot(fx,fy)+.0001,force=cfg.swirl*c[i]*dt/len;u[i]=clamp(u[i]+fx*force,-600,600);v[i]=clamp(v[i]-fy*force,-600,600);}
      for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x;this.div[i]=(u[i+1]-u[i-1]+v[i+nx]-v[i-nx])*.5;this.p[i]*=.65;}
      for(let j=0;j<10;j++){for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x;this.p2[i]=(this.p[i-1]+this.p[i+1]+this.p[i-nx]+this.p[i+nx]-this.div[i])*.25;}[this.p,this.p2]=[this.p2,this.p];}
      for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x;u[i]-=this.p[i+1]-this.p[i-1];v[i]-=this.p[i+nx]-this.p[i-nx];}
    }
    const fade=Math.exp(-cfg.decay*dt),spread=cfg.spread;
    for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x;const density=this.sample(this.d,x-this.u[i]*dt,y-this.v[i]*dt),near=(this.d[i-1]+this.d[i+1]+this.d[i-nx]+this.d[i+nx])*.25;this.d2[i]=(density*(1-spread)+near*spread)*fade;}
    [this.d,this.d2]=[this.d2,this.d];
  }
  render(){
    const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
    ctx.drawImage(this.base,0,0);if(!this.maskPixels)return;
    const mw=this.mask.width,mh=this.mask.height,pixels=this.maskPixels.data,nx=this.nx,ny=this.ny;
    for(let y=0;y<mh;y++){
      const py=y/mh,edge=smooth(.20,.25,py)*(1-smooth(.76,.82,py));
      const sy=clamp(y/mh*(ny-1),0,ny-1.001),iy=sy|0,fy=sy-iy,off=iy*nx;
      for(let x=0;x<mw;x++){
        const sx=x/mw*(nx-1),ix=Math.min(nx-2,sx|0),fx=sx-ix,i=off+ix;
        const d=(this.d[i]*(1-fx)+this.d[i+1]*fx)*(1-fy)+(this.d[i+nx]*(1-fx)+this.d[i+nx+1]*fx)*fy;
        const k=(y*mw+x)*4;pixels[k]=255;pixels[k+1]=255;pixels[k+2]=255;pixels[k+3]=Math.round(smooth(.28,.32,d)*edge*255);
      }
    }
    this.maskCtx.putImageData(this.maskPixels,0,0);
    const c=this.compositeCtx;c.globalCompositeOperation='source-over';c.globalAlpha=1;c.clearRect(0,0,w,h);
    // Additive blending of complete layers gives an exact weighted cross-fade.
    c.globalCompositeOperation='lighter';for(let i=0;i<3;i++){if(this.weights[i]>.001){c.globalAlpha=this.weights[i];c.drawImage(this.layers[i],0,0);}}
    c.globalAlpha=1;c.globalCompositeOperation='destination-in';c.drawImage(this.mask,0,0,w,h);c.globalCompositeOperation='source-over';
    ctx.drawImage(this.composite,0,0);
  }
  selectMaterial(id){this.targetWeights=[0,0,0];this.targetWeights[id]=1;this.lastMaterialTime=this.time;this.start();}
  reset(){for(const key of ['u','v','u2','v2','d','d2','curl','div','p','p2'])this[key].fill(0);this.queue=[];this.lastPointer=null;this.activeUntil=0;this.render();}
  start(){if(this.running)return;this.running=true;this.lastTime=performance.now();requestAnimationFrame(t=>this.frame(t));}
  frame(now){
    if(!this.visible||document.hidden){this.running=false;return;}
    const dt=Math.min((now-this.lastTime)/1000,.04);this.lastTime=now;this.time+=dt;
    if(this.options.auto()&&this.time-this.lastMaterialTime>this.config.materialInterval)this.options.next();
    const blend=this.options.reduced()?1:1-Math.exp(-dt*5/this.config.transitionDuration);
    this.weights.forEach((_,i)=>{this.weights[i]+=(this.targetWeights[i]-this.weights[i])*blend;});
    const active=now<this.activeUntil||this.queue.length>0;if(active)this.step(dt);
    this.render();
    if(!active&&!this.options.auto()&&this.weights.every((v,i)=>Math.abs(v-this.targetWeights[i])<.001)){this.running=false;return;}
    requestAnimationFrame(t=>this.frame(t));
  }
}
