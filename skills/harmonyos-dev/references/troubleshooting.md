# HarmonyOS Troubleshooting Guide

## Build Issues (`hvigorw assembleHap`)

### "hvigorw is not recognized"
- **Cause:** The wrapper script `hvigorw.bat` (Windows) or `hvigorw` (Unix) is missing from the project root.
- **Fix:**
  1. Check if `node_modules/.bin/hvigor` works.
  2. Install global tools: `npm install -g @ohos/hvigor`.
  3. Re-initialize the project in DevEco Studio to regenerate wrappers.

### "Command failed with exit code 1"
- **Cause:** Compilation error in ArkTS files.
- **Fix:**
  1. Run `hvigorw assembleHap --info` for detailed logs.
  2. Check `oh-package.json5` for missing dependencies.
  3. Run `ohpm install` to ensure all packages are linked.

### "SigningConfigs profile is configured" (Warning)
- **Cause:** No signing certificate configured.
- **Fix:** Safe to ignore for local emulators. For physical devices, configure `build-profile.json5`.

## Environment Issues

### "ohpm not found"
- **Cause:** OpenHarmony Package Manager is not in PATH.
- **Fix:** Locate the SDK installation and add `command-line-tools/bin` to PATH.

### "Node.js version mismatch"
- **Cause:** HarmonyOS SDK requires specific Node.js versions (usually 14.x or 16.x depending on SDK).
- **Fix:** Check `hvigor-config.json5` or project requirements.
