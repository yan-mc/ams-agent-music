# Agent Tool Contracts

All tools return text content containing JSON.

Success shape:

    { "ok": true, "data": ..., "warnings": [], "artifacts": [] }

Failure shape:

    { "ok": false, "error": { "code": "...", "message": "...", "hint": "..." } }

## ams_mode_enter

Input: intent = read|execute|publish, acknowledge = boolean.

Must be called first.

## ams_status

No input. Returns gateway health, data root, plugin version.

## ams_inventory

Input: kind = voices|tts_gsv_voices|datasets|projects|all.

## ams_dataset_prepare_rvc

Input: source_path, dataset_name, confirm=true; optional target_sr/min_sec/max_sec.

Wraps Gateway dataset.prepare.

## ams_dataset_inspect

Input: path (under data), kind = rvc|tts.

Output: clips, metadata_rows, duration_sec, missing_metadata.

## ams_dataset_audit

Input: path, min_sec.

Output: short_clips, interjection_candidates, requires_user_review.

Never deletes.

## ams_voice_delete_to_trash

Input: name, kind = rvc, confirm=true. Moves data/voices entry to data/trash; never deletes.

## ams_job_submit

Input:

    type: ping|mock.long|convert.msvc|convert.rvc|separate.pymss|train.rvc|dataset.prepare|evaluate.audio|mix.master|tts.synthesize.gsv|tts.train.gsv|tts.dataset.prepare.gsv
    params: object
    project_id?: string
    confirm?: boolean

Write types require confirm=true. Returns job id.

## ams_job_status / ams_job_list / ams_job_cancel / ams_job_wait

Status/list read-only. Cancel requires confirm=true. job_wait polls until terminal or timeout_sec (max 900).

## ams_tts_gsv_status / ams_tts_gsv_voices

Read-only: runtime/voices status and registered GPT-SoVITS voices.

## ams_tts_gsv_synthesize

Input: text, voice_id, speed?, seed?, confirm=true.

Submits `tts.synthesize.gsv`; returns job. Use ams_job_wait, then evaluate/list artifacts.

## ams_tts_gsv_train

Input: dataset_dir, voice_id, name?, epochs_sovits?, epochs_gpt?, ref_audio?, ref_text?, version?, confirm=true.

Submits `tts.train.gsv`; registers `data/tts-gsv/voices/<voice_id>/voice.json` on success.

## ams_tts_gsv_dataset_prepare

Input: source_path, dataset_name, confirm=true.

Imports a GSV dataset (wav/ + metadata.csv) into `data/tts-gsv/datasets/<name>`; never overwrites.

## ams_transcribe

Input: input_path, language?.

Runs local Vosk. Returns text, language, duration_sec. No network.

## ams_docs_lookup

Input: name = architecture|tools|safety|lessons|datasets|release|tts_gsv.

## ams_release_check

Input: dir?.

Reads ams-components.json and RELEASE_MANIFEST.json and checks sequence/setup hash.

## ams_dataset_clean

Input: path, files (exact wav names from audit proposed_actions), confirm=true.

Moves approved wav files to data/trash/datasets. Never deletes.

## ams_evaluate_audio

Input: input_path, transcribe?, expected_text?.

Local metrics: duration, peak, RMS, clipping, silence. Optional local ASR and expected-text char recall.
