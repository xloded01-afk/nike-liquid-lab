import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JetInput} from '../dist/jet-input.js';

function renderer(){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 let clock=1100;
 let heroTop=0;
 const context=vm.createContext({window:{scrollY:500},document:{hidden:false},heroExposed:true,
  hero:{getBoundingClientRect:()=>({left:0,top:heroTop,width:1000,height:1000})},
  CONFIG:{transitionDuration:.8,materialInterval:5.5},autoMode:false,reducedMotion:{matches:false},
  performance:{now:()=>clock},requestAnimationFrame:()=>0});
 vm.runInContext(source.slice(source.indexOf('class FluidReveal {'),source.indexOf('const loadImage='))+'\nglobalThis.Renderer=FluidReveal;',context);
 const engine=Object.create(context.Renderer.prototype);
 Object.assign(engine,{visible:true,intersecting:true,pausedAt:null,lastInput:1000,lastTime:1100,
  running:false,time:0,weights:[1,0,0],targetWeights:[1,0,0],input:{queue:[],leave(){}},
  gl:{isContextLost:()=>false},steps:0,simulate(){this.steps++;},draw(){}});
 return {engine,context,setTime:time=>{clock=time;},setHeroTop:top=>{heroTop=top;}};
}

test('existing waves keep simulating after scrolling away from zero',()=>{
 const {engine}=renderer();
 engine.frame(1116);
 assert.ok(engine.steps>0,'visible fluid must advance at scrollY=500');
});

test('occlusion preserves the activity deadline across a long hidden interval',()=>{
 const {engine,context,setTime}=renderer();
 assert.equal(typeof engine.updateVisibility,'function');
 context.heroExposed=false;setTime(1200);engine.updateVisibility();
 assert.equal(engine.visible,false);
 engine.frame(8200);assert.equal(engine.steps,0);
 context.heroExposed=true;setTime(9200);engine.updateVisibility();
 assert.equal(engine.visible,true);
 assert.equal(engine.lastInput,9000);
 assert.equal(engine.lastTime,9200);
 engine.frame(9216);assert.ok(engine.steps>0,'saved activity must resume after 8 hidden seconds');
});

test('document visibility and viewport visibility both pause the renderer',()=>{
 const {engine,context,setTime}=renderer();
 assert.equal(typeof engine.updateVisibility,'function');
 context.document.hidden=true;engine.updateVisibility();assert.equal(engine.visible,false);
 engine.intersecting=false;context.document.hidden=false;setTime(1500);engine.updateVisibility();
 assert.equal(engine.visible,false);
 engine.intersecting=true;engine.updateVisibility();assert.equal(engine.visible,true);
});


test('scrolling under a stationary mouse adds no new impulse',()=>{
 const {engine,setHeroTop}=renderer();engine.input=new JetInput();engine.aspect=1;
 const event={target:{closest:()=>false},pointerType:'mouse',clientX:100,clientY:400,timeStamp:1100};
 engine.pointer(event);engine.pointer({...event,clientX:120,timeStamp:1116});
 assert.ok(engine.input.queue.length>0);engine.input.queue=[];
 setHeroTop(-40);engine.pointer({...event,clientX:120,timeStamp:1132});
 assert.equal(engine.input.queue.length,0,'layout moving under a stationary mouse is not mouse movement');
});


test('a small mouse movement after scroll is not amplified by canvas translation',()=>{
 const {engine,setHeroTop}=renderer();engine.input=new JetInput();engine.aspect=1;
 const event={target:{closest:()=>false},pointerType:'mouse',clientX:100,clientY:400,timeStamp:1100};
 engine.pointer(event);engine.pointer({...event,clientX:120,timeStamp:1116});engine.input.queue=[];
 setHeroTop(-40);engine.pointer({...event,clientX:121,timeStamp:1132});
 assert.equal(engine.input.queue.length,1);
 const segment=engine.input.queue[0];
 assert.ok(Math.abs(segment.b[0]-segment.a[0]-.001)<1e-10);
 assert.ok(Math.abs(segment.b[1]-segment.a[1])<1e-10);
});


test('a frame timestamp preceding a visibility callback cannot rewind simulation',()=>{
 const {engine}=renderer();engine.lastTime=1200;engine.time=2;
 engine.simulate=dt=>assert.ok(dt>=0,'simulation steps must not run backwards');
 engine.frame(1199);assert.equal(engine.time,2);
});
