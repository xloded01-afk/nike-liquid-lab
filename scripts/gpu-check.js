import {engine,ready,CONFIG} from '../dist/app.js';
await ready;
const report=document.createElement('pre');report.id='test-results';
Object.assign(report.style,{position:'fixed',bottom:'0',left:'0',zIndex:'200',margin:'0',padding:'8px',background:'#fff',color:'#000',font:'12px monospace',maxWidth:'100%',maxHeight:'130px',overflow:'auto'});
document.body.append(report);
const tick=()=>new Promise(r=>requestAnimationFrame(r));
if(!engine?.gl){report.textContent='FAIL: GPU unavailable';throw Error('GPU unavailable');}
if(document.querySelector('#motion-button').getAttribute('aria-pressed')==='false')document.querySelector('#motion-button').click();
engine.visible=false;engine.frame=()=>{engine.running=false;};await tick();await tick();engine.reset();
function measure(){
 const {gl,dye}=engine,t=dye.read,data=new Float32Array(t.w*t.h*4);
 gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.readPixels(0,0,t.w,t.h,gl.RGBA,gl.FLOAT,data);
 let mass=0,xsum=0,area=0,maxX=0,finite=true;
 for(let y=0;y<t.h;y++)for(let x=0;x<t.w;x++){
  const v=data[(y*t.w+x)*4];finite&&=Number.isFinite(v);mass+=v;xsum+=v*x/t.w;
  if(v>.3){area++;maxX=Math.max(maxX,x/t.w);}
 }
 return {mass,cx:xsum/Math.max(mass,.0001),area,maxX,finite,error:gl.getError()};
}
async function steps(n){for(let i=0;i<n;i++){engine.time+=1/60;engine.simulate(1/60);if(i%10===0)await tick();}engine.draw();}
const mode=new URLSearchParams(location.search).get('mode')||'checks';
const result={renderer:document.querySelector('canvas').dataset.renderer};
const hero=document.querySelector('.hero'),rect=hero.getBoundingClientRect();
for(let i=0;i<2;i++){
 const event=new PointerEvent('pointermove',{bubbles:true,clientX:rect.width*(.2+i*.03),clientY:rect.height*.4,buttons:0,pointerType:'mouse'});
 Object.defineProperty(event,'timeStamp',{value:100+i*16.67});hero.dispatchEvent(event);
}
result.hoverWithoutPress=engine.input.queue.length>0;engine.reset();
engine.input.sample(.16,.52,0,engine.aspect);
for(let i=1;i<=18;i++){
 engine.input.sample(.16+i/18*.32,.52+Math.sin(i/18*Math.PI*2)*.07,i*1000/60,engine.aspect);
 await steps(1);
}
const release=measure();await steps(12);const inertia=measure();
result.release=release;result.inertia=inertia;
result.aheadOfCursor=inertia.maxX>.49;
result.movingAfterStop=Math.abs(inertia.cx-release.cx)>.001;
result.finite=inertia.finite&&inertia.error===0;
if(mode==='bench'){
 const timings=[];let last=performance.now();
 for(let i=0;i<150;i++){
  const now=await new Promise(r=>requestAnimationFrame(r));
  if(i>30)timings.push(now-last);last=now;
  engine.input.sample(.5+Math.sin(i*.09)*.25,.5+Math.cos(i*.12)*.15,now,engine.aspect);
  engine.time+=1/60;engine.simulate(1/60);engine.draw();
 }
 timings.sort((a,b)=>a-b);result.medianMs=timings[Math.floor(timings.length*.5)];result.p95Ms=timings[Math.floor(timings.length*.95)];result.averageFPS=1000/(timings.reduce((a,b)=>a+b,0)/timings.length);result.viewport=[innerWidth,innerHeight];result.canvas=[document.querySelector('canvas').width,document.querySelector('canvas').height];
 report.textContent=JSON.stringify(result,null,2);document.title='Benchmark complete';
}else if(mode==='shape'){
 engine.input.sample(.54,.48,600,engine.aspect);
 for(let i=1;i<=25;i++){
  const theta=i/25*Math.PI*1.7;
  engine.input.sample(.54+Math.sin(theta)*.16,.48+Math.cos(theta)*.17,600+i*1000/60,engine.aspect);await steps(1);
 }
 await steps(7);result.shape=measure();report.textContent=JSON.stringify(result);report.hidden=true;engine.draw();
}else{
 await steps(240);const end=measure();result.end=end;result.dissipated=end.area===0;result.pass=result.hoverWithoutPress&&result.aheadOfCursor&&result.movingAfterStop&&result.finite&&result.dissipated;
 report.textContent=JSON.stringify(result,null,2);document.title=result.pass?'PASS — GPU checks':'FAIL — GPU checks';
}
