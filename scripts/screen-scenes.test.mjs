import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wipeFrame} from '../dist/scroll-text.js';
test('halfway through a reveal clips half the stage and keeps the heading hidden',()=>{
 const frame=wipeFrame(-630,900,1260);
 assert.equal(frame.clip,50);
 assert.equal(frame.ink,0);
});
test('the previous heading fades early and the next arrives late',()=>{
 assert.equal(wipeFrame(-1260,0,1260).ink,1);
 assert.equal(wipeFrame(-1260,-350,1260).ink,0);
 assert.ok(wipeFrame(-1100,100,1260).ink>0);
 assert.equal(wipeFrame(0,900,1260).clip,100);
 assert.equal(wipeFrame(-1260,900,1260).clip,0);
});
