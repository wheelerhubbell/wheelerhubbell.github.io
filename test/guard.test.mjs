import test from 'node:test';
import assert from 'node:assert/strict';
import { guardAction, evaluateStanding, StandingViolationError } from '../index.mjs';

test('Standing Guard Middleware Suite', async (t) => {
  await t.test('allows state-changing action when authority and provenance are present', async () => {
    const toolCall = {
      name: 'delete_file',
      arguments: { path: '/tmp/test.txt' }
    };
    const context = {
      standing: {
        authority: 'user:justin',
        provenance: 'prompt-confirmation:delete-test-file'
      }
    };
    const decision = await evaluateStanding(toolCall, context);
    assert.equal(decision.allowed, true);
    assert.equal(decision.code, 'STANDING_WARRANTED');

    // guardAction should resolve without throwing
    const guardRes = await guardAction(toolCall, context);
    assert.equal(guardRes.allowed, true);
  });

  await t.test('blocks state-changing action when provenance is missing', async () => {
    const toolCall = {
      name: 'delete_database_table',
      arguments: { table: 'users' }
    };
    const decision = await evaluateStanding(toolCall, {});
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'MISSING_UPSTREAM_PROVENANCE');
    assert.match(decision.message, /no attributable upstream authorization/);

    // guardAction should throw StandingViolationError
    await assert.rejects(
      async () => await guardAction(toolCall, {}),
      (err) => {
        assert(err instanceof StandingViolationError);
        assert.equal(err.code, 'MISSING_UPSTREAM_PROVENANCE');
        return true;
      }
    );
  });

  await t.test('blocks tool execution when authority window is expired', async () => {
    const toolCall = {
      name: 'write_config',
      arguments: { setting: 'value' }
    };
    const context = {
      standing: {
        authority: 'user:admin',
        provenance: 'token:abc',
        valid_until: Math.floor(Date.now() / 1000) - 60 // expired 1 min ago
      }
    };
    const decision = await evaluateStanding(toolCall, context);
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'EXPIRED_AUTHORITY');
  });

  await t.test('blocks unbounded execution when loop bound is exceeded', async () => {
    const toolCall = {
      name: 'execute_command',
      arguments: { cmd: 'retry_action' }
    };
    const context = {
      standing: {
        authority: 'agent:supervisor',
        provenance: 'task:123'
      },
      executionCount: 15,
      maxExecutionCount: 10
    };
    const decision = await evaluateStanding(toolCall, context);
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'LOOP_BOUND_EXCEEDED');
  });

  await t.test('allows read-only operations even without explicit provenance', async () => {
    const toolCall = {
      name: 'read_file',
      arguments: { path: '/readme.md' }
    };
    const decision = await evaluateStanding(toolCall, {});
    assert.equal(decision.allowed, true);
  });
});
