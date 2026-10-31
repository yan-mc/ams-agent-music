# 嘉音Studio Agent 插件功能详解（@ams/agent-music）

> 这是"让 AI 在聊天里直接操作整套嘉音Studio"的插件：25 个 `ams_*` 工具 + 1 个 Skill（`ams-music-processing`）+ 本地语音转写（Vosk ASR）。
> 全部操作只落在本机 `data/` 目录内；默认只读，写操作必须显式 `confirm=true`。

## 一、它能让你在聊天里做什么

### 1. 查看与巡检（只读）
- `ams_mode_enter`：进入 AMS 工作模式（read / execute / publish 三档权限）。
- `ams_status`：查看 Gateway 健康、版本、任务数、数据根目录。
- `ams_inventory`：列出音源（RVC）、TTS 音色、数据集、工程。
- `ams_dataset_inspect`：检查数据集目录结构、片段数、时长、采样率、缺失文件。
- `ams_dataset_audit`：数据集质量审计——过短/过长、静音、削波、音量过低、重复片段、缺文本、语气词等。
- `ams_docs_lookup`：按需查内置参考文档（架构/工具/安全/数据集/发布/经验），不一次性塞满上下文。
- `ams_release_check`：发布前自检——feed/manifest sequence、setup 哈希、SHA256SUMS、必需资产。

### 2. 整理与准备（写操作，需确认）
- `ams_dataset_clean`：安全清理数据集（先出报告与逐文件清单，确认后才把文件移到 `data/trash`，绝不直接删除）。
- `ams_dataset_prepare_rvc`：把 wav/目录准备成 RVC 训练数据集（统一采样率、切 3–10 秒片段）。
- `ams_voice_delete_to_trash`：把音色/模型目录移到回收站（可恢复，不删原件）。

### 3. 跑任务（通过 Gateway 串行 GPU 队列）
- `ams_job_submit`：提交任意 Gateway 任务（RVC 训练/换源、pymss 分离、TTS 合成/训练、数据集准备、评测、混音、MSVC 转换）；写类型需 confirm。
- `ams_job_status` / `ams_job_list`：查询任务状态与列表。
- `ams_job_wait`：等待任务完成（带超时），可连续跟进长任务。
- `ams_job_cancel`：取消任务（需确认）。
- `ams_tts_gsv_synthesize`：用 GPT-SoVITS 音色合成（需确认）。
- `ams_evaluate_audio`：本地客观评测——时长/采样率/声道/峰值/RMS/削波/静音；可选 ASR 转写并计算与预期文本的字召回。
- `ams_transcribe`：本地 Vosk 语音转写（音频不上传；依赖/模型自动探测，可用环境变量覆盖）。

## 二、Skill：ams-music-processing
给 Agent 的"操作手册"：什么时候用哪个工具、写操作的安全边界、数据集规范、发布检查清单、常见坑。
加载后 Agent 会按"先读（ams_mode_enter）→ 再查（status/inventory）→ 后执行（confirm）"的顺序工作。

## 三、安全边界
- 只读写 `<AMS_HOME>/data`，越界直接 `PATH_DENIED`；
- 默认只读；所有写操作要求 `confirm=true`（来自用户明确同意）；
- 没有 shell、没有任意命令执行；
- 删除只到 `data/trash`，不销毁原件；
- 音频/转写默认不外传；
- 审计日志：`<AMS_HOME>/logs/agent-music-load.log`（加载、工具注册、自检）。

## 四、ASR 依赖（可选）
- Python：`runtime/tts-train/0.1.0/.../python/python.exe`（自动探测实际嵌套目录）
- Vosk 包：同目录 `deps`
- 中文模型：`models/vosk-cn/vosk-model-small-cn-0.22`
- ffmpeg：`runtime/rvc/0.1.0/ffmpeg.exe`
- 全部可用 `AMS_ASR_PYTHON / AMS_ASR_LIB / AMS_ASR_MODEL / AMS_FFMPEG` 覆盖；缺依赖时 `ams_transcribe` 会返回明确的缺失说明。

## 五、典型用法示例
- "帮我看看现在有哪些音源和数据集，哪个数据集质量有问题？"
- "把 `datasets/xianyun640` 里太短的片段清掉，先给我报告，确认后再移动。"
- "用曼波音色把 `projects/demo/vocals.wav` 换源，调 +2 半音。"
- "把这首歌做人声分离，然后我用分离出的人声换源。"
- "合成一段中文 TTS：'欢迎使用嘉音Studio'，用 huayan 音色。"
- "评测一下 `artifacts/job_xxx/out.wav`，转写看看和文本对不对。"

## 六、壁纸与「音乐制作」模式（0.2.2 新增）

- **壁纸**：`@ams/agent-music-ui` 在 Kernel 页面注入嘉音Studio 壁纸（1280/1600 压缩版内联，运行时 CSS；不修改内核）。壁纸层在 UI 下方并带半透明遮罩，保证文字可读。
- **音乐制作模式**：新建任务时在 Agent 预设里选择「音乐制作」。该 preset：
  * 使用音乐制作 Persona，优先 `ams_*` 工具与 `ams-music-processing` Skill；
  * 打开时自动把会话工作目录切到嘉音Studio 安装目录的 `data`（`@ams/agent-music-mode` 解析 `AMS_HOME` → Kernel cwd 的父目录 → `DSH_HOME`，不写死盘符）；
  * 与「标准模式」「创造模式」并列，可随时切换。
