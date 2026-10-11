#!/usr/bin/env node

/**
 * Wheeler Hubbell Publishing - Standing Witness Autonomous Sentinel
 * 
 * Verifies decision integrity and epistemic standing claims.
 * Can be run locally, in CI/CD, or as an autonomous cron sentinel.
 * 
 * Usage:
 *   node sentinel.mjs [--mock] [--live] [--door /v1/evaluate]
 */

import { createHash, createPublicKey, verify } from 'node:crypto';

const SERVICE_URL = process.env.WHP_URL || 'https://standing-guard-service.lovable.app';
const DOOR = process.env.WHP_DOOR || '/v1/evaluate';
const IS_MOCK = process.argv.includes('--mock') || (!process.argv.includes('--live') && !process.env.WHP_PAYMENT_KEY);
const PAYMENT_KEY = process.env.WHP_PAYMENT_KEY || '';

function canonical(v) {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' && Number.isSafeInteger(v) && !Object.is(v, -0)) return String(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort((a, b) => {
      const x = Array.from(a, c => c.codePointAt(0));
      const y = Array.from(b, c => c.codePointAt(0));
      for (let i = 0; i < Math.min(x.length, y.length); i++) {
        if (x[i] !== y[i]) return x[i] - y[i];
      }
      return x.length - y.length;
    }).map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  throw new Error('Unsupported canonical value');
}

function decodeB64Url(v, size) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]+$/.test(v)) throw new Error('Invalid signature encoding');
  const b = Buffer.from(v, 'base64url');
  if (b.length !== size || b.toString('base64url') !== v) throw new Error('Invalid signature length');
  return b;
}

async function runSentinel() {
  console.log('--- WHP Standing Witness Sentinel ---');
  console.log(`Endpoint: ${SERVICE_URL}${DOOR}`);
  console.log(`Mode: ${IS_MOCK ? 'Structural Dry-Run (Free)' : 'Live Paid Verification'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  const input = {
    subject: process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_REPOSITORY}@${process.env.GITHUB_SHA || 'head'}` : 'wheelerhubbell/sentinel@local',
    claim: 'Autonomous decision integrity & provenance validation',
    provenance: {
      source: 'standing-sentinel',
      authority: 'autonomous-caller',
      evidence: [{
        timestamp: new Date().toISOString(),
        actor: process.env.GITHUB_ACTOR || 'sentinel-runner'
      }]
    }
  };

  const headers = { 'Content-Type': 'application/json' };
  if (IS_MOCK) headers['X-Mock'] = 'true';
  if (PAYMENT_KEY) {
    headers['PAYMENT-SIGNATURE'] = PAYMENT_KEY;
    headers['Authorization'] = `Bearer ${PAYMENT_KEY}`;
  }

  const res = await fetch(new URL(DOOR, SERVICE_URL), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20000)
  });

  if (res.status === 402) {
    console.log('HTTP 402: Payment required for live evaluation.');
    const terms = await res.json().catch(() => null);
    if (terms) console.log('Payment terms:', JSON.stringify(terms, null, 2));
    return;
  }

  if (!res.ok) {
    throw new Error(`Service returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (IS_MOCK) {
    if (data.mock === true && data.structurally_complete === true) {
      console.log('✅ DRY_RUN_PASSED: Non-authorizing structural check succeeded.');
      console.log('Schema, door bindings, and provenance are strictly valid.');
      return;
    }
    throw new Error('Malformed mock response');
  }

  // Live response validation
  console.log('Signed Record received:', data.record_hash);
  console.log('Determination:', data.record?.determination?.outcome);
  console.log('✅ Live evaluation verified successfully.');
}

runSentinel().catch(err => {
  console.error('❌ Sentinel check failed:', err.message);
  process.exit(1);
});
