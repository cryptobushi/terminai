/**
 * Stub Hermes data source - generates realistic agent activity
 * Day 5: Demo-quality fake data, no backend dependency
 */

import type { DataSource, AgentStatus, ActivityEvent, MemoryFragment } from "./types";

const MODELS = ["claude-opus-4-7", "hermes-4.3-70b", "claude-sonnet-4-5"];
const SKILLS = [
  "research-synthesis",
  "code-review",
  "memory-consolidation",
  "tool-discovery",
  "deep-search",
  "context-analysis",
  "task-planning",
];

const TOOL_CALLS = [
  "web_search(query='navir treasury metrics')",
  "read_file(path='terminai/src/main.ts')",
  "grep(pattern='Region', path='src/')",
  "bash(cmd='npm run build')",
  "web_fetch(url='wmpskinsarchive.neocities.org')",
  "calculator(expr='366000 * 0.15')",
  "write_code(file='regions/agent-status.ts')",
];

const MEMORY_SNIPPETS = [
  "User working on terminai — WMP skin terminal, day 5 sprint",
  "NAVIR treasury currently $366K, 15% fee structure",
  "Preference: MIT license, open source core",
  "Headspace skin: 760x394, speakers at x=207/462",
  "Terminal region uses xterm.js with fit addon",
  "Bushi prefers terse outputs, no unnecessary prose",
  "Project goal: skinnable agent interface via WMP aesthetic",
  "Next: wire button actions on day 6",
  "Context: building multi-region rendering system",
  "Stub data should feel realistic for demos",
];

export class StubHermesDataSource implements DataSource {
  private status: AgentStatus;
  private activitySubscribers: Set<(event: ActivityEvent) => void> = new Set();
  private memories: MemoryFragment[] = [];
  private intervalId?: number;
  private eventCount = 0;
  private startTime = Date.now();

  constructor() {
    // Random model on each launch
    const model = MODELS[Math.floor(Math.random() * MODELS.length)];

    // Initialize status
    this.status = {
      model,
      currentSkill: null,
      tokensUsed: Math.floor(Math.random() * 5000) + 10000, // Start between 10K-15K
      uptimeSeconds: 0,
      lastToolCall: null,
    };

    // Initialize memories
    this.initializeMemories();

    // Start activity simulation
    this.startActivitySimulation();
  }

  private initializeMemories(): void {
    // Pick 5-8 random memory snippets
    const count = Math.floor(Math.random() * 4) + 5;
    const shuffled = [...MEMORY_SNIPPETS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      this.memories.push({
        id: `mem-${i}`,
        timestamp: new Date(Date.now() - (count - i) * 60000), // Spaced 1 min apart
        content: shuffled[i],
      });
    }
  }

  private startActivitySimulation(): void {
    const emitEvent = () => {
      this.eventCount++;

      // Randomly select event type
      const rand = Math.random();
      let event: ActivityEvent;

      if (rand < 0.4) {
        // Tool call (40%)
        const tool = TOOL_CALLS[Math.floor(Math.random() * TOOL_CALLS.length)];
        event = {
          id: `evt-${this.eventCount}`,
          timestamp: new Date(),
          type: "tool-call",
          message: `Called ${tool}`,
          duration: Math.random() * 2 + 0.5,
        };
        this.status.lastToolCall = tool;
      } else if (rand < 0.6) {
        // Skill load (20%)
        const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        event = {
          id: `evt-${this.eventCount}`,
          timestamp: new Date(),
          type: "skill-load",
          message: `Loaded skill: ${skill}`,
        };
        this.status.currentSkill = skill;
      } else if (rand < 0.75) {
        // Memory write (15%)
        const snippet = MEMORY_SNIPPETS[Math.floor(Math.random() * MEMORY_SNIPPETS.length)];
        event = {
          id: `evt-${this.eventCount}`,
          timestamp: new Date(),
          type: "memory-write",
          message: `Wrote memory: "${snippet.substring(0, 40)}..."`,
        };
      } else if (rand < 0.9) {
        // Task complete (15%)
        const duration = Math.random() * 3 + 0.5;
        event = {
          id: `evt-${this.eventCount}`,
          timestamp: new Date(),
          type: "task-complete",
          message: `Completed subtask in ${duration.toFixed(1)}s`,
          duration,
        };
        this.status.currentSkill = null; // Task done, no current skill
      } else {
        // Message (10%)
        event = {
          id: `evt-${this.eventCount}`,
          timestamp: new Date(),
          type: "message",
          message: "Analyzing context window for optimization",
        };
      }

      // Increment token count
      this.status.tokensUsed += Math.floor(Math.random() * 150) + 50;

      // Update uptime
      this.status.uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

      // Notify subscribers
      this.activitySubscribers.forEach(callback => callback(event));

      // Schedule next event with variable timing (3-8 seconds)
      const nextDelay = Math.random() * 5000 + 3000;
      this.intervalId = window.setTimeout(emitEvent, nextDelay);
    };

    // Start first event after 2 seconds
    this.intervalId = window.setTimeout(emitEvent, 2000);
  }

  getAgentStatus(): AgentStatus {
    return { ...this.status };
  }

  subscribeToActivity(callback: (event: ActivityEvent) => void): () => void {
    this.activitySubscribers.add(callback);
    return () => {
      this.activitySubscribers.delete(callback);
    };
  }

  getMemoryFragments(limit: number): MemoryFragment[] {
    return this.memories.slice(-limit);
  }

  dispose(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }
    this.activitySubscribers.clear();
  }
}
