#!/usr/bin/env node

/**
 * WMZ to Terminai Skin Converter (Day 3 - Headspace hardcoded version)
 *
 * Usage: node convert.js <path-to-headspace.wmz> <output-dir>
 *
 * This is NOT a general-purpose converter. It's hardcoded for the Headspace skin.
 * We'll generalize after we've converted 3-4 skins and understand the patterns.
 */

import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function convertHeadspace(wmzPath, outputDir) {
  console.log('[Converter] Starting Headspace conversion...');
  console.log(`[Converter] Input: ${wmzPath}`);
  console.log(`[Converter] Output: ${outputDir}`);

  // 1. Unzip the .wmz
  console.log('\n[Step 1] Unzipping .wmz file...');
  const zip = new AdmZip(wmzPath);
  const tempDir = path.join(outputDir, '.temp');
  zip.extractAllTo(tempDir, true);
  console.log(`[Step 1] ✓ Extracted to ${tempDir}`);

  // 2. Read and parse the XML
  console.log('\n[Step 2] Parsing headspace.wms...');
  const wmsPath = path.join(tempDir, 'headspace.wms');
  const xmlContent = fs.readFileSync(wmsPath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const xmlData = parser.parse(xmlContent);
  console.log('[Step 2] ✓ XML parsed');

  // 3. Extract metadata (hardcoded for Headspace)
  console.log('\n[Step 3] Extracting skin metadata...');
  const theme = xmlData.theme;
  const view = theme.view;

  const manifest = {
    id: 'headspace',
    name: 'Headspace Beta',
    version: '1.0.0',
    author: theme.author || 'Microsoft Corporation',

    visual: {
      width: parseInt(view.width),
      height: parseInt(view.height),
      // Window shape will be defined by chrome.png alpha channel
      chromeImage: 'chrome.png',
    },

    // Terminal screen region (the video element)
    // VIDEO is at (4, 13) inside visScreen at (10, 59) inside main subview at (261, 0)
    // Absolute position: 261 + 10 + 4 = 275, 0 + 59 + 13 = 72
    terminalRegion: {
      x: 275,
      y: 72,
      width: 208,
      height: 132,
    },

    // LED/status text region (for future Hermes integration)
    ledRegion: {
      x: 40,
      y: 6,
      width: 150,  // Estimated
      height: 20,   // Estimated
    },

    // Button regions (extracted from XML)
    actions: [],
  };

  console.log('[Step 3] ✓ Metadata extracted');
  console.log(`  Window size: ${manifest.visual.width} x ${manifest.visual.height}`);
  console.log(`  Terminal region: ${manifest.terminalRegion.x},${manifest.terminalRegion.y} ${manifest.terminalRegion.width}x${manifest.terminalRegion.height}`);

  // 4. Composite ALL subviews into chrome.png
  console.log('\n[Step 4] Compositing all SUBVIEWs into chrome.png...');
  const chromePngPath = path.join(outputDir, 'chrome.png');

  // Create a blank canvas at the full window size
  const canvas = new Jimp(manifest.visual.width, manifest.visual.height, 0x00000000); // Transparent
  console.log(`  Created ${manifest.visual.width}x${manifest.visual.height} canvas`);

  // Headspace-specific: composite the three main subviews
  // 1. Main head at (261, 0)
  console.log('  Compositing head.bmp...');
  const headImg = await Jimp.read(path.join(tempDir, 'head.bmp'));
  headImg.scan(0, 0, headImg.bitmap.width, headImg.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r === 255 && g === 0 && b === 255) this.bitmap.data[idx + 3] = 0;
  });
  canvas.composite(headImg, 261, 0);

  // 2. Left ear/speakers at (207, 86)
  console.log('  Compositing left_ear.bmp...');
  const leftEarImg = await Jimp.read(path.join(tempDir, 'left_ear.bmp'));
  leftEarImg.scan(0, 0, leftEarImg.bitmap.width, leftEarImg.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r === 255 && g === 0 && b === 255) this.bitmap.data[idx + 3] = 0;
  });
  canvas.composite(leftEarImg, 207, 86);

  // 3. Right ear/speakers at (277 + 185, 86)
  console.log('  Compositing right_ear.bmp...');
  const rightEarImg = await Jimp.read(path.join(tempDir, 'right_ear.bmp'));
  rightEarImg.scan(0, 0, rightEarImg.bitmap.width, rightEarImg.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r === 255 && g === 0 && b === 255) this.bitmap.data[idx + 3] = 0;
  });
  canvas.composite(rightEarImg, 277 + 185, 86);

  // Save as PNG
  await canvas.writeAsync(chromePngPath);
  console.log(`[Step 4] ✓ Composite chrome PNG saved to ${chromePngPath}`);

  // 5. Extract button regions (simplified for Day 3)
  console.log('\n[Step 5] Extracting button regions...');

  // For now, just add placeholder buttons
  // We'll properly extract these when we wire up button actions on Day 6
  manifest.actions.push({
    id: 'minimize',
    label: 'Minimize',
    position: { x: 362, y: 4 },
    type: 'minimize',
  });

  manifest.actions.push({
    id: 'close',
    label: 'Close',
    position: { x: 382, y: 4 },
    type: 'close',
  });

  console.log(`[Step 5] ✓ Extracted ${manifest.actions.length} button regions (hardcoded for Day 3)`);

  // 6. Write manifest.json
  console.log('\n[Step 6] Writing manifest.json...');
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[Step 6] ✓ Manifest saved to ${manifestPath}`);

  // 7. Clean up temp directory
  console.log('\n[Step 7] Cleaning up...');
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('[Step 7] ✓ Temp files removed');

  console.log('\n✨ Conversion complete!');
  console.log(`\nOutput files:`);
  console.log(`  - ${manifestPath}`);
  console.log(`  - ${chromePngPath}`);
}

// Main CLI
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node convert.js <path-to-wmz> <output-dir>');
  console.error('Example: node convert.js ~/Downloads/headspace.wmz ../../skins/headspace/');
  process.exit(1);
}

const [wmzPath, outputDir] = args;

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

try {
  await convertHeadspace(wmzPath, outputDir);
} catch (error) {
  console.error('\n❌ Conversion failed:');
  console.error(error);
  process.exit(1);
}
