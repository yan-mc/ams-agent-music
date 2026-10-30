# Dataset Formats

## RVC

Directory with wav files (sources or processed). Existing dataset.prepare creates processed segments.

Training params:

    dataset_dir
    model_name
    version v1|v2
    sample_rate 32k|40k|48k
    if_f0 0|1
    f0_method rmvpe|harvest|pm|crepe
    epochs
    batch_size
    save_every
    gpu

Output: data/voices/<model>/*.pth + .index + voice.json.

## TTS

Directory:

    metadata.csv
    wav/
      0001.wav
      0002.wav

metadata row: id|text

Single speaker, 22050 Hz recommended, low noise.

Training params:

    dataset_dir
    model_name
    language cmn|en-us
    epochs
    batch_size
    base_checkpoint

Output: data/tts_voices/<model>/<model>.onnx + .onnx.json + voice.json.

## Important

TTS phoneme IDs must follow Piper exactly:

- BOS + PAD;
- each phoneme + PAD;
- EOS;
- terminator punctuation and space;
- NFD normalization.

Do not train TTS with a custom sequence that only looks similar.
