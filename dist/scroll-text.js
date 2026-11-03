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
export function motionState(item,direction,y,viewport,reduced=false,focused=false){
 if(reduced||focused)return {pending:false,exiting:false};
 return {
  pending:!item.seen&&item.top-y>=viewport*.96,
  exiting:shouldFade(item,direction,y,viewport)
 };
}
export function installScrollText(options={}){
 const nodes=[...document.querySelectorAll('[data-scroll-text],[data-scroll-media],[data-scroll-reveal]')];
 const state=new ScrollDirection(window.scrollY);
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const seen=new WeakSet();
 // Stagger only peers in a reading group, never accumulate delay over the page.
 const groups=new Map();
 for(const node of nodes){
  const group=node.closest('[data-motion-group]')||node.parentElement;
  const index=groups.get(group)||0;groups.set(group,index+1);
  const order=Number(node.dataset.motionOrder??index);
  node.style.setProperty('--motion-order',String(Math.max(0,Math.min(order,3))));
 }
 let items=[],pending=false,needsMeasure=true;
 function render(){
  pending=false;
  const y=Math.max(0,Math.min(window.scrollY,document.documentElement.scrollHeight-innerHeight));
  const reduced=options.reduced?.()??preference.matches;
  if(needsMeasure){
   // Read stable document coordinates, subtracting our current transition offset.
   // Nested hover transforms live on the child image, never on these motion roots.
   items=nodes.map(node=>{
    const r=node.getBoundingClientRect(),transform=getComputedStyle(node).transform;
    const offset=transform==='none'?0:new DOMMatrixReadOnly(transform).m42;
    return {node,top:r.top+y-offset,height:r.height,hero:!!node.closest('.hero'),exitClass:scrollExitClass(node.hasAttribute('data-scroll-media'))};
   });
   needsMeasure=false;
  }
  const direction=state.update(y);
  const active=document.activeElement;
  // All layout reads above; the rest of this frame only changes classes.
  for(const item of items){
   const control=item.node.closest('a,button');
   const focused=active!==document.body&&(item.node.contains(active)||control?.contains(active));
   const next=motionState({...item,seen:seen.has(item.node)},direction,y,innerHeight,reduced,focused);
   if(!next.pending)seen.add(item.node);
   item.node.classList.toggle('reveal-pending',next.pending);
   item.node.classList.toggle(item.exitClass,next.exiting);
  }
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
 document.addEventListener('focusin',schedule);
 if(typeof ResizeObserver!=='undefined'){
  const observer=new ResizeObserver(measure);
  document.querySelectorAll('main>section,main>footer').forEach(node=>observer.observe(node));
 }
 measure();
}
