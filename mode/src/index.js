/**
 * 音乐制作模式辅助插件（@ams/agent-music-mode）。
 *
 * 由「音乐制作」Agent preset 加载。新会话创建时把工作目录切到嘉音Studio
 * 安装目录下的 data 目录（动态解析：AMS_HOME -> Kernel cwd -> DSH_HOME -> 旧默认），
 * 不写入任何固定盘符路径。
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const name = 'ams-agent-music-mode'

function looksLikeAmsHome(p) {
  try {
    return !!p && existsSync(join(p, 'runtime')) &&
      (existsSync(join(p, 'config')) || existsSync(join(p, 'components')) || existsSync(join(p, 'kernel')))
  } catch {
    return false
  }
}

/** Resolve the current AMS data root dynamically. */
export function resolveAmsHome() {
  const candidates = []
  if (process.env.AMS_HOME && process.env.AMS_HOME.trim()) candidates.push(resolve(process.env.AMS_HOME.trim()))
  try { candidates.push(dirname(process.cwd())) } catch {}
  if (process.env.DSH_HOME && process.env.DSH_HOME.trim()) {
    const dshHome = resolve(process.env.DSH_HOME.trim())
    candidates.push(dirname(dirname(dshHome)))
  }
  candidates.push('F:/AMS-Studio/data')
  for (const c of candidates) {
    const abs = resolve(c)
    if (looksLikeAmsHome(abs)) return abs
  }
  return resolve(candidates[0] || 'F:/AMS-Studio/data')
}

export function apply(ctx) {
  let dataDir = ''
  try { dataDir = resolveAmsHome() } catch { dataDir = '' }
  try { ctx.logger?.info('ams-agent-music-mode: 音乐制作模式已加载；数据目录=' + (dataDir || '(未解析)')) } catch {}
  // workingDirectory 是会话级服务：不在加载期 inject（preset 会被提前挂载），
  // 而是在新会话创建事件里惰性获取，避免因服务尚不存在而挂载失败。
  ctx.effect(() => ctx.on('agent/created', async ({ agent, signal }) => {
    try {
      const workingDirectory = ctx.get('workingDirectory')
      if (!workingDirectory || typeof workingDirectory.set !== 'function') return
      const dir = resolveAmsHome()
      if (!existsSync(dir)) return
      await workingDirectory.set(agent, dir, signal)
    } catch (error) {
      try { ctx.logger?.warn('ams-agent-music-mode: 设置默认工作目录失败: ' + String(error && error.message ? error.message : error)) } catch {}
    }
  }))
}
