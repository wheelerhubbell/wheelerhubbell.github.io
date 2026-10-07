"""Inspect exact packed files without executing or extracting untrusted archives."""
import json
import tarfile
import zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
npm=list((ROOT/'sdk/typescript').glob('*.tgz'))
assert len(npm)==1,'ONE_NPM_ARTIFACT_REQUIRED'
with tarfile.open(npm[0]) as t:
 names=t.getnames();assert all(m.isfile() for m in t.getmembers()),'ARCHIVE_LINK_OR_DIRECTORY'
 assert set(names)=={'package/README.md','package/package.json','package/dist/index.js','package/dist/index.d.ts'},'NPM_FILE_ALLOWLIST'
 for m in t.getmembers():
  assert len(t.extractfile(m).read())<100000,'NPM_ENTRY_SIZE'
wheel=list((ROOT/'sdk/python/dist').glob('*.whl'));sdist=list((ROOT/'sdk/python/dist').glob('*.tar.gz'))
assert len(wheel)==len(sdist)==1,'ONE_PYTHON_ARTIFACT_REQUIRED'
modules={'__init__.py','core.py','client.py','verification.py'}
with zipfile.ZipFile(wheel[0]) as z:
 names=z.namelist()
 assert {n for n in names if n.startswith('whp_standing/')}=={'whp_standing/'+m for m in modules},'WHEEL_MODULE_ALLOWLIST'
 assert all(n.startswith('whp_standing/') or n.startswith('whp_standing_client-0.1.0.dist-info/') for n in names),'WHEEL_PATH_ALLOWLIST'
 assert not any('..' in n or n.startswith('/') or (z.getinfo(n).external_attr>>16)&0o170000==0o120000 for n in names),'WHEEL_PATH_ESCAPE'
with tarfile.open(sdist[0]) as t:
 allowed={'src/whp_standing/'+m for m in modules}|{'README.md','pyproject.toml','PKG-INFO','.gitignore'}
 assert all(m.isfile() and m.name.split('/',1)[-1] in allowed for m in t.getmembers()),'SDIST_ALLOWLIST'
print(json.dumps({'packed_files':'ALLOWLIST_PASS','npm':'4 files','python':'4 modules plus metadata','private_paths':'NONE','links':'NONE'}))
