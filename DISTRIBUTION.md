# Terminai Distribution Guide

## Overview

This guide explains how to build, sign, and distribute Terminai using your Apple Developer account.

## Prerequisites

✅ Apple Developer Account (you have this!)
- [ ] Code signing certificate installed in Keychain
- [ ] App-specific password for notarization

## Step 1: Install Code Signing Certificate

1. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Create a "Developer ID Application" certificate
3. Download and install in Keychain Access

## Step 2: Find Your Signing Identity

```bash
# List available signing identities
security find-identity -v -p codesigning

# Look for something like:
# "Developer ID Application: Your Name (TEAM_ID)"
```

Copy the full identity string (e.g., `"Developer ID Application: Bushi (ABC123XYZ)"`)

## Step 3: Configure Code Signing

Edit `src-tauri/tauri.conf.json`:

```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
  "entitlements": "entitlements.plist"
}
```

## Step 4: Create Entitlements File

The PTY (terminal) requires special permissions. Create `src-tauri/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Required for terminal functionality -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>

    <!-- Network access for downloads, updates, etc -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- File access for terminal operations -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>

    <!-- Hardened runtime -->
    <key>com.apple.security.app-sandbox</key>
    <false/>
</dict>
</plist>
```

## Step 5: Build Signed App

```bash
# Build for your current architecture
npm run tauri build

# Or build for specific architecture
npm run tauri build -- --target aarch64-apple-darwin  # Apple Silicon
npm run tauri build -- --target x86_64-apple-darwin   # Intel
```

Output will be in:
- `src-tauri/target/release/bundle/macos/Terminai.app`
- `src-tauri/target/release/bundle/dmg/Terminai_0.1.0_*.dmg`

## Step 6: Notarization (Recommended)

Notarization tells Apple your app is safe. Required for distribution.

### Setup

1. Create app-specific password:
   - Go to [appleid.apple.com](https://appleid.apple.com)
   - Sign In > Security > App-Specific Passwords
   - Generate password, save it

2. Store credentials:
```bash
xcrun notarytool store-credentials "terminai-notarize" \
  --apple-id "your@email.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "xxxx-xxxx-xxxx-xxxx"
```

### Notarize the DMG

```bash
# Submit for notarization
xcrun notarytool submit \
  src-tauri/target/release/bundle/dmg/Terminai_*.dmg \
  --keychain-profile "terminai-notarize" \
  --wait

# Staple the notarization ticket
xcrun stapler staple src-tauri/target/release/bundle/dmg/Terminai_*.dmg
```

## Step 7: Automated Releases with GitHub Actions

The `.github/workflows/release.yml` is already configured.

### Setup GitHub Secrets

1. Go to your repo > Settings > Secrets and variables > Actions
2. Add these secrets:
   - `APPLE_CERTIFICATE`: Your .p12 certificate (base64 encoded)
   - `APPLE_CERTIFICATE_PASSWORD`: Certificate password
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_PASSWORD`: App-specific password
   - `APPLE_TEAM_ID`: Your team ID

### Trigger a Release

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically:
# 1. Build for Intel and Apple Silicon
# 2. Code sign both versions
# 3. Create DMG installers
# 4. Create a GitHub Release (draft)
# 5. Upload DMG files
```

## Distribution Options

### Option 1: GitHub Releases (Easiest)

1. Push a version tag (as above)
2. GitHub Actions creates a draft release
3. Edit the release notes
4. Publish the release
5. Users download the DMG

**Advantages:**
- Free hosting
- Automatic updates possible
- Version tracking built-in

### Option 2: Homebrew Cask

After your first release, create a Homebrew formula:

```ruby
# terminai.rb
cask "terminai" do
  version "1.0.0"
  sha256 "..."

  url "https://github.com/cryptobushi/terminai/releases/download/v#{version}/Terminai_#{version}_universal.dmg"
  name "Terminai"
  desc "Customizable terminal with retro skins"
  homepage "https://github.com/cryptobushi/terminai"

  app "Terminai.app"
end
```

Submit to [homebrew/cask](https://github.com/Homebrew/homebrew-cask)

Users install with:
```bash
brew install --cask terminai
```

### Option 3: Direct Website Download

Host the DMG on your own server/CDN and provide download links.

## Auto-Updates (Optional)

Tauri supports auto-updates. Configure in `tauri.conf.json`:

```json
"updater": {
  "active": true,
  "endpoints": [
    "https://github.com/cryptobushi/terminai/releases/latest/download/latest.json"
  ],
  "dialog": true,
  "pubkey": "YOUR_PUBLIC_KEY"
}
```

Generate update signature keys:
```bash
npm run tauri signer generate -- -w ~/.tauri/terminai.key
```

## Monetization Setup

### Free + Premium Model

**Free Features:**
- Basic terminal functionality
- Default skin
- Community skins

**Premium Features ($19.99 one-time or $4.99/month):**
- Premium skin marketplace
- AI integration
- Cloud sync
- Custom themes builder
- Priority support

### License Key System

Use [Gumroad](https://gumroad.com) or [Paddle](https://paddle.com):
- They handle payments
- Generate license keys
- You verify keys in-app

### Implementation

1. Add license verification API
2. Store license in keychain
3. Enable premium features if valid
4. Check license on app launch

## Testing the Build

Before distribution:

```bash
# Build the app
npm run tauri build

# Test locally
open src-tauri/target/release/bundle/macos/Terminai.app

# Verify code signing
codesign -vvv --deep --strict src-tauri/target/release/bundle/macos/Terminai.app

# Check if notarized
spctl -a -vvv -t install src-tauri/target/release/bundle/macos/Terminai.app
```

## Common Issues

### "App is damaged" error
- Not notarized - run notarization steps
- Or user needs to: `xattr -cr /Applications/Terminai.app`

### "Developer cannot be verified"
- Certificate not installed
- Wrong signing identity

### Terminal doesn't work
- Entitlements not configured
- Check permissions in System Settings > Privacy

## Next Steps

1. ✅ Configure code signing identity
2. ✅ Create entitlements.plist
3. ✅ Test local build
4. ✅ Setup notarization
5. ✅ Configure GitHub secrets
6. ✅ Create first release tag
7. ✅ Publish on GitHub
8. 📋 (Optional) Submit to Homebrew
9. 📋 (Optional) Setup auto-updates
10. 📋 (Optional) Add monetization

## Resources

- [Tauri Signing Guide](https://tauri.app/v1/guides/distribution/sign-macos/)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Homebrew Cask](https://docs.brew.sh/Cask-Cookbook)
