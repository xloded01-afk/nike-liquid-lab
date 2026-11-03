import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as input from '../dist/jet-input.js';
const event=(x,y,time)=>({pointerId:1,clientX:x,clientY:y,timeStamp:time});
function recognizer(){assert.equal(typeof input.TouchTap,'function');return new input.TouchTap();}

test('a completed short touch emits one tap only',()=>{
 const tap=recognizer();tap.begin(event(100,100,0),0);
 assert.equal(tap.end(event(102,101,180),0),true);
 assert.equal(tap.end(event(102,101,190),0),false);
});
test('a swipe that returns to its origin stays rejected',()=>{
 const tap=recognizer();tap.begin(event(100,100,0),0);tap.move(event(100,140,70),0);
 assert.equal(tap.end(event(100,100,150),0),false);
});
test('native scrolling, cancellation and a long hold are not taps',()=>{
 const tap=recognizer();tap.begin(event(100,100,0),0);
 assert.equal(tap.end(event(100,100,180),20),false);
 tap.begin(event(100,100,0),0);tap.cancel();assert.equal(tap.end(event(100,100,100),0),false);
 tap.begin(event(100,100,0),0);assert.equal(tap.end(event(100,100,500),0),false);
});
