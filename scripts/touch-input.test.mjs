import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JetInput} from '../dist/jet-input.js';

function renderer(){
 let captured=null;
 const surface={setPointerCapture:id=>{captured=id;},hasPointerCapture:id=>captured===id,
  releasePointerCapture:id=>{if(captured===id)captured=null;}};
 const target={closest:selector=>selector==='.liquid-surface'?surface:null};
 const outside={closest:()=>null};
 const context=vm.createContext({hero:{getBoundingClientRect:()=>({left:0,top:0,width:400,height:800})},
  performance:{now:()=>1100},requestAnimationFrame(){},document:{hidden:false},heroExposed:true,
  reducedMotion:{matches:false},window:{scrollY:0}});
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('class FluidReveal {'),source.indexOf('const loadImage='))+'\nglobalThis.Renderer=FluidReveal;',context);
 const engine=Object.create(context.Renderer.prototype);
 Object.assign(engine,{input:new JetInput(),aspect:.5,visible:true,intersecting:true,touchId:null,touchSurface:surface,lastPointer:null,running:false});
 const event=(type,extra={})=>({type,pointerType:'touch',pointerId:7,isPrimary:true,target,clientX:180,clientY:300,timeStamp:1000,buttons:1,...extra});
 assert.equal(typeof engine.touch,'function');
 return {engine,context,event,outside,captured:()=>captured};
}

test('finger movement emits a continuous horizontal and vertical stroke',()=>{
 const {engine,event,captured}=renderer();engine.touch(event('pointerdown'));
 assert.equal(captured(),7);const count=engine.input.queue.length;
 engine.touch(event('pointermove',{clientY:380,timeStamp:1016}));
 engine.touch(event('pointermove',{clientX:240,clientY:380,timeStamp:1032}));
 assert.equal(engine.input.queue.length,count+2);
 assert.equal(engine.input.last.x,.6);assert.equal(engine.input.last.y,.525);
});

test('a long drawing gesture continues beyond the former tap timeout',()=>{
 const {engine,event}=renderer();engine.touch(event('pointerdown'));
 engine.touch(event('pointermove',{clientX:210,timeStamp:1040}));
 engine.touch(event('pointermove',{clientX:250,timeStamp:1400}));
 engine.touch(event('pointermove',{clientX:280,timeStamp:1420}));
 assert.equal(engine.touchId,7);assert.equal(engine.input.last.x,.7);assert.ok(engine.input.queue.length>=3);
});

test('a gesture starting outside the logo remains available for page scrolling',()=>{
 const {engine,event,outside,captured}=renderer();engine.touch(event('pointerdown',{target:outside}));
 engine.touch(event('pointermove'));assert.equal(captured(),null);assert.equal(engine.input.queue.length,0);
});

test('lifting or cancelling the finger releases capture and rejects stale movement',()=>{
 for(const ending of ['pointerup','pointercancel']){
  const {engine,event,captured}=renderer();engine.touch(event('pointerdown'));engine.touch(event(ending));
  const count=engine.input.queue.length;engine.touch(event('pointermove',{clientX:240,timeStamp:1032}));
  assert.equal(captured(),null);assert.equal(engine.touchId,null);assert.equal(engine.input.last,null);
  assert.equal(engine.input.queue.length,count);
 }
});

test('a secondary finger cannot replace the active drawing finger',()=>{
 const {engine,event,captured}=renderer();engine.touch(event('pointerdown'));
 const count=engine.input.queue.length;
 engine.touch(event('pointerdown',{pointerId:8,isPrimary:false}));
 engine.touch(event('pointermove',{pointerId:8,isPrimary:false,clientX:240}));
 engine.touch(event('pointerup',{pointerId:8,isPrimary:false}));
 assert.equal(captured(),7);assert.equal(engine.input.queue.length,count);
});

test('disabled motion and a hidden hero do not retain a touch capture',()=>{
 const {engine,context,event,captured}=renderer();context.reducedMotion.matches=true;
 engine.touch(event('pointerdown'));assert.equal(captured(),null);
 context.reducedMotion.matches=false;engine.touch(event('pointerdown'));
 context.heroExposed=false;engine.updateVisibility();assert.equal(captured(),null);assert.equal(engine.touchId,null);
});
