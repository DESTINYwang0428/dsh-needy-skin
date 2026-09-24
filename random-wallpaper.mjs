// random-wallpaper — DSH Web「随机壁纸」小部件
//
// 每次打开页面，从图片目录里随机挑一张铺满整个界面背景，并配一层暗色遮罩 + 主界面毛玻璃，
// 让壁纸透出来的同时保证文字可读。没有放图片时本部件完全不生效（不改任何样式）。
//
// 图片目录（按顺序取第一个存在的，支持任意张数）：
//   • <本文件目录>/assets/bg/
//   • <本文件目录>/bg/
//   • <本文件目录>/needy-bg/
// 支持 jpg / jpeg / png / webp / avif / gif。
//
// 观感微调（可选）：同目录放 wallpaper.json，例如
//   { "overlay": 0.3, "blur": 6, "base": 0.5, "layer1": 0.72, "layer2": 0.8, "layer3": 0.85 }
//   overlay 越大越暗；blur 越大越糊；base/layer* 越大内容面板越实、壁纸越不明显。
//
// 这是 dsh profile 的 widget 模块：由 cordis.patch.yml 的 insert 条目加载，
// 通过 tapIndex 往首页注入 <script defer src="/dsh-needy/wallpaper.js">。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url))
const NS = '/dsh-needy'

const BG_DIRS = ['assets/bg', 'bg', 'needy-bg', 'assets/wallpaper', 'wallpaper']
const IMG_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
}

const DEFAULT_STYLE = {
  overlay: 0.3, // 暗色遮罩不透明度（0 = 不遮，1 = 全黑）
  blur: 6, // 主界面毛玻璃半径（px）
  base: 0.5, // 背景主色不透明度（越小壁纸越透）
  layer1: 0.72, // 卡片/气泡层级
  layer2: 0.8,
  layer3: 0.85,
}

/** 扫描图片目录，返回 [{ name, file, mime }]。找不到目录返回空数组。 */
function listImages() {
  for (const rel of BG_DIRS) {
    const dir = path.join(PLUGIN_DIR, rel)
    let names
    try {
      names = fs.readdirSync(dir)
    } catch (err) {
      continue
    }
    const out = []
    for (const name of names.sort()) {
      if (name.startsWith('.')) continue
      const mime = IMG_MIME[path.extname(name).toLowerCase()]
      if (!mime) continue
      const file = path.join(dir, name)
      try {
        if (fs.statSync(file).isFile()) out.push({ name, file, mime })
      } catch (err) {}
    }
    if (out.length > 0) return out
  }
  return []
}

/** 读取观感配置（可选）：wallpaper.json 覆盖默认值。 */
function loadStyle() {
  const style = Object.assign({}, DEFAULT_STYLE)
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'wallpaper.json'), 'utf8'))
  } catch (err) {
    return style
  }
  if (!raw || typeof raw !== 'object') return style
  for (const key of Object.keys(DEFAULT_STYLE)) {
    const value = Number(raw[key])
    if (Number.isFinite(value)) style[key] = value
  }
  return style
}

function sendImage(res, image) {
  let bytes
  try {
    bytes = fs.readFileSync(image.file)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('cannot read image: ' + String((err && err.message) || err))
    return
  }
  res.writeHead(200, {
    'Content-Type': image.mime,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': String(bytes.length),
  })
  res.end(bytes)
}

// 客户端脚本：__BG_URL__ / __STYLE__ 在每次请求时替换。
const WALLPAPER_JS = `(function () {
  if (window.__dshNeedyWallpaper) return
  window.__dshNeedyWallpaper = true
  var BG_URL = '__BG_URL__'
  if (!BG_URL) return // 没有图片：什么都不做

  var S = __STYLE__
  if (document.getElementById('dsh-needy-bg')) return

  var css = [
    'body{background-color:transparent!important;' +
      'background-image:linear-gradient(rgba(10,10,12,' + S.overlay + '), rgba(10,10,12,' + S.overlay + ')), url("' + BG_URL + '")!important;' +
      'background-size:cover!important;background-position:center!important;' +
      'background-attachment:fixed!important;background-repeat:no-repeat!important}',
    '#root{background:transparent!important;' +
      '-webkit-backdrop-filter:blur(' + S.blur + 'px);backdrop-filter:blur(' + S.blur + 'px)}',
    'body{--dsw-alias-bg-base:rgba(16,16,16,' + S.base + ')!important;' +
      '--dsw-alias-bg-layer-1:rgba(22,22,22,' + S.layer1 + ')!important;' +
      '--dsw-alias-bg-layer-2:rgba(27,27,27,' + S.layer2 + ')!important;' +
      '--dsw-alias-bg-layer-3:rgba(33,33,33,' + S.layer3 + ')!important}'
  ].join('')

  var styleEl = document.createElement('style')
  styleEl.id = 'dsh-needy-bg'
  styleEl.textContent = css
  document.head.appendChild(styleEl)
})()`

export default {
  name: 'needy-random-wallpaper',
  inject: ['webServer'],
  apply(ctx) {
    const disposers = []

    // 客户端脚本：每次请求随机挑一张图并注入配置
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: NS + '/wallpaper.js',
      handler: (req, res) => {
        const images = listImages()
        const style = loadStyle()
        const picked = images.length > 0 ? images[Math.floor(Math.random() * images.length)] : null
        const url = picked ? NS + '/bg/' + encodeURIComponent(picked.name) : ''
        const js = WALLPAPER_JS
          .replace('__BG_URL__', () => url)
          .replace('__STYLE__', () => JSON.stringify(style))
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(js)
      },
    }))

    // 图片服务：/dsh-needy/bg 随机一张；/dsh-needy/bg/<文件名> 取指定一张
    disposers.push(ctx.webServer.register({
      kind: 'prefix',
      path: NS + '/bg',
      handler: (req, res) => {
        const images = listImages()
        if (images.length === 0) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('no background images (put them in assets/bg/ next to random-wallpaper.mjs)')
          return
        }
        const pathname = req.url.split('?')[0].replace(/\/+$/, '')
        const raw = pathname.slice((NS + '/bg').length)
        if (raw === '' || raw === '/') {
          sendImage(res, images[Math.floor(Math.random() * images.length)])
          return
        }
        let wanted
        try {
          wanted = decodeURIComponent(raw.replace(/^\//, ''))
        } catch (err) {
          wanted = raw.replace(/^\//, '')
        }
        const hit = images.find((image) => image.name === wanted)
        if (!hit) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('image not found: ' + wanted)
          return
        }
        sendImage(res, hit)
      },
    }))

    // 往首页注入脚本
    disposers.push(ctx.webServer.tapIndex((html) => {
      const src = NS + '/wallpaper.js'
      if (html.indexOf(src) !== -1) return html
      const tag = '<script defer src="' + src + '"></script>'
      if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
      return html + tag
    }))

    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try { dispose() } catch (err) {}
      }
    })
  },
}
