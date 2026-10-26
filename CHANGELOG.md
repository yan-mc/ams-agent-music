# Changelog

## 0.2.0

- 20 Host tools.
- Dataset quality audit: short/long, silence, clipping, quiet, duplicates, missing text, interjections.
- Safe dataset cleanup: dry-run report, explicit file list, confirm, move to trash.
- TTS text cleaning: normalized metadata.cleaned.csv, original untouched.
- RVC/TTS dataset audit.
- Local audio evaluation: duration/peak/RMS/clipping/silence; optional ASR and expected-text recall.
- Release preflight: feed/manifest sequence, setup hash, SHA256SUMS, required assets.
- Local Vosk ASR.
- Skill provider ams-music-processing.
- Independent bundle wrapper for DSH profile loading.

## 0.1.0

- Initial independent Host plugin, Skill, local ASR, mode/status/job tools.
