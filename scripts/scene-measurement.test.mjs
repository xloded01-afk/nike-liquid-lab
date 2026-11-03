import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function page(){
 const classes=new Set(),frames=[],events={},loaders=[];
 let fontReady;
 const style=()=>({height:'',minHeight:'',setProperty(){},removeProperty(){}});
 let context;
 const layout=()=>{
  // Match native scroll clamping when a forced layout sees shorter tracks.
  if(!classes.has('scenes-ready'))context.scrollY=Math.min(context.scrollY,4320);
 };
 const stages=Array.from({length:6},()=>({style:style(),naturalHeight:720,
  getBoundingClientRect(){layout();return {height:classes.has('scenes-ready')&&this.style.height!=='auto'?720:this.naturalHeight};}}));
 const scenes=stages.map((stage,index)=>({style:style(),offsetTop:216+index*1224,querySelector:()=>stage,contains:()=>false}));
 const html={style:style(),classList:{
  remove:(...names)=>names.forEach(name=>classes.delete(name)),
  toggle:(name,on)=>on?classes.add(name):classes.delete(name)
 }};
 const document={documentElement:html,activeElement:{},querySelector:()=>({}),
  querySelectorAll:selector=>selector==='.screen-track'?scenes:selector==='img'?[{addEventListener:(name,callback)=>loaders.push(callback)}]:[],
  fonts:{ready:{then:callback=>{fontReady=callback;}}},addEventListener(){}};
 context=vm.createContext({document,innerHeight:720,innerWidth:1280,scrollY:0,location:{hash:''},
  getComputedStyle:()=>({scrollPaddingTop:'24px'}),CSS:{supports:()=>true},
  matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:callback=>frames.push(callback),
  addEventListener:(name,callback)=>{events[name]=callback;}});
 context.window=context;
 const source=readFileSync(new URL('../dist/scroll-text.js',import.meta.url),'utf8').replaceAll('export ','');
 vm.runInContext(source+'\ninstallScrollText();',context);
 const flush=()=>{while(frames.length)frames.shift()();};flush();
 return {context,classes,stages,flush,load:()=>loaders[0](),fonts:()=>fontReady(),resize:()=>events.resize()};
}

test('first image load preserves the position deep in the chapter sequence',()=>{
 const p=page();p.context.scrollY=5328;p.load();p.flush();
 assert.equal(p.context.scrollY,5328);
 assert.ok(p.classes.has('scenes-ready'));
 assert.ok(p.stages.every(stage=>stage.style.height===''&&stage.style.minHeight===''));
});

test('font completion and same-size resize keep the current scroll position',()=>{
 const p=page();p.context.scrollY=5328;p.fonts();p.flush();p.resize();p.flush();
 assert.equal(p.context.scrollY,5328);
});

test('an intrinsically tall stage still falls back to readable document flow',()=>{
 const p=page();p.stages[0].naturalHeight=820;p.resize();p.flush();
 assert.equal(p.classes.has('scenes-ready'),false);
 assert.ok(p.stages.every(stage=>stage.style.height===''&&stage.style.minHeight===''));
 p.stages[0].naturalHeight=720;p.resize();p.flush();assert.ok(p.classes.has('scenes-ready'));
});
