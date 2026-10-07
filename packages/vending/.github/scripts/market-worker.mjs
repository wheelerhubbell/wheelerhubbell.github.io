#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ENGINE_COMMIT = "ef585b8149c14051e30c2d6344ad06e138745fb6";
const ENGINE_HASHES = Object.freeze({
  "core.mjs": "cc9798394a6a1480c60902fe401f261ec624d193dd6372dd759c3fd0dcc66f7c",
  "snapshot.mjs": "08fd01ba5cdb461b0494cb920fe4bc50d2a47d13e94c4238e794b454dc4ef94d",
  "ssrf.mjs": "ec73789355dfc5912032c004989a085cc08727b20a809cc2013eef706fb23908",
});
const textEncoder = new TextEncoder();

function canonical(value) {
  const normalize = (item) => {
    if (item === null || typeof item === "boolean" || typeof item === "string") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new Error("NON_FINITE_NUMBER");
      return Object.is(item, -0) ? 0 : item;
    }
    if (Array.isArray(item)) return item.map(normalize);
    if (!item || typeof item !== "object") throw new Error("NON_JSON_VALUE");
    return Object.fromEntries(Object.keys(item).filter((key) => item[key] !== undefined).sort().map((key) => [key, normalize(item[key])]));
  };
  return JSON.stringify(normalize(value));
}

async function sha256(value) {
  const bytes = value instanceof Uint8Array ? value : textEncoder.encode(typeof value === "string" ? value : canonical(value));
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
}

function marketOrigin() {
  const raw = process.env.WHP_MARKET_ORIGIN;
  if (!raw) throw new Error("WHP_MARKET_ORIGIN_REQUIRED");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.pathname !== "/" || url.origin !== raw.replace(/\/$/u, "")) throw new Error("WHP_MARKET_ORIGIN_INVALID");
  return url.origin;
}

async function oidcToken(audience) {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) throw new Error("GITHUB_OIDC_CONTEXT_REQUIRED");
  const url = new URL(requestUrl);
  url.searchParams.set("audience", audience);
  const response = await fetch(url, { headers: { authorization: `Bearer ${requestToken}` }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`GITHUB_OIDC_TOKEN_HTTP_${response.status}`);
  const value = await response.json();
  if (typeof value?.value !== "string" || value.value.length < 100) throw new Error("GITHUB_OIDC_TOKEN_INVALID");
  return value.value;
}

class MarketHttpError extends Error {
  constructor(status, code) { super(code); this.name = "MarketHttpError"; this.status = status; this.code = code; }
}

async function marketPost(origin, path, body) {
  const audience = `${origin}/internal/github-worker`;
  const token = await oidcToken(audience);
  const response = await fetch(`${origin}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: canonical(body), redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (response.status === 204) return null;
  const raw = await response.text();
  let value = null;
  try { value = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) throw new MarketHttpError(response.status, value?.error?.code ?? `MARKET_HTTP_${response.status}`);
  return value;
}

async function completeWithRetry(origin, body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await marketPost(origin, "/internal/github-worker/complete", body); }
    catch (error) {
      lastError = error;
      if (error instanceof MarketHttpError && error.status < 500) throw error;
      if (attempt < 2) await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000 * (attempt + 1)));
    }
  }
  throw lastError;
}

function publicFailureCode(error) {
  const candidate = typeof error?.code === "string" ? error.code : typeof error?.message === "string" ? error.message : "WORKER_EXECUTION_FAILED";
  const normalized = candidate.toUpperCase().replace(/[^A-Z0-9_:-]/gu, "_").slice(0, 160);
  return normalized || "WORKER_EXECUTION_FAILED";
}

async function loadEngines() {
  const root = resolve(process.env.WHP_ENGINE_ROOT || ".market-engine/automation/autonomous-market/src");
  for (const [name, expected] of Object.entries(ENGINE_HASHES)) {
    const actual = await sha256(new Uint8Array(await readFile(resolve(root, name))));
    if (actual !== expected) throw new Error(`ENGINE_FILE_HASH_MISMATCH:${name}`);
  }
  const [{ createReadinessEngine, createSnapshotEngine }, { canonical: engineCanonical, sha256: engineSha256 }] = await Promise.all([
    import(pathToFileURL(resolve(root, "snapshot.mjs")).href),
    import(pathToFileURL(resolve(root, "core.mjs")).href),
  ]);
  const snapshot = createSnapshotEngine();
  return { engines: { snapshot, readiness: createReadinessEngine({ snapshotEngine: snapshot }) }, canonical: engineCanonical, sha256: engineSha256 };
}

export async function runOnce() {
  const origin = marketOrigin();
  if (process.env.WHP_ENGINE_COMMIT && process.env.WHP_ENGINE_COMMIT !== ENGINE_COMMIT) throw new Error("ENGINE_COMMIT_MISMATCH");
  const requestId = randomBytes(32).toString("hex");
  let job;
  try { job = await marketPost(origin, "/internal/github-worker/claim", { request_id: requestId }); }
  catch (error) {
    if (error instanceof MarketHttpError && error.status === 503 && error.code === "LIVE_WORKER_NOT_ENABLED") {
      process.stdout.write("Market is in TEST; live worker is intentionally disabled.\n");
      return { claimed: false, disabled: true };
    }
    throw error;
  }
  if (!job) { process.stdout.write("No paid market job is due.\n"); return { claimed: false }; }
  if (job.version !== "WHP-MARKET-JOB-v1" || job.engine_commit !== ENGINE_COMMIT || !["snapshot", "readiness"].includes(job.product) || !/^[0-9a-f]{64}$/u.test(job.job_id ?? "") || !Number.isSafeInteger(job.lease_generation) || job.lease_generation < 1 || typeof job.lease_token !== "string") throw new Error("JOB_CONTRACT_INVALID");
  if (await sha256(job.target_url) !== job.target_sha256) throw new Error("JOB_TARGET_HASH_MISMATCH");
  process.stdout.write(`Claimed ${job.product} job ${job.job_id.slice(0, 12)}… at lease generation ${job.lease_generation}.\n`);
  let report;
  let engineCanonical;
  let engineSha256;
  try {
    const loaded = await loadEngines();
    engineCanonical = loaded.canonical;
    engineSha256 = loaded.sha256;
    report = await loaded.engines[job.product](job.target_url);
  } catch (error) {
    const code = publicFailureCode(error);
    const failureId = await sha256(canonical({ domain: "WHP-MARKET-WORKER-FAILURE-v1", job_id: job.job_id, lease_generation: job.lease_generation, error: code }));
    try { await marketPost(origin, "/internal/github-worker/fail", { job_id: job.job_id, lease_generation: job.lease_generation, lease_token: job.lease_token, failure_id: failureId, error: code }); }
    catch {}
    throw error;
  }
  const reportBytes = engineCanonical(report);
  const reportHash = engineSha256(reportBytes);
  const finishId = engineSha256(engineCanonical({ domain: "WHP-MARKET-WORKER-FINISH-v1", job_id: job.job_id, lease_generation: job.lease_generation, report_sha256: reportHash }));
  const completion = { job_id: job.job_id, lease_generation: job.lease_generation, lease_token: job.lease_token, finish_id: finishId, engine_commit: ENGINE_COMMIT, report, report_sha256: reportHash };
  const accepted = await completeWithRetry(origin, completion);
  process.stdout.write(`Stored job ${job.job_id.slice(0, 12)}… as ${accepted?.result_sha256?.slice(0, 12) ?? "unknown"}….\n`);
  return { claimed: true, job_id: job.job_id, result_sha256: accepted?.result_sha256 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runOnce().catch((error) => { process.stderr.write(`${publicFailureCode(error)}\n`); process.exitCode = 1; });
