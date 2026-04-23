# Terminai ↔ Hermes Agent Integration Plan

> **Generated:** 2026-04-23
> **Status:** Research Complete, Ready for Implementation
> **Research Agents:** 3 specialized agents (Explore, Plan, Architecture)

---

## Executive Summary

This document outlines a comprehensive plan to integrate real Hermes agent data into Terminai's visual interface. The integration will replace the current stub data source with live agent state, memory, token usage, and activity information from Hermes Agent's SQLite database and session files.

**Key Objectives:**
- Display real Hermes model, token count, and session data
- Show live activity feed from Hermes tool calls and messages
- Visualize Hermes memory fragments
- Provide graceful fallback when Hermes is not installed
- Maintain clean architecture with DataSource abstraction

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Hermes Agent Data Sources](#2-hermes-agent-data-sources)
3. [Terminai Architecture Analysis](#3-terminai-architecture-analysis)
4. [Integration Strategy](#4-integration-strategy)
5. [Implementation Phases](#5-implementation-phases)
6. [Technical Challenges & Solutions](#6-technical-challenges--solutions)
7. [Testing Strategy](#7-testing-strategy)
8. [Timeline & Milestones](#8-timeline--milestones)

---

## 1. System Architecture Overview

### Current State

```
┌─────────────────────────────────────────┐
│           Terminai UI                    │
│  ┌─────────────────────────────────┐   │
│  │   Visual Regions                 │   │
│  │  - agent-status                  │   │
│  │  - activity-feed                 │   │
│  │  - memory-context                │   │
│  │  - terminal (xterm.js)           │   │
│  └──────────────┬──────────────────┘   │
│                 │                        │
│  ┌──────────────▼──────────────────┐   │
│  │   DataSource Interface          │   │
│  │  - getAgentStatus()             │   │
│  │  - subscribeToActivity()        │   │
│  │  - getMemoryFragments()         │   │
│  └──────────────┬──────────────────┘   │
│                 │                        │
│  ┌──────────────▼──────────────────┐   │
│  │   StubHermesDataSource          │   │
│  │  (fake data for demo)           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────┐
│                    Terminai UI                          │
│  ┌───────────────────────────────────────────────┐     │
│  │        Visual Regions (unchanged)              │     │
│  └───────────────┬───────────────────────────────┘     │
│                  │                                       │
│  ┌───────────────▼────────────────────────────────┐    │
│  │        DataSource Interface (unchanged)         │    │
│  └───────────────┬────────────────────────────────┘    │
│                  │                                       │
│  ┌───────────────▼────────────────────────────────┐    │
│  │       HermesDataSource (NEW)                    │    │
│  │  - Polls Hermes state via Tauri IPC             │    │
│  │  - Falls back to stub if Hermes unavailable     │    │
│  └───────────────┬────────────────────────────────┘    │
│                  │ Tauri IPC                             │
├──────────────────┼───────────────────────────────────────┤
│                  │ Rust Backend                          │
│  ┌───────────────▼────────────────────────────────┐    │
│  │       HermesAdapter (NEW)                       │    │
│  │  - Reads ~/.hermes/state.db (SQLite)            │    │
│  │  - Parses session JSON files                    │    │
│  │  - Exposes Tauri commands                       │    │
│  └───────────────┬────────────────────────────────┘    │
│                  │                                       │
│  ┌───────────────▼────────────────────────────────┐    │
│  │  ~/.hermes/                                     │    │
│  │  - state.db (sessions, messages, tokens)        │    │
│  │  - sessions/*.json (full transcripts)           │    │
│  │  - memories/ (MEMORY.md, USER.md)               │    │
│  │  - config.yaml (agent configuration)            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Hermes Agent Data Sources

### 2.1 Hermes Directory Structure

**Location:** `~/.hermes/`

```
~/.hermes/
├── state.db                    # SQLite database (main state)
├── state.db-wal                # Write-ahead log (active writes)
├── state.db-shm                # Shared memory
├── config.yaml                 # Agent configuration (10KB)
├── SOUL.md                     # Agent personality
├── sessions/                   # Session transcripts
│   ├── session_20260423_*.json (64KB each)
│   └── request_dump_*.json
├── memories/                   # Memory storage
│   ├── MEMORY.md              # Agent notes (2,200 char limit)
│   └── USER.md                # User profile (1,375 char limit)
├── skills/                     # Installed skills
├── logs/                       # Log files
└── auth.json                  # OAuth tokens
```

### 2.2 SQLite Database Schema

**Schema Version:** 8

#### Sessions Table (27 columns)

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,              -- 'cli', 'telegram', 'discord'
    user_id TEXT,
    title TEXT,
    model TEXT,                        -- e.g., "k2p6", "claude-sonnet-4-5"

    -- Timestamps
    started_at REAL NOT NULL,
    ended_at REAL,                     -- NULL = active session

    -- Usage metrics
    message_count INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    api_call_count INTEGER DEFAULT 0,

    -- Token counts
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    reasoning_tokens INTEGER DEFAULT 0,

    -- Billing
    estimated_cost_usd REAL,
    actual_cost_usd REAL,

    -- ... 12 more columns
);
```

#### Messages Table (14 columns)

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,                -- 'user', 'assistant', 'tool'
    content TEXT,
    timestamp REAL NOT NULL,
    token_count INTEGER,

    -- Tool calls
    tool_call_id TEXT,
    tool_calls TEXT,                   -- JSON
    tool_name TEXT,                    -- e.g., "bash", "read", "memory"

    -- Reasoning
    reasoning TEXT,
    reasoning_content TEXT,

    -- ... 3 more columns
);
```

### 2.3 Available Data Points

| Data Type | Source | Format | Update Frequency |
|-----------|--------|--------|------------------|
| Model name | `sessions.model` | String | Per session |
| Token usage | `sessions.input_tokens + output_tokens` | Integer | Per message |
| Session duration | `sessions.started_at - ended_at` | Unix timestamp | Real-time |
| Activity events | `messages.tool_name, content` | Text/JSON | Per message |
| Memory fragments | `messages` with `tool_name LIKE 'memory%'` | Text | Variable |
| Estimated cost | `sessions.estimated_cost_usd` | Float | Per session |

### 2.4 Hermes CLI Commands

**For reference** (not used in integration, but useful to understand data semantics):

- `/usage` - Shows token usage, rate limits, context percentage
- `/insights [days]` - Historical analytics across sessions
- `/compress` - Compresses conversation context
- `/memory add/remove/replace` - Memory operations

---

## 3. Terminai Architecture Analysis

### 3.1 DataSource Interface

**Location:** `src/data/types.ts`

```typescript
interface DataSource {
  // Synchronous status query
  getAgentStatus(): AgentStatus;

  // Event-driven activity stream
  subscribeToActivity(callback: (event: ActivityEvent) => void): () => void;

  // Synchronous memory query
  getMemoryFragments(limit: number): MemoryFragment[];

  // Resource cleanup
  dispose(): void;
}

interface AgentStatus {
  model: string;                    // e.g., "claude-sonnet-4-5"
  currentSkill: string | null;      // e.g., "research-synthesis"
  tokensUsed: number;               // Total token count
  uptimeSeconds: number;            // Session duration
  lastToolCall: string | null;      // e.g., "web_search(...)"
}

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: "tool-call" | "skill-load" | "memory-write" | "task-complete" | "message";
  message: string;
  duration?: number;
}

interface MemoryFragment {
  id: string;
  timestamp: Date;
  content: string;
  category?: string;
}
```

### 3.2 Current Stub Implementation

**Location:** `src/data/stub-hermes.ts`

**What it provides:**
- Random model selection on startup
- Simulated activity events every 3-8 seconds
- Pre-populated memory snippets (5-8 entries)
- Incremental token counting
- Uptime tracking

**Key insight:** The stub implementation defines the expected behavior and data patterns.

### 3.3 Region Renderers

**Location:** `src/regions/`

| Renderer | Data Used | Update Mechanism | File |
|----------|-----------|------------------|------|
| `agent-status` | `getAgentStatus()` | Polling (1s) | `agent-status.ts` |
| `activity-feed` | `subscribeToActivity()` | Push events | `activity-feed.ts` |
| `memory-context` | `getMemoryFragments(12)` | Polling (30s) | `memory-context.ts` |
| `terminal` | None (uses xterm.js + PTY) | Real-time streams | `terminal.ts` |

### 3.4 Injection Point

**Location:** `src/main.ts` (line 24)

```typescript
class TerminaiApp {
  private dataSource: DataSource;

  constructor(skin: SkinManifest) {
    this.skin = skin;
    this.dataSource = new StubHermesDataSource();  // ← Replace here
  }
}
```

---

## 4. Integration Strategy

### 4.1 Recommended Approach: Hybrid (Rust + TypeScript)

**Phase 1: Rust Backend Data Access**
- Add `rusqlite` dependency for SQLite access
- Create `src-tauri/src/hermes_adapter.rs` module
- Implement Tauri commands for reading Hermes state
- Handle gracefully when Hermes not installed

**Phase 2: TypeScript Adapter**
- Create `src/data/hermes-data-source.ts` implementing `DataSource`
- Use Tauri IPC to call Rust commands
- Implement polling mechanism (every 2-5 seconds)
- Fallback to stub data if Hermes unavailable

**Phase 3: File Watching (Optional)**
- Use Rust `notify` crate for file system watching
- Watch `state.db-wal` for changes
- Emit Tauri events when Hermes state changes
- Reduce polling, improve responsiveness

### 4.2 Why Hybrid?

**Pros:**
✅ Rust has excellent SQLite support via `rusqlite`
✅ File system permissions cleaner in native layer
✅ TypeScript focuses on presentation
✅ Can add file watching later without frontend changes
✅ No Hermes modifications required

**Cons:**
⚠️ Requires IPC calls (slight latency)
⚠️ Depends on Hermes DB schema stability

### 4.3 Data Mapping

| Terminai Region | Hermes Data Source | SQL Query |
|----------------|-------------------|-----------|
| `agent-status.model` | `sessions.model` | `SELECT model FROM sessions WHERE ended_at IS NULL` |
| `agent-status.tokensUsed` | `sessions.input_tokens + output_tokens` | `SELECT input_tokens + output_tokens AS total` |
| `agent-status.uptimeSeconds` | `sessions.started_at` | `SELECT (strftime('%s', 'now') - started_at) AS uptime` |
| `activity-feed` | `messages.tool_name, content` | `SELECT * FROM messages ORDER BY timestamp DESC LIMIT 20` |
| `memory-context` | `messages` with memory tool calls | `SELECT * FROM messages WHERE tool_name LIKE 'memory%'` |

---

## 5. Implementation Phases

### Phase 1: MVP - Read-Only Hermes State (Days 1-3)

**Goal:** Display real model name and token count from Hermes

**Deliverables:**
- ✅ Rust module `hermes_adapter.rs` with SQLite queries
- ✅ TypeScript `HermesDataSource` class
- ✅ Graceful fallback to stub data if Hermes unavailable
- ✅ Update `main.ts` to use new data source

**Technical Tasks:**

#### Rust Backend

**File:** `src-tauri/Cargo.toml`
```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
```

**File:** `src-tauri/src/hermes_adapter.rs` (NEW)
```rust
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug)]
pub struct HermesStatus {
    pub model: String,
    pub session_id: String,
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub uptime_seconds: i64,
    pub message_count: i32,
}

pub struct HermesAdapter {
    hermes_dir: PathBuf,
}

impl HermesAdapter {
    pub fn new() -> Result<Self> {
        let home = std::env::var("HOME").expect("HOME not set");
        let hermes_dir = PathBuf::from(home).join(".hermes");

        if !hermes_dir.exists() {
            return Err(rusqlite::Error::InvalidPath(hermes_dir));
        }

        Ok(Self { hermes_dir })
    }

    pub fn get_current_status(&self) -> Result<Option<HermesStatus>> {
        let db_path = self.hermes_dir.join("state.db");
        let conn = Connection::open_with_flags(
            db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;

        // Query most recent active session (ended_at IS NULL or empty)
        let mut stmt = conn.prepare(
            "SELECT id, model, message_count, input_tokens, output_tokens, started_at
             FROM sessions
             WHERE ended_at IS NULL OR ended_at = ''
             ORDER BY started_at DESC
             LIMIT 1"
        )?;

        let result = stmt.query_row([], |row| {
            let started_at: f64 = row.get(5)?;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as f64;
            let uptime = (now - started_at).max(0.0) as i64;

            Ok(HermesStatus {
                session_id: row.get(0)?,
                model: row.get(1)?,
                message_count: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                total_tokens: row.get::<_, i64>(3)? + row.get::<_, i64>(4)?,
                uptime_seconds: uptime,
            })
        });

        match result {
            Ok(status) => Ok(Some(status)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

// Tauri command
#[tauri::command]
pub fn get_hermes_status() -> Result<Option<HermesStatus>, String> {
    let adapter = HermesAdapter::new().map_err(|e| format!("Hermes not found: {}", e))?;
    adapter.get_current_status().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_hermes_available() -> bool {
    HermesAdapter::new().is_ok()
}
```

**File:** `src-tauri/src/lib.rs` (MODIFY)
```rust
mod hermes_adapter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Existing commands...
            create_pty_session,
            write_to_pty,
            // New Hermes commands
            hermes_adapter::get_hermes_status,
            hermes_adapter::check_hermes_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### TypeScript Frontend

**File:** `src/data/hermes-data-source.ts` (NEW)
```typescript
import { invoke } from "@tauri-apps/api/core";
import type { DataSource, AgentStatus, ActivityEvent, MemoryFragment } from "./types";

interface HermesStatus {
  model: string;
  session_id: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  uptime_seconds: number;
  message_count: number;
}

export class HermesDataSource implements DataSource {
  private pollingInterval: number = 5000; // 5 seconds
  private intervalId?: number;
  private activitySubscribers: Set<(event: ActivityEvent) => void> = new Set();
  private lastStatus: AgentStatus | null = null;

  constructor() {
    this.startPolling();
  }

  getAgentStatus(): AgentStatus {
    // Return cached status (updated by polling)
    return this.lastStatus || {
      model: "Unknown",
      currentSkill: null,
      tokensUsed: 0,
      uptimeSeconds: 0,
      lastToolCall: null,
    };
  }

  subscribeToActivity(callback: (event: ActivityEvent) => void): () => void {
    this.activitySubscribers.add(callback);
    return () => this.activitySubscribers.delete(callback);
  }

  getMemoryFragments(limit: number): MemoryFragment[] {
    // Phase 3: Implement memory query
    return [];
  }

  dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private startPolling(): void {
    // Initial fetch
    this.pollStatus();

    // Periodic polling
    this.intervalId = window.setInterval(() => {
      this.pollStatus();
    }, this.pollingInterval);
  }

  private async pollStatus(): Promise<void> {
    try {
      const status = await invoke<HermesStatus | null>("get_hermes_status");

      if (!status) {
        console.warn("[HermesDataSource] No active Hermes session");
        return;
      }

      this.lastStatus = {
        model: status.model,
        currentSkill: null, // Phase 2: Parse from tool calls
        tokensUsed: status.total_tokens,
        uptimeSeconds: status.uptime_seconds,
        lastToolCall: null, // Phase 2
      };

      console.log("[HermesDataSource] Status updated:", this.lastStatus);
    } catch (error) {
      console.error("[HermesDataSource] Failed to poll status:", error);
    }
  }
}
```

**File:** `src/main.ts` (MODIFY line 24)
```typescript
import { HermesDataSource } from "./data/hermes-data-source";
import { StubHermesDataSource } from "./data/stub-hermes";
import { invoke } from "@tauri-apps/api/core";

class TerminaiApp {
  private dataSource: DataSource;

  async init(): Promise<void> {
    // ... existing code

    // Initialize data source with Hermes detection
    await this.initializeDataSource();

    // Render skin
    this.renderSkin();
  }

  private async initializeDataSource(): Promise<void> {
    try {
      const hermesAvailable = await invoke<boolean>("check_hermes_available");

      if (hermesAvailable) {
        this.dataSource = new HermesDataSource();
        console.log("[Terminai] Using real Hermes data source");
      } else {
        console.warn("[Terminai] Hermes not installed, using stub data");
        this.dataSource = new StubHermesDataSource();
      }
    } catch (error) {
      console.error("[Terminai] Error initializing data source:", error);
      this.dataSource = new StubHermesDataSource();
    }
  }
}
```

**Testing Checklist:**
- [ ] With Hermes running: Displays real model name and token count
- [ ] Without Hermes: Falls back to stub data gracefully
- [ ] No crashes or errors in either mode
- [ ] Polling doesn't cause performance issues

---

### Phase 2: Activity Feed - Recent Messages (Days 4-6)

**Goal:** Show real Hermes activity (tool calls, messages) in the activity feed

**Deliverables:**
- ✅ Query recent messages from `state.db`
- ✅ Parse tool calls and display in activity feed
- ✅ Detect new messages via polling
- ✅ Show realistic event types and timestamps

**Technical Tasks:**

#### Rust Backend Extension

**File:** `src-tauri/src/hermes_adapter.rs` (ADD)
```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct ActivityMessage {
    pub id: String,
    pub timestamp: f64,
    pub message_type: String, // "tool-call", "message", "user-message"
    pub content: String,
    pub tool_name: Option<String>,
}

impl HermesAdapter {
    pub fn get_recent_messages(&self, session_id: &str, limit: usize) -> Result<Vec<ActivityMessage>> {
        let db_path = self.hermes_dir.join("state.db");
        let conn = Connection::open_with_flags(
            db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;

        let mut stmt = conn.prepare(
            "SELECT id, role, content, tool_calls, tool_name, timestamp
             FROM messages
             WHERE session_id = ?1
             ORDER BY timestamp DESC
             LIMIT ?2"
        )?;

        let messages = stmt.query_map([session_id, &limit.to_string()], |row| {
            let role: String = row.get(1)?;
            let content: Option<String> = row.get(2)?;
            let tool_calls: Option<String> = row.get(3)?;
            let tool_name: Option<String> = row.get(4)?;

            let (message_type, display_content) = match (&role as &str, &tool_name) {
                ("tool", Some(name)) => {
                    ("tool-call".to_string(), format!("🔧 {}", name))
                }
                ("user", _) => {
                    let preview = content.unwrap_or_default()
                        .chars()
                        .take(50)
                        .collect::<String>();
                    ("user-message".to_string(), format!("💬 {}", preview))
                }
                ("assistant", _) => {
                    if tool_calls.is_some() {
                        ("tool-call".to_string(), "🤖 Thinking...".to_string())
                    } else {
                        let preview = content.unwrap_or_default()
                            .chars()
                            .take(50)
                            .collect::<String>();
                        ("message".to_string(), preview)
                    }
                }
                _ => ("message".to_string(), content.unwrap_or_default()),
            };

            Ok(ActivityMessage {
                id: row.get::<_, i64>(0)?.to_string(),
                timestamp: row.get(5)?,
                message_type,
                content: display_content,
                tool_name,
            })
        })?;

        messages.collect()
    }
}

#[tauri::command]
pub fn get_hermes_recent_activity(limit: usize) -> Result<Vec<ActivityMessage>, String> {
    let adapter = HermesAdapter::new().map_err(|e| e.to_string())?;

    // Get current session
    let status = adapter.get_current_status().map_err(|e| e.to_string())?;
    let session_id = status.ok_or("No active session")?.session_id;

    adapter.get_recent_messages(&session_id, limit).map_err(|e| e.to_string())
}
```

**File:** `src-tauri/src/lib.rs` (ADD to invoke_handler)
```rust
hermes_adapter::get_hermes_recent_activity,
```

#### TypeScript Frontend Extension

**File:** `src/data/hermes-data-source.ts` (MODIFY)
```typescript
export class HermesDataSource implements DataSource {
  private lastMessageId: string | null = null;
  private messageCache: Map<string, ActivityMessage> = new Map();

  constructor() {
    this.startPolling();
    this.startActivityPolling(); // New: Activity polling
  }

  private startActivityPolling(): void {
    // Initial fetch
    this.pollActivity();

    // Poll every 3 seconds for activity
    setInterval(() => {
      this.pollActivity();
    }, 3000);
  }

  private async pollActivity(): Promise<void> {
    try {
      const messages = await invoke<ActivityMessage[]>("get_hermes_recent_activity", { limit: 20 });

      // Reverse to process oldest-first (preserve chronological order for events)
      for (const msg of messages.reverse()) {
        if (this.messageCache.has(msg.id)) continue;

        this.messageCache.set(msg.id, msg);

        // Notify subscribers of new activity
        const event: ActivityEvent = {
          id: msg.id,
          timestamp: new Date(msg.timestamp * 1000),
          type: this.mapMessageType(msg.message_type),
          message: msg.content,
        };

        this.activitySubscribers.forEach(callback => callback(event));
      }

      // Cleanup: Keep last 100 messages in cache
      if (this.messageCache.size > 100) {
        const sorted = Array.from(this.messageCache.entries())
          .sort((a, b) => b[1].timestamp - a[1].timestamp);
        this.messageCache = new Map(sorted.slice(0, 100));
      }
    } catch (error) {
      console.error("[HermesDataSource] Failed to poll activity:", error);
    }
  }

  private mapMessageType(hermesType: string): ActivityEvent["type"] {
    const mapping: Record<string, ActivityEvent["type"]> = {
      "tool-call": "tool-call",
      "user-message": "message",
      "message": "message",
    };
    return mapping[hermesType] || "message";
  }
}
```

**Testing Checklist:**
- [ ] New Hermes messages appear in activity feed
- [ ] Tool calls are detected and labeled
- [ ] User messages vs assistant messages distinguished
- [ ] No duplicate events
- [ ] Timestamps are accurate

---

### Phase 3: Memory Fragments (Days 7-8)

**Goal:** Display real Hermes memory entries in memory-context region

**Deliverables:**
- ✅ Query memory-related messages
- ✅ Parse memory operations from tool calls
- ✅ Display in memory-context region

**Technical Tasks:**

#### Rust Backend Extension

**File:** `src-tauri/src/hermes_adapter.rs` (ADD)
```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct MemoryFragment {
    pub id: String,
    pub timestamp: f64,
    pub content: String,
    pub category: Option<String>,
}

impl HermesAdapter {
    pub fn get_memory_fragments(&self, limit: usize) -> Result<Vec<MemoryFragment>> {
        let db_path = self.hermes_dir.join("state.db");
        let conn = Connection::open_with_flags(
            db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;

        // Query messages with memory tool calls
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, content, tool_name
             FROM messages
             WHERE tool_name LIKE 'memory%'
             ORDER BY timestamp DESC
             LIMIT ?1"
        )?;

        let fragments = stmt.query_map([limit], |row| {
            Ok(MemoryFragment {
                id: row.get::<_, i64>(0)?.to_string(),
                timestamp: row.get(1)?,
                content: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                category: row.get(3).ok(),
            })
        })?;

        fragments.collect()
    }
}

#[tauri::command]
pub fn get_hermes_memory_fragments(limit: usize) -> Result<Vec<MemoryFragment>, String> {
    let adapter = HermesAdapter::new().map_err(|e| e.to_string())?;
    adapter.get_memory_fragments(limit).map_err(|e| e.to_string())
}
```

#### TypeScript Frontend Extension

**File:** `src/data/hermes-data-source.ts` (MODIFY)
```typescript
getMemoryFragments(limit: number): MemoryFragment[] {
  // This will be called synchronously by memory-context renderer
  // We'll cache the results from async polling
  return Array.from(this.memoryCache.values()).slice(0, limit);
}

private memoryCache: Map<string, MemoryFragment> = new Map();

private async pollMemory(): Promise<void> {
  try {
    const fragments = await invoke<MemoryFragment[]>("get_hermes_memory_fragments", { limit: 20 });

    this.memoryCache.clear();
    fragments.forEach(f => {
      this.memoryCache.set(f.id, {
        id: f.id,
        timestamp: new Date(f.timestamp * 1000),
        content: f.content,
        category: f.category,
      });
    });
  } catch (error) {
    console.error("[HermesDataSource] Failed to poll memory:", error);
  }
}
```

---

### Phase 4: File Watching (Days 9-10) - OPTIONAL

**Goal:** Replace polling with real-time file system watching for better performance

**Deliverables:**
- ✅ Watch `~/.hermes/state.db-wal` for changes
- ✅ Emit Tauri events on Hermes state changes
- ✅ Frontend listens for events instead of polling

**Dependencies:**
```toml
[dependencies]
notify = "6.1"
```

**Technical Tasks:** (Detailed implementation omitted for brevity - see full integration plan in research notes)

---

## 6. Technical Challenges & Solutions

### Challenge 1: SQLite Concurrent Access

**Problem:** Hermes uses SQLite with WAL mode. Concurrent access could cause locks.

**Solution:**
- Open database in **read-only mode**: `OpenFlags::SQLITE_OPEN_READ_ONLY`
- SQLite WAL mode supports concurrent readers safely
- Handle `SQLITE_BUSY` errors with retry logic (exponential backoff)

### Challenge 2: Hermes Not Installed

**Problem:** Users without Hermes shouldn't see errors or broken UI.

**Solution:**
- Check for `~/.hermes` directory before attempting reads
- Graceful fallback to `StubHermesDataSource`
- Optional: Show subtle notification: "Install Hermes for live agent data"

### Challenge 3: Data Freshness vs Performance

**Problem:** Balancing real-time updates with resource consumption.

**Solution:**
- **Phase 1-3:** Poll every 5 seconds (acceptable for demo/hackathon)
- **Phase 4:** File watching triggers updates only on actual changes
- **Adaptive polling:** Slow down when no activity detected

### Challenge 4: Schema Version Changes

**Problem:** Future Hermes updates might change database schema.

**Solution:**
- Query schema version: `SELECT version FROM schema_version`
- Add version compatibility checks in `HermesAdapter::new()`
- Graceful degradation if schema incompatible

---

## 7. Testing Strategy

### Unit Tests

**Rust:**
```bash
cargo test --package terminai
```

Test cases:
- Hermes directory detection
- SQLite query correctness
- Session data parsing
- Error handling (missing DB, corrupted data)

**TypeScript:**
```bash
npm test
```

Test cases:
- DataSource interface compliance
- Fallback behavior
- Event subscription/unsubscription
- Memory leak prevention

### Integration Tests

1. **With Live Hermes:**
   - Start Hermes session in terminal
   - Open Terminai
   - Verify model name, token count display correctly
   - Send messages in Hermes
   - Verify activity feed updates

2. **Without Hermes:**
   - Rename `~/.hermes` temporarily
   - Launch Terminai
   - Verify fallback to stub data
   - No errors in console

3. **Session Transitions:**
   - Start Hermes session
   - Terminai shows "active" state
   - Exit Hermes (session ends)
   - Terminai shows "idle" or last session state

---

## 8. Timeline & Milestones

### Sprint Overview (8-10 days)

```
Day 1-3: Phase 1 - MVP
├─ ✅ Add rusqlite dependency
├─ ✅ Implement HermesAdapter Rust module
├─ ✅ Create HermesDataSource TypeScript class
├─ ✅ Graceful fallback logic
└─ 🎯 Milestone: Display real Hermes model + tokens

Day 4-6: Phase 2 - Activity Feed
├─ ✅ Query recent messages from DB
├─ ✅ Parse tool calls
├─ ✅ Activity feed polling
└─ 🎯 Milestone: Live activity stream

Day 7-8: Phase 3 - Memory
├─ ✅ Query memory fragments
├─ ✅ Display in memory-context region
└─ 🎯 Milestone: Complete data integration

Day 9-10: Phase 4 - Optimization (Optional)
├─ ⭕ File watching implementation
├─ ⭕ Replace polling with events
└─ 🎯 Milestone: Production-ready
```

### Success Criteria

**Phase 1 (MVP):**
- [ ] Terminai displays real Hermes model name
- [ ] Token count matches Hermes `/usage` output
- [ ] No crashes when Hermes not installed
- [ ] Graceful fallback to stub data

**Phase 2 (Activity):**
- [ ] Activity feed shows real messages within 5 seconds
- [ ] Tool calls identified correctly
- [ ] No duplicate events

**Phase 3 (Memory):**
- [ ] Memory region populated with real data
- [ ] Content relevant and readable

**Final Success:**
- [ ] Complete integration works end-to-end
- [ ] All edge cases handled gracefully
- [ ] Performance acceptable (<5% CPU when idle)
- [ ] Demo-ready for hackathon presentation

---

## 9. Future Enhancements (Post-Hackathon)

### Enhanced Visualizations

1. **Token Usage Graph**
   - Sparkline showing token accumulation over time
   - Context window percentage bar
   - Cost tracking visualization

2. **Session History**
   - Dropdown to view past sessions
   - Session search/filter
   - Export session transcripts

3. **Memory Explorer**
   - Search memory fragments
   - Category filtering
   - Memory timeline view

4. **Skill Tracking**
   - Current active skill display
   - Skill usage statistics
   - Skill load history

### Advanced Integration

1. **Bi-directional Communication**
   - Send commands to Hermes from Terminai UI
   - Quick actions (compress, memory add/remove)
   - Skill management UI

2. **Multi-Session Support**
   - Track multiple concurrent Hermes instances
   - Session switcher UI
   - Aggregate metrics across sessions

3. **Real-time Streaming**
   - WebSocket connection to Hermes (if Hermes adds support)
   - Token-by-token response visualization
   - Live thinking/reasoning display

---

## 10. Appendix

### A. File Structure After Integration

```
terminai/
├── src/
│   ├── data/
│   │   ├── types.ts                 (existing)
│   │   ├── stub-hermes.ts          (existing - kept as fallback)
│   │   └── hermes-data-source.ts   (NEW - Phase 1)
│   └── main.ts                      (modified - async init)
│
├── src-tauri/
│   ├── src/
│   │   ├── hermes_adapter.rs       (NEW - Phase 1)
│   │   ├── commands.rs             (modified - register new commands)
│   │   └── lib.rs                  (modified - import new module)
│   └── Cargo.toml                  (modified - add rusqlite)
│
└── HERMES_INTEGRATION.md           (this document)
```

### B. Key Dependencies

**Rust:**
```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
notify = "6.1"  # Phase 4 only
```

**TypeScript:** (no new dependencies - uses existing Tauri APIs)

### C. Hermes Installation Check

Users can verify Hermes is installed:

```bash
# Check if Hermes directory exists
ls ~/.hermes

# Check if Hermes CLI is in PATH
which hermes

# Check current session
sqlite3 ~/.hermes/state.db "SELECT * FROM sessions WHERE ended_at IS NULL"
```

### D. Research Agent Reports

Full detailed reports from the research agents are available in the Hermes research repository:
- `/Users/bushi/Documents/Developer/hermes-agent-research/`

Reports cover:
1. Hermes codebase structure (Python 3)
2. SQLite database schema (8 tables)
3. Memory system architecture (2,200 char limit)
4. Token tracking implementation
5. CLI commands and data access methods

---

## Summary

This integration plan provides a **clear, phased approach** to connecting Terminai with real Hermes agent data. The hybrid Rust/TypeScript architecture leverages strong SQLite support while maintaining clean separation of concerns.

**Key Advantages:**
✅ No modifications to Hermes required
✅ Clean DataSource abstraction
✅ Graceful degradation without Hermes
✅ Incrementally implementable (MVP in 3 days)
✅ Production-ready in 8-10 days

**Recommended Next Steps:**
1. ✅ Review this plan with team
2. ⏭️ Begin Phase 1 implementation (Rust backend + basic status)
3. ⏭️ Test with real Hermes installation
4. ⏭️ Iterate through Phases 2-3
5. ⏭️ Polish and prepare for hackathon demo

---

**Document Version:** 1.0
**Last Updated:** 2026-04-23
**Status:** Ready for Implementation
