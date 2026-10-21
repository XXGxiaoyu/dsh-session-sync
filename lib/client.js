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
    // Bumped together with package.json (a test enforces the pair). The footer
    // shows the *running* host version next to it, so a stale process is
    // obvious instead of looking like a publishing mistake.
    const CLIENT_VERSION = '0.3.4'
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
.ss-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:0 2px 10px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.ss-footer-line{display:flex;align-items:center;gap:6px}
.ss-footer-sep{opacity:.5}
.ss-repo{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);text-decoration:none;border-radius:8px;padding:2px 6px;transition:background var(--ds-transition-duration) ease,color var(--ds-transition-duration) ease}
.ss-repo:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ss-self{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.ss-self-main{flex:1 1 auto;min-width:0}
.ss-id{font:var(--dsw-font-xxs-12)/18px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-tertiary)}
.ss-local-group{padding:4px 16px 12px;border-top:.5px solid var(--dsw-alias-border-l2)}
.ss-local-hd{font:var(--dsw-font-xs-13)/20px inherit;font-weight:500;color:var(--dsw-alias-label-secondary);margin:10px 0 2px}
.ss-local-hint{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12)/18px inherit;margin-bottom:6px}
.ss-local-instance{display:flex;align-items:center;gap:10px;padding:8px 0}
.ss-local-instance .ss-item-title{flex:1 1 auto;min-width:0}
.ss-diag{box-sizing:border-box;margin:0 16px 12px;padding:10px 12px;border-radius:var(--dsw-alias-radius-md);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);font:var(--dsw-font-xxs-12)/18px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-all}
.ss-footer-star{flex:1 1 100%;color:var(--dsw-alias-label-tertiary)}
.ss-footer-stale{flex:1 1 100%;color:var(--dsw-alias-label-secondary)}
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
.ss-page{box-sizing:border-box;width:100%;flex:1 1 auto;min-height:100%;max-width:1080px;margin:0 auto;padding:24px 32px 40px;overflow-y:auto;display:flex;flex-direction:column}
.ss-page .ss-root{padding:0}
.ss-hash{font-family:var(--ds-font-family-code,ui-monospace,Menlo,monospace);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.ss-hash.ok{color:var(--dsw-alias-state-success-primary)}
.ss-hash.bad{color:var(--dsw-alias-state-error-primary)}
.ss-navicon{display:flex;align-items:center;justify-content:center}
.ss-check{flex:none;width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.ss-item[draggable="true"]{cursor:grab}
.ss-item.dragging{opacity:.5}
.ss-item.drop{outline:1px dashed var(--dsw-alias-brand-primary);outline-offset:-2px}
.ss-toolbar{display:flex;align-items:center;gap:8px;padding:0 0 10px;flex-wrap:wrap}
.ss-toolbar .ss-meta{margin-right:auto}
.ss-drop{display:flex;align-items:center;gap:10px;padding:10px 8px;margin:0 -8px;border-radius:var(--dsw-radius-sm,8px);border:1px dashed transparent;transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out),border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out)}
.ss-drop:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ss-drop.over{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover)}
.ss-drop-path{flex:1;min-width:0;font-family:var(--ds-font-family-code,ui-monospace,Menlo,monospace);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-device-drop.over{background:var(--dsw-alias-interactive-bg-hover)}
.ss-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border-radius:6px;font-size:11px;line-height:16px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.ss-chip.ok{color:var(--dsw-alias-state-success-primary)}
.ss-chip.bad{color:var(--dsw-alias-state-error-primary)}
.ss-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45)}
.ss-modal-card{box-sizing:border-box;display:flex;flex-direction:column;gap:14px;width:min(640px,100%);max-height:min(80vh,720px);padding:20px;border-radius:var(--dsw-radius-xl,20px);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));border:.5px solid var(--dsw-alias-settings-card-stroke);box-shadow:0 16px 48px rgba(0,0,0,.32)}
.ss-modal-title{font-size:16px;line-height:24px;font-weight:600}
.ss-modal-sub{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.ss-modal-list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;min-height:0;padding:2px 0}
.ss-modal-row{display:flex;align-items:center;gap:12px;padding:6px 0}
.ss-modal-row .ss-item-title{flex:1;min-width:0}
.ss-modal-foot{display:flex;justify-content:flex-end;gap:8px}
.ss-queue-row{display:flex;align-items:center;gap:10px;padding:8px 0}
.ss-queue-row+.ss-queue-row{border-top:.5px solid var(--dsw-alias-border-l2)}
.ss-queue-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:20px}
.ss-queue-msg{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.ss-status{font-size:12px;line-height:18px;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
.ss-status.running{color:var(--dsw-alias-state-business-primary)}
.ss-status.done{color:var(--dsw-alias-state-success-primary)}
.ss-status.failed{color:var(--dsw-alias-state-error-primary)}
.ss-inline{display:flex;gap:8px;align-items:center;flex:none}
.ss-inline .ss-input{width:240px}
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
          'devices.self': '本机',
          'devices.sameMachine': '同机',
          'devices.localTitle': '同一台机器上的其他 DSH 实例（{n}）',
          'devices.localHint': '同一个 IP、不同端口不算另一台设备，所以不计入上面的设备列表；需要跨 profile 同步时仍可以查看和推送。',
          'devices.emptyLocal': '局域网里还没有其他设备。上面是本机实例，不算设备。',
          'diag.title': '界面出错了',
          'diag.body': '页面渲染时抛了异常，已在此展示诊断信息，而不是留一个空白面板。',
          'diag.hint': '把下面的内容发到 GitHub issue 即可；点「重新加载」可以先恢复界面。',
          'diag.reload': '重新加载',
          'diag.copy': '复制诊断',
          'devices.selfOffline': '本机地址未知',
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
          'sessions.selectAll': '全选',
          'sessions.selected': '已选 {n} 个',
          'sessions.syncSelected': '同步选中',
          'sessions.pushSelected': '推送选中',
          'sessions.dropHint': '拖到设备卡片上推送',
          'device.pullAll': '一键同步',
          'device.pushAll': '一键推送',
          'device.pushHere': '拖到此处推送会话',
          'workspaces.title': '本机工作区',
          'workspaces.hint': '把对端会话拖到某个目录上松手，确认后就会拉取到该目录；也可以把本机会话拖到设备卡片上推送。',
          'workspaces.count': '{n} 个会话',
          'workspaces.add': '添加路径',
          'workspaces.placeholder': '/Users/you/project',
          'plan.titlePull': '确认拉取到 {dir}',
          'plan.titlePush': '确认推送到 {peer}',
          'plan.dirAuto': '会话原目录',
          'plan.summary': '共 {n} 个：{fresh} 个待传，{dup} 个已存在',
          'plan.dupNote': '已存在的会话（按会话 id 判断）默认保留现有版本；选「覆盖」会新建一份副本，旧副本不动。',
          'plan.keep': '保留现有',
          'plan.skip': '跳过此条',
          'plan.copy': '覆盖为新副本',
          'plan.skipAll': '跳过全部已存在',
          'plan.confirm': '开始传输',
          'queue.title': '传输队列',
          'queue.pending': '排队中',
          'queue.running': '传输中',
          'queue.done': '已完成',
          'queue.skipped': '已存在，跳过',
          'queue.failed': '失败',
          'queue.clear': '清空',
          'queue.retry': '重试',
          'queue.summary': '完成 {done} · 跳过 {skipped} · 失败 {failed}',
          'notice.queued': '已加入传输队列',
          'notice.subnetsSaved': '跨网段扫描目标已保存',
          'settings.subnets': '跨网段扫描',
          'settings.subnetsHint': '广播穿不过路由器。填写对端所在网段（如 192.168.5.0/24）、单个 IP（如 192.168.5.20）或 IP:端口（如 192.168.5.20:47802），一行一个。网段走 UDP 发现包；单个 IP 额外用 HTTP 探测 47802–47817，UDP 被防火墙挡住也能连上。',
          'settings.probeStatus': 'HTTP 探测：{at} 检查 {n} 个目标，答复 {found} 台（UDP 不通时兜底）',
          'footer.version': 'v{version}',
          'footer.hostVersion': '宿主 v{version}',
          'footer.hostStale': '宿主仍在运行旧版本，重启 DSH 后生效',
          'footer.license': 'MIT 协议 · 开源',
          'footer.repo': 'GitHub 仓库',
          'footer.star': '如果这个插件帮到了你，欢迎在 GitHub 点个 Star ⭐',
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
          'devices.self': 'this device',
          'devices.sameMachine': 'same host',
          'devices.localTitle': 'Other DSH instances on this machine ({n})',
          'devices.localHint': 'Same IP, different port is not another device, so these are not counted above. Browsing and pushing between profiles still works.',
          'devices.emptyLocal': 'No other device on the LAN yet. The rows above are this machine, not devices.',
          'diag.title': 'The page hit an error',
          'diag.body': 'Rendering threw. The details are shown here instead of leaving a blank panel.',
          'diag.hint': 'Paste this into a GitHub issue; “Reload” usually brings the UI back.',
          'diag.reload': 'Reload',
          'diag.copy': 'Copy diagnostics',
          'devices.selfOffline': 'address unknown',
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
          'sessions.selectAll': 'Select all',
          'sessions.selected': '{n} selected',
          'sessions.syncSelected': 'Pull selected',
          'sessions.pushSelected': 'Push selected',
          'sessions.dropHint': 'Drag onto a device to push',
          'device.pullAll': 'Pull all',
          'device.pushAll': 'Push all',
          'device.pushHere': 'Drop to push sessions here',
          'workspaces.title': 'Local workspaces',
          'workspaces.hint': 'Drop peer sessions onto a folder to pull them there; drag local sessions onto a device card to push.',
          'workspaces.count': '{n} sessions',
          'workspaces.add': 'Add path',
          'workspaces.placeholder': '/Users/you/project',
          'plan.titlePull': 'Pull into {dir}',
          'plan.titlePush': 'Push to {peer}',
          'plan.dirAuto': 'the session\'s own folder',
          'plan.summary': '{n} sessions: {fresh} to transfer, {dup} already present',
          'plan.dupNote': 'Duplicates are matched by session id; that copy is kept by default; "Overwrite as copy" creates a new copy and leaves the old one alone.',
          'plan.keep': 'Keep existing',
          'plan.skip': 'Skip this one',
          'plan.copy': 'Overwrite as copy',
          'plan.skipAll': 'Skip all existing',
          'plan.confirm': 'Start transfer',
          'queue.title': 'Transfer queue',
          'queue.pending': 'Queued',
          'queue.running': 'Transferring',
          'queue.done': 'Done',
          'queue.skipped': 'Skipped (already present)',
          'queue.failed': 'Failed',
          'queue.clear': 'Clear',
          'queue.retry': 'Retry',
          'queue.summary': '{done} done · {skipped} skipped · {failed} failed',
          'notice.queued': 'Added to the transfer queue',
          'notice.subnetsSaved': 'Scan targets saved',
          'settings.subnets': 'Cross-subnet scan',
          'settings.subnetsHint': 'Broadcast cannot cross a router. List peer subnets (e.g. 192.168.5.0/24), single IPs (e.g. 192.168.5.20) or IP:port (e.g. 192.168.5.20:47802), one per line. Subnets get UDP discovery packets; single IPs are also probed over HTTP on 47802–47817, so a UDP-blocking firewall is not fatal.',
          'settings.probeStatus': 'HTTP probe: {at} checked {n} targets, {found} answered (fallback when UDP is blocked)',
          'footer.version': 'v{version}',
          'footer.hostVersion': 'host v{version}',
          'footer.hostStale': 'The running host is still on an older build — restart DSH to apply it',
          'footer.license': 'MIT licensed',
          'footer.repo': 'GitHub repository',
          'footer.star': 'If this plugin saves you a few clicks, a ⭐ on GitHub is appreciated',
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
      // Older hosts may ship React without useSyncExternalStore; a plain state
      // subscription behaves the same for our single mutable override object.
      const subscribeStore = typeof React.useSyncExternalStore === 'function'
        ? React.useSyncExternalStore
        : (subscribe, read) => {
          const [value, setValue] = React.useState(read)
          React.useEffect(() => subscribe(() => setValue(read())), [subscribe, read])
          return value
        }
      return subscribeStore(subscribeOverride, readOverride, readOverride)
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

    /**
     * Unnamed sessions all render as “未命名会话”, so two different conversations look alike.
     * Identity is the session id — show a short slice on every row and in the plan dialog so a
     * duplicate can be checked against the same id instead of the title.
     */
    /** Same machine, several old records: keep the freshest (online first) per address:port. */
    function collapseByAddress(peers) {
      const best = new Map()
      for (const peer of peers) {
        const key = `${peer.address ?? '—'}:${peer.port ?? '—'}`
        const score = (peer.online === true ? 2 : 0) + (typeof peer.lastSeen === 'number' ? peer.lastSeen / 1e13 : 0)
        const current = best.get(key)
        if (current === undefined || score > current.score) best.set(key, { peer, score })
      }
      return [...best.values()].map((entry) => entry.peer)
    }

    function sessionTag(session) {
      const id = typeof session?.id === 'string' ? session.id : ''
      const tail = id.startsWith('session-') ? id.slice('session-'.length) : id
      return tail.slice(0, 8) || '—'
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

    // ── drag & drop ───────────────────────────────────────────────────────
    // Rows carry a small JSON payload; drop zones read it back from
    // `dataTransfer`, which is the only channel available to a page that has
    // no native file-drag support.
    const DND_MIME = 'application/x-dsh-session-sync'

    function beginDrag(event, payload) {
      try {
        event.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
        event.dataTransfer.setData('text/plain', (payload.titles ?? []).join('\n'))
        event.dataTransfer.effectAllowed = 'copy'
      } catch {
        /* some browsers refuse custom MIME types; the drop just does nothing */
      }
    }

    function dropPayload(event) {
      try {
        const raw = event.dataTransfer.getData(DND_MIME)
        if (raw.length === 0) return null
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed?.ids) && parsed.ids.length > 0 ? parsed : null
      } catch {
        return null
      }
    }

    // ── shared pieces ─────────────────────────────────────────────────────
    function Check({ checked, onChange, label }) {
      return h('input', {
        type: 'checkbox',
        className: 'ss-check',
        checked,
        'aria-label': label,
        onChange: (event) => onChange(event),
      })
    }

    function DeviceRow({ t, peer, busy, onRename, onForget, imports, onPullAll, onPushAll, dropActive, onDrop }) {
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
      return h('div', {
        className: `ss-row ss-device-drop${dropActive ? ' over' : ''}`,
        'data-peer': peer.id,
        onDragOver: (event) => {
          event.preventDefault()
          if (typeof onDrop === 'function') onDrop('over')
        },
        onDragLeave: () => {
          if (typeof onDrop === 'function') onDrop('leave')
        },
        onDrop: (event) => {
          event.preventDefault()
          if (typeof onDrop === 'function') onDrop('drop', event)
        },
      },
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

    /** Rows shared by the peer list and the local push list. */
    function SessionList({
      t,
      sessions,
      digests,
      selectable,
      selected,
      onToggle,
      onToggleAll,
      onDragStart,
      onVerify,
      onPull,
      onForgetImport,
      pullLabel,
      emptyKey,
    }) {
      if (sessions.length === 0) return h('div', { className: 'ss-empty' }, t(emptyKey ?? 'sessions.empty'))
      const allSelected = selectable === true && sessions.every((session) => selected.includes(session.id))
      return h('div', { className: 'ss-list' },
        selectable
          ? h('div', { className: 'ss-toolbar' },
            h('label', { className: 'ss-inline' },
              h(Check, { checked: allSelected, label: t('sessions.selectAll'), onChange: () => onToggleAll(sessions.map((session) => session.id)) }),
              h('span', { className: 'ss-meta' }, t('sessions.selected', { n: selected.length })),
            ),
          )
          : null,
        sessions.map((session) => {
          const imported = session.imported ?? null
          const digest = digests?.[session.id] ?? null
          const isSelected = selectable === true && selected.includes(session.id)
          return h('div', {
            className: `ss-item${isSelected ? ' selected' : ''}`,
            key: session.id,
            draggable: true,
            onDragStart: (event) => onDragStart?.(event, session),
            onDragEnd: () => undefined,
            onClick: (event) => {
              if (selectable !== true) return
              if (event.target.closest('button,input,a')) return
              onToggle?.(session.id, event)
            },
          },
            selectable
              ? h(Check, {
                checked: isSelected,
                label: `${session.title || t('sessions.untitled')} #${sessionTag(session)}`,
                onChange: () => onToggle?.(session.id),
              })
              : null,
            h('div', { className: 'ss-item-title' },
              h('div', null, session.title || t('sessions.untitled')),
              h('div', { className: 'ss-item-sub' },
                h('code', { className: 'ss-id' }, `#${sessionTag(session)}`),
                ' · ',
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
                : (onPull === undefined ? null
                  : h('button', { type: 'button', className: 'ss-btn', onClick: () => onPull(session) }, t(pullLabel ?? 'sessions.pull'))),
            ),
          )
        }))
    }

    /** Second confirmation before anything leaves the machine. */
    function PlanDialog({ t, plan, onCancel, onConfirm }) {
      const [choices, setChoices] = React.useState({})
      React.useEffect(() => {
        const initial = {}
        for (const item of plan.items) initial[item.sessionId] = item.dup ? 'keep' : 'copy'
        setChoices(initial)
      }, [plan])
      const dupCount = plan.items.filter((item) => item.dup).length
      const title = plan.direction === 'pull'
        ? t('plan.titlePull', { dir: plan.cwd ?? t('plan.dirAuto') })
        : t('plan.titlePush', { peer: plan.peerName })
      return h('div', { className: 'ss-modal', role: 'presentation', onClick: (event) => { if (event.target === event.currentTarget) onCancel() } },
        h('div', { className: 'ss-modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('div', null,
            h('div', { className: 'ss-modal-title' }, title),
            h('div', { className: 'ss-modal-sub' }, t('plan.summary', {
              n: plan.items.length,
              fresh: plan.items.filter((item) => !item.dup).length,
              dup: dupCount,
            })),
          ),
          dupCount > 0 ? h('div', { className: 'ss-modal-sub' }, t('plan.dupNote')) : null,
          h('div', { className: 'ss-modal-list' },
            plan.items.map((item) => h('div', { className: 'ss-modal-row', key: item.sessionId },
              h('div', { className: 'ss-item-title' },
                h('div', null, item.title || t('sessions.untitled')),
                h('div', { className: 'ss-item-sub' },
                  h('code', { className: 'ss-id' }, `#${sessionTag({ id: item.sessionId })}`),
                  item.dup ? ` · ${t('sessions.imported')}` : '',
                ),
              ),
              item.dup
                ? h('select', {
                  className: 'ss-select',
                  value: choices[item.sessionId] ?? 'keep',
                  'aria-label': item.title || t('sessions.untitled'),
                  onChange: (event) => setChoices((current) => ({ ...current, [item.sessionId]: event.target.value })),
                },
                  h('option', { value: 'keep' }, t('plan.keep')),
                  h('option', { value: 'copy' }, t('plan.copy')),
                  h('option', { value: 'skip' }, t('plan.skip')),
                )
                : h('span', { className: 'ss-chip ok' }, t('queue.pending')),
            )),
          ),
          h('div', { className: 'ss-modal-foot' },
            dupCount > 0
              ? h('button', {
                type: 'button',
                className: 'ss-btn ghost',
                onClick: () => {
                  const next = { ...choices }
                  for (const item of plan.items) if (item.dup) next[item.sessionId] = 'keep'
                  onConfirm(next)
                },
              }, t('plan.skipAll'))
              : null,
            h('button', { type: 'button', className: 'ss-btn', onClick: onCancel }, t('common.cancel')),
            h('button', { type: 'button', className: 'ss-btn primary', onClick: () => onConfirm(choices) }, t('plan.confirm')),
          ),
        ))
    }

    function QueuePanel({ t, queue, onClear, onRetry }) {
      if (queue.length === 0) return null
      const done = queue.filter((item) => item.status === 'done').length
      const skipped = queue.filter((item) => item.status === 'skipped').length
      const failed = queue.filter((item) => item.status === 'failed').length
      return h('section', { className: 'ss-section' },
        h('div', { className: 'ss-section-hd' },
          h('span', { className: 'ss-section-title' }, t('queue.title')),
          h('div', { className: 'ss-inline' },
            h('span', { className: 'ss-meta' }, t('queue.summary', { done, skipped, failed })),
            h('button', { type: 'button', className: 'ss-btn ghost', onClick: onClear }, t('queue.clear')),
          ),
        ),
        h('div', { className: 'ss-card' },
          queue.map((item) => h('div', { className: 'ss-queue-row', key: item.key },
            h('span', { className: `ss-status ${item.status}` }, t(`queue.${item.status}`)),
            h('div', { className: 'ss-queue-title', title: item.title },
              item.title || t('sessions.untitled'),
              h('span', { className: 'ss-queue-msg' },
                ` · ${item.direction === 'pull' ? '←' : '→'} ${item.peerName}`,
                item.message ? ` · ${item.message}` : '',
              ),
            ),
            item.status === 'failed'
              ? h('button', { type: 'button', className: 'ss-btn ghost', onClick: () => onRetry(item) }, t('queue.retry'))
              : null,
          )),
        ),
      )
    }

    // ── settings page ─────────────────────────────────────────────────────
    /**
     * A blank panel is the worst failure mode we can ship: it looks like the plugin did nothing.
     * Any render error inside the page lands here and becomes readable diagnostics instead.
     */
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error, info) {
        console.error('[dsh-session-sync] render failed', error, info)
      }

      render() {
        if (this.state.error !== null) return h(Diagnostics, { error: this.state.error, t: this.props.t })
        return this.props.children
      }
    }

    function Diagnostics({ error, t }) {
      const [diag, setDiag] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        api('diag').then((body) => { if (alive) setDiag(body) }, () => undefined)
        return () => { alive = false }
      }, [])
      const lines = [
        `dsh-session-sync ${CLIENT_VERSION}`,
        `error: ${error?.message ?? String(error)}`,
        `stack: ${String(error?.stack ?? '').split('\n').slice(0, 4).join(' | ')}`,
        `ua: ${navigator.userAgent}`,
        `diag: ${diag === null ? 'unavailable' : `${diag.platform}/${diag.arch} node ${diag.node} host ${diag.version} lan ${diag.ports?.lan} udp ${diag.ports?.discovery}`}`,
      ]
      return h('div', { className: 'ss-page' },
        h('section', { className: 'ss-section' },
          h('div', { className: 'ss-section-hd' }, h('span', { className: 'ss-section-title' }, t('diag.title'))),
          h('div', { className: 'ss-card' },
            h('div', { className: 'ss-field' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-label' }, t('diag.body')),
                h('div', { className: 'ss-field-note' }, t('diag.hint')),
              ),
            ),
            h('pre', { className: 'ss-diag' }, lines.join('\n')),
            h('div', { className: 'ss-actions', style: { padding: '0 16px 12px', justifyContent: 'flex-start' } },
              h('button', { type: 'button', className: 'ss-btn', onClick: () => location.reload() }, t('diag.reload')),
              h('button', {
                type: 'button',
                className: 'ss-btn ghost',
                onClick: () => { void navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined) },
              }, t('diag.copy')),
            ),
          ),
        ),
      )
    }

    function SettingsPage({ t }) {
      const snapshot = useSnapshot(true)
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [selfName, setSelfName] = React.useState('')
      const selfDirty = React.useRef(false)
      const [seeds, setSeeds] = React.useState('')
      const seedsDirty = React.useRef(false)
      const [subnets, setSubnets] = React.useState('')
      const subnetsDirty = React.useRef(false)
      const [openPeer, setOpenPeer] = React.useState(null)
      const [peerSessions, setPeerSessions] = React.useState({})
      const [localSessions, setLocalSessions] = React.useState(null)
      const [pushTarget, setPushTarget] = React.useState(null)
      const [digests, setDigests] = React.useState({})
      const [selected, setSelected] = React.useState([])
      const [plan, setPlan] = React.useState(null)
      const [queue, setQueue] = React.useState([])
      const [dropPeer, setDropPeer] = React.useState(null)
      const [dropPath, setDropPath] = React.useState(null)
      const [extraPaths, setExtraPaths] = React.useState([])
      const [pathDraft, setPathDraft] = React.useState('')
      const anchor = React.useRef(null)
      const queueRef = React.useRef([])
      const running = React.useRef(false)
      const override = useOverride()

      const queueWrite = React.useCallback((updater) => {
        const next = typeof updater === 'function' ? updater(queueRef.current) : updater
        queueRef.current = next
        setQueue(next)
      }, [])

      const self = snapshot.self
      // Background polling must never overwrite what the user is typing: the
      // text fields only adopt the host value until they are touched.
      React.useEffect(() => {
        if (!selfDirty.current && self !== null && self !== undefined) setSelfName(self.name)
      }, [self?.id, self?.name])
      const seedsText = (snapshot.settings?.seeds ?? []).join('\n')
      React.useEffect(() => {
        if (!seedsDirty.current) setSeeds(seedsText)
      }, [seedsText])
      const subnetsText = (snapshot.settings?.subnets ?? []).join('\n')
      React.useEffect(() => {
        if (!subnetsDirty.current) setSubnets(subnetsText)
      }, [subnetsText])
      React.useEffect(() => {
        const stored = snapshot.settings?.locale
        if (typeof stored === 'string' && stored !== override) writeOverride(stored)
      }, [snapshot.settings?.locale, override])

      // Local sessions give both the push source and the workspace folders that
      // accept a pull (a dropped session lands under that folder).
      React.useEffect(() => {
        let alive = true
        api('localSessions', { limit: 80 })
          .then((body) => { if (alive) setLocalSessions(body.sessions ?? []) })
          .catch(() => undefined)
        return () => { alive = false }
      }, [])

      React.useEffect(() => { setSelected([]) }, [openPeer])

      const run = React.useCallback(async (label, fn) => {
        setBusy(true)
        setNotice(null)
        try {
          const result = await fn()
          await snapshot.reload()
          setNotice({ kind: 'ok', key: label })
          return result
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
          return undefined
        } finally {
          setBusy(false)
        }
      }, [snapshot])

      const saveSelfName = () => run('notice.selfNameSaved', async () => {
        const body = await api('selfName', { name: selfName.trim() })
        selfDirty.current = false
        return body
      })
      const saveSeeds = () => run('notice.seedsSaved', async () => {
        const body = await api('settings', {
          patch: { seeds: seeds.split('\n').map((line) => line.trim()).filter((line) => line.length > 0) },
        })
        seedsDirty.current = false
        return body
      })
      const saveSubnets = () => run('notice.subnetsSaved', async () => {
        const body = await api('settings', {
          patch: { subnets: subnets.split('\n').map((line) => line.trim()).filter((line) => line.length > 0) },
        })
        subnetsDirty.current = false
        return body
      })
      const toggleAutoPull = (enabled) => run('notice.settingsSaved', () => api('settings', { patch: { autoPull: enabled } }))
      const changeLanguage = (value) => run('notice.languageSaved', async () => {
        const body = await api('settings', { patch: { locale: value } })
        writeOverride(body.settings?.locale ?? value)
        return body
      })

      const renamePeer = (peer, name) => run('notice.renamed', () => api('rename', { peerId: peer.id, name }))
      const forgetPeer = (peer) => run('notice.forgot', () => api('forget', { peerId: peer.id }))

      const reloadPeer = React.useCallback(async (peerId) => {
        const body = await api('peerSessions', { peerId })
        setPeerSessions((current) => ({ ...current, [peerId]: body.sessions }))
        return body.sessions
      }, [])

      const loadPeerSessions = async (peer) => {
        if (openPeer === peer.id) {
          setOpenPeer(null)
          return
        }
        setOpenPeer(peer.id)
        if (peerSessions[peer.id] !== undefined) return
        setBusy(true)
        try {
          await reloadPeer(peer.id)
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        } finally {
          setBusy(false)
        }
      }

      const peerById = (peerId) => (snapshot.peers ?? []).find((peer) => peer.id === peerId) ?? null

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
          const body = await api('localSessions', { limit: 80 })
          setLocalSessions(body.sessions ?? [])
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        } finally {
          setBusy(false)
        }
      }

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

      // ── selection ───────────────────────────────────────────────────────
      const toggleSelected = (id, event) => {
        const list = (peerSessions[openPeer] ?? []).map((session) => session.id)
        const additive = event === undefined || event.metaKey === true || event.ctrlKey === true || event.shiftKey === true
        if (event?.shiftKey === true && anchor.current !== null) {
          const from = list.indexOf(anchor.current)
          const to = list.indexOf(id)
          if (from >= 0 && to >= 0) {
            const range = list.slice(Math.min(from, to), Math.max(from, to) + 1)
            setSelected((current) => [...new Set([...current, ...range])])
            return
          }
        }
        anchor.current = id
        if (!additive) {
          setSelected([id])
          return
        }
        setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
      }

      const toggleAll = (ids) => {
        setSelected((current) => (ids.every((id) => current.includes(id)) ? [] : ids))
      }

      // ── plans & queue ───────────────────────────────────────────────────
      const openPullPlan = (peer, ids, cwd) => {
        const sessions = peerSessions[peer.id] ?? []
        const items = ids
          .map((id) => sessions.find((session) => session.id === id))
          .filter((session) => session !== undefined)
          .map((session) => ({
            sessionId: session.id,
            title: session.title || '',
            dup: (session.imported ?? null) !== null,
          }))
        if (items.length === 0) return
        setPlan({ direction: 'pull', peerId: peer.id, peerName: peer.name, cwd: cwd ?? null, items })
      }

      const openPushPlan = (peer, ids) => {
        const sessions = localSessions ?? []
        const items = ids
          .map((id) => sessions.find((session) => session.id === id))
          .filter((session) => session !== undefined)
          .map((session) => ({ sessionId: session.id, title: session.title || '', dup: false }))
        if (items.length === 0) return
        setPlan({ direction: 'push', peerId: peer.id, peerName: peer.name, cwd: null, items })
      }

      const updateItem = (key, patch) => queueWrite((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))

      const drain = async () => {
        if (running.current) return
        running.current = true
        try {
          for (;;) {
            const next = queueRef.current.find((item) => item.status === 'pending')
            if (next === undefined) break
            updateItem(next.key, { status: 'running', message: '' })
            try {
              const body = next.direction === 'pull'
                ? await api('pull', {
                  peerId: next.peerId,
                  sessionId: next.sessionId,
                  cwd: next.cwd ?? undefined,
                  force: next.force === true,
                })
                : await api('push', { peerId: next.peerId, sessionId: next.sessionId, force: next.force === true })
              const skipped = body?.skipped === true
              updateItem(next.key, { status: skipped ? 'skipped' : 'done' })
            } catch (error) {
              updateItem(next.key, { status: 'failed', message: String(error?.message ?? error) })
            }
          }
        } finally {
          running.current = false
        }
        await snapshot.reload()
        const currentPeer = openPeer
        if (currentPeer !== null) {
          try { await reloadPeer(currentPeer) } catch { /* list refreshes on next open */ }
        }
      }

      const confirmPlan = (choices) => {
        if (plan === null) return
        const created = plan.items.map((item, index) => {
          const choice = item.dup ? (choices[item.sessionId] ?? 'keep') : 'copy'
          return {
            key: `${Date.now()}-${index}-${item.sessionId}`,
            direction: plan.direction,
            peerId: plan.peerId,
            peerName: plan.peerName,
            sessionId: item.sessionId,
            title: item.title,
            cwd: plan.cwd,
            force: choice === 'copy',
            status: item.dup && choice !== 'copy' ? 'skipped' : 'pending',
            message: '',
          }
        })
        setPlan(null)
        queueWrite((current) => [...current, ...created])
        setNotice({ kind: 'ok', key: 'notice.queued' })
        void drain()
      }

      const retryItem = (item) => {
        updateItem(item.key, { status: 'pending', message: '' })
        void drain()
      }

      const clearQueue = () => queueWrite((current) => current.filter((item) => item.status === 'running'))

      // ── drag sources ────────────────────────────────────────────────────
      const dragPeerSessions = (peer) => (event, session) => {
        const ids = selected.includes(session.id) && selected.length > 0 ? selected : [session.id]
        const titles = (peerSessions[peer.id] ?? []).filter((entry) => ids.includes(entry.id)).map((entry) => entry.title || '')
        beginDrag(event, { direction: 'pull', peerId: peer.id, ids, titles })
      }

      const dragLocalSessions = (event, session) => {
        const titles = [session.title || '']
        beginDrag(event, { direction: 'push', peerId: null, ids: [session.id], titles })
      }

      const peers = snapshot.peers ?? []
      // Two profiles on one machine share every IP; only the host address decides
      // "another device". Same-host instances are grouped under 本机 instead.
      const remotePeers = peers.filter((peer) => peer.sameMachine !== true)
      const localPeers = collapseByAddress(peers.filter((peer) => peer.sameMachine === true))
      const online = remotePeers.filter((peer) => peer.online).length
      const imports = snapshot.imports ?? []
      const cwds = React.useMemo(() => {
        const map = new Map()
        const add = (cwd) => {
          if (typeof cwd !== 'string' || cwd.length === 0) return
          map.set(cwd, (map.get(cwd) ?? 0) + 1)
        }
        for (const session of localSessions ?? []) add(session.cwd)
        for (const session of Object.values(peerSessions).flat()) add(session.cwd)
        for (const path of extraPaths) if (!map.has(path)) map.set(path, 0)
        return [...map.entries()].map(([cwd, count]) => ({ cwd, count }))
      }, [localSessions, peerSessions, extraPaths])

      const openSession = openPeer === null ? null : peerById(openPeer)
      const list = openPeer === null ? [] : (peerSessions[openPeer] ?? [])
      const pushPeer = pushTarget === null ? null : peerById(pushTarget)

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

        // local machine name
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
                  onChange: (event) => { selfDirty.current = true; setSelfName(event.target.value) },
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') void saveSelfName()
                  },
                }),
                h('button', { type: 'button', className: 'ss-btn primary', disabled: busy || selfName.trim().length === 0, onClick: () => void saveSelfName() }, t('common.save')),
              ),
            ),
          ),
        ),

        // devices
        h('section', { className: 'ss-section' },
          h('div', { className: 'ss-section-hd' },
            h('span', { className: 'ss-section-title' }, t('devices.title')),
            h('span', { className: 'ss-meta' }, t('devices.count', { online, total: remotePeers.length })),
          ),
          h('div', { className: 'ss-card' },
            h('div', { className: 'ss-self' },
              h('span', { className: 'ss-dot on', 'aria-hidden': 'true' }),
              h('div', { className: 'ss-self-main' },
                h('div', { className: 'ss-item-title' },
                  h('div', null, self?.name ?? '—', h('span', { className: 'ss-badge' }, t('devices.self'))),
                  h('div', { className: 'ss-item-sub' },
                    self?.ip === undefined ? t('devices.selfOffline') : `${self.ip}:${self.port}`,
                    snapshot.version === undefined ? '' : ` · v${snapshot.version}`,
                  ),
                ),
              ),
            ),
            localPeers.length === 0 ? null : h('div', { className: 'ss-local-group' },
              h('div', { className: 'ss-local-hd' }, t('devices.localTitle', { n: localPeers.length })),
              h('div', { className: 'ss-local-hint' }, t('devices.localHint')),
              localPeers.map((peer) => h('div', { key: peer.id, className: 'ss-local-instance', 'data-peer': peer.id },
                h('span', { className: `ss-dot${peer.online ? ' on' : ''}` }),
                h('div', { className: 'ss-item-title' },
                  h('div', null, peer.name, h('span', { className: 'ss-badge' }, t('devices.sameMachine'))),
                  h('div', { className: 'ss-item-sub' },
                    `${peer.address ?? '—'}:${peer.port ?? '—'}`,
                    peer.version === null || peer.version === undefined ? '' : ` · v${peer.version}`,
                    peer.online ? '' : ` · ${t('status.offline')}`,
                  ),
                ),
                h('div', { className: 'ss-actions' },
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy || !peer.online, onClick: () => loadPeerSessions(peer) }, openPeer === peer.id ? t('sessions.hide') : t('sessions.show')),
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy || !peer.online, onClick: () => openPush(peer) }, t('sessions.push')),
                ),
              )),
            ),
            remotePeers.length === 0
              ? h('div', { className: 'ss-empty' }, t(localPeers.length === 0 ? 'devices.empty' : 'devices.emptyLocal'))
              : remotePeers.map((peer) => h('div', { key: peer.id },
                h(DeviceRow, {
                  t,
                  peer,
                  busy,
                  onRename: renamePeer,
                  onForget: forgetPeer,
                  imports,
                  dropActive: dropPeer === peer.id,
                  onDrop: (kind, event) => {
                    if (kind === 'over') { setDropPeer(peer.id); return }
                    if (kind === 'leave') { setDropPeer(null); return }
                    setDropPeer(null)
                    const payload = dropPayload(event)
                    if (payload === null || payload.direction !== 'push') return
                    openPushPlan(peer, payload.ids)
                  },
                }),
                h('div', { className: 'ss-actions', style: { padding: '0 0 12px', justifyContent: 'flex-start', flexWrap: 'wrap' } },
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy || !peer.online, onClick: () => loadPeerSessions(peer) }, openPeer === peer.id ? t('sessions.hide') : t('sessions.show')),
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy || !peer.online, onClick: () => openPush(peer) }, t('sessions.push')),
                  h('button', {
                    type: 'button',
                    className: 'ss-btn',
                    disabled: busy || !peer.online,
                    onClick: async () => {
                      try {
                        const sessions = peerSessions[peer.id] ?? await reloadPeer(peer.id)
                        setOpenPeer(peer.id)
                        openPullPlan(peer, sessions.map((session) => session.id), null)
                      } catch (error) {
                        setNotice({ kind: 'error', text: String(error?.message ?? error) })
                      }
                    },
                  }, t('device.pullAll')),
                  h('button', {
                    type: 'button',
                    className: 'ss-btn',
                    disabled: busy || !peer.online || localSessions === null,
                    onClick: () => openPushPlan(peer, (localSessions ?? []).map((session) => session.id)),
                  }, t('device.pushAll')),
                  peer.online ? null : h('span', { className: 'ss-meta' }, t('device.offlineHint')),
                ),
                openPeer === peer.id
                  ? (peerSessions[peer.id] === undefined
                    ? h('div', { className: 'ss-empty' }, t('common.loading'))
                    : h(React.Fragment, null,
                      h('div', { className: 'ss-toolbar' },
                        h('button', {
                          type: 'button',
                          className: 'ss-btn primary',
                          disabled: busy || selected.length === 0,
                          onClick: () => openPullPlan(peer, selected, null),
                        }, t('sessions.syncSelected')),
                        h('span', { className: 'ss-meta' }, t('sessions.dropHint')),
                      ),
                      h(SessionList, {
                        t,
                        sessions: list,
                        imports,
                        digests,
                        selectable: true,
                        selected,
                        onToggle: toggleSelected,
                        onToggleAll: toggleAll,
                        onDragStart: dragPeerSessions(peer),
                        onVerify: (session) => void verifySession(peer, session),
                        onPull: (session) => openPullPlan(peer, [session.id], null),
                        onForgetImport: (session) => forgetImport(peer, session),
                      }),
                    ))
                  : null,
                pushTarget === peer.id && localSessions !== null
                  ? h(SessionList, {
                    t,
                    sessions: localSessions,
                    imports,
                    onDragStart: dragLocalSessions,
                    onPull: (session) => openPushPlan(peer, [session.id]),
                    pullLabel: 'sessions.pull',
                    emptyKey: 'sessions.empty',
                  })
                  : null,
              )),
            h('div', { className: 'ss-hint' }, t('devices.hint')),
            h('div', { className: 'ss-hint' }, t('device.pushHere')),
          ),
        ),

        // cross-subnet targets and workspaces
        h('section', { className: 'ss-section' },
          h('div', { className: 'ss-section-hd' },
            h('span', { className: 'ss-section-title' }, t('workspaces.title')),
            h('span', { className: 'ss-meta' }, t('workspaces.count', { n: cwds.length })),
          ),
          h('div', { className: 'ss-card' },
            cwds.length === 0
              ? h('div', { className: 'ss-empty' }, t('workspaces.hint'))
              : cwds.map(({ cwd, count }) => h('div', {
                key: cwd,
                className: `ss-drop${dropPath === cwd ? ' over' : ''}`,
                onDragOver: (event) => { event.preventDefault(); setDropPath(cwd) },
                onDragLeave: () => setDropPath(null),
                onDrop: (event) => {
                  event.preventDefault()
                  setDropPath(null)
                  const payload = dropPayload(event)
                  if (payload === null || payload.direction !== 'pull') return
                  const peer = peerById(payload.peerId)
                  if (peer === null) return
                  openPullPlan(peer, payload.ids, cwd)
                },
              },
                h('span', { className: 'ss-drop-path', title: cwd }, cwd),
                h('span', { className: 'ss-meta' }, t('workspaces.count', { n: count })),
              )),
            h('div', { className: 'ss-field' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-label' }, t('workspaces.add')),
                h('div', { className: 'ss-field-note' }, t('workspaces.hint')),
              ),
              h('div', { className: 'ss-field-body' },
                h('input', {
                  className: 'ss-input',
                  value: pathDraft,
                  spellCheck: false,
                  placeholder: t('workspaces.placeholder'),
                  'aria-label': t('workspaces.add'),
                  onChange: (event) => setPathDraft(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key !== 'Enter') return
                    const value = pathDraft.trim()
                    if (value.length === 0) return
                    setExtraPaths((current) => (current.includes(value) ? current : [...current, value]))
                    setPathDraft('')
                  },
                }),
                h('button', {
                  type: 'button',
                  className: 'ss-btn',
                  onClick: () => {
                    const value = pathDraft.trim()
                    if (value.length === 0) return
                    setExtraPaths((current) => (current.includes(value) ? current : [...current, value]))
                    setPathDraft('')
                  },
                }, t('workspaces.add')),
              ),
            ),
          ),
        ),

        h(QueuePanel, { t, queue, onClear: clearQueue, onRetry: retryItem }),

        // settings
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
                onChange: (event) => { seedsDirty.current = true; setSeeds(event.target.value) },
              }),
            ),
            h('div', { className: 'ss-field ss-field-stack' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-row' },
                  h('div', { className: 'ss-field-label' }, t('settings.subnets')),
                  h('button', { type: 'button', className: 'ss-btn', disabled: busy, onClick: () => void saveSubnets() }, t('common.save')),
                ),
                h('div', { className: 'ss-field-note' }, t('settings.subnetsHint')),
              ),
              h('textarea', {
                className: 'ss-textarea',
                value: subnets,
                spellCheck: false,
                placeholder: '192.168.5.0/24',
                'aria-label': t('settings.subnets'),
                onChange: (event) => { subnetsDirty.current = true; setSubnets(event.target.value) },
              }),
              snapshot.probe !== undefined && snapshot.probe.targets > 0 && snapshot.probe.at > 0
                ? h('div', { className: 'ss-field-note' }, t('settings.probeStatus', {
                  at: shortClock(snapshot.probe.at),
                  n: snapshot.probe.targets,
                  found: snapshot.probe.found,
                }))
                : null,
            ),
          ),
        ),

        h('footer', { className: 'ss-footer' },
          h('div', { className: 'ss-footer-line' },
            h('span', null, t('footer.version', { version: CLIENT_VERSION })),
            snapshot.version !== undefined && snapshot.version !== CLIENT_VERSION
              ? h('span', null, t('footer.hostVersion', { version: snapshot.version }))
              : null,
            h('span', { className: 'ss-footer-sep' }, '·'),
            h('span', null, t('footer.license')),
          ),
          h('a', {
            className: 'ss-repo',
            href: snapshot.repo ?? 'https://github.com/XXGxiaoyu/dsh-session-sync',
            target: '_blank',
            rel: 'noreferrer noopener',
            title: t('footer.repo'),
            'aria-label': t('footer.repo'),
          }, h(GitHubIcon, { size: 16 }), h('span', null, t('footer.repo'))),
          h('div', { className: 'ss-footer-star' }, t('footer.star')),
          snapshot.version !== undefined && snapshot.version !== CLIENT_VERSION
            ? h('div', { className: 'ss-footer-stale' }, t('footer.hostStale'))
            : null,
        ),

        snapshot.hasPersistence === false
          ? h('div', { className: 'ss-error' }, t('page.noPersistence'))
          : null,
        plan === null ? null : h(PlanDialog, { t, plan, onCancel: () => setPlan(null), onConfirm: confirmPlan }),
      )
    }

    // ── sidebar row + full page ───────────────────────────────────────────
    /** Octocat mark, 16×16, currentColor so it follows the theme. */
    function GitHubIcon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'currentColor', 'aria-hidden': 'true' },
        h('path', {
          d: 'M8 .9a7.2 7.2 0 0 0-2.28 14.03c.36.07.49-.15.49-.34l-.01-1.2c-2 .44-2.43-.85-2.43-.85-.33-.83-.8-1.05-.8-1.05-.65-.45.05-.44.05-.44.72.05 1.1.74 1.1.74.64 1.1 1.68.78 2.09.6.06-.47.25-.79.45-.97-1.6-.18-3.28-.8-3.28-3.56 0-.79.28-1.43.74-1.94-.08-.18-.32-.91.07-1.9 0 0 .6-.19 1.97.74a6.8 6.8 0 0 1 3.58 0c1.37-.93 1.97-.74 1.97-.74.39.99.15 1.72.08 1.9.46.51.74 1.15.74 1.94 0 2.77-1.69 3.38-3.3 3.56.26.22.49.66.49 1.33l-.01 1.9c0 .19.13.42.5.34A7.2 7.2 0 0 0 8 .9Z',
        }),
      )
    }

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
    // Crash isolation: a render error becomes diagnostics, not an empty page.
    function WrappedSettingsSection() {
      return h(Boundary, { t: (key) => translateNow(key) }, h(LocalizedSettingsSection))
    }

    function WrappedPanelPage() {
      return h(Boundary, { t: (key) => translateNow(key) }, h(LocalizedPanelPage))
    }

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
      }, WrappedSettingsSection)))

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
      }, WrappedPanelPage))
    }

    return { name, inject, apply }
  },
})
