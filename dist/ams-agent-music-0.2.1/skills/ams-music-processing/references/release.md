# Release

## GitHub

Repository: yan-mc/ams-release

H2 latest: v0.2.1

H2 assets:

- setup
- feed
- manifest
- SHA
- kernel
- catalog
- voicepack-manbo.zip (only voice)
- gateway stageg2
- plugin stageg2
- service-vc mix

H3: v1.0.0-rc.1 prerelease

H3 assets:

- setup 1.0.0-rc.1
- feed 2046
- manifest
- SHA
- gateway 1.0.0-rc.1
- plugin 1.0.0-rc.1

No TTS voice in GitHub releases.

## Hugging Face

Dataset: yan2002/AI-MUSIC-STUDIO

Runtime path: runtime-packages/runtime.tts-train/0.1.0/part-001..004 + component.json.

Existing runtime.rvc/runtime.tts/kernel/voicepack.

No TTS voice upload.

## Rules

- H3 prerelease must not become latest while H2 is current.
- Feed sequence must be signed.
- Verify SHA256 on upload.
- Upload only after tests.
- Preserve rollback setup.
