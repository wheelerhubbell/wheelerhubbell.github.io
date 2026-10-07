"""Fail-closed public-only source gate. No imports from the engine/verifier."""
import ast
import hashlib
import json
import re
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
EXPECTED={'verify_mark.py':'0980eb6bb156f4251a935a65a6e2ef6c7441fc06de8b2a05f1e57c511d19cb5e','0980eb6bb156f4251a935a65a6e2ef6c7441fc06de8b2a05f1e57c511d19cb5e.py':'0980eb6bb156f4251a935a65a6e2ef6c7441fc06de8b2a05f1e57c511d19cb5e','bb8cb78205f1892dcbf00d845cf85e504a0efacf2a0d8a793313fa8c0e99b833.py':'bb8cb78205f1892dcbf00d845cf85e504a0efacf2a0d8a793313fa8c0e99b833'}
def validate_path(path,root):
 if path.is_symlink():raise ValueError('SYMLINK_REFUSED')
 if not path.resolve().is_relative_to(root.resolve()):raise ValueError('PATH_ESCAPE')
def validate_reference(text):
 if re.search(r'WHPStanding|file:|link:|workspace:|/memory/|/downloads/|/home/|/tmp/whp-sdk-build',text):raise ValueError('PRIVATE_OR_LOCAL_REFERENCE')
def main():
 for name,wanted in EXPECTED.items():
  p=ROOT/name;validate_path(p,ROOT)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==wanted,'VERIFIER_CHANGED'
 for directory in ['sdk/typescript/src','sdk/python/src']:
  for p in (ROOT/directory).rglob('*'):
   validate_path(p,ROOT)
   if p.is_file() and p.suffix in ('.py','.ts'):
    text=p.read_text();validate_reference(text)
    if p.suffix=='.py':
     tree=ast.parse(text)
     for n in ast.walk(tree):
      if isinstance(n,(ast.Import,ast.ImportFrom)):
       modules=[a.name for a in n.names] if isinstance(n,ast.Import) else [n.module or '']
       assert not any('verify_mark' in m or 'producer' in m for m in modules),'FORBIDDEN_IMPORT'
    if p.suffix=='.ts':
     imports=re.findall(r"from\s+['\"]([^'\"]+)",text)
     assert all(m.startswith('node:') or m=='viem' or m.startswith('./') for m in imports),'FORBIDDEN_IMPORT'
 for m in ['sdk/typescript/package.json','sdk/python/pyproject.toml']:
  text=(ROOT/m).read_text();validate_reference(text)
 for name in EXPECTED:
  tree=ast.parse((ROOT/name).read_text())
  for n in ast.walk(tree):
   if isinstance(n,(ast.Import,ast.ImportFrom)):
    modules=[a.name for a in n.names] if isinstance(n,ast.Import) else [n.module or '']
    assert not any('whp_standing' in m or 'producer' in m for m in modules),'VERIFIER_IMPORT_CONTAMINATION'
 # Negative gate checks are executable, not only a static promise.
 for bad in ['file:../../private','workspace:engine','/memory/secret','WHPStanding/src/server.mjs']:
  try:validate_reference(bad)
  except ValueError:pass
  else:raise AssertionError('NEGATIVE_REFERENCE_ACCEPTED')
 try:validate_path(ROOT/'../escape',ROOT)
 except ValueError:pass
 else:raise AssertionError('PATH_ESCAPE_ACCEPTED')
 print(json.dumps({'boundary':'PASS','verifier_hashes':'UNCHANGED','negative_reference_checks':4,'path_escape':'REFUSED'}))
if __name__=='__main__':main()
