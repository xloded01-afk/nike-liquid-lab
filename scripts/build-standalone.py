"""Build a portable, offline HTML without a server or module/CORS restrictions."""
from pathlib import Path
import base64, re, mimetypes
ROOT=Path(__file__).resolve().parents[1]
dist=ROOT/'dist'
def uri(name):
    file=dist/name
    mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
    return 'data:'+mime+';base64,'+base64.b64encode(file.read_bytes()).decode()
html=(dist/'index.html').read_text(encoding='utf8')
css=(dist/'styles.css').read_text(encoding='utf8')
css=re.sub(r"url\('(assets/[^']+)'\)",lambda m:"url('"+uri(m[1])+"')",css)
html=re.sub(r'<link rel="stylesheet" href="styles\.css(?:\?[^"]*)?">',lambda m:'<style>'+css+'</style>',html)
html=re.sub(r'(src|href)="(assets/[^"]+)"',lambda m:m[1]+'="'+uri(m[2])+'"',html)
vendor=(dist/'vendor/lenis.js').read_text(encoding='utf8')
vendor=re.sub(r'export \{[^}]+\};?', '', vendor)
js=vendor+'\n'+(dist/'scroll-text.js').read_text(encoding='utf8').replace('export class','class').replace('export function','function')+'\n'+(dist/'jet-input.js').read_text(encoding='utf8').replace('export class','class')+'\n'+(dist/'app.js').read_text(encoding='utf8')
js=js.replace("import Lenis from './vendor/lenis.js';", '')
js=re.sub(r"import \{ installScrollText \} from './scroll-text\.js(?:\?[^']*)?';",'',js)
js=js.replace("import { JetInput } from './jet-input.js';",'').replace('export const ready','const ready').replace('export { engine, CONFIG };','')
assets={file.name:uri('assets/'+file.name) for file in (dist/'assets').iterdir() if file.suffix in ['.png','.webp'] and ('wordmark' in file.name or file.name in ['air-max.png','shoe-normal.png'])}
import json
js='const embeddedAssets='+json.dumps(assets)+';\n'+js
js=js.replace("img.src='assets/'+file;",'img.src=embeddedAssets[file];')
js=js.replace('`assets/wordmark-material-${id}.webp`','embeddedAssets[`wordmark-material-${id}.webp`]')
js=js.replace('`assets/wordmark-material-${selectedMaterial}.webp`', 'embeddedAssets[`wordmark-material-${selectedMaterial}.webp`]').replace(":'assets/wordmark.png'",":embeddedAssets['wordmark.png']")
html=re.sub(r'<script type="module" src="app\.js(?:\?[^"]*)?"></script>',lambda m:'<script>'+js+'</script>',html)
(ROOT/'Liquid Lab.html').write_text(html,encoding='utf8')
print('Built Liquid Lab.html:',len(html.encode('utf8')),'bytes')
