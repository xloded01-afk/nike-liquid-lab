import Lenis from './vendor/lenis.js';
import { installScrollText } from './scroll-text.js?v=20261104-stable-scroll';
/* NIKE / LIQUID LAB — standalone WebGL 2 fluid-reveal study.
 * No runtime dependencies. See README.md for tunable parameters and launch.
 */
import { JetInput, TouchTap } from './jet-input.js?v=20261104-stable-scroll';

const CONFIG = {
  nozzleRadius: 0.043,     // Relative to viewport height; narrows with speed.
  jetSpeed: 1.75,          // Multiplier on measured pointer velocity.
  spread: 0.018,
  decay: 0.95,
  swirl: 13.0,
  velocityDecay: 1.15,
  materialInterval: 5.5,
  transitionDuration: 0.8,
  simulationResolution: 240,
  dyeResolution: 640,
  pressureIterations: 18,
  maxPixelRatio: 2,

};

const hero = document.querySelector('.hero');
let canvas = document.querySelector('#fluid-canvas');
let motionEnabled = true;
const reducedMotion = {get matches(){return !motionEnabled;}};
const coarsePointer = matchMedia('(pointer: coarse)');
const materialNames = ['01 — LIQUID CHROME','02 — BUBBLE WRAP','03 — PINK FOAM'];
let selectedMaterial = 0;
let autoMode = false;
let engine;
let heroExposed=true;

function setMaterial(id) {
  selectedMaterial = id;
  document.querySelectorAll('[data-material]').forEach((button) => {
    const active = Number(button.dataset.material) === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#material-counter').textContent = `0${id+1} / 03`;
  document.querySelector('#material-label').textContent = materialNames[id];
  engine?.selectMaterial(id);
}
document.querySelectorAll('[data-material]').forEach(button => button.addEventListener('click', () => setMaterial(Number(button.dataset.material))));
document.querySelector('#auto-button').addEventListener('click', () => {
  autoMode = !autoMode;
  document.querySelector('#auto-button').setAttribute('aria-pressed', String(autoMode));
  document.querySelector('.play-icon').textContent = autoMode ? 'Ⅱ' : '▶';
  if(autoMode) engine?.start();
});
document.querySelector('#reset-button').addEventListener('click', () => {engine?.reset();if(engine?.preview)engine.togglePreview();const b=document.querySelector('#preview-button');b.setAttribute('aria-pressed','false');b.textContent='Показать слой';});
document.querySelectorAll('[data-preview-material]').forEach(button => button.addEventListener('click', () => {
  setMaterial(Number(button.dataset.previewMaterial));
  window.scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'});
}));
document.querySelector('#return-lab').addEventListener('click', () => window.scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'}));
const about = document.querySelector('#about-dialog');
let closingAbout=null;
function openAbout(){
  if(closingAbout){closingAbout.cancel();closingAbout=null;}
  about.classList.remove('is-closing');
  if(!about.open)about.showModal();
}
function closeAbout(){
  if(!about.open||closingAbout)return;
  if(reducedMotion.matches){about.close();return;}
  about.classList.add('is-closing');
  const animation=about.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(8px) scale(.99)'}],{duration:180,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  closingAbout=animation;
  animation.finished.then(()=>{about.close();about.classList.remove('is-closing');animation.cancel();closingAbout=null;}).catch(()=>{});
}
about.addEventListener('cancel',event=>{event.preventDefault();closeAbout();});
document.querySelectorAll('[data-open-about]').forEach(button => button.addEventListener('click',openAbout));
document.querySelectorAll('.close-dialog,.close-about').forEach(button => button.addEventListener('click',closeAbout));
about.addEventListener('click', e => { if(e.target === about){ const r=about.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) closeAbout(); } });
if(coarsePointer.matches) document.querySelector('#interaction-hint').innerHTML='Коснись логотипа.<br><span>Открой другую сторону.</span>';
if(reducedMotion.matches) document.querySelector('#interaction-hint').textContent='Просмотри материалы кнопкой «Показать слой».';
document.querySelector('#preview-button').addEventListener('click',e=>{const visible=engine?.togglePreview();e.currentTarget.setAttribute('aria-pressed',String(!!visible));e.currentTarget.textContent=visible?'Скрыть слой':'Показать слой';});
const motionButton=document.querySelector('#motion-button');
function syncMotion(){
  document.documentElement.dataset.motionEnabled=String(motionEnabled);
  document.dispatchEvent(new Event('lab-motion-change'));
  motionButton.textContent=motionEnabled?'Движение: вкл.':'Включить движение';
  motionButton.setAttribute('aria-pressed',String(motionEnabled));
  document.querySelector('#interaction-hint').textContent=motionEnabled?(coarsePointer.matches?'Коснись логотипа. Открой другую сторону.':'Двигай курсором без нажатия. Почувствуй течение.'):'Движение отключено. Можно показать весь слой.';
  engine?.reset();
}
motionButton.addEventListener('click',()=>{motionEnabled=!motionEnabled;syncMotion();});
syncMotion();

const VERT = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0,1);}`;
const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
`;
const SHADERS = {
  advect: HEADER + `
uniform sampler2D uVelocity;
uniform vec2 uVelocityTexel;
uniform float uDecay;
uniform float uSpread;
void main(){
  vec2 velocity=texture(uVelocity,vUv).xy;
  vec2 previous=vUv-uDt*velocity*uVelocityTexel;
  vec4 c=texture(uSource,previous);
  vec4 near=(texture(uSource,previous+vec2(uTexel.x,0))+texture(uSource,previous-vec2(uTexel.x,0))+texture(uSource,previous+vec2(0,uTexel.y))+texture(uSource,previous-vec2(0,uTexel.y)))*.25;
  frag=mix(c,near,uSpread)*exp(-uDecay*uDt);
}`,
  // A swept, tapered, perturbed nozzle deposits mass AND forward momentum.
  // Subsequent shape changes are entirely Eulerian advection/projection on the GPU.
  splat: HEADER + `
uniform vec4 uSegments[12];
uniform vec4 uJets[12];
uniform int uCount;
uniform float uAspect;
uniform float uRadius;
uniform float uForce;
uniform float uTime;
uniform vec2 uSize;
uniform int uKind;
void main(){
 vec4 c=texture(uSource,vUv);
 vec2 metric=vec2(uAspect,1.);
 for(int i=0;i<12;i++){
  if(i>=uCount)break;
  vec2 velocity=uJets[i].xy*metric;
  float speed=length(velocity);
  vec2 dir=velocity/max(speed,.0001),side=vec2(-dir.y,dir.x);
  vec2 a=uSegments[i].xy*metric;
  // Forward reach depends on speed, independently of input event frequency.
  vec2 b=uSegments[i].zw*metric+dir*min(.13,.014+speed*.032);
  vec2 ab=b-a,point=vUv*metric-a;
  float t=clamp(dot(point,ab)/max(dot(ab,ab),.00001),0.,1.);
  float radius=uRadius*mix(1.15,.53,smoothstep(.05,2.8,speed));
  float phase=dot(a,vec2(93.,61.))+uTime*9.;
  float wave=sin(t*8.+phase)*.15+sin(t*17.-phase*.7)*.08;
  vec2 centre=a+ab*t+side*radius*(wave+uJets[i].w*sin(t*3.14159)*.7);
  vec2 q=vUv*metric-centre;
  float width=radius*(1.+wave*.8)*mix(1.,.65,t);
  float radial=dot(q,q)/(width*width);
  float g=exp(-radial*1.65);
  float amount=1.-exp(-uJets[i].z*100.);
  if(uKind==0){
   // Co-flow limits numerical 'stamping'; paired shear creates rolling edges.
   vec2 flow=(dir*(speed*uForce+.18)+side*sin(t*11.+phase)*speed*.22)/metric*uSize;
   float shear=dot(q,side)/max(width,.001);
   flow+=side/metric*uSize*uJets[i].w*speed*.42*g;
   flow+=dir/metric*uSize*shear*speed*.16;
   c.xy=mix(c.xy,flow,clamp(g*amount*.85,0.,.92));
  }else{
   c.r=min(1.65,c.r+g*amount*1.18);
  }
 }
 frag=c;
}`,
  // Bounded MacCormack reconstruction keeps thin ligaments from blurring away.
  correct: HEADER + `
uniform sampler2D uForward;
uniform sampler2D uBackward;
uniform sampler2D uVelocity;
uniform vec2 uVelocityTexel;
uniform float uDecay;
uniform float uTime;
void main(){
 vec2 p=vUv-uDt*texture(uVelocity,vUv).xy*uVelocityTexel;
 vec2 cell=(floor(p/uTexel-.5)+.5)*uTexel;
 float a=texture(uSource,cell).r,b=texture(uSource,cell+vec2(uTexel.x,0)).r;
 float c=texture(uSource,cell+vec2(0,uTexel.y)).r,d=texture(uSource,cell+uTexel).r;
 float lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
 float value=texture(uForward,vUv).r+.5*(texture(uSource,vUv).r-texture(uBackward,vUv).r);
 value=clamp(value,lo,hi);
 // Spatially varying erosion pinches thin necks at different times.
 float variation=.84+.16*sin(vUv.x*29.+sin(vUv.y*37.)+uTime*.7);
 value=max(0.,value*exp(-uDecay*variation*uDt)-uDt*.045);
 frag=vec4(value,0,0,1);
}`,
  curl: HEADER + `
void main(){
 float l=texture(uSource,vUv-vec2(uTexel.x,0)).y;
 float r=texture(uSource,vUv+vec2(uTexel.x,0)).y;
 float b=texture(uSource,vUv-vec2(0,uTexel.y)).x;
 float t=texture(uSource,vUv+vec2(0,uTexel.y)).x;
 frag=vec4((r-l-t+b)*.5,0,0,1);
}`,
  vorticity: HEADER + `
uniform sampler2D uCurl;
uniform float uStrength;
void main(){
 float l=texture(uCurl,vUv-vec2(uTexel.x,0)).x;
 float r=texture(uCurl,vUv+vec2(uTexel.x,0)).x;
 float b=texture(uCurl,vUv-vec2(0,uTexel.y)).x;
 float t=texture(uCurl,vUv+vec2(0,uTexel.y)).x;
 float c=texture(uCurl,vUv).x;
 vec2 force=.5*vec2(abs(t)-abs(b),abs(r)-abs(l));
 force/=length(force)+.0001; force*=uStrength*c; force.y*=-1.;
 frag=vec4(clamp(texture(uSource,vUv).xy+force*uDt,vec2(-600.),vec2(600.)),0,1);
}`,
  divergence: HEADER + `
void main(){
 vec2 c=texture(uSource,vUv).xy;
 float l=texture(uSource,vUv-vec2(uTexel.x,0)).x;
 float r=texture(uSource,vUv+vec2(uTexel.x,0)).x;
 float b=texture(uSource,vUv-vec2(0,uTexel.y)).y;
 float t=texture(uSource,vUv+vec2(0,uTexel.y)).y;
 if(vUv.x<uTexel.x)l=-c.x;if(vUv.x>1.-uTexel.x)r=-c.x;
 if(vUv.y<uTexel.y)b=-c.y;if(vUv.y>1.-uTexel.y)t=-c.y;
 frag=vec4(.5*(r-l+t-b),0,0,1);
}`,
  pressure: HEADER + `
uniform sampler2D uDivergence;
void main(){
 float l=texture(uSource,vUv-vec2(uTexel.x,0)).r;
 float r=texture(uSource,vUv+vec2(uTexel.x,0)).r;
 float b=texture(uSource,vUv-vec2(0,uTexel.y)).r;
 float t=texture(uSource,vUv+vec2(0,uTexel.y)).r;
 float div=texture(uDivergence,vUv).r;
 frag=vec4((l+r+b+t-div)*.25,0,0,1);
}`,
  gradient: HEADER + `
uniform sampler2D uPressure;
void main(){
 float l=texture(uPressure,vUv-vec2(uTexel.x,0)).r;
 float r=texture(uPressure,vUv+vec2(uTexel.x,0)).r;
 float b=texture(uPressure,vUv-vec2(0,uTexel.y)).r;
 float t=texture(uPressure,vUv+vec2(0,uTexel.y)).r;
 vec2 v=texture(uSource,vUv).xy-.5*vec2(r-l,t-b);
 frag=vec4(v,0,1);
}`,
  copy: HEADER+`uniform float uScale;void main(){frag=texture(uSource,vUv)*uScale;}`,
  display: HEADER + `
uniform sampler2D uLogo;
uniform sampler2D uLogoNormal;
uniform sampler2D uShoe;
uniform sampler2D uShoeNormal;
uniform vec4 uLogoRect;
uniform vec4 uShoeRect;
uniform vec3 uMaterial;
uniform vec2 uResolution;
uniform float uTime;
uniform float uReduced;
uniform float uPreview;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
vec4 imageAt(sampler2D tex,vec2 uv,vec4 rect){vec2 p=(uv-rect.xy)/rect.zw;if(p.x<0.||p.y<0.||p.x>1.||p.y>1.)return vec4(0);return texture(tex,p);}
vec3 material(vec3 normal,vec2 p,float sourceLight,float isShoe){
 vec3 n=normalize(normal*vec3(1.,-1.,1.));
 // A procedural studio environment: bright softboxes and a dark horizon.
 float band=sin(n.y*5.5+n.x*2.8+p.y*2.1+.35);
 float chrome=.10+.77*smoothstep(-.22,.16,band);
 chrome+=pow(max(0.,dot(n,normalize(vec3(-.5,.7,.8)))),20.)*.8;
 chrome+=pow(max(0.,1.-abs(n.y+.25)),30.)*.20;
 vec3 silver=vec3(chrome*.96,chrome,chrome*1.025);
 silver*=mix(.78,1.18,sourceLight);
 silver=mix(silver,silver*vec3(.90,1.,.86),.15);
 if(uMaterial.x>.999)return silver;
 // Packed transparent cells with their own highlights and dark rims.
 vec2 bp=p*vec2(100.,62.);bp.x+=mod(floor(bp.y),2.)*.5;
 vec2 cell=fract(bp)-.5;float rnd=hash(floor(bp));
 float dist=length(cell);float dome=sqrt(max(0.,1.-pow(dist/.46,2.)));
 vec3 bn=normalize(vec3(cell*1.9,dome*.9+.1));
 float light=max(0.,dot(bn,normalize(vec3(-.4,.7,1.))));
 float rim=pow(smoothstep(.30,.47,dist),2.);
 float spec=pow(max(0.,dot(bn,normalize(vec3(-.35,.55,1.)))),28.);
 vec3 bubbles=vec3(.52,.61,.48)*(.34+light*.70)+spec*.9;
 bubbles=mix(bubbles,vec3(.16,.22,.13),rim*.65);
 bubbles+=pow(max(0.,1.-abs(dist-.4)*35.),2.)*.22;
 bubbles*=mix(.45,1.35,sourceLight)*(.65+.35*max(n.z,0.));
 if(uMaterial.y>.999)return bubbles;
 // Fine cellular foam, rather than a flat recolour.
 vec2 fp=p*vec2(265.,170.);
 float pore=length(fract(fp)-.5);float grain=hash(floor(fp));
 float hole=(1.-smoothstep(.10,.25,pore))*step(.28,grain);
 float foamNoise=noise(p*vec2(125.,80.));
 float diffuse=.48+.52*max(dot(n,normalize(vec3(-.4,.65,.85))),0.);
 vec3 foam=mix(vec3(.94,.59,.67),vec3(.66,.29,.40),hole*.65);
 foam*=diffuse*(.83+foamNoise*.28)*mix(.65,1.28,sourceLight);
 foam+=pow(max(0.,dot(n,normalize(vec3(-.4,.6,1.)))),10.)*.15;
 return max(vec3(0),silver*uMaterial.x+bubbles*uMaterial.y+foam*uMaterial.z);
}
void main(){
 vec2 uv=vUv;
 vec4 logo=imageAt(uLogo,uv,uLogoRect);
 vec3 paper=vec3(1.);
 vec3 base=mix(paper,vec3(0.),logo.a);
 float density=texture(uSource,uv).r;
 float edgeNoise=(noise(uv*vec2(uResolution.x/uResolution.y,1.)*75.+uTime*.12)-.5)*.025;
 float aa=max(fwidth(density)*.85,.018);
 float mask=smoothstep(.30-aa,.30+aa,density+edgeNoise);
 mask=mix(mask,1.,uPreview);
 if(mask<.001){frag=vec4(base,1.);return;}
 vec3 alternate=vec3(.008);
 if(logo.a>.001){
   vec4 ln=imageAt(uLogoNormal,uv,uLogoRect);
   vec2 lp=(uv-uLogoRect.xy)/uLogoRect.zw;
   alternate=mix(alternate,material(ln.rgb*2.-1.,lp,.85,0.),logo.a);
 }
 frag=vec4(mix(base,alternate,mask),1.);
}`,
};

class FluidReveal {
  constructor(gl, images) {
    this.gl=gl; this.images=images;
    this.programs={}; this.targets=[]; this.input=new JetInput(); this.preview=false;
    this.weights=[1,0,0];this.targetWeights=[1,0,0];
    this.intersecting=true;this.visible=heroExposed&&!document.hidden;
    this.pausedAt=this.visible?null:performance.now();
    this.touchTap=new TouchTap();
    this.lastPointer=null;
    this.lastTime=0;this.lastMaterialTime=0;this.lastInput=0;
    this.running=false;this.time=0;
    this.positions=new Float32Array(12*4);this.jets=new Float32Array(12*4);
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    this.vao=vao;this.buffer=buffer;
    for(const [key,frag] of Object.entries(SHADERS))this.programs[key]=this.createProgram(frag);
    this.textures=images.map(img=>this.imageTexture(img));
    this.resize();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(hero);
    this.intersection=new IntersectionObserver(([entry])=>{this.intersecting=entry.isIntersecting;this.updateVisibility();},{threshold:0});this.intersection.observe(hero);
    hero.addEventListener('pointermove',e=>{
      if(e.pointerType==='touch')this.touchTap.move(e,window.scrollY);
      else this.pointer(e);
    });
    hero.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch')return;
      this.touchTap.cancel();
      if(this.visible&&!reducedMotion.matches&&e.isPrimary&&!e.target.closest('a,button,dialog'))this.touchTap.begin(e,window.scrollY);
    });
    hero.addEventListener('pointerup',e=>{
      if(e.pointerType==='touch'&&this.touchTap.end(e,window.scrollY)){
        this.input.leave();
        this.pointer(e,true);
        this.input.leave();
      }
    });
    hero.addEventListener('pointerleave',()=>{this.input.leave();this.lastPointer=null;this.touchTap.cancel();});
    hero.addEventListener('pointercancel',()=>{this.input.leave();this.lastPointer=null;this.touchTap.cancel();});
    document.addEventListener('visibilitychange',()=>this.updateVisibility());
    this.start();
  }
  createProgram(fragment) {
    const gl=this.gl;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;};
    const vert=shader(gl.VERTEX_SHADER,VERT),frag=shader(gl.FRAGMENT_SHADER,fragment);
    const p=gl.createProgram();gl.attachShader(p,vert);gl.attachShader(p,frag);gl.bindAttribLocation(p,0,'aPosition');gl.linkProgram(p);gl.deleteShader(vert);gl.deleteShader(frag);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    const uniforms={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(p,i);uniforms[u.name.replace('[0]','')]=gl.getUniformLocation(p,u.name);}
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    return {p,uniforms};
  }
  imageTexture(image) {
    const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    return t;
  }
  target(w,h) {
    const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
    const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Floating-point framebuffer unavailable');
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const target={texture,fbo,w,h};this.targets.push(target);return target;
  }
  pair(w,h){return {read:this.target(w,h),write:this.target(w,h),swap(){[this.read,this.write]=[this.write,this.read];}};}
  resize(){
    const w=hero.clientWidth,h=hero.clientHeight;
    const dpr=Math.min(devicePixelRatio||1,CONFIG.maxPixelRatio);
    if(this.width===w&&this.height===h&&this.pixelRatio===dpr)return;
    const gl=this.gl;
    this.width=w;this.height=h;this.aspect=w/h;
    this.pixelRatio=dpr;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const mobile=w<681;
    const lw=w*(mobile?.94:.91),lh=Math.min(h*(mobile?.18:.345),lw*.33125);
    const lx=(w-lw)/2,ly=h*(mobile?.255:.27);
    this.logoRect=[lx/w,1-(ly+lh)/h,lw/w,lh/h];
    const sw=w*(mobile?1.04:.60),sh=sw*(this.images[2].height/this.images[2].width);
    const sx=(w-sw)/2+(mobile?0:w*.025),sy=h*(mobile?.295:.265);
    this.shoeRect=[-10,-10,.01,.01]; // Product photography remains in the silhouette section.
    // Preserve existing density through resizing; allocate only after dimensions change.
    const oldDye=this.dye?.read;const oldTargets=this.targets;this.targets=[];
    const res=CONFIG.simulationResolution;
    this.simW=Math.round(res*Math.max(this.aspect,1));this.simH=Math.round(res*Math.max(1/this.aspect,1));
    this.velocity=this.pair(this.simW,this.simH);
    const dr=mobile?400:CONFIG.dyeResolution;
    this.dye=this.pair(Math.round(dr*Math.max(this.aspect,1)),Math.round(dr*Math.max(1/this.aspect,1)));
    this.forward=this.target(this.dye.read.w,this.dye.read.h);this.backward=this.target(this.dye.read.w,this.dye.read.h);
    this.pressure=this.pair(this.simW,this.simH);this.divergence=this.target(this.simW,this.simH);this.curl=this.target(this.simW,this.simH);
    if(oldDye)this.run('copy',this.dye.read,{uScale:1},{uSource:oldDye.texture});
    for(const t of oldTargets){gl.deleteFramebuffer(t.fbo);gl.deleteTexture(t.texture);}
    this.input.leave();
    this.draw();
  }
  run(name,target,values={},textures={}){
    const gl=this.gl,{p,uniforms}=this.programs[name];gl.useProgram(p);gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER,target?.fbo||null);gl.viewport(0,0,target?.w||canvas.width,target?.h||canvas.height);
    let unit=0;for(const [key,tex] of Object.entries(textures)){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(uniforms[key],unit++);}
    for(const [key,value] of Object.entries(values)){
      const loc=uniforms[key];if(loc==null)continue;
      if(key==='uCount'||key==='uKind')gl.uniform1i(loc,value);
      else if(key==='uSegments'||key==='uJets')gl.uniform4fv(loc,value);
      else if(Array.isArray(value)){if(value.length===2)gl.uniform2fv(loc,value);else if(value.length===3)gl.uniform3fv(loc,value);else gl.uniform4fv(loc,value);}
      else gl.uniform1f(loc,value);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  pointer(event,tap=false){
    if(!this.visible||reducedMotion.matches)return;
    if(event.target.closest('a,button,dialog')){this.input.leave();this.lastPointer=null;return;}
    if(event.pointerType==='touch'&&!tap&&event.buttons===0)return;
    const rect=hero.getBoundingClientRect();
    const samples=event.getCoalescedEvents?.();
    let moved=false;
    for(const sample of samples?.length?samples:[event]){
      const previous=this.lastPointer;
      if(!tap&&previous){
        if(previous.x===sample.clientX&&previous.y===sample.clientY)continue;
        // Project both cursor samples through the same current rectangle.
        // Scrolling the canvas underneath the mouse is not a nozzle stroke.
        if(this.input.last){
          this.input.last.x=(previous.x-rect.left)/rect.width;
          this.input.last.y=1-(previous.y-rect.top)/rect.height;
        }
      }
      const x=(sample.clientX-rect.left)/rect.width,y=1-(sample.clientY-rect.top)/rect.height;
      if(x<0||x>1||y<0||y>1){this.input.leave();this.lastPointer=null;continue;}
      const now=sample.timeStamp||performance.now();
      this.input.sample(x,y,now,this.aspect,tap);
      if(!tap)this.lastPointer={x:sample.clientX,y:sample.clientY};
      moved=true;
    }
    if(!moved)return;
    this.lastInput=performance.now();
    this.start();
  }
  togglePreview(){this.preview=!this.preview;this.start();return this.preview;}
  selectMaterial(id){this.targetWeights=[0,0,0];this.targetWeights[id]=1;this.lastMaterialTime=this.time;this.start();}
  reset(){
    const gl=this.gl;for(const t of this.targets){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
    this.input.reset();this.lastInput=0;this.draw();
  }
  simulate(dt){
    const texel=[1/this.simW,1/this.simH];
    this.run('advect',this.velocity.write,{uDt:dt,uTexel:texel,uVelocityTexel:texel,uDecay:CONFIG.velocityDecay,uSpread:.035},{uSource:this.velocity.read.texture,uVelocity:this.velocity.read.texture});this.velocity.swap();
    const points=this.input.drain(dt,this.aspect);
    if(points.length){
      this.positions.fill(0);this.jets.fill(0);
      points.forEach((p,i)=>{
        this.positions.set([...p.a,...p.b],i*4);
        this.jets.set([...p.v,p.dt,p.turn],i*4);
      });
      const common={uSegments:this.positions,uJets:this.jets,uCount:points.length,uRadius:CONFIG.nozzleRadius,uAspect:this.aspect,uForce:CONFIG.jetSpeed,uSize:[this.simW,this.simH],uTime:this.time};
      if(!reducedMotion.matches){this.run('splat',this.velocity.write,{...common,uKind:0},{uSource:this.velocity.read.texture});this.velocity.swap();}
      this.run('splat',this.dye.write,{...common,uKind:1},{uSource:this.dye.read.texture});this.dye.swap();
    }
    if(!reducedMotion.matches){
      this.run('curl',this.curl,{uTexel:texel},{uSource:this.velocity.read.texture});
      this.run('vorticity',this.velocity.write,{uDt:dt,uTexel:texel,uStrength:CONFIG.swirl},{uSource:this.velocity.read.texture,uCurl:this.curl.texture});this.velocity.swap();
      this.run('divergence',this.divergence,{uTexel:texel},{uSource:this.velocity.read.texture});
      this.run('copy',this.pressure.write,{uScale:.65},{uSource:this.pressure.read.texture});this.pressure.swap();
      for(let i=0;i<CONFIG.pressureIterations;i++){this.run('pressure',this.pressure.write,{uTexel:texel},{uSource:this.pressure.read.texture,uDivergence:this.divergence.texture});this.pressure.swap();}
      this.run('gradient',this.velocity.write,{uTexel:texel},{uSource:this.velocity.read.texture,uPressure:this.pressure.read.texture});this.velocity.swap();
    }
    const dyeTexel=[1/this.dye.read.w,1/this.dye.read.h];
    const advection={uDt:dt,uTexel:dyeTexel,uVelocityTexel:texel,uDecay:0,uSpread:CONFIG.spread};
    this.run('advect',this.forward,advection,{uSource:this.dye.read.texture,uVelocity:this.velocity.read.texture});
    this.run('advect',this.backward,{...advection,uDt:-dt},{uSource:this.forward.texture,uVelocity:this.velocity.read.texture});
    this.run('correct',this.dye.write,{...advection,uDecay:CONFIG.decay,uTime:this.time},{uSource:this.dye.read.texture,uForward:this.forward.texture,uBackward:this.backward.texture,uVelocity:this.velocity.read.texture});this.dye.swap();
  }
  draw(){
    if(!this.dye)return;
    this.run('display',null,{uLogoRect:this.logoRect,uShoeRect:this.shoeRect,uMaterial:this.weights,uTime:this.time,uResolution:[canvas.width,canvas.height],uReduced:reducedMotion.matches?1:0,uPreview:this.preview?1:0},{uSource:this.dye.read.texture,uLogo:this.textures[0],uLogoNormal:this.textures[1],uShoe:this.textures[2],uShoeNormal:this.textures[3]});
  }
  updateVisibility(){
    const visible=this.intersecting&&heroExposed&&!document.hidden;
    if(visible===this.visible)return;
    const now=performance.now();
    this.visible=visible;
    if(!visible){
      this.pausedAt=now;
      this.input.leave();
      this.lastPointer=null;
      this.touchTap?.cancel();
      return;
    }
    if(this.lastInput>0&&this.pausedAt!==null)this.lastInput+=now-this.pausedAt;
    this.pausedAt=null;
    this.lastTime=now;
    this.start();
  }
  start(){if(this.running||!this.visible)return;this.running=true;this.lastTime=performance.now();requestAnimationFrame(t=>this.frame(t));}
  frame(now){
    if(!this.visible||document.hidden||this.gl.isContextLost()){this.running=false;return;}
    const dt=Math.max(0,Math.min((now-this.lastTime)/1000,.033));this.lastTime=now;this.time+=dt;
    if(autoMode&&this.time-this.lastMaterialTime>CONFIG.materialInterval)setMaterial((selectedMaterial+1)%3);
    const blend=1.-Math.exp(-dt*5./CONFIG.transitionDuration);
    for(let i=0;i<3;i++)this.weights[i]+=(this.targetWeights[i]-this.weights[i])*(reducedMotion.matches?1:blend);
    // GPU work stops after the trail has dissipated; interactions wake it instantly.
    const active=now-this.lastInput<6500||this.input.queue.length>0;
    if(active&&dt>0){const steps=Math.max(1,Math.ceil(dt/(1/60)));for(let i=0;i<steps;i++)this.simulate(dt/steps);}
    this.draw();
    if(!active&&!autoMode&&this.weights.every((v,i)=>Math.abs(v-this.targetWeights[i])<.001)){this.running=false;return;}
    requestAnimationFrame(t=>this.frame(t));
  }
}

const loadImage=file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not load '+file));img.src='assets/'+file;});
async function boot(){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});
  const supported=gl&&gl.getExtension('EXT_color_buffer_float');
  const images=await Promise.all(['wordmark.png','wordmark-normal.png','air-max.png','shoe-normal.png'].map(loadImage));
  let gpuActive=Boolean(supported);
  if(gpuActive){
    try {
      gl.getExtension('OES_texture_float_linear');
      engine=new FluidReveal(gl,images);
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();document.body.classList.remove('webgl-ready');document.querySelector('#interaction-hint').textContent='Графика приостановлена. Восстановление…';});
      canvas.addEventListener('webglcontextrestored',()=>location.reload());
    } catch(error) { console.warn('WebGL unavailable; using Canvas fluid renderer.',error);gpuActive=false; }
  }
  if(!gpuActive){
    canvas.hidden=true;
    document.querySelector('#load-note').classList.add('done');
    document.querySelector('#interaction-hint').textContent='Для жидкого эффекта нужен WebGL 2. Материалы можно посмотреть кнопкой ниже.';
    const word=document.querySelector('.fallback-word');
    engine={
      preview:false,
      selectMaterial(id){if(this.preview)word.src=`assets/wordmark-material-${id}.webp`;},
      togglePreview(){this.preview=!this.preview;hero.classList.toggle('static-preview',this.preview);word.src=this.preview?`assets/wordmark-material-${selectedMaterial}.webp`:'assets/wordmark.png';return this.preview;},
      reset(){if(this.preview)this.togglePreview();},start(){}
    };
    document.querySelector('#auto-button').disabled=true;
    canvas.dataset.renderer='static';
    return;
  }
  document.body.classList.add('webgl-ready');
  document.querySelector('#load-note').classList.add('done');
  canvas.dataset.renderer=gpuActive?'webgl2':'canvas-fluid';
}
export const ready=boot().catch(error=>{
  console.error('Liquid Lab:',error);
  canvas.hidden=true;
  document.querySelector('#load-note').classList.add('done');
  document.querySelector('#interaction-hint').innerHTML='Не удалось загрузить эффект.<br><span>Обнови страницу, чтобы попробовать снова.</span>';
  document.querySelectorAll('[data-material],#auto-button,#reset-button').forEach(b=>{b.disabled=true;});
});

export { engine, CONFIG };

installScrollText({reduced:()=>!motionEnabled,SmoothScroll:Lenis,onHeroVisibility:visible=>{
  heroExposed=visible;
  engine?.updateVisibility?.();
}});
