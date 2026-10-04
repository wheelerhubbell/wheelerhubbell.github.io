export interface ToolCall {
  id?: string;
  name?: string;
  tool?: string;
  function?: { name?: string; arguments?: any };
  arguments?: any;
  args?: any;
  standing?: StandingContext;
}

export interface StandingContext {
  authority?: string;
  provenance?: string;
  valid_until?: number;
  [key: string]: any;
}

export interface GuardOptions {
  standing?: StandingContext;
  authority?: string;
  provenance?: string;
  isStateChanging?: boolean;
  executionCount?: number;
  maxExecutionCount?: number;
  requiredOperations?: string[];
}

export interface StandingDecision {
  allowed: boolean;
  code: string;
  actionId: string;
  toolName: string;
  required?: any;
  observed?: any;
  authority?: string;
  provenance?: string;
  message: string;
}

export declare class StandingViolationError extends Error {
  code: string;
  actionId: string;
  decision: StandingDecision;
  constructor(decision: StandingDecision);
}

export declare function evaluateStanding(toolCall: ToolCall, context?: GuardOptions): Promise<StandingDecision>;
export declare function guardAction(toolCall: ToolCall, context?: GuardOptions): Promise<StandingDecision>;

export declare class StandingClient {
  endpoint: string;
  constructor(options?: { endpoint?: string });
  getContract(): Promise<any>;
  evaluate(payload: any, paymentToken?: string | null): Promise<any>;
  getResult(resultId: string): Promise<any>;
}
