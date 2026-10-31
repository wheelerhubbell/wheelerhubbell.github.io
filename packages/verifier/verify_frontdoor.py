#!/usr/bin/env python3
"""Verify a WHP Standing front-door record (WHP-FRONTDOOR-EVALUATION-v1).

Front-door records are signed standing records, not sealed Marks. Use
verify_mark.py for sealed Marks. This script checks only:
  1. record_hash == sha256 hex of the canonical record
  2. the Ed25519 signature over the canonical record
  3. (optional) the signing key matches the key the service advertises now
It does not check payment finality or current standing.

Requires Python >=3.9 and cryptography.
Usage: verify_frontdoor.py RECORD.json [--origin https://api.wheelerhubbellpublishing.com] [--offline]
"""
import argparse, base64, hashlib, json, sys, urllib.request
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

def canonical(x):
    return json.dumps(x, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()

def b64u(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def fetch_advertised_key(origin):
    """Return the issuer key the service advertises now, failing closed.

    Reads GET {origin}/v1/verification and requires an exact shape:
    authoritative_public_key with alg "Ed25519" and a base64url key that
    decodes to exactly 32 valid bytes. Any other response shape raises, so
    a changed or spoofed response is reported as an error and can never be
    mistaken for a key match. Key rotation is normal: a historical record
    signed under a retired key verifies hash and signature while
    key_matches_service is false.
    """
    req = urllib.request.Request(origin.rstrip("/") + "/v1/verification", headers={"accept": "application/json", "user-agent": "whp-verify-frontdoor/2"})
    with urllib.request.urlopen(req, timeout=20) as r:
        body = json.load(r)
    apk = body["authoritative_public_key"]
    if apk.get("alg") != "Ed25519":
        raise ValueError("advertised key is not Ed25519")
    if len(b64u(apk["public_key_b64url"])) != 32:
        raise ValueError("advertised key is not 32 bytes")
    Ed25519PublicKey.from_public_bytes(b64u(apk["public_key_b64url"]))
    return apk["public_key_b64url"]

def verify(env, origin=None):
    out = {"verified": False, "checks": {}}
    try:
        rec, sig = env["record"], env["signature"]
        if rec.get("type") != "WHP-FRONTDOOR-EVALUATION-v1":
            out["error"] = "not a front-door record (sealed Marks use verify_mark.py)"
            return out
        c = canonical(rec)
        out["checks"]["record_hash"] = hashlib.sha256(c).hexdigest() == env.get("record_hash")
        try:
            Ed25519PublicKey.from_public_bytes(b64u(sig["public_key_b64url"])).verify(b64u(sig["value_b64url"]), c)
            out["checks"]["signature"] = True
        except Exception:
            out["checks"]["signature"] = False
        if origin:
            adv = fetch_advertised_key(origin)
            out["checks"]["key_matches_service"] = adv == sig["public_key_b64url"]
        out["not_sealed_mark"] = rec.get("not_sealed_mark")
        out["valid_until"] = rec.get("valid_until")
        out["verified"] = all(out["checks"].values())
    except Exception as e:
        out["error"] = repr(e)
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("record")
    ap.add_argument("--origin", default="https://api.wheelerhubbellpublishing.com")
    ap.add_argument("--offline", action="store_true", help="skip the live signer-key comparison")
    a = ap.parse_args()
    res = verify(json.load(open(a.record)), None if a.offline else a.origin)
    print(json.dumps(res, indent=2))
    sys.exit(0 if res["verified"] else 1)
