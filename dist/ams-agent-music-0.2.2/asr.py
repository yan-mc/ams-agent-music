#!/usr/bin/env python3
"""Local Vosk ASR for the AMS agent plugin. No network; audio stays local."""
import argparse, json, os, subprocess, tempfile, wave
import sys
_lib=os.environ.get('AMS_ASR_LIB','')
if _lib: sys.path.insert(0,_lib)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--audio',required=True)
    ap.add_argument('--model',required=True)
    ap.add_argument('--ffmpeg',required=True)
    ap.add_argument('--language',default='zh')
    a=ap.parse_args()
    if not os.path.isfile(a.audio): raise RuntimeError('audio not found')
    if not os.path.isdir(a.model): raise RuntimeError('model not found')
    tmp=tempfile.NamedTemporaryFile(suffix='.16k.wav',delete=False)
    tmp.close()
    try:
        r=subprocess.run([a.ffmpeg,'-y','-i',a.audio,'-ar','16000','-ac','1','-c:a','pcm_s16le',tmp.name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if r.returncode!=0: raise RuntimeError('ffmpeg failed')
        from vosk import Model, KaldiRecognizer
        model=Model(a.model)
        wf=wave.open(tmp.name,'rb')
        if wf.getnchannels()!=1 or wf.getframerate()!=16000 or wf.getsampwidth()!=2:
            raise RuntimeError('expected 16k mono s16 wav')
        rec=KaldiRecognizer(model,wf.getframerate())
        segments=[]; text=[]
        while True:
            data=wf.readframes(4000)
            if not data: break
            if rec.AcceptWaveform(data):
                obj=json.loads(rec.Result()); t=obj.get('text','')
                if t: text.append(t)
        final=json.loads(rec.FinalResult()); t=final.get('text','')
        if t: text.append(t)
        wf.close()
        print(json.dumps({'ok':True,'text':' '.join(text),'language':a.language,'duration_sec':round(os.path.getsize(tmp.name)/32000,3),'segments':[]},ensure_ascii=False),flush=True)
    finally:
        try: os.unlink(tmp.name)
        except OSError: pass

if __name__=='__main__':
    try: main()
    except BaseException as e:
        print(json.dumps({'ok':False,'error':str(e)[:500]},ensure_ascii=False),flush=True)
        raise
