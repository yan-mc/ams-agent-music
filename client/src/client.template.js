/**
 * 嘉音Studio Kernel rebrand client plugin.
 *
 * Loaded into the Kernel web page through the DSH client module system. It only
 * touches the DOM at runtime (title / whale marks / brand text / favicon); it does
 * NOT modify the Kernel build or its sources.
 */
window.__ModuleLoader__.load({
  id: '@ams/agent-music-ui',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const BRAND = '嘉音Studio'
    const LOGO = '__JY_LOGO_DATA_URI__'
    const MARK_VIEWBOX = '0 0 23.16 17.04'
    const EXACT_TEXTS = ['探索未至之境', 'DeepSeek', 'deepseek', 'HARNESS', 'Harness', '深度求索']
    const TEXT_RE = /(探索未至之境|DeepSeek|deepseek|HARNESS|Harness|深度求索)/g

    let scheduled = false
    let installed = false

    function replaceMarks() {
      const svgs = document.querySelectorAll('svg')
      for (const svg of svgs) {
        let hit = svg.getAttribute('viewBox') === MARK_VIEWBOX
        if (!hit) {
          const cls = String(svg.getAttribute('class') || '')
          hit = cls.indexOf('kdKC2a_fish') >= 0
        }
        if (!hit) continue
        const box = svg.getAttribute('width') || svg.getAttribute('height') || '24'
        const size = Math.max(12, Math.min(96, parseFloat(box) || 24))
        const img = document.createElement('img')
        img.src = LOGO
        img.alt = BRAND
        img.setAttribute('data-jy-brand', '1')
        img.style.width = size + 'px'
        img.style.height = size + 'px'
        img.style.objectFit = 'cover'
        img.style.borderRadius = '50%'
        img.style.display = 'inline-block'
        img.style.verticalAlign = 'middle'
        img.style.flex = '0 0 auto'
        svg.replaceWith(img)
      }
    }

    function replaceTexts() {
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT)
      const hits = []
      while (walker.nextNode()) {
        const node = walker.currentNode
        const raw = node.nodeValue || ''
        const t = raw.trim()
        if (t && EXACT_TEXTS.indexOf(t) >= 0) hits.push(node)
      }
      for (const node of hits) {
        node.nodeValue = (node.nodeValue || '').replace(TEXT_RE, BRAND)
      }
    }

    function replaceBrandName() {
      // The sidebar wordmark is an SVG path wordmark ("deepseek HARNESS"), not text.
      const slots = document.querySelectorAll('[data-slot="sidebar.brand.name"]')
      for (const slot of slots) {
        const svg = slot.querySelector('svg')
        if (!svg) continue
        const span = document.createElement('span')
        span.textContent = BRAND
        span.setAttribute('data-jy-brand', '1')
        span.style.cssText = 'font-size:15px;font-weight:700;letter-spacing:2px;color:currentColor;white-space:nowrap;line-height:24px;display:inline-flex;align-items:center;font-family:inherit'
        svg.replaceWith(span)
      }
    }

    function replaceTitleAndIcon() {
      if (document.title !== BRAND) document.title = BRAND
      const links = document.querySelectorAll('link[rel*="icon"]')
      for (const link of links) {
        if (link.href !== LOGO) link.setAttribute('href', LOGO)
      }
    }

    function applyBrand() {
      try {
        replaceTitleAndIcon()
        replaceMarks()
        replaceBrandName()
        replaceTexts()
      } catch (e) {
        // Never break the page for a cosmetic failure.
      }
    }

    function schedule() {
      if (scheduled) return
      scheduled = true
      setTimeout(function () { scheduled = false; applyBrand() }, 60)
    }

    function install() {
      if (installed) return
      installed = true
      applyBrand()
      document.addEventListener('DOMContentLoaded', applyBrand)
      window.addEventListener('load', applyBrand)
      try {
        new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
      } catch (e) {}
      // Safety net: some DSH renders reset document.title before the observer observes it.
      setInterval(applyBrand, 3000)
      console.log('[ams-agent-music-ui] 嘉音Studio rebrand installed')
    }

    exports.name = 'ams-agent-music-ui'
    exports.inject = []
    exports.apply = install
    return module.exports
  }
})
