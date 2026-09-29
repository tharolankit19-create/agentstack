# Kryx device runtime — third-party review

Reviewed: 2026-09-29

## Reused in Mac runtime

### OpenSymph Open Computer Use
- Repository: opensymph/open-computer-use
- Version reviewed: v1.2.0
- Commit reviewed: 5b433b98019c18201a15d11e8c3cb0010879a3d8
- License: MIT
- Kryx use: packaged native accessibility/computer-control runtime.
- Integration style: dependency/runtime invocation. Kryx does not modify its source in-tree.
- Attribution: preserve upstream MIT license in release notices.

### Browser Use
- Repositories reviewed: browser-use/browser-use and browser-use/desktop
- License: MIT
- Kryx use: architecture/reliability reference for browser automation and desktop packaging.
- Code copied: none in this branch.

## Android references

### DroidPilot
- Repository: youichi-uda/droidpilot
- License: MIT
- Kryx use: architecture reference for AccessibilityService-driven node inspection and action execution.
- Code copied: none. Kryx implementation is clean-room and uses Android platform APIs directly.

### OpenDroid
- Repository: yashab-cyber/opendroid
- License: Apache-2.0
- Kryx use: architecture reference for Android accessibility automation and workflow recovery.
- Code copied: none in this branch.

### scrcpy
- Use: development/debugging only if later needed.
- Not embedded in the Kryx APK in this branch.

## Rule

No source is copied from an external repository unless its exact revision and
license are recorded here first. Any substantial copied MIT/Apache source must
retain required copyright/license notices in distributed artifacts.
