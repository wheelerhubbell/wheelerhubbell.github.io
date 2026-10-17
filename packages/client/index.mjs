
/**
 * Autonomous dynamic x402 signing and payment completion.
 */
function parseChainId(network) {
  if (typeof network === 'string' && network.startsWith('eip155:')) {
    const id = parseInt(network.slice(7), 10);
    if (!Number.isNaN(id)) return id;
  }
  return 8453; // Base default
}

function prepareAutonomousPayment(terms, payerAddress, options = {}) {
  const reqs = terms.payment_requirements || terms.requirements || terms.accepted || (Array.isArray(terms.accepts) ? terms.accepts[0] : null);
  if (!reqs) throw new Error('Invalid 402 challenge: missing payment requirements');
  if (!reqs.payTo) throw new Error('Invalid 402 challenge: missing payTo address');
  if (!reqs.asset) throw new Error('Invalid 402 challenge: missing asset address');
  if (!reqs.amount) throw new Error('Invalid 402 challenge: missing amount');

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const buffer = options.timeoutBufferSeconds ?? Math.min(reqs.maxTimeoutSeconds || 300, 300);

  const nonce = reqs.nonce && /^0x[0-9a-fA-F]{64}$/.test(reqs.nonce)
    ? reqs.nonce.toLowerCase()
    : '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');

  const validAfter = String(Math.max(0, now - 60));
  const validBefore = String(terms.expires_at ? Math.min(terms.expires_at, now + buffer) : now + buffer);

  const authorization = {
    from: payerAddress.toLowerCase(),
    to: reqs.payTo.toLowerCase(),
    value: String(reqs.amount),
    validAfter,
    validBefore,
    nonce,
  };

  const domain = {
    name: reqs.extra?.name || 'USD Coin',
    version: reqs.extra?.version || '2',
    chainId: parseChainId(reqs.network),
    verifyingContract: reqs.asset.toLowerCase(),
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  const typedData = {
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message: authorization,
  };

  const completePayment = (signature) => ({
    x402Version: 2,
    resource: terms.resource || {},
    accepted: reqs,
    payload: {
      signature,
      authorization,
    },
  });

  return {
    typedData,
    authorization,
    requirements: reqs,
    resource: terms.resource || {},
    completePayment,
  };
}

async function signWithPrivateKey(privateKeyHex, typedData) {
  const { privateKeyToAccount } = await import('viem/accounts');
  const key = privateKeyHex.startsWith('0x') ? privateKeyHex : '0x' + privateKeyHex;
  const acct = privateKeyToAccount(key);
  return acct.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  });
}

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
    this.endpoint = (options.endpoint || 'https://api.wheelerhubbellpublishing.com').replace(/\/$/, '');
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
    if (opts.paymentSignature) headers['PAYMENT-SIGNATURE'] = typeof opts.paymentSignature === 'object' ? JSON.stringify(opts.paymentSignature) : opts.paymentSignature;

    let res = await doFetch(`${this.endpoint}/v1/evaluate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (res.status === 402) {
      const header = res.headers.get('payment-required');
      let terms = null;
      try {
        terms = header ? JSON.parse(Buffer.from(header, 'base64').toString('utf8')) : await res.json();
      } catch { /* leave null */ }

      // Autonomous retry if buyerKey or signer is supplied
      const buyerKey = opts.buyerKey || process.env.WHP_BUYER_KEY;
      if (buyerKey && terms) {
        const { privateKeyToAccount } = await import('viem/accounts');
        const key = buyerKey.startsWith('0x') ? buyerKey : '0x' + buyerKey;
        const acct = privateKeyToAccount(key);
        const prep = prepareAutonomousPayment(terms, acct.address);
        const signature = await signWithPrivateKey(key, prep.typedData);
        const paymentPayload = prep.completePayment(signature);

        headers['PAYMENT-SIGNATURE'] = JSON.stringify(paymentPayload);
        res = await doFetch(`${this.endpoint}/v1/evaluate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        return { paymentRequired: true, status: 402, terms };
      }
    }
    return res.json();
  }

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
export * from './beacon.mjs';
