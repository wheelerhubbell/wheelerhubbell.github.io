/**
 * WHP Standing Witness Client & Middleware SDK
 * Wheeler Hubbell Publishing — Standing Mark Protocol
 * Invariant: A(c) <= P(c) (Authority cannot exceed provenance)
 */

export class StandingViolationError extends Error {
  constructor(decision) {
    super(decision.message || 'Standing verification failed');
    this.name = 'StandingViolationError';
    this.code = decision.code;
    this.actionId = decision.actionId;
    this.decision = decision;
  }
}

/**
 * Inspectable standing evaluation.
 * Evaluates whether an agent tool call carries sufficient upstream authority and provenance
 * before reaching a state-changing boundary.
 */
export async function evaluateStanding(toolCall, context = {}) {
  const actionId = toolCall?.id || toolCall?.call_id || toolCall?.actionId || `call_${Math.random().toString(36).slice(2, 9)}`;
  const toolName = toolCall?.name || toolCall?.tool || toolCall?.function?.name || 'unknown_tool';
  const args = toolCall?.arguments || toolCall?.function?.arguments || toolCall?.args || {};

  const standing = context.standing || toolCall.standing || {};
  const authority = standing.authority || context.authority;
  const provenance = standing.provenance || context.provenance;

  // Check state-changing operations
  const isStateChanging = context.isStateChanging !== undefined 
    ? context.isStateChanging 
    : /delete|write|update|modify|post|drop|exec|execute|send|remove|create|transfer|wire/i.test(toolName);

  const missing = [];
  if (!provenance || (typeof provenance === 'string' && provenance.trim().length === 0)) {
    missing.push('provenance');
  }
  if (!authority || (typeof authority === 'string' && authority.trim().length === 0)) {
    missing.push('authority');
  }

  // Check expiration if timestamp/valid_until is provided
  if (standing.valid_until && Date.now() / 1000 > standing.valid_until) {
    return {
      allowed: false,
      code: 'EXPIRED_AUTHORITY',
      actionId,
      toolName,
      required: ['valid_authority_window'],
      observed: { valid_until: standing.valid_until, now: Math.floor(Date.now() / 1000) },
      message: `Tool execution blocked for '${toolName}': authority window expired.`
    };
  }

  // Check loop or repetition bounds if max_depth / execution_count provided
  if (context.executionCount !== undefined && context.maxExecutionCount !== undefined) {
    if (context.executionCount > context.maxExecutionCount) {
      return {
        allowed: false,
        code: 'LOOP_BOUND_EXCEEDED',
        actionId,
        toolName,
        required: [`executionCount <= ${context.maxExecutionCount}`],
        observed: { executionCount: context.executionCount },
        message: `Tool execution blocked for '${toolName}': recursion/loop bound exceeded (${context.executionCount} > ${context.maxExecutionCount}).`
      };
    }
  }

  if (isStateChanging && missing.length > 0) {
    return {
      allowed: false,
      code: 'MISSING_UPSTREAM_PROVENANCE',
      actionId,
      toolName,
      required: ['authority', 'provenance'],
      observed: {
        toolName,
        arguments: typeof args === 'string' ? args.slice(0, 200) : args,
        missing
      },
      message: `Tool execution blocked for '${toolName}': no attributable upstream authorization or provenance.`
    };
  }

  return {
    allowed: true,
    code: 'STANDING_WARRANTED',
    actionId,
    toolName,
    authority: authority || 'unrestricted-read',
    provenance: provenance || 'unrestricted-read',
    message: `Standing warranted for action '${actionId}' on tool '${toolName}'.`
  };
}

/**
 * Headline 1-line middleware.
 * Throws StandingViolationError if standing is not warranted.
 */
export async function guardAction(toolCall, context = {}) {
  const decision = await evaluateStanding(toolCall, context);
  if (!decision.allowed) {
    throw new StandingViolationError(decision);
  }
  return decision;
}

/**
 * WHP Standing Witness Client
 * Connects to the authoritative WHP Standing service / front door.
 */
export class StandingClient {
  constructor(options = {}) {
    this.endpoint = (options.endpoint || 'https://standing-guard-service.lovable.app').replace(/\/$/, '');
    this.affiliate = options.affiliate || null;
  }

  async getContract() {
    const res = await fetch(`${this.endpoint}/v1/contract`);
    if (!res.ok) throw new Error(`Contract fetch failed: ${res.statusText}`);
    return res.json();
  }

  /**
   * Free Mock / Dry-Run (zero cost, unsigned).
   * Tests request structure before paying.
   */
  async mock(payload, door = '/v1/evaluate') {
    const url = new URL(`${this.endpoint}/v1/mock`);
    if (door) url.searchParams.set('door', door);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  /**
   * Instant verification ping (0.10 USDC or free dry-run with { mock: true }).
   */
  async ping(payload, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (options.mock) headers['X-Mock'] = 'true';
    if (options.affiliate || this.affiliate) headers['X-Affiliate'] = options.affiliate || this.affiliate;
    if (options.paymentToken) headers['X-Payment'] = options.paymentToken;

    const doFetch = options.fetch || fetch;
    const res = await doFetch(`${this.endpoint}/v1/ping`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (res.status === 402) {
      const header = res.headers.get('payment-required');
      let terms = null;
      try { terms = header ? JSON.parse(Buffer.from(header, 'base64').toString('utf8')) : await res.json(); } catch { /* leave null */ }
      return { paymentRequired: true, status: 402, terms };
    }
    return res.json();
  }

  /**
   * Evaluate a claim at the simple front door (POST /v1/evaluate).
   */
  async evaluate(payload, options = null) {
    const opts = typeof options === 'string' ? { paymentToken: options } : (options || {});
    const doFetch = opts.fetch || fetch;
    const headers = { 'Content-Type': 'application/json' };
    if (opts.mock) headers['X-Mock'] = 'true';
    if (opts.affiliate || this.affiliate) headers['X-Affiliate'] = opts.affiliate || this.affiliate;
    if (opts.paymentToken) headers['X-Payment'] = opts.paymentToken;

    const res = await doFetch(`${this.endpoint}/v1/evaluate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (res.status === 402) {
      const header = res.headers.get('payment-required');
      let terms = null;
      try { terms = header ? JSON.parse(Buffer.from(header, 'base64').toString('utf8')) : await res.json(); } catch { /* leave null */ }
      return { paymentRequired: true, status: 402, terms };
    }
    return res.json();
  }

  /**
   * Fetch a paid result by purchase id (GET /v1/purchases/{id}/result).
   */
  async getResult(purchaseId, options = {}) {
    const doFetch = options.fetch || fetch;
    const res = await doFetch(`${this.endpoint}/v1/purchases/${encodeURIComponent(purchaseId)}/result`, {
      headers: options.headers || {}
    });
    return res.json();
  }
}

export {
  withStandingWitness,
  createLangChainGuard,
  createElizaGuard
} from './adapters.mjs';

export {
  verifyStandingReleaseCondition,
  createStandingEscrowContract
} from './escrow.mjs';

export {
  createEpistemicCircuitBreaker,
  interceptToolCalls
} from './circuit_breaker.mjs';
