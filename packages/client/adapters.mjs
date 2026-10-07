/**
 * WHP Standing Adapters for Autonomous Agent Frameworks
 * Fail-Closed Epistemic Standing Enforcement for LangChain, ElizaOS, and Vanilla Tools
 */
import { evaluateStanding, StandingViolationError } from './index.mjs';

/**
 * Universal higher-order function to wrap any asynchronous agent tool or action
 * with fail-closed standing verification.
 */
export function withStandingWitness(fn, options = {}) {
  const toolName = options.name || fn.name || 'unnamed_tool';
  
  return async function standingGuardedAction(input, context = {}) {
    const combinedContext = {
      ...options,
      ...context,
      toolName
    };
    
    const decision = await evaluateStanding({
      name: toolName,
      arguments: input
    }, combinedContext);

    if (!decision.allowed) {
      if (options.failClosed !== false) {
        throw new StandingViolationError(decision);
      }
      return {
        error: decision.message,
        standingViolation: decision
      };
    }

    return await fn(input, context);
  };
}

/**
 * LangChain Tool Guard Adapter
 * Wraps LangChain StructuredTool or DynamicTool instances
 */
export function createLangChainGuard(tool, options = {}) {
  const originalCall = tool._call.bind(tool);
  
  tool._call = async function (arg, runManager) {
    const context = {
      ...options,
      runId: runManager?.runId,
      metadata: runManager?.metadata
    };
    
    const decision = await evaluateStanding({
      name: tool.name,
      arguments: arg
    }, context);

    if (!decision.allowed) {
      throw new StandingViolationError(decision);
    }

    return await originalCall(arg, runManager);
  };

  return tool;
}

/**
 * ElizaOS Action Guard Adapter
 * Wraps an ElizaOS Action handler with invariant checks
 */
export function createElizaGuard(action, options = {}) {
  const originalHandler = action.handler;

  action.handler = async function (runtime, message, state, optionsOverride, callback) {
    const context = {
      ...options,
      ...optionsOverride,
      authority: state?.standingAuthority || state?.authority,
      provenance: message?.userId || state?.provenance,
      isStateChanging: true
    };

    const decision = await evaluateStanding({
      name: action.name,
      arguments: message?.content
    }, context);

    if (!decision.allowed) {
      if (callback) {
        callback({
          text: `[Standing Witness Intercept] ${decision.message}`,
          action: 'EXECUTION_DENIED',
          decision
        });
      }
      return false;
    }

    return await originalHandler(runtime, message, state, optionsOverride, callback);
  };

  return action;
}
