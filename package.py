#!/usr/bin/env python3
import json, pathlib, shutil, zipfile, hashlib, datetime
root=pathlib.Path(__file__).resolve().parent
dist=root/'dist'; stage=dist/'ams-agent-music-0.2.0'
if dist.exists(): shutil.rmtree(dist)
stage.mkdir(parents=True)
for name in ['package.json','lib','skills','asr.py','README.md','CHANGELOG.md','INSTALL.md']:
 s=root/name; d=stage/name
 if s.is_dir(): shutil.copytree(s,d)
 else: shutil.copy2(s,d)
shutil.copytree(root/'bundle',stage/'bundle')
pkg=json.load(open(root/'package.json',encoding='utf-8'))
manifest={'name':pkg['name'],'version':pkg['version'],'skill':'ams-music-processing','tools':pkg['ams']['tools'],'asr':'local Vosk','bundle':'@ams/agent-music-bundle','built_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(stage/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
zip_path=dist/f"ams-agent-music-{pkg['version']}.zip"
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for p in stage.rglob('*'):
  if p.is_file(): z.write(p,p.relative_to(stage).as_posix())
h=hashlib.sha256(zip_path.read_bytes()).hexdigest()
(dist/'SHA256SUMS.txt').write_text(f"{h}  {zip_path.name}\n",encoding='ascii')
print('zip',zip_path,zip_path.stat().st_size)
print('sha256',h)
