/**
 * WHP Standing Witness Client SDK
 * Connects to the authoritative WHP Standing service.
 */
export class StandingClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || 'https://standing-guard-service.lovable.app';
  }

  async getContract() {
    const res = await fetch(`${this.endpoint}/v1/contract`);
    if (!res.ok) throw new Error(`Contract fetch failed: ${res.statusText}`);
    return res.json();
  }

  async evaluate(payload, paymentToken = null) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (paymentToken) {
      headers['X-Payment'] = paymentToken;
    }
    const res = await fetch(`${this.endpoint}/v1/evaluate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async getResult(resultId) {
    const res = await fetch(`${this.endpoint}/v1/result/${resultId}`);
    return res.json();
  }
}
