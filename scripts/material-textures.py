"""Pre-render matching material assets for the Canvas compatibility renderer."""
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]/'dist/assets'

def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def render(name,normal_name):
 im=Image.open(root/(name+'.png')).convert('RGBA');im.thumbnail((1500,900),Image.Resampling.LANCZOS)
 nimg=Image.open(root/normal_name).resize(im.size,Image.Resampling.LANCZOS)
 src=np.asarray(im,dtype=np.float32)/255
 norm=np.asarray(nimg,dtype=np.float32)[:,:,:3]/255*2-1
 norm[:,:,1]*=-1
 n=norm/(np.linalg.norm(norm,axis=2)[:,:,None]+.00001)
 h,w=src.shape[:2];y,x=np.mgrid[0:h,0:w].astype(np.float32);x/=w;y=1-y/h
 lum=np.mean(src[:,:,:3],axis=2) if name=='air-max' else np.ones((h,w))*.85
 light=np.array([-.5,.7,.8]);light=light/np.linalg.norm(light)
 ndot=np.maximum(0,np.sum(n*light,axis=2))
 band=np.sin(n[:,:,1]*5.5+n[:,:,0]*2.8+y*2.1+.35)
 chrome=.1+.77*smooth(-.22,.16,band)+ndot**20*.8+np.maximum(0,1-np.abs(n[:,:,1]+.25))**30*.2
 chrome*=.78+.4*lum
 silver=chrome[:,:,None]*np.array([.945,1,1.005])
 bx=x*100;by=y*62;bx+=(np.floor(by)%2)*.5
 cx=bx%1-.5;cy=by%1-.5;dist=np.sqrt(cx*cx+cy*cy)
 dome=np.sqrt(np.maximum(0,1-(dist/.46)**2))
 bn=np.dstack((cx*1.9,cy*1.9,dome*.9+.1));bn/=np.linalg.norm(bn,axis=2)[:,:,None]
 l=np.array([-.4,.7,1]);l/=np.linalg.norm(l)
 diffuse=np.maximum(0,np.sum(bn*l,axis=2))
 sl=np.array([-.35,.55,1]);sl/=np.linalg.norm(sl)
 spec=np.maximum(0,np.sum(bn*sl,axis=2))**28
 rim=smooth(.30,.47,dist)**2
 bubble=np.array([.52,.61,.48])*(.34+diffuse*.70)[:,:,None]+spec[:,:,None]*.9
 bubble=bubble*(1-rim[:,:,None]*.65)+np.array([.16,.22,.13])*(rim[:,:,None]*.65)
 bubble+=np.maximum(0,1-np.abs(dist-.4)*35)[:,:,None]**2*.22
 bubble*=((.45+.9*lum)*(.65+.35*np.maximum(n[:,:,2],0)))[:,:,None]
 fx=x*265;fy=y*170
 rand=(np.sin(np.floor(fx)*127.1+np.floor(fy)*311.7)*43758.5453)%1
 pore=np.sqrt((fx%1-.5)**2+(fy%1-.5)**2)
 hole=(1-smooth(.1,.25,pore))*(rand>.28)
 pink=np.array([.94,.59,.67])*(1-hole[:,:,None]*.65)+np.array([.66,.29,.40])*(hole[:,:,None]*.65)
 diffuse=.48+.52*ndot
 pink*= (diffuse*(.88+rand*.18)*(.65+lum*.63))[:,:,None]
 pink+=ndot[:,:,None]**10*.15
 for i,rgb in enumerate((silver,bubble,pink)):
  if name=='air-max':rgb*=((1-.3)+(.45+lum*.8)*.3)[:,:,None]
  out=np.dstack((np.clip(rgb,0,1),src[:,:,3]))
  Image.fromarray((out*255).astype(np.uint8)).save(root/(name+'-material-'+str(i)+'.webp'),quality=90)
render('wordmark','wordmark-normal.png');render('air-max','shoe-normal.png')
print('Six matching material textures ready')
