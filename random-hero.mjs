// random-hero — DSH Web「随机字样」小部件
//
// 把 DSH Web 空态英雄区的大标题（默认文案「探索未至之境 / Into the Unknown」+
// 「预览版 / Preview」徽标）替换为一份文案对列表里随机抽到的那一组：左一半、右一半，
// 左右成对排版；同时在会话头部左上角标题的下方渲染同一组文案。每次打开页面重新随机。
//
// 可选的配套：
//   • 图标  —— 同目录 assets/icon.(png|jpg|jpeg|webp|svg) 会替换界面里的鲸鱼图标；
//              不放则保持原样（不会破坏界面）。
//   • 文案  —— 同目录 pairs.json 覆盖内置文案（格式见 README）。
//
// 这是 dsh profile 的 widget 模块：由 cordis.patch.yml 的 insert 条目加载，
// 通过 tapIndex 往首页注入 <script defer src="/dsh-needy/hero.js">。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url))
const NS = '/dsh-needy'

// DSH 现有两个 locale 的原文案（zh-CN / en）；客户端按这两个值判断「还是原文吗」
const DEFAULT_ORIGINALS = ['探索未至之境', 'Into the Unknown']
const DEFAULT_BADGES = ['预览版', 'Preview']

// 内置默认文案：33 组《主播女孩重度依赖》成就名 + 描述
const DEFAULT_PAIRS = [
  ['盈利', '洗脑・榨取・虎之卷'],
  ['尝试了过量', '对你来说是剧毒呢'],
  ['Crossing the line', '我只是一个过客 从你的世界路过'],
  ['Os\u2011Alien', '我就喜欢这样的你 ×∞'],
  ['尝试了割腕', '况且这爱总会失控'],
  ['Healthy Party', '即便我不再疯魔'],
  ['Nymphomania', '爱因爱太过沉重而拒绝理解爱'],
  ['Angel Fall Down', '向霓虹闪烁的神明献出拥有美貌的代价'],
  ['尝试了飞行', '马上就能解脱了'],
  ['Angry Otaku Needy Girl', '无心的天使'],
  ['目标达成', '不战斗就无法生存下去'],
  ['尝试了嗑糖', '这荒唐的网络世界就是七彩的糖块'],
  ['Die Set Down', '直到刚才都还是情侣的东西滚落一地'],
  ['(Un)happy End World', '每晚只是想着你夹被子自我消遣'],
  ['Utopian Parody', '梦境逐渐侵入现实'],
  ['NeToRare', '我哭了哭了哭了哭了一整夜 我笑了笑了笑了笑了一千遍'],
  ['Labor is evil', '每月一次 那美酒只是奢侈 我浅尝辄止'],
  ['脑 Future', '某个人某条街 心碎一整夜'],
  ['INTERNET OVERDOSE', '谨遵用法用量 上网快乐冲浪'],
  ['Rainbow Girl', '对不起 因为我是活在二次元的女孩'],
  ['Enchantment Fire', '燃烧吧 燃烧吧天使'],
  ['Welcome To My Religion', '你也来加入超天教吧'],
  ['DARK ANGEL', '坟墓由我们两人一起掘好'],
  ['Do You Love Me?', '喜欢喜欢超喜欢'],
  ['NEEDY GIRL OVERDOSE', '因为我喜欢的人就算浑身是血也会拥我入怀'],
  ['Happy End World', '快远离因特网'],
  ['Catastrophe', '保重你自己 在我心中没有人能够代替你'],
  ['Bomber Girl', '易燃已爆炸'],
  ['There Is No Angel', '没有天使的桌面'],
  ['Megaten', '网络已死，我却新生'],
  ['THE INTERNET ANGEL Be INVOKED', '天使飞越那无尽宇宙'],
  ['Comment te dire adieu', '只想与你完美告别'],
  ['Milky Way Train', '应许之地便是那永远的 Utopia'],
]

const ICON_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'svg']
const ICON_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

/** 读取 pairs.json（可选）：支持纯数组，或 { headline, badge, pairs } 对象。 */
function loadConfig() {
  const config = {
    pairs: DEFAULT_PAIRS,
    originals: DEFAULT_ORIGINALS,
    badges: DEFAULT_BADGES,
  }
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'pairs.json'), 'utf8'))
  } catch (err) {
    return config
  }
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.pairs) ? raw.pairs : null
  if (list) {
    const pairs = []
    for (const item of list) {
      if (Array.isArray(item) && item.length >= 2) pairs.push([String(item[0]), String(item[1])])
      else if (item && typeof item === 'object' && item.name != null && item.desc != null) {
        pairs.push([String(item.name), String(item.desc)])
      }
    }
    if (pairs.length > 0) config.pairs = pairs
  }
  if (raw && !Array.isArray(raw)) {
    if (Array.isArray(raw.headline) && raw.headline.length > 0) config.originals = raw.headline.map(String)
    if (Array.isArray(raw.badge) && raw.badge.length > 0) config.badges = raw.badge.map(String)
  }
  return config
}

/** 找到第一个可用的自定义图标：<dir>/assets/icon.<ext> 或 <dir>/icon.<ext>。 */
function findIcon() {
  for (const dir of [path.join(PLUGIN_DIR, 'assets'), PLUGIN_DIR]) {
    for (const ext of ICON_EXTS) {
      const file = path.join(dir, 'icon.' + ext)
      try {
        if (fs.statSync(file).isFile()) return { file, mime: ICON_MIME[ext] }
      } catch (err) {}
    }
  }
  return null
}

// 客户端脚本。__TOKEN__ 占位符在每次请求时按当前配置替换（改 json 后刷新即生效）。
const HERO_JS = `(function () {
  if (window.__dshNeedyHero) return
  window.__dshNeedyHero = true

  var PAIRS = __PAIRS__
  var ORIGINALS = __ORIGINALS__
  var BADGES = __BADGES__
  var ICON_URL = '__ICON_URL__'

  var chosen = null
  var lastAppliedAt = 0

  function pickPair() {
    var idx = Math.floor(Math.random() * PAIRS.length)
    return { idx: idx, name: PAIRS[idx][0], desc: PAIRS[idx][1] }
  }

  function isOriginal(text) {
    var t = (text || '').trim()
    for (var i = 0; i < ORIGINALS.length; i++) if (t === ORIGINALS[i]) return true
    return false
  }

  function isBadge(text) {
    var t = (text || '').trim()
    for (var i = 0; i < BADGES.length; i++) if (t === BADGES[i]) return true
    return false
  }

  // 优先按当前构建的 CSS 类名定位；类名失效时退化为按原文文本查找
  function findHero() {
    var nameEl = document.querySelector('.pXSMma_headlineText')
    var badgeEl = document.querySelector('.pXSMma_previewBadge')
    if (nameEl && badgeEl) return { nameEl: nameEl, badgeEl: badgeEl, headline: nameEl.parentElement }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      var t = walker.currentNode
      if (isOriginal(t.textContent)) {
        var n = t.parentElement
        var h = n ? n.parentElement : null
        if (!h) continue
        var kids = h.children || []
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].tagName === 'SPAN' && isBadge(kids[i].textContent)) {
            return { nameEl: n, badgeEl: kids[i], headline: h }
          }
        }
      }
    }
    return null
  }

  // 英雄区左侧的原版鲸鱼（类名优先，退化为「第一个没有文字的 span 子元素」）
  function findFish(hero) {
    var box = hero.headline.querySelector('.pXSMma_fishHitbox')
    if (box) return box
    var kids = hero.headline.children
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i]
      if (c.tagName === 'SPAN' && !(c.textContent || '').trim() && c !== hero.nameEl && c !== hero.badgeEl) return c
    }
    return null
  }

  // 自定义图标（assets/icon.*）。加载成功才隐藏原版鲸鱼，失败则保持原样。
  function ensureHeroIcon(hero) {
    if (!hero || !hero.headline) return
    var headline = hero.headline
    var fish = findFish(hero)
    if (!ICON_URL) {
      if (fish) fish.style.display = ''
      return
    }
    var icon = headline.querySelector('.dsh-needy-hero-icon')
    if (!icon) {
      icon = document.createElement('img')
      icon.className = 'dsh-needy-hero-icon'
      icon.alt = ''
      icon.draggable = false
      icon.src = ICON_URL
      icon.style.cssText = [
        'height:36px',
        'width:auto',
        'border-radius:9px',
        'border:1px solid rgba(255,255,255,.22)',
        'flex:none',
        'display:block',
        'object-fit:contain'
      ].join(';')
      icon.addEventListener('load', function () {
        var f = findFish(hero)
        if (f) f.style.display = 'none'
      })
      icon.addEventListener('error', function () {
        var f = findFish(hero)
        if (f) f.style.display = ''
        if (icon.parentElement) icon.parentElement.removeChild(icon)
      })
      headline.insertBefore(icon, hero.nameEl)
      if (icon.complete && icon.naturalWidth > 0 && fish) fish.style.display = 'none'
    } else if (fish) {
      fish.style.display = 'none'
    }
  }

  function applyPair() {
    var hero = findHero()
    if (!hero) return false
    ensureHeroIcon(hero)
    // 只在原文还在时套用；已经是随机文案就不动，避免重复套用
    if (!isOriginal(hero.nameEl.textContent)) return false

    var now = Date.now()
    // 原文每次被恢复都重新随机；10 秒内的快速重渲染沿用同一组，防止闪烁
    if (!chosen || now - lastAppliedAt > 10000) chosen = pickPair()

    hero.nameEl.textContent = chosen.name
    hero.nameEl.style.cssText = 'flex:0 0 auto; white-space:nowrap; max-width:100%'

    hero.badgeEl.textContent = chosen.desc
    hero.badgeEl.style.cssText = [
      'flex:0 0 auto',
      'border:0',
      'border-radius:0',
      'background:none',
      'margin:0',
      'padding:0',
      'color:var(--dsw-alias-label-secondary)',
      'font-family:inherit',
      'font-size:15px',
      'font-weight:400',
      'line-height:26px',
      'letter-spacing:.01em',
      'white-space:normal',
      'text-align:left',
      'max-width:min(55%, 520px)'
    ].join(';')

    hero.headline.style.cssText = [
      'display:flex',
      'flex-wrap:wrap',
      'justify-content:center',
      'align-items:center',
      'column-gap:12px',
      'row-gap:6px'
    ].join(';')

    lastAppliedAt = now
    return true
  }

  // 会话头部（左上角标题下方）同一组文案。与英雄区共用 chosen，同一次加载内保持一致。
  function syncHeaderPair() {
    var header = document.querySelector('.wSkVaW_header')
    if (!header) return false
    var titleRow = header.querySelector('.wSkVaW_titleRow')
    if (!titleRow) return false
    if (!chosen) chosen = pickPair()
    var row = header.querySelector('.dsh-needy-header-pair')
    if (row && String(row.dataset.idx) === String(chosen.idx)) return true
    if (!row) {
      row = document.createElement('div')
      row.className = 'dsh-needy-header-pair'
      row.style.cssText = [
        'display:flex',
        'flex-wrap:wrap',
        'align-items:center',
        'gap:8px',
        'padding:2px 0 6px',
        'min-height:20px'
      ].join(';')
      var tabs = header.querySelector('.wSkVaW_tabs')
      header.insertBefore(row, tabs || null)
    }
    row.innerHTML = ''
    if (ICON_URL) {
      var small = document.createElement('img')
      small.src = ICON_URL
      small.alt = ''
      small.draggable = false
      small.style.cssText = 'height:24px;width:auto;border-radius:6px;border:1px solid rgba(255,255,255,.22);flex:none;display:block;object-fit:contain'
      row.appendChild(small)
    }
    var nameSpan = document.createElement('span')
    nameSpan.textContent = chosen.name
    nameSpan.style.cssText = 'font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap'
    var descSpan = document.createElement('span')
    descSpan.textContent = chosen.desc
    descSpan.style.cssText = 'font-size:13px;font-weight:400;color:var(--dsw-alias-label-secondary);white-space:normal;max-width:min(60%, 520px)'
    row.appendChild(nameSpan)
    row.appendChild(descSpan)
    row.dataset.idx = String(chosen.idx)
    return true
  }

  var tries = 0
  function boot() {
    try {
      var done = applyPair()
      if (syncHeaderPair()) done = true
      if (done) return
    } catch (err) {}
    tries++
    if (tries > 600) return // 约 60 秒后放弃，优雅降级回原标题
    setTimeout(boot, 100)
  }
  boot()

  // React 重渲染把原文写回时重新套用
  var raf = null
  var mo = new MutationObserver(function () {
    if (raf) return
    raf = requestAnimationFrame(function () {
      raf = null
      try {
        applyPair()
        syncHeaderPair()
      } catch (err) {}
    })
  })
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
})()`

export default {
  name: 'needy-random-hero',
  inject: ['webServer'],
  apply(ctx) {
    const disposers = []

    // 客户端脚本：每次请求按当前 pairs.json 重新生成
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: NS + '/hero.js',
      handler: (req, res) => {
        const config = loadConfig()
        const icon = findIcon()
        const js = HERO_JS
          .replace('__PAIRS__', () => JSON.stringify(config.pairs))
          .replace('__ORIGINALS__', () => JSON.stringify(config.originals))
          .replace('__BADGES__', () => JSON.stringify(config.badges))
          .replace('__ICON_URL__', () => (icon ? NS + '/icon' : ''))
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(js)
      },
    }))

    // 图标：没有自定义图标时返回 404，客户端会保持原版鲸鱼
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: NS + '/icon',
      handler: (req, res) => {
        const icon = findIcon()
        if (!icon) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('no custom icon (put assets/icon.png next to random-hero.mjs)')
          return
        }
        let bytes
        try {
          bytes = fs.readFileSync(icon.file)
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('icon read failed: ' + String((err && err.message) || err))
          return
        }
        res.writeHead(200, {
          'Content-Type': icon.mime,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
          'Content-Length': String(bytes.length),
        })
        res.end(bytes)
      },
    }))

    // 往首页注入脚本
    disposers.push(ctx.webServer.tapIndex((html) => {
      const src = NS + '/hero.js'
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
