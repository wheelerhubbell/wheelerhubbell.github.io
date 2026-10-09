/**
 * WHP Epistemic Circuit Breaker
 * Fail-Closed Middleware for Autonomous Agent Tool Invocations
 * Wheeler Hubbell Publishing — Standing Mark Protocol
 */

import { StandingViolationError } from './index.mjs';

/**
 * Wraps any tool, function, or execution delegate with fail-closed epistemic verification.
 * Intercepts tool calls before irrevocable state changes (e.g. transfers, deletions, external writes).
 *
 * @param {Function} toolFn - The underlying tool execution function.
 * @param {Object} options - Circuit breaker configuration.
 * @returns {Function} Guarded execution function.
 */
export function createEpistemicCircuitBreaker(toolFn, options = {}) {
  const toolName = options.name || toolFn.name || 'unnamed_tool';
  const endpoint = (options.endpoint || 'https://standing-guard-service.lovable.app').replace(/\/$/, '');
  const mode = options.mode || 'local'; // 'local' | 'mock' | 'verify'

  return async function guardedExecution(args, context = {}) {
    const isDestructive = options.isDestructive !== undefined
      ? options.isDestructive
      : /transfer|pay|send|wire|delete|drop|remove|execute|post|submit|sign/i.test(toolName);

    // Extract claim and provenance from args or context
    const subject = args?.subject || context?.subject || `ToolCall:${toolName}`;
    const claim = args?.claim || context?.claim || (typeof args === 'string' ? args : JSON.stringify(args));
    const provenance = args?.provenance || context?.provenance || {
      source: context?.source || context?.user || 'agent_internal',
      authority: context?.authority || 'unverified_premise',
      evidence: Array.isArray(context?.evidence) && context.evidence.length > 0 ? context.evidence : ['tool_call_invocation']
    };

    // 1. Online Mock Verification if requested
    if (mode === 'mock' || (isDestructive && mode === 'auto')) {
      try {
        const res = await fetch(`${endpoint}/v1/mock?door=/v1/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, claim, provenance })
        });
        if (res.ok) {
          const dryRun = await res.json();
          if (!dryRun.structurally_complete) {
            throw new StandingViolationError({
              allowed: false,
              code: 'CIRCUIT_BREAKER_TRIPPED',
              actionId: `guard_${toolName}`,
              toolName,
              observed: dryRun,
              message: `[Epistemic Circuit Breaker] Execution of '${toolName}' halted. Missing structural provenance: ${dryRun.failed.join(', ')}`
            });
          }
        }
      } catch (err) {
        if (err instanceof StandingViolationError) throw err;
        if (options.failClosedOnNetworkError !== false) {
          throw new StandingViolationError({
            allowed: false,
            code: 'CIRCUIT_BREAKER_NETWORK_FAIL_CLOSED',
            actionId: `guard_${toolName}`,
            toolName,
            message: `[Epistemic Circuit Breaker] Remote verification failed; failing closed: ${err.message}`
          });
        }
      }
    }

    // 2. Local Invariant Check
    if (isDestructive) {
      const hasSource = !!provenance.source;
      const hasAuth = !!provenance.authority && provenance.authority !== 'unverified_premise';
      const hasEvidence = Array.isArray(provenance.evidence) && provenance.evidence.length > 0;

      if (!hasSource || !hasAuth || !hasEvidence) {
        throw new StandingViolationError({
          allowed: false,
          code: 'EPISTEMIC_PREMISE_UNWARRANTED',
          actionId: `guard_${toolName}`,
          toolName,
          required: ['provenance.source', 'provenance.authority', 'provenance.evidence'],
          observed: provenance,
          message: `[Epistemic Circuit Breaker] Irrevocable action '${toolName}' blocked. Premises lack verified provenance or authority.`
        });
      }
    }

    // Execute wrapped tool safely
    return await toolFn(args, context);
  };
}

/**
 * Universal OpenAI / Claude Function Calling Interceptor
 */
export function interceptToolCalls(toolCalls, executor, options = {}) {
  return Promise.all(
    toolCalls.map(async (tc) => {
      const name = tc.function?.name || tc.name;
      const args = typeof tc.function?.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : (tc.function?.arguments || tc.arguments);

      const guarded = createEpistemicCircuitBreaker(
        (a) => executor(name, a),
        { ...options, name }
      );

      return {
        id: tc.id,
        tool: name,
        result: await guarded(args)
      };
    })
  );
}
