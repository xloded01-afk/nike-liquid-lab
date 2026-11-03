import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScrollDirection,shouldFade,scrollExitClass} from '../dist/scroll-text.js';
test('small scroll noise does not flip direction; deliberate reversal restores',()=>{
 const s=new ScrollDirection(0);assert.equal(s.update(2),'up');assert.equal(s.update(14),'down');assert.equal(s.update(12),'down');assert.equal(s.update(5),'up');
});
test('images use their own exit state and the same reversible scroll rules',()=>{
 assert.equal(scrollExitClass(true),'media-is-out');
 assert.equal(scrollExitClass(false),'text-is-out');
 const image={hero:false,top:900,height:360};
 assert.equal(shouldFade(image,'down',800,900),false);
 assert.equal(shouldFade(image,'down',1100,900),true);
 assert.equal(shouldFade(image,'up',1100,900),false);
});
test('hero fades immediately, new reading content stays visible until outgoing',()=>{
 assert.equal(shouldFade({hero:true,top:500,height:100},'down',20,900),true);
 assert.equal(shouldFade({hero:false,top:1200,height:100},'down',300,900),false);
 assert.equal(shouldFade({hero:false,top:400,height:100},'down',380,900),true);
 assert.equal(shouldFade({hero:true,top:0,height:100},'up',500,900),false);
 assert.equal(shouldFade({hero:true,top:0,height:100},'down',0,900),false);
});
