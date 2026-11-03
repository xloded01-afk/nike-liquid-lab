import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScrollDirection,shouldFade,scrollExitClass,motionState} from '../dist/scroll-text.js';
test('small scroll noise does not flip direction; deliberate reversal restores',()=>{
 const s=new ScrollDirection(0);assert.equal(s.update(2),'up');assert.equal(s.update(14),'down');assert.equal(s.update(12),'down');assert.equal(s.update(5),'up');
});
test('unseen content waits below the viewport and reveals before entering',()=>{
 const item={top:1100,height:200,hero:false,seen:false};
 assert.deepEqual(motionState(item,'down',0,900),{pending:true,exiting:false});
 assert.deepEqual(motionState(item,'down',300,900),{pending:false,exiting:false});
});
test('seen content never resets its entrance during a reversal',()=>{
 const item={top:1000,height:200,hero:false,seen:true};
 assert.equal(motionState(item,'up',0,900).pending,false);
 assert.equal(motionState(item,'down',1170,900).exiting,true);
 assert.equal(motionState(item,'up',1160,900).exiting,false);
});
test('motion off and keyboard focus reveal content regardless of scroll direction',()=>{
 const item={top:1000,height:200,hero:false,seen:false};
 assert.deepEqual(motionState(item,'down',0,900,true),{pending:false,exiting:false});
 assert.deepEqual(motionState(item,'down',0,900,false,true),{pending:false,exiting:false});
 assert.equal(motionState({...item,hero:true},'down',100,900,false,true).exiting,false);
});
test('images use their own exit state and the same reversible scroll rules',()=>{
 assert.equal(scrollExitClass(true),'media-is-out');
 assert.equal(scrollExitClass(false),'text-is-out');
 const image={hero:false,top:900,height:360};
 assert.equal(shouldFade(image,'down',800,900),false);
 assert.equal(shouldFade(image,'down',1220,900),true);
 assert.equal(shouldFade(image,'up',1220,900),false);
});
test('hero fades immediately, new reading content stays visible until outgoing',()=>{
 assert.equal(shouldFade({hero:true,top:500,height:100},'down',20,900),true);
 assert.equal(shouldFade({hero:false,top:1200,height:100},'down',300,900),false);
 assert.equal(shouldFade({hero:false,top:400,height:100},'down',470,900),true);
 assert.equal(shouldFade({hero:false,top:924,height:72},'down',820,844),false);
 assert.equal(shouldFade({hero:true,top:0,height:100},'up',500,900),false);
 assert.equal(shouldFade({hero:true,top:0,height:100},'down',0,900),false);
});
