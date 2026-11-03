// Direction hysteresis prevents trackpad noise from restarting transitions.
export class ScrollDirection {
 constructor(y=0){this.y=y;this.extreme=y;this.direction='up';}
 update(y){
  const delta=y-this.y;this.y=y;
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
 return direction==='down'&&y>12&&(item.hero||item.top+item.height-y<viewport*.23);
}
export function scrollExitClass(media){return media?'media-is-out':'text-is-out';}
export function installScrollText(options={}){
 const nodes=[...document.querySelectorAll('[data-scroll-text],[data-scroll-media]')];
 const state=new ScrollDirection(window.scrollY);
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 let items=[],pending=false,needsMeasure=true;
 function render(){
  pending=false;const y=Math.max(0,window.scrollY);
  if(needsMeasure){
   items=nodes.map(node=>{const r=node.getBoundingClientRect();return {node,top:r.top+y,height:r.height,hero:!!node.closest('.hero'),exitClass:scrollExitClass(node.hasAttribute('data-scroll-media'))};});
   needsMeasure=false;
  }
  const direction=state.update(y);
  for(const item of items)item.node.classList.toggle(item.exitClass,!(options.reduced?.()??preference.matches)&&shouldFade(item,direction,y,innerHeight));
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(render);}}
 function measure(){needsMeasure=true;schedule();}
 addEventListener('scroll',schedule,{passive:true});
 addEventListener('resize',measure,{passive:true});
 addEventListener('pageshow',measure);
 document.fonts?.ready.then(measure);
 document.querySelectorAll('img').forEach(img=>img.addEventListener('load',measure,{once:true}));
 preference.addEventListener('change',schedule);
 document.addEventListener('lab-motion-change',schedule);
 // Tab navigation must always expose the text around the focused control.
 document.addEventListener('focusin',()=>{for(const {node,exitClass} of items)node.classList.remove(exitClass);});
 measure();
}
