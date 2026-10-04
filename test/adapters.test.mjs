import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withStandingWitness, createLangChainGuard, createElizaGuard } from '../adapters.mjs';
import { StandingViolationError } from '../index.mjs';

describe('Agent Framework Adapters', () => {
  it('withStandingWitness blocks unauthorized state-changing tool call', async () => {
    const dangerousTool = withStandingWitness(async (params) => {
      return `Executed delete on ${params.id}`;
    }, { name: 'delete_database_record' });

    await assert.rejects(
      async () => await dangerousTool({ id: '123' }, {}),
      StandingViolationError
    );
  });

  it('withStandingWitness allows tool call with valid authority and provenance', async () => {
    const guardedTool = withStandingWitness(async (params) => {
      return `Processed ${params.id}`;
    }, { name: 'delete_record' });

    const result = await guardedTool({ id: '123' }, {
      authority: 'admin_session_token',
      provenance: 'user_intent_verified'
    });

    assert.equal(result, 'Processed 123');
  });

  it('createLangChainGuard blocks tool when provenance is absent', async () => {
    const mockTool = {
      name: 'send_funds',
      _call: async (args) => `Sent ${args.amount}`
    };

    const guarded = createLangChainGuard(mockTool);

    await assert.rejects(
      async () => await guarded._call({ amount: '100 USDC' }, {}),
      StandingViolationError
    );
  });

  it('createElizaGuard intercepts action when authority is missing', async () => {
    let callbackResponse = null;
    const mockAction = {
      name: 'EXECUTE_PAYMENT',
      handler: async () => true
    };

    const guarded = createElizaGuard(mockAction);
    const allowed = await guarded.handler(
      {},
      { content: { amount: 50 } },
      {},
      {},
      (res) => { callbackResponse = res; }
    );

    assert.equal(allowed, false);
    assert.match(callbackResponse.text, /Standing Witness Intercept/);
  });
});
