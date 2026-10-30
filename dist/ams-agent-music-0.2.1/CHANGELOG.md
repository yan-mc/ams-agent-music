# Changelog

## 0.2.1

- fix: audit log path is resolved from AMS_HOME / Kernel cwd / DSH_HOME instead of hardcoding `F:/AMS-Studio/data`.
- fix: ASR dependency paths auto-detect the real v1.0.x runtime layout (`runtime.tts-train-0.1.0` nested dir), with env overrides and clear missing-dependency errors.
- fix: `engines.dsh` bumped to `0.2.1-rc.3` to match the shipped Kernel.
- new: `@ams/agent-music-ui` client plugin — rebrands the Kernel web UI at runtime (title, whale marks, DeepSeek/探索未至之境 text, favicon) without modifying Kernel sources.
- new: bundle patch now inserts both the Host plugin and the rebrand client.
- new: `FEATURES.md` full capability guide.

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
