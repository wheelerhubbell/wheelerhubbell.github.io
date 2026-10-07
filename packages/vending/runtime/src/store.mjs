import pg from "pg";
import { Fault, canonical, demand } from "./core.mjs";

const STATES = ["QUOTED", "PREPARED", "SETTLING", "SETTLED", "COMPLETED", "EXPIRED_UNSETTLED"];
const MUTABLE_COLUMNS = new Set([
  "state",
  "payment_key",
  "payment_payload",
  "facilitator_verification",
  "observed_block",
  "scan_from",
  "transaction_hint",
  "settlement_evidence",
  "expiration_evidence",
  "result_sha256",
  "attempts",
  "next_attempt_at",
]);
const JSON_COLUMNS = new Set(["payment_payload", "facilitator_verification", "settlement_evidence", "expiration_evidence"]);
const NUMBER_COLUMNS = new Set(["artifact_size", "observed_block", "scan_from", "attempts", "next_attempt_at", "created_at", "updated_at", "lease_until"]);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizedRow(row) {
  if (!row) return null;
  const out = { ...row };
  for (const name of NUMBER_COLUMNS) if (out[name] !== null && out[name] !== undefined) out[name] = Number(out[name]);
  return out;
}

export class MemoryPurchaseStore {
  constructor() { this.rows = new Map(); this.artifacts = new Map(); }
  async init() {}
  async close() {}
  async ping() { return true; }
  async counts() {
    const rows = [...this.rows.values()];
    return { total: rows.length, completed: rows.filter((row) => row.state === "COMPLETED").length };
  }
  async retainArtifacts(records) {
    for (const record of records) {
      const prior = this.artifacts.get(record.sha256);
      demand(!prior || canonical(prior) === canonical(record), "ARTIFACT_REVISION_CONFLICT", 503);
      if (!prior) this.artifacts.set(record.sha256, clone(record));
    }
  }
  async listArtifacts() { return clone([...this.artifacts.values()]); }
  async createQuote(row) {
    const byReference = [...this.rows.values()].find((prior) => prior.client_reference_hash === row.client_reference_hash);
    if (byReference) return clone(byReference);
    this.rows.set(row.id, clone({
      ...row,
      state: "QUOTED",
      payment_key: null,
      payment_payload: null,
      facilitator_verification: null,
      observed_block: null,
      scan_from: null,
      transaction_hint: null,
      settlement_evidence: null,
      expiration_evidence: null,
      result_sha256: null,
      attempts: 0,
      next_attempt_at: row.created_at,
      updated_at: row.created_at,
      lease_owner: null,
      lease_until: null,
    }));
    return clone(this.rows.get(row.id));
  }
  async get(id) { return clone(this.rows.get(id) ?? null); }
  async paymentOwner(paymentKey) { return clone([...this.rows.values()].find((row) => row.payment_key === paymentKey) ?? null); }
  async bindPayment(id, requestHash, fields, now) {
    const row = this.rows.get(id);
    demand(row && row.request_hash === requestHash, "PURCHASE_NOT_FOUND", 404);
    if (row.payment_key) return clone(row);
    const owner = [...this.rows.values()].find((candidate) => candidate.payment_key === fields.payment_key);
    demand(!owner || owner.id === id, "PAYMENT_REPLAY", 409);
    demand(row.state === "QUOTED", "PURCHASE_STATE_CONFLICT", 409);
    Object.assign(row, clone(fields), {
      state: "PREPARED",
      scan_from: fields.observed_block,
      updated_at: now,
    });
    return clone(row);
  }
  async mutate(id, expectedStates, fields, now, owner = null) {
    demand(Object.keys(fields).length > 0 && Object.keys(fields).every((key) => MUTABLE_COLUMNS.has(key)), "STORE_FIELD_INVALID", 500);
    const row = this.rows.get(id);
    demand(row && expectedStates.includes(row.state), "PURCHASE_STATE_CONFLICT", 409);
    if (owner !== null) demand(row.lease_owner === owner && row.lease_until >= now, "PURCHASE_LEASE_LOST", 409);
    Object.assign(row, clone(fields), { updated_at: now });
    return clone(row);
  }
  async lease(id, owner, now, seconds = 90) {
    const row = this.rows.get(id);
    if (!row || row.state === "COMPLETED" || (row.lease_owner && row.lease_until >= now)) return false;
    Object.assign(row, { lease_owner: owner, lease_until: now + seconds, updated_at: now });
    return true;
  }
  async release(id, owner, now) {
    const row = this.rows.get(id);
    if (row?.lease_owner === owner) Object.assign(row, { lease_owner: null, lease_until: null, updated_at: now });
  }
}

export class PostgresPurchaseStore {
  constructor(pool) { this.pool = pool; }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS whp_vending_purchases (
        id TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{64}$'),
        client_reference_hash TEXT NOT NULL UNIQUE CHECK (client_reference_hash ~ '^[0-9a-f]{64}$'),
        product TEXT NOT NULL CHECK (product IN ('claim-classifier','return-the-burden','audit-the-move','limited-verdict','response-auditor')),
        product_version TEXT NOT NULL,
        catalog_build TEXT NOT NULL,
        artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
        artifact_size INTEGER NOT NULL CHECK (artifact_size > 0),
        artifact_filename TEXT NOT NULL,
        request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
        request_json JSONB NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('QUOTED','PREPARED','SETTLING','SETTLED','COMPLETED','EXPIRED_UNSETTLED')),
        quote JSONB NOT NULL,
        requirements JSONB NOT NULL,
        bazaar JSONB NOT NULL,
        payment_key TEXT UNIQUE,
        payment_payload JSONB,
        facilitator_verification JSONB,
        observed_block BIGINT,
        scan_from BIGINT,
        transaction_hint TEXT UNIQUE,
        settlement_evidence JSONB,
        expiration_evidence JSONB,
        result_sha256 TEXT CHECK (result_sha256 IS NULL OR result_sha256 ~ '^[0-9a-f]{64}$'),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        lease_owner TEXT,
        lease_until BIGINT,
        CHECK ((state = 'COMPLETED') = (result_sha256 IS NOT NULL))
      )
    `);
    await this.pool.query("CREATE INDEX IF NOT EXISTS whp_vending_state_idx ON whp_vending_purchases (state, next_attempt_at)");
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS whp_vending_artifacts (
        sha256 TEXT PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        size INTEGER NOT NULL CHECK (size > 0),
        filename TEXT NOT NULL,
        bytes_base64 TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }
  async close() { await this.pool.end(); }
  async ping() {
    const result = await this.pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }
  async counts() {
    const result = await this.pool.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE state='COMPLETED')::int AS completed FROM whp_vending_purchases");
    return result.rows[0];
  }
  async retainArtifacts(records) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const record of records) {
        await client.query(
          `INSERT INTO whp_vending_artifacts (sha256,size,filename,bytes_base64)
           VALUES ($1,$2,$3,$4) ON CONFLICT (sha256) DO NOTHING`,
          [record.sha256, record.size, record.filename, record.bytes_base64],
        );
        const result = await client.query("SELECT sha256,size,filename,bytes_base64 FROM whp_vending_artifacts WHERE sha256=$1", [record.sha256]);
        const stored = result.rows[0];
        demand(stored && Number(stored.size) === record.size && stored.filename === record.filename && stored.bytes_base64 === record.bytes_base64, "ARTIFACT_REVISION_CONFLICT", 503);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async listArtifacts() {
    const result = await this.pool.query("SELECT sha256,size,filename,bytes_base64 FROM whp_vending_artifacts ORDER BY created_at,sha256");
    return result.rows.map((row) => ({ ...row, size: Number(row.size) }));
  }
  async createQuote(row) {
    await this.pool.query(
      `INSERT INTO whp_vending_purchases
        (id,client_reference_hash,product,product_version,catalog_build,artifact_sha256,artifact_size,artifact_filename,
         request_hash,request_json,state,quote,requirements,bazaar,attempts,next_attempt_at,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'QUOTED',$11::jsonb,$12::jsonb,$13::jsonb,0,$14,$14,$14)
       ON CONFLICT DO NOTHING`,
      [row.id, row.client_reference_hash, row.product, row.product_version, row.catalog_build, row.artifact_sha256,
        row.artifact_size, row.artifact_filename, row.request_hash, canonical(row.request_json), canonical(row.quote),
        canonical(row.requirements), canonical(row.bazaar), row.created_at],
    );
    const byId = await this.get(row.id);
    if (byId) return byId;
    const conflict = await this.pool.query("SELECT * FROM whp_vending_purchases WHERE client_reference_hash=$1", [row.client_reference_hash]);
    return normalizedRow(conflict.rows[0] ?? null);
  }
  async get(id) {
    const result = await this.pool.query("SELECT * FROM whp_vending_purchases WHERE id=$1", [id]);
    return normalizedRow(result.rows[0] ?? null);
  }
  async paymentOwner(paymentKey) {
    const result = await this.pool.query("SELECT * FROM whp_vending_purchases WHERE payment_key=$1", [paymentKey]);
    return normalizedRow(result.rows[0] ?? null);
  }
  async bindPayment(id, requestHash, fields, now) {
    try {
      const result = await this.pool.query(
        `UPDATE whp_vending_purchases SET state='PREPARED', payment_key=$3, payment_payload=$4::jsonb,
          facilitator_verification=$5::jsonb, observed_block=$6, scan_from=$6, attempts=0, next_attempt_at=$7, updated_at=$7
         WHERE id=$1 AND request_hash=$2 AND state='QUOTED' AND payment_key IS NULL RETURNING *`,
        [id, requestHash, fields.payment_key, canonical(fields.payment_payload), canonical(fields.facilitator_verification), fields.observed_block, now],
      );
      if (result.rows[0]) return normalizedRow(result.rows[0]);
    } catch (error) {
      if (error?.code === "23505") throw new Fault("PAYMENT_REPLAY", 409);
      throw error;
    }
    const row = await this.get(id);
    demand(row, "PURCHASE_NOT_FOUND", 404);
    return row;
  }
  async mutate(id, expectedStates, fields, now, owner = null) {
    demand(expectedStates.length > 0 && expectedStates.every((state) => STATES.includes(state)), "STORE_STATE_INVALID", 500);
    demand(Object.keys(fields).length > 0 && Object.keys(fields).every((key) => MUTABLE_COLUMNS.has(key)), "STORE_FIELD_INVALID", 500);
    const values = [id, expectedStates, now];
    const assignments = Object.entries(fields).map(([key, value]) => {
      values.push(JSON_COLUMNS.has(key) && value !== null ? canonical(value) : value);
      return key + "=$" + values.length + (JSON_COLUMNS.has(key) ? "::jsonb" : "");
    });
    let ownerClause = "";
    if (owner !== null) {
      values.push(owner);
      ownerClause = " AND lease_owner=$" + values.length + " AND lease_until >= $3";
    }
    const result = await this.pool.query(
      "UPDATE whp_vending_purchases SET " + assignments.join(", ") + ", updated_at=$3 WHERE id=$1 AND state=ANY($2::text[])" + ownerClause + " RETURNING *",
      values,
    );
    demand(result.rows[0], "PURCHASE_STATE_CONFLICT", 409);
    return normalizedRow(result.rows[0]);
  }
  async lease(id, owner, now, seconds = 90) {
    const result = await this.pool.query(
      "UPDATE whp_vending_purchases SET lease_owner=$2, lease_until=$3, updated_at=$4 WHERE id=$1 AND state <> 'COMPLETED' AND (lease_owner IS NULL OR lease_until < $4) RETURNING id",
      [id, owner, now + seconds, now],
    );
    return result.rowCount === 1;
  }
  async release(id, owner, now) {
    await this.pool.query("UPDATE whp_vending_purchases SET lease_owner=NULL, lease_until=NULL, updated_at=$3 WHERE id=$1 AND lease_owner=$2", [id, owner, now]);
  }
}

export async function createPostgresStore(databaseUrl) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: databaseUrl.includes("railway.internal") ? false : { rejectUnauthorized: true },
  });
  const store = new PostgresPurchaseStore(pool);
  await store.init();
  return store;
}
