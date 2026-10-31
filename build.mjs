import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
mkdirSync('lib', { recursive: true })
cpSync('src/index.js', join('lib', 'index.js'))
mkdirSync(join('client', 'lib'), { recursive: true })
cpSync(join('client', 'src', 'index.js'), join('client', 'lib', 'index.js'))
const template = readFileSync(join('client', 'src', 'client.template.js'), 'utf8')
const logo = readFileSync(join('client', 'src', 'logo-datauri.txt'), 'utf8').trim()
const wallpaper = readFileSync(join('client', 'src', 'wallpaper-datauri.txt'), 'utf8').trim()
writeFileSync(join('client', 'lib', 'client.js'), template.split('__JY_LOGO_DATA_URI__').join(logo).split('__JY_WALLPAPER_DATA_URI__').join(wallpaper))
mkdirSync(join('mode', 'lib'), { recursive: true })
cpSync(join('mode', 'src', 'index.js'), join('mode', 'lib', 'index.js'))
console.log('[build] agent-music host + client + mode ready')
