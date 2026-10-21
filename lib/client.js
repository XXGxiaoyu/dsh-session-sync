/**
 * dsh-session-sync — browser half.
 *
 * Hand-written bundle: no build step, no JSX. The module system hands the
 * factory a `require` bound to the frozen platform seeds, so `react` is the
 * only dependency this file needs.
 *
 * Surfaces:
 *   - `settings.section`   → the full "会话同步" page (devices, naming, seeds,
 *     session pull/push)
 *   - `sidebar.panellist`  → the sidebar row next to the host's own pages
 *   - `main`               → the keyed panel that row opens
 *
 * Every string goes through this file's own dictionary so the plugin can follow
 * the DSH locale and still honour an explicit 中文 / English override.
 *
 * All data comes from the host half's same-origin route `/session-sync/api`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-session-sync',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const NS = 'sessionSync'
    const API_PATH = '/session-sync/api'
    /** Keyed `main` panel id, also the `sidebar.panellist` row id. */
    const PANEL_ID = 'session-sync'
    const POLL_MS = 4000

    // ── styles ────────────────────────────────────────────────────────────
    // Pre-tagged so the module loader's `claimStyles` owns the tag and removes
    // it again when the plugin is unloaded.
    // The look is built on DSH's own design tokens (`--dsw-*`): colours, radii,
    // type ramp and motion all come from the host, so light/dark themes and any
    // future theme switch follow automatically instead of being recoloured here.
    const CSS = `
.ss-root{display:flex;flex-direction:column;gap:20px;padding:8px 0 24px;max-width:960px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14,14px/22px var(--dsw-font-family))}
.ss-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.ss-title{font-size:20px;line-height:28px;font-weight:500}
.ss-sub{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;margin-top:2px}
.ss-card{display:flex;flex-direction:column;min-width:0}
.ss-card>*+*{border-top:.5px solid var(--dsw-alias-border-l2)}
.ss-section{display:flex;flex-direction:column;gap:8px}
.ss-section-hd{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.ss-section-title{font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ss-card-bd{padding:0}
.ss-row{display:flex;align-items:center;gap:12px;padding:12px 0}
.ss-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}
.ss-dot.on{background:var(--dsw-alias-state-success-primary)}
.ss-name{font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:8px;font-size:15px;line-height:22px}
.ss-badge{font-size:11px;line-height:16px;font-weight:500;padding:1px 6px;border-radius:6px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.ss-meta{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:18px;white-space:nowrap;font-variant-numeric:tabular-nums}
.ss-actions{display:flex;align-items:center;gap:8px;flex:none}
.ss-head .ss-btn{height:36px;padding:0 14px;font-size:14px}
.ss-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border-radius:var(--dsw-radius-md,12px);border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;white-space:nowrap;transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out),border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out),color var(--ds-transition-duration,.2s) var(--ds-ease-in-out)}
.ss-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.ss-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.ss-btn:disabled{opacity:.4;cursor:default}
.ss-btn.primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent;font-weight:500}
.ss-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.ss-btn.ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-tertiary)}
.ss-btn.ghost:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.ss-btn.danger{color:var(--dsw-alias-state-error-primary)}
.ss-btn.danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.ss-input,.ss-textarea{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;min-width:0;transition:border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out)}
.ss-input{width:280px;max-width:100%;height:32px;padding:0 10px}
.ss-textarea{width:100%;min-height:72px;padding:6px 10px;resize:vertical;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:20px}
.ss-input::placeholder,.ss-textarea::placeholder{color:var(--dsw-alias-label-caption)}
.ss-select{box-sizing:border-box;appearance:none;height:32px;padding:0 32px 0 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,12px);background-color:var(--dsw-alias-bg-layer-1);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-position:right 10px center;background-repeat:no-repeat;background-size:12px 12px;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;cursor:pointer;transition:border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out)}
.ss-field{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:14px 0}
.ss-field-stack{flex-direction:column;align-items:stretch;gap:10px}
.ss-field-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.ss-field-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ss-field-note{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.ss-field-label{color:var(--dsw-alias-label-primary);font-size:15px;line-height:22px}
.ss-field-body{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none}
.ss-hint{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;padding:0 0 12px}
.ss-empty{padding:16px 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.ss-error{padding:0 0 4px;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.ss-list{padding:0}
.ss-item{display:flex;align-items:center;gap:12px;padding:8px;margin:0 -8px;border-radius:var(--dsw-radius-sm,8px);transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out)}
.ss-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ss-item+.ss-item{margin-top:2px}
.ss-item-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;line-height:22px}
.ss-item-sub{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.ss-switch{position:relative;display:inline-flex;align-items:center;flex:none;cursor:pointer}
.ss-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.ss-switch-track{box-sizing:border-box;display:block;width:36px;height:22px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out)}
.ss-switch-thumb{display:block;width:18px;height:18px;margin:2px;border-radius:50%;background:var(--dsw-alias-switch-thumb);transition:transform var(--ds-transition-duration,.2s) var(--ds-ease-in-out),background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out)}
.ss-switch input:checked+.ss-switch-track{background:var(--dsw-alias-brand-primary)}
.ss-switch input:checked+.ss-switch-track .ss-switch-thumb{transform:translateX(14px);background:var(--dsw-alias-label-primary-foreground)}
.ss-switch input:disabled+.ss-switch-track{opacity:.4}
.ss-switch input:focus-visible+.ss-switch-track{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.ss-page{box-sizing:border-box;width:100%;height:100%;max-width:1080px;margin:0 auto;padding:24px 32px 40px;overflow-y:auto;display:flex;flex-direction:column}
.ss-page .ss-root{padding:0}
.ss-hash{font-family:var(--ds-font-family-code,ui-monospace,Menlo,monospace);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.ss-hash.ok{color:var(--dsw-alias-state-success-primary)}
.ss-hash.bad{color:var(--dsw-alias-state-error-primary)}
.ss-navicon{display:flex;align-items:center;justify-content:center}
`

    const STYLE_ID = 'dsh-session-sync/client.css'
    if (typeof document !== 'undefined') {
      const existing = document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`)
      if (existing === null) {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-session-sync'
        tag.dataset.pluginCss = STYLE_ID
        tag.textContent = CSS
        document.head.appendChild(tag)
      }
    }

    const DICTIONARIES = {
        zh: {
          'page.title': '会话同步',
          'nav.sessionSync': '会话同步',
          'sessions.verify': '校验',
          'sessions.verifying': '正在校验…',
          'sessions.verified': 'sha256 {hash} 校验通过',
          'sessions.verifyFailed': 'sha256 {hash} 不匹配',
          'sessions.noDigest': 'sha256 {hash}（对端未提供摘要）',
          'page.subtitle': '局域网内 {online}/{total} 台设备在线',
          'page.ports': '同步端口 {lan} · 发现端口 {discovery}',
          'page.apiError': '读取状态失败：{message}',
          'page.noPersistence': '当前会话存储不可用，拉取/推送会失败。',
          'self.title': '本机',
          'self.name': '设备名称',
          'self.hint': '这个名称会随发现广播发给局域网内的其他设备，只影响别人看到的名字。',
          'devices.title': '设备',
          'devices.count': '{online} 在线 / 共 {total}',
          'devices.empty': '暂未发现其他设备。请确认另一台机器的 DSH 也安装并启用了本插件，且处在同一个局域网。',
          'devices.hint': '自定义命名只保存在本机，设备离线或重启后再次上线时仍会显示你起的名字。',
          'device.rename': '命名',
          'device.renamed': '自定义',
          'device.pulled': '已拉取 {n}',
          'device.forget': '移除',
          'device.namePlaceholder': '给这台设备起个名字',
          'device.lastSeen': '最近 {when}',
          'device.offlineHint': '设备离线时只能查看，不能拉取会话',
          'status.online': '在线',
          'status.offline': '离线',
          'sessions.show': '查看会话',
          'sessions.hide': '收起会话',
          'sessions.push': '推送会话…',
          'sessions.empty': '这台设备没有可同步的会话。',
          'sessions.untitled': '未命名会话',
          'sessions.events': '{n} 条事件',
          'sessions.pull': '拉取到本机',
          'sessions.imported': '已拉取',
          'settings.title': '同步设置',
          'settings.autoPull': '自动拉取',
          'settings.autoPullLabel': '自动拉取在线设备的新会话',
          'settings.autoPullHint': '开启后每隔 20 秒检查一次在线设备，把还没拉过的会话自动同步到本机。',
          'settings.seeds': '手动设备地址',
          'settings.seedsHint': '广播不可用的网络（如跨网段、VPN）可以在这里填写对端 IP:UDP 端口，一行一个。',
          'settings.language': '界面语言',
          'settings.languageAuto': '跟随 DSH / 系统语言',
          'settings.languageHint': '默认跟随 DSH 的语言设置；中文系统显示中文，其它系统显示 English。',
          'notice.languageSaved': '界面语言已切换',
          'notice.selfNameSaved': '本机名称已保存',
          'notice.seedsSaved': '设备地址已保存',
          'notice.settingsSaved': '设置已保存',
          'notice.renamed': '命名已保存',
          'notice.forgot': '已移除该设备记录',
          'notice.pulled': '会话已拉取到本机',
          'notice.importCleared': '已清除拉取记录',
          'notice.pushed': '会话已推送到对端',
          'notice.refreshed': '已刷新',
          'common.save': '保存',
          'common.cancel': '取消',
          'common.refresh': '刷新',
          'common.clear': '清除',
          'common.loading': '加载中…',
          'time.now': '刚刚',
          'time.never': '从未',
          'time.seconds': '{n} 秒前',
          'time.minutes': '{n} 分钟前',
          'time.hours': '{n} 小时前',
          'time.days': '{n} 天前',
        },
        en: {
          'page.title': 'Session Sync',
          'nav.sessionSync': 'Session Sync',
          'sessions.verify': 'Verify',
          'sessions.verifying': 'Verifying…',
          'sessions.verified': 'sha256 {hash} verified',
          'sessions.verifyFailed': 'sha256 {hash} mismatch',
          'sessions.noDigest': 'sha256 {hash} (no digest from peer)',
          'page.subtitle': '{online}/{total} devices online on the LAN',
          'page.ports': 'sync port {lan} · discovery port {discovery}',
          'page.apiError': 'Failed to read state: {message}',
          'page.noPersistence': 'The session store is unavailable; pull/push will fail.',
          'self.title': 'This machine',
          'self.name': 'Device name',
          'self.hint': 'Advertised to other devices on the LAN — it only changes how they see you.',
          'devices.title': 'Devices',
          'devices.count': '{online} online / {total} total',
          'devices.empty': 'No other device found yet. Make sure DSH on the other machine has this plugin enabled and is on the same LAN.',
          'devices.hint': 'Custom names are stored locally and survive a device going offline and coming back.',
          'device.rename': 'Rename',
          'device.renamed': 'custom',
          'device.pulled': '{n} pulled',
          'device.forget': 'Forget',
          'device.namePlaceholder': 'Name this device',
          'device.lastSeen': 'seen {when}',
          'device.offlineHint': 'Offline — view only',
          'status.online': 'online',
          'status.offline': 'offline',
          'sessions.show': 'Sessions',
          'sessions.hide': 'Hide sessions',
          'sessions.push': 'Push a session…',
          'sessions.empty': 'No sessions to sync on this device.',
          'sessions.untitled': 'Untitled session',
          'sessions.events': '{n} events',
          'sessions.pull': 'Pull here',
          'sessions.imported': 'pulled',
          'settings.title': 'Sync settings',
          'settings.autoPull': 'Auto pull',
          'settings.autoPullLabel': 'Auto-pull new sessions from online devices',
          'settings.autoPullHint': 'Checks online devices every 20 seconds and pulls sessions you have not pulled yet.',
          'settings.seeds': 'Manual peers',
          'settings.seedsHint': 'For networks where broadcast fails (other subnets, VPN), list peer IP:UDP-port one per line.',
          'settings.language': 'Language',
          'settings.languageAuto': 'Follow DSH / system',
          'settings.languageHint': 'Follows the DSH language setting by default; when DSH uses the system language, Chinese systems show Chinese and everything else shows English.',
          'notice.languageSaved': 'Language switched',
          'notice.selfNameSaved': 'Device name saved',
          'notice.seedsSaved': 'Peer addresses saved',
          'notice.settingsSaved': 'Settings saved',
          'notice.renamed': 'Name saved',
          'notice.forgot': 'Device record removed',
          'notice.pulled': 'Session pulled',
          'notice.importCleared': 'Pull record cleared',
          'notice.pushed': 'Session pushed',
          'notice.refreshed': 'Refreshed',
          'common.save': 'Save',
          'common.cancel': 'Cancel',
          'common.refresh': 'Refresh',
          'common.clear': 'Clear',
          'common.loading': 'Loading…',
          'time.now': 'just now',
          'time.never': 'never',
          'time.seconds': '{n}s ago',
          'time.minutes': '{n}m ago',
          'time.hours': '{n}h ago',
          'time.days': '{n}d ago',
        },
      }

    // ── i18n ──────────────────────────────────────────────────────────────
    // Two sources decide the copy: the DSH locale (which itself starts from the
    // browser/OS language) and this plugin's own `locale` setting. `auto` means
    // "follow DSH"; anything that is not Chinese reads as English, by design.
    const LANGUAGES = ['auto', 'zh', 'en']

    /** A tag such as `zh-CN`, `en-US` or `ja` → one of the two shipped languages. */
    function tagLanguage(tag) {
      if (typeof tag !== 'string' || tag.length === 0) return null
      return tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
    }

    /** Browser/OS language: Chinese systems read Chinese, everything else English. */
    function systemLanguage() {
      const nav = typeof navigator === 'undefined' ? null : navigator
      const list = Array.isArray(nav?.languages) && nav.languages.length > 0 ? nav.languages : [nav?.language]
      for (const tag of list) {
        const language = tagLanguage(tag)
        if (language !== null) return language
      }
      return 'en'
    }

    let runtime = null
    const overrideStore = { value: 'auto', listeners: new Set() }

    function readOverride() {
      return overrideStore.value
    }

    function writeOverride(value) {
      const next = LANGUAGES.includes(value) ? value : 'auto'
      if (next === overrideStore.value) return
      overrideStore.value = next
      for (const listener of [...overrideStore.listeners]) listener()
    }

    function subscribeOverride(listener) {
      overrideStore.listeners.add(listener)
      return () => overrideStore.listeners.delete(listener)
    }

    function dshLanguage() {
      return runtime === null ? null : tagLanguage(runtime.getActive())
    }

    /** `auto` → the DSH language, else the system language. */
    function resolveLanguage(override, dsh) {
      if (override === 'zh' || override === 'en') return override
      return tagLanguage(dsh) ?? systemLanguage()
    }

    function makeT(language) {
      const dictionary = DICTIONARIES[language] ?? DICTIONARIES.en
      return (key, params) => {
        const template = dictionary[key] ?? DICTIONARIES.en[key] ?? key
        if (params === undefined) return template
        return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      }
    }

    /** For slot labels, which are plain functions rather than components. */
    function translateNow(key, params) {
      return makeT(resolveLanguage(overrideStore.value, dshLanguage()))(key, params)
    }

    function useOverride() {
      return React.useSyncExternalStore(subscribeOverride, readOverride, readOverride)
    }

    /** Track the DSH locale and this plugin's override, and return the translator. */
    function useT() {
      const override = useOverride()
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        if (runtime === null) return undefined
        return runtime.subscribe(() => bump((count) => count + 1))
      }, [])
      const dsh = dshLanguage()
      return React.useMemo(
        () => makeT(resolveLanguage(override, dsh)),
        [override, dsh],
      )
    }

    // ── host API ──────────────────────────────────────────────────────────
    class ApiError extends Error {}

    async function api(action, payload = {}) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      let response
      try {
        response = await fetch(new URL(API_PATH.slice(1), document.baseURI).toString(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })
      } catch (error) {
        throw new ApiError(error?.name === 'AbortError' ? '请求超时' : `无法连接插件服务: ${error?.message ?? error}`)
      } finally {
        clearTimeout(timer)
      }
      let body
      try {
        body = await response.json()
      } catch {
        throw new ApiError(`服务返回了无法解析的数据 (${response.status})`)
      }
      if (!response.ok || body?.ok === false) {
        throw new ApiError(body?.error?.message ?? `服务返回 ${response.status}`)
      }
      return body
    }

    // ── small helpers ─────────────────────────────────────────────────────
    function relativeTime(t, ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return t('time.never')
      const delta = Date.now() - ms
      if (delta < 5_000) return t('time.now')
      if (delta < 60_000) return t('time.seconds', { n: Math.floor(delta / 1000) })
      if (delta < 3_600_000) return t('time.minutes', { n: Math.floor(delta / 60_000) })
      if (delta < 86_400_000) return t('time.hours', { n: Math.floor(delta / 3_600_000) })
      return t('time.days', { n: Math.floor(delta / 86_400_000) })
    }

    function shortDate(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return ''
      const date = new Date(ms)
      const pad = (value) => String(value).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    /** Follow the host's peer/live state without letting a failed poll wipe the view. */
    function useSnapshot(active) {
      const [snapshot, setSnapshot] = React.useState({ status: 'loading', peers: [], imports: [], self: null })
      const [error, setError] = React.useState(null)
      const reload = React.useCallback(async () => {
        try {
          const body = await api('state')
          setSnapshot({ status: 'ready', ...body })
          setError(null)
        } catch (failure) {
          setError(String(failure?.message ?? failure))
          setSnapshot((current) => (current.status === 'ready' ? current : { ...current, status: 'error' }))
        }
      }, [])
      React.useEffect(() => {
        if (!active) return undefined
        let alive = true
        void reload()
        const timer = setInterval(() => {
          if (alive) void reload()
        }, POLL_MS)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [active, reload])
      return { ...snapshot, error, reload }
    }

    // ── shared pieces ─────────────────────────────────────────────────────
    function DeviceRow({ t, peer, busy, onRename, onForget, onForgetImport, imports }) {
      const [editing, setEditing] = React.useState(false)
      const [draft, setDraft] = React.useState(peer.customName ?? peer.remoteName ?? '')
      React.useEffect(() => {
        if (!editing) setDraft(peer.customName ?? peer.remoteName ?? '')
      }, [editing, peer.customName, peer.remoteName])
      const commit = () => {
        setEditing(false)
        onRename(peer, draft.trim())
      }
      const pullCount = imports.filter((entry) => entry.peerId === peer.id).length
      return h('div', { className: 'ss-row', 'data-peer': peer.id },
        h('span', { className: `ss-dot${peer.online ? ' on' : ''}`, title: peer.online ? t('status.online') : t('status.offline') }),
        editing
          ? h(React.Fragment, null,
            h('input', {
              className: 'ss-input',
              value: draft,
              autoFocus: true,
              placeholder: peer.remoteName ?? t('device.namePlaceholder'),
              onChange: (event) => setDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') commit()
                if (event.key === 'Escape') setEditing(false)
              },
            }),
            h('button', { type: 'button', className: 'ss-btn primary', onClick: commit }, t('common.save')),
            h('button', { type: 'button', className: 'ss-btn ghost', onClick: () => setEditing(false) }, t('common.cancel')),
          )
          : h(React.Fragment, null,
            h('div', { className: 'ss-name', title: `${peer.remoteName ?? ''} ${peer.address ?? ''}` },
              peer.name,
              peer.customName !== null ? h('span', { className: 'ss-badge' }, t('device.renamed')) : null,
              pullCount > 0 ? h('span', { className: 'ss-badge' }, t('device.pulled', { n: pullCount })) : null,
            ),
            h('div', { className: 'ss-meta' },
              peer.online
                ? `${peer.address ?? ''}${peer.port === null ? '' : `:${peer.port}`}`
                : t('device.lastSeen', { when: relativeTime(t, peer.lastSeen) }),
            ),
            h('div', { className: 'ss-actions' },
              h('button', { type: 'button', className: 'ss-btn ghost', disabled: busy, onClick: () => setEditing(true) }, t('device.rename')),
              h('button', { type: 'button', className: 'ss-btn ghost', disabled: busy, onClick: () => onForget(peer) }, t('device.forget')),
            ),
          ),
      )
    }

    function SessionList({ t, sessions, imports, onPull, onForgetImport, onVerify, digests }) {
      if (sessions.length === 0) return h('div', { className: 'ss-empty' }, t('sessions.empty'))
      return h('div', { className: 'ss-list' }, sessions.map((session) => {
        const imported = session.imported ?? null
        const digest = digests?.[session.id] ?? null
        return h('div', { className: 'ss-item', key: session.id },
          h('div', { className: 'ss-item-title' },
            h('div', null, session.title || t('sessions.untitled')),
            h('div', { className: 'ss-item-sub' },
              shortDate(session.updatedAt ?? session.createdAt),
              session.cwd ? ` · ${session.cwd}` : '',
              typeof session.events === 'number' ? ` · ${t('sessions.events', { n: session.events })}` : '',
            ),
            typeof digest?.sha256 !== 'string'
              ? (digest?.busy === true ? h('div', { className: 'ss-hash' }, t('sessions.verifying')) : null)
              : h('div', { className: `ss-hash${digest.verified === false ? ' bad' : digest.verified ? ' ok' : ''}` },
                t(digest.verified === null ? 'sessions.noDigest' : digest.verified ? 'sessions.verified' : 'sessions.verifyFailed', {
                  hash: `${digest.sha256.slice(0, 12)}…`,
                }),
              ),
          ),
          h('div', { className: 'ss-actions' },
            onVerify === undefined
              ? null
              : h('button', {
                type: 'button',
                className: 'ss-btn ghost',
                disabled: digest?.busy === true,
                onClick: () => onVerify(session),
              }, t('sessions.verify')),
            imported !== null
              ? h(React.Fragment, null,
                h('span', { className: 'ss-badge', title: imported.localId }, t('sessions.imported')),
                h('button', { type: 'button', className: 'ss-btn ghost', onClick: () => onForgetImport(session) }, t('common.clear')),
              )
              : h('button', { type: 'button', className: 'ss-btn', onClick: () => onPull(session) }, t('sessions.pull')),
          ),
        )
      }))
    }

    // ── settings page ─────────────────────────────────────────────────────
    function SettingsPage({ t }) {
      const snapshot = useSnapshot(true)
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [selfName, setSelfName] = React.useState('')
      const [seeds, setSeeds] = React.useState('')
      const [openPeer, setOpenPeer] = React.useState(null)
      const [peerSessions, setPeerSessions] = React.useState({})
      const [localSessions, setLocalSessions] = React.useState(null)
      const [pushTarget, setPushTarget] = React.useState(null)
      const [digests, setDigests] = React.useState({})
      const override = useOverride()

      const self = snapshot.self
      React.useEffect(() => {
        if (self !== null && self !== undefined) setSelfName(self.name)
      }, [self?.id, self?.name])
      React.useEffect(() => {
        if (snapshot.settings !== undefined) setSeeds((snapshot.settings.seeds ?? []).join('\n'))
      }, [snapshot.settings?.seeds])
      // The host value is the durable one: a browser that never touched this
      // setting adopts whatever the machine already stored.
      React.useEffect(() => {
        const stored = snapshot.settings?.locale
        if (typeof stored === 'string' && stored !== override) writeOverride(stored)
      }, [snapshot.settings?.locale, override])

      const run = React.useCallback(async (label, fn) => {
        setBusy(true)
        setNotice(null)
        try {
          const result = await fn()
          await snapshot.reload()
          // Store the key, not the resolved string: switching language while a
          // notice is on screen should translate it too.
          setNotice({ kind: 'ok', key: label })
          return result
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
          return undefined
        } finally {
          setBusy(false)
        }
      }, [snapshot])

      const saveSelfName = () => run('notice.selfNameSaved', () => api('selfName', { name: selfName.trim() }))
      const saveSeeds = () => run('notice.seedsSaved', () => api('settings', {
        patch: { seeds: seeds.split('\n').map((line) => line.trim()).filter((line) => line.length > 0) },
      }))
      const toggleAutoPull = (enabled) => run('notice.settingsSaved', () => api('settings', { patch: { autoPull: enabled } }))
      // Only adopt the new language after the host accepted it, so a failed
      // save cannot leave the UI in a state the machine does not remember.
      const changeLanguage = (value) => run('notice.languageSaved', async () => {
        const body = await api('settings', { patch: { locale: value } })
        writeOverride(body.settings?.locale ?? value)
        return body
      })

      const renamePeer = (peer, name) => run('notice.renamed', () => api('rename', { peerId: peer.id, name }))
      const forgetPeer = (peer) => run('notice.forgot', () => api('forget', { peerId: peer.id }))

      const loadPeerSessions = async (peer) => {
        if (openPeer === peer.id) {
          setOpenPeer(null)
          return
        }
        setOpenPeer(peer.id)
        if (peerSessions[peer.id] !== undefined) return
        setBusy(true)
        try {
          const body = await api('peerSessions', { peerId: peer.id })
          setPeerSessions((current) => ({ ...current, [peer.id]: body.sessions }))
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        } finally {
          setBusy(false)
        }
      }

      const pullSession = (peer, session) => run('notice.pulled', async () => {
        const body = await api('pull', { peerId: peer.id, sessionId: session.id })
        setPeerSessions((current) => ({
          ...current,
          [peer.id]: (current[peer.id] ?? []).map((entry) => (
            entry.id === session.id ? { ...entry, imported: body.imported ?? null } : entry
          )),
        }))
        return body
      })

      const forgetImport = (peer, session) => run('notice.importCleared', async () => {
        await api('forgetImport', { peerId: peer.id, sessionId: session.id })
        setPeerSessions((current) => ({
          ...current,
          [peer.id]: (current[peer.id] ?? []).map((entry) => (
            entry.id === session.id ? { ...entry, imported: null } : entry
          )),
        }))
      })

      const openPush = async (peer) => {
        setPushTarget(peer.id)
        if (localSessions !== null) return
        setBusy(true)
        try {
          const body = await api('localSessions', { limit: 60 })
          setLocalSessions(body.sessions ?? [])
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        } finally {
          setBusy(false)
        }
      }

      const pushSession = (peer, session) => run('notice.pushed', () => api('push', { peerId: peer.id, sessionId: session.id }))

      const verifySession = async (peer, session) => {
        setDigests((current) => ({ ...current, [session.id]: { ...(current[session.id] ?? {}), busy: true } }))
        try {
          const body = await api('verify', { peerId: peer.id, sessionId: session.id })
          setDigests((current) => ({
            ...current,
            [session.id]: { sha256: body.sha256, verified: body.verified, localMatch: body.localMatch, busy: false },
          }))
        } catch (error) {
          setDigests((current) => ({ ...current, [session.id]: { sha256: '', verified: false, busy: false, error: String(error?.message ?? error) } }))
        }
      }

      const peers = snapshot.peers ?? []
      const online = peers.filter((peer) => peer.online).length
      const imports = snapshot.imports ?? []

      return h('div', { className: 'ss-root' },
        h('div', { className: 'ss-head' },
          h('div', null,
            h('div', { className: 'ss-title' }, t('page.title')),
            h('div', { className: 'ss-sub' },
              t('page.subtitle', { online, total: peers.length }),
              snapshot.ports === undefined
                ? ''
                : ` · ${t('page.ports', { lan: snapshot.ports.lan ?? '—', discovery: snapshot.ports.discovery ?? '—' })}`,
            ),
          ),
          h('div', { className: 'ss-actions' },
            h('button', { type: 'button', className: 'ss-btn', disabled: busy, onClick: () => run('notice.refreshed', () => api('refresh')) }, t('common.refresh')),
          ),
        ),
        notice === null
          ? null
          : h('div', { className: notice.kind === 'error' ? 'ss-error' : 'ss-sub', style: { padding: '0 2px' } },
            notice.key === undefined ? notice.text : t(notice.key)),
        snapshot.error === null || snapshot.error === undefined
          ? null
          : h('div', { className: 'ss-error' }, t('page.apiError', { message: snapshot.error })),

        h('section', { className: 'ss-section' },
          h('div', { className: 'ss-section-hd' },
            h('span', { className: 'ss-section-title' }, t('self.title')),
          ),
          h('div', { className: 'ss-card' },
            h('div', { className: 'ss-field' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-label' }, t('self.name')),
                h('div', { className: 'ss-field-note' }, t('self.hint')),
              ),
              h('div', { className: 'ss-field-body' },
                h('input', {
                  className: 'ss-input',
                  value: selfName,
                  spellCheck: false,
                  'aria-label': t('self.name'),
                  onChange: (event) => setSelfName(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') void saveSelfName()
                  },
                }),
                h('button', { type: 'button', className: 'ss-btn primary', disabled: busy || selfName.trim().length === 0, onClick: () => void saveSelfName() }, t('common.save')),
              ),
            ),
          ),
        ),

        h('section', { className: 'ss-section' },
          h('div', { className: 'ss-section-hd' },
            h('span', { className: 'ss-section-title' }, t('devices.title')),
            h('span', { className: 'ss-meta' }, t('devices.count', { online, total: peers.length })),
          ),
          h('div', { className: 'ss-card' },
            peers.length === 0
              ? h('div', { className: 'ss-empty' }, t('devices.empty'))
              : peers.map((peer) => h('div', { key: peer.id },
                h(DeviceRow, { t, peer, busy, onRename: renamePeer, onForget: forgetPeer, imports }),
                h('div', { className: 'ss-actions', style: { padding: '0 0 12px', justifyContent: 'flex-start' } },
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy || !peer.online, onClick: () => loadPeerSessions(peer) }, openPeer === peer.id ? t('sessions.hide') : t('sessions.show')),
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy || !peer.online, onClick: () => openPush(peer) }, t('sessions.push')),
                  peer.online ? null : h('span', { className: 'ss-meta' }, t('device.offlineHint')),
                ),
                openPeer === peer.id
                  ? peerSessions[peer.id] === undefined
                    ? h('div', { className: 'ss-empty' }, t('common.loading'))
                    : h(SessionList, {
                      t,
                      sessions: peerSessions[peer.id],
                      imports,
                      digests,
                      onVerify: (session) => void verifySession(peer, session),
                      onPull: (session) => pullSession(peer, session),
                      onForgetImport: (session) => forgetImport(peer, session),
                    })
                  : null,
                pushTarget === peer.id && localSessions !== null
                  ? h(SessionList, {
                    t,
                    sessions: localSessions,
                    imports,
                    onPull: (session) => pushSession(peer, session),
                  })
                  : null,
              )),
            h('div', { className: 'ss-hint' }, t('devices.hint')),
          ),
        ),

        h('section', { className: 'ss-section' },
          h('div', { className: 'ss-section-hd' },
            h('span', { className: 'ss-section-title' }, t('settings.title')),
          ),
          h('div', { className: 'ss-card' },
            h('div', { className: 'ss-field' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-label' }, t('settings.language')),
                h('div', { className: 'ss-field-note' }, t('settings.languageHint')),
              ),
              h('div', { className: 'ss-field-body' },
                h('select', {
                  className: 'ss-select',
                  value: override,
                  disabled: busy,
                  'aria-label': t('settings.language'),
                  onChange: (event) => void changeLanguage(event.target.value),
                },
                  h('option', { value: 'auto' }, t('settings.languageAuto')),
                  h('option', { value: 'zh' }, '中文'),
                  h('option', { value: 'en' }, 'English'),
                ),
              ),
            ),
            h('div', { className: 'ss-field' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-label' }, t('settings.autoPull')),
                h('div', { className: 'ss-field-note' }, t('settings.autoPullHint')),
              ),
              h('div', { className: 'ss-field-body' },
                h('label', { className: 'ss-switch' },
                  h('input', {
                    type: 'checkbox',
                    role: 'switch',
                    checked: snapshot.settings?.autoPull === true,
                    disabled: busy,
                    'aria-label': t('settings.autoPullLabel'),
                    onChange: (event) => void toggleAutoPull(event.target.checked),
                  }),
                  h('span', { className: 'ss-switch-track', 'aria-hidden': 'true' },
                    h('span', { className: 'ss-switch-thumb' })),
                ),
              ),
            ),
            h('div', { className: 'ss-field ss-field-stack' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-row' },
                  h('div', { className: 'ss-field-label' }, t('settings.seeds')),
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy, onClick: () => void saveSeeds() }, t('common.save')),
                ),
                h('div', { className: 'ss-field-note' }, t('settings.seedsHint')),
              ),
              h('textarea', {
                className: 'ss-textarea',
                value: seeds,
                spellCheck: false,
                placeholder: '192.168.1.20:47801',
                'aria-label': t('settings.seeds'),
                onChange: (event) => setSeeds(event.target.value),
              }),
            ),
          ),
        ),

        snapshot.hasPersistence === false
          ? h('div', { className: 'ss-error' }, t('page.noPersistence'))
          : null,
      )
    }

    // ── sidebar row + full page ───────────────────────────────────────────
    /** Sidebar row glyph, drawn with currentColor so it follows the theme. */
    function SidebarIcon({ size = 16 }) {
      return h('svg', {
        className: 'ss-navicon',
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('path', { d: 'M2.5 6.2A5.6 5.6 0 0 1 12.6 4.5' }),
        h('path', { d: 'M12.9 2v2.7h-2.7' }),
        h('path', { d: 'M13.5 9.8A5.6 5.6 0 0 1 3.4 11.5' }),
        h('path', { d: 'M3.1 14v-2.7h2.7' }),
        h('path', { d: 'M6.1 7.9h3.8M6.1 8V6.4M9.9 8v1.6' }),
      )
    }

    /** The `main` panel: the same page as the settings section, full width. */
    function SyncPanelPage({ t }) {
      return h('div', { className: 'ss-page' }, h(SettingsPage, { t }))
    }

    // Slot components own the translator. The host also injects a `t` prop bound
    // to the DSH locale (that is what `locale: NS` buys), so it must NOT win
    // here: the plugin's own `locale` setting has to be able to override it.
    function LocalizedSettingsSection() {
      return h(SettingsPage, { t: useT() })
    }

    function LocalizedPanelPage() {
      return h(SyncPanelPage, { t: useT() })
    }

    // ── plugin face ───────────────────────────────────────────────────────
    const name = 'dsh-session-sync'
    const inject = ['slots', 'locale']

    function apply(ctx) {
      // The host locale service is the only thing that knows what language DSH
      // itself is using; keep its accessors so components can re-render on a
      // language switch instead of holding a stale translator.
      runtime = {
        getActive: () => ctx.locale.getSnapshot?.().active ?? null,
        subscribe: (listener) => ctx.locale.subscribe(listener),
      }

      ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'dsh-session-sync: dictionaries')

      // Labels are resolved by the host when it renders the sidebar/settings nav,
      // so a language switch has to re-publish the registration. Without this the
      // page would already be English while the row above it stayed Chinese until
      // some unrelated render happened.
      const publishOnLanguageChange = (register) => {
        let dispose = null
        const publish = () => {
          if (typeof dispose === 'function') dispose()
          dispose = register()
        }
        publish()
        const stop = subscribeOverride(publish)
        return () => {
          stop()
          if (typeof dispose === 'function') dispose()
        }
      }

      ctx.slots.inject('settings.section', () => publishOnLanguageChange(() => ctx.slots.register({
        name: 'settings.section',
        id: 'session-sync',
        order: 60,
        label: () => translateNow('page.title'),
        locale: NS,
      }, LocalizedSettingsSection)))

      // The row sits in the sidebar next to the host's own pages (the
      // `sidebar.panellist` slot is the only seat a plugin may claim), and it
      // opens the keyed `main` panel below.
      ctx.slots.inject('sidebar.panellist', () => publishOnLanguageChange(() => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 6,
        label: () => translateNow('nav.sessionSync'),
        locale: NS,
      }, SidebarIcon)))

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, LocalizedPanelPage))
    }

    return { name, inject, apply }
  },
})
