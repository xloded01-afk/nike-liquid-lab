import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScrollDirection,shouldFade} from '../dist/scroll-text.js';
test('small scroll noise does not flip direction; deliberate reversal restores',()=>{
 const s=new ScrollDirection(0);assert.equal(s.update(2),'up');assert.equal(s.update(14),'down');assert.equal(s.update(12),'down');assert.equal(s.update(5),'up');
});
test('hero fades immediately, new reading content stays visible until outgoing',()=>{
 assert.equal(shouldFade({hero:true,top:500,height:100},'down',20,900),true);
 assert.equal(shouldFade({hero:false,top:1200,height:100},'down',300,900),false);
 assert.equal(shouldFade({hero:false,top:400,height:100},'down',380,900),true);
 assert.equal(shouldFade({hero:true,top:0,height:100},'up',500,900),false);
 assert.equal(shouldFade({hero:true,top:0,height:100},'down',0,900),false);
});
