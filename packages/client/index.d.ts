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
  affiliate?: string | null;
  constructor(options?: { endpoint?: string; affiliate?: string | null });
  getContract(): Promise<any>;
  mock(payload: any, door?: string): Promise<any>;
  ping(payload: any, options?: { mock?: boolean; affiliate?: string; paymentToken?: string; fetch?: typeof fetch }): Promise<any>;
  evaluate(payload: any, options?: string | { mock?: boolean; affiliate?: string; fetch?: typeof fetch; paymentToken?: string } | null): Promise<any>;
  getResult(purchaseId: string, options?: { fetch?: typeof fetch; headers?: Record<string, string> }): Promise<any>;
}

export function withStandingWitness<T extends (...args: any[]) => any>(
  fn: T,
  options?: Record<string, any>
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function createLangChainGuard(tool: any, options?: Record<string, any>): any;
export function createElizaGuard(action: any, options?: Record<string, any>): any;

export function verifyStandingReleaseCondition(
  output: any,
  standingRecord: any,
  options?: {
    expectedSubject?: string;
    maxAgeSeconds?: number;
    allowedStatuses?: string[];
  }
): {
  satisfied: boolean;
  code: string;
  checks: Array<{ id: string; pass: boolean; note?: string }>;
  failed: string[];
  record_hash?: string;
  signature_present: boolean;
  message: string;
};

export function createStandingEscrowContract(params: {
  recipient: string;
  amount: string;
  currency?: string;
  network?: string;
  verifierDoor?: string;
  allowedStatuses?: string[];
  requireSigned?: boolean;
}): any;

export function createEpistemicCircuitBreaker<T extends (...args: any[]) => any>(
  toolFn: T,
  options?: {
    name?: string;
    endpoint?: string;
    mode?: 'local' | 'mock' | 'auto';
    isDestructive?: boolean;
    failClosedOnNetworkError?: boolean;
  }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function interceptToolCalls(
  toolCalls: any[],
  executor: (toolName: string, args: any) => Promise<any>,
  options?: Record<string, any>
): Promise<any[]>;
