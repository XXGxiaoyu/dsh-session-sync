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
    const CLIENT_VERSION = '0.5.0'
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
.ss-id{font:var(--dsw-font-xxs-12)/18px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-tertiary)}
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
.ss-btn:disabled{opacity:.45;cursor:not-allowed}
.ss-meta-count{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.ss-item.selected{background:var(--dsw-alias-interactive-bg-hover)}
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
.ss-drop{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}
.ss-drop+.ss-drop{border-top:.5px solid var(--dsw-alias-border-l2)}
.ss-drop.over{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}
.ss-drop-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.ss-self+.ss-field-note{border-top:0}
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
.ss-hashrow{display:flex;align-items:center;gap:6px;min-width:0}
.ss-hash.bad{white-space:normal;word-break:break-all}
.ss-hash-copy{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;padding:0 2px;border-radius:var(--dsw-radius-xs,4px);cursor:pointer}
.ss-hash-copy:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.ss-hash.bad{color:var(--dsw-alias-state-error-primary)}
.ss-navicon{display:flex;align-items:center;justify-content:center}
.ss-check{flex:none;width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.ss-item[draggable="true"]{cursor:grab}
.ss-selectbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;margin:6px 0 2px;padding:0 0 6px;background:transparent}
.ss-selectbar .ss-btn{height:30px;padding:0 12px}
.ss-selectbar .ss-inline{cursor:pointer}
.ss-spacer{flex:1}
.ss-dragghost{position:fixed;top:0;left:0;opacity:0;will-change:transform;pointer-events:none;display:flex;align-items:center;gap:10px;max-width:320px;padding:8px 12px;border-radius:var(--dsw-radius-md,12px);border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1,#232326);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;box-shadow:var(--dsw-elevation-panel,0 8px 24px rgba(0,0,0,.35));z-index:80}
.ss-dragghost[data-show]{opacity:.96}
.ss-dragghost-main{display:flex;flex-direction:column;min-width:0}
.ss-dragghost-title{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e8);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-dragghost-sub{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#7c7c85)}
.ss-dragghost-badge{margin-left:auto;flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover,#ffffff14);border-radius:999px;padding:1px 7px;font-variant-numeric:tabular-nums}
.ss-dnd-tip{position:fixed;z-index:80;pointer-events:none;display:inline-flex;align-items:center;gap:8px;padding:6px 10px 6px 8px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1,#232326) 92%, transparent);box-shadow:var(--dsw-elevation-panel,0 10px 30px rgba(0,0,0,.4));font-size:12px;line-height:18px;max-width:min(460px,84vw);opacity:0;transform:translateY(-2px) scale(.98);transition:opacity .12s var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1)),transform .12s var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));backdrop-filter:blur(10px)}
.ss-dnd-tip[data-show]{opacity:1;transform:none}
.ss-dnd-tip.ws{border-color:color-mix(in srgb, var(--dsw-alias-brand-primary,#4d6bfe) 48%, transparent)}
.ss-dnd-tip.blocked .ss-dnd-ico{color:var(--dsw-alias-label-caption,#66666f)}
.ss-dnd-tip.done{background:var(--dsw-alias-state-success-primary,#3ecf8e);border-color:transparent;color:#08231a;box-shadow:0 12px 32px color-mix(in srgb, var(--dsw-alias-state-success-primary,#3ecf8e) 28%, transparent),var(--dsw-elevation-panel,0 2px 8px rgba(0,0,0,.3))}
.ss-dnd-ico{display:grid;place-items:center;width:16px;height:16px;flex:none;color:var(--dsw-alias-brand-primary,#4d6bfe)}
.ss-dnd-tip.done .ss-dnd-ico{color:#08231a}
.ss-dnd-tip.done .ss-dnd-name{color:#08231a}
.ss-dnd-tip.done .ss-dnd-hint{color:#08231ab8;border-left-color:#08231a33}
.ss-dnd-name{color:var(--dsw-alias-label-primary,#e6e6e8);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-dnd-hint{color:var(--dsw-alias-label-tertiary,#7c7c85);border-left:.5px solid var(--dsw-alias-border-l2);padding-left:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-item.ss-dragging{opacity:.45}
.ss-item.ss-dragging:hover{background:transparent}
.ss-ws-over{background:var(--dsw-alias-interactive-bg-hover)!important;box-shadow:inset 0 0 0 1.5px var(--dsw-alias-brand-primary,#4d6bfe);border-radius:var(--dsw-radius-sm,8px);transition:background-color .12s ease}
.ss-ws-group{background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4d6bfe) 9%, transparent);border-radius:var(--dsw-radius-sm,8px)}
.ss-ws-member{position:relative;background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4d6bfe) 10%, transparent)!important;transition:background-color .12s ease}
.ss-ws-member::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:2px;border-radius:2px;background:var(--dsw-alias-brand-primary,#4d6bfe);opacity:.75;pointer-events:none}
.ss-inline{display:flex;gap:8px;align-items:center;flex:none}
.ss-inline .ss-input{width:240px}

/* --- 0.5.0 panel audit -------------------------------------------------- */
.ss-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.ss-chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;
  border:.5px solid var(--dsw-alias-border-l2,#ffffff26);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1,#1b1b1e) 60%, transparent);
  color:var(--dsw-alias-label-secondary,#a5a5ac);font-size:12px;line-height:1;white-space:nowrap}
.ss-chip .ss-mono{font-size:11.5px}
.ss-chip.ok{color:var(--dsw-alias-state-success-primary,#4ade80);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary,#22c55e) 40%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#22c55e) 12%, transparent)}
.ss-chip.brand{color:var(--dsw-alias-brand-primary,#8ba3ff);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary,#4d6bfe) 40%, transparent);background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4d6bfe) 12%, transparent)}
.ss-chip button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0}

.ss-self{display:flex;align-items:center;gap:10px;padding:14px 16px}
.ss-self-main{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.ss-self-label{color:var(--dsw-alias-label-tertiary,#7c7c85);font-size:12px;line-height:18px;min-width:64px}
.ss-self-meta{margin-top:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#7c7c85)}

.ss-device{border-top:.5px solid var(--dsw-alias-border-l2,#ffffff14)}
.ss-device:first-child{border-top:0}
.ss-device.over{background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4d6bfe) 10%, transparent)}
.ss-device-main{display:flex;align-items:center;gap:10px;padding:14px 16px}
.ss-device-body{flex:1;min-width:0}
.ss-device-name{display:flex;align-items:center;gap:8px;border:0;background:transparent;padding:0;color:var(--dsw-alias-label-primary,#f2f2f3);font:inherit;font-size:15px;line-height:22px;font-weight:500;cursor:pointer;text-align:left}
.ss-device-name:hover{color:var(--dsw-alias-brand-primary,#8ba3ff)}
.ss-device-meta{margin-top:2px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#7c7c85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-device-actions{display:flex;align-items:center;gap:6px;flex:none}
.ss-btn-sm{height:28px;padding:0 10px;font-size:12px}
.ss-menu-wrap{position:relative;display:flex}
.ss-menu{position:absolute;right:0;top:34px;z-index:40;min-width:186px;padding:6px;border-radius:12px;
  border:.5px solid var(--dsw-alias-border-l2,#ffffff26);background:var(--dsw-alias-bg-layer-2,#26262b);
  box-shadow:0 18px 44px #0000009e;display:flex;flex-direction:column;gap:2px}
.ss-menu-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border:0;border-radius:8px;background:transparent;
  color:var(--dsw-alias-label-secondary,#c9c9d1);font:inherit;font-size:12.5px;line-height:18px;text-align:left;cursor:pointer;white-space:nowrap}
.ss-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover,#ffffff12);color:var(--dsw-alias-label-primary,#fff)}
.ss-menu-item.danger{color:#fca5a5}
.ss-menu-item.danger:hover{background:#ef444420;color:#fecaca}

.ss-toolbar{display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:.5px solid var(--dsw-alias-border-l2,#ffffff14);
  background:color-mix(in srgb, var(--dsw-alias-bg-layer-1,#1b1b1e) 50%, transparent);flex-wrap:wrap}
.ss-search{width:230px;height:28px;font-size:12.5px}
.ss-filter{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;cursor:pointer;
  border:.5px solid var(--dsw-alias-border-l2,#ffffff26);background:transparent;color:var(--dsw-alias-label-secondary,#a5a5ac);font:inherit;font-size:12px}
.ss-filter:hover{background:var(--dsw-alias-interactive-bg-hover,#ffffff12)}
.ss-filter.on{color:var(--dsw-alias-label-primary,#fff);border-color:transparent;background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4d6bfe) 22%, transparent)}
.ss-toolbar .ss-spacer{flex:1}

.ss-item-status{flex:none;display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-size:11.5px;line-height:1;
  border:.5px solid var(--dsw-alias-border-l2,#ffffff26);color:var(--dsw-alias-label-tertiary,#7c7c85)}
.ss-item-status.done{color:var(--dsw-alias-state-success-primary,#4ade80);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary,#22c55e) 35%, transparent)}
.ss-item-actions{display:flex;align-items:center;gap:4px;flex:none;opacity:0;transition:opacity var(--ds-transition-duration,.2s) var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1))}
.ss-item:hover .ss-item-actions,.ss-item.selected .ss-item-actions,.ss-item:focus-within .ss-item-actions{opacity:1}
@media (hover:none){.ss-item-actions{opacity:1}}
.ss-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:-2px}
.ss-item.cursor{background:var(--dsw-alias-interactive-bg-hover,#ffffff0f)}
.ss-empty-filtered{padding:18px 16px;color:var(--dsw-alias-label-tertiary,#7c7c85);font-size:13px}

.ss-empty-card{padding:18px 16px;display:flex;flex-direction:column;gap:12px}
.ss-empty-step{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#b9b9c2)}
.ss-empty-num{flex:none;width:18px;height:18px;border-radius:50%;background:#ffffff12;color:var(--dsw-alias-label-secondary,#b9b9c2);
  display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:1px}
.ss-advanced-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 16px;border:0;background:transparent;
  color:var(--dsw-alias-label-secondary,#b9b9c2);font:inherit;font-size:13px;cursor:pointer;border-top:.5px solid var(--dsw-alias-border-l2,#ffffff14)}
.ss-advanced-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,#ffffff0a)}

.ss-queuebar{position:sticky;bottom:0;z-index:3;display:flex;align-items:center;gap:10px;margin-top:12px;padding:9px 14px;border-radius:12px;
  border:.5px solid var(--dsw-alias-border-l2,#ffffff26);background:color-mix(in srgb, var(--dsw-alias-bg-layer-2,#26262b) 92%, transparent);
  backdrop-filter:blur(10px);font-size:12.5px;color:var(--dsw-alias-label-secondary,#c2c2ca)}
.ss-queuebar .ss-spacer{flex:1}
.ss-drawer-mask{position:fixed;inset:0;z-index:70;background:#00000059;display:flex;justify-content:flex-end}
.ss-drawer{width:min(420px,92vw);height:100%;background:var(--dsw-alias-bg-layer-1,#1b1b1e);border-left:.5px solid var(--dsw-alias-border-l2,#ffffff26);
  box-shadow:-24px 0 60px #000000a6;display:flex;flex-direction:column;animation:ss-drawer-in .22s var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1))}
@keyframes ss-drawer-in{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}
.ss-drawer-hd{display:flex;align-items:center;gap:10px;padding:16px;border-bottom:.5px solid var(--dsw-alias-border-l2,#ffffff14)}
.ss-drawer-hd h3{margin:0;font-size:15px;font-weight:600;flex:1}
.ss-drawer-body{flex:1;overflow-y:auto;padding:0 8px 16px}

@media (max-width:860px){
  .ss-device-main{flex-wrap:wrap}
  .ss-device-actions{width:100%;justify-content:flex-end}
  .ss-search{width:100%}
  .ss-page{padding:18px 16px 32px}
}
@media (prefers-reduced-motion:reduce){
  .ss-drawer{animation:none}
  .ss-item-actions{transition:none}
  .ss-btn{transition:none}
}
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
          'sessions.search': '搜索会话…',
          'sessions.filterAll': '全部 {n}',
          'sessions.filterNew': '未拉取 {n}',
          'sessions.filterDone': '已拉取 {n}',
          'sessions.sortTime': '按时间',
          'sessions.sortTitle': '按标题',
          'sessions.notImported': '未拉取',
          'sessions.emptyFiltered': '没有匹配的会话。',
          'sessions.focusHint': '↑↓ 移动 · 空格选择 · 回车拉取',
          'device.menu': '更多操作',
          'device.copyAddress': '复制局域网地址',
          'device.refresh': '刷新会话列表',
          'device.pushHere': '推送本机会话…',
          'device.sessionsCount': '{n} 个会话',
          'notice.addressCopied': '局域网地址已复制',
          'notice.addressCopyFailed': '复制失败，请手动选择地址',
          'settings.advanced': '网络与高级',
          'settings.advancedHint': '端口 · 手动地址 · 跨网段扫描 · 种子地址',
          'settings.ports': '端口',
          'devices.emptyTitle': '让另一台设备也安装这个插件',
          'devices.emptyBody': '同一局域网内会自动发现；跨网段或 VPN 用手动地址。',
          'devices.copyAddress': '复制本机地址',
          'devices.step1': '另一台设备安装并启用「会话同步」',
          'devices.step2': '确认两台设备在同一网段',
          'devices.step3': '仍未发现就填下面的手动地址',
          'devices.manualAdd': '添加',
          'devices.manualPlaceholder': '手动地址，如 10.0.0.8:47801',
          'devices.copyFail': '复制失败，请手动选择地址',
          'queue.title': '传输队列',
          'queue.open': '展开',
          'queue.close': '收起',
          'queue.idle': '暂无传输',
          'queue.summary': '{done} 完成 · {failed} 失败 · {pending} 待处理',
          'page.title': '会话同步',
          'nav.sessionSync': '会话同步',
          'sessions.verify': '校验',
          'sessions.verifying': '正在校验…',
          'sessions.verified': 'sha256 {hash} 校验通过',
          'sessions.copyHash': '复制完整摘要',
          'notice.digestCopied': '完整 sha256 已复制',
          'notice.digestCopyFailed': '复制失败，请手动选择摘要',
          'sessions.hashHint': '摘要只证明两端内容一致，不证明对方身份；需要带外核对时复制完整摘要比对。',
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
              'diag.title': '界面出错了',
          'diag.body': '页面渲染时抛了异常，已在此展示诊断信息，而不是留一个空白面板。',
          'diag.hint': '把下面的内容发到 GitHub issue 即可；点「重新加载」可以先恢复界面。',
          'diag.reload': '重新加载',
          'diag.copy': '复制诊断',
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
          'settings.syncDir': '自动同步目录',
          'settings.syncDirHint': '自动拉取的会话存到哪个目录。默认「未分组」：不归任何工作区；也可以选一个已有工作区，或填一个文件夹路径（不存在会自动创建）。',
          'settings.syncUnsorted': '未分组（不归档到工作区）',
          'settings.syncCustom': '自定义目录',
          'settings.syncCustomPlaceholder': '/Users/you/synced-sessions',
          'settings.syncDirSave': '保存目录',
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
          'notice.syncDirSaved': '同步目录已保存',
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
          'sessions.clearSelection': '清除选择',
          'dnd.dropInto': '放入「{name}」',
          'dnd.intoGroup': '拉取到此分组',
          'dnd.intoGroupArea': '整组可放 · 会话将出现在此分组',
          'dnd.intoUnsorted': '放入插件目录，不归档到工作区',
          'dnd.blocked': '无法放入此处',
          'dnd.blockedHint': '请拖到左侧工作区',
          'dnd.selected': '已选定 {name}',
          'dnd.preparing': '正在准备确认…',
          'dnd.title': '拖到工作区',
          'dnd.hint': '松开后确认要同步的会话；目录不存在会自动创建。',
          'sessions.dropHint': '拖到设备卡片上推送',
          'device.pullAll': '一键同步',
          'device.pushAll': '一键推送',
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
          'sessions.search': 'Search sessions…',
          'sessions.filterAll': 'All {n}',
          'sessions.filterNew': 'New {n}',
          'sessions.filterDone': 'Pulled {n}',
          'sessions.sortTime': 'By time',
          'sessions.sortTitle': 'By title',
          'sessions.notImported': 'Not pulled',
          'sessions.emptyFiltered': 'No session matches this filter.',
          'sessions.focusHint': '↑↓ move · space select · enter pull',
          'device.menu': 'More actions',
          'device.copyAddress': 'Copy LAN address',
          'device.refresh': 'Reload session list',
          'device.pushHere': 'Push local sessions…',
          'device.sessionsCount': '{n} sessions',
          'notice.addressCopied': 'LAN address copied',
          'notice.addressCopyFailed': 'Copy failed — select the address manually',
          'settings.advanced': 'Network & advanced',
          'settings.advancedHint': 'Ports · manual addresses · subnet scan · seeds',
          'settings.ports': 'Ports',
          'devices.emptyTitle': 'Install this plugin on another device',
          'devices.emptyBody': 'Devices on the same LAN discover each other automatically; use a manual address across subnets or VPN.',
          'devices.copyAddress': 'Copy local address',
          'devices.step1': 'Install and enable Session Sync there',
          'devices.step2': 'Make sure both devices share a subnet',
          'devices.step3': 'Still nothing? Add a manual address below',
          'devices.manualAdd': 'Add',
          'devices.manualPlaceholder': 'Manual address, e.g. 10.0.0.8:47801',
          'devices.copyFail': 'Copy failed — select the address manually',
          'queue.title': 'Transfer queue',
          'queue.open': 'Open',
          'queue.close': 'Close',
          'queue.idle': 'Idle',
          'queue.summary': '{done} done · {failed} failed · {pending} pending',
          'page.title': 'Session Sync',
          'nav.sessionSync': 'Session Sync',
          'sessions.verify': 'Verify',
          'sessions.verifying': 'Verifying…',
          'sessions.verified': 'sha256 {hash} verified',
          'sessions.copyHash': 'Copy full digest',
          'notice.digestCopied': 'Full sha256 copied',
          'notice.digestCopyFailed': 'Copy failed — select the digest manually',
          'sessions.hashHint': 'A digest proves the bytes match, not who sent them. Copy the full hash when you need an out-of-band check.',
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
              'diag.title': 'The page hit an error',
          'diag.body': 'Rendering threw. The details are shown here instead of leaving a blank panel.',
          'diag.hint': 'Paste this into a GitHub issue; “Reload” usually brings the UI back.',
          'diag.reload': 'Reload',
          'diag.copy': 'Copy diagnostics',
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
          'settings.syncDir': 'Auto-sync folder',
          'settings.syncDirHint': 'Where auto-pulled sessions land. “Ungrouped” keeps them outside every workspace; pick an existing workspace, or type a folder path (created on save).',
          'settings.syncUnsorted': 'Ungrouped (no workspace)',
          'settings.syncCustom': 'Custom folder',
          'settings.syncCustomPlaceholder': '/Users/you/synced-sessions',
          'settings.syncDirSave': 'Save folder',
          'dnd.title': 'Drop into a workspace',
          'dnd.intoGroup': 'Pull into this group',
          'dnd.intoGroupArea': 'Whole group accepts the drop',
          'dnd.intoUnsorted': 'Goes to the plugin folder, stays ungrouped',
          'dnd.blocked': 'Cannot drop here',
          'dnd.blockedHint': 'Drag onto the sidebar',
          'dnd.hint': 'Release, then confirm the sessions; missing folders are created.',
          'dnd.selected': 'Target: {name}',
          'dnd.preparing': 'Preparing the confirmation…',
          'notice.syncDirSaved': 'Sync folder saved',
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
          'sessions.clearSelection': 'Clear',
          'dnd.dropInto': 'Drop into “{name}”',
          'sessions.dropHint': 'Drag onto a device to push',
          'device.pullAll': 'Pull all',
          'device.pushAll': 'Push all',
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

    /** Clipboard write with a textarea fallback for browsers without the async API. */
    async function copyText(value) {
      try {
        if (navigator.clipboard?.writeText !== undefined) {
          await navigator.clipboard.writeText(value)
          return true
        }
      } catch { /* fall through to the legacy path */ }
      try {
        const area = document.createElement('textarea')
        area.value = value
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        area.remove()
        return ok === true
      } catch {
        return false
      }
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
        // Never keep a headless runtime (tests, SSR) alive just for the poll.
        timer?.unref?.()
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

    /** Drag image: title, event count and a selection badge, painted by DSH tokens. */
    function dragGhost(payload) {
      if (typeof document === 'undefined' || document.body === null) return null
      const node = document.createElement('div')
      node.className = 'ss-dragghost'
      const ico = document.createElement('span')
      ico.className = 'ss-dnd-ico'
      ico.textContent = '▤'
      const main = document.createElement('div')
      main.className = 'ss-dragghost-main'
      const title = document.createElement('span')
      title.className = 'ss-dragghost-title'
      const sub = document.createElement('span')
      sub.className = 'ss-dragghost-sub'
      main.append(title, sub)
      node.append(ico, main)
      const count = payload.ids?.length ?? 1
      title.textContent = payload.titles?.[0] || translateNow('sessions.untitled')
      sub.textContent = payload.direction === 'pull'
        ? translateNow('dnd.ghostPull', { count: String(count) })
        : translateNow('dnd.ghostPush', { count: String(count) })
      if (count > 1) {
        const badge = document.createElement('span')
        badge.className = 'ss-dragghost-badge'
        badge.textContent = `+${count - 1}`
        node.append(badge)
      }
      document.body.append(node)
      return node
    }

    let ghostNode = null

    /** Native drag images are painted by the compositor and collide with our pill; hide it. */
    const BLANK_DRAG_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

    function blankDragImage() {
      const img = document.createElement('img')
      img.src = BLANK_DRAG_IMAGE
      img.width = 1
      img.height = 1
      img.style.cssText = 'position:fixed;top:-10px;left:-10px;width:1px;height:1px'
      return img
    }

    function placeGhost(event) {
      if (ghostNode === null) return
      const x = Math.min(event.clientX + 16, (window.innerWidth ?? 1440) - 340)
      const y = Math.min(event.clientY + 12, (window.innerHeight ?? 900) - 120)
      ghostNode.style.transform = `translate(${x}px, ${y}px)`
      ghostNode.dataset.show = '1'
    }

    function clearGhost() {
      ghostNode?.remove()
      ghostNode = null
    }

    function beginDrag(event, payload) {
      dragStore.set(payload)
      const source = event.currentTarget
      if (source !== null && source.classList !== undefined) {
        source.classList.add('ss-dragging')
        const clear = () => {
          source.classList.remove('ss-dragging')
          source.removeEventListener('dragend', clear)
        }
        source.addEventListener('dragend', clear)
      }
      try {
        event.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
        event.dataTransfer.setData('text/plain', (payload.titles ?? []).join('\n'))
        event.dataTransfer.effectAllowed = 'copy'
        clearGhost()
        ghostNode = dragGhost(payload)
        const blank = blankDragImage()
        document.body.append(blank)
        event.dataTransfer.setDragImage(blank, 0, 0)
        setTimeout(() => blank.remove(), 0)
        placeGhost(event)
      } catch {
        /* some browsers refuse custom MIME types; the drop just does nothing */
      }
    }

    const dragListeners = new Set()
    let dragState = null
    let dragHandler = null
    const dragStore = {
      subscribe(listener) {
        dragListeners.add(listener)
        return () => dragListeners.delete(listener)
      },
      get() {
        return dragState
      },
      set(payload) {
        dragState = payload
        for (const listener of dragListeners) listener()
      },
      clear() {
        if (dragState === null) return
        dragState = null
        for (const listener of dragListeners) listener()
      },
      setHandler(handler) {
        dragHandler = handler
        // Returning an owner-checked disposer keeps a page that unmounts later
        // from clearing the handler a still-mounted page registered.
        return () => {
          if (dragHandler === handler) dragHandler = null
        }
      },
      drop(cwd) {
        const payload = dragState
        if (payload === null) return
        dragState = null
        for (const listener of dragListeners) listener()
        dragHandler?.(payload, cwd)
      },
    }

    /**
     * Patch the real sidebar instead of painting our own column: DSH already
     * renders `[data-row-key="workspace:<key>"]` rows, so a capture-phase
     * listener can light up the row under the pointer and take the drop. The
     * official markup, classes and React tree stay exactly as they are.
     */
    /** Set by the visible session list so `/` can focus its search box. */
    const focusSearch = { current: null }

    const sidebarDrop = {
      resolver: null,
      row: null,
      setResolver(resolver) {
        this.resolver = resolver
        return () => {
          if (this.resolver === resolver) this.resolver = null
        }
      },
    }

    /** Every workspace header, in document order. Nested lists stay ordered the same way they read. */
    function workspaceHeaders() {
      return [...document.querySelectorAll('[data-row-key^="workspace:"]')]
    }

    /**
     * Smallest box that holds this header (and, when given, the row the pointer
     * is over). DSH nests a group as <section><header/><span><row/></span></section>,
     * so the container is a real ancestor rather than a sibling.
     */
    function groupContainerOf(header, row = header) {
      let node = row.parentElement
      while (node !== null) {
        if (node.contains(header) && node.querySelectorAll('[data-row-key^="workspace:"]').length <= 1) return node
        node = node.parentElement
      }
      return header.parentElement
    }

    /** Walk back to the workspace header that owns this row (session/overflow rows count). */
    function ownerWorkspaceRow(row) {
      if (row === null) return null
      const key = row.getAttribute?.('data-row-key') ?? ''
      if (key.startsWith('workspace:')) return row
      let owner = null
      for (const header of workspaceHeaders()) {
        if (header === row) break
        if ((header.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) break
        owner = header
      }
      if (owner === null) return null
      const container = groupContainerOf(owner, row)
      if (container !== null && !container.contains(row)) return null
      // A row in a later group's gutter must not inherit the previous header.
      const newer = [...container.querySelectorAll('[data-row-key^="workspace:"]')]
        .some((header) => header !== owner && (header.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
      return newer ? null : owner
    }

    /** Tint the header, its container and every expanded row underneath. */
    function markGroup(headerRow, on) {
      if (headerRow === null) return
      headerRow.classList.toggle('ss-ws-over', on)
      groupContainerOf(headerRow)?.classList.toggle('ss-ws-group', on)
      const rows = [...document.querySelectorAll('[data-row-key]')]
      const start = rows.indexOf(headerRow)
      if (start < 0) return
      for (let index = start + 1; index < rows.length; index += 1) {
        const row = rows[index]
        const key = row.getAttribute('data-row-key') ?? ''
        if (key.startsWith('workspace:')) break
        row.classList.toggle('ss-ws-member', on)
      }
    }

    function workspaceRowTarget(row) {
      const owner = ownerWorkspaceRow(row)
      if (owner === null) return null
      const raw = owner.getAttribute('data-row-key') ?? ''
      if (!raw.startsWith('workspace:')) return null
      const key = raw.slice('workspace:'.length)
      const view = sidebarDrop.resolver?.() ?? {}
      const onHeader = row === owner
      if (key === '') {
        return typeof view.unsortedDir === 'string' && view.unsortedDir.length > 0
          ? {
            path: view.unsortedDir,
            label: translateNow('settings.syncUnsorted'),
            mode: 'plain',
            hint: translateNow('dnd.intoUnsorted'),
          }
          : null
      }
      const match = (view.workspaces ?? []).find((workspace) => workspace.id === key || workspace.path === key)
      if (match !== undefined && typeof match.path === 'string' && match.path.length > 0) {
        return {
          path: match.path,
          label: match.title || match.path,
          mode: 'ws',
          hint: translateNow(onHeader ? 'dnd.intoGroup' : 'dnd.intoGroupArea'),
        }
      }
      return /^(?:\/|[A-Za-z]:[\\/])/.test(key) ? { path: key, label: key } : null
    }

    /** Pointer pill: icon + target name + what will happen. */
    const dropTip = { node: null, ico: null, name: null, hint: null, mode: null, hideAt: 0 }

    function ensureDropTip() {
      if (dropTip.node !== null) return dropTip.node
      const node = document.createElement('div')
      node.className = 'ss-dnd-tip'
      const ico = document.createElement('span')
      ico.className = 'ss-dnd-ico'
      ico.textContent = '▣'
      const name = document.createElement('span')
      name.className = 'ss-dnd-name'
      const hint = document.createElement('span')
      hint.className = 'ss-dnd-hint'
      node.append(ico, name, hint)
      document.body.append(node)
      dropTip.node = node
      dropTip.ico = ico
      dropTip.name = name
      dropTip.hint = hint
      return node
    }

    function showDropTip(event, target) {
      if (typeof document === 'undefined' || document.body === null) return
      const node = ensureDropTip()
      const mode = target.mode ?? 'ws'
      if (dropTip.mode !== mode) {
        node.classList.toggle('ws', mode === 'ws')
        node.classList.toggle('blocked', mode === 'blocked')
        node.classList.toggle('done', mode === 'done')
        dropTip.ico.textContent = mode === 'blocked' ? '⊘' : mode === 'done' ? '✓' : '▣'
        dropTip.mode = mode
      }
      dropTip.name.textContent = target.label ?? ''
      dropTip.hint.textContent = target.hint ?? ''
      dropTip.node.style.left = `${Math.min(event.clientX + 18, (window.innerWidth ?? 1440) - 240)}px`
      dropTip.node.style.top = `${event.clientY + 60}px`
      clearTimeout(dropTip.hideAt)
      dropTip.node.dataset.show = '1'
    }

    function hideDropTip(delay = 0) {
      if (dropTip.node === null) return
      clearTimeout(dropTip.hideAt)
      if (delay === 0) {
        delete dropTip.node.dataset.show
        return
      }
      dropTip.hideAt = setTimeout(() => {
        if (dropTip.node !== null) delete dropTip.node.dataset.show
      }, delay)
    }

    function clearRowMark() {
      if (sidebarDrop.row !== null) {
        markGroup(sidebarDrop.row, false)
        sidebarDrop.row.classList.remove('ss-ws-over')
      }
      sidebarDrop.row = null
    }

    function installSidebarDrop() {
      if (typeof document?.addEventListener !== 'function') return () => {}
      const pulledDrag = () => {
        const drag = dragStore.get()
        return drag !== null && drag.direction === 'pull' ? drag : null
      }
      const rowOf = (event) => event.target?.closest?.('[data-row-key]') ?? null
      const onOver = (event) => {
        placeGhost(event)
        if (pulledDrag() === null) {
          clearRowMark()
          return
        }
        const row = rowOf(event)
        const target = row === null ? null : workspaceRowTarget(row)
        if (target === null) {
          clearRowMark()
          showDropTip(event, { mode: 'blocked', label: translateNow('dnd.blocked'), hint: translateNow('dnd.blockedHint') })
          return
        }
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        const owner = ownerWorkspaceRow(row)
        if (sidebarDrop.row !== owner) {
          clearRowMark()
          sidebarDrop.row = owner
        }
        markGroup(owner, true)
        showDropTip(event, target)
      }
      const onDrop = (event) => {
        const row = rowOf(event) ?? sidebarDrop.row
        const target = row === null ? null : workspaceRowTarget(row)
        clearRowMark()
        clearGhost()
        if (target === null || pulledDrag() === null) {
          hideDropTip()
          return
        }
        event.preventDefault()
        event.stopPropagation()
        showDropTip(event, {
          mode: 'done',
          label: translateNow('dnd.selected', { name: target.label }),
          hint: translateNow('dnd.preparing'),
        })
        setTimeout(() => {
          hideDropTip()
          dragStore.drop(target.path)
        }, 90)
      }
      const onEnd = () => {
        clearRowMark()
        hideDropTip()
        clearGhost()
        dragStore.clear()
      }
      document.addEventListener('dragover', onOver, true)
      document.addEventListener('drop', onDrop, true)
      document.addEventListener('dragend', onEnd, true)
      return () => {
        document.removeEventListener('dragover', onOver, true)
        document.removeEventListener('drop', onDrop, true)
        document.removeEventListener('dragend', onEnd, true)
        clearRowMark()
        hideDropTip()
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

    function DeviceRow({
      t,
      peer,
      busy,
      imports,
      open,
      onToggleOpen,
      onRename,
      onForget,
      onRefresh,
      onPush,
      onSyncAll,
      onCopyAddress,
      dropActive,
      onDrop,
    }) {
      const [editing, setEditing] = React.useState(false)
      const [draft, setDraft] = React.useState(peer.customName ?? peer.remoteName ?? '')
      const [menu, setMenu] = React.useState(false)
      const menuRef = React.useRef(null)
      React.useEffect(() => {
        if (!editing) setDraft(peer.customName ?? peer.remoteName ?? '')
      }, [editing, peer.customName, peer.remoteName])
      React.useEffect(() => {
        if (!menu) return undefined
        const close = (event) => {
          if (menuRef.current !== null && !menuRef.current.contains(event.target)) setMenu(false)
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
      }, [menu])
      const commit = () => {
        setEditing(false)
        onRename(peer, draft.trim())
      }
      const pullCount = imports.filter((entry) => entry.peerId === peer.id).length
      const meta = [
        peer.address === undefined || peer.address === null
          ? null
          : `${peer.address}${peer.port === undefined || peer.port === null ? '' : `:${peer.port}`}`,
        peer.platform ?? null,
        peer.version === undefined || peer.version === null ? null : `v${peer.version}`,
        typeof peer.sessions === 'number' ? t('device.sessionsCount', { n: peer.sessions }) : null,
        peer.online ? t('status.online') : t('device.lastSeen', { when: relativeTime(t, peer.lastSeen) }),
      ].filter((part) => part !== null).join(' · ')
      return h('div', {
        className: `ss-device${dropActive ? ' over' : ''}`,
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
        h('div', { className: 'ss-device-main' },
          h('span', { className: `ss-dot${peer.online ? ' on' : ''}`, title: peer.online ? t('status.online') : t('status.offline') }),
          h('div', { className: 'ss-device-body' },
            editing
              ? h('div', { className: 'ss-inline', style: { flex: 1 } },
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
                h('button', { type: 'button', className: 'ss-btn primary ss-btn-sm', onClick: commit }, t('common.save')),
                h('button', { type: 'button', className: 'ss-btn ghost ss-btn-sm', onClick: () => setEditing(false) }, t('common.cancel')),
              )
              : h('button', {
                type: 'button',
                className: 'ss-device-name',
                title: open ? t('sessions.hide') : t('sessions.show'),
                onClick: () => onToggleOpen?.(peer),
              },
                peer.name,
                peer.customName !== null && peer.customName !== undefined ? h('span', { className: 'ss-badge' }, t('device.renamed')) : null,
                pullCount > 0 ? h('span', { className: 'ss-badge' }, t('device.pulled', { n: pullCount })) : null,
              ),
            h('div', { className: 'ss-device-meta', title: meta }, meta),
          ),
          h('div', { className: 'ss-device-actions' },
            h('button', {
              type: 'button',
              className: 'ss-btn primary ss-btn-sm',
              disabled: busy || !peer.online,
              onClick: () => onSyncAll?.(peer),
            }, t('device.pullAll')),
            h('div', { className: 'ss-menu-wrap', ref: menuRef },
              h('button', {
                type: 'button',
                className: 'ss-btn ghost ss-btn-sm',
                'aria-label': t('device.menu'),
                'aria-expanded': menu,
                disabled: busy,
                onClick: () => setMenu((value) => !value),
              }, '⋯'),
              menu
                ? h('div', { className: 'ss-menu', role: 'menu' },
                  h('button', { type: 'button', className: 'ss-menu-item', onClick: () => { setMenu(false); onPush?.(peer) } }, t('device.pushHere')),
                  h('button', { type: 'button', className: 'ss-menu-item', onClick: () => { setMenu(false); setEditing(true) } }, t('device.rename')),
                  h('button', { type: 'button', className: 'ss-menu-item', onClick: () => { setMenu(false); onCopyAddress?.(peer) } }, t('device.copyAddress')),
                  h('button', { type: 'button', className: 'ss-menu-item', onClick: () => { setMenu(false); onRefresh?.(peer) } }, t('device.refresh')),
                  h('button', { type: 'button', className: 'ss-menu-item danger', onClick: () => { setMenu(false); onForget(peer) } }, t('device.forget')),
                )
                : null,
            ),
          ),
        ),
      )
    }

    /** Rows shared by the peer list and the local push list. */
    function SessionList({
      t,
      sessions,
      digests,
      onCopyDigest,
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
      selectionActions,
      onClearSelection,
      targetLabel,
    }) {
      const [query, setQuery] = React.useState('')
      const [filter, setFilter] = React.useState('all')
      const [sort, setSort] = React.useState('time')
      const [cursor, setCursor] = React.useState(-1)
      const searchRef = React.useRef(null)
      React.useEffect(() => {
        focusSearch.current = () => searchRef.current?.focus()
        return () => {
          if (focusSearch.current !== null) focusSearch.current = null
        }
      }, [])
      const importedCount = sessions.filter((session) => session.imported !== null && session.imported !== undefined).length
      const freshCount = sessions.length - importedCount
      const needle = query.trim().toLowerCase()
      const visible = sessions
        .filter((session) => {
          if (filter === 'new' && session.imported !== null && session.imported !== undefined) return false
          if (filter === 'done' && (session.imported === null || session.imported === undefined)) return false
          if (needle === '') return true
          return `${session.title ?? ''} ${sessionTag(session)} ${session.cwd ?? ''}`.toLowerCase().includes(needle)
        })
        .sort((a, b) => {
          if (sort === 'title') return (a.title ?? '').localeCompare(b.title ?? '')
          return (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
        })

      const onKeyDown = (event) => {
        if (visible.length === 0) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const next = event.key === 'ArrowDown'
            ? Math.min(visible.length - 1, cursor + 1)
            : Math.max(0, cursor - 1)
          setCursor(next)
          return
        }
        const session = visible[Math.max(0, cursor)]
        if (session === undefined) return
        if (event.key === ' ' && selectable === true) {
          event.preventDefault()
          onToggle?.(session.id, event)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          if (session.imported !== null && session.imported !== undefined) onVerify?.(session)
          else onPull?.(session)
        }
      }

      if (sessions.length === 0) {
        return h('div', { className: 'ss-empty' }, t(emptyKey ?? 'sessions.empty'))
      }
      const allSelected = selectable === true && visible.length > 0 && visible.every((session) => selected.includes(session.id))
      return h('div', { className: 'ss-list' },
        selectable
          ? h('div', { className: 'ss-selectbar' },
            h('label', { className: 'ss-inline' },
              h(Check, { checked: allSelected, label: t('sessions.selectAll'), onChange: () => onToggleAll(visible.map((session) => session.id)) }),
              h('span', { className: 'ss-meta-count' }, t('sessions.selected', { n: selected.length })),
            ),
            h('div', { className: 'ss-spacer' }),
            targetLabel === undefined || targetLabel === null
              ? null
              : h('span', { className: 'ss-chip' }, `${t('sessions.pull')} · ${targetLabel}`),
            Array.isArray(selectionActions)
              ? selectionActions.map((action) => h('button', {
                key: action.label,
                type: 'button',
                className: 'ss-btn primary ss-btn-sm',
                disabled: selected.length === 0,
                onClick: action.onClick,
              }, action.label))
              : null,
            h('button', {
              type: 'button',
              className: 'ss-btn ghost ss-btn-sm',
              disabled: selected.length === 0,
              onClick: () => onClearSelection?.(),
            }, t('sessions.clearSelection')),
          )
          : null,
        selectable
          ? h('div', { className: 'ss-toolbar' },
            h('input', {
              ref: searchRef,
              className: 'ss-input ss-search',
              value: query,
              spellCheck: false,
              placeholder: t('sessions.search'),
              'aria-label': t('sessions.search'),
              onChange: (event) => { setQuery(event.target.value); setCursor(-1) },
            }),
            h('button', {
              type: 'button',
              className: `ss-filter${filter === 'all' ? ' on' : ''}`,
              onClick: () => setFilter('all'),
            }, t('sessions.filterAll', { n: sessions.length })),
            h('button', {
              type: 'button',
              className: `ss-filter${filter === 'new' ? ' on' : ''}`,
              onClick: () => setFilter('new'),
            }, t('sessions.filterNew', { n: freshCount })),
            h('button', {
              type: 'button',
              className: `ss-filter${filter === 'done' ? ' on' : ''}`,
              onClick: () => setFilter('done'),
            }, t('sessions.filterDone', { n: importedCount })),
            h('div', { className: 'ss-spacer' }),
            h('button', {
              type: 'button',
              className: 'ss-filter',
              title: t('sessions.focusHint'),
              onClick: () => setSort((value) => (value === 'time' ? 'title' : 'time')),
            }, t(sort === 'time' ? 'sessions.sortTime' : 'sessions.sortTitle')),
          )
          : null,
        visible.length === 0
          ? h('div', { className: 'ss-empty-filtered' }, t('sessions.emptyFiltered'))
          : null,
        visible.map((session, index) => {
          const imported = session.imported ?? null
          const digest = digests?.[session.id] ?? null
          const isSelected = selectable === true && selected.includes(session.id)
          return h('div', {
            className: `ss-item${isSelected ? ' selected' : ''}${cursor === index ? ' cursor' : ''}`,
            key: session.id,
            tabIndex: 0,
            draggable: true,
            onDragStart: (event) => onDragStart?.(event, session),
            onDragEnd: () => dragStore.clear(),
            onFocus: () => setCursor(index),
            onKeyDown,
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
                : h('div', { className: 'ss-hashrow' },
                  h('span', {
                    className: `ss-hash${digest.verified === false ? ' bad' : digest.verified ? ' ok' : ''}`,
                    title: digest.sha256,
                  },
                    t(digest.verified === null ? 'sessions.noDigest' : digest.verified ? 'sessions.verified' : 'sessions.verifyFailed', {
                      // A failed check shows the whole digest: that is the value a
                      // human needs to compare out-of-band.
                      hash: digest.verified === false ? digest.sha256 : `${digest.sha256.slice(0, 12)}…`,
                    }),
                  ),
                  onCopyDigest === undefined
                    ? null
                    : h('button', {
                      type: 'button',
                      className: 'ss-hash-copy',
                      title: t('sessions.hashHint'),
                      'aria-label': t('sessions.copyHash'),
                      onClick: (event) => {
                        event.stopPropagation()
                        onCopyDigest(session)
                      },
                    }, t('sessions.copyHash')),
                ),
            ),
            h('span', { className: `ss-item-status${imported !== null ? ' done' : ''}` }, t(imported !== null ? 'sessions.imported' : 'sessions.notImported')),
            h('div', { className: 'ss-item-actions' },
              onVerify === undefined
                ? null
                : h('button', {
                  type: 'button',
                  className: 'ss-btn ghost ss-btn-sm',
                  disabled: digest?.busy === true,
                  onClick: () => onVerify(session),
                }, t('sessions.verify')),
              imported !== null
                ? h('button', { type: 'button', className: 'ss-btn ghost ss-btn-sm', onClick: () => onForgetImport(session) }, t('common.clear'))
                : (onPull === undefined ? null
                  : h('button', { type: 'button', className: 'ss-btn ss-btn-sm', onClick: () => onPull(session) }, t(pullLabel ?? 'sessions.pull'))),
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
      const snapshotRef = React.useRef(snapshot)
      snapshotRef.current = snapshot
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [selfName, setSelfName] = React.useState('')
      const selfDirty = React.useRef(false)
      const [seeds, setSeeds] = React.useState('')
      const seedsDirty = React.useRef(false)
      const [subnets, setSubnets] = React.useState('')
      const subnetsDirty = React.useRef(false)
      const [syncDraft, setSyncDraft] = React.useState('')
      const syncDraftDirty = React.useRef(false)
      const [openPeer, setOpenPeer] = React.useState(null)
      const [peerSessions, setPeerSessions] = React.useState({})
      const [localSessions, setLocalSessions] = React.useState(null)
      const [pushTarget, setPushTarget] = React.useState(null)
      const [digests, setDigests] = React.useState({})
      const [selected, setSelected] = React.useState([])
      const [plan, setPlan] = React.useState(null)
      const [queue, setQueue] = React.useState([])
      const [queueOpen, setQueueOpen] = React.useState(false)
      const [advancedOpen, setAdvancedOpen] = React.useState(false)
      const [manualAddress, setManualAddress] = React.useState('')
      const [dropPeer, setDropPeer] = React.useState(null)
      const [dropPath, setDropPath] = React.useState(null)
      const [extraPaths, setExtraPaths] = React.useState([])
      const [pathDraft, setPathDraft] = React.useState('')
      const anchor = React.useRef(null)
      const queueRef = React.useRef([])
      const running = React.useRef(false)
      const override = useOverride()

      React.useEffect(() => {
        const onKey = (event) => {
          const tag = typeof event.target?.tagName === 'string' ? event.target.tagName : ''
          const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
          if (event.key === '/' && !typing) {
            if (focusSearch.current !== null) {
              event.preventDefault()
              focusSearch.current()
            }
            return
          }
          if (event.key === 'Escape') {
            setSelected([])
            setQueueOpen(false)
            return
          }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !typing && openPeer !== null) {
            const sessions = peerSessions[openPeer]
            if (Array.isArray(sessions)) {
              event.preventDefault()
              setSelected(sessions.map((session) => session.id))
            }
          }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [openPeer, peerSessions])

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
      const syncDir = typeof snapshot.settings?.syncDir === 'string' ? snapshot.settings.syncDir : ''
      React.useEffect(() => {
        if (!syncDraftDirty.current) setSyncDraft(syncDir)
      }, [syncDir])
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
      const saveSyncDir = (dir) => run('notice.syncDirSaved', async () => {
        const body = await api('settings', { patch: { syncDir: dir } })
        syncDraftDirty.current = false
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

      const copyDigest = async (session) => {
        const digest = digests[session.id]?.sha256
        if (typeof digest !== 'string' || digest.length === 0) return
        const ok = await copyText(digest)
        setNotice({ kind: ok ? 'ok' : 'error', key: ok ? 'notice.digestCopied' : 'notice.digestCopyFailed' })
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

      // The drop layer lives in a different slot; route its drops back into the
      // page that owns peer sessions and the confirmation dialog.
      React.useEffect(() => {
        const releaseHandler = dragStore.setHandler((payload, cwd) => {
          const peer = peerById(payload.peerId)
          if (peer === null) return
          openPullPlan(peer, payload.ids, cwd)
        })
        // The sidebar rows live in another plugin's slot, so expose the folder
        // table the document-level drop handler needs to resolve a row.
        const releaseResolver = sidebarDrop.setResolver(() => ({
          workspaces: snapshotRef.current.workspaces ?? [],
          unsortedDir: snapshotRef.current.unsortedDir ?? '',
        }))
        return () => {
          releaseHandler()
          releaseResolver()
        }
      })

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
      // One IP is one device: drop this machine's own address, and collapse peers
      // that share an address (two profiles on one box) into the freshest row.
      const byAddress = new Map()
      for (const peer of peers) {
        if (peer.sameMachine === true) continue
        const key = peer.address ?? peer.id
        const current = byAddress.get(key)
        if (current === undefined) { byAddress.set(key, peer); continue }
        const better = (peer.online === true ? 2 : 0) + (peer.lastSeen ?? 0) > (current.online === true ? 2 : 0) + (current.lastSeen ?? 0)
        if (better) byAddress.set(key, peer)
      }
      const remotePeers = [...byAddress.values()]
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

      const selfAddress = typeof snapshot.self?.ip === 'string'
        ? `${snapshot.self.ip}:${snapshot.ports?.discovery ?? '—'}`
        : ''
      const targetLabel = (() => {
        const dir = snapshot.syncDir ?? ''
        if (dir === '') return t('settings.syncUnsorted')
        const parts = String(dir).split(/[\\/]/).filter((part) => part.length > 0)
        return parts[parts.length - 1] ?? dir
      })()
      const copySelfAddress = async () => {
        const ok = await copyText(selfAddress)
        setNotice({ kind: ok ? 'ok' : 'error', key: ok ? 'notice.addressCopied' : 'notice.addressCopyFailed' })
      }
      const addManualAddress = async () => {
        const value = manualAddress.trim()
        if (value === '') return
        await run('notice.seedsSaved', () => api('settings', {
          patch: { seeds: [...(snapshot.settings?.seeds ?? []), value] },
        }))
        setManualAddress('')
      }

      return h('div', { className: 'ss-root' },
        h('div', { className: 'ss-head' },
          h('div', null,
            h('div', { className: 'ss-title' }, t('page.title')),
            h('div', { className: 'ss-chips' },
              h('span', { className: `ss-chip${online > 0 ? ' ok' : ''}` },
                h('span', { className: `ss-dot${online > 0 ? ' on' : ''}` }),
                t('page.subtitle', { online, total: remotePeers.length }),
              ),
              snapshot.ports === undefined
                ? null
                : h('span', { className: 'ss-chip' }, t('page.ports', { lan: snapshot.ports.lan ?? '—', discovery: snapshot.ports.discovery ?? '—' })),
              typeof snapshot.self?.ip !== 'string'
                ? null
                : h('span', { className: 'ss-chip' },
                  h('span', { style: { fontFamily: 'var(--ds-font-family-code, ui-monospace, monospace)' } },
                    `${snapshot.self.ip}:${snapshot.self.port ?? '—'}`),
                ),
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
          h('div', { className: 'ss-card' },
            h('div', { className: 'ss-self' },
              h('span', { className: 'ss-dot on' }),
              h('div', { className: 'ss-self-main' },
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { className: 'ss-inline' },
                    h('span', { className: 'ss-self-label' }, t('self.name')),
                    h('input', {
                      className: 'ss-input',
                      style: { width: 210 },
                      value: selfName,
                      spellCheck: false,
                      'aria-label': t('self.name'),
                      onChange: (event) => { selfDirty.current = true; setSelfName(event.target.value) },
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') void saveSelfName()
                      },
                    }),
                    h('button', { type: 'button', className: 'ss-btn primary ss-btn-sm', disabled: busy || selfName.trim().length === 0, onClick: () => void saveSelfName() }, t('common.save')),
                  ),
                  h('div', { className: 'ss-self-meta' },
                    [
                      typeof snapshot.self?.ip === 'string' ? `${snapshot.self.ip}:${snapshot.self.port ?? '—'}` : null,
                      snapshot.platform ?? null,
                      snapshot.version === undefined ? null : `v${snapshot.version}`,
                    ].filter((part) => part !== null).join(' · '),
                  ),
                ),
              ),
            ),
            h('div', { className: 'ss-field-note', style: { padding: '0 16px 14px 42px' } }, t('self.hint')),
          ),
        ),

        // devices
        h('section', { className: 'ss-section' },
          h('div', { className: 'ss-section-hd' },
            h('span', { className: 'ss-section-title' }, t('devices.title')),
            h('span', { className: 'ss-meta' }, t('devices.count', { online, total: remotePeers.length })),
          ),
          h('div', { className: 'ss-card' },
            remotePeers.length === 0
              ? h('div', { className: 'ss-empty-card' },
                h('div', { className: 'ss-field-label' }, t('devices.emptyTitle')),
                h('div', { className: 'ss-field-note' }, t('devices.emptyBody')),
                h('div', { className: 'ss-empty-step' }, h('span', { className: 'ss-empty-num' }, '1'), t('devices.step1')),
                h('div', { className: 'ss-empty-step' }, h('span', { className: 'ss-empty-num' }, '2'), t('devices.step2')),
                h('div', { className: 'ss-empty-step' }, h('span', { className: 'ss-empty-num' }, '3'), t('devices.step3')),
                h('div', { className: 'ss-inline' },
                  h('input', {
                    className: 'ss-input',
                    readOnly: true,
                    value: selfAddress,
                    'aria-label': t('devices.copyAddress'),
                    onFocus: (event) => event.target.select(),
                  }),
                  h('button', { type: 'button', className: 'ss-btn ss-btn-sm', onClick: () => void copySelfAddress() }, t('devices.copyAddress')),
                ),
                h('div', { className: 'ss-inline' },
                  h('input', {
                    className: 'ss-input',
                    value: manualAddress,
                    spellCheck: false,
                    placeholder: t('devices.manualPlaceholder'),
                    'aria-label': t('devices.manualPlaceholder'),
                    onChange: (event) => setManualAddress(event.target.value),
                    onKeyDown: (event) => { if (event.key === 'Enter') void addManualAddress() },
                  }),
                  h('button', { type: 'button', className: 'ss-btn primary ss-btn-sm', disabled: busy || manualAddress.trim() === '', onClick: () => void addManualAddress() }, t('devices.manualAdd')),
                ),
              )
              : remotePeers.map((peer) => h('div', { key: peer.id },
                h(DeviceRow, {
                  t,
                  peer,
                  busy,
                  imports,
                  open: openPeer === peer.id,
                  onToggleOpen: (target) => {
                    if (openPeer === target.id) {
                      setOpenPeer(null)
                      return
                    }
                    void loadPeerSessions(target)
                  },
                  onRename: renamePeer,
                  onForget: forgetPeer,
                  onRefresh: (target) => { void reloadPeer(target.id).catch(() => {}) },
                  onPush: (target) => { void openPush(target) },
                  onSyncAll: async (target) => {
                    try {
                      const sessions = peerSessions[target.id] ?? await reloadPeer(target.id)
                      setOpenPeer(target.id)
                      openPullPlan(target, sessions.map((session) => session.id), null)
                    } catch (error) {
                      setNotice({ kind: 'error', text: String(error?.message ?? error) })
                    }
                  },
                  onCopyAddress: async (target) => {
                    const ok = await copyText(`${target.address ?? ''}${target.port === undefined || target.port === null ? '' : `:${target.port}`}`)
                    setNotice({ kind: ok ? 'ok' : 'error', key: ok ? 'notice.addressCopied' : 'notice.addressCopyFailed' })
                  },
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
                openPeer === peer.id
                  ? (peerSessions[peer.id] === undefined
                    ? h('div', { className: 'ss-empty' }, t('common.loading'))
                    : h(React.Fragment, null,
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
                        onCopyDigest: (session) => void copyDigest(session),
                        onPull: (session) => openPullPlan(peer, [session.id], null),
                        targetLabel,
                        selectionActions: [{
                          label: t('sessions.syncSelected'),
                          onClick: () => openPullPlan(peer, selected, null),
                        }],
                        onClearSelection: () => setSelected([]),
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
          ),
          h('div', { className: 'ss-hint' }, t('devices.hint')),
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

        queue.length === 0
          ? null
          : h('div', { className: 'ss-queuebar' },
            h('span', { className: `ss-chip${queue.some((item) => item.status === 'running') ? ' brand' : ''}` },
              t('queue.summary', {
                done: queue.filter((item) => item.status === 'done').length,
                failed: queue.filter((item) => item.status === 'failed').length,
                pending: queue.filter((item) => item.status === 'pending' || item.status === 'running').length,
              }),
            ),
            h('div', { className: 'ss-spacer' }),
            h('button', { type: 'button', className: 'ss-btn ghost ss-btn-sm', onClick: () => setQueueOpen(true) }, t('queue.open')),
          ),
        queueOpen
          ? h('div', {
            className: 'ss-drawer-mask',
            onClick: (event) => { if (event.target === event.currentTarget) setQueueOpen(false) },
          },
            h('div', { className: 'ss-drawer', role: 'dialog', 'aria-label': t('queue.title') },
              h('div', { className: 'ss-drawer-hd' },
                h('h3', null, t('queue.title')),
                h('button', { type: 'button', className: 'ss-btn ghost ss-btn-sm', onClick: () => setQueueOpen(false) }, t('queue.close')),
              ),
              h('div', { className: 'ss-drawer-body' },
                h(QueuePanel, { t, queue, onClear: clearQueue, onRetry: retryItem }),
              ),
            ),
          )
          : null,

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
                h('div', { className: 'ss-field-label' }, t('settings.syncDir')),
                h('div', { className: 'ss-field-note' }, t('settings.syncDirHint')),
              ),
              h('div', { className: 'ss-field-body' },
                h('select', {
                  className: 'ss-select',
                  value: (snapshot.workspaces ?? []).some((workspace) => workspace.path === syncDir) || syncDir === '' ? syncDir : '__custom__',
                  'aria-label': t('settings.syncDir'),
                  disabled: busy,
                  onChange: (event) => {
                    if (event.target.value === '__custom__') return
                    void saveSyncDir(event.target.value)
                  },
                },
                  h('option', { value: '' }, t('settings.syncUnsorted')),
                  (snapshot.workspaces ?? []).map((workspace) => h('option', { key: workspace.id, value: workspace.path }, workspace.title)),
                  (snapshot.workspaces ?? []).some((workspace) => workspace.path === syncDir) || syncDir === ''
                    ? null
                    : h('option', { value: '__custom__' }, t('settings.syncCustom')),
                ),
              ),
            ),
            h('div', { className: 'ss-field' },
              h('div', { className: 'ss-field-text' },
                h('div', { className: 'ss-field-label' }, t('settings.syncCustom')),
                h('div', { className: 'ss-field-note' }, t('settings.syncCustomPlaceholder')),
              ),
              h('div', { className: 'ss-field-body' },
                h('input', {
                  className: 'ss-input',
                  value: syncDraft,
                  spellCheck: false,
                  placeholder: t('settings.syncCustomPlaceholder'),
                  'aria-label': t('settings.syncCustom'),
                  onChange: (event) => { syncDraftDirty.current = true; setSyncDraft(event.target.value) },
                  onKeyDown: (event) => { if (event.key === 'Enter') void saveSyncDir(syncDraft.trim()) },
                }),
                h('button', {
                  type: 'button',
                  className: 'ss-btn',
                  disabled: busy || syncDraft.trim().length === 0,
                  onClick: () => void saveSyncDir(syncDraft.trim()),
                }, t('settings.syncDirSave')),
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
            h('button', {
              type: 'button',
              className: 'ss-advanced-toggle',
              'aria-expanded': advancedOpen,
              onClick: () => setAdvancedOpen((value) => !value),
            },
              h('span', null, `${t('settings.advanced')} · ${t('settings.advancedHint')}`),
              h('span', { className: 'ss-chip' }, advancedOpen ? '▾' : '▸'),
            ),
            advancedOpen
              ? h('div', { className: 'ss-field' },
                h('div', { className: 'ss-field-text' },
                  h('div', { className: 'ss-field-label' }, t('settings.ports')),
                  h('div', { className: 'ss-field-note' }, t('page.ports', {
                    lan: snapshot.ports?.lan ?? '—',
                    discovery: snapshot.ports?.discovery ?? '—',
                  })),
                ),
              )
              : null,
            advancedOpen ? h(React.Fragment, null,
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
            ) : null,
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

      ctx.effect(() => installSidebarDrop(), 'dsh-session-sync: sidebar drop')

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, WrappedPanelPage))
    }

    return { name, inject, apply }
  },
})
