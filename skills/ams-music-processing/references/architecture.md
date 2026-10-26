# AMS Architecture Map

## Process chain

DSH Agent -> skill ams-music-processing -> @ams/agent-music Host tools -> Gateway /api/v1 -> runners -> data/runtime.

## Launcher

Location: ams-launcher/src-tauri/src/lib.rs

Responsibilities:

- launch Kernel;
- read data/runtime/ports.json and gateway.token;
- set AMS_HOME and runtime paths;
- start/restart Host;
- TTS/RVC/pymss environment.

## Kernel / DSH

Location: F:/AMS-Studio/data/kernel

Profile: F:/AMS-Studio/data/kernel/dsh/profiles/desktop

Responsibilities: Host process, plugin loading, Web UI, skills, agent tools.

## Host plugin core

Location: ams-plugins/packages/plugin-core/src/index.js

Routes: /ams/api

Responsibilities: session/auth, browser bridge, generic music_* tools, SSE proxy.

Agent plugin must not import it. Use Gateway HTTP as the contract.

## UI plugin

Location: ams-plugins/packages/plugin-ui/src/client.js

Responsibilities: pages, forms, job list, playback, dataset UI. Agent plugin does not depend on it.

## Gateway

Location: ams-services/gateway

Responsibilities:

- job lifecycle and queue;
- GPU lock;
- SSE events;
- artifacts;
- runner registry;
- work dirs.

Endpoints:

    POST /api/v1/jobs
    GET /api/v1/jobs
    GET /api/v1/jobs/{id}
    GET /api/v1/jobs/{id}/events
    POST /api/v1/jobs/{id}/cancel
    GET /api/v1/health
    GET /api/v1/tts/models

Auth: Bearer token from data/runtime/gateway.token. Port from ports.json.

## Runtimes

    data/runtime/rvc/0.1.0
    data/runtime/tts/0.1.0
    data/runtime/tts-train/0.1.0
    data/runtime/pymss/0.1.0

## Data layout

    data/voices/<name>/<name>.pth + <name>.index + voice.json
    data/tts_voices/<name>/<name>.onnx + <name>.onnx.json + voice.json
    data/datasets/rvc...
    data/datasets/tts/<name>/metadata.csv + wav/
    data/tts_train/<job>/preprocessed
    data/artifacts/<job>/
    data/projects/<id>/
    data/trash/
    data/backups/
    data/logs/
    data/runtime/

## Runtime rules

- all AMS data under F:/AMS-Studio/data;
- no C: data;
- no persistent env vars required;
- Gateway token never leaves Host;
- training and GPU jobs are serialized.
