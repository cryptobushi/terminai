# OpenAI Image Generation Integration Research
## Terminai Skin Editor AI-Powered Chrome Generation

**Version:** 1.0
**Date:** April 23, 2026
**Author:** Research Team

---

## Executive Summary

This document provides a comprehensive analysis and implementation plan for integrating OpenAI's image generation capabilities into the Terminai skin editor pipeline. The goal is to enable users to generate custom terminal skin chrome images through natural language prompts, dramatically lowering the barrier to entry for skin creation while maintaining the creative ceiling.

### Key Findings

- **Recommended Model:** OpenAI GPT Image 1.5 (successor to DALL-E 3)
  - 4x faster generation (~10-30 seconds)
  - Better instruction following and precise editing
  - More cost-effective ($0.009-0.2 per image vs DALL-E 3's $0.04-0.12)
  - Native multimodal architecture for superior quality

- **Implementation Strategy:** Frontend API integration with backend proxy for security
  - Leverage existing Tauri backend to proxy OpenAI API calls
  - Store API keys securely in Tauri's secure storage
  - Handle image generation in frontend skin-editor with real-time preview

- **Cost Analysis:** Estimated $0.03-0.11 per generation (standard quality)
  - Competitive with commissioning custom artwork ($50-200)
  - Enables rapid iteration and experimentation
  - Potential for caching and local storage optimization

- **Timeline:** 3-phase rollout over 4-6 weeks
  - Phase 1 (2 weeks): Basic generation + import
  - Phase 2 (2 weeks): Smart region detection with CV
  - Phase 3 (1-2 weeks): Iterative refinement + inpainting

---

## 1. OpenAI API Technical Analysis

### 1.1 Model Comparison: GPT Image 1.5 vs DALL-E 3

| Feature | GPT Image 1.5 (Recommended) | DALL-E 3 (Legacy) |
|---------|---------------------------|-------------------|
| **Release Date** | December 16, 2025 | September 2023 |
| **Generation Speed** | 10-30 seconds | 40-120 seconds |
| **Architecture** | Native multimodal transformer | Separate diffusion model |
| **Max Resolution** | 2048x2048 | 1792x1024 |
| **Quality Tiers** | 3 (Low/Medium/High) | 2 (Standard/HD) |
| **Text Rendering** | Excellent (improved) | Poor (often garbled) |
| **Instruction Following** | Superior | Good |
| **Inpainting** | Soft mask, image recreation | Pixel-level replacement |
| **Variations** | Not supported | Supported via /variations |
| **Pricing (1024x1024)** | $0.03 (standard) - $0.05 (high) | $0.04 (standard) - $0.08 (HD) |
| **Deprecation** | Active, current flagship | Deprecated May 12, 2026 |

**Recommendation:** Use GPT Image 1.5 as primary model. DALL-E 3 will be deprecated in less than a month.

### 1.2 API Capabilities

#### Generation
```typescript
POST https://api.openai.com/v1/images/generations

{
  "model": "gpt-image-1.5",
  "prompt": "cyberpunk terminal interface with neon green display...",
  "size": "1024x1024",
  "quality": "standard",
  "n": 1,
  "response_format": "b64_json" // or "url"
}
```

**Supported Sizes:**
- Square: 1024x1024
- Portrait: 1024x1536
- Landscape: 1536x1024
- High-res (GPT Image 1.5): up to 2048x2048

**Quality Settings:**
- `low`: Fast, lower fidelity ($0.009-0.03)
- `standard`: Balanced quality/speed ($0.03-0.11)
- `high`: Maximum detail, slower ($0.05-0.19)

#### Editing (Inpainting)
```typescript
POST https://api.openai.com/v1/images/edits

{
  "model": "gpt-image-1",
  "image": "@chrome.png", // base64 or file upload
  "mask": "@mask.png",    // optional: transparent = edit area
  "prompt": "add neon blue highlights to the terminal frame",
  "size": "1024x1024"
}
```

**Important Note:** GPT Image 1.5 uses "soft mask" approach - recreates entire image with guidance, not pixel-perfect inpainting like DALL-E 2. For precise edits, may need external tools.

#### Variations (DALL-E 2 only)
```typescript
POST https://api.openai.com/v1/images/variations

{
  "model": "dall-e-2",
  "image": "@chrome.png",
  "n": 3, // generate 3 variations
  "size": "1024x1024"
}
```

**Limitation:** GPT Image models don't support variations endpoint yet. Consider iterative prompting instead.

### 1.3 Rate Limits & Quotas

| Tier | Rate Limit | Context |
|------|-----------|---------|
| Free Trial | 3 requests/min | 1 image/request |
| Tier 1 | 5 requests/min | After $5+ in credits |
| Tier 2 | 7 requests/min | After $50+ in credits |
| Tier 3+ | 10+ requests/min | $100+ in credits |

**DALL-E 3 specific:** 7 images/minute on standard tier.

**Best Practice:** Implement client-side rate limiting UI to prevent hitting API limits. Show user countdown timer between generations.

### 1.4 Pricing Breakdown (as of April 2026)

#### GPT Image 1.5
| Size | Quality | Price | Best For |
|------|---------|-------|----------|
| 1024x1024 | low | $0.009 | Rapid iteration |
| 1024x1024 | standard | $0.03 | Production skins |
| 1024x1024 | high | $0.05 | High-detail artwork |
| 1536x1024 | standard | $0.06 | Landscape chrome |
| 2048x2048 | high | $0.19 | Maximum fidelity |

**Terminai Use Case:** Most skins are 600-1200px wide. Standard quality at 1024x1024 ($0.03) is ideal.

**Cost Comparison:**
- 100 iterations: $3.00 (standard) vs $200+ for designer
- Single perfect skin: $0.03-0.05 vs $50-100 commissioned art
- Monthly power user (50 skins): $1.50-2.50

#### DALL-E 3 (for reference, until May 2026)
- 1024x1024 standard: $0.04
- 1024x1024 HD: $0.08
- 1024x1792 HD: $0.12

### 1.5 Authentication & Security

#### API Key Management
```typescript
// NEVER do this (exposed in client)
const apiKey = "sk-proj-...";

// CORRECT: Proxy through Tauri backend
const response = await invoke('generate_image', {
  prompt: "cyberpunk terminal...",
  size: "1024x1024"
});
```

**Security Best Practices:**
1. Store API key in Tauri secure storage (OS keychain)
2. Never send key to frontend
3. Implement server-side request validation
4. Add user rate limiting (e.g., 10 generations/hour)
5. Log all requests for abuse monitoring
6. Use environment variables for development

#### TypeScript SDK
```bash
npm install openai
```

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Server-side only!
});

const image = await client.images.generate({
  model: "gpt-image-1.5",
  prompt: "retro terminal UI with transparent regions",
  size: "1024x1024",
  quality: "standard",
  response_format: "b64_json"
});

const base64Data = image.data[0].b64_json;
```

---

## 2. Prompt Engineering Guide for Terminal Skins

### 2.1 Anatomy of a Great Terminal Skin Prompt

**Template Structure:**
```
[STYLE] + [SUBJECT] + [LAYOUT] + [TECHNICAL SPECS] + [NEGATIVE PROMPTS]
```

#### Example: WinAmp-style Cyberpunk Skin
```
Prompt: "Cyberpunk retro terminal interface in the style of Windows Media Player
classic skin, featuring a main rectangular display area with transparent center for
terminal content, neon green glowing borders, brushed metal texture, small status
displays showing CPU/memory metrics, compact 800x400px layout, dark charcoal
background with cyan accent lights, crisp UI elements, pixel-perfect design,
isometric 3D button style, no text labels, clean transparent PNG with alpha channel"

Negative: "photorealistic, blurry, text overlays, cluttered, asymmetric"
```

**Generated Output:** ✅ Clean chrome with defined regions for terminal placement

### 2.2 Style Presets for Common Aesthetics

#### 1. **Cyberpunk/Hacker**
```
Style Keywords:
- "neon green terminal, CRT scanlines, matrix-style, glowing phosphor"
- "cyberpunk dystopian UI, holographic overlays, digital rain effect"
- "retro-futuristic command center, blade runner aesthetic"
- "terminal green (#4AF626), amber warnings, red alerts"

Technical:
- High contrast for readability
- Dark backgrounds (black, charcoal, navy)
- Glowing elements for visual interest
```

#### 2. **Minimalist Modern**
```
Style Keywords:
- "clean minimal interface, Notion-style, flat design"
- "glassmorphic terminal window, frosted acrylic blur"
- "macOS Big Sur aesthetic, subtle shadows, rounded corners"
- "neutral grays, single accent color, typography-focused"

Technical:
- Soft shadows and depth
- Ample whitespace
- Subtle gradients
```

#### 3. **Retro/Vintage**
```
Style Keywords:
- "Windows 98 UI, skeuomorphic design, faux 3D buttons"
- "1980s personal computer aesthetic, beige plastic, VGA monitor"
- "terminal amber monochrome display, DOS-era, IBM PC style"
- "chunky pixels, dithered gradients, limited color palette"

Technical:
- Pixel art style at 2x-4x scale
- Authentic retro color limitations
- Fake CRT curvature and bloom
```

#### 4. **Sci-Fi/Space Opera**
```
Style Keywords:
- "spaceship control panel, Star Trek LCARS interface"
- "alien technology terminal, exotic glyphs, energy conduits"
- "space station monitoring system, tactical overlay"
- "futuristic military HUD, heads-up display, angular design"

Technical:
- Angled/diagonal elements
- Data readouts and graphs
- Warning indicators
```

#### 5. **Organic/Nature**
```
Style Keywords:
- "wooden terminal frame, steampunk brass accents, analog gauges"
- "nature-inspired UI, leaf patterns, earth tones, bio-morphic"
- "hand-drawn sketch aesthetic, paper texture, ink lines"
- "zen minimal, bamboo texture, tea ceremony aesthetic"

Technical:
- Natural textures (wood grain, stone, fabric)
- Warm color palettes
- Organic shapes vs hard edges
```

### 2.3 Critical Elements for Terminal Skins

#### Transparent Region Specification
```
Prompt Component: "...with a large rectangular transparent area in the center
measuring approximately 60% of total width and 70% of height, positioned
slightly off-center, surrounded by decorative chrome frame..."

Why: OpenAI models struggle with true transparency. Specify a "window" or
"display area" that can be post-processed.
```

#### Resolution & Aspect Ratio
```
Common Terminal Sizes:
- Small: 600x400px (retro compact)
- Medium: 800x500px (balanced)
- Large: 1200x700px (immersive)
- Ultrawide: 1400x600px (cinematic)

Prompt Strategy: Generate at 1024x1024 or 1536x1024, then specify
"designed for 800x500px terminal window" to ensure readable UI elements
```

#### UI Element Positioning
```
Prompt: "terminal skin layout with these regions:
- Main terminal display: center, 400x300px transparent rectangle
- Status bar: bottom edge, 20px tall, full width
- Memory indicator: top-right corner, 80x60px
- Agent status: top-left, 150x40px
- Decorative elements: corners and edges only, no overlap with display areas"
```

**Pro Tip:** Use compass directions (top-left, center-right, etc.) rather than pixel coordinates in prompts. AI models understand spatial relationships better.

### 2.4 Negative Prompts (What to Avoid)

```typescript
const negativePrompts = [
  "text labels",           // AI-generated text is often garbled
  "photorealistic",        // We want crisp UI, not photos
  "blurry",               // Skins need sharp edges
  "3D render",            // Unless specifically desired
  "asymmetric",           // Hard to define regions
  "cluttered",            // Reduces usable space
  "watermark",            // Self-explanatory
  "human faces",          // Rarely needed for terminals
];

// Usage in API call:
const prompt = `${positivePrompt}. Negative: ${negativePrompts.join(', ')}`;
```

### 2.5 Iterative Refinement Strategies

#### Strategy 1: Broad → Specific
```
Iteration 1: "cyberpunk terminal UI"
  → Output: Too generic, cluttered

Iteration 2: "clean cyberpunk terminal with single large display area"
  → Output: Better, but wrong colors

Iteration 3: "clean cyberpunk terminal, single large display, neon green accents, dark background"
  → Output: ✅ Close to desired result
```

#### Strategy 2: Style Transfer Prompting
```
"Terminal interface in the style of [reference]:
- WinAmp Classic skin
- Star Trek LCARS panel
- Cyberpunk 2077 UI
- Notion app interface
- Fallout Pip-Boy display"
```

#### Strategy 3: Composition-First
```
Step 1: "simple rectangular terminal frame, minimalist, single display window"
Step 2: Use editing API to add "neon accents and cyberpunk details"
Step 3: Fine-tune colors and effects
```

### 2.6 Template Library (Ready-to-Use Prompts)

#### Template A: Hacker Terminal
```json
{
  "name": "Matrix Hacker",
  "prompt": "Retro hacker terminal interface, black background with neon green (#00FF41) glowing text area, single large rectangular display window centered, scanline CRT effect, minimal chrome frame with circuit board texture, small status indicators in corners showing 'UPLINK', 'ENCRYPT', 'SECURE', 800x500px layout, dark aesthetic, pixel-perfect UI",
  "negative": "text labels, photorealistic, blurry, 3D",
  "settings": {
    "size": "1024x1024",
    "quality": "standard"
  }
}
```

#### Template B: Glassmorphic Modern
```json
{
  "name": "Frosted Glass",
  "prompt": "Modern glassmorphic terminal window with frosted acrylic blur effect, subtle gradient from slate to charcoal, single centered terminal display with rounded corners (12px radius), floating UI aesthetic, soft drop shadows, minimal chrome, small circular status indicators top-right (green, yellow, red), 1000x600px, clean and minimalist",
  "negative": "cluttered, neon, retro, skeuomorphic",
  "settings": {
    "size": "1024x1024",
    "quality": "high"
  }
}
```

#### Template C: Retro PC
```json
{
  "name": "Windows 98 Nostalgia",
  "prompt": "Windows 98 style terminal application window, classic gray (#C0C0C0) chrome with 3D beveled edges, chunky title bar with minimize/maximize/close buttons, single terminal display area with inset shadow, status bar at bottom with resize grip, pixel art style, nostalgic 1990s UI, 800x500px",
  "negative": "modern, flat design, neon, gradients",
  "settings": {
    "size": "1024x1024",
    "quality": "standard"
  }
}
```

#### Template D: Sci-Fi Command Center
```json
{
  "name": "LCARS Terminal",
  "prompt": "Star Trek LCARS-inspired terminal interface, orange (#FF9900) and purple (#CC99CC) accent colors on black, angular geometric panels, main terminal display in center, side status bars with data readouts, rounded pill-shaped buttons, futuristic command center aesthetic, 1200x700px wide layout",
  "negative": "photorealistic, organic, rounded, minimal",
  "settings": {
    "size": "1536x1024",
    "quality": "standard"
  }
}
```

---

## 3. Architecture Design

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Terminai Skin Editor                     │
│                      (Browser/Vite)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │  Prompt Builder  │      │  Generation UI   │           │
│  │  - Style presets │      │  - Progress bar  │           │
│  │  - Custom input  │      │  - Preview modal │           │
│  │  - Templates     │      │  - Cost estimate │           │
│  └────────┬─────────┘      └────────┬─────────┘           │
│           │                         │                      │
│           ▼                         ▼                      │
│  ┌────────────────────────────────────────┐               │
│  │       Image Generation Manager         │               │
│  │  - Queue management                    │               │
│  │  - Caching (IndexedDB)                 │               │
│  │  - Error handling                      │               │
│  └────────────────┬───────────────────────┘               │
│                   │                                        │
└───────────────────┼────────────────────────────────────────┘
                    │ invoke('generate_image', {...})
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Backend (Rust)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────┐               │
│  │     OpenAI API Proxy Command           │               │
│  │  - API key from secure storage         │               │
│  │  - Request validation                  │               │
│  │  - Rate limiting                       │               │
│  │  - Usage tracking                      │               │
│  └────────────────┬───────────────────────┘               │
│                   │                                        │
└───────────────────┼────────────────────────────────────────┘
                    │ HTTPS POST
                    ▼
           ┌─────────────────────┐
           │   OpenAI API        │
           │  GPT Image 1.5      │
           └─────────────────────┘
```

### 3.2 Frontend Integration Points

#### Location in Skin Editor
```
tools/skin-editor/
├── src/
│   ├── main.ts                    # Core editor logic
│   ├── types.ts                   # Type definitions
│   ├── ai/                        # NEW: AI generation module
│   │   ├── image-generator.ts     # OpenAI integration
│   │   ├── prompt-builder.ts      # Prompt construction
│   │   ├── region-detector.ts     # CV-based region suggestions
│   │   └── templates.ts           # Preset prompts
│   └── ui/                        # NEW: AI UI components
│       ├── generation-modal.ts    # Prompt input dialog
│       ├── progress-tracker.ts    # Generation progress
│       └── cost-estimator.ts      # Price calculation
```

#### UI Placement Options

**Option A: Dedicated "Generate" Tab** (Recommended)
```html
<!-- In index.html -->
<div class="toolbar">
  <button id="load-chrome">Load Chrome</button>
  <button id="load-wmz">Load WMZ</button>
  <button id="generate-chrome">🎨 Generate with AI</button> <!-- NEW -->
  <button id="export-manifest">Export</button>
</div>

<!-- Modal for AI generation -->
<dialog id="ai-generation-modal">
  <h2>Generate Terminal Skin</h2>
  <div class="prompt-builder">
    <label>Style Preset:</label>
    <select id="style-preset">
      <option value="cyberpunk">Cyberpunk Hacker</option>
      <option value="minimal">Minimal Modern</option>
      <option value="retro">Retro/Vintage</option>
      <option value="scifi">Sci-Fi Command</option>
      <option value="custom">Custom Prompt</option>
    </select>

    <label>Custom Prompt:</label>
    <textarea id="custom-prompt" rows="4"
      placeholder="Describe your ideal terminal skin..."></textarea>

    <label>Size:</label>
    <select id="generation-size">
      <option value="1024x1024">1024x1024 (Square)</option>
      <option value="1536x1024">1536x1024 (Landscape)</option>
    </select>

    <label>Quality:</label>
    <select id="generation-quality">
      <option value="standard">Standard ($0.03)</option>
      <option value="high">High ($0.05)</option>
    </select>

    <div class="cost-estimate">
      Estimated cost: <strong>$0.03</strong>
    </div>
  </div>

  <div class="actions">
    <button id="generate-btn">Generate</button>
    <button id="cancel-btn">Cancel</button>
  </div>

  <div id="generation-progress" style="display: none;">
    <progress value="0" max="100"></progress>
    <p>Generating your skin... (10-30 seconds)</p>
  </div>
</dialog>
```

**Option B: Inline "Magic Wand" Button**
- Smaller button next to "Load Chrome"
- Opens same modal
- Less prominent but always accessible

### 3.3 Backend Implementation (Rust/Tauri)

#### New Tauri Command
```rust
// src-tauri/src/commands.rs

use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Deserialize)]
pub struct ImageGenerationRequest {
    prompt: String,
    size: String,      // "1024x1024", "1536x1024"
    quality: String,   // "standard", "high"
    model: String,     // "gpt-image-1.5"
}

#[derive(Serialize)]
pub struct ImageGenerationResponse {
    image_data: String,  // base64 encoded PNG
    revised_prompt: Option<String>,  // OpenAI's prompt rewrite
    cost_estimate: f32,
}

#[command]
pub async fn generate_image(
    request: ImageGenerationRequest,
    state: tauri::State<'_, AppState>,
) -> Result<ImageGenerationResponse, String> {
    // 1. Retrieve API key from secure storage
    let api_key = state.config.openai_api_key
        .as_ref()
        .ok_or("OpenAI API key not configured")?;

    // 2. Rate limiting check
    if !state.rate_limiter.check_allowance("image_gen") {
        return Err("Rate limit exceeded. Please wait.".to_string());
    }

    // 3. Build OpenAI API request
    let client = reqwest::Client::new();
    let openai_request = serde_json::json!({
        "model": request.model,
        "prompt": request.prompt,
        "size": request.size,
        "quality": request.quality,
        "response_format": "b64_json"
    });

    // 4. Make API call
    let response = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&openai_request)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    // 5. Parse response
    let openai_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let image_b64 = openai_response["data"][0]["b64_json"]
        .as_str()
        .ok_or("No image data in response")?
        .to_string();

    let revised_prompt = openai_response["data"][0]["revised_prompt"]
        .as_str()
        .map(|s| s.to_string());

    // 6. Calculate cost
    let cost = calculate_cost(&request.size, &request.quality);

    // 7. Log usage
    state.usage_tracker.log_generation(cost);

    Ok(ImageGenerationResponse {
        image_data: image_b64,
        revised_prompt,
        cost_estimate: cost,
    })
}

fn calculate_cost(size: &str, quality: &str) -> f32 {
    match (size, quality) {
        ("1024x1024", "standard") => 0.03,
        ("1024x1024", "high") => 0.05,
        ("1536x1024", "standard") => 0.06,
        ("1536x1024", "high") => 0.10,
        _ => 0.03, // default
    }
}
```

#### Dependencies to Add
```toml
# src-tauri/Cargo.toml

[dependencies]
# Existing...
reqwest = { version = "0.11", features = ["json"] }
base64 = "0.21"
```

### 3.4 Frontend Implementation (TypeScript)

#### Image Generator Module
```typescript
// tools/skin-editor/src/ai/image-generator.ts

import { invoke } from '@tauri-apps/api/core';

export interface GenerationOptions {
  prompt: string;
  size: '1024x1024' | '1536x1024';
  quality: 'standard' | 'high';
  model?: string;
}

export interface GenerationResult {
  imageData: string;      // base64 PNG
  revisedPrompt?: string;
  costEstimate: number;
}

export class ImageGenerator {
  private static generationCount = 0;

  /**
   * Generate a terminal skin chrome image using OpenAI API
   */
  static async generate(
    options: GenerationOptions,
    onProgress?: (status: string) => void
  ): Promise<GenerationResult> {
    try {
      onProgress?.('Preparing request...');

      // Validate prompt
      if (!options.prompt.trim()) {
        throw new Error('Prompt cannot be empty');
      }

      onProgress?.('Contacting OpenAI...');

      // Call Tauri backend
      const result = await invoke<GenerationResult>('generate_image', {
        request: {
          prompt: options.prompt,
          size: options.size,
          quality: options.quality,
          model: options.model || 'gpt-image-1.5',
        },
      });

      onProgress?.('Image generated!');
      this.generationCount++;

      // Cache the result
      await this.cacheImage(options.prompt, result);

      return result;
    } catch (error) {
      console.error('[ImageGenerator] Error:', error);
      throw new Error(`Generation failed: ${error}`);
    }
  }

  /**
   * Check if we have a cached version of this prompt
   */
  static async getCached(prompt: string): Promise<GenerationResult | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('generations', 'readonly');
      const store = tx.objectStore('generations');
      const result = await store.get(prompt);
      return result || null;
    } catch (error) {
      console.warn('[ImageGenerator] Cache check failed:', error);
      return null;
    }
  }

  /**
   * Save generated image to IndexedDB cache
   */
  private static async cacheImage(
    prompt: string,
    result: GenerationResult
  ): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('generations', 'readwrite');
      const store = tx.objectStore('generations');

      await store.put({
        prompt,
        result,
        timestamp: Date.now(),
      });

      await tx.done;
    } catch (error) {
      console.warn('[ImageGenerator] Cache save failed:', error);
    }
  }

  /**
   * Open IndexedDB for caching
   */
  private static async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TerminaiAICache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('generations')) {
          db.createObjectStore('generations', { keyPath: 'prompt' });
        }
      };
    });
  }

  /**
   * Get total generation count (for analytics)
   */
  static getGenerationCount(): number {
    return this.generationCount;
  }
}
```

#### Prompt Builder
```typescript
// tools/skin-editor/src/ai/prompt-builder.ts

export interface PromptTemplate {
  name: string;
  description: string;
  basePrompt: string;
  negativePrompt: string;
  suggestedSize: '1024x1024' | '1536x1024';
}

export const PRESET_TEMPLATES: Record<string, PromptTemplate> = {
  cyberpunk: {
    name: 'Cyberpunk Hacker',
    description: 'Matrix-style terminal with neon green accents',
    basePrompt: 'Retro hacker terminal interface, black background with neon green (#00FF41) glowing text area, single large rectangular display window centered, scanline CRT effect, minimal chrome frame with circuit board texture, small status indicators in corners, 800x500px layout, dark aesthetic, pixel-perfect UI',
    negativePrompt: 'text labels, photorealistic, blurry, 3D',
    suggestedSize: '1024x1024',
  },

  minimal: {
    name: 'Minimal Modern',
    description: 'Clean glassmorphic design',
    basePrompt: 'Modern glassmorphic terminal window with frosted acrylic blur effect, subtle gradient from slate to charcoal, single centered terminal display with rounded corners (12px radius), floating UI aesthetic, soft drop shadows, minimal chrome, small circular status indicators top-right (green, yellow, red), 1000x600px, clean and minimalist',
    negativePrompt: 'cluttered, neon, retro, skeuomorphic',
    suggestedSize: '1024x1024',
  },

  retro: {
    name: 'Retro Windows 98',
    description: 'Nostalgic 90s interface',
    basePrompt: 'Windows 98 style terminal application window, classic gray (#C0C0C0) chrome with 3D beveled edges, chunky title bar with minimize/maximize/close buttons, single terminal display area with inset shadow, status bar at bottom with resize grip, pixel art style, nostalgic 1990s UI, 800x500px',
    negativePrompt: 'modern, flat design, neon, gradients',
    suggestedSize: '1024x1024',
  },

  scifi: {
    name: 'Sci-Fi LCARS',
    description: 'Star Trek command interface',
    basePrompt: 'Star Trek LCARS-inspired terminal interface, orange (#FF9900) and purple (#CC99CC) accent colors on black, angular geometric panels, main terminal display in center, side status bars with data readouts, rounded pill-shaped buttons, futuristic command center aesthetic, 1200x700px wide layout',
    negativePrompt: 'photorealistic, organic, rounded, minimal',
    suggestedSize: '1536x1024',
  },
};

export class PromptBuilder {
  /**
   * Build final prompt from template + user customization
   */
  static buildPrompt(
    template: PromptTemplate,
    customAdditions?: string
  ): string {
    let prompt = template.basePrompt;

    if (customAdditions?.trim()) {
      prompt += `. ${customAdditions}`;
    }

    // Append negative prompts
    prompt += `. Negative: ${template.negativePrompt}`;

    return prompt;
  }

  /**
   * Validate prompt (check for common issues)
   */
  static validatePrompt(prompt: string): string[] {
    const warnings: string[] = [];

    if (prompt.length < 20) {
      warnings.push('Prompt is very short. Consider adding more detail.');
    }

    if (prompt.length > 1000) {
      warnings.push('Prompt is very long. Consider simplifying.');
    }

    if (prompt.includes('transparent background')) {
      warnings.push('AI models cannot generate true transparency. Specify a "display area" instead.');
    }

    if (!/\d+x\d+/.test(prompt)) {
      warnings.push('Consider specifying target dimensions (e.g., 800x500px) in prompt.');
    }

    return warnings;
  }
}
```

#### UI Controller
```typescript
// tools/skin-editor/src/ui/generation-modal.ts

import { ImageGenerator } from '../ai/image-generator';
import { PromptBuilder, PRESET_TEMPLATES } from '../ai/prompt-builder';

export class GenerationModal {
  private modal: HTMLDialogElement;
  private isGenerating = false;

  constructor() {
    this.modal = document.getElementById('ai-generation-modal') as HTMLDialogElement;
    this.initializeEventListeners();
  }

  open(): void {
    this.modal.showModal();
  }

  close(): void {
    this.modal.close();
  }

  private initializeEventListeners(): void {
    // Generate button
    document.getElementById('generate-btn')?.addEventListener('click', () => {
      this.handleGenerate();
    });

    // Cancel button
    document.getElementById('cancel-btn')?.addEventListener('click', () => {
      this.close();
    });

    // Style preset change
    document.getElementById('style-preset')?.addEventListener('change', (e) => {
      this.handlePresetChange((e.target as HTMLSelectElement).value);
    });

    // Cost estimation on quality change
    document.getElementById('generation-quality')?.addEventListener('change', () => {
      this.updateCostEstimate();
    });

    document.getElementById('generation-size')?.addEventListener('change', () => {
      this.updateCostEstimate();
    });
  }

  private handlePresetChange(presetKey: string): void {
    const template = PRESET_TEMPLATES[presetKey];
    if (!template) return;

    const customPrompt = document.getElementById('custom-prompt') as HTMLTextAreaElement;
    customPrompt.placeholder = `Base: ${template.basePrompt}\n\nAdd your customizations here...`;

    const sizeSelect = document.getElementById('generation-size') as HTMLSelectElement;
    sizeSelect.value = template.suggestedSize;

    this.updateCostEstimate();
  }

  private updateCostEstimate(): void {
    const size = (document.getElementById('generation-size') as HTMLSelectElement).value;
    const quality = (document.getElementById('generation-quality') as HTMLSelectElement).value;

    const costs: Record<string, number> = {
      '1024x1024_standard': 0.03,
      '1024x1024_high': 0.05,
      '1536x1024_standard': 0.06,
      '1536x1024_high': 0.10,
    };

    const cost = costs[`${size}_${quality}`] || 0.03;

    const estimateEl = document.querySelector('.cost-estimate strong');
    if (estimateEl) {
      estimateEl.textContent = `$${cost.toFixed(2)}`;
    }
  }

  private async handleGenerate(): Promise<void> {
    if (this.isGenerating) return;

    try {
      this.isGenerating = true;

      // Get form values
      const presetKey = (document.getElementById('style-preset') as HTMLSelectElement).value;
      const customPrompt = (document.getElementById('custom-prompt') as HTMLTextAreaElement).value;
      const size = (document.getElementById('generation-size') as HTMLSelectElement).value as '1024x1024' | '1536x1024';
      const quality = (document.getElementById('generation-quality') as HTMLSelectElement).value as 'standard' | 'high';

      // Build final prompt
      const template = PRESET_TEMPLATES[presetKey];
      const finalPrompt = template
        ? PromptBuilder.buildPrompt(template, customPrompt)
        : customPrompt;

      // Validate
      const warnings = PromptBuilder.validatePrompt(finalPrompt);
      if (warnings.length > 0) {
        const proceed = confirm(`Warnings:\n${warnings.join('\n')}\n\nContinue anyway?`);
        if (!proceed) {
          this.isGenerating = false;
          return;
        }
      }

      // Show progress UI
      this.showProgress();

      // Generate image
      const result = await ImageGenerator.generate(
        { prompt: finalPrompt, size, quality },
        (status) => this.updateProgress(status)
      );

      // Import generated image into editor
      await this.importGeneratedImage(result.imageData);

      // Show success
      alert(`Image generated successfully!\nCost: $${result.costEstimate.toFixed(2)}`);

      this.close();

    } catch (error) {
      console.error('[GenerationModal] Error:', error);
      alert(`Generation failed: ${error}`);
    } finally {
      this.isGenerating = false;
      this.hideProgress();
    }
  }

  private showProgress(): void {
    const progressDiv = document.getElementById('generation-progress');
    if (progressDiv) {
      progressDiv.style.display = 'block';
    }

    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    generateBtn.disabled = true;
  }

  private hideProgress(): void {
    const progressDiv = document.getElementById('generation-progress');
    if (progressDiv) {
      progressDiv.style.display = 'none';
    }

    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    generateBtn.disabled = false;
  }

  private updateProgress(status: string): void {
    const progressText = document.querySelector('#generation-progress p');
    if (progressText) {
      progressText.textContent = status;
    }
  }

  private async importGeneratedImage(base64Data: string): Promise<void> {
    // Convert base64 to blob
    const blob = await fetch(`data:image/png;base64,${base64Data}`).then(r => r.blob());

    // Create File object
    const file = new File([blob], 'generated-chrome.png', { type: 'image/png' });

    // Trigger existing chrome load handler
    const event = new Event('change');
    Object.defineProperty(event, 'target', {
      value: { files: [file] },
      enumerable: true,
    });

    const loadChromeInput = document.getElementById('load-chrome') as HTMLInputElement;
    loadChromeInput.dispatchEvent(event);
  }
}
```

### 3.5 Data Flow Diagram

```
User Action: Click "Generate with AI"
     │
     ▼
Open Generation Modal
  └─ Select style preset (cyberpunk, minimal, etc.)
  └─ Add custom prompt text
  └─ Choose size (1024x1024, 1536x1024)
  └─ Select quality (standard, high)
  └─ View cost estimate ($0.03-$0.10)
     │
     ▼
Click "Generate"
     │
     ▼
Frontend: PromptBuilder.buildPrompt()
  └─ Combine template + custom text + negatives
  └─ Validate prompt (check warnings)
     │
     ▼
Frontend: ImageGenerator.generate()
  └─ Check cache (IndexedDB) for identical prompt
  └─ If cached → return immediately
  └─ If not cached → continue
     │
     ▼
Tauri IPC: invoke('generate_image', {...})
     │
     ▼
Backend: Rust command handler
  └─ Retrieve API key from secure storage
  └─ Rate limiting check (10 req/hour)
  └─ Build OpenAI API request JSON
     │
     ▼
HTTP POST: https://api.openai.com/v1/images/generations
  └─ Authorization: Bearer sk-proj-...
  └─ Body: { model, prompt, size, quality, response_format }
     │
     ▼
OpenAI Server Processing (10-30 seconds)
     │
     ▼
OpenAI Response: { data: [{ b64_json: "..." }] }
     │
     ▼
Backend: Parse response
  └─ Extract base64 image data
  └─ Calculate cost
  └─ Log usage
     │
     ▼
Return to Frontend: { imageData, revisedPrompt, costEstimate }
     │
     ▼
Frontend: Receive generated image
  └─ Cache in IndexedDB
  └─ Convert base64 → Blob → File
  └─ Trigger existing handleChromeLoad()
     │
     ▼
Image loaded into editor canvas
  └─ User can now define regions
  └─ Export manifest when ready
```

---

## 4. Prompt Engineering for Transparent Regions

### 4.1 The Transparency Challenge

**Problem:** AI image generators (DALL-E, GPT Image, Stable Diffusion) cannot natively generate true alpha channel transparency. They predict pixel colors, not transparency values.

**Current Workarounds:**

1. **Post-Processing with Background Removal**
   - Generate image with solid background
   - Use segmentation model (SAM, YOLO) to detect subject
   - Remove background → create alpha channel
   - ❌ **Issue:** Doesn't work well for UI elements (no clear "subject")

2. **Black/White Background Comparison**
   - Generate same image on white background
   - Generate same image on black background
   - Compare pixel differences to infer alpha
   - ✅ **Best for:** Semi-transparent glass effects
   - ❌ **Issue:** Requires 2x generations (2x cost)

3. **Prompt for "Window" or "Display Area"**
   - Ask for a clear rectangular region in prompt
   - Post-process to make that region transparent
   - ✅ **Best for:** Terminal skins (our use case!)
   - ✅ **Simple, reliable, single generation**

### 4.2 Recommended Approach for Terminai

**Strategy:** Generate chrome with visually distinct display area, then use edge detection + flood fill to create transparency.

#### Step 1: Prompt Engineering
```
Prompt: "Terminal interface with BRIGHT MAGENTA (#FF00FF) rectangular display
area in center, surrounded by [style] chrome frame. The magenta area should be
a solid flat color with crisp edges, measuring 60% of width and 70% of height."
```

**Why Magenta?**
- Unlikely to appear in chrome design
- High contrast with common UI colors
- Easy to detect programmatically

#### Step 2: Post-Processing
```typescript
// tools/skin-editor/src/ai/transparency-processor.ts

export class TransparencyProcessor {
  /**
   * Convert solid-color region to transparency
   */
  static async makeRegionTransparent(
    imageData: string,
    targetColor: string = '#FF00FF', // magenta
    tolerance: number = 10
  ): Promise<string> {
    // Load image into canvas
    const img = await this.loadImage(imageData);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;

    // Parse target color
    const target = this.hexToRgb(targetColor);

    // Replace target color with transparency
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if pixel matches target color (within tolerance)
      const dist = Math.sqrt(
        Math.pow(r - target.r, 2) +
        Math.pow(g - target.g, 2) +
        Math.pow(b - target.b, 2)
      );

      if (dist < tolerance) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }

    ctx.putImageData(pixels, 0, 0);

    // Return as base64 PNG
    return canvas.toDataURL('image/png');
  }

  /**
   * Auto-detect rectangular region to make transparent
   */
  static async autoDetectRegion(imageData: string): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null> {
    const img = await this.loadImage(imageData);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    // Edge detection (Sobel operator)
    const edges = this.detectEdges(ctx, canvas.width, canvas.height);

    // Find largest rectangle
    const rect = this.findLargestRectangle(edges);

    return rect;
  }

  private static loadImage(dataUri: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUri;
    });
  }

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  private static detectEdges(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): boolean[][] {
    // Simplified edge detection (Sobel)
    const pixels = ctx.getImageData(0, 0, width, height);
    const edges: boolean[][] = Array(height).fill(0).map(() => Array(width).fill(false));

    // ... (implement Sobel operator)

    return edges;
  }

  private static findLargestRectangle(edges: boolean[][]): any {
    // ... (implement rectangle detection algorithm)
    // Could use OpenCV.js or custom implementation
  }
}
```

**Usage in Generation Flow:**
```typescript
// After receiving generated image
const generatedImage = await ImageGenerator.generate(...);

// Post-process to add transparency
const transparentImage = await TransparencyProcessor.makeRegionTransparent(
  generatedImage.imageData,
  '#FF00FF', // magenta marker
  15         // tolerance
);

// Import into editor
await this.importGeneratedImage(transparentImage);
```

### 4.3 Alternative: Prompt for Solid Color Regions

Instead of magenta marker, prompt for specific colors that represent functional areas:

```
Prompt: "Terminal interface with these color-coded regions:
- BLACK (#000000) rectangle in center = terminal display area
- DARK GRAY (#333333) bar at bottom = status area
- MEDIUM GRAY (#666666) corners = decorative indicators
Surround these with [style] chrome frame."
```

Then use color-based region detection in Phase 2 (see Section 5.2).

---

## 5. Implementation Roadmap

### Phase 1: Basic Generation & Import (2 weeks)

**Goal:** Users can generate chrome images from prompts and import them into the editor.

#### Week 1: Backend Foundation
- [ ] Add OpenAI API proxy command to Tauri
  - Rust dependencies: `reqwest`, `base64`
  - Implement `generate_image` command
  - API key management (secure storage)
  - Error handling and logging
- [ ] Add rate limiting (10 generations/hour)
- [ ] Usage tracking for cost monitoring
- [ ] Unit tests for API integration

#### Week 2: Frontend UI
- [ ] Create generation modal UI
  - Style preset dropdown
  - Custom prompt textarea
  - Size/quality selectors
  - Cost estimator
- [ ] Implement `ImageGenerator` class
  - Tauri IPC integration
  - IndexedDB caching
  - Progress callbacks
- [ ] Implement `PromptBuilder` class
  - Preset templates (4-5 styles)
  - Prompt validation
- [ ] Wire up "Generate with AI" button
- [ ] Import generated image into editor canvas
- [ ] User testing and bug fixes

**Deliverables:**
- Working AI generation button in skin editor
- 5 preset styles (cyberpunk, minimal, retro, sci-fi, organic)
- Cost estimation displayed to user
- Generated images automatically imported

**Success Metrics:**
- Generation completes in <60 seconds
- 80%+ of generations produce usable chrome
- No API key exposure in frontend

---

### Phase 2: Smart Region Detection (2 weeks)

**Goal:** Automatically suggest region placements based on generated image analysis.

#### Week 3: Computer Vision Integration
- [ ] Research CV libraries for browser
  - Option A: OpenCV.js (full-featured, 8MB)
  - Option B: TensorFlow.js + COCO-SSD (lighter)
  - Option C: Custom edge detection (minimal)
- [ ] Implement edge detection algorithm
  - Sobel operator for sharp boundaries
  - Color-based segmentation
- [ ] Rectangle detection
  - Find largest contiguous rectangular areas
  - Filter by aspect ratio (terminal-like)
- [ ] Region classification heuristics
  - Center large rectangle → terminal
  - Bottom thin rectangle → status bar
  - Corners/edges → decorative

#### Week 4: Auto-Region UI
- [ ] After generation, show "Detect Regions" button
- [ ] Overlay suggested regions on canvas
  - Different colors for different types
  - Confidence scores (0-100%)
- [ ] Allow user to accept/reject/adjust
- [ ] One-click "Accept All" to add regions
- [ ] Integration tests with various styles

**Deliverables:**
- Automatic region detection working for 60%+ of generated images
- User can accept/modify suggestions
- Reduces time to create skin from 15 min → 5 min

**Success Metrics:**
- Region detection accuracy >60% for terminal area
- User accepts at least 1 suggested region in 80%+ of cases
- False positive rate <20%

**Optional Enhancement:**
- Train custom ML model on hand-labeled terminal skins
- Use Segment Anything Model (SAM) for precise boundaries

---

### Phase 3: Iterative Refinement (1-2 weeks)

**Goal:** Enable users to refine generated images without starting from scratch.

#### Week 5-6: Editing Features
- [ ] Implement inpainting workflow
  - User draws mask over area to regenerate
  - Prompt for changes: "make this area darker"
  - Call OpenAI edit endpoint
- [ ] Variation generation (if using DALL-E 2)
  - "Generate 3 variations" button
  - Side-by-side comparison
- [ ] Prompt history
  - Save previous prompts
  - "Regenerate with tweaks" button
- [ ] A/B comparison view
  - Compare 2 generated versions
  - Pick best elements from each

**Deliverables:**
- Inpainting tool for targeted edits
- Prompt history saves last 20 prompts
- Variation generation (if available)

**Success Metrics:**
- Users iterate 2-3 times on average before finalizing
- Inpainting reduces need for full regeneration by 40%
- Prompt history used in 50%+ of sessions

---

## 6. User Flow Mockup

### 6.1 Happy Path: First-Time User

**Scenario:** User wants to create a cyberpunk hacker terminal skin.

```
Step 1: Open Skin Editor
  └─ Navigate to tools/skin-editor/ in browser
  └─ See empty canvas with "Load Chrome" and "Generate with AI" buttons

Step 2: Click "Generate with AI"
  └─ Modal opens with prompt builder
  └─ User sees style presets dropdown

Step 3: Select "Cyberpunk Hacker" preset
  └─ Preview of base prompt appears
  └─ Cost estimate shows: "$0.03"
  └─ Optional: User adds custom text "with purple accents"

Step 4: Click "Generate"
  └─ Modal shows progress bar
  └─ Status updates: "Contacting OpenAI..." → "Generating..." → "Done!"
  └─ Takes ~20 seconds

Step 5: Image Loads into Editor
  └─ Canvas now shows generated chrome
  └─ "Detect Regions" button appears

Step 6: Click "Detect Regions"
  └─ AI overlays suggested regions:
      - Green box: "Terminal (95% confidence)"
      - Blue box: "Status Bar (80% confidence)"
      - Yellow boxes: "Decorative (60% confidence)"

Step 7: Accept Suggestions
  └─ Click "Accept All"
  └─ Regions added to editor
  └─ User can fine-tune positions with drag/resize

Step 8: Export Manifest
  └─ Click "Export Manifest"
  └─ Downloads manifest.json with embedded chrome image
  └─ Ready to use in Terminai!

Total Time: ~5 minutes (vs 30-60 minutes manual creation)
```

### 6.2 Power User Flow: Iterative Refinement

```
Step 1: Generate initial version
  └─ "Minimal modern terminal, glassmorphic"
  └─ Result: Good, but too dark

Step 2: Refine prompt
  └─ Open prompt history
  └─ Edit previous: "...glassmorphic with lighter background"
  └─ Regenerate
  └─ Result: Better, but status bar too small

Step 3: Inpainting edit
  └─ Select region tool
  └─ Draw mask over status bar area
  └─ Prompt: "make this status bar taller and more prominent"
  └─ Regenerate only that area
  └─ Result: Perfect!

Step 4: Compare versions
  └─ Open comparison view
  └─ See all 3 iterations side-by-side
  └─ Select final version

Step 5: Export
  └─ Download manifest
```

### 6.3 Error Handling Flow

```
Error 1: API Key Not Configured
  └─ User clicks "Generate"
  └─ Error dialog: "OpenAI API key not set. Please configure in Settings."
  └─ Button: "Open Settings"
  └─ User enters API key in Tauri settings panel
  └─ Key saved to secure storage
  └─ Retry generation

Error 2: Rate Limit Exceeded
  └─ User clicks "Generate"
  └─ Error dialog: "Rate limit exceeded. Please wait 5 minutes."
  └─ Show countdown timer
  └─ "Generate" button disabled until cooldown ends

Error 3: Generation Failed (Network)
  └─ User clicks "Generate"
  └─ After 10 seconds, timeout error
  └─ Dialog: "Network error. Check internet connection."
  └─ Button: "Retry"
  └─ On retry: Uses cached request, saves cost

Error 4: Unusable Output
  └─ User generates image
  └─ Result is cluttered/unusable
  └─ User clicks "Regenerate" with same prompt
  └─ Different seed produces better result
  └─ (OpenAI API uses random seed each time)
```

---

## 7. Code Structure Proposal

### 7.1 File Organization

```
terminai/
├── tools/skin-editor/
│   ├── src/
│   │   ├── main.ts                     # Existing: Core editor
│   │   ├── types.ts                    # Existing: Type definitions
│   │   │
│   │   ├── ai/                         # NEW: AI generation module
│   │   │   ├── index.ts                # Public API exports
│   │   │   ├── image-generator.ts      # OpenAI API client
│   │   │   ├── prompt-builder.ts       # Prompt construction
│   │   │   ├── templates.ts            # Preset prompts library
│   │   │   ├── region-detector.ts      # CV-based region detection
│   │   │   └── transparency-processor.ts # Alpha channel handling
│   │   │
│   │   ├── ui/                         # NEW: AI UI components
│   │   │   ├── generation-modal.ts     # Main generation dialog
│   │   │   ├── progress-tracker.ts     # Progress bar component
│   │   │   ├── cost-estimator.ts       # Price calculation widget
│   │   │   ├── region-suggestions.ts   # Auto-detect overlay UI
│   │   │   └── prompt-history.ts       # Previous prompts panel
│   │   │
│   │   └── utils/                      # NEW: Shared utilities
│   │       ├── cache.ts                # IndexedDB wrapper
│   │       └── image-processing.ts     # Canvas helpers
│   │
│   ├── index.html                      # Update: Add AI modal
│   ├── style.css                       # Update: AI UI styles
│   └── package.json                    # Update: Add dependencies
│
└── src-tauri/
    ├── src/
    │   ├── commands.rs                 # Update: Add generate_image
    │   ├── ai.rs                       # NEW: AI module
    │   │   ├── openai_client.rs        # OpenAI HTTP client
    │   │   ├── rate_limiter.rs         # Request throttling
    │   │   └── usage_tracker.rs        # Cost logging
    │   │
    │   └── config.rs                   # NEW: Settings management
    │       └── api_keys.rs             # Secure key storage
    │
    └── Cargo.toml                      # Update: Add reqwest, base64
```

### 7.2 Key Interfaces

#### Frontend → Backend Contract
```typescript
// tools/skin-editor/src/ai/types.ts

export interface GenerateImageRequest {
  prompt: string;
  size: '1024x1024' | '1536x1024' | '2048x2048';
  quality: 'low' | 'standard' | 'high';
  model?: 'gpt-image-1.5' | 'dall-e-3';
}

export interface GenerateImageResponse {
  imageData: string;           // base64 PNG
  revisedPrompt?: string;      // OpenAI's refined prompt
  costEstimate: number;        // USD
  generationTime: number;      // milliseconds
}

export interface RegionSuggestion {
  id: string;
  type: 'terminal' | 'agent-status' | 'decorative';
  rect: { x: number; y: number; width: number; height: number };
  confidence: number;          // 0-1
}
```

#### Rust Backend Types
```rust
// src-tauri/src/ai/types.rs

#[derive(Deserialize)]
pub struct GenerateImageRequest {
    pub prompt: String,
    pub size: String,
    pub quality: String,
    pub model: Option<String>,
}

#[derive(Serialize)]
pub struct GenerateImageResponse {
    pub image_data: String,
    pub revised_prompt: Option<String>,
    pub cost_estimate: f32,
    pub generation_time: u64,
}

#[derive(Serialize, Deserialize)]
pub struct UsageLog {
    pub timestamp: i64,
    pub prompt: String,
    pub cost: f32,
    pub success: bool,
}
```

### 7.3 Configuration Schema

```json
// config.json (stored in Tauri app data dir)
{
  "openai": {
    "apiKey": "sk-proj-...",        // Encrypted at rest
    "model": "gpt-image-1.5",
    "defaultSize": "1024x1024",
    "defaultQuality": "standard"
  },
  "rateLimits": {
    "maxPerHour": 10,
    "maxPerDay": 50
  },
  "ui": {
    "showCostEstimates": true,
    "cacheGenerations": true,
    "autoDetectRegions": true
  },
  "usage": {
    "totalGenerations": 42,
    "totalCost": 1.26,
    "lastReset": "2026-04-01T00:00:00Z"
  }
}
```

---

## 8. Security Considerations

### 8.1 API Key Management

#### Storage
```rust
// src-tauri/src/config/api_keys.rs

use tauri::Manager;
use keyring::Entry;

pub struct ApiKeyManager;

impl ApiKeyManager {
    /// Store API key in OS keychain
    pub fn save_key(service: &str, key: &str) -> Result<(), String> {
        let entry = Entry::new(service, "openai_api_key")
            .map_err(|e| format!("Keychain error: {}", e))?;

        entry.set_password(key)
            .map_err(|e| format!("Failed to save key: {}", e))?;

        Ok(())
    }

    /// Retrieve API key from OS keychain
    pub fn get_key(service: &str) -> Result<String, String> {
        let entry = Entry::new(service, "openai_api_key")
            .map_err(|e| format!("Keychain error: {}", e))?;

        entry.get_password()
            .map_err(|e| format!("Failed to retrieve key: {}", e))
    }

    /// Delete API key
    pub fn delete_key(service: &str) -> Result<(), String> {
        let entry = Entry::new(service, "openai_api_key")
            .map_err(|e| format!("Keychain error: {}", e))?;

        entry.delete_password()
            .map_err(|e| format!("Failed to delete key: {}", e))
    }
}
```

**Dependencies:**
```toml
# Cargo.toml
[dependencies]
keyring = "2.0"
```

**Why OS Keychain?**
- ✅ Encrypted storage (macOS Keychain, Windows Credential Manager)
- ✅ Separate from app code
- ✅ Cannot be extracted from filesystem
- ✅ Survives app updates

#### Never Expose Key to Frontend
```typescript
// ❌ WRONG: Key in frontend
const apiKey = localStorage.getItem('openai_key');
fetch('https://api.openai.com/...', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});

// ✅ CORRECT: Proxy through Tauri
const result = await invoke('generate_image', { prompt });
// Key stays in Rust backend
```

### 8.2 Rate Limiting

#### Backend Implementation
```rust
// src-tauri/src/ai/rate_limiter.rs

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<u64>>>,
    max_per_hour: usize,
}

impl RateLimiter {
    pub fn new(max_per_hour: usize) -> Self {
        Self {
            requests: Mutex::new(HashMap::new()),
            max_per_hour,
        }
    }

    /// Check if request is allowed
    pub fn check_allowance(&self, user_id: &str) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut requests = self.requests.lock().unwrap();
        let user_requests = requests.entry(user_id.to_string()).or_insert(vec![]);

        // Remove requests older than 1 hour
        user_requests.retain(|&timestamp| now - timestamp < 3600);

        // Check if under limit
        if user_requests.len() < self.max_per_hour {
            user_requests.push(now);
            true
        } else {
            false
        }
    }

    /// Get remaining requests in current hour
    pub fn get_remaining(&self, user_id: &str) -> usize {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let requests = self.requests.lock().unwrap();
        if let Some(user_requests) = requests.get(user_id) {
            let recent = user_requests.iter()
                .filter(|&&timestamp| now - timestamp < 3600)
                .count();

            self.max_per_hour.saturating_sub(recent)
        } else {
            self.max_per_hour
        }
    }
}
```

#### Frontend UI
```typescript
// Show remaining generations
const remaining = await invoke('get_remaining_generations');
document.getElementById('rate-limit-indicator').textContent =
  `${remaining}/10 generations remaining this hour`;
```

### 8.3 Input Validation

#### Prompt Sanitization
```rust
// src-tauri/src/ai/validation.rs

pub fn validate_prompt(prompt: &str) -> Result<(), String> {
    // Length checks
    if prompt.len() < 10 {
        return Err("Prompt too short (minimum 10 characters)".to_string());
    }

    if prompt.len() > 2000 {
        return Err("Prompt too long (maximum 2000 characters)".to_string());
    }

    // Content policy checks (basic)
    let banned_terms = ["hack", "exploit", "malware", "nsfw"];
    for term in banned_terms {
        if prompt.to_lowercase().contains(term) {
            return Err(format!("Prompt contains prohibited term: {}", term));
        }
    }

    Ok(())
}
```

### 8.4 HTTPS-Only Communication

```rust
// Enforce HTTPS in API client
let client = reqwest::Client::builder()
    .https_only(true)
    .build()
    .unwrap();
```

### 8.5 Usage Logging (Audit Trail)

```rust
// src-tauri/src/ai/usage_tracker.rs

use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{Write, BufReader, BufRead};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize)]
pub struct UsageLog {
    pub timestamp: u64,
    pub prompt_hash: String,  // SHA256 of prompt (privacy)
    pub model: String,
    pub size: String,
    pub quality: String,
    pub cost: f32,
    pub success: bool,
    pub error: Option<String>,
}

pub struct UsageTracker {
    log_file: String,
}

impl UsageTracker {
    pub fn new(log_path: &str) -> Self {
        Self {
            log_file: log_path.to_string(),
        }
    }

    pub fn log_generation(&self, log: UsageLog) -> Result<(), String> {
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_file)
            .map_err(|e| format!("Failed to open log: {}", e))?;

        let json = serde_json::to_string(&log)
            .map_err(|e| format!("Failed to serialize log: {}", e))?;

        writeln!(file, "{}", json)
            .map_err(|e| format!("Failed to write log: {}", e))?;

        Ok(())
    }

    pub fn get_total_cost(&self) -> Result<f32, String> {
        let file = File::open(&self.log_file)
            .map_err(|e| format!("Failed to open log: {}", e))?;

        let reader = BufReader::new(file);
        let mut total = 0.0;

        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(log) = serde_json::from_str::<UsageLog>(&line) {
                    if log.success {
                        total += log.cost;
                    }
                }
            }
        }

        Ok(total)
    }
}
```

**Privacy Note:** Store hash of prompt instead of full text to protect user privacy in logs.

---

## 9. Cost Analysis

### 9.1 Per-Generation Costs (GPT Image 1.5)

| Use Case | Size | Quality | Cost | Scenario |
|----------|------|---------|------|----------|
| Quick iteration | 1024x1024 | low | $0.009 | Testing prompts |
| Production skin | 1024x1024 | standard | $0.03 | Final chrome |
| High-detail skin | 1024x1024 | high | $0.05 | Premium skins |
| Ultrawide skin | 1536x1024 | standard | $0.06 | Cinematic layout |
| Maximum fidelity | 2048x2048 | high | $0.19 | Professional use |

### 9.2 User Scenarios

#### Casual User (1-2 skins/month)
```
Iterations per skin: 3 (rough → refine → final)
Cost per skin: 3 × $0.03 = $0.09
Monthly cost: 2 × $0.09 = $0.18

Comparison:
- Commissioning designer: $50-100 per skin
- Savings: 99.6% reduction
```

#### Power User (5 skins/month)
```
Iterations per skin: 5 (more experimentation)
Cost per skin: 5 × $0.03 = $0.15
Monthly cost: 5 × $0.15 = $0.75

Comparison:
- Commissioning designer: $250-500 total
- Savings: 99.7% reduction
```

#### Developer/Designer (20 skins/month)
```
Iterations per skin: 10 (professional workflow)
Cost per skin: 10 × $0.03 = $0.30
Monthly cost: 20 × $0.30 = $6.00

Comparison:
- Commissioning designer: $1000-2000 total
- Savings: 99.4% reduction
```

### 9.3 Optimization Strategies

#### 1. Caching
```typescript
// Cache identical prompts to avoid duplicate API calls
const cached = await ImageGenerator.getCached(prompt);
if (cached) {
  return cached; // $0.00 cost
}
```

**Estimated Savings:** 20-30% (users often regenerate similar prompts)

#### 2. Low-Quality Previews
```typescript
// Use low-quality for iteration, high-quality for final
const preview = await generate({ quality: 'low' }); // $0.009
const final = await generate({ quality: 'high' });  // $0.05
```

**Estimated Savings:** 40% on iteration phase

#### 3. Batch Generation
```typescript
// Generate variations in parallel (if API supports)
const variations = await Promise.all([
  generate({ prompt: base + ' variant 1' }),
  generate({ prompt: base + ' variant 2' }),
  generate({ prompt: base + ' variant 3' }),
]);
```

**Note:** OpenAI charges per image regardless, but saves user time.

#### 4. User-Configurable Budgets
```typescript
// Set monthly spending limit
const config = {
  monthlyBudget: 5.00, // $5/month
  warnAt: 4.00,        // Warn at 80%
  hardStop: 5.00,      // Block at 100%
};

// Check before generation
if (totalSpent + estimatedCost > config.hardStop) {
  alert('Monthly budget reached. Reset on 1st of month.');
  return;
}
```

### 9.4 ROI Analysis

#### Time Saved
```
Manual skin creation: 30-60 minutes
AI-assisted creation: 5-10 minutes
Time saved: 50 minutes per skin

Value of time (at $50/hour): $41.67 saved
Cost of AI generation: $0.15
Net value: $41.52 per skin
```

#### Barrier to Entry Reduction
```
Before: Need Photoshop skills, design knowledge, 1+ hour
After: Describe what you want, 5 minutes, no skills needed

Estimated 10x increase in community skin contributions
```

---

## 10. Alternative Approaches

### 10.1 Stable Diffusion (Self-Hosted)

#### Pros
- ✅ **Near-zero cost** per generation (<$0.01 on own GPU)
- ✅ **Full control** over models, customization
- ✅ **Privacy** (no data sent to third parties)
- ✅ **Offline** operation possible
- ✅ **Community models** (fine-tuned for UI design)

#### Cons
- ❌ **Complex setup** (Python, CUDA, model downloads)
- ❌ **Hardware requirements** (8GB+ VRAM GPU)
- ❌ **Slower** generation (30-60s on consumer GPU)
- ❌ **Quality** inconsistent without fine-tuning
- ❌ **Maintenance** burden (model updates, dependencies)

#### Implementation
```python
# Run Stable Diffusion web UI locally
# Users access via http://localhost:7860

# Tauri backend calls local SD API
POST http://localhost:7860/sdapi/v1/txt2img
{
  "prompt": "cyberpunk terminal interface...",
  "negative_prompt": "text, blurry...",
  "width": 1024,
  "height": 1024,
  "steps": 30,
  "sampler_name": "DPM++ 2M Karras"
}
```

**Best For:** Advanced users willing to self-host, high-volume usage (>100 images/month)

**Recommendation:** Offer as **opt-in alternative** for power users, but default to OpenAI for simplicity.

### 10.2 Midjourney

#### Pros
- ✅ **Exceptional artistic quality**
- ✅ **Great for stylized designs**
- ✅ **Active community** with shared prompts

#### Cons
- ❌ **No official API** (requires Discord bot scraping)
- ❌ **Subscription only** ($10-60/month, no pay-per-use)
- ❌ **Against ToS** to automate
- ❌ **Slow iteration** (Discord interface)

**Recommendation:** ❌ **Not suitable** for programmatic integration. Manual use only.

### 10.3 Adobe Firefly

#### Pros
- ✅ **Photoshop integration** (for manual editing)
- ✅ **Commercial licensing** included
- ✅ **Enterprise-grade security**

#### Cons
- ❌ **No public API** (beta access only)
- ❌ **Subscription required** ($20-50/month)
- ❌ **Less prompt flexibility** than OpenAI

**Recommendation:** ⏳ **Wait for public API** release. Monitor for future integration.

### 10.4 Replicate (Flux Schnell)

#### Pros
- ✅ **Very cheap** ($0.003/image)
- ✅ **Fast** (5-10 seconds)
- ✅ **Simple API** (similar to OpenAI)
- ✅ **Open source models** (Flux, SD)

#### Cons
- ❌ **Lower quality** than GPT Image 1.5
- ❌ **Less consistent** outputs
- ❌ **Requires separate account**

#### Implementation
```typescript
// Replicate API (Flux Schnell)
const response = await fetch('https://api.replicate.com/v1/predictions', {
  method: 'POST',
  headers: {
    'Authorization': `Token ${REPLICATE_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    version: 'flux-schnell-v1',
    input: {
      prompt: 'cyberpunk terminal interface',
      width: 1024,
      height: 1024,
    },
  }),
});
```

**Recommendation:** ✅ **Consider as budget alternative** (Phase 4 feature: let user choose provider)

### 10.5 Local ControlNet (Advanced)

**Concept:** Use ControlNet to generate chrome while preserving exact region layouts.

#### Workflow
1. User sketches rough layout (rectangles for regions)
2. ControlNet uses sketch as structural guide
3. Generates detailed chrome matching sketch structure
4. Regions are guaranteed to align

#### Pros
- ✅ **Perfect region alignment**
- ✅ **User has exact control** over layout

#### Cons
- ❌ **Very complex** to implement
- ❌ **Requires local SD setup**
- ❌ **Steep learning curve** for users

**Recommendation:** ⏳ **Future enhancement** (Phase 5+), only for advanced users.

---

## 11. Recommendations & Next Steps

### 11.1 Recommended Approach

**Primary Model:** OpenAI GPT Image 1.5
- Best balance of quality, speed, and ease of use
- Superior instruction-following for UI generation
- Simpler integration (official SDK)
- Cost-effective for most users ($0.03-0.05/image)

**Alternative Provider:** Replicate (Flux Schnell)
- Offer as budget option ($0.003/image)
- Phase 4 feature: User-selectable provider

**Self-Hosted Option:** Stable Diffusion
- Documentation for advanced users
- Not integrated by default (too complex)

### 11.2 Integration Architecture

**Frontend:** tools/skin-editor (browser-based)
- Generation UI lives in skin editor
- IndexedDB caching for performance
- Real-time preview and iteration

**Backend:** Tauri (Rust)
- API key proxy for security
- Rate limiting and usage tracking
- Secure credential storage (OS keychain)

**Why This Architecture?**
- ✅ Keeps sensitive keys server-side
- ✅ Leverages existing Tauri infrastructure
- ✅ No additional backend hosting required
- ✅ Works offline (except generation step)

### 11.3 Implementation Timeline

**Total Estimate:** 5-6 weeks (single developer)

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Basic Generation | 2 weeks | Working AI button, 5 presets, auto-import |
| Phase 2: Smart Regions | 2 weeks | CV-based region detection, suggestions UI |
| Phase 3: Refinement | 1-2 weeks | Inpainting, prompt history, variations |

**MVP (Minimum Viable Product):** Phase 1 only (2 weeks)
- Users can generate chrome from prompts
- Manual region definition (existing editor workflow)
- Sufficient to validate user interest

**Full Feature Set:** All 3 phases (5-6 weeks)
- Automated region suggestions
- Iterative refinement tools
- Production-ready quality

### 11.4 Success Metrics

**Adoption Metrics:**
- 30%+ of skin editor sessions use AI generation
- 50+ unique skins generated in first month
- <5% error rate (failed generations)

**Quality Metrics:**
- 70%+ of generations rated "usable" by users
- 60%+ of auto-detected regions accepted
- <3 iterations average to final skin

**Economic Metrics:**
- <$0.10 average cost per final skin
- 10x time reduction (60min → 6min)
- 99%+ cost savings vs commissioned art

### 11.5 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API deprecation (DALL-E 3 → GPT Image) | High | Use GPT Image 1.5 from start |
| Poor quality outputs | Medium | Curated prompt templates, validation |
| API cost overruns | Medium | User budgets, rate limiting, caching |
| API key leaks | High | Tauri proxy, secure storage, never in frontend |
| Slow generation times | Low | Progress UI, async handling, caching |

### 11.6 Future Enhancements (Post-MVP)

**Phase 4: Multi-Provider Support**
- Let user choose: OpenAI, Replicate, Local SD
- Unified interface for all providers

**Phase 5: Fine-Tuned Models**
- Train custom model on terminal UI dataset
- Better region understanding, more consistent output

**Phase 6: Style Transfer**
- Upload reference image → generate matching chrome
- "Make it look like this WinAmp skin"

**Phase 7: Collaborative Prompting**
- Community prompt library
- Upvote/downvote prompts
- Share and remix generated skins

### 11.7 Documentation Needs

**User-Facing Docs:**
- How to get OpenAI API key
- Prompt writing guide for beginners
- Style preset catalog (with examples)
- Troubleshooting common errors

**Developer Docs:**
- API integration architecture
- Adding new prompt templates
- Extending region detection
- Contributing CV improvements

---

## Appendix A: Code Examples

### A.1 Complete Tauri Command

```rust
// src-tauri/src/commands.rs

use serde::{Deserialize, Serialize};
use tauri::command;
use reqwest;
use base64::{Engine as _, engine::general_purpose};

#[derive(Deserialize)]
pub struct ImageGenerationRequest {
    prompt: String,
    size: String,
    quality: String,
    model: String,
}

#[derive(Serialize)]
pub struct ImageGenerationResponse {
    image_data: String,
    revised_prompt: Option<String>,
    cost_estimate: f32,
}

#[command]
pub async fn generate_image(
    request: ImageGenerationRequest,
) -> Result<ImageGenerationResponse, String> {
    // Get API key from environment (or secure storage)
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY not set".to_string())?;

    // Build request body
    let body = serde_json::json!({
        "model": request.model,
        "prompt": request.prompt,
        "size": request.size,
        "quality": request.quality,
        "response_format": "b64_json"
    });

    // Make API request
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    // Check response status
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API error: {}", error_text));
    }

    // Parse response
    let json: serde_json::Value = response.json().await
        .map_err(|e| format!("Parse error: {}", e))?;

    let image_b64 = json["data"][0]["b64_json"]
        .as_str()
        .ok_or("No image in response")?
        .to_string();

    let revised_prompt = json["data"][0]["revised_prompt"]
        .as_str()
        .map(|s| s.to_string());

    // Calculate cost
    let cost = match (request.size.as_str(), request.quality.as_str()) {
        ("1024x1024", "standard") => 0.03,
        ("1024x1024", "high") => 0.05,
        ("1536x1024", "standard") => 0.06,
        _ => 0.03,
    };

    Ok(ImageGenerationResponse {
        image_data: image_b64,
        revised_prompt,
        cost_estimate: cost,
    })
}
```

### A.2 Complete Frontend Integration

```typescript
// tools/skin-editor/src/ai/image-generator.ts

import { invoke } from '@tauri-apps/api/core';

export interface GenerationOptions {
  prompt: string;
  size: '1024x1024' | '1536x1024';
  quality: 'standard' | 'high';
}

export interface GenerationResult {
  imageData: string;
  revisedPrompt?: string;
  costEstimate: number;
}

export async function generateImage(
  options: GenerationOptions
): Promise<GenerationResult> {
  const result = await invoke<GenerationResult>('generate_image', {
    request: {
      prompt: options.prompt,
      size: options.size,
      quality: options.quality,
      model: 'gpt-image-1.5',
    },
  });

  return result;
}

// Usage in skin editor
async function handleGenerate() {
  const prompt = "cyberpunk terminal with neon green display";

  try {
    const result = await generateImage({
      prompt,
      size: '1024x1024',
      quality: 'standard',
    });

    // Convert base64 to blob
    const blob = await fetch(`data:image/png;base64,${result.imageData}`)
      .then(r => r.blob());

    // Load into editor
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // Set as chrome image
      editorState.chromeImage = img;
      renderCanvas();
    };
    img.src = url;

    console.log(`Generated! Cost: $${result.costEstimate}`);
  } catch (error) {
    alert(`Generation failed: ${error}`);
  }
}
```

---

## Appendix B: Resources

### API Documentation
- OpenAI Images API: https://platform.openai.com/docs/guides/images
- GPT Image Models: https://platform.openai.com/docs/models/gpt-image
- Replicate API: https://replicate.com/docs
- Stable Diffusion WebUI API: https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API

### Prompt Engineering Guides
- DALL-E Prompt Book: https://dallery.gallery/the-dalle-2-prompt-book/
- Midjourney Prompting Guide: https://docs.midjourney.com/docs/prompts
- UI Design Prompts: https://www.earlynode.com/prompt-engineering/15-useful-dall-e-prompts-for-ui-ux-designers

### Computer Vision Libraries
- OpenCV.js: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
- TensorFlow.js: https://www.tensorflow.org/js
- Segment Anything (SAM): https://segment-anything.com/

### Design Inspiration
- WinAmp Skin Museum: https://skins.webamp.org/
- Cyberpunk UI Gallery: https://www.pinterest.com/extralushhh/terminal/
- Retro Terminal Designs: https://medium.com/@benjamib/retro-terminal-ui-ae9ac8eae71a

---

## Conclusion

Integrating OpenAI's image generation API into the Terminai skin editor represents a significant opportunity to **democratize skin creation** and **accelerate community contributions**. By leveraging GPT Image 1.5's advanced capabilities, we can reduce the time and skill barriers from hours of Photoshop work to minutes of natural language prompting.

**Key Takeaways:**

1. **Use GPT Image 1.5** as primary model (faster, cheaper, better than DALL-E 3)
2. **Proxy API calls through Tauri** for security (never expose keys in frontend)
3. **Start with Phase 1 MVP** (basic generation) to validate user interest
4. **Smart region detection** (Phase 2) is the killer feature for UX
5. **Cost is negligible** ($0.03-0.05 per skin vs $50-100 commissioned art)

**Next Steps:**

1. Set up OpenAI API account and test GPT Image 1.5
2. Implement Tauri proxy command (1 week)
3. Build generation modal UI (1 week)
4. Beta test with 5-10 users
5. Iterate based on feedback
6. Public release with documentation

This integration aligns perfectly with Terminai's **WMP extensibility philosophy**: lowering barriers to entry while maintaining a high creative ceiling. Users who couldn't create skins before will now be empowered to bring their vision to life with just a description.

---

**Document Version:** 1.0
**Last Updated:** April 23, 2026
**Status:** Research Complete, Ready for Implementation
