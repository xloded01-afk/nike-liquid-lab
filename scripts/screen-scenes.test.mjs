import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wipeFrame} from '../dist/scroll-text.js';
test('half-screen edge leaves artwork stationary and heading hidden',()=>{
 const frame=wipeFrame(450,1350,900);
 assert.equal(450+frame.offset,0);
 assert.equal(frame.ink,0);
});
test('the previous heading fades early and the next arrives late',()=>{
 assert.equal(wipeFrame(0,900,900).ink,1);
 assert.equal(wipeFrame(0,650,900).ink,0);
 assert.ok(wipeFrame(150,1050,900).ink>0);
 assert.ok(wipeFrame(0,900,900).offset===0);
});
