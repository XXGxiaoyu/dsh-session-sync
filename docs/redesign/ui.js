/* 验收页的最小交互：主题、语言、单独查看、目录高亮。
   产品本身的交互写在 DESIGN.md 里；这里只负责让你能把稿子切到想看的形态。 */
(() => {
  const root = document.documentElement
  const params = new URLSearchParams(location.search)

  const THEME_KEY = 'ss-redesign-theme'
  const LANG_KEY = 'ss-redesign-lang'

  const setPressed = (selector, active) => {
    document.querySelectorAll(selector).forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeBtn === active || button.dataset.langBtn === active))
    })
  }

  const applyTheme = (theme) => {
    root.dataset.theme = theme === 'light' ? 'light' : 'dark'
    setPressed('[data-theme-btn]', root.dataset.theme)
    try { localStorage.setItem(THEME_KEY, root.dataset.theme) } catch { /* file:// */ }
  }

  const unitOriginals = new WeakMap()
  const UNIT_RULES = [
    ['条事件', 'events'],
    ['个会话', 'sessions'],
    ['个位置', 'locations'],
    ['个目标', 'targets'],
    ['台找到', 'found'],
    ['小时前', 'h ago'],
    ['分钟前', 'min ago'],
    ['上次扫描', 'Last scanned'],
    ['等待空闲 worker', 'waiting for a worker'],
  ]

  const swapUnits = (en) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    for (const node of nodes) {
      if (node.parentElement?.closest('script, style, pre, .rv-lead, .board, .toc, .scene-hd, .scene-notes')) continue
      if (!node.nodeValue || !node.nodeValue.trim()) continue
      if (en) {
        if (unitOriginals.has(node)) continue
        let next = node.nodeValue
        for (const [zh, target] of UNIT_RULES) next = next.split(zh).join(target)
        if (next !== node.nodeValue) {
          unitOriginals.set(node, node.nodeValue)
          node.nodeValue = next
        }
      } else if (unitOriginals.has(node)) {
        node.nodeValue = unitOriginals.get(node)
      }
    }
  }

  const applyLang = (lang) => {
    const en = lang === 'en'
    root.lang = en ? 'en' : 'zh-CN'
    document.querySelectorAll('[data-en]').forEach((node) => {
      if (!node.dataset.zh) node.dataset.zh = node.textContent
      node.textContent = en ? node.dataset.en : node.dataset.zh
    })
    document.querySelectorAll('[data-en-ph]').forEach((node) => {
      if (!node.dataset.zhPh) node.dataset.zhPh = node.getAttribute('placeholder') || ''
      node.setAttribute('placeholder', en ? node.dataset.enPh : node.dataset.zhPh)
    })
    document.querySelectorAll('[data-en-title]').forEach((node) => {
      if (!node.dataset.zhTitle) node.dataset.zhTitle = node.getAttribute('title') || ''
      node.setAttribute('title', en ? node.dataset.enTitle : node.dataset.zhTitle)
    })
    document.querySelectorAll('[data-en-aria]').forEach((node) => {
      if (!node.dataset.zhAria) node.dataset.zhAria = node.getAttribute('aria-label') || ''
      node.setAttribute('aria-label', en ? node.dataset.enAria : node.dataset.zhAria)
    })
    swapUnits(en)
    setPressed('[data-lang-btn]', en ? 'en' : 'zh')
    try { localStorage.setItem(LANG_KEY, en ? 'en' : 'zh') } catch { /* file:// */ }
  }

  const focus = params.get('focus')
  if (focus) {
    document.body.classList.add('focus-mode')
    const scene = document.getElementById(focus)
    if (scene) scene.classList.add('is-focus')
    document.querySelectorAll('.toc a').forEach((a) => a.remove())
  }

  const theme = params.get('theme') || (() => {
    try { return localStorage.getItem(THEME_KEY) } catch { return null }
  })() || 'dark'
  applyTheme(theme)

  const lang = params.get('lang') || (() => {
    try { return localStorage.getItem(LANG_KEY) } catch { return null }
  })() || 'zh'
  applyLang(lang)

  document.querySelectorAll('[data-theme-btn]').forEach((button) => {
    button.addEventListener('click', () => { applyTheme(button.dataset.themeBtn); syncFocusLinks() })
  })
  document.querySelectorAll('[data-lang-btn]').forEach((button) => {
    button.addEventListener('click', () => { applyLang(button.dataset.langBtn); syncFocusLinks() })
  })

  /* 场景的“单独查看”继承当前主题与语言 */
  const syncFocusLinks = () => {
    const themeNow = root.dataset.theme
    const langNow = root.lang.startsWith('en') ? 'en' : 'zh'
    document.querySelectorAll('.scene-tools a').forEach((link) => {
      const url = new URL(link.getAttribute('href'), location.href)
      url.searchParams.set('theme', themeNow)
      url.searchParams.set('lang', langNow)
      link.setAttribute('href', url.search)
    })
  }
  syncFocusLinks()

  /* 选择：整行都是命中区，勾选框只是显性状态。
     行内按钮/链接/下拉不抢选择；拖选文字时不误触。 */
  const syncSelectionBar = (row) => {
    const stage = row.closest('.ss-stage')
    if (!stage) return
    const bar = stage.querySelector('.ss-selbar')
    if (!bar) return
    const count = stage.querySelectorAll('.ss-row .ss-cb[aria-checked="true"]').length
    const number = bar.querySelector('.count b')
    if (number) number.textContent = String(count)
    bar.style.display = count === 0 ? 'none' : ''
  }

  const setChecked = (box, value) => {
    box.setAttribute('aria-checked', String(value))
    const row = box.closest('.ss-row')
    if (row) {
      row.setAttribute('aria-selected', String(value))
      syncSelectionBar(row)
    }
  }
  const toggleRow = (box) => setChecked(box, box.getAttribute('aria-checked') !== 'true')

  document.querySelectorAll('.ss-cb').forEach((box) => {
    box.addEventListener('click', (event) => {
      event.stopPropagation()
      toggleRow(box)
    })
  })

  document.querySelectorAll('.ss-row').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('button, a, input, select, label, .ss-row-act')) return
      if (String(window.getSelection?.() ?? '').length > 0) return
      const box = row.querySelector('.ss-cb')
      if (box) toggleRow(box)
    })
    row.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      if (event.target !== row) return
      const box = row.querySelector('.ss-cb')
      if (!box) return
      event.preventDefault()
      toggleRow(box)
    })
  })

  /* 目录高亮 */
  if (!focus && 'IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.toc a')]
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        links.forEach((a) => a.removeAttribute('data-active'))
        const link = map.get(entry.target.id)
        if (link) link.setAttribute('data-active', 'true')
      })
    }, { rootMargin: '-84px 0px -70% 0px', threshold: 0 })
    document.querySelectorAll('.scene').forEach((scene) => observer.observe(scene))
  }
})()
