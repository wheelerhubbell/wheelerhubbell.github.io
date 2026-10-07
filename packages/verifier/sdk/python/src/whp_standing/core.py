"""Client wire primitives. No producer imports, engine access, or implicit payment."""
import base64
import hashlib
import json
import math
import secrets
import time
from cryptography.hazmat.primitives.serialization import load_der_public_key, Encoding, PublicFormat
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey, Ed25519PrivateKey

PROFILE = '4244be9ed0012eaeba8e2efeb9d274ad3c1f3e188748838c191129054d24c5ab'
CONTRACT = 'dd433c055fe0ad0bdb0326479b3339eea018204ccef44cd6ef247520a29c8e75'
SCHEMA = '17a18f8d7400f010aa02d5e26946b8ae282b00667f5a1ad4d664465042311a54'
VERIFIER = '0980eb6bb156f4251a935a65a6e2ef6c7441fc06de8b2a05f1e57c511d19cb5e'


def need(ok, code):
    if not ok:
        raise ValueError(code)


def canonical(x, depth=0):
    need(depth <= 64, 'JSON_DEPTH')
    if x is None: return 'null'
    if isinstance(x, bool): return 'true' if x else 'false'
    if type(x) is int:
        need(abs(x) <= 9007199254740991, 'INTEGER_RANGE')
        return str(x)
    if isinstance(x, str):
        need(not any(0xD800 <= ord(c) <= 0xDFFF for c in x), 'INVALID_UNICODE')
        return json.dumps(x, ensure_ascii=False, separators=(',', ':'))
    if isinstance(x, list): return '[' + ','.join(canonical(v, depth+1) for v in x) + ']'
    need(isinstance(x, dict) and all(isinstance(k, str) for k in x), 'I_JSON_REQUIRED')
    return '{' + ','.join(canonical(k, depth+1)+':'+canonical(x[k], depth+1) for k in sorted(x, key=lambda k:k.encode('utf-16be'))) + '}'


def bytehash(raw): return hashlib.sha256(raw).hexdigest()
def digest(x): return bytehash(canonical(x).encode())


def strict_json(raw):
    def pairs(items):
        out = {}
        for k, v in items:
            need(k not in out, 'DUPLICATE_JSON_KEY')
            out[k] = v
        return out
    def integer(v):
        need(v != '-0', 'NEGATIVE_ZERO')
        return int(v)
    def invalid(_): raise ValueError('NON_INTEGER_JSON')
    result = json.loads(raw, object_pairs_hook=pairs, parse_int=integer, parse_float=invalid, parse_constant=invalid)
    canonical(result)
    return result


def exact(x, fields): need(isinstance(x, dict) and set(x)==set(fields), 'FIELDS_INVALID')


def b64decode(s):
    b = base64.b64decode(s, validate=True)
    need(base64.b64encode(b).decode()==s, 'BASE64_ENCODING')
    return b


def key_id(public_key): return bytehash(b64decode(public_key))


def unseal(e, kind, public_key):
    exact(e, ['protected', 'payload', 'signature'])
    expected = {'type':kind, 'algorithm':'Ed25519', 'canonicalization':'WHP-JCS-I1', 'key_id':key_id(public_key)}
    need(e['protected']==expected, 'SIGNATURE_CONTEXT')
    raw = b64decode(public_key)
    key = load_der_public_key(raw)
    need(isinstance(key, Ed25519PublicKey) and key.public_bytes(Encoding.DER,PublicFormat.SubjectPublicKeyInfo)==raw, 'ED25519_REQUIRED')
    sig = b64decode(e['signature'])
    need(len(sig)==64, 'SIGNATURE_LENGTH')
    key.verify(sig, canonical({'protected':e['protected'], 'payload':e['payload']}).encode())
    return e['payload']


def seal(payload, kind, private_key):
    need(isinstance(private_key, Ed25519PrivateKey), 'ED25519_REQUIRED')
    public = base64.b64encode(private_key.public_key().public_bytes(Encoding.DER,PublicFormat.SubjectPublicKeyInfo)).decode()
    protected = {'type':kind,'algorithm':'Ed25519','canonicalization':'WHP-JCS-I1','key_id':key_id(public)}
    e = {'protected':protected,'payload':payload}
    e['signature'] = base64.b64encode(private_key.sign(canonical(e).encode())).decode()
    return e


def client_proof(private_key, method, path, body=b'', now=None):
    at = int(time.time()) if now is None else now
    payload = {'method':method, 'path':path, 'body_hash':bytehash(body), 'issued_at':at, 'expires_at':at+120, 'nonce':secrets.token_hex(16)}
    return base64.b64encode(canonical(seal(payload, 'WHP-CLIENT-PROOF-v1', private_key)).encode()).decode()


def trust(bundle, pin, at):
    exact(bundle, ['root_public_key','profile_authorization','certificates','revocations','status_snapshot'])
    need(len(canonical(bundle).encode()) <= 65536, 'TRUST_BUNDLE_TOO_LARGE')
    root = bundle['root_public_key']; need(key_id(root)==pin, 'UNTRUSTED_ROOT')
    pa = unseal(bundle['profile_authorization'], 'WHP-PROFILE-AUTHORIZATION-v1', root)
    exact(pa, ['profile_hash','contract_hash','verifier_sha256','ratified','issuer','environment','valid_from','valid_until'])
    need(pa['profile_hash']==PROFILE and pa['contract_hash']==CONTRACT and pa['verifier_sha256']==VERIFIER and pa['ratified'] is True and pa['valid_from']<=at<pa['valid_until'] and pa['environment']=='LIVE', 'PROFILE_NOT_AUTHORIZED')
    status = unseal(bundle['status_snapshot'], 'WHP-TRUST-STATUS-v1', root)
    exact(status, ['sequence','previous_hash','profile_authorization_hash','certificates_hash','revocations_hash','valid_from','valid_until'])
    need(status['valid_from']<=at<status['valid_until'], 'TRUST_STATUS_EXPIRED')
    need(status['profile_authorization_hash']==digest(bundle['profile_authorization']) and status['certificates_hash']==digest(bundle['certificates']) and status['revocations_hash']==digest(bundle['revocations']), 'TRUST_MANIFEST')
    keys = {}
    for cert in bundle['certificates']:
        c = unseal(cert, 'WHP-AUTHORITY-CERTIFICATE-v1', root)
        exact(c, ['public_key','subject','roles','scopes','jurisdictions','operations','profile_hash','valid_from','valid_until'])
        kid = key_id(c['public_key']); need(kid not in keys and c['profile_hash']==PROFILE, 'CERTIFICATE_INVALID'); keys[kid] = c
    revocations = [unseal(r, 'WHP-KEY-REVOCATION-v1', root) for r in bundle['revocations']]
    return pa, keys, revocations


def admitted(e, kind, role, bundle, pin, at, bounds):
    pa, keys, revocations = trust(bundle, pin, at)
    c = keys.get(e['protected']['key_id']); need(c is not None, 'UNKNOWN_AUTHORITY')
    p = unseal(e, kind, c['public_key'])
    need(role in c['roles'] and c['subject']==pa['issuer'] and c['valid_from']<=at<c['valid_until'], 'AUTHORITY_DENIED')
    need(bounds['scope'] in c['scopes'] and bounds['jurisdiction'] in c['jurisdictions'], 'AUTHORITY_OUT_OF_BOUNDS')
    need(all(op in c['operations'] for op in bounds.get('operations',[])), 'AUTHORITY_OPERATION_DENIED')
    need(not any(r['key_id']==e['protected']['key_id'] and r['effective_at']<=at for r in revocations), 'AUTHORITY_REVOKED')
    return p


def quote_binding(quote, bundle, pin, submission, origin, at):
    s = strict_json(submission)
    q = admitted(quote, 'WHP-STANDING-QUOTE-v1', 'ISSUER', bundle, pin, at, s['bounds'])
    exact(q, ['purchase_id','request_hash','buyer_key','profile_hash','issuer','environment','issued_at','expires_at','resource','payment_requirements','charge_policy'])
    pid = digest({'domain':'WHP-STANDING-PURCHASE-v1','root_pin':pin,'buyer_key':s['buyer_key'],'client_reference':s['client_reference']})
    need(q['purchase_id']==pid and q['request_hash']==digest(s) and q['buyer_key']==s['buyer_key'] and q['profile_hash']==PROFILE and q['environment']=='LIVE' and q['issuer']==bundle['profile_authorization']['payload']['issuer'], 'QUOTE_BINDING')
    need(q['issued_at']<=at+30 and at<q['expires_at'] and q['expires_at']>q['issued_at'], 'QUOTE_EXPIRED')
    need(q['resource']['url']==origin+'/v1/evaluations', 'QUOTE_RESOURCE')
    return q
