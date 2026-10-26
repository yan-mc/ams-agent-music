import { cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
mkdirSync('lib',{recursive:true})
cpSync('src/index.js',join('lib','index.js'))
console.log('[build] agent-music lib ready')
