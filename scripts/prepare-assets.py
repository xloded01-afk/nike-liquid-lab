"""Prepare source product imagery and procedural logo normal maps."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter
root=Path(__file__).resolve().parents[1]/'dist/assets'

def normals(im, path, strength=1.0, detailed=False):
    a=np.asarray(im.getchannel('A'),dtype=np.float32)/255
    d=distance_transform_edt(a>.5)
    shape=gaussian_filter(np.sqrt(np.maximum(d,0))*7,2)
    if detailed:
        rgb=np.asarray(im.convert('RGB'),dtype=np.float32)/255
        lum=np.mean(rgb,axis=2)
        shape+=gaussian_filter(lum,1.2)*5
    dy,dx=np.gradient(shape)
    n=np.dstack((-dx*strength,-dy*strength,np.ones_like(dx)))
    n/=np.linalg.norm(n,axis=2)[:,:,None]
    out=np.dstack(((n*.5+.5)*255,a*255)).astype(np.uint8)
    Image.fromarray(out).save(path)

# Download the source only when explicitly re-running this optional preparation script.
import urllib.request
if not (root/'airmax-2.png').exists():
    urllib.request.urlretrieve('https://static.nike.com/a/images/f6241423-e2e1-4779-8f6c-5f6f3d4ae618/NIKE+AIR+MAX+90.png', root/'airmax-2.png')
im=Image.open(root/'airmax-2.png').convert('RGBA')
bb=im.getchannel('A').getbbox()
im=im.crop(bb)
im.thumbnail((1500,1000),Image.Resampling.LANCZOS)
im=im.rotate(-14,Image.Resampling.BICUBIC,expand=True)
bb=im.getchannel('A').getbbox();im=im.crop(bb)
border=50
out=Image.new('RGBA',(im.width+border*2,im.height+border*2));out.paste(im,(border,border))
out.save(root/'air-max.png',optimize=True)
normals(out,root/'shoe-normal.png',.65,True)
# Transparent straight view for the detail section.
im=Image.open(root/'airmax-2.png').convert('RGBA'); im=im.crop(im.getchannel('A').getbbox());im.thumbnail((1100,650));im.save(root/'air-max-side.png')
# Custom typography, rather than a copyrighted font file from the reference.
f=ImageFont.truetype('/usr/share/fonts/opentype/urw-base35/NimbusSans-BoldItalic.otf',600)
logo=Image.new('RGBA',(2200,850));d=ImageDraw.Draw(logo);d.text((70,-60),'NIKE',font=f,fill='white',stroke_width=12)
logo=logo.crop(logo.getchannel('A').getbbox()).resize((1600,530),Image.Resampling.LANCZOS)
logo.save(root/'wordmark.png'); normals(logo,root/'wordmark-normal.png',1.3)
# Compact source imagery.
for name in ('airmax-0.png','airmax-1.png'):
 if (root/name).exists():
  im=Image.open(root/name); im.thumbnail((850,1063));im.save(root/(name.replace('.png','.webp')),quality=86)
for name in ('airmax-0.png','airmax-1.png','airmax-2.png'):
 if (root/name).exists(): (root/name).unlink()
print('Asset dimensions:',out.size,logo.size)
