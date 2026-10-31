# Lessons Learned

## RVC

- 50 epoch on 538 clips can exceed 2h.
- Gateway 7200s timeout once killed the job during final index/registration after artifacts existed.
- Fix: 21600s timeout, live progress, -u stdout.
- num_workers=2 on Windows can hang; stable setting is 0.

## TTS

- Training IDs must include Piper pad intersperse.
- Must use espeak TextToPhonemesWithTerminator(0x02), not old 0x100.
- Must add punctuation/space by clause terminator and NFD-normalize.
- Missing these makes speech unintelligible even though text metadata is correct.
- Use single-process preprocess on Windows; multiprocessing worker can hang.
- Piper cannot reliably open Unicode paths; stage an ASCII copy for inference.
- TTS quality still needs more epochs/listening; ASR can validate word alignment but not prosody.

## Release

- GitHub: setup, feed, manifest, SHA, gateway, plugin; no TTS voice.
- Manbo is the only RVC voicepack in H2 release.
- Do not upload test voices, test logs, or intermediate plans.
- Hugging Face: large runtime parts and checkpoints.
- H2 latest must remain v0.2.1 when H3 is a prerelease.
- Delete stale drafts/assets before publishing.

## Windows

- All AMS data under F:/AMS-Studio/data.
- No C: AMS data.
- Use independent runtimes for TTS training.
- Do not restart Gateway while a training job is active.
