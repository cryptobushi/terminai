# Terminai

A visual identity layer for AI agents. Terminai is a terminal emulator where the chrome is a skin (inspired by Windows Media Player skins from 2001-2005) and the buttons are bound to terminal/agent actions.

**Long-term thesis**: Persistent AI agents need visual identity before they can scale to normies, and the corpus of pre-personality-flattening early-2000s skin art is a rich source of that identity.

## Current Status (Day 1)

✅ Working plumbing: transparent frameless window on macOS with a real shell (zsh) running inside a designated sub-region, using a hardcoded placeholder skin (colored blob).

## Running the Project

### Prerequisites

- macOS (Apple Silicon or Intel)
- Rust stable
- Node.js 20+

### Development

```bash
npm install
npm run tauri dev
```

The app will launch with a transparent, frameless, custom-shaped window. Type commands in the input field and press Enter to execute them in the terminal.

### Building

```bash
npm run tauri build
```

## Architecture

### High-Level Overview

- **Backend (Rust)**: Owns process state (PTY sessions)
- **Frontend (TypeScript)**: Owns render state only
- **Disk**: Owns user config (planned)
- **IPC**: Tauri commands for request/response, Tauri events for streams

See `src-tauri/src/commands.rs` for the complete documented IPC contract.

### Key Design Principles

1. **Swappable skins**: Loading a different skin means swapping a `SkinManifest` object, not editing rendering logic
2. **Interface-based extension**: Skin layer, agent adapter, and action binding are defined as interfaces with default implementations
3. **Typed errors**: All errors from Rust are typed enums, not strings (`src-tauri/src/errors.rs`)
4. **Structured logging**: Set up from the start using `env_logger`
5. **Clean separation**: Backend owns process state, frontend owns render state

### Tech Stack

- **Tauri v2**: 10MB bundle for the normie pitch
- **Vanilla TypeScript**: No frameworks (React/Vue/Svelte) - keeps bundle small
- **portable-pty**: Real local pseudo-terminal via file descriptors
- **macOS only** (for now)

## Project Structure

```
terminai/
├── src/                    # Frontend (vanilla TypeScript)
│   ├── main.ts            # Application entry point
│   ├── terminal.ts        # Terminal session management & IPC
│   ├── types.ts           # TypeScript interfaces (SkinManifest, IPCCommands, etc.)
│   ├── skins/
│   │   └── placeholder.ts # Placeholder skin implementation
│   └── style.css          # Styles
├── src-tauri/             # Backend (Rust)
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Library root
│   │   ├── commands.rs    # IPC contract documentation + handlers
│   │   ├── errors.rs      # Typed error enums
│   │   ├── pty.rs         # PTY session management (channel-based)
│   │   └── state.rs       # Application state
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── README.md
```

## IPC Contract

See `src-tauri/src/commands.rs` for the complete documented contract.

### Commands (Request/Response)

- `create_pty_session(session_id: String)` - Create new PTY session
- `write_to_pty(session_id: String, data: String)` - Write to PTY
- `resize_pty(session_id: String, rows: u16, cols: u16)` - Resize PTY (TODO)
- `close_pty_session(session_id: String)` - Close PTY session

### Events (Streams)

- `pty-output:{session_id}` - Emitted when PTY produces output

## Roadmap

This is day 1 of a 12-day sprint targeting the Nous Research Hermes Agent Creative Hackathon (due May 4, 2026).

**Day 1** (✅ Complete): Working plumbing - transparent window, real shell, placeholder skin

**Next steps**:
- .wmz skin file parsing
- Multiple skin support
- Hermes agent integration
- Action button binding
- Visual personality differentiation

## License

MIT - See [LICENSE](./LICENSE)

## Contributing

Contributions welcome! The codebase is structured to make it easy to:

- **Add new skins**: Implement the `SkinManifest` interface (see `src/types.ts`)
- **Add agent adapters**: Structured for future extension
- **Bind new actions**: Interface-based design

The architecture enforces clean separation: extending the app means implementing an interface, not editing core logic.
