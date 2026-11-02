"""Smooth the existing pillow normals without changing either logo silhouette."""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
p=Path(__file__).resolve().parents[1]/'dist/assets/wordmark-normal.png'
im=Image.open(p).convert('RGBA')
rgb=im.convert('RGB').filter(ImageFilter.GaussianBlur(7))
n=np.asarray(rgb,dtype=np.float32)/127.5-1
n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),.001)
out=Image.fromarray(np.uint8(np.clip((n*.5+.5)*255,0,255)),'RGB').convert('RGBA')
out.putalpha(im.getchannel('A'));out.save(p)
