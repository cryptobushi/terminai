# Terminai Skin Editor

Visual editor for creating and editing Terminai WMP skins. This tool provides a GUI for designing region layouts over Windows Media Player chrome images.

## Features

- **Visual Region Drawing**: Click and drag to create regions directly on the chrome image
- **Drag-to-Move**: Click and drag regions to reposition them
- **Resize Handles**: Grab corner/edge handles to resize regions with precision
- **Snap-to-Grid**: 5px grid alignment for consistent layouts (toggle on/off)
- **Region Inspector**: Edit all region properties (ID, type, position, size, z-index)
- **Undo/Redo**: Full history with 50-step buffer
- **Keyboard Shortcuts**: Efficient workflow with keyboard-first design
- **Import/Export**: Load existing manifests for editing, export to JSON
- **Live Preview Mode**: See your skin with realistic agent data rendering in real-time

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (or the port shown in terminal).

## Workflow

1. **Load Chrome Image**: Click "Load Chrome PNG" → select your WMP skin chrome.png file
2. **Draw Regions**: Click and drag on the canvas to create rectangular regions
3. **Edit Properties**:
   - Click a region to select it
   - Use the right panel to edit ID, type, coordinates, z-index
   - Or drag the region to move it
   - Or drag resize handles to resize it
4. **Assign Types**: Set each region's type:
   - `terminal` - Main terminal display
   - `agent-status` - Model name, tokens, current skill
   - `memory-context` - Recent memory fragments
   - `activity-feed` - Live event stream
   - `decorative` - No content, visual only
5. **Preview**: Click "Preview Mode" or press `P` for WYSIWYG preview
   - **Checkerboard background** - standard transparency indicator
   - **Runtime renderers** - uses same region renderers as actual Terminai app
   - **Stub agent data** - realistic activity feed, token counts, memory fragments
   - **Out-of-bounds warnings** - red outline if region is outside chrome bounds
   - **Exit**: Press `Escape`, `P`, or click "Exit Preview" button
6. **Export**: Click "Export Manifest" to download `manifest.json`
7. **Deploy**: Copy chrome.png + manifest.json to `/public/skins/your-skin-name/`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Click + Drag** | Draw new region |
| **Click region** | Select region |
| **Drag region** | Move selected region |
| **Drag handles** | Resize region |
| **Delete/Backspace** | Delete selected region |
| **Cmd/Ctrl + Z** | Undo |
| **Cmd/Ctrl + Shift + Z** | Redo |
| **Arrow keys** | Move region by 1px |
| **Shift + Arrow keys** | Move region by grid step (5px) |
| **Escape** | Deselect region / exit preview / close help |
| **P** | Toggle preview mode |
| **?** | Toggle help overlay |

## Region Types

- **terminal**: The main terminal area where xterm.js renders
- **agent-status**: One-line status bar showing model, skill, tokens
- **memory-context**: Vertical list of recent memory fragments
- **activity-feed**: Live scrolling feed of agent events
- **decorative**: Visual-only region (no content rendered)

## Tips

- **Grid Alignment**: Enable snap-to-grid for consistent 5px-aligned regions
- **Precise Positioning**: Use arrow keys for 1px nudges, Shift+Arrow for 5px steps
- **Undo Often**: Don't worry about mistakes - Cmd/Ctrl+Z has your back
- **Import Existing**: Load an existing manifest to tweak coordinates visually
- **Visual Feedback**: Selected regions show green overlay + resize handles
- **Preview Early, Preview Often**: Toggle preview to see how regions look with real content before exporting

## Output Format

The exported `manifest.json` follows this structure:

```json
{
  "id": "custom-skin",
  "name": "Custom Skin",
  "version": "1.0.0",
  "visual": {
    "width": 760,
    "height": 394,
    "chromeImage": "/skins/custom-skin/chrome.png"
  },
  "regions": [
    {
      "id": "main-terminal",
      "type": "terminal",
      "rect": { "x": 275, "y": 72, "width": 208, "height": 132 },
      "zIndex": 10
    }
  ],
  "actions": []
}
```

## Development

Built with:
- **Vite** - Fast dev server with HMR
- **TypeScript** - Type safety
- **Canvas API** - Direct pixel manipulation for crisp rendering

No framework dependencies - vanilla TS + Canvas for maximum control and minimal bundle size.

## Future Enhancements

Potential additions (not implemented yet):
- Template library of common layouts
- Multi-skin batch editing
- Auto-detect regions from chrome alpha channel
- Duplicate/copy regions
- Ruler/measurement overlays

## License

MIT - Same as Terminai project
