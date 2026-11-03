// Direction hysteresis prevents trackpad noise from restarting transitions.
export class ScrollDirection {
 constructor(y=0){this.y=y;this.extreme=y;this.direction='up';}
 update(y){
  this.y=y;
  if(this.direction==='up'){
   this.extreme=Math.min(this.extreme,y);
   if(y-this.extreme>=12){this.direction='down';this.extreme=y;}
  }else{
   this.extreme=Math.max(this.extreme,y);
   if(this.extreme-y>=8){this.direction='up';this.extreme=y;}
  }
  if(y<=4){this.direction='up';this.extreme=y;}
  return this.direction;
 }
}
export function shouldFade(item,direction,y,viewport){
 // Preserve a full reading area, including direct section links on phones.
 return direction==='down'&&y>12&&(item.hero||item.top+item.height-y<Math.min(viewport*.08,56));
}
export function scrollExitClass(media){return media?'media-is-out':'text-is-out';}
// Fallback for browsers without compositor scroll timelines. The stage itself
// is sticky, so only the clipping window changes, never the artwork's position.
export function wipeFrame(top,nextTop,travel){
 const clamp=value=>Math.max(0,Math.min(1,value));
 const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
 const incoming=clamp(-top/travel);
 const outgoing=clamp(-nextTop/travel);
 const enter=ease((incoming-.64)/.31),exit=ease(outgoing/.24);
 return {clip:100*(1-ease(incoming)),ink:enter*(1-exit),shift:18*(1-enter-exit)};
}
export function motionState(item,direction,y,viewport,reduced=false,focused=false){
 if(reduced||focused)return {pending:false,exiting:false};
 return {
  pending:!item.seen&&item.top-y>=viewport*.96,
  exiting:shouldFade(item,direction,y,viewport)
 };
}
export function installScrollText(options={}){
 const html=document.documentElement;
 const nodes=[...document.querySelectorAll('[data-scroll-text],[data-scroll-media],[data-scroll-reveal]')];
 const scenes=[...document.querySelectorAll('.screen-track')].map(root=>({root,stage:root.querySelector('.screen-stage'),top:0}));
 const hero=document.querySelector('.hero');
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const coarse=matchMedia('(pointer: coarse)');
 const nativeTimeline=CSS.supports('animation-timeline: view()');
 const state=new ScrollDirection(window.scrollY),seen=new WeakSet();
 let enabled=false,pending=false,needsMeasure=true,travel=0,smoother=null,items=[],initial=true;

 function syncSmoothing(reduced){
  const smooth=enabled&&!reduced&&!coarse.matches&&options.SmoothScroll;
  if(smooth&&!smoother){
   smoother=new options.SmoothScroll({lerp:.11,smoothWheel:true,syncTouch:false,autoRaf:true,
    prevent:node=>!!node.closest('dialog')});
  }else if(!smooth&&smoother){smoother.destroy();smoother=null;}
 }
 function measure(){needsMeasure=true;schedule();}
 function render(){
  pending=false;
  const reduced=options.reduced?.()??preference.matches;
  if(needsMeasure){
   html.classList.remove('scenes-ready','scenes-timeline');
   scenes.forEach(scene=>{scene.stage.style.removeProperty('clip-path');});
   // Measure only after real layout changes, never during steady scrolling.
   const fits=scenes.every(scene=>scene.stage.getBoundingClientRect().height<=innerHeight+2);
   enabled=!reduced&&fits&&scenes.length>0;
   html.style.setProperty('--hero-height',Math.max(innerHeight,innerWidth<=680?800:700)+'px');
   html.classList.toggle('scenes-ready',enabled);
   html.classList.toggle('scenes-timeline',enabled&&nativeTimeline);
   travel=innerHeight*(innerWidth<=680?1.15:1.4);
   scenes.forEach(scene=>{scene.top=scene.root.offsetTop;});
   items=nodes.map(node=>{const rect=node.getBoundingClientRect();return {node,top:rect.top+scrollY,height:rect.height,hero:!!node.closest('.hero')};});
   syncSmoothing(reduced);
   smoother?.resize();
   if(initial&&enabled&&location.hash==='#silhouette'){
    window.scrollTo({top:scenes[0].top+travel,behavior:'instant'});
    smoother?.resize();
   }
   initial=false;
   needsMeasure=false;
  }
  if(enabled&&nativeTimeline)return;
  const y=window.scrollY;
  if(enabled){
   scenes.forEach((scene,index)=>{
    const next=scenes[index+1];
    const frame=wipeFrame(scene.top-y,next?next.top-y:Infinity,travel);
    scene.stage.style.clipPath=`inset(${frame.clip.toFixed(3)}% 0 0)`;
    scene.root.style.setProperty('--wipe-ink',frame.ink.toFixed(4));
    scene.root.style.setProperty('--ink-shift',frame.shift.toFixed(2)+'px');
   });
   const ink=wipeFrame(-travel,scenes[0].top-y,travel).ink;
   html.style.setProperty('--hero-ink',ink.toFixed(4));
  }else{
   const direction=state.update(y),active=document.activeElement;
   items.forEach(item=>{
    const focused=item.node.contains(active);
    const next=motionState({...item,seen:seen.has(item.node)},direction,y,innerHeight,reduced,focused);
    if(!next.pending)seen.add(item.node);
    item.node.classList.toggle('reveal-pending',next.pending);
    item.node.classList.toggle(scrollExitClass(item.node.hasAttribute('data-scroll-media')),next.exiting);
   });
  }
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(render);}}
 addEventListener('scroll',()=>{if(!enabled||!nativeTimeline)schedule();},{passive:true});
 addEventListener('resize',measure,{passive:true});
 addEventListener('pageshow',measure);
 document.fonts?.ready.then(measure);
 document.querySelectorAll('img').forEach(img=>img.addEventListener('load',measure,{once:true}));
 preference.addEventListener('change',measure);
 coarse.addEventListener('change',measure);
 document.addEventListener('lab-motion-change',measure);
 document.addEventListener('focusin',event=>{
  const scene=scenes.find(scene=>scene.root.contains(event.target));
  if(enabled&&scene&&event.target.matches(':focus-visible')){
   const target=scene.top+travel;
   if(smoother)smoother.scrollTo(target,{immediate:true});
   else window.scrollTo({top:target,behavior:'instant'});
  }else if(!enabled)schedule();
 });
 // Anchors land on the fully opened chapter, including the browser's Back flow.
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href="#silhouette"],a[href="#lab"]');
  if(!enabled||!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  const hash=link.getAttribute('href');
  const target=hash==='#lab'?0:scenes[0].top+travel;
  if(smoother)smoother.scrollTo(target);
  else window.scrollTo({top:target,behavior:(options.reduced?.()??preference.matches)?'instant':'smooth'});
  history.pushState(null,'',hash);
 });
 measure();
}
