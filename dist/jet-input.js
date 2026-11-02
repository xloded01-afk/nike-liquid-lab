/** Pointer samples become swept nozzles, never rendered particles.
 * Coordinates and velocities use viewport-height units / seconds.
 * Event-rate independent: every segment carries its own duration. */
export class JetInput {
  constructor(){ this.reset(); }
  reset(){ this.last=null; this.queue=[]; this.tail=null; }
  leave(){ this.last=null; this.tail=null; }
  sample(x,y,time,aspect,tap=false){
    const prev=this.last;
    this.last={x,y,time};
    if(!prev||time-prev.time>180){
      if(tap) this.queue.push({a:[x,y],b:[x+.006/aspect,y],v:[.12/aspect,0],dt:1/60,turn:0});
      return;
    }
    const dx=x-prev.x,dy=y-prev.y;
    if(Math.hypot(dx*aspect,dy)<.0001)return;
    const dt=Math.max(1/500,Math.min(.06,(time-prev.time)/1000));
    let vx=dx/dt,vy=dy/dt;
    const speed=Math.hypot(vx*aspect,vy),limit=Math.min(1,3.8/speed);
    vx*=limit;vy*=limit;
    const old=this.tail;
    const turn=old?Math.max(-1,Math.min(1,(old.v[0]*vy-old.v[1]*vx)*aspect/(Math.hypot(...old.v)*Math.hypot(vx,vy)+.001))):0;
    const segment={a:[prev.x,prev.y],b:[x,y],v:[vx,vy],dt,turn};
    this.queue.push(segment);
    // Bound latency without leaving holes: merge the oldest two segments.
    if(this.queue.length>12){const first=this.queue.shift();this.queue[0].a=first.a;this.queue[0].dt+=first.dt;}
    this.tail={...segment,b:[x,y],life:.11};
  }
  drain(dt,aspect){
    if(this.queue.length)return this.queue.splice(0);
    if(!this.tail||this.tail.life<=0)return [];
    const tail=this.tail,fade=tail.life/.11;
    tail.life-=dt;
    const a=[...tail.b];
    tail.b=[a[0]+tail.v[0]*dt*.65,a[1]+tail.v[1]*dt*.65];
    return [{a,b:[...tail.b],v:tail.v,dt:dt*fade*.45,turn:tail.turn}];
  }
}
