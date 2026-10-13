#!/usr/bin/env node
/**
 * WHP Public Autonomous Sentinel & Attestation Generator
 * Evaluates claims across open-source ecosystem repositories and commits
 * cryptographic, independently verifiable attestation records.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const WHP_URL = process.env.WHP_URL || 'https://standing-guard-service.lovable.app';

// Target projects across open agent & web3 infrastructure to evaluate
const AUDIT_TARGETS = [
  {
    target_id: 'coinbase-agentkit',
    subject: 'coinbase/agentkit',
    target_repo: 'https://github.com/coinbase/agentkit',
    tier: 'Claim',
    claim: 'AgentKit codebase enforces fail-closed execution barriers across action providers',
    provenance: {
      source: 'https://github.com/coinbase/agentkit',
      authority: 'coinbase/agentkit@main',
      evidence: [
        {
          uri: 'https://github.com/coinbase/agentkit/blob/main/README.md',
          digest: 'sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        }
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
      evidence: [
        {
          uri: 'https://github.com/wheelerhubbell/standing-gate/blob/main/action.yml',
          digest: 'sha256-8568518deaffc88271d7b598936f95b66794414ae69de29bb2d1d6434b8b29ae'
        }
      ]
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
      evidence: [
        {
          uri: 'https://github.com/wheelerhubbell/whp-sentinel-template/blob/main/README.md',
          digest: 'sha256-9321c6dc5fd544c29bead2deeea69355236358a8f8de9c43b6b658a0dd82c152'
        }
      ]
    }
  }
];

function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

async function run() {
  const isLive = process.argv.includes('--live') || Boolean(process.env.WHP_PAYMENT_KEY);
  const now = new Date();
  const timestamp = now.toISOString();
  const dateStr = timestamp.split('T')[0];

  console.log(`[WHP Sentinel] Starting autonomous attestation cycle (${timestamp})...`);
  console.log(`[WHP Sentinel] Mode: ${isLive ? 'LIVE (x402 Base)' : 'DRY RUN (Structural Audit)'}`);

  const attestationsDir = path.resolve('attestations');
  if (!fs.existsSync(attestationsDir)) {
    fs.mkdirSync(attestationsDir, { recursive: true });
  }

  const cycleRecords = [];

  for (const target of AUDIT_TARGETS) {
    console.log(`\nEvaluating: ${target.subject}`);
    const payload = {
      subject: target.subject,
      claim: target.claim,
      provenance: target.provenance
    };

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (WHP-Witness-Sentinel/1.0)'
    };
    if (!isLive) {
      headers['X-Mock'] = 'true';
    } else if (process.env.WHP_PAYMENT_KEY) {
      headers['X-Payment-Key'] = process.env.WHP_PAYMENT_KEY;
    }

    try {
      const res = await fetch(`${WHP_URL}/v1/evaluate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const evalResult = await res.json();
      const payloadHash = crypto.createHash('sha256').update(canonicalStringify(payload)).digest('hex');
      const resultHash = crypto.createHash('sha256').update(canonicalStringify(evalResult)).digest('hex');

      const attestation = {
        schema: 'WHP-DECISION-INTEGRITY-ATTESTATION-v1',
        attestation_id: `whp-attest-${target.target_id}-${Date.now()}`,
        timestamp,
        target_repo: target.target_repo,
        subject: target.subject,
        tier: target.tier,
        claim: target.claim,
        provenance: target.provenance,
        evaluation: {
          door: '/v1/evaluate',
          type: evalResult.type || 'WHP-EVALUATION-v1',
          structurally_complete: Boolean(evalResult.structurally_complete),
          checks: evalResult.checks || [],
          failed: evalResult.failed || [],
          verdict: evalResult.structurally_complete ? 'STRUCTURALLY_SOUND' : (evalResult.verdict || 'INCOMPLETE')
        },
        hashes: {
          payload_sha256: payloadHash,
          result_sha256: resultHash
        },
        verification_reference: {
          engine: 'https://wheelerhubbell.github.io',
          admission: 'https://standing-guard-service.lovable.app/v1/ordinary/admission.json',
          action_marketplace: 'https://github.com/marketplace/actions/standing-gate'
        }
      };

      cycleRecords.push(attestation);

      // Save individual target latest record
      const targetFilePath = path.join(attestationsDir, `${target.target_id}-latest.json`);
      fs.writeFileSync(targetFilePath, JSON.stringify(attestation, null, 2));
      console.log(`Saved: ${targetFilePath}`);
    } catch (err) {
      console.error(`Failed to audit ${target.subject}: ${err.message}`);
    }
  }

  // Update master index of attestations
  const indexFilePath = path.join(attestationsDir, 'index.json');
  let history = [];
  if (fs.existsSync(indexFilePath)) {
    try {
      history = JSON.parse(fs.readFileSync(indexFilePath, 'utf8'));
    } catch (e) {
      history = [];
    }
  }
  // Keep last 100 attestations in index
  const updatedHistory = [...cycleRecords, ...history].slice(0, 100);
  fs.writeFileSync(indexFilePath, JSON.stringify(updatedHistory, null, 2));
  console.log(`Updated attestation index: ${indexFilePath} (${updatedHistory.length} total entries)`);

  // Generate markdown log for README or GH summary
  const summaryMarkdownPath = path.join(attestationsDir, 'LATEST_AUDIT.md');
  let md = `# Latest WHP Decision Integrity Audit Summary\n\n`;
  md += `**Timestamp:** \`${timestamp}\`  \n`;
  md += `**Engine:** [Wheeler Hubbell Publishing](https://wheelerhubbell.github.io)  \n`;
  md += `**Evaluator Door:** \`/v1/evaluate\`  \n\n`;
  md += `| Target Subject | Tier | Verdict | Payload SHA-256 | Verifiable Record |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;

  for (const record of cycleRecords) {
    const verdictBadge = record.evaluation.structurally_complete ? '✅ Sound' : '⚠️ Incomplete';
    md += `| [${record.subject}](${record.target_repo}) | **${record.tier}** | ${verdictBadge} | \`${record.hashes.payload_sha256.slice(0, 10)}...\` | [\`${record.attestation_id}.json\`](./${record.target_repo.split('/').pop()}-latest.json) |\n`;
  }
  fs.writeFileSync(summaryMarkdownPath, md);
  console.log(`Generated summary: ${summaryMarkdownPath}`);
}

run();
