/**
 * Coinbase AgentKit Action Provider for WHP Standing Witness.
 * Enables autonomous agents on Base to invoke standing determinations,
 * audit actions before execution, and pay autonomously via x402.
 */

export const STANDING_WITNESS_ORIGIN = 'https://standing-guard-service.lovable.app';

export class WHPStandingActionProvider {
  constructor(options = {}) {
    this.origin = options.origin || STANDING_WITNESS_ORIGIN;
    this.client = options.client; // WHPStandingClient instance if available
  }

  /**
   * Defines tools for Coinbase AgentKit / LangChain integration.
   */
  getActions() {
    return [
      {
        name: 'whp_standing_ping',
        description: 'Instant signed structural check of a claim or subject (0.10 USDC on Base)',
        parameters: {
          type: 'object',
          properties: {
            claim: { type: 'string', description: 'The epistemic claim to check' },
            mock: { type: 'boolean', description: 'True for zero-cost dry-run check' }
          },
          required: ['claim']
        },
        invoke: async (args, walletProvider) => {
          return await this.evaluate('/v1/ping', { claim: args.claim }, { mock: args.mock, walletProvider });
        }
      },
      {
        name: 'whp_standing_audit',
        description: 'Signed structural alignment audit against Elemental Properties of True (2.00 USDC on Base)',
        parameters: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Subject or tool name to audit' },
            claim: { type: 'string', description: 'Claim or action parameters being audited' },
            mock: { type: 'boolean', description: 'True for zero-cost dry-run check' }
          },
          required: ['subject', 'claim']
        },
        invoke: async (args, walletProvider) => {
          return await this.evaluate('/v1/audit', { subject: args.subject, claim: args.claim }, { mock: args.mock, walletProvider });
        }
      },
      {
        name: 'whp_standing_circuit_breaker',
        description: 'Pre-flight safety gate before executing high-risk or irreversible agent actions',
        parameters: {
          type: 'object',
          properties: {
            action_name: { type: 'string', description: 'Name of the tool/action to be executed' },
            action_payload: { type: 'object', description: 'Arguments passed to the irreversible tool' }
          },
          required: ['action_name', 'action_payload']
        },
        invoke: async (args, walletProvider) => {
          const body = {
            subject: `tool_execution:${args.action_name}`,
            claim: JSON.stringify(args.action_payload)
          };
          const res = await this.evaluate('/v1/audit', body, { mock: false, walletProvider });
          if (res.outcome !== 'RECOGNIZED' && res.outcome !== 'RECOGNIZED WITH BOUNDARIES') {
            throw new Error(`CIRCUIT_BREAKER_HALT: Standing check rejected: ${JSON.stringify(res)}`);
          }
          return { allowed: true, record_hash: res.record_hash };
        }
      }
    ];
  }

  async evaluate(door, body, options = {}) {
    const url = `${this.origin}${door}`;
    const headers = { 'Content-Type': 'application/json' };
    if (options.mock) headers['X-Mock'] = 'true';

    let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.status === 402 && options.walletProvider) {
      const challenge = res.headers.get('PAYMENT-REQUIRED');
      // If wallet provider is passed, sign and retry with PAYMENT-SIGNATURE
      if (this.client && this.client.signPayment) {
        const sig = await this.client.signPayment(challenge, options.walletProvider);
        headers['PAYMENT-SIGNATURE'] = sig;
        res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      }
    }
    return await res.json();
  }
}
