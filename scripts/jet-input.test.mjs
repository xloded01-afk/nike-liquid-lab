import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JetInput} from '../dist/jet-input.js';
test('velocity is independent of pointer sample frequency',()=>{
 for(const hz of [30,60,120,240]){
  const jet=new JetInput();jet.sample(.1,.5,0,2);
  for(let i=1;i<=hz/2;i++)jet.sample(.1+i/hz*.4,.5,i/hz*1000,2);
  assert.ok(Math.abs(jet.tail.v[0]-.4)<1e-8);
 }
});
test('stopped cursor leaves a bounded forward emission, then stops',()=>{
 const jet=new JetInput();jet.sample(.1,.5,0,2);jet.sample(.2,.5,50,2);jet.drain(1/60,2);
 const p=jet.drain(1/60,2)[0];assert.ok(p.b[0]>.2);assert.ok(p.dt<1/60);
 for(let i=0;i<10;i++)jet.drain(1/60,2);
 assert.equal(jet.drain(1/60,2).length,0);
});
test('turn sign follows direction, and reentry cannot draw a teleport streak',()=>{
 const jet=new JetInput();jet.sample(.1,.5,0,2);jet.sample(.2,.5,50,2);jet.sample(.2,.6,100,2);
 assert.ok(jet.tail.turn>0);jet.reset();jet.sample(.9,.9,1000,2);assert.equal(jet.queue.length,0);
});
test('queued input remains bounded and preserves the start of a fast path',()=>{
 const jet=new JetInput();jet.sample(.1,.5,0,2);
 for(let i=1;i<100;i++)jet.sample(.1+i*.001,.5,i*4,2);
 assert.equal(jet.queue.length,12);assert.equal(jet.queue[0].a[0],.1);
});
