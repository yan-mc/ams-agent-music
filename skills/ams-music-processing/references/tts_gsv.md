# GPT-SoVITS TTS（新管线）

## 运行时

- 组件：`runtime.tts-gsv-core`（Windows 便携 GPT-SoVITS runtime）
- 环境变量：
  - `AMS_TTS_GSV_ROOT`：runtime 根目录
  - `AMS_TTS_GSV_HOME`：音色/日志/tmp，默认 `<AMS_HOME>/tts-gsv`
- 默认引擎：`v5turbo`（48kHz）；回退档：`v2ProPlus`（32kHz）。

## 音色包

`<AMS_TTS_GSV_HOME>/voices/<voice_id>/voice.json`：

```json
{
  "id": "xianyun_p0_v5turbo",
  "name": "闲云 V5turbo",
  "version": "v5turbo",
  "language": "zh",
  "sovits": "weights/xianyun_p0_v5turbo_e8_s4240_l32.pth",
  "gpt": "weights/xianyun_p0_v5turbo-e10.ckpt",
  "ref_audio": "ref/ref_01.wav",
  "ref_text": "与好友一起吃饭，无论是何种菜肴，都令人回味无穷。",
  "tags": ["原神", "闲云"]
}
```

参考音频必须 3–10 秒；相对路径相对于 `voice.json`。

## Agent tools

- `ams_tts_gsv_status`：只读，查看 runtime 是否就绪、音色数量、默认引擎。
- `ams_tts_gsv_voices`：只读，列出已训练音色。
- `ams_tts_gsv_synthesize(text, voice_id, speed?, seed?, confirm=true)`：
  提交 `tts.synthesize.gsv` 作业，返回 Gateway job；用 `ams_job_wait` 等完成，
  再用 `ams_evaluate_audio` 检查产物。
- `ams_tts_gsv_train(dataset_dir, voice_id, epochs_sovits?, epochs_gpt?, ref_audio?, ref_text?, confirm=true)`：
  提交 `tts.train.gsv`，在 runtime 内执行 V5turbo LoRA + GPT 训练，完成后自动写入
  `data/tts-gsv/voices/<voice_id>/`。数据集需含 `wav/` 与 `metadata.csv`（`filename|text`）。

## 训练流程（P2）

1. `ams_dataset_audit(kind="tts")` 检查 wav/文本/时长；
2. 确认参考音频 3–10s 且文本一致；
3. `ams_tts_gsv_train(...)`（需用户批准）→ `ams_job_wait`；
4. 训练完成后 `ams_tts_gsv_voices` 确认注册；
5. `ams_tts_gsv_synthesize` + 人耳 A/B。

当前 P2 训练驱动只支持 `v5turbo`；V2ProPlus 全量微调后续接入。

## 质量门槛

- 必须用人耳 A/B 听语气、停顿、句尾、专名；Vosk/ASR 的字符 CER 会把同音字判错，
  不能单独作为发音结论。
- 默认 v5turbo；若音色/韵律不满意，切 v2ProPlus 或增加训练轮数。
- 新音色必须先完成数据集审计与参考音频检查，再进入训练/注册。

## 常见错误

| 错误 | 处理 |
|---|---|
| `BACKEND_NOT_CONFIGURED` | 未安装 `runtime.tts-gsv-core` 或 `AMS_TTS_GSV_ROOT` 未注入 |
| `INPUT_NOT_FOUND` | `voice.json`、权重、参考音频缺失 |
| `BACKEND_TIMEOUT` | 首次加载/合成超时；检查显存与 runtime 日志 |
| `TTS_FAILED` | 看 `service_log`（默认 `tts-gsv/logs`） |
