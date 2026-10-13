#!/usr/bin/env node
/*
 * WHP Sentinel (v2)
 * - Resolves immutable commits for targets
 * - Fetches exact source bytes and computes Git blob SHA and SHA-256
 * - Produces a deterministic canonical receipt (JCS-like stable ordering)
 * - Optionally signs the canonical receipt with Ed25519 when configured via secrets
 * - Writes signed (or explicitly UNSIGNED) receipts to attestations/
 * - Fails closed if required evidence cannot be fetched or verified
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';
import stringify from 'fast-json-stable-stringify';
import nacl from 'tweetnacl';

const GITHUB_API = 'https://api.github.com';
const WHP_URL = process.env.WHP_URL || 'https://standing-guard-service.lovable.app';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.SENTINEL_GITHUB_TOKEN || '';

const AUDIT_TARGETS = [
  {
    target_id: 'coinbase-agentkit',
    subject: 'coinbase/agentkit',
    target_repo: 'https://github.com/coinbase/agentkit',
    tier: 'Claim',
    claim: 'AgentKit codebase enforces fail-closed execution barriers across action providers',
    // authority may include @ref (branch, tag or commit sha)
    provenance: {
      source: 'https://github.com/coinbase/agentkit',
      authority: 'coinbase/agentkit@main',
      evidence: [
        { uri: 'README.md' }
      ]
    }
  },
  {
    target_id: 'whp-standing-gate',
    subject: 'wheelerhubbell/standing-gate',
    target_repo: 'https://github.com/wheelerhubbell/standing-gate',
    tier: 'Claim',
    claim: 'Standing Gate v0.1.2 discovers dynamic verification keys and produces fail-closed output',
    provenance: {
      source: 'https://github.com/wheelerhubbell/standing-gate',
      authority: 'wheelerhubbell/standing-gate@v0.1.2',
      evidence: [ { uri: 'action.yml' } ]
    }
  },
  {
    target_id: 'whp-sentinel-template',
    subject: 'wheelerhubbell/whp-sentinel-template',
    target_repo: 'https://github.com/wheelerhubbell/whp-sentinel-template',
    tier: 'Claim',
    claim: 'Template repository provides plug-and-play Decision Integrity evaluation workflow for agents',
    provenance: {
      source: 'https://github.com/wheelerhubbell/whp-sentinel-template',
      authority: 'wheelerhubbell/whp-sentinel-template@main',
      evidence: [ { uri: 'README.md' } ]
    }
  }
];

function canonicalize(obj) {
  // Use fast-json-stable-stringify to provide deterministic JSON ordering (JCS-like)
  return stringify(obj);
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function gitBlobShaHex(buf) {
  // git blob header: `blob {size}\0` + content, then sha1
  const header = `blob ${buf.length}\0`;
  const h = crypto.createHash('sha1');
  h.update(Buffer.from(header, 'utf8'));
  h.update(buf);
  return h.digest('hex');
}

async function githubApiGet(pathSuffix) {
  const url = `${GITHUB_API}${pathSuffix}`;
  const headers = { 'User-Agent': 'WHP-Sentinel/1.0' };
  if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`GitHub API GET ${url} => ${res.status} ${res.statusText}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchRawContent(owner, repo, ref, pathInRepo) {
  // Use contents endpoint with raw accept
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(pathInRepo)}?ref=${encodeURIComponent(ref)}`;
  const headers = { 'User-Agent': 'WHP-Sentinel/1.0', Accept: 'application/vnd.github.v3.raw' };
  if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to fetch file ${owner}/${repo}@${ref}:${pathInRepo} => ${res.status} ${res.statusText}: ${txt}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function resolveCommit(owner, repo, refOrSha) {
  // Use commits endpoint. If refOrSha is a full sha, it will succeed. If branch or tag, it will resolve.
  const cleanRef = refOrSha;
  try {
    const data = await githubApiGet(`/repos/${owner}/${repo}/commits/${encodeURIComponent(cleanRef)}`);
    // data.sha is commit
    return data.sha;
  } catch (e) {
    throw new Error(`Unable to resolve commit ${owner}/${repo}@${refOrSha}: ${e.message}`);
  }
}

function makeAttestationId(targetId) {
  return `whp-attest-${targetId}-${Date.now()}`;
}

async function signReceipt(canonicalBytes) {
  const seedB64 = process.env.WHP_SIGNER_SEED_BASE64 || process.env.WHP_SIGNER_PRIVATE_KEY_BASE64 || '';
  const kid = process.env.WHP_SIGNER_KID || 'whp:local-test:key1';
  if (!seedB64) return { signed: false, reason: 'NO_SIGNING_KEY_CONFIGURED' };

  // Accept either 32-byte seed (base64) or 64-byte secretKey (base64)
  const seed = Buffer.from(seedB64, 'base64');
  let keyPair;
  if (seed.length === 32) {
    keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
  } else if (seed.length === 64) {
    // secretKey
    const secretKey = new Uint8Array(seed);
    const pubKey = secretKey.slice(32);
    keyPair = { publicKey: pubKey, secretKey };
  } else {
    throw new Error('Unsupported WHP_SIGNER_SEED_BASE64 length; expect 32 (seed) or 64 (secretKey) bytes base64');
  }

  const sig = nacl.sign.detached(new Uint8Array(Buffer.from(canonicalBytes)), keyPair.secretKey);
  return {
    signed: true,
    signature: Buffer.from(sig).toString('base64'),
    public_key: Buffer.from(keyPair.publicKey).toString('base64'),
    alg: 'Ed25519',
    kid
  };
}

async function buildReceiptForTarget(target) {
  // Parse authority like owner/repo@ref
  const authority = target.provenance && target.provenance.authority ? target.provenance.authority : target.subject + '@main';
  const atIdx = authority.indexOf('@');
  let repoSpec = authority;
  let ref = 'main';
  if (atIdx !== -1) {
    repoSpec = authority.substring(0, atIdx);
    ref = authority.substring(atIdx + 1) || 'main';
  }
  const [owner, repo] = repoSpec.split('/');
  if (!owner || !repo) throw new Error(`Invalid authority repo: ${repoSpec}`);

  // Resolve commit sha
  const commitSha = await resolveCommit(owner, repo, ref);

  const subjects = [];
  for (const ev of (target.provenance.evidence || [])) {
    // ev.uri may be a path or a full URL; support simple file path
    let pathInRepo = ev.uri;
    // If a URL, extract path after /blob/<ref>/
    if (ev.uri.startsWith('http')) {
      try {
        const u = new URL(ev.uri);
        // path like /owner/repo/blob/<ref>/path... -> extract after .../blob/<ref>/
        const parts = u.pathname.split('/');
        const blobIdx = parts.indexOf('blob');
        if (blobIdx !== -1 && parts.length > blobIdx + 2) {
          // parts[0] is empty
          pathInRepo = parts.slice(blobIdx + 2).join('/');
        } else {
          // fallback: last segment
          pathInRepo = parts.pop();
        }
      } catch (e) {
        // leave as-is
      }
    }

    // Fetch exact blob at commit
    const bytes = await fetchRawContent(owner, repo, commitSha, pathInRepo);
    const sha256 = sha256Hex(bytes);
    const blobSha = gitBlobShaHex(bytes);

    subjects.push({ path: pathInRepo, repo: `${owner}/${repo}`, commit: commitSha, blob_sha: blobSha, sha256 });
  }

  return {
    subjects,
    evaluator: { repository: process.env.GITHUB_REPOSITORY || 'wheelerhubbell/wheelerhubbell.github.io', commit: process.env.GITHUB_SHA || 'unavailable' }
  };
}

async function run() {
  const now = new Date();
  const timestamp = now.toISOString();
  const attestationsDir = path.resolve('attestations');
  await fsPromises.mkdir(attestationsDir, { recursive: true });

  const cycleRecords = [];

  for (const target of AUDIT_TARGETS) {
    try {
      console.log(`Evaluating ${target.subject} ...`);

      // Build payload for evaluator (same as before)
      const payload = { subject: target.subject, claim: target.claim, provenance: target.provenance };

      // Run evaluator door
      const headers = { 'Content-Type': 'application/json' };
      if (!process.argv.includes('--live')) headers['X-Mock'] = 'true';
      if (process.env.WHP_PAYMENT_KEY) headers['X-Payment-Key'] = process.env.WHP_PAYMENT_KEY;

      const res = await fetch(`${WHP_URL}/v1/evaluate`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Evaluator returned ${res.status} ${res.statusText}`);
      const evalResult = await res.json();

      // Real source evidence: resolve commits and fetch bytes
      const evidenceInfo = await buildReceiptForTarget(target);

      // Build receipt
      const attestationId = makeAttestationId(target.target_id);
      const receipt = {
        schema: 'WHP-RECEIPT-v1',
        receipt_id: attestationId,
        issued_at: timestamp,
        publisher: { engine: 'https://wheelerhubbell.github.io', repository: process.env.GITHUB_REPOSITORY || null },
        issuer: { name: 'WHP Sentinel', kid: process.env.WHP_SIGNER_KID || null },
        evaluator: evidenceInfo.evaluator,
        subject: { id: target.subject, claim: target.claim, tier: target.tier, target_repo: target.target_repo },
        provenance: target.provenance,
        subjects: evidenceInfo.subjects,
        evaluation: evalResult
      };

      // Canonicalize
      const canonical = canonicalize(receipt);

      // Sign if configured
      const signResult = await signReceipt(canonical);

      const envelope = { receipt, canonical, signed: signResult.signed, signature: signResult.signed ? { alg: signResult.alg, sig: signResult.signature, pub: signResult.public_key, kid: signResult.kid } : { reason: signResult.reason } };

      // Persist
      const fileName = `${attestationId}.json`;
      const filePath = path.join(attestationsDir, fileName);
      await fsPromises.writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf8');
      console.log(`Wrote receipt: ${filePath}`);

      // Update latest pointer as before
      const latestPath = path.join(attestationsDir, `${target.target_id}-latest.json`);
      await fsPromises.writeFile(latestPath, JSON.stringify(envelope, null, 2), 'utf8');

      cycleRecords.push({ target_id: target.target_id, receipt_file: fileName, receipt_id: attestationId, signed: signResult.signed });

    } catch (e) {
      console.error(`Audit failed for ${target.subject}: ${e.message}`);
      // Fail closed: abort the whole run
      process.exitCode = 2;
      throw e;
    }
  }

  // Update index
  const indexPath = path.join(attestationsDir, 'index.json');
  let history = [];
  if (fs.existsSync(indexPath)) {
    try { history = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (e) { history = []; }
  }
  const updated = [...cycleRecords, ...history].slice(0, 100);
  fs.writeFileSync(indexPath, JSON.stringify(updated, null, 2), 'utf8');

  // Generate LATEST_AUDIT.md
  const mdPath = path.join(attestationsDir, 'LATEST_AUDIT.md');
  let md = `# Latest WHP Decision Integrity Audit Summary\n\n`;
  md += `**Timestamp:** \`${timestamp}\`  \n`;
  md += `**Engine:** [Wheeler Hubbell Publishing](https://wheelerhubbell.github.io)  \n`;
  md += `**Evaluator Door:** \`/v1/evaluate\`  \n\n`;
  md += `| Target Subject | Tier | Signed | Verifiable Record |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  for (const r of cycleRecords) {
    md += `| ${r.target_id} | ${AUDIT_TARGETS.find(t=>t.target_id===r.target_id).tier} | ${r.signed ? '✅' : '⚠️ UNSIGNED'} | [${r.receipt_file}](./${r.receipt_file}) |\n`;
  }
  fs.writeFileSync(mdPath, md, 'utf8');

  console.log('Run complete.');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('sentinel.mjs')) {
  run().catch(e=>{ console.error(e); process.exit(1); });
}
