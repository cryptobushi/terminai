# Skin Bundle Import/Export Workflow

## Overview

The Terminai skin editor (online) can export complete skin bundles that can be imported into the local Terminai app (offline). All images are embedded as base64 data URIs, making the bundles completely self-contained.

## Workflow

### 1. Online Editor (tools/skin-editor)

**Creating a Skin:**
1. Load a chrome PNG or WMZ file
2. Define regions by drawing on the canvas
3. Lock/unlock layers as needed
4. Duplicate layers with Cmd/Ctrl + D
5. Export the complete bundle

**Export Features:**
- Click "Export Skin Bundle" button
- Downloads `skin-bundle.json` with all images embedded
- Chrome image embedded as base64 data URI
- All bitmap layers embedded as base64 data URIs
- No external file dependencies

**Bundle Structure:**
```json
{
  "id": "custom-skin",
  "name": "Custom Skin",
  "version": "1.0.0",
  "visual": {
    "width": 800,
    "height": 600,
    "chromeImage": "data:image/png;base64,..."
  },
  "regions": [
    {
      "id": "layer1",
      "type": "image",
      "rect": { "x": 100, "y": 100, "width": 200, "height": 150 },
      "zIndex": 1,
      "data": {
        "imageUrl": "data:image/png;base64,..."
      }
    },
    ...
  ]
}
```

### 2. Offline Client (main Terminai app)

**Importing a Skin:**
1. Click the "📦 Import Skin Bundle" button (top-right)
2. Select the exported `skin-bundle.json` file
3. The bundle is validated and saved to localStorage
4. App automatically reloads with the new skin

**Validation:**
- Checks required metadata (id, name, version)
- Validates visual dimensions
- Ensures regions array is valid
- Warns if images are not data URIs (offline compatibility)

**Persistence:**
- Imported skins are saved to localStorage
- Automatically loads custom skin on next launch
- Falls back to default headspace skin if no custom skin

**Size Limits:**
- localStorage typically has 5-10MB limit
- Large skins with many high-res images may exceed this
- Consider compressing images before import

## Technical Details

### Export (tools/skin-editor/src/main.ts:1408)

```typescript
private async exportManifest(): Promise<void> {
  // Convert chrome image to base64 data URI
  const chromeDataUri = this.state.chromeImage.src;

  // Embed all image regions
  const regionsWithEmbeddedImages = await Promise.all(
    this.state.regions.map(async (region) => {
      if (region.type === 'image' && region.data?.imageUrl) {
        return {
          ...region,
          data: { imageUrl: region.data.imageUrl }
        };
      }
      return region;
    })
  );

  const manifest = {
    // ... metadata
    visual: {
      width: this.state.chromeImage.width,
      height: this.state.chromeImage.height,
      chromeImage: chromeDataUri
    },
    regions: regionsWithEmbeddedImages
  };

  // Download as JSON file
  const blob = new Blob([JSON.stringify(manifest, null, 2)]);
  // ... download logic
}
```

### Import (src/skins/bundle-loader.ts)

```typescript
class SkinBundleLoader {
  static async loadFromFile(file: File): Promise<SkinManifest> {
    const text = await file.text();
    const manifest = JSON.parse(text) as SkinManifest;
    this.validateManifest(manifest);
    return manifest;
  }

  static saveToLocalStorage(manifest: SkinManifest): void {
    localStorage.setItem('terminai-custom-skin', JSON.stringify(manifest));
  }

  static loadFromLocalStorage(): SkinManifest | null {
    const json = localStorage.getItem('terminai-custom-skin');
    return json ? JSON.parse(json) : null;
  }
}
```

### Rendering (src/main.ts)

The app automatically handles data URI images:
- Chrome image: `<img src="data:image/png;base64,..."/>`
- Image regions: Rendered by `image` region renderer with data URI

## Best Practices

1. **Optimize Images:** Compress PNGs before importing to WMZ to reduce bundle size
2. **Test Offline:** Ensure all images are embedded (check for `data:` prefix)
3. **Version Control:** Include version in skin metadata for updates
4. **Backup:** Keep original WMZ and exported bundles for re-editing

## Future Enhancements

- Compression of base64 images
- Cloud storage integration
- Skin marketplace/gallery
- Automatic updates for installed skins
- Multiple skin profiles
