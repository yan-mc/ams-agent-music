# @ams/agent-music

Independent AMS Music Agent Host plugin + skill bundle.

This package is intentionally not part of @ams/music-bundle.

## Components

- Host tools: 20 ams_* tools.
- Skill: skills/ams-music-processing/SKILL.md + references.
- Local ASR: asr.py using Vosk; no network.
- Safety: read-only default; confirm=true for writes; data root guard; no shell.

## Install

Use the sibling bundle @ams/agent-music-bundle.

1. Copy @ams/agent-music and @ams/agent-music-bundle into the profile node_modules.
2. Add both to profile package.json dependencies.
3. Add @ams/agent-music-bundle to dsh.profile.bundles.
4. Restart AMS Studio/Kernel.
5. Verify data/logs/agent-music-load.log:
   module-loaded
   skill-provider-registered
   tools-registered count=20
   skill-list ams-music-processing
   selftest-status {"ok":true,...}

Do not add the plugin directly to cordis.patch.yml; the bundle inserts it.

## ASR dependencies

- Python: data/runtime/tts-train/0.1.0/python/python.exe
- Vosk package: data/runtime/tts-train/0.1.0/deps
- Model: data/models/vosk-cn/vosk-model-small-cn-0.22
- ffmpeg: data/runtime/rvc/0.1.0/ffmpeg.exe

Override with AMS_ASR_PYTHON, AMS_ASR_LIB, AMS_ASR_MODEL, AMS_FFMPEG.

## Tools

ams_mode_enter, ams_status, ams_inventory, ams_dataset_inspect,
ams_dataset_audit, ams_dataset_clean, ams_tts_text_clean,
ams_dataset_prepare_rvc, ams_dataset_prepare_tts, ams_voice_delete_to_trash,
ams_job_submit, ams_job_status, ams_job_list, ams_job_cancel, ams_job_wait,
ams_tts_synthesize, ams_transcribe, ams_evaluate_audio, ams_docs_lookup,
ams_release_check.

## Safety

- Call ams_mode_enter first.
- Read-only default.
- confirm=true only after explicit user approval.
- No shell, no C: writes, no deletion of originals.
- ASR is local; audio is not uploaded.

## Known limitations

- TTS training quality is frozen per project decision.
- ASR accuracy depends on Vosk small model; it is for routing/verification, not studio transcription.
- H2/H3 release assets are outside this plugin.

## Package

Run python package.py. Output: dist/ams-agent-music-0.2.0.zip + SHA256SUMS.txt.
