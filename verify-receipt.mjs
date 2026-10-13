#!/usr/bin/env node
/**
 * verify-receipt.mjs
 * Standalone verifier for WHP receipts.
 * Usage:
 *   node verify-receipt.mjs ./attestations/<receipt>.json --trusted-pub-b64 <base64>
 * Environment options:
 *   TRUSTED_PUBKEY_B64 - base64 Ed25519 public key to trust
 *   GITHUB_TOKEN - GitHub token to fetch repository blobs when verifying
 * Notes:
 *  - This verifier REQUIRES an externally provided trusted public key when verifying signed receipts.
 *  - It does NOT trust the public key embedded in the receipt.
 */

import fs from 'fs/promises';
import crypto from 'crypto';
import fetch from 'node-fetch';
import stringify from 'fast-json-stable-stringify';
import nacl from 'tweetnacl';

function canonicalize(obj) {
  return stringify(obj);
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function gitBlobShaHex(buf) {
  const header = `blob ${buf.length}\0`;
  const h = crypto.createHash('sha1');
  h.update(Buffer.from(header, 'utf8'));
  h.update(buf);
  return h.digest('hex');
}

async function fetchRawContent(owner, repo, ref, pathInRepo, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(pathInRepo)}?ref=${encodeURIComponent(ref)}`;
  const headers = { 'User-Agent': 'WHP-Receipt-Verifier/1.0', Accept: 'application/vnd.github.v3.raw' };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to fetch file ${owner}/${repo}@${ref}:${pathInRepo} => ${res.status} ${res.statusText}: ${txt}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function verifyEnvelope(envelope, options = {}) {
  const { trustedPubkeyB64, githubToken, requireSigned = false } = options;

  if (!envelope || !envelope.receipt) throw new Error('Invalid envelope: missing receipt');
  const receipt = envelope.receipt;

  // Recompute canonical form
  const canonicalLocal = canonicalize(receipt);
  if (envelope.canonical !== canonicalLocal) {
    return { ok: false, reason: 'CANONICAL_MISMATCH', detail: { expected: envelope.canonical, actual: canonicalLocal } };
  }

  // If envelope claims signed, verify signature using trusted public key; do NOT trust embedded pub key
  if (envelope.signed) {
    if (!envelope.signature || !envelope.signature.sig) return { ok: false, reason: 'MALFORMED_SIGNATURE' };
    const sig = Buffer.from(envelope.signature.sig, 'base64');

    if (!trustedPubkeyB64) {
      return { ok: false, reason: 'NO_TRUSTED_PUBKEY' };
    }

    const trustedPub = Buffer.from(trustedPubkeyB64, 'base64');
    const verified = nacl.sign.detached.verify(new Uint8Array(Buffer.from(canonicalLocal)), new Uint8Array(sig), new Uint8Array(trustedPub));
    if (!verified) return { ok: false, reason: 'INVALID_SIGNATURE' };

    // Validate key identifier if provided in receipt issuer.kid: ensure it matches known mapping etc.
    if (receipt.issuer && receipt.issuer.kid) {
      const kid = receipt.issuer.kid;
      // The mapping from kid -> pubkey is out-of-band. If options.trustedKid is provided, require equality.
      if (options.trustedKid && options.trustedKid !== kid) return { ok: false, reason: 'KID_MISMATCH', detail: { expected: options.trustedKid, actual: kid } };
    }
  } else {
    // Unsigned envelope;
    if (requireSigned) return { ok: false, reason: 'UNSIGNED' };
  }

  // Verify each subject's blob and digest
  const subjects = receipt.subjects || [];
  const subjectResults = [];
  for (const s of subjects) {
    const [owner, repo] = s.repo.split('/');
    if (!owner || !repo) {
      subjectResults.push({ subject: s, ok: false, reason: 'INVALID_REPO' });
      continue;
    }
    try {
      const bytes = await fetchRawContent(owner, repo, s.commit, s.path, githubToken || process.env.GITHUB_TOKEN);
      const sha256 = sha256Hex(bytes);
      const blobSha = gitBlobShaHex(bytes);
      const ok = sha256 === s.sha256 && blobSha === s.blob_sha;
      subjectResults.push({ subject: s, ok, computed: { sha256, blob_sha: blobSha }, expected: { sha256: s.sha256, blob_sha: s.blob_sha } });
    } catch (e) {
      subjectResults.push({ subject: s, ok: false, reason: 'FETCH_FAILED', error: e.message });
    }
  }

  const allSubjectsOk = subjectResults.length === 0 ? true : subjectResults.every(r => r.ok);
  if (!allSubjectsOk) return { ok: false, reason: 'SUBJECT_MISMATCH', subjectResults };

  return { ok: true, reason: 'VERIFIED', subjectResults };
}

// CLI
if (process.argv[1].endsWith('verify-receipt.mjs') || import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const argv = process.argv.slice(2);
      if (argv.length < 1) {
        console.error('Usage: node verify-receipt.mjs <envelope.json> [--trusted-pub-b64 <b64> --trusted-kid <kid> --require-signed]');
        process.exit(2);
      }
      const file = argv[0];
      let trustedPubkeyB64 = process.env.TRUSTED_PUBKEY_B64 || null;
      let trustedKid = process.env.TRUSTED_KID || null;
      let requireSigned = false;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === '--trusted-pub-b64' && argv[i+1]) { trustedPubkeyB64 = argv[i+1]; i++; }
        else if (argv[i] === '--trusted-pub' && argv[i+1]) { trustedPubkeyB64 = (await fs.readFile(argv[i+1], 'utf8')).trim(); i++; }
        else if (argv[i] === '--trusted-kid' && argv[i+1]) { trustedKid = argv[i+1]; i++; }
        else if (argv[i] === '--require-signed') { requireSigned = true; }
      }
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      const result = await verifyEnvelope(data, { trustedPubkeyB64, trustedKid, githubToken: process.env.GITHUB_TOKEN, requireSigned });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 3);
    } catch (e) {
      console.error('verify error', e);
      process.exit(1);
    }
  })();
}
