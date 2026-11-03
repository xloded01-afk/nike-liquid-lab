import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('hero exposure follows complete clipping in both scroll directions',()=>{
 const changes=[],events={},focusEvents={},frames=[],classes=new Set();
 let focusVisible=false;
 const focusedNode={matches:()=>focusVisible};
 const style={setProperty(){},removeProperty(){}};
 const html={style,classList:{add:x=>classes.add(x),remove:(...x)=>x.forEach(v=>classes.delete(v)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)}};
 const stage={style,getBoundingClientRect:()=>({height:900})};
 const scene={offsetTop:270,querySelector:selector=>selector==='.screen-stage'?stage:(focusVisible?focusedNode:null),contains:node=>node===focusedNode,style};
 const document={documentElement:html,querySelector:()=>({}),querySelectorAll:selector=>selector==='.screen-track'?[scene]:[],addEventListener:(name,fn)=>{focusEvents[name]=fn;}};
 const context=vm.createContext({document,scrollY:0,innerHeight:900,innerWidth:1440,location:{hash:''},
  CSS:{supports:()=>true},getComputedStyle:()=>({scrollPaddingTop:'24px'}),
  matchMedia:()=>({matches:false,addEventListener(){}}),
  requestAnimationFrame:fn=>frames.push(fn),addEventListener:(name,fn)=>{events[name]=fn;}});
 context.window=context;context.scrollTo=({top})=>{context.scrollY=top;events.scroll();};
 const source=readFileSync(new URL('../dist/scroll-text.js',import.meta.url),'utf8').replaceAll('export ','');
 vm.runInContext(source+'\ninstallScrollText({onHeroVisibility:value=>changes.push(value)});',vm.createContext(Object.assign(context,{changes})));
 const flush=()=>{while(frames.length)frames.shift()();};flush();
 assert.deepEqual(changes,[true]);
 context.scrollY=900;events.scroll();flush();assert.deepEqual(changes,[true]);
 context.scrollY=1506;events.scroll();flush();assert.deepEqual(changes,[true,false]);
 context.scrollY=1600;events.scroll();flush();assert.deepEqual(changes,[true,false]);
 context.scrollY=1400;events.scroll();flush();assert.deepEqual(changes,[true,false,true]);
 document.activeElement=focusedNode;focusVisible=true;focusEvents.focusin({target:focusedNode});flush();
 context.scrollY=1000;events.scroll();flush();
 assert.equal(changes.at(-1),false,'the focused opaque chapter still covers the hero');
 context.scrollY=200;events.scroll();flush();assert.equal(changes.at(-1),true);
 focusVisible=false;context.scrollY=1000;events.scroll();flush();assert.equal(changes.at(-1),true);
 focusVisible=true;events.scroll();flush();assert.equal(changes.at(-1),false,'keyboard modality may change without focusin');
});
