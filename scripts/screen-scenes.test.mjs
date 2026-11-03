import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screenFrame} from '../dist/scroll-text.js';
test('a scene grows continuously until its native sticky position',()=>{
 const entering=screenFrame(900,1020,900,900);
 const halfway=screenFrame(450,1020,900,900);
 const settled=screenFrame(0,1020,900,900);
 assert.ok(entering.scale<halfway.scale&&halfway.scale<settled.scale);
 assert.equal(settled.scale,1);assert.equal(settled.opacity,1);
 assert.equal(settled.stageTop,0);
});
test('content stays centered throughout the hold and releases without a jump',()=>{
 assert.equal(screenFrame(-60,1020,900,900).stageTop,0);
 const a=screenFrame(-119.99,1020,900,900),b=screenFrame(-120.01,1020,900,900);
 assert.ok(Math.abs(a.stageTop-b.stageTop)<.02);
 assert.ok(Math.abs(a.scale-b.scale)<.001);
 assert.equal(screenFrame(-220,1020,900,900).stageTop,-100);
});
test('oversized content and motion-off use the natural document flow',()=>{
 for(const options of [{tall:true},{reduced:true}]){
  const frame=screenFrame(-60,1400,1200,900,options);
  assert.equal(frame.stageTop,-60);assert.equal(frame.scale,1);assert.equal(frame.opacity,1);
 }
});
test('all visual values remain bounded across a complete forward and backward pass',()=>{
 for(let top=1200;top>=-1600;top-=10){
  const v=screenFrame(top,1020,900,900);
  assert.ok(v.scale>=.95&&v.scale<=1);assert.ok(v.opacity>=.55&&v.opacity<=1);
  assert.ok(Number.isFinite(v.shift));
 }
});
