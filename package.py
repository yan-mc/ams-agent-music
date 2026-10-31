#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build 嘉音Studio agent-music dist: raw package tree + npm-style tgz packages + zip."""
import json, pathlib, shutil, tarfile, zipfile, hashlib, datetime

root = pathlib.Path(__file__).resolve().parent
dist = root / 'dist'
pkg = json.loads((root / 'package.json').read_text(encoding='utf-8'))
client_pkg = json.loads((root / 'client' / 'package.json').read_text(encoding='utf-8'))
bundle_pkg = json.loads((root / 'bundle' / 'package.json').read_text(encoding='utf-8'))
mode_pkg = json.loads((root / 'mode' / 'package.json').read_text(encoding='utf-8'))
ver = pkg['version']
stage = dist / f'ams-agent-music-{ver}'
if dist.exists():
    shutil.rmtree(dist)
stage.mkdir(parents=True)

HOST_FILES = ['package.json', 'lib', 'skills', 'asr.py', 'README.md', 'CHANGELOG.md', 'INSTALL.md', 'FEATURES.md']
for name in HOST_FILES:
    s = root / name
    if not s.exists():
        continue
    d = stage / name
    if s.is_dir():
        shutil.copytree(s, d)
    else:
        shutil.copy2(s, d)

def copy_pkg(src_dir, dst_dir, files):
    dst_dir.mkdir(parents=True, exist_ok=True)
    for name in files:
        s = src_dir / name
        if not s.exists():
            continue
        d = dst_dir / name
        if s.is_dir():
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

copy_pkg(root / 'client', stage / 'client', ['package.json', 'lib', 'README.md'])
copy_pkg(root / 'bundle', stage / 'bundle', ['package.json', 'cordis.patch.yml', 'README.md'])
copy_pkg(root / 'mode', stage / 'mode', ['package.json', 'lib', 'README.md'])

manifest = {
    'name': pkg['name'], 'version': ver, 'skill': 'ams-music-processing',
    'tools': pkg['ams']['tools'], 'asr': 'local Vosk (auto-detected deps)',
    'bundle': '@ams/agent-music-bundle', 'client': '@ams/agent-music-ui', 'mode': '@ams/agent-music-mode',
    'preset': '音乐制作 (ams-music)', 'wallpaper': '嘉音Studio wallpaper (embedded in client)',
    'rebrand': 'Kernel title/logo/text -> 嘉音Studio',
    'built_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
(stage / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

tgz_dir = stage / 'tgz'
tgz_dir.mkdir()

def make_tgz(name, version, base, files):
    out = tgz_dir / f'{name}-{version}.tgz'
    with tarfile.open(out, 'w:gz') as tf:
        def add(rel):
            src = base / rel
            if not src.exists():
                return
            if src.is_dir():
                for p in sorted(src.rglob('*')):
                    if p.is_file():
                        arc = 'package/' + str(p.relative_to(base)).replace('\\', '/')
                        ti = tf.gettarinfo(str(p), arcname=arc)
                        ti.uid = ti.gid = 0
                        ti.uname = ti.gname = ''
                        with open(p, 'rb') as fh:
                            tf.addfile(ti, fh)
            else:
                arc = 'package/' + str(src.relative_to(base)).replace('\\', '/')
                ti = tf.gettarinfo(str(src), arcname=arc)
                ti.uid = ti.gid = 0
                ti.uname = ti.gname = ''
                with open(src, 'rb') as fh:
                    tf.addfile(ti, fh)
        for name in files:
            add(name)
    return out

host_files = [n for n in HOST_FILES if n != 'package.json']
make_tgz('ams-agent-music', ver, root, ['package.json'] + host_files)
make_tgz('ams-agent-music-ui', client_pkg['version'], root / 'client', ['package.json', 'lib', 'README.md'])
make_tgz('ams-agent-music-bundle', bundle_pkg['version'], root / 'bundle', ['package.json', 'cordis.patch.yml', 'README.md'])
make_tgz('ams-agent-music-mode', mode_pkg['version'], root / 'mode', ['package.json', 'lib', 'README.md'])

zip_path = dist / f"ams-agent-music-{ver}.zip"
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in stage.rglob('*'):
        if p.is_file():
            z.write(p, p.relative_to(stage).as_posix())
h = hashlib.sha256(zip_path.read_bytes()).hexdigest()
(dist / 'SHA256SUMS.txt').write_text(f'{h}  {zip_path.name}\n', encoding='ascii')
print('zip', zip_path, zip_path.stat().st_size)
print('sha256', h)
print('tgz', [(p.name, p.stat().st_size) for p in sorted(tgz_dir.glob("*.tgz"))])
