"""Execute a caller-installed public verifier in a read-only networkless sandbox.
Never imports a producer/SDK module into the independent verifier.
"""
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from .core import need, bytehash, VERIFIER, strict_json

SUPPORTED = {VERIFIER, 'bb8cb78205f1892dcbf00d845cf85e504a0efacf2a0d8a793313fa8c0e99b833'}


def verify_offline(raw, *, root_pin, verifier_path, runtime_directory, registry_raw=None, resolution_raw=None, at=None):
    need(isinstance(root_pin,str) and len(root_pin)==64 and all(c in '0123456789abcdef' for c in root_pin), 'ADMITTED_ROOT_REQUIRED')
    path=Path(verifier_path); need(not path.is_symlink() and path.is_file(),'VERIFIER_PATH')
    result=strict_json(raw); expected=result['payload']['protocol']['verifier_sha256']
    need(expected in SUPPORTED and bytehash(path.read_bytes())==expected,'VERIFIER_SOURCE_MISMATCH')
    runtime=Path(runtime_directory).resolve(); need((runtime/'bin/python').exists(),'ISOLATED_RUNTIME_REQUIRED')
    need(shutil.which('bwrap') is not None,'SANDBOX_UNAVAILABLE')
    with tempfile.TemporaryDirectory(prefix='whp-verify-') as td:
        p=Path(td); (p/'mark.json').write_bytes(raw)
        args=['bwrap','--unshare-all','--die-with-parent','--ro-bind','/usr','/usr','--ro-bind','/lib','/lib','--ro-bind','/lib64','/lib64','--ro-bind',str(runtime),'/runtime','--ro-bind',str(path.resolve()),'/verifier.py','--ro-bind',td,'/input','--tmpfs','/tmp','--proc','/proc','--dev','/dev','--chdir','/input','--clearenv','--setenv','PYTHONDONTWRITEBYTECODE','1','/runtime/bin/python','/verifier.py','/input/mark.json','--root-pin',root_pin]
        for flag,data in [('registry',registry_raw),('resolution',resolution_raw)]:
            if data is not None:
                (p/(flag+'.json')).write_bytes(data); args += ['--'+flag,'/input/'+flag+'.json']
        if at is not None: args += ['--at',str(at)]
        base=(runtime/'bin/python').resolve().parent.parent
        if base!=Path('/usr') and not str(base).startswith('/usr/'):
            need(str(base).startswith('/opt/hostedtoolcache/Python/'), 'UNSUPPORTED_PYTHON_RUNTIME')
            args[1:1]=['--ro-bind',str(base),str(base)]
        run=subprocess.run(args,capture_output=True,timeout=30)
        need(len(run.stdout)<=100000,'VERIFIER_OUTPUT_TOO_LARGE')
        try: report=strict_json(run.stdout)
        except Exception: raise ValueError('VERIFIER_EXECUTION_FAILED:'+run.stderr.decode(errors='replace')[:500])
        need(run.returncode==0 and report.get('verified') is True,'VERIFICATION_FAILED:'+str(report.get('error','UNKNOWN')))
        # No RPC/network is enabled in this runner. Finality is honestly NOT_RECHECKED.
        return {'signed_payload':result['payload'],'report':report}
