/**
 * Data source types for agent state
 */

export interface AgentStatus {
  model: string;
  currentSkill: string | null;
  tokensUsed: number;
  uptimeSeconds: number;
  lastToolCall: string | null;
}

export interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: "tool-call" | "skill-load" | "memory-write" | "task-complete" | "message";
  message: string;
  duration?: number; // in seconds
}

export interface MemoryFragment {
  id: string;
  timestamp: Date;
  content: string;
  category?: string;
}

/**
 * DataSource interface - implemented by stub and real Hermes adapters
 */
export interface DataSource {
  /** Get current agent status */
  getAgentStatus(): AgentStatus;

  /** Subscribe to activity events */
  subscribeToActivity(callback: (event: ActivityEvent) => void): () => void;

  /** Get recent memory fragments */
  getMemoryFragments(limit: number): MemoryFragment[];

  /** Clean up resources */
  dispose(): void;
}
