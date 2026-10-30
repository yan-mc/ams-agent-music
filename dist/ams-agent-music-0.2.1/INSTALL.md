# Install

## Into AMS Studio profile

1. Copy the plugin package to:
   F:/AMS-Studio/data/kernel/dsh/profiles/desktop/node_modules/@ams/agent-music
2. Copy the client package so:
   F:/AMS-Studio/data/kernel/dsh/profiles/desktop/node_modules/@ams/agent-music-ui
   and the bundle package to:
   F:/AMS-Studio/data/kernel/dsh/profiles/desktop/node_modules/@ams/agent-music-bundle
3. Add to profile package.json dependencies:
   @ams/agent-music, @ams/agent-music-ui and @ams/agent-music-bundle
4. Add to dsh.profile.bundles:
   @ams/agent-music-bundle
5. Restart AMS Studio/Kernel.

The bundle inserts the plugin (and the @ams/agent-music-ui client for the 嘉音Studio Kernel rebrand); the plugin registers the skill provider and tools.

## Verify

After restart, check:
- Skill catalog: ams-music-processing
- Tools: ams_mode_enter ... ams_release_check (20)
- data/logs/agent-music-load.log:

  module-loaded
  skill-provider-registered
  tools-registered count=20
  skill-list ams-music-processing
  selftest-status {"ok":true,...}

## ASR dependencies

Python/Vosk/ffmpeg/model are AMS data dependencies:
- runtime/tts-train/0.1.0/python/python.exe
- runtime/tts-train/0.1.0/deps
- models/vosk-cn/vosk-model-small-cn-0.22
- runtime/rvc/0.1.0/ffmpeg.exe
