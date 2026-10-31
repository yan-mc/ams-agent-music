/**
 * AMS Music Agent Host plugin.
 * Independent of @ams/plugin-core and @ams/plugin-ui.
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, cpSync, writeFileSync, renameSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import http from 'node:http'
import { createHash } from 'node:crypto'
// Minimal DSH tool definition helper: compile the author-facing parameter map into
// the raw JSON Schema object the model-facing tool registry expects.
const renderValue = (_args, value) => [{ type:'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
const JSON_ANY = { oneOf: [{ type:'object' }, { type:'array' }, { type:'string' }, { type:'number' }, { type:'boolean' }] }
function compileValueSpec(v) {
  if (!v || typeof v !== 'object') return {}
  if (v.type === 'json') return JSON_ANY
  if (v.type === 'oneOf' && Array.isArray(v.branches)) return { oneOf: v.branches.map(compileValueSpec) }
  const spec = { type: v.type || 'string' }
  if (v.enum) spec.enum = v.enum
  if (v.description) spec.description = v.description
  if (v.default !== undefined) spec.default = v.default
  if (v.items) spec.items = compileValueSpec(v.items)
  if (v.type === 'object' && v.properties) { spec.properties = {}; spec.required = [] ; for (const [k, pv] of Object.entries(v.properties)) { spec.properties[k]=compileValueSpec(pv); if (pv && pv.required===true) spec.required.push(k) } ; if (!spec.required.length) delete spec.required }
  return spec
}
function compileParameters(params) {
  const properties = {}; const required = []
  for (const [key, value] of Object.entries(params || {})) {
    properties[key] = compileValueSpec(value)
    if (value && value.required === true) required.push(key)
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) }
}
const defineTool = (definition) => ({ ...definition, parameters: compileParameters(definition.parameters), output: definition.output || { schema:{ type:'object', additionalProperties:true }, render:renderValue } })
// Resolve AMS_HOME from env / Kernel cwd / DSH_HOME instead of a hardcoded install path.
// The Kernel is launched with cwd = <AMS_HOME>/kernel, and the launcher strips AMS_* env vars,
// so cwd is the most reliable signal for installed builds.
function looksLikeAmsHome(p) {
  try { return !!p && existsSync(join(p, 'runtime')) && (existsSync(join(p, 'config')) || existsSync(join(p, 'components')) || existsSync(join(p, 'kernel'))) } catch { return false }
}
function resolveAmsHome() {
  const candidates = []
  if (process.env.AMS_HOME && process.env.AMS_HOME.trim()) candidates.push(resolve(process.env.AMS_HOME.trim()))
  try { candidates.push(dirname(process.cwd())) } catch {}
  if (process.env.DSH_HOME && process.env.DSH_HOME.trim()) { const v = resolve(process.env.DSH_HOME.trim()); candidates.push(dirname(dirname(v))) }
  candidates.push('F:/AMS-Studio/data')
  for (const c of candidates) { const abs = resolve(c); if (looksLikeAmsHome(abs)) return abs }
  return resolve(candidates[0] || 'F:/AMS-Studio/data')
}
function amsHome() { return resolveAmsHome() }
function auditLog(message) {
  try {
    const logs = join(amsHome(), 'logs')
    mkdirSync(logs, { recursive: true })
    appendFileSync(join(logs, 'agent-music-load.log'), String(message) + ' ' + new Date().toISOString() + '\n')
  } catch {}
}
auditLog('module-loaded')

const execFileAsync = promisify(execFile)
const VERSION = '0.3.1'
const WRITE_TYPES = new Set(['train.rvc','dataset.prepare','convert.rvc','convert.msvc','separate.pymss','mix.master','tts.synthesize.gsv','tts.train.gsv','tts.dataset.prepare.gsv'])
const ALL_TYPES = new Set(['ping','mock.long','convert.msvc','convert.rvc','separate.pymss','train.rvc','tts.synthesize.gsv','tts.train.gsv','tts.dataset.prepare.gsv','dataset.prepare','evaluate.audio','mix.master'])

function dataPath(...parts) { const root = amsHome(); const full = resolve(root, ...parts); if (full !== root && !full.startsWith(root + sep)) throw new Error('PATH_DENIED'); return full }
function readJson(file) { return JSON.parse(readFileSync(file,'utf8')) }
function gatewayInfo() {
  const root = amsHome(); const ports = readJson(join(root,'runtime','ports.json')); const g = ports.gateway || {}
  const tokenFile = g.token_file || join(root,'runtime','gateway.token')
  return { base: 'http://' + (g.host || '127.0.0.1') + ':' + g.port + (g.api_prefix || '/api/v1'), token: readFileSync(tokenFile,'utf8').trim() }
}
function gateway(pathname, method='GET', body) {
  const info = gatewayInfo(); const url = new URL(info.base + pathname); const payload = body === undefined ? null : Buffer.from(JSON.stringify(body),'utf8')
  return new Promise((resolve,reject) => {
    const req = http.request({ hostname:url.hostname, port:url.port, path:url.pathname+url.search, method, headers:{ 'Authorization':'Bearer '+info.token, 'Content-Type':'application/json', ...(payload?{'Content-Length':payload.length}:{}) } }, res => {
      const chunks=[]; res.on('data',c=>chunks.push(c)); res.on('end',()=>{ const text=Buffer.concat(chunks).toString('utf8'); let data=null; try{data=text?JSON.parse(text):null}catch{data={raw:text}}; if(res.statusCode>=400){const e=new Error('Gateway HTTP '+res.statusCode);e.detail=data;reject(e)}else resolve(data) })
    })
    req.on('error',reject); if(payload) req.write(payload); req.end()
  })
}
function clampText(s, n=2000) { return String(s || '').slice(0,n) }
function toolResult(value) { return value }
function requireConfirm(args) { if (args && args.confirm === true) return; const e = new Error('CONFIRMATION_REQUIRED: set confirm=true after explicit user approval'); e.code='CONFIRMATION_REQUIRED'; throw e }
function safeRelPath(value) { const p = String(value || '').trim(); if (!p) throw new Error('PATH_REQUIRED'); return dataPath(p) }
function listDir(dir) { try { return readdirSync(dir).filter(n => !n.startsWith('.')).map(name => ({ name, path: join(dir,name) })) } catch { return [] } }
function wavDuration(file) {
  try { const b = readFileSync(file); if (b.length < 44 || b.toString('ascii',0,4) !== 'RIFF') return null; const channels=b.readUInt16LE(22), rate=b.readUInt32LE(24), bits=b.readUInt16LE(34); if (!bits || !channels || !rate) return null; for (let i=12;i+8<=b.length;){ const id=b.toString('ascii',i,i+4); const n=b.readUInt32LE(i+4); if (id==='data') return n/(rate*channels*(bits/8)); i += 8+n+(n%2) } } catch {}
  return null
}


function wavMetrics(file) {
  try {
    const b=readFileSync(file); if(b.length<44 || b.toString('ascii',0,4)!=='RIFF') return null
    let channels=0,rate=0,bits=0,dataStart=-1,dataLen=0
    for(let i=12;i+8<=b.length;){ const id=b.toString('ascii',i,i+4); const n=b.readUInt32LE(i+4); if(id==='fmt '){channels=b.readUInt16LE(i+10);rate=b.readUInt32LE(i+12);bits=b.readUInt16LE(i+22)} if(id==='data'){dataStart=i+8;dataLen=n;break} i+=8+n+(n%2) }
    if(dataStart<0||!channels||!rate||bits!==16) return {duration_sec:null,peak:null,rms:null,clipping:null,silence_ratio:null}
    const count=Math.floor(Math.min(dataLen,b.length-dataStart)/2); let peak=0,sum=0,clip=0,silent=0
    for(let i=0;i<count;i++){ const v=b.readInt16LE(dataStart+i*2); const a=Math.abs(v); if(a>peak)peak=a; sum+=v*v; if(a>=32760)clip++; if(a<500)silent++ }
    return { duration_sec:Math.round((count/(rate*channels))*1000)/1000, peak:Math.round(peak/32768*10000)/10000, rms:Math.round(Math.sqrt(sum/Math.max(1,count))/32768*10000)/10000, clipping:clip, silence_ratio:Math.round(silent/Math.max(1,count)*1000)/1000 }
  } catch { return null }
}
function metadataMap(dir) {
  const m={}; const f=join(dir,'metadata.csv'); if(!existsSync(f)) return m
  for(const line of readFileSync(f,'utf8').split(/\r?\n/)){ if(!line.trim()) continue; let p; if(line.includes('|')) p=line.split('|'); else p=line.split(','); if(p.length>1){ const key=p[0].trim().replace(/\.wav$/i,''); m[key]=p.slice(1).join('|').trim() } }
  return m
}

function registerSkill(ctx, log) {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'ams-music-processing')
    const locator = join(root, 'SKILL.md')
    if (!existsSync(locator) || !ctx.skills || typeof ctx.skills.registerProvider !== 'function') return
    const candidate = { name:'ams-music-processing', rank:600, description:'Operate AMS Studio music pipelines safely through the independent ams_* Agent tools.', invocation:{modelInvocable:true,userInvocable:true}, provider:'ams-agent-music', source:'bundled', resourceBase:{kind:'directory',path:root}, locator }
    const provider = { name:'ams-agent-music', list:()=>Promise.resolve([candidate]), async get(){ return { ...candidate, content: readFileSync(locator,'utf8') } } }
    ctx.skills.registerProvider(() => provider)
    auditLog('skill-provider-registered')
    Promise.resolve(provider.list()).then(async (list) => { auditLog('skill-list '+list.map(x=>x.name).join(',')); const got=await provider.get(list[0],{}); auditLog('skill-content '+got.name+' bytes='+String(got.content||'').length) }).catch((e)=>auditLog('skill-selftest-error '+String(e && e.message ? e.message : e)))
  } catch (e) { log('skill provider registration failed: '+String(e && e.message ? e.message : e)) }
}

function installSkills(log) {
  try {
    const root = amsHome(); const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'ams-music-processing')
    const targets = [join(root,'kernel','dsh','skills','ams-music-processing'), join(root,'kernel','resources','runtime','ams-agent-skills','ams-music-processing'), join(root,'kernel','dsh','profiles','desktop','skills','ams-music-processing')]
    if (!existsSync(source)) return
    for (const target of targets) { try { mkdirSync(dirname(target),{recursive:true}); cpSync(source,target,{recursive:true,force:true}) } catch (e) { log('skill install target failed: '+target+' '+String(e && e.message ? e.message : e)) } }
  } catch (e) { log('skill install skipped: '+String(e && e.message ? e.message : e)) }
}

export const name = 'ams-agent-music'
export const inject = ['tools', 'skills']
export function apply(ctx) {
  const log = (m) => { try { ctx.logger.info('[ams-agent-music] '+m) } catch { console.log('[ams-agent-music] '+m) } }
  installSkills(log)
  registerSkill(ctx, log)
  const modeTool = defineTool({
    name:'ams_mode_enter',
    description:'Enter AMS music processing mode. Call before any AMS action. intent=read|execute|publish; execute/publish require explicit user approval and confirm=true on write tools.',
    parameters:{ intent:{type:'string',required:true,enum:['read','execute','publish']}, acknowledge:{type:'boolean',description:'User acknowledged the mode and safety rules.'} },
    async execute(args) {
      const intent=String(args.intent||'read'); if(!['read','execute','publish'].includes(intent)) throw new Error('INVALID_INTENT')
      return toolResult({ ok:true, mode:'ams-music-processing', version:VERSION, intent, data_root:amsHome(), capabilities:['status','inventory','dataset.inspect','dataset.audit','job.submit','job.status','job.cancel','tts.synthesize.gsv','transcribe','docs.lookup'], policy:{read_only_default:true,confirm_required_for_writes:true,no_shell:true,path_root:amsHome()}, acknowledged: args.acknowledge===true })
    }
  })
  const statusTool = defineTool({
    name:'ams_status', description:'Read AMS Host/Gateway status, data root, versions and active jobs. Read-only.',
    parameters:{},
    async execute() { let health=null, err=null; try { health=await gateway('/health') } catch(e) { err=String(e&&e.message?e.message:e) } return toolResult({ ok:!err, data_root:amsHome(), plugin_version:VERSION, gateway:health, error:err }) }
  })
  const inventoryTool = defineTool({
    name:'ams_inventory', description:'List AMS voices, GPT-SoVITS voices, datasets and projects. Read-only.',
    parameters:{ kind:{type:'string',enum:['voices','tts_gsv_voices','datasets','projects','all']} },
    async execute(args) { const root=amsHome(); const kind=String(args.kind||'all'); const out={}; const add=(key,rel)=>{out[key]=listDir(join(root,rel)).map(x=>({name:x.name,path:x.path}))}; if(kind==='all'||kind==='voices') add('voices','voices'); if(kind==='all'||kind==='tts_gsv_voices') add('tts_gsv_voices','tts-gsv/voices'); if(kind==='all'||kind==='datasets') add('datasets','datasets'); if(kind==='all'||kind==='projects') add('projects','projects'); return toolResult({ok:true,data_root:root,items:out}) }
  })
  const datasetInspectTool = defineTool({
    name:'ams_dataset_inspect', description:'Inspect an RVC/TTS dataset directory under AMS data: wav count, metadata count and total duration. Read-only.',
    parameters:{ path:{type:'string',required:true}, kind:{type:'string',enum:['rvc','tts']} },
    async execute(args) { const dir=safeRelPath(args.path); const kind=String(args.kind||'rvc'); const wavDir=existsSync(join(dir,'wav'))?join(dir,'wav'):join(dir,'processed'); const files=listDir(wavDir).filter(x=>x.name.toLowerCase().endsWith('.wav')); let total=0; for(const f of files){const d=wavDuration(f.path); if(d) total+=d} const meta=existsSync(join(dir,'metadata.csv'))?readFileSync(join(dir,'metadata.csv'),'utf8').split(/\r?\n/).filter(Boolean).length:null; return toolResult({ok:true,path:dir,kind,wav_dir:wavDir,clips:files.length,metadata_rows:meta,duration_sec:Math.round(total*100)/100,missing_metadata:meta===null}) }
  })
  const datasetAuditTool = defineTool({
    name:'ams_dataset_audit', description:'Audit an RVC/TTS dataset: duration, silence, clipping, duplicates, missing text, interjections. Produces a dry-run report; never deletes.',
    parameters:{ path:{type:'string',required:true}, kind:{type:'string',enum:['rvc','tts']}, min_sec:{type:'number'}, max_sec:{type:'number'}, check_transcripts:{type:'boolean'}, max_transcripts:{type:'integer'} },
    async execute(args) {
      const dir=safeRelPath(args.path); const kind=String(args.kind||'tts'); const wavDir=existsSync(join(dir,'wav'))?join(dir,'wav'):join(dir,'processed');
      const files=listDir(wavDir).filter(x=>x.name.toLowerCase().endsWith('.wav')); const meta=metadataMap(dir);
      const min=Number(args.min_sec||(kind==='tts'?1:3)), max=Number(args.max_sec||30); const short=[],long=[],silent=[],clipped=[],quiet=[],dups=[],missing=[],interjections=[],bad=[];
      const hashes={};
      for(const f of files){
        const m=wavMetrics(f.path); const name=f.name; const text=meta[name.replace(/\.wav$/i,'')]||'';
        if(!m) { bad.push({name,error:'unreadable_wav'}); continue }
        if(m.duration_sec!==null && m.duration_sec<min) short.push({name,duration_sec:m.duration_sec});
        if(m.duration_sec!==null && m.duration_sec>max) long.push({name,duration_sec:m.duration_sec});
        if(m.silence_ratio!==null && m.silence_ratio>0.6) silent.push({name,silence_ratio:m.silence_ratio});
        if(m.clipping!==null && m.clipping>0) clipped.push({name,clipping:m.clipping});
        if(m.peak!==null && m.peak<0.01) quiet.push({name,peak:m.peak});
        if(kind==='tts' && !text.trim()) missing.push(name);
        if(kind==='tts' && /^[嗯啊哦诶欸呀吧啦呢哈]+[。！？!?]*$/.test(text.trim())) interjections.push({name,text});
        try { const h=createHash('sha256').update(readFileSync(f.path)).digest('hex'); if(hashes[h]) dups.push({name,duplicate_of:hashes[h]}); else hashes[h]=name } catch {}
      }
      const transcript_mismatch=[];
      if(args.check_transcripts===true && kind==='tts'){ const limit=Math.min(20,Math.max(1,Number(args.max_transcripts||5))); let done=0; for(const f of files){ if(done>=limit) break; const id=f.name.replace(/\.wav$/i,''); const expected=String(meta[id]||'').trim(); if(!expected) continue; try { const t=await transcribeTool.execute({input_path:f.path}); if(t && t.ok){ const a=String(t.text||'').replace(/\s+/g,''); const set=new Set(expected.replace(/\s+/g,'')); let hit=0; for(const ch of set) if(a.includes(ch)) hit++; const recall=set.size?Math.round(hit/set.size*1000)/1000:null; if(recall!==null && recall<0.6) transcript_mismatch.push({name:f.name,expected,recognized:String(t.text||''),char_recall:recall}) } } catch {} done++ } }
      const proposed=[]; for(const x of short) proposed.push({file:x.name,reason:'short'}); for(const x of long) proposed.push({file:x.name,reason:'long'}); for(const x of silent) proposed.push({file:x.name,reason:'silence'}); for(const x of clipped) proposed.push({file:x.name,reason:'clipping'}); for(const x of quiet) proposed.push({file:x.name,reason:'quiet'}); for(const x of dups) proposed.push({file:x.name,reason:'duplicate'}); for(const x of missing) proposed.push({file:x,reason:'missing_text'}); for(const x of interjections) proposed.push({file:x.name,reason:'interjection'}); for(const x of transcript_mismatch) proposed.push({file:x.name,reason:'transcript_mismatch'});
      return toolResult({ok:true,path:dir,kind,clips:files.length,report:{short,long,silent,clipped,quiet,duplicates:dups,missing_text:missing,interjections,transcript_mismatch,unreadable:bad},proposed_actions:proposed,requires_user_review:true,note:'Dry-run only. No files changed. Review proposed_actions, then call ams_dataset_clean with explicit file names and confirm=true.'})
    }
  })
  const datasetCleanTool = defineTool({
    name:'ams_dataset_clean', description:'Move explicitly approved dataset wav files to data/trash after review. Requires confirm=true.',
    parameters:{ path:{type:'string',required:true}, files:{type:'json',required:true,description:'Exact wav file names from audit proposed_actions.'}, confirm:{type:'boolean'} },
    async execute(args) {
      requireConfirm(args); const dir=safeRelPath(args.path); const wavDir=existsSync(join(dir,'wav'))?join(dir,'wav'):join(dir,'processed');
      const names=Array.isArray(args.files)?args.files:[]; if(!names.length) throw new Error('FILES_REQUIRED');
      const dest=join(amsHome(),'trash','datasets',dir.split(/[\\/]/).pop()+'-'+Date.now()); mkdirSync(dest,{recursive:true}); const moved=[];
      for(const raw of names){ const name=String(raw); if(!name || name.includes('/')||name.includes('\\')||name!==name.split(/[\\/]/).pop()) throw new Error('INVALID_FILE_NAME'); const src=join(wavDir,name); if(!existsSync(src)) throw new Error('FILE_NOT_FOUND: '+name); renameSync(src,join(dest,name)); moved.push(name) }
      return toolResult({ok:true,moved,trash_dir:dest,note:'Original dataset files were moved, not deleted.'})
    }
  })
  const datasetPrepareRvcTool = defineTool({
    name:'ams_dataset_prepare_rvc', description:'Prepare an RVC dataset via dataset.prepare. Requires confirm=true.',
    parameters:{ source_path:{type:'string',required:true}, dataset_name:{type:'string',required:true}, target_sr:{type:'integer'}, min_sec:{type:'number'}, max_sec:{type:'number'}, confirm:{type:'boolean'} },
    async execute(args){ requireConfirm(args); const job=await gateway('/jobs','POST',{type:'dataset.prepare',params:{source_path:String(args.source_path),dataset_name:String(args.dataset_name),target_sr:args.target_sr||48000,min_sec:args.min_sec||3,max_sec:args.max_sec||10},project_id:null}); return toolResult({ok:true,job}) }
  })
  const jobWaitTool = defineTool({
    name:'ams_job_wait', description:'Wait for a Gateway job to reach a terminal state, polling up to timeout_sec.',
    parameters:{ job_id:{type:'string',required:true}, timeout_sec:{type:'integer',description:'1..900, default 300'} },
    async execute(args){ const id=String(args.job_id); const timeout=Math.min(900,Math.max(1,Number(args.timeout_sec||300))); const deadline=Date.now()+timeout*1000; let job=null; while(Date.now()<deadline){ job=await gateway('/jobs/'+encodeURIComponent(id)); if(['succeeded','failed','cancelled'].includes(String(job.status))) return toolResult({ok:job.status==='succeeded',job}); await new Promise(r=>setTimeout(r,2000)) } return toolResult({ok:false,error:{code:'JOB_WAIT_TIMEOUT',message:'timeout_sec reached'},job}) }
  })

  const voiceTrashTool = defineTool({
    name:'ams_voice_delete_to_trash', description:'Move an RVC voice directory to data/trash. Never deletes originals. Requires confirm=true.',
    parameters:{ name:{type:'string',required:true}, kind:{type:'string',enum:['rvc']}, confirm:{type:'boolean'} },
    async execute(args){ requireConfirm(args); const kind=String(args.kind||'rvc'); const rel='voices'; const src=dataPath(rel,String(args.name)); if(!existsSync(src)) throw new Error('VOICE_NOT_FOUND'); const dest=join(amsHome(),'trash',rel,String(args.name)+'-'+Date.now()); mkdirSync(dirname(dest),{recursive:true}); renameSync(src,dest); return toolResult({ok:true,moved_from:src,moved_to:dest}) }
  })
  const jobSubmitTool = defineTool({
    name:'ams_job_submit', description:'Submit a typed AMS Gateway job. Write types require confirm=true after explicit user approval.',
    parameters:{ type:{type:'string',required:true,enum:[...ALL_TYPES]}, params:{type:'json',description:'Gateway params object.'}, project_id:{type:'string'}, confirm:{type:'boolean'} },
    async execute(args) { const type=String(args.type||''); if(!ALL_TYPES.has(type)) throw new Error('UNKNOWN_JOB_TYPE'); if(WRITE_TYPES.has(type)) requireConfirm(args); const job=await gateway('/jobs','POST',{type,params:args.params&&typeof args.params==='object'?args.params:{},project_id:args.project_id||null}); return toolResult({ok:true,job}) }
  })
  const jobStatusTool = defineTool({name:'ams_job_status',description:'Read one Gateway job by id.',parameters:{job_id:{type:'string',required:true}},async execute(args){return toolResult(await gateway('/jobs/'+encodeURIComponent(String(args.job_id))))}})
  const jobListTool = defineTool({name:'ams_job_list',description:'List recent Gateway jobs.',parameters:{limit:{type:'integer'}},async execute(args){return toolResult(await gateway('/jobs?limit='+Math.min(100,Number(args.limit||20))))}})
  const jobCancelTool = defineTool({name:'ams_job_cancel',description:'Cancel a Gateway job. Requires confirm=true.',parameters:{job_id:{type:'string',required:true},confirm:{type:'boolean'}},async execute(args){requireConfirm(args);return toolResult(await gateway('/jobs/'+encodeURIComponent(String(args.job_id))+'/cancel','POST',{}))}})
  const ttsGsvStatusTool = defineTool({
    name:'ams_tts_gsv_status', description:'Read GPT-SoVITS runtime/voices status (runtime.tts-gsv-core). Read-only.',
    parameters:{},
    async execute(){ return toolResult(await gateway('/tts/gsv/status')) }
  })
  const ttsGsvVoicesTool = defineTool({
    name:'ams_tts_gsv_voices', description:'List trained GPT-SoVITS voices under data/tts-gsv/voices. Read-only.',
    parameters:{},
    async execute(){ return toolResult(await gateway('/tts/gsv/voices')) }
  })
  const ttsGsvSynthTool = defineTool({
    name:'ams_tts_gsv_synthesize', description:'Synthesize text with a trained GPT-SoVITS voice (V5turbo default; V2ProPlus fallback). Requires confirm=true.',
    parameters:{ text:{type:'string',required:true}, voice_id:{type:'string',required:true}, speed:{type:'number'}, seed:{type:'integer'}, confirm:{type:'boolean'} },
    async execute(args){
      requireConfirm(args)
      const text=clampText(args.text,20000)
      if(!text) throw new Error('TEXT_REQUIRED')
      const voiceId=String(args.voice_id||'').trim()
      if(!/^[A-Za-z0-9_\-\u4e00-\u9fff]{1,64}$/.test(voiceId)) throw new Error('VOICE_ID_INVALID')
      const speed=Math.max(0.5,Math.min(2.0,Number(args.speed||1.0)))
      const seed=Number.isFinite(Number(args.seed))?Math.trunc(Number(args.seed)):42
      const job=await gateway('/jobs','POST',{type:'tts.synthesize.gsv',params:{text,voice_id:voiceId,speed,seed},project_id:null})
      return toolResult({ok:true,job})
    }
  })
  const ttsGsvTrainTool = defineTool({
    name:'ams_tts_gsv_train', description:'Train a GPT-SoVITS V5turbo LoRA voice from a dataset (wav/ + metadata.csv). Requires confirm=true; takes tens of minutes.',
    parameters:{ dataset_dir:{type:'string',required:true}, voice_id:{type:'string',required:true}, name:{type:'string'}, epochs_sovits:{type:'integer'}, epochs_gpt:{type:'integer'}, ref_audio:{type:'string'}, ref_text:{type:'string'}, confirm:{type:'boolean'} },
    async execute(args){
      requireConfirm(args)
      const dataset=String(args.dataset_dir||'').trim()
      const voiceId=String(args.voice_id||'').trim()
      if(!dataset) throw new Error('DATASET_REQUIRED')
      if(!/^[A-Za-z0-9_\-\u4e00-\u9fff]{1,64}$/.test(voiceId)) throw new Error('VOICE_ID_INVALID')
      const params={dataset_dir:dataset,voice_id:voiceId,version:'v5turbo',epochs_sovits:Math.max(1,Math.min(16,Number(args.epochs_sovits||8))),epochs_gpt:Math.max(1,Math.min(20,Number(args.epochs_gpt||10)))}
      if(args.name) params.name=String(args.name)
      if(args.ref_audio) params.ref_audio=String(args.ref_audio)
      if(args.ref_text) params.ref_text=String(args.ref_text)
      const job=await gateway('/jobs','POST',{type:'tts.train.gsv',params,project_id:null})
      return toolResult({ok:true,job})
    }
  })
  const ttsGsvDatasetTool = defineTool({
    name:'ams_tts_gsv_dataset_prepare', description:'Import an existing GPT-SoVITS dataset (wav/ + metadata.csv) into data/tts-gsv/datasets. Requires confirm=true.',
    parameters:{ source_path:{type:'string',required:true}, dataset_name:{type:'string',required:true}, confirm:{type:'boolean'} },
    async execute(args){
      requireConfirm(args)
      const source=String(args.source_path||'').trim(); const name=String(args.dataset_name||'').trim()
      if(!source||!name) throw new Error('SOURCE_AND_NAME_REQUIRED')
      const job=await gateway('/jobs','POST',{type:'tts.dataset.prepare.gsv',params:{source_path:source,dataset_name:name},project_id:null})
      return toolResult({ok:true,job})
    }
  })
  const transcribeTool = defineTool({
    name:'ams_transcribe', description:'Local speech-to-text for audio under AMS data. Returns transcript and segments; does not upload audio. ASR deps are auto-detected from the installed runtime layout; override with AMS_ASR_PYTHON / AMS_ASR_LIB / AMS_ASR_MODEL / AMS_FFMPEG.',
    parameters:{ input_path:{type:'string',required:true}, language:{type:'string'} },
    async execute(args) {
      const audio=safeRelPath(args.input_path); if(!existsSync(audio)) throw new Error('INPUT_NOT_FOUND')
      const root=amsHome()
      const script=join(dirname(fileURLToPath(import.meta.url)),'..','asr.py'); if(!existsSync(script)) throw new Error('ASR_SCRIPT_NOT_FOUND: '+script)
      const pick=(cands)=>cands.find(p=>p && existsSync(p)) || ''
      // 1) python: env override, then PATH python (Vosk libs live in data/tools/asr)
      const py=process.env.AMS_ASR_PYTHON || 'python'
      // 2) vosk deps
      const lib=process.env.AMS_ASR_LIB || join(root,'tools','asr','vosk-libs')
      // 3) model: env override, standard models/vosk-cn layout, then any vosk* dir under models
      const modelC=[]
      if(process.env.AMS_ASR_MODEL) modelC.push(process.env.AMS_ASR_MODEL)
      modelC.push(join(root,'models','vosk-cn','vosk-model-small-cn-0.22'))
      try { for (const d of readdirSync(join(root,'models'))) { if(/vosk/i.test(d)) { const v=join(root,'models',d); modelC.push(v); try { for (const m of readdirSync(v)) modelC.push(join(v,m)) } catch {} } } } catch {}
      const model=pick(modelC); if(!model) throw new Error('ASR_MODEL_NOT_FOUND: checked '+modelC.slice(0,5).join(' | '))
      // 4) ffmpeg
      const ffC=[]
      if(process.env.AMS_FFMPEG) ffC.push(process.env.AMS_FFMPEG)
      ffC.push(join(root,'tools','asr','ffmpeg.exe'), join(root,'runtime','rvc','0.1.0','ffmpeg.exe'), join(root,'runtime','rvc','0.1.0','runtime','ffmpeg.exe'))
      const ffmpeg=pick(ffC); if(!ffmpeg) throw new Error('ASR_FFMPEG_NOT_FOUND: checked '+ffC.join(' | '))
      const extra={ PYTHONIOENCODING:'utf-8', ...(lib?{AMS_ASR_LIB:lib, PYTHONPATH:lib+(process.env.PYTHONPATH?';'+process.env.PYTHONPATH:'')}:{}) }
      try {
        const { stdout }=await execFileAsync(py,[script,'--audio',audio,'--model',model,'--ffmpeg',ffmpeg],{env:{...process.env,...extra},maxBuffer:10*1024*1024,windowsHide:true})
        return toolResult(JSON.parse(stdout.trim().split(/\r?\n/).pop()))
      } catch(e) { throw new Error('ASR_FAILED: '+String(e&&e.message?e.message:e)) }
    }
  })

  const evaluateAudioTool = defineTool({
    name:'ams_evaluate_audio', description:'Evaluate an audio artifact locally: duration, peak, RMS, clipping, silence; optional ASR transcript and expected-text comparison.',
    parameters:{ input_path:{type:'string',required:true}, transcribe:{type:'boolean'}, expected_text:{type:'string'} },
    async execute(args) {
      const file=safeRelPath(args.input_path); if(!existsSync(file)) throw new Error('INPUT_NOT_FOUND'); const m=wavMetrics(file); if(!m) throw new Error('UNREADABLE_WAV');
      const flags=[]; if(!m.duration_sec) flags.push('empty'); if(m.clipping>0) flags.push('clipping'); if(m.silence_ratio>0.8) flags.push('mostly_silent'); if(m.peak<0.01) flags.push('too_quiet');
      let asr=null, expected=null;
      if(args.transcribe===true){ const t=await transcribeTool.execute({input_path:file}); if(t && t.ok){ asr={text:t.text,duration_sec:t.duration_sec}; if(args.expected_text){ const a=String(t.text||'').replace(/\s+/g,''); const b=String(args.expected_text||'').replace(/\s+/g,''); const set=new Set(b); let hit=0; for(const ch of set) if(a.includes(ch)) hit++; expected={expected:String(args.expected_text),recognized:a,char_recall:set.size?Math.round(hit/set.size*1000)/1000:null} } } else { asr={error:t && t.error ? t.error : 'ASR_FAILED'} } }
      return toolResult({ok:true,path:file,metrics:m,flags,asr,expected,passed:flags.length===0&&(!expected||expected.char_recall>=0.6)})
    }
  })
  const docsTool = defineTool({name:'ams_docs_lookup',description:'Read one bundled AMS music reference. Use progressive disclosure instead of loading all docs.',output:{schema:{type:'string'},render:renderValue},parameters:{name:{type:'string',required:true,enum:['architecture','tools','safety','lessons','datasets','release','tts_gsv']}},async execute(args){const base=join(dirname(fileURLToPath(import.meta.url)),'..','skills','ams-music-processing','references',String(args.name)+'.md'); if(!existsSync(base)) throw new Error('DOC_NOT_FOUND'); return toolResult(readFileSync(base,'utf8').slice(0,24000))}})
  const releaseTool = defineTool({
    name:'ams_release_check', description:'Preflight a release directory under AMS data: feed/manifest sequence, setup hash, SHA256SUMS, required assets. Read-only.',
    parameters:{ dir:{type:'string',required:true} },
    async execute(args) {
      const root=safeRelPath(args.dir); const feedFile=join(root,'ams-components.json'), manFile=join(root,'RELEASE_MANIFEST.json'), sumFile=join(root,'SHA256SUMS.txt');
      const checks={feed:existsSync(feedFile),manifest:existsSync(manFile),sha256sums:existsSync(sumFile)};
      let feed=null,man=null,sums={},setupFile=null,setupHash=null;
      try{feed=readJson(feedFile)}catch{}; try{man=readJson(manFile)}catch{};
      if(existsSync(sumFile)){ for(const line of readFileSync(sumFile,'utf8').split(/\r?\n/)){ const m=line.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/); if(m) sums[m[2].trim()]=m[1].toLowerCase() } }
      const candidates=[]; if(man){ const s=man.setup||{}; for(const k of ['file','path','asset','filename']) if(s[k]) candidates.push(String(s[k])); if(man.assets&&Array.isArray(man.assets)) for(const a of man.assets) if(String(a.name||a).includes('Setup')) candidates.push(String(a.name||a)); }
      for(const c of candidates){ const f=join(root,c); if(existsSync(f)){setupFile=f;break} }
      if(!setupFile){ const list=listDir(root).filter(x=>/^AMS-Studio-Setup-.*\.exe$/i.test(x.name)); if(list.length) setupFile=list[0].path }
      if(setupFile){ const h=createHash('sha256').update(readFileSync(setupFile)).digest('hex'); setupHash=h; checks.setup_hash = !!sums[setupFile.split(/[\\/]/).pop()] ? sums[setupFile.split(/[\\/]/).pop()]===h : (man&&man.setup&&man.setup.sha256 ? String(man.setup.sha256).toLowerCase()===h : false) }
      checks.feed_manifest_sequence = !!(feed&&man&&feed.sequence===man.sequence)
      checks.feed_setup_hash = !!(feed&&feed.setup&&man&&man.setup&&feed.setup.sha256===man.setup.sha256)
      checks.sha256_present = Object.keys(sums).length>0
      const files=listDir(root).map(x=>x.name); const ok=checks.feed&&checks.manifest&&checks.sha256sums&&checks.feed_manifest_sequence&&checks.feed_setup_hash&&checks.sha256_present&&checks.setup_hash
      return toolResult({ok,path:root,checks,feed_sequence:feed&&feed.sequence,manifest_sequence:man&&man.sequence,setup_file:setupFile,setup_sha256:setupHash,assets:files})
    }
  })

  const tools=[modeTool,statusTool,inventoryTool,datasetInspectTool,datasetAuditTool,datasetCleanTool,datasetPrepareRvcTool,voiceTrashTool,jobSubmitTool,jobStatusTool,jobListTool,jobCancelTool,jobWaitTool,ttsGsvStatusTool,ttsGsvVoicesTool,ttsGsvSynthTool,ttsGsvTrainTool,ttsGsvDatasetTool,transcribeTool,evaluateAudioTool,docsTool,releaseTool]
  for (const tool of tools) {
    const execute=tool.execute
    tool.execute=async (args) => { try { return await execute(args||{}) } catch (e) { return toolResult({ ok:false, error:{ code:String(e && e.code ? e.code : 'TOOL_ERROR'), message:String(e && e.message ? e.message : e), detail:e && e.detail ? e.detail : undefined } }) } }
    try { ctx.effect(() => ctx.tools.register(tool), 'ams-agent-music: '+tool.name) } catch (e) { auditLog('tool-register-error '+tool.name+' '+String(e && e.message ? e.message : e)) }
  }
  log('registered tools: '+tools.map(t=>t.name).join(', '))
  auditLog('tools-registered count='+tools.length)
  setTimeout(async () => { try { const result=await statusTool.execute({}); auditLog('selftest-status '+JSON.stringify(result).replace(/\s+/g,' ').slice(0,500)) } catch (e) { auditLog('selftest-status-error '+String(e && e.message ? e.message : e)) } }, 2500)
}
