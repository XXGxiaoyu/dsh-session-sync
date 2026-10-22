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
    const CLIENT_VERSION = '0.8.4'
    const POLL_MS = 4000

    // ── styles ────────────────────────────────────────────────────────────
    // Pre-tagged so the module loader's `claimStyles` owns the tag and removes
    // it again when the plugin is unloaded.
    // The look is built on DSH's own design tokens (`--dsw-*`): colours, radii,
    // type ramp and motion all come from the host, so light/dark themes and any
    // future theme switch follow automatically instead of being recoloured here.
    const CSS = `
/* --------------------------------------------------------------------------
   2. 产品层 —— 语义变量（落地时替换为 --dsw-alias-*）
   -------------------------------------------------------------------------- */

.ss-root {
  --canvas: var(--dsw-alias-bg-base, #0d0d0f);
  --s1: var(--dsw-alias-bg-layer-1, #17171a);
  --s2: var(--dsw-alias-bg-layer-2, #1e1e22);
  --s3: var(--dsw-alias-bg-layer-3, #26262b);
  --line-1: var(--dsw-alias-border-l1, rgba(255, 255, 255, .06));
  --line-2: var(--dsw-alias-border-l2, rgba(255, 255, 255, .10));
  --line-3: var(--dsw-alias-border-l3, rgba(255, 255, 255, .17));
  --t1: var(--dsw-alias-label-primary, #f4f4f5);
  --t2: var(--dsw-alias-label-secondary, #adadb6);
  --t3: var(--dsw-alias-label-tertiary, #8b8b96);
  --brand: var(--dsw-alias-brand-primary, #7c93ff);
  --brand-ink: var(--dsw-alias-label-primary-foreground, #0b0b12);
  --brand-weak: color-mix(in srgb, var(--brand) 13%, transparent);
  --brand-line: color-mix(in srgb, var(--brand) 42%, transparent);
  --ok: var(--dsw-alias-state-success-primary, #4ade80);
  --ok-weak: color-mix(in srgb, var(--ok) 12%, transparent);
  --ok-line: color-mix(in srgb, var(--ok) 30%, transparent);
  --bad: var(--dsw-alias-state-error-primary, #f87171);
  --bad-weak: color-mix(in srgb, var(--bad) 11%, transparent);
  --bad-line: color-mix(in srgb, var(--bad) 30%, transparent);
  --warn: var(--dsw-alias-state-warning-primary, #fbbf24);
  --warn-weak: color-mix(in srgb, var(--warn) 12%, transparent);
  --warn-line: color-mix(in srgb, var(--warn) 30%, transparent);
  --btn-bg: var(--dsw-alias-button-primary-fill, #ededf0);
  --btn-fg: var(--dsw-alias-label-primary-foreground, #131316);
  --btn-bg-hover: var(--dsw-alias-button-primary-hover, #ffffff);
  --hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, .045));
  --hover-2: var(--dsw-alias-interactive-bg-active, rgba(255, 255, 255, .07));
  --shadow-pop: var(--dsw-elevation-panel, 0 20px 48px rgba(0, 0, 0, .55));
  --shadow-dialog: var(--dsw-elevation-panel, 0 32px 80px rgba(0, 0, 0, .6));
  --r1: var(--dsw-radius-xs, 6px);
  --r2: var(--dsw-radius-sm, 8px);
  --r3: var(--dsw-radius-md, 10px);
  --r4: var(--dsw-radius-lg, 12px);
  --r5: var(--dsw-radius-xl, 16px);
  --ease: var(--ds-ease-in-out, cubic-bezier(.32, .72, 0, 1));
  --dur: var(--ds-transition-duration, 150ms);

  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 640px;
  background: var(--canvas);
  color: var(--t1);
  font: 14px/22px var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", sans-serif);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}


.ss-root ::selection { background: var(--brand-weak); }

/* 图标 */
.i {
  width: 16px;
  height: 16px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.i.sm { width: 14px; height: 14px; }
.i.xs { width: 12px; height: 12px; stroke-width: 1.7; }
.i.lg { width: 20px; height: 20px; }

/* 按钮 */
.ss-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--r3);
  border: .5px solid var(--line-2);
  background: transparent;
  color: var(--t1);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease),
              color var(--dur) var(--ease), transform 90ms var(--ease);
}
.ss-btn:hover { background: var(--hover-2); }
.ss-btn:active { transform: scale(.985); }
.ss-btn.primary {
  background: var(--btn-bg);
  color: var(--btn-fg);
  border-color: transparent;
  font-weight: 550;
}
.ss-btn.primary:hover { background: var(--btn-bg-hover); }
.ss-btn.ghost { border-color: transparent; color: var(--t2); }
.ss-btn.ghost:hover { color: var(--t1); background: var(--hover-2); }
.ss-btn.danger { color: var(--bad); border-color: transparent; }
.ss-btn.danger:hover { background: var(--bad-weak); }
.ss-btn.sm { height: 28px; padding: 0 10px; font-size: 12.5px; border-radius: var(--r2); }
.ss-btn.xs { height: 24px; padding: 0 8px; font-size: 12px; border-radius: var(--r1); }
.ss-btn[disabled] { opacity: .42; pointer-events: none; }
.ss-btn:focus-visible,
.ss-icon:focus-visible,
.ss-tab:focus-visible,
.ss-filter:focus-visible,
.ss-cb:focus-visible,
.ss-dev:focus-visible,
.ss-row:focus-visible,
.ss-switch:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 1px;
}

.ss-icon {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: var(--r2);
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ss-icon:hover { background: var(--hover-2); color: var(--t1); }
.ss-icon.sm { width: 24px; height: 24px; border-radius: var(--r1); }
.ss-icon.xs { width: 20px; height: 20px; border-radius: 5px; }

/* 状态点 */
.ss-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex: none;
  background: var(--t3);
  box-shadow: none;
}
.ss-dot.on { background: var(--ok); box-shadow: 0 0 0 2.5px var(--ok-weak); }
.ss-dot.off { background: transparent; box-shadow: inset 0 0 0 1.5px var(--t3); }

/* 徽章 */
.ss-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 7px;
  border-radius: var(--r1);
  border: .5px solid var(--line-2);
  color: var(--t3);
  font-size: 11.5px;
  line-height: 1;
  white-space: nowrap;
}
.ss-chip.ok { color: var(--ok); border-color: var(--ok-line); background: var(--ok-weak); }
.ss-chip.bad { color: var(--bad); border-color: var(--bad-line); background: var(--bad-weak); }
.ss-chip.brand { color: var(--brand); border-color: var(--brand-line); background: var(--brand-weak); }
.ss-chip.warn { color: var(--warn); border-color: var(--warn-line); background: var(--warn-weak); }
.ss-chip.plain { border-color: transparent; background: var(--hover); }
.ss-chip.mono { font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 10.5px; letter-spacing: -.01em; }
.ss-chip .i { width: 11px; height: 11px; stroke-width: 2; }

/* 页面骨架 */
.ss-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  padding: 20px 24px 0;
}
.ss-top { display: flex; align-items: flex-start; gap: 16px; }
.ss-top-l { min-width: 0; flex: 1; }
.ss-h1 {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  letter-spacing: -.015em;
}
.ss-sub {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 2px;
  color: var(--t3);
  font-size: 12.5px;
  line-height: 18px;
}
.ss-sub .sep { color: var(--line-3); }
.ss-sub b { color: var(--t2); font-weight: 550; font-variant-numeric: tabular-nums; }
.ss-top-r { display: flex; align-items: center; gap: 4px; flex: none; padding-top: 2px; }

.ss-desk {
  display: grid;
  grid-template-columns: 258px minmax(0, 1fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
}

/* 左栏：本机 + 设备 */
.ss-rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: .5px solid var(--line-1);
  border-radius: var(--r4);
  background: var(--s1);
  overflow: hidden;
}
.ss-self { padding: 12px 12px 11px; border-bottom: .5px solid var(--line-1); }
.ss-self-hd { display: flex; align-items: center; gap: 6px; color: var(--t3); font-size: 11.5px; line-height: 16px; }
.ss-self-hd .ss-icon { margin-left: auto; }
.ss-self-name {
  margin-top: 2px;
  font-size: 13.5px;
  line-height: 20px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ss-self-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  color: var(--t3);
  font: 11px/16px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  white-space: nowrap;
  overflow: hidden;
}
.ss-self-meta .ss-icon { color: var(--t3); }
.ss-self-meta .ss-icon:hover { color: var(--t1); }

.ss-rail-scroll { flex: 1; min-height: 0; overflow: auto; padding: 6px; scrollbar-width: thin; }
.ss-glabel {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 7px 5px;
  color: var(--t3);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: .02em;
}
.ss-glabel span { font-variant-numeric: tabular-nums; }
.ss-glabel::after { content: ""; flex: 1; height: .5px; background: var(--line-1); }

.ss-dev {
  position: relative;
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: var(--r2);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--dur) var(--ease);
}
.ss-dev:hover { background: var(--hover); }
.ss-dev[aria-selected="true"] { background: var(--s2); }
.ss-dev[aria-selected="true"]::before {
  content: "";
  position: absolute;
  left: 0; top: 9px; bottom: 9px;
  width: 2px;
  border-radius: 2px;
  background: var(--brand);
}
.ss-dev-name {
  display: block;
  font-size: 13.5px;
  line-height: 19px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ss-dev-meta {
  display: block;
  margin-top: 1px;
  color: var(--t3);
  font-size: 11.5px;
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ss-dev-meta code { font: 11px/16px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); }
.ss-dev-count {
  min-width: 20px;
  text-align: right;
  color: var(--t3);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ss-dev.offline .ss-dev-name { color: var(--t2); }
.ss-dev.offline .ss-dev-count { color: var(--t3); }
.ss-dev.over {
  background: var(--brand-weak);
  box-shadow: inset 0 0 0 1px var(--brand-line);
}

.ss-rail-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-top: .5px solid var(--line-1);
}
.ss-rail-foot .ss-btn { flex: 1; justify-content: flex-start; }
.ss-rail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 12px;
  color: var(--t3);
  font-size: 11.5px;
  line-height: 17px;
  text-align: center;
}
.ss-rail-empty .i { width: 18px; height: 18px; opacity: .7; }

/* 右栏：会话台 */
.ss-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: .5px solid var(--line-1);
  border-radius: var(--r4);
  background: var(--s1);
  overflow: hidden;
}
.ss-stage-hd { display: flex; align-items: flex-start; gap: 10px; padding: 13px 16px 10px; }
.ss-stage-id { display: flex; gap: 9px; min-width: 0; flex: 1; }
.ss-stage-id .ss-dot { margin-top: 7px; }
.ss-stage-name {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  letter-spacing: -.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ss-stage-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 1px;
  color: var(--t3);
  font-size: 11.5px;
  line-height: 17px;
  font-variant-numeric: tabular-nums;
}
.ss-stage-meta code { font: 11px/17px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); }
.ss-stage-meta b { color: var(--t2); font-weight: 550; }
.ss-stage-actions { display: flex; align-items: center; gap: 4px; flex: none; }

/* 方向切换 */
.ss-tabs {
  display: flex;
  gap: 2px;
  width: fit-content;
  margin: 0 16px 10px;
  padding: 2px;
  border-radius: var(--r3);
  background: var(--s2);
}
.ss-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 11px;
  border: 0;
  border-radius: var(--r2);
  background: transparent;
  color: var(--t2);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ss-tab:hover { color: var(--t1); }
.ss-tab[aria-selected="true"] {
  background: var(--s3);
  color: var(--t1);
  box-shadow: inset 0 0 0 .5px var(--line-2), 0 1px 2px rgba(0, 0, 0, .18);
}
.ss-tab b { font-weight: 500; color: var(--t3); font-variant-numeric: tabular-nums; }
.ss-tab[aria-selected="true"] b { color: var(--t2); }

/* 工具条 */
.ss-tools { display: flex; align-items: center; gap: 8px; padding: 0 16px 10px; flex-wrap: wrap; }
.ss-search { position: relative; flex: 1; min-width: 168px; max-width: 296px; }
.ss-search input {
  width: 100%;
  height: 30px;
  padding: 0 42px 0 29px;
  border: .5px solid var(--line-2);
  border-radius: var(--r2);
  background: transparent;
  color: var(--t1);
  font: inherit;
  font-size: 12.5px;
  outline: 0;
}
.ss-search input::placeholder { color: var(--t3); }
.ss-search input:focus { border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-weak); }
.ss-search .i { position: absolute; left: 9px; top: 8px; color: var(--t3); }
.ss-search kbd {
  position: absolute;
  right: 7px; top: 6px;
  height: 18px;
  min-width: 18px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  border: .5px solid var(--line-2);
  border-radius: 5px;
  color: var(--t3);
  font: 10.5px/1 var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
}

.ss-filters { display: flex; gap: 2px; padding: 2px; border-radius: var(--r2); background: var(--s2); }
.ss-filter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--r1);
  background: transparent;
  color: var(--t2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ss-filter:hover { color: var(--t1); }
.ss-filter b { font-weight: 500; color: var(--t3); font-variant-numeric: tabular-nums; }
.ss-filter[aria-pressed="true"] {
  background: var(--s3);
  color: var(--t1);
  box-shadow: inset 0 0 0 .5px var(--line-2);
}
.ss-filter[aria-pressed="true"] b { color: var(--t2); }
.ss-tools .ss-sort { margin-left: auto; }

/* 会话列表 */
.ss-tools > .ss-cb { margin-right: 2px; }
.ss-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 2px 8px 8px;
  border-top: .5px solid var(--line-1);
  scrollbar-width: thin;
  scrollbar-color: var(--line-2) transparent;
}
.ss-list::-webkit-scrollbar { width: 9px; }
.ss-list::-webkit-scrollbar-thumb {
  background: var(--line-2);
  border-radius: 99px;
  border: 2.5px solid transparent;
  background-clip: content-box;
}
.ss-list-head {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto 104px;
  gap: 10px;
  align-items: center;
  padding: 8px 8px 6px;
  color: var(--t3);
  font-size: 11px;
  line-height: 16px;
}
.ss-list-head .right { text-align: right; }

.ss-row {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto 104px;
  gap: 10px;
  align-items: center;
  height: 47px;
  padding: 0 8px;
  border-radius: var(--r2);
  cursor: pointer;
  transition: background-color var(--dur) var(--ease);
}
.ss-row.push { grid-template-columns: 16px minmax(0, 1fr) 104px; }
.ss-row:hover,
.ss-row.is-hover { background: var(--hover); }
.ss-row[aria-selected="true"] { background: var(--brand-weak); }
.ss-row-main { min-width: 0; }
.ss-row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--t1);
  font-size: 13.5px;
  line-height: 19px;
}
.ss-row-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: var(--t3);
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ss-row-meta code { font: 11px/16px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); }
.ss-row-meta .ss-path { overflow: hidden; text-overflow: ellipsis; }
.ss-row-meta .ss-sep { color: var(--line-3); }
.ss-row-trail { display: flex; justify-content: flex-end; }
.ss-row-act { display: flex; align-items: center; justify-content: flex-end; gap: 2px; min-width: 0; overflow: hidden; opacity: 0; transition: opacity var(--dur) var(--ease); }
.ss-row:hover .ss-row-act,
.ss-row.is-hover .ss-row-act,
.ss-row:focus-within .ss-row-act { opacity: 1; }
@media (hover: none) { .ss-row-act { opacity: 1; } }

.ss-cb {
  display: grid;
  place-items: center;
  width: 16px; height: 16px;
  padding: 0;
  border: 1px solid var(--line-3);
  border-radius: 5px;
  background: transparent;
  color: var(--brand-ink);
  cursor: pointer;
  transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.ss-cb:hover { border-color: var(--brand-line); }
.ss-cb .i { width: 11px; height: 11px; stroke-width: 2.6; opacity: 0; }
.ss-cb[aria-checked="true"] { border-color: var(--brand); background: var(--brand); color: var(--brand-ink); }
.ss-cb[aria-checked="true"] .i { opacity: 1; }
.ss-cb[aria-checked="mixed"] { border-color: var(--brand); background: var(--brand); }
.ss-cb[aria-checked="mixed"]::after {
  content: "";
  width: 7px; height: 1.5px;
  border-radius: 1px;
  background: var(--brand-ink);
}

/* 摘要行 */
.ss-digest {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 8px 2px 42px;
  padding: 7px 9px;
  border-radius: var(--r2);
  background: var(--hover);
  color: var(--t2);
  font-size: 11.5px;
  line-height: 16px;
}
.ss-digest.ok { background: var(--ok-weak); color: var(--ok); }
.ss-digest.bad { background: var(--bad-weak); color: var(--bad); }
.ss-digest code { font: 11px/16px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); color: inherit; overflow: hidden; text-overflow: ellipsis; }
.ss-digest .grow { flex: 1; min-width: 0; }
.ss-digest .ss-btn { color: var(--t2); }
.ss-digest .ss-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
.ss-digest-pair { display: grid; gap: 2px; min-width: 0; }
.ss-digest-pair div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 选择条 */
.ss-selbar {
  position: relative;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 10px;
  padding: 6px 7px 6px 12px;
  border: .5px solid var(--line-2);
  border-radius: var(--r3);
  background: var(--s3);
  box-shadow: 0 10px 28px rgba(0, 0, 0, .28);
  animation: ss-rise 160ms var(--ease) both;
}
@keyframes ss-rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.ss-selbar .count { font-size: 12.5px; font-weight: 550; white-space: nowrap; }
.ss-selbar .count b { font-variant-numeric: tabular-nums; }
.ss-selbar .ss-target {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 7px 0 9px;
  border: .5px solid var(--line-2);
  border-radius: var(--r2);
  background: var(--s1);
  color: var(--t1);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  max-width: 260px;
}
.ss-selbar .ss-target span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-selbar .ss-target .i { color: var(--t3); }
.ss-selbar .ss-spacer { flex: 1; }
.ss-selbar .hint { color: var(--t3); font-size: 11px; margin-right: 2px; }

.ss-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 322px;
  padding: 6px;
  border: .5px solid var(--line-2);
  border-radius: var(--r4);
  background: var(--s3);
  box-shadow: var(--shadow-pop);
  animation: ss-pop 140ms var(--ease) both;
}
@keyframes ss-pop { from { opacity: 0; transform: translateY(3px) scale(.99); } to { opacity: 1; transform: none; } }
.ss-pop-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px 6px;
  color: var(--t3);
  font-size: 11px;
  line-height: 16px;
}
.ss-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: var(--r2);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ss-opt:hover { background: var(--hover-2); }
.ss-opt-main { flex: 1; min-width: 0; }
.ss-opt-name { display: flex; align-items: center; gap: 6px; font-size: 12.5px; line-height: 18px; }
.ss-opt-path {
  display: block;
  margin-top: 1px;
  color: var(--t3);
  font: 10.5px/15px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ss-opt-count { color: var(--t3); font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ss-opt .i.check { color: var(--brand); }
.ss-pop-foot { margin-top: 4px; padding: 5px 2px 2px; border-top: .5px solid var(--line-1); }

/* 传输坞 */
.ss-dock {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 6px 10px 6px 12px;
  border-top: .5px solid var(--line-1);
  background: color-mix(in srgb, var(--s1) 76%, var(--s2));
  color: var(--t2);
  font-size: 12px;
}
.ss-dock .ss-dock-main { display: flex; align-items: baseline; gap: 7px; min-width: 0; }
.ss-dock .ss-dock-main b { color: var(--t1); font-weight: 550; font-variant-numeric: tabular-nums; }
.ss-dock .ss-dock-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--t3); }
.ss-dock .meter { flex: 1; min-width: 52px; height: 4px; border-radius: 99px; background: var(--line-2); overflow: hidden; }
.ss-dock .meter i { display: block; height: 100%; width: 43%; border-radius: inherit; background: var(--brand); transition: width 320ms var(--ease); }
.ss-dock .ss-dock-pct { font-variant-numeric: tabular-nums; color: var(--t2); }

.ss-spinner {
  width: 13px; height: 13px;
  flex: none;
  border-radius: 50%;
  border: 1.5px solid var(--line-2);
  border-top-color: var(--brand);
  animation: ss-spin .75s linear infinite;
}
@keyframes ss-spin { to { transform: rotate(360deg); } }

/* 队列展开 */
.ss-queue { border-top: .5px solid var(--line-1); background: var(--s1); }
.ss-queue-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: .5px solid var(--line-1);
}
.ss-queue-hd h4 { margin: 0; font-size: 12.5px; line-height: 18px; font-weight: 600; }
.ss-queue-stats { display: flex; align-items: center; gap: 8px; color: var(--t3); font-size: 11px; margin-left: 4px; }
.ss-queue-stats b { color: var(--t2); font-weight: 550; font-variant-numeric: tabular-nums; }
.ss-queue-hd .ss-spacer { flex: 1; }
.ss-queue-body { max-height: 268px; overflow: auto; padding: 4px 6px 6px; }
.ss-qrow {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 9px;
  padding: 8px 7px;
  border-radius: var(--r2);
  align-items: start;
}
.ss-qrow:hover { background: var(--hover); }
.ss-qrow + .ss-qrow { margin-top: 1px; }
.ss-qico { display: grid; place-items: center; width: 18px; height: 18px; margin-top: 1px; color: var(--t3); }
.ss-qico.done { color: var(--ok); }
.ss-qico.failed { color: var(--bad); }
.ss-qico.running { color: var(--brand); }
.ss-qmain { min-width: 0; }
.ss-qname { font-size: 12.5px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-qmeta { display: flex; align-items: center; gap: 6px; color: var(--t3); font-size: 11px; line-height: 16px; white-space: nowrap; overflow: hidden; }
.ss-qmeta code { font: 10.5px/16px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); overflow: hidden; text-overflow: ellipsis; }
.ss-qmsg { color: var(--bad); font-size: 11px; line-height: 16px; margin-top: 1px; }
.ss-qright { display: flex; align-items: center; gap: 6px; padding-top: 1px; }
.ss-qright .pct { color: var(--t2); font-size: 11px; font-variant-numeric: tabular-nums; }
.ss-qright .dur { color: var(--t3); font-size: 10.5px; font-variant-numeric: tabular-nums; }

/* 通用小工具 */
.ss-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  gap: 6px;
  padding: 28px;
  text-align: center;
}
.ss-empty .glyph {
  display: grid;
  place-items: center;
  width: 40px; height: 40px;
  margin-bottom: 4px;
  border-radius: 12px;
  border: .5px solid var(--line-2);
  background: var(--s2);
  color: var(--t2);
}
.ss-empty h3 { margin: 0; font-size: 14.5px; line-height: 22px; font-weight: 600; }
.ss-empty p { margin: 0; max-width: 380px; color: var(--t3); font-size: 12.5px; line-height: 20px; }
.ss-empty .ss-addr-box { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.ss-addr-box {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 4px 0 9px;
  border: .5px solid var(--line-2);
  border-radius: var(--r2);
  background: var(--s1);
}
.ss-addr-box code { color: var(--t2); font: 11.5px/18px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); }
.ss-input {
  height: 30px;
  padding: 0 9px;
  border: .5px solid var(--line-2);
  border-radius: var(--r2);
  background: var(--s1);
  color: var(--t1);
  font: inherit;
  font-size: 12.5px;
  outline: 0;
  min-width: 0;
}
.ss-input::placeholder { color: var(--t3); }
.ss-input:focus { border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-weak); }

/* 弹窗（计划确认） */
.ss-scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(8, 8, 10, .58);
  backdrop-filter: blur(2px);
}
.ss-dialog {
  width: 540px;
  max-height: 86%;
  display: flex;
  flex-direction: column;
  border: .5px solid var(--line-2);
  border-radius: var(--r5);
  background: var(--s3);
  box-shadow: var(--shadow-dialog);
  animation: ss-dialog-in 180ms var(--ease) both;
}
@keyframes ss-dialog-in { from { opacity: 0; transform: translateY(6px) scale(.99); } to { opacity: 1; transform: none; } }
.ss-dialog-hd { padding: 18px 20px 0; }
.ss-dialog-hd h3 { margin: 0; font-size: 15.5px; line-height: 23px; font-weight: 600; }
.ss-dialog-hd p { margin: 3px 0 0; color: var(--t3); font-size: 12.5px; line-height: 19px; }
.ss-dialog-body { flex: 1; min-height: 0; padding: 14px 20px 4px; overflow: auto; }
.ss-plan-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 9px 0;
  border-top: .5px solid var(--line-1);
}
.ss-plan-row:first-child { border-top: 0; }
.ss-plan-title { font-size: 12.5px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-plan-meta { color: var(--t3); font-size: 11px; line-height: 16px; }
.ss-select {
  height: 28px;
  padding: 0 24px 0 8px;
  border: .5px solid var(--line-2);
  border-radius: var(--r2);
  background-color: var(--s1);
  color: var(--t1);
  font: inherit;
  font-size: 12px;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round'><path d='m4.5 6.5 3.5 3.5 3.5-3.5'/></svg>");
  background-repeat: no-repeat;
  background-position: right 7px center;
}
.ss-dialog-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px 16px;
  border-top: .5px solid var(--line-1);
  margin-top: 8px;
}
.ss-dialog-foot .ss-spacer { flex: 1; }

/* 设置视图 */
.ss-settings { flex: 1; min-height: 0; overflow: auto; padding: 18px 24px 28px; }
.ss-settings-in { max-width: 720px; }
.ss-set-hd { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; }
.ss-set-hd h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; }
.ss-set-sub { margin: 0 0 18px; color: var(--t3); font-size: 12.5px; line-height: 20px; }
.ss-set-sec { margin: 0 0 20px; }
.ss-set-sec > h3 {
  margin: 0 0 6px;
  color: var(--t3);
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: .05em;
}
.ss-set-card { border: .5px solid var(--line-1); border-radius: var(--r3); background: var(--s1); overflow: hidden; }
.ss-field { display: flex; align-items: center; gap: 16px; padding: 11px 14px; }
.ss-field + .ss-field { border-top: .5px solid var(--line-1); }
.ss-field-text { flex: 1; min-width: 0; }
.ss-field-label { font-size: 13px; line-height: 20px; }
.ss-field-note { color: var(--t3); font-size: 11.5px; line-height: 17px; margin-top: 1px; }
.ss-field-body { display: flex; align-items: center; gap: 6px; flex: none; }
.ss-field.stack { display: block; }
.ss-field.stack .ss-field-body { margin-top: 8px; }
.ss-field.stack .ss-field-body .ss-input { flex: 1; }
.ss-switch {
  position: relative;
  width: 36px; height: 22px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 99px;
  background: var(--line-3);
  cursor: pointer;
  transition: background-color var(--dur) var(--ease);
}
.ss-switch::after {
  content: "";
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .3);
  transition: transform 180ms var(--ease);
}
.ss-switch[aria-checked="true"] { background: var(--brand); }
.ss-switch[aria-checked="true"]::after { transform: translateX(14px); }

.ss-adv-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-top: .5px solid var(--line-1);
  background: transparent;
  color: var(--t2);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
}
.ss-adv-toggle:hover { background: var(--hover); }
.ss-adv-toggle .i { transition: transform 160ms var(--ease); }
.ss-adv-toggle[aria-expanded="true"] .i { transform: rotate(90deg); }

.ss-token-list { display: flex; flex-wrap: wrap; gap: 5px; }
.ss-token {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 4px 0 8px;
  border: .5px solid var(--line-2);
  border-radius: var(--r1);
  background: var(--s2);
  color: var(--t2);
  font: 11px/1 var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.ss-token .ss-icon { width: 16px; height: 16px; }

/* 页脚 */
.ss-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  padding: 8px 2px 10px;
  color: var(--t3);
  font-size: 11px;
  line-height: 16px;
}
.ss-foot code { font-size: 10.5px; }
.ss-foot .sep { color: var(--line-3); }
.ss-foot a { color: var(--t2); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.ss-foot a:hover { color: var(--t1); }
.ss-foot .warn { color: var(--warn); }
.ss-foot .ss-spacer { flex: 1; }

/* Toast */
.ss-toast {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 60;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 12px;
  border: .5px solid var(--line-2);
  border-radius: 99px;
  background: var(--s3);
  box-shadow: var(--shadow-pop);
  color: var(--t1);
  font-size: 12px;
  white-space: nowrap;
}
.ss-toast .i { color: var(--ok); }

/* 拖拽层（逻辑沿用旧实现，只换 token） */
.ss-row.ss-dragging { opacity: .45; }
.ss-dragghost {
  position: fixed; top: 0; left: 0; opacity: 0; pointer-events: none;
  display: flex; align-items: center; gap: 10px; max-width: 320px;
  padding: 8px 12px; z-index: 80;
  border: .5px solid var(--line-3); border-radius: var(--r3);
  background: var(--s1); color: var(--t1);
  font-size: 13px; line-height: 20px;
  box-shadow: var(--shadow-pop);
  will-change: transform;
}
.ss-dragghost[data-show] { opacity: .96; }
.ss-dragghost-main { display: flex; flex-direction: column; min-width: 0; }
.ss-dragghost-title { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 18px; }
.ss-dragghost-sub { color: var(--t3); font-size: 11px; line-height: 15px; }
.ss-dragghost-badge { margin-left: auto; flex: none; padding: 1px 7px; border-radius: 999px; background: var(--hover-2); color: var(--t2); font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums; }
.ss-dnd-tip {
  position: fixed; z-index: 80; pointer-events: none;
  display: inline-flex; align-items: center; gap: 8px;
  max-width: min(460px, 84vw); padding: 6px 10px 6px 8px;
  border: .5px solid var(--line-2); border-radius: 999px;
  background: color-mix(in srgb, var(--s1) 92%, transparent);
  color: var(--t1); font-size: 12px; line-height: 18px;
  box-shadow: var(--shadow-pop); backdrop-filter: blur(10px);
  opacity: 0; transform: translateY(-2px) scale(.98);
  transition: opacity .12s var(--ease), transform .12s var(--ease);
}
.ss-dnd-tip[data-show] { opacity: 1; transform: none; }
.ss-dnd-tip.ws { border-color: var(--brand-line); }
.ss-dnd-tip.blocked .ss-dnd-ico { color: var(--t3); }
.ss-dnd-tip.done { background: var(--ok); border-color: transparent; color: var(--brand-ink); }
.ss-dnd-ico { display: grid; place-items: center; width: 16px; height: 16px; flex: none; color: var(--brand); }
.ss-dnd-tip.done .ss-dnd-ico, .ss-dnd-tip.done .ss-dnd-name { color: var(--brand-ink); }
.ss-dnd-tip.done .ss-dnd-hint { color: color-mix(in srgb, var(--brand-ink) 72%, transparent); border-left-color: color-mix(in srgb, var(--brand-ink) 24%, transparent); }
.ss-dnd-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-dnd-hint { padding-left: 8px; border-left: .5px solid var(--line-2); color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-insert {
  position: fixed; height: 2px; border-radius: 2px; z-index: 61;
  background: var(--brand); opacity: 0; pointer-events: none;
  transition: opacity 120ms var(--ease), top 90ms var(--ease);
}
.ss-insert[data-show="1"] { opacity: 1; box-shadow: 0 0 0 1px rgba(0, 0, 0, .2); }
.ss-ws-over { background: var(--hover) !important; box-shadow: inset 0 0 0 1.5px var(--brand); border-radius: var(--r2); transition: background-color .12s ease; }
.ss-ws-member { position: relative; background: color-mix(in srgb, var(--brand) 10%, transparent) !important; transition: background-color .12s ease; }
.ss-ws-member::before { content: ""; position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 2px; background: var(--brand); opacity: .75; pointer-events: none; }


/* 诊断 */
.ss-diag {
  margin: 10px 14px 14px;
  padding: 12px;
  border: .5px solid var(--line-1);
  border-radius: var(--r2);
  background: var(--canvas);
  color: var(--t2);
  font: 11px/18px var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  white-space: pre-wrap;
  word-break: break-all;
}


.ss-root .ss-page { flex: 1; min-height: 0; height: 100%; }
.ss-root.settings-only { height: auto; min-height: 0; overflow: visible; }
.ss-root.settings-only .ss-page { height: auto; min-height: 0; }
.ss-root.settings-only .ss-settings { overflow: visible; }
.ss-notice {
  display: flex; align-items: center; gap: 7px;
  margin: 0 2px; padding: 7px 10px;
  border-radius: var(--r2);
  border: .5px solid var(--line-1);
  background: var(--s2);
  color: var(--t2);
  font-size: 12px; line-height: 18px;
}
.ss-notice.error { color: var(--bad); border-color: var(--bad-line); background: var(--bad-weak); }
.ss-notice.ok { color: var(--ok); border-color: var(--ok-line); background: var(--ok-weak); }
.ss-dev.over { background: var(--brand-weak); box-shadow: inset 0 0 0 1px var(--brand-line); }
.ss-hint { color: var(--t3); font-size: 11.5px; line-height: 17px; }
.ss-host-page { height: 100%; min-height: 0; }
@media (max-width: 860px) {
  .ss-desk { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .ss-rail { display: flex; max-height: 220px; }
}
@media (max-width: 980px) {
  .ss-settings.cols .ss-settings-in { grid-template-columns: minmax(0, 1fr); }
}

/* 新壳补充 */
.ss-menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 40;
  min-width: 190px; padding: 6px;
  border: .5px solid var(--line-2); border-radius: var(--r3);
  background: var(--s3); box-shadow: var(--shadow-pop);
  display: flex; flex-direction: column; gap: 2px;
}
.ss-menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 9px; border: 0; border-radius: var(--r2);
  background: transparent; color: var(--t2);
  font: inherit; font-size: 12.5px; line-height: 18px;
  text-align: left; cursor: pointer; white-space: nowrap;
}
.ss-menu-item:hover { background: var(--hover-2); color: var(--t1); }
.ss-menu-item.danger { color: var(--bad); }
.ss-menu-item.danger:hover { background: var(--bad-weak); }
.ss-menu-wrap { position: relative; display: flex; }
.ss-inline { display: flex; align-items: center; gap: 8px; }
.ss-target-wrap { position: relative; display: flex; }
.ss-target-wrap .ss-popover { left: 0; bottom: calc(100% + 8px); }
.ss-empty-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ss-steps { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; text-align: left; }
.ss-step { display: flex; gap: 8px; align-items: flex-start; color: var(--t3); font-size: 12px; line-height: 18px; }
.ss-step b {
  display: grid; place-items: center; width: 16px; height: 16px; flex: none;
  margin-top: 1px; border-radius: 50%; background: var(--hover-2);
  color: var(--t2); font: 10px/1 var(--ds-font-family-code, ui-monospace, monospace);
}
.ss-banner {
  display: flex; align-items: center; gap: 7px;
  margin: 0 16px 10px; padding: 7px 10px;
  border: .5px solid var(--warn-line); border-radius: var(--r2);
  background: var(--warn-weak); color: var(--warn);
  font-size: 11.5px; line-height: 17px;
}
.ss-error {
  display: flex; align-items: flex-start; gap: 8px;
  margin: 10px 16px; padding: 10px 12px;
  border: .5px solid var(--bad-line); border-radius: var(--r2);
  background: var(--bad-weak); color: var(--bad);
  font-size: 12px; line-height: 18px;
}
.ss-error .grow { flex: 1; min-width: 0; }
.ss-error code { font-size: 11px; }
.ss-sk { height: 8px; border-radius: 4px; background: var(--hover-2); animation: ss-pulse 1.5s ease-in-out infinite; }
@keyframes ss-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
.ss-empty-inline {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; flex: 1; padding: 28px 16px; text-align: center;
  color: var(--t3); font-size: 12px; line-height: 18px;
}
.ss-empty-inline b { color: var(--t1); font-weight: 550; font-size: 12.5px; }
.ss-set-view-hd { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; }
.ss-set-view-hd h2 { margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; }
.ss-set-view-hd span { color: var(--t3); font-size: 11.5px; }
.ss-settings.cols .ss-settings-in {
  max-width: none; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px 24px; align-items: start;
}
.ss-set-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.ss-settings.cols .ss-set-sec { margin: 0; }
.ss-settings:not(.cols) .ss-settings-in { display: flex; flex-direction: column; gap: 20px; }
.ss-dialog-note { display: flex; align-items: center; gap: 6px; padding: 10px 20px 0; color: var(--t3); font-size: 11px; line-height: 16px; }
.ss-plan-fresh { color: var(--t3); font-size: 11px; white-space: nowrap; }
.ss-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ss-note-row { display: flex; align-items: center; gap: 6px; color: var(--t3); font-size: 11.5px; line-height: 17px; padding: 0 16px 8px; }

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
          'device.remove': '移除',
          'device.copyAddress': '复制局域网地址',
          'device.refresh': '刷新会话列表',
          'device.pushHere': '推送本机会话…',
          'device.sessionsCount': '{n} 个会话',
          'notice.addressCopied': '局域网地址已复制',
          'notice.addressCopyFailed': '复制失败，请手动选择地址',
          'settings.advanced': '网络与高级',
          'settings.repair': '修复历史会话',
          'settings.repairHint': '早期版本拉取过的会话可能带上对方的继承标记，打开时会报「inherited end-seed marker」。这里会扫描并修复，原文件保留为 .bak。',
          'settings.repairAction': '扫描并修复',
          'notice.repairDone': '已扫描 {scanned} 个会话，修复 {repaired} 个',
          'notice.repairNone': '没有需要修复的会话',
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
          'page.onlineCount': '在线 {n} 台',
          'page.seenCount': '已发现 {found} 台 · 曾连接 {recalled} 台',
          'page.ports': '同步端口 {lan} · 发现端口 {discovery}',
          'page.apiError': '读取状态失败：{message}',
          'page.noPersistence': '当前会话存储不可用，拉取/推送会失败。',
          'self.title': '本机',
          'self.name': '设备名称',
          'self.hint': '这个名称会随发现广播发给局域网内的其他设备，只影响别人看到的名字。',
          'devices.tabPeer': '对端会话',
          'devices.tabLocal': '本机会话',
          'devices.selectHint': '选择左侧设备查看它的会话',
          'devices.title': '设备',
          'devices.count': '已发现 {found} 台 · 曾连接 {recalled} 台',
              'diag.title': '界面出错了',
          'diag.body': '页面渲染时抛了异常，已在此展示诊断信息，而不是留一个空白面板。',
          'diag.hint': '把下面的内容发到 GitHub issue 即可；点「重新加载」可以先恢复界面。',
          'diag.reload': '重新加载',
          'diag.copy': '复制诊断',
          'devices.empty': '暂未发现其他设备。请确认另一台机器的 DSH 也安装并启用了本插件，且处在同一个局域网。',
          'devices.hint': '自定义命名只保存在本机，设备离线或重启后再次上线时仍会显示你起的名字。',
          'devices.moreHint': '列表展示全部已发现或曾连接过的设备；其他网段可在「网络与高级」里加网段扫描。',
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
          'sessions.pushShort': '推送',
          'sessions.empty': '这台设备没有可同步的会话。',
          'sessions.untitled': '未命名会话',
          'sessions.events': '{n} 条事件',
          'sessions.pull': '拉取到本机',
          'sessions.pullShort': '拉取',
          'sessions.imported': '已拉取',
          'settings.title': '同步设置',
          'settings.short': '设置',
          'page.onlineShort': '台在线',
          'page.seenShort': '台已发现',
          'settings.syncDir': '自动同步目录',
          'settings.syncDirHint': '自动拉取的会话存到哪个目录。默认「未分组」：不归任何工作区；也可以选一个已有工作区，或填一个文件夹路径（不存在会自动创建）。',
          'settings.syncUnsorted': '未分组（不归档到工作区）',
          'settings.syncCustom': '自定义目录',
          'settings.syncCustomPlaceholder': '/Users/you/synced-sessions',
          'settings.syncDirSave': '保存目录',
          'settings.autoPull': '自动拉取',
          'settings.concurrency': '同时传输',
          'settings.concurrencyHint': '一次同时传输多少个会话。自动按 CPU 核数估算，封顶 5 个；手动 1–16 会覆盖自动值。',
          'settings.concurrencyAuto': '自动（本机 {n} 个，封顶 5）',
          'settings.concurrencyManual': '手动并发',
          'notice.concurrencySaved': '已更新同时传输数量',
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
          'dnd.insertHere': '插入到此位置',
          'dnd.intoUnsorted': '放入插件目录，不归档到工作区',
          'dnd.blocked': '无法放入此处',
          'dnd.blockedHint': '请拖到左侧工作区',
          'dnd.selected': '已选定 {name}',
          'dnd.preparing': '正在准备确认…',
          'dnd.title': '拖到工作区',
          'dnd.ghostPull': '拉取 · {count} 个会话',
          'dnd.ghostPush': '推送 · {count} 个会话',
          'dnd.hint': '松开后确认要同步的会话；目录不存在会自动创建。',
          'sessions.dropHint': '拖到设备卡片上推送',
          'device.pullAll': '拉取全部',
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
          'error.timeout': '请求超时',
          'error.offline': '无法连接插件服务：{message}',
          'error.badResponse': '服务返回了无法解析的数据（{status}）',
          'error.status': '服务返回 {status}',
          'plan.fresh': '待传输',
          'queue.running': '传输中',
          'queue.done': '已完成',
          'queue.skipped': '已存在，跳过',
          'queue.failed': '失败',
          'queue.clear': '清空',
          'queue.retry': '重试',
          'queue.summary': '{done} 完成 · {skipped} 跳过 · {failed} 失败',
          'queue.overall': '{done}/{total} 已完成（含跳过）',
          'queue.duration': '耗时 {seconds}s',
          'queue.empty': '还没有传输任务：选中会话后点「同步选中」，或直接拖到设备 / 侧栏工作区。',
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
          'common.add': '添加',
          'devices.addAddress': '添加地址',
          'empty.title': '还没有发现其他设备',
          'empty.body': '在同一局域网的机器上装好「会话同步」，它会自己出现；跨网段或防火墙挡住广播时，用下面的地址手动连。',
          'settings.unsortedShort': '未分组（默认）',
          'sessions.verifyFailedShort': '校验失败',
          'sessions.synced': '已同步',
          'sessions.notSynced': '未同步',
          'sessions.pulling': '拉取中',
          'sessions.queued': '排队中',
          'settings.current': '当前',
          'device.sessionsUnit': '个会话',
          'dir.pull': '拉取',
          'dir.push': '推送',
          'stage.pushHint': '把本机会话发送到「{peer}」',
          'sessions.emptyBody': '这台设备还没有会话。',
          'sessions.selectedUnit': '项已选',
          'sessions.pullTo': '拉取到',
          'target.title': '选择目标目录',
          'target.count': '{n} 个位置',
          'target.note': '也可以直接把会话拖到宿主侧栏的工作区。',
          'settings.identity': '身份',
          'common.copy': '复制',
          'settings.address': '局域网地址',
          'settings.version': '版本',
          'settings.hostVersion': '宿主版本',
          'settings.platform': '平台',
          'settings.transfer': '传输',
          'settings.about': '关于',
          'common.open': '打开',
          'settings.intro': '局域网内的设备与会话同步。',
          'settings.backToDesk': '返回会话台',
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
          'device.remove': 'Remove',
          'device.copyAddress': 'Copy LAN address',
          'device.refresh': 'Reload session list',
          'device.pushHere': 'Push local sessions…',
          'device.sessionsCount': '{n} sessions',
          'notice.addressCopied': 'LAN address copied',
          'notice.addressCopyFailed': 'Copy failed — select the address manually',
          'settings.advanced': 'Network & advanced',
          'settings.repair': 'Repair old sessions',
          'settings.repairHint': "Sessions pulled by an early build can carry the peer's inherited marker and fail to open with \"inherited end-seed marker\". This scans and repairs them, keeping a .bak copy.",
          'settings.repairAction': 'Scan and repair',
          'notice.repairDone': 'Scanned {scanned} sessions, repaired {repaired}',
          'notice.repairNone': 'Nothing needed repairing',
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
          'page.onlineCount': '{n} online',
          'page.seenCount': '{found} discovered · {recalled} seen',
          'page.ports': 'sync port {lan} · discovery port {discovery}',
          'page.apiError': 'Failed to read state: {message}',
          'page.noPersistence': 'The session store is unavailable; pull/push will fail.',
          'self.title': 'This machine',
          'self.name': 'Device name',
          'self.hint': 'Advertised to other devices on the LAN — it only changes how they see you.',
          'devices.tabPeer': 'Remote sessions',
          'devices.tabLocal': 'This device',
          'devices.selectHint': 'Pick a device on the left to see its sessions',
          'devices.title': 'Devices',
          'devices.count': '{found} discovered · {recalled} seen',
              'diag.title': 'The page hit an error',
          'diag.body': 'Rendering threw. The details are shown here instead of leaving a blank panel.',
          'diag.hint': 'Paste this into a GitHub issue; “Reload” usually brings the UI back.',
          'diag.reload': 'Reload',
          'diag.copy': 'Copy diagnostics',
          'devices.empty': 'No other device found yet. Make sure DSH on the other machine has this plugin enabled and is on the same LAN.',
          'devices.hint': 'Custom names are stored locally and survive a device going offline and coming back.',
          'devices.moreHint': 'Every discovered or previously seen device is listed; add other subnets under “Network & advanced” to scan them.',
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
          'sessions.pushShort': 'Push',
          'sessions.empty': 'No sessions to sync on this device.',
          'sessions.untitled': 'Untitled session',
          'sessions.events': '{n} events',
          'sessions.pull': 'Pull here',
          'sessions.pullShort': 'Pull',
          'sessions.imported': 'pulled',
          'settings.title': 'Sync settings',
          'settings.short': 'Settings',
          'page.onlineShort': 'online',
          'page.seenShort': 'discovered',
          'settings.syncDir': 'Auto-sync folder',
          'settings.syncDirHint': 'Where auto-pulled sessions land. “Ungrouped” keeps them outside every workspace; pick an existing workspace, or type a folder path (created on save).',
          'settings.syncUnsorted': 'Ungrouped (no workspace)',
          'settings.syncCustom': 'Custom folder',
          'settings.syncCustomPlaceholder': '/Users/you/synced-sessions',
          'settings.syncDirSave': 'Save folder',
          'dnd.title': 'Drop into a workspace',
          'dnd.ghostPull': 'Pull · {count} sessions',
          'dnd.ghostPush': 'Push · {count} sessions',
          'dnd.intoGroup': 'Pull into this group',
          'dnd.intoGroupArea': 'Whole group accepts the drop',
          'dnd.intoUnsorted': 'Goes to the plugin folder, stays ungrouped',
          'dnd.insertHere': 'Insert right here',
          'dnd.blocked': 'Cannot drop here',
          'dnd.blockedHint': 'Drag onto the sidebar',
          'dnd.hint': 'Release, then confirm the sessions; missing folders are created.',
          'dnd.selected': 'Target: {name}',
          'dnd.preparing': 'Preparing the confirmation…',
          'notice.syncDirSaved': 'Sync folder saved',
          'settings.autoPull': 'Auto pull',
          'settings.autoPullLabel': 'Auto-pull new sessions from online devices',
          'settings.concurrency': 'Concurrent transfers',
          'settings.concurrencyHint': 'How many sessions transfer at once. Auto estimates from the CPU count, capped at 5; a manual 1–16 value overrides it.',
          'settings.concurrencyAuto': 'Auto ({n} here, max 5)',
          'settings.concurrencyManual': 'Manual concurrency',
          'notice.concurrencySaved': 'Concurrent transfers updated',
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
          'error.timeout': 'Request timed out',
          'error.offline': 'Cannot reach the plugin service: {message}',
          'error.badResponse': 'The service returned unreadable data ({status})',
          'error.status': 'The service returned {status}',
          'plan.fresh': 'To transfer',
          'queue.running': 'Transferring',
          'queue.done': 'Done',
          'queue.skipped': 'Skipped (already present)',
          'queue.failed': 'Failed',
          'queue.clear': 'Clear',
          'queue.retry': 'Retry',
          'queue.summary': '{done} done · {skipped} skipped · {failed} failed',
          'queue.overall': '{done}/{total} settled (skips included)',
          'queue.duration': 'took {seconds}s',
          'queue.empty': 'No transfers yet: select sessions and pull, or drag them onto a device or sidebar workspace.',
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
          'common.add': 'Add',
          'devices.addAddress': 'Add address',
          'empty.title': 'No other device yet',
          'empty.body': 'Install “Session Sync” on another machine on the same LAN; if broadcast is blocked, add its address below.',
          'settings.unsortedShort': 'Unsorted (default)',
          'sessions.verifyFailedShort': 'Checksum failed',
          'sessions.synced': 'Synced',
          'sessions.notSynced': 'Not synced',
          'sessions.pulling': 'Pulling',
          'sessions.queued': 'Queued',
          'settings.current': 'Current',
          'device.sessionsUnit': 'sessions',
          'dir.pull': 'Pull',
          'dir.push': 'Push',
          'stage.pushHint': 'Send local sessions to “{peer}”',
          'sessions.emptyBody': 'This device has no sessions yet.',
          'sessions.selectedUnit': 'selected',
          'sessions.pullTo': 'Pull to',
          'target.title': 'Choose destination',
          'target.count': '{n} locations',
          'target.note': 'You can also drag sessions onto a host workspace.',
          'settings.identity': 'Identity',
          'common.copy': 'Copy',
          'settings.address': 'LAN address',
          'settings.version': 'Version',
          'settings.hostVersion': 'Host version',
          'settings.platform': 'Platform',
          'settings.transfer': 'Transfer',
          'settings.about': 'About',
          'common.open': 'Open',
          'settings.intro': 'Devices and session sync on this LAN.',
          'settings.backToDesk': 'Back to desk',
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
        throw new ApiError(error?.name === 'AbortError'
          ? translateNow('error.timeout')
          : translateNow('error.offline', { message: error?.message ?? String(error) }))
      } finally {
        clearTimeout(timer)
      }
      let body
      try {
        body = await response.json()
      } catch {
        throw new ApiError(translateNow('error.badResponse', { status: String(response.status) }))
      }
      if (!response.ok || body?.ok === false) {
        throw new ApiError(body?.error?.message ?? translateNow('error.status', { status: String(response.status) }))
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

    /** Wall-clock time (HH:MM:SS) for the "last scan" line. */
    function shortClock(at) {
      if (typeof at !== 'number' || !Number.isFinite(at)) return '—'
      const date = new Date(at)
      const pad = (value) => String(value).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
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
    function useSnapshot(active, pollMs = POLL_MS) {
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
        }, pollMs)
        // Never keep a headless runtime (tests, SSR) alive just for the poll.
        timer?.unref?.()
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [active, reload, pollMs])
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
      return node
    }

    let ghostNode = null
    let ghostPayload = null
    let ghostTimer = null

    const GHOST_IDLE_MS = 20_000

    /** Arm (or re-arm) the watchdog that removes a ghost whose dragend never arrived. */
    function armGhostWatchdog() {
      if (ghostTimer !== null) clearTimeout(ghostTimer)
      ghostTimer = setTimeout(() => {
        clearGhost()
        hideDropTip(0)
        clearRowMark()
        dragStore.clear()
      }, GHOST_IDLE_MS)
      ghostTimer?.unref?.()
    }

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
      if (ghostNode === null) {
        if (ghostPayload === null) return
        ghostNode = dragGhost(ghostPayload)
        if (ghostNode === null) return
        document.body.append(ghostNode)
      }
      const x = Math.min(event.clientX + 16, (window.innerWidth ?? 1440) - 340)
      const y = Math.min(event.clientY + 12, (window.innerHeight ?? 900) - 120)
      ghostNode.style.transform = `translate(${x}px, ${y}px)`
      ghostNode.dataset.show = '1'
      armGhostWatchdog()
    }

    function clearGhost() {
      if (ghostTimer !== null) {
        clearTimeout(ghostTimer)
        ghostTimer = null
      }
      ghostNode?.remove()
      ghostNode = null
      ghostPayload = null
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
        ghostPayload = payload
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
      drop(target, payload = dragState) {
        // `dragend` fires before the drop animation finishes, so the caller
        // hands over the payload it captured at drop time; reading `dragState`
        // here would already be null and the transfer would silently vanish.
        if (payload === null) return
        if (dragState !== null) {
          dragState = null
          for (const listener of dragListeners) listener()
        }
        dragHandler?.(payload, target)
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

    /** The session row right after `row` inside the same group, if any. */
    function nextSessionId(row) {
      const rows = [...document.querySelectorAll('[data-row-key]')]
      let seen = false
      for (const node of rows) {
        if (node === row) {
          seen = true
          continue
        }
        if (!seen) continue
        const key = node.getAttribute('data-row-key') ?? ''
        if (key.startsWith('workspace:')) return null
        if (key.startsWith('session:')) return key.slice('session:'.length)
      }
      return null
    }

    /** Where a native session row would re-insert: before its own id or the next row's. */
    function insertAnchor(row, event) {
      const key = row?.getAttribute?.('data-row-key') ?? ''
      if (!key.startsWith('session:')) return null
      const rect = row.getBoundingClientRect()
      const below = typeof event?.clientY === 'number' && event.clientY > rect.top + rect.height / 2
      const beforeId = below ? nextSessionId(row) : key.slice('session:'.length)
      showInsertLine(row, below)
      return { beforeId }
    }

    let insertLine = null
    function showInsertLine(row, below) {
      const rect = row.getBoundingClientRect()
      if (insertLine === null) {
        insertLine = document.createElement('div')
        insertLine.className = 'ss-insert'
        document.body.appendChild(insertLine)
      }
      insertLine.style.left = `${rect.left}px`
      insertLine.style.width = `${rect.width}px`
      insertLine.style.top = `${(below ? rect.bottom : rect.top) - 1}px`
      insertLine.dataset.show = '1'
    }
    function clearInsertLine() {
      if (insertLine !== null) insertLine.dataset.show = '0'
    }

    function workspaceRowTarget(row, event) {
      const anchor = insertAnchor(row, event)
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
            workspaceId: null,
            beforeId: null,
          }
          : null
      }
      const match = (view.workspaces ?? []).find((workspace) => workspace.id === key || workspace.path === key)
      if (match !== undefined && typeof match.path === 'string' && match.path.length > 0) {
        return {
          path: match.path,
          label: match.title || match.path,
          mode: 'ws',
          hint: translateNow(anchor?.beforeId !== null && anchor?.beforeId !== undefined
            ? 'dnd.insertHere'
            : onHeader ? 'dnd.intoGroup' : 'dnd.intoGroupArea'),
          workspaceId: match.id ?? null,
          beforeId: anchor?.beforeId ?? null,
        }
      }
      return /^(?:\/|[A-Za-z]:[\\/])/.test(key) ? { path: key, label: key, workspaceId: null, beforeId: null } : null
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
        const payload = pulledDrag()
        const row = rowOf(event) ?? sidebarDrop.row
        const target = row === null || payload === null ? null : workspaceRowTarget(row, event)
        clearRowMark()
        clearGhost()
        clearInsertLine()
        if (target === null) {
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
          dragStore.drop(target, payload)
        }, 90)
      }
      const onEnd = () => {
        clearRowMark()
        clearInsertLine()
        hideDropTip()
        clearGhost()
        dragStore.clear()
      }
      // A drag that ends outside the document (window switch, OS cancel, an
      // iframe swallowing the drop) never fires dragend, so the ghost and the
      // pill would stay on screen forever. Treat every "we lost the pointer"
      // signal as the end of the drag.
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') onEnd()
      }
      document.addEventListener('dragover', onOver, true)
      document.addEventListener('drop', onDrop, true)
      document.addEventListener('dragend', onEnd, true)
      document.addEventListener('visibilitychange', onVisibility)
      // `window` inside the module factory is the host's real window; fall back
      // to `document.defaultView` so the guard also works in a bare DOM harness.
      const topWindow = (typeof window !== 'undefined' && typeof window?.addEventListener === 'function')
        ? window
        : (document.defaultView ?? null)
      topWindow?.addEventListener('blur', onEnd)
      const onLeave = (event) => {
        if (event.relatedTarget === null) onEnd()
      }
      document.addEventListener('dragleave', onLeave, true)
      return () => {
        document.removeEventListener('dragover', onOver, true)
        document.removeEventListener('drop', onDrop, true)
        document.removeEventListener('dragend', onEnd, true)
        document.removeEventListener('visibilitychange', onVisibility)
        topWindow?.removeEventListener('blur', onEnd)
        document.removeEventListener('dragleave', onLeave, true)
        clearRowMark()
        hideDropTip()
        clearGhost()
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
        ? t('plan.titlePull', { dir: plan.targetLabel ?? plan.cwd ?? t('plan.dirAuto') })
        : t('plan.titlePush', { peer: plan.peerName })
      return h('div', {
        className: 'ss-scrim',
        role: 'presentation',
        onClick: (event) => { if (event.target === event.currentTarget) onCancel() },
      },
      h('div', { className: 'ss-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { className: 'ss-dialog-hd' },
          h('h3', null, title),
          h('p', null, t('plan.summary', {
            n: plan.items.length,
            fresh: plan.items.filter((item) => !item.dup).length,
            dup: dupCount,
          })),
          dupCount > 0 ? h('div', { className: 'ss-dialog-note' },
            h(Icon, { name: 'verify', size: 12 }),
            h('span', null, t('plan.dupNote')),
          ) : null,
        ),
        h('div', { className: 'ss-dialog-body' },
          plan.items.map((item) => h('div', { className: 'ss-plan-row', key: item.sessionId },
            h('div', null,
              h('div', { className: 'ss-plan-title' }, item.title || t('sessions.untitled')),
              h('div', { className: 'ss-plan-meta' },
                h('code', null, `#${sessionTag({ id: item.sessionId })}`),
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
              : h('span', { className: 'ss-plan-fresh' }, t('plan.fresh')),
          )),
        ),
        h('div', { className: 'ss-dialog-foot' },
          dupCount > 0
            ? h('button', {
              type: 'button',
              className: 'ss-btn ghost sm',
              onClick: () => {
                const next = { ...choices }
                for (const item of plan.items) if (item.dup) next[item.sessionId] = 'keep'
                onConfirm(next)
              },
            }, t('plan.skipAll'))
            : null,
          h('span', { className: 'ss-spacer' }),
          h('button', { type: 'button', className: 'ss-btn sm', onClick: onCancel }, t('common.cancel')),
          h('button', { type: 'button', className: 'ss-btn primary sm', onClick: () => onConfirm(choices) }, t('plan.confirm')),
        ),
      ))
    }

    function queueIcon(status) {
      if (status === 'done') return h(Icon, { name: 'check', size: 14 })
      if (status === 'failed') return h(Icon, { name: 'alert', size: 14 })
      if (status === 'running') return h('span', { className: 'ss-spinner', style: { width: 13, height: 13 } })
      if (status === 'skipped') return h(Icon, { name: 'check', size: 14 })
      return h('span', { style: { color: 'var(--t3)', font: '11px/1 var(--ds-font-family-code, monospace)' } }, '…')
    }

    /**
     * Queue block: one row per transfer with its own status motion. Rendered
     * inside the stage above the dock, not as a drawer over it.
     */
    function QueuePanel({ t, queue, progress = {}, onClear, onRetry }) {
      if (!Array.isArray(queue) || queue.length === 0) return null
      const count = (status) => queue.filter((item) => item.status === status).length
      const done = count('done')
      const skipped = count('skipped')
      const failed = count('failed')
      const pending = count('pending')
      const running = count('running')
      const stat = (value, label, tone) => h('span', { className: tone ? `ss-qstat ${tone}` : 'ss-qstat' },
        h('b', null, String(value)),
        h('span', null, label),
      )
      return h('div', { className: 'ss-queue' },
        h('div', { className: 'ss-queue-hd' },
          h('h4', null, t('queue.title')),
          h('div', { className: 'ss-queue-stats' },
            stat(done, t('queue.done'), 'done'),
            h('span', { className: 'ss-sep' }, '·'),
            running > 0 ? stat(running, t('queue.running'), 'running') : stat(pending, t('queue.pending')),
            h('span', { className: 'ss-sep' }, '·'),
            stat(skipped, t('queue.skipped')),
            h('span', { className: 'ss-sep' }, '·'),
            stat(failed, t('queue.failed'), failed > 0 ? 'failed' : undefined),
          ),
          h('span', { className: 'ss-spacer' }),
          h('button', { type: 'button', className: 'ss-btn ghost xs', onClick: onClear }, t('queue.clear')),
        ),
        h('div', { className: 'ss-queue-body' },
          queue.map((item) => {
            const seconds = item.startedAt && item.endedAt ? ((item.endedAt - item.startedAt) / 1000).toFixed(1) : null
            const live = progress[`${item.peerId}::${item.sessionId}`] ?? null
            const percent = live !== null && Number.isFinite(live.total) && live.total > 0
              ? Math.min(100, Math.round((live.received / live.total) * 100))
              : null
            return h('div', { key: item.key, className: `ss-qrow ${item.status}` },
              h('span', { className: `ss-qico ${item.status}`, 'aria-hidden': 'true' }, queueIcon(item.status)),
              h('div', { className: 'ss-qmain' },
                h('div', { className: 'ss-qname', title: item.title || t('sessions.untitled') }, item.title || t('sessions.untitled')),
                h('div', { className: 'ss-qmeta' },
                  h('span', null, `${item.direction === 'pull' ? '←' : '→'} ${item.peerName}`),
                  item.cwd ? h('code', { title: item.cwd }, item.cwd) : null,
                  seconds !== null ? h('span', null, t('queue.duration', { seconds })) : null,
                ),
                item.message ? h('div', { className: 'ss-qmsg' }, item.message) : null,
              ),
              h('div', { className: 'ss-qright' },
                item.status === 'running' && percent !== null ? h('span', { className: 'pct' }, `${percent}%`) : null,
                item.status === 'failed'
                  ? h('button', { type: 'button', className: 'ss-btn ghost xs', onClick: () => onRetry(item) }, t('queue.retry'))
                  : h('span', { className: 'dur' }, t(`queue.${item.status}`)),
              ),
            )
          }),
        ),
      )
    }

    function TokenEditor({ t, value, placeholder, onChange, onSave, busy }) {
      const [draft, setDraft] = React.useState('')
      const items = String(value ?? '').split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
      const add = () => {
        const next = draft.trim()
        if (next.length === 0) return
        if (!items.includes(next)) onChange([...items, next].join('\n'))
        setDraft('')
      }
      return h('div', null,
        items.length === 0 ? null : h('div', { className: 'ss-token-list', style: { marginBottom: 6 } },
          items.map((item) => h('span', { className: 'ss-token', key: item },
            item,
            h('button', {
              type: 'button',
              className: 'ss-icon xs',
              'aria-label': t('common.clear'),
              onClick: () => onChange(items.filter((entry) => entry !== item).join('\n')),
            }, h(Icon, { name: 'x', size: 11 })),
          )),
        ),
        h('div', { className: 'ss-inline' },
          h('input', {
            className: 'ss-input',
            value: draft,
            spellCheck: false,
            placeholder,
            'aria-label': placeholder,
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') add() },
          }),
          h('button', { type: 'button', className: 'ss-btn sm', onClick: add, disabled: draft.trim().length === 0 }, t('common.add')),
          h('button', { type: 'button', className: 'ss-btn sm', onClick: onSave, disabled: busy }, t('common.save')),
        ),
      )
    }

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
      return h('div', { className: 'ss-root settings-only' },
        h('div', { className: 'ss-page' },
          h('div', { className: 'ss-settings' },
            h('div', { className: 'ss-settings-in' },
              h('div', { className: 'ss-set-hd' },
                h(Icon, { name: 'alert', size: 16 }),
                h('h2', null, t('diag.title')),
              ),
              h('p', { className: 'ss-set-sub' }, t('diag.body')),
              h('div', { className: 'ss-set-card' },
                h('div', { className: 'ss-field' },
                  h('div', { className: 'ss-field-text' },
                    h('div', { className: 'ss-field-label' }, t('diag.hint')),
                  ),
                ),
                h('pre', { className: 'ss-diag' }, lines.join('\n')),
                h('div', { className: 'ss-field' },
                  h('span', { style: { flex: 1 } }),
                  h('button', { type: 'button', className: 'ss-btn primary sm', onClick: () => location.reload() }, t('diag.reload')),
                  h('button', {
                    type: 'button',
                    className: 'ss-btn ghost sm',
                    onClick: () => { void navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined) },
                  }, t('diag.copy')),
                ),
              ),
            ),
          ),
        ),
      )
    }

    // ── redesigned shell ─────────────────────────────────────────────────
    // Icons are drawn inline so the plugin keeps its "no assets, currentColor
    // only" rule; the paths match the design draft.
    const ICONS = {
      refresh: [['path', { d: 'M13.2 7.2A5.3 5.3 0 1 0 13 10.2' }], ['path', { d: 'M13.5 3.2v4h-4' }]],
      sliders: [['path', { d: 'M2.6 5.2h10.8M2.6 10.8h10.8' }], ['circle', { cx: 6, cy: 5.2, r: 1.7 }], ['circle', { cx: 10, cy: 10.8, r: 1.7 }]],
      search: [['circle', { cx: 7.1, cy: 7.1, r: 4.3 }], ['path', { d: 'm10.4 10.4 3 3' }]],
      chevronDown: [['path', { d: 'm4.2 6.4 3.8 3.8 3.8-3.8' }]],
      chevronRight: [['path', { d: 'm6.2 3.8 4.2 4.2-4.2 4.2' }]],
      check: [['path', { d: 'm3.2 8.4 3.1 3 6.5-6.8' }]],
      x: [['path', { d: 'm4 4 8 8M12 4l-8 8' }]],
      copy: [['rect', { x: 5.4, y: 5.4, width: 7.6, height: 7.6, rx: 1.7 }], ['path', { d: 'M10.6 5.4V4.1a1.1 1.1 0 0 0-1.1-1.1H4.1A1.1 1.1 0 0 0 3 4.1v5.4a1.1 1.1 0 0 0 1.1 1.1h1.3' }]],
      pull: [['path', { d: 'M8 2.8v6.6' }], ['path', { d: 'm5.2 6.8 2.8 2.6 2.8-2.6' }], ['path', { d: 'M3 11.4v1.4h10v-1.4' }]],
      push: [['path', { d: 'M8 9.4V2.8' }], ['path', { d: 'm5.2 5.4 2.8-2.6 2.8 2.6' }], ['path', { d: 'M3 11.4v1.4h10v-1.4' }]],
      verify: [['path', { d: 'M8 2.2 12.7 4v4.1c0 2.6-1.9 4.6-4.7 5.7C5.3 12.7 3.4 10.7 3.4 8.1V4L8 2.2Z' }], ['path', { d: 'm5.9 7.9 1.5 1.5 2.9-3.1' }]],
      alert: [['path', { d: 'M8 2.7 14 13H2L8 2.7Z' }], ['path', { d: 'M8 6.6v2.9M8 11.4v.1' }]],
      folder: [['path', { d: 'M2.6 4.6a1.2 1.2 0 0 1 1.2-1.2h2.4l1.3 1.6h4.7a1.2 1.2 0 0 1 1.2 1.2v5a1.2 1.2 0 0 1-1.2 1.2H3.8a1.2 1.2 0 0 1-1.2-1.2V4.6Z' }]],
      more: [['circle', { cx: 3.4, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }], ['circle', { cx: 8, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }], ['circle', { cx: 12.6, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }]],
      plus: [['path', { d: 'M8 3.2v9.6M3.2 8h9.6' }]],
      devices: [['rect', { x: 2, y: 3, width: 8.6, height: 6.6, rx: 1.2 }], ['path', { d: 'M10.6 6.1h2.3a1 1 0 0 1 1 1v4.7a1 1 0 0 1-1 1H6.6' }], ['path', { d: 'M4.8 13.2h2.6' }]],
      clock: [['circle', { cx: 8, cy: 8, r: 5.3 }], ['path', { d: 'M8 5v3.1l2.1 1.3' }]],
      external: [['path', { d: 'M6.4 3.6H3.6v8.8h8.8V9.6' }], ['path', { d: 'M9.6 2.8h3.6v3.6M13.2 2.8 7.4 8.6' }]],
      pencil: [['path', { d: 'M11.4 2.8 13.2 4.6 5.9 11.9 3 12.9l1-2.9Z' }], ['path', { d: 'm10.2 4 1.8 1.8' }]],
      radar: [['circle', { cx: 8, cy: 8, r: 1.5 }], ['path', { d: 'M8 2.4a5.6 5.6 0 1 1-5.6 5.6' }], ['path', { d: 'M8 5.2a2.8 2.8 0 1 0 2.8 2.8' }]],
      arrowRight: [['path', { d: 'M3 8h9.2' }], ['path', { d: 'm9.2 5 3 3-3 3' }]],
      arrowLeft: [['path', { d: 'M13 8H3.8' }], ['path', { d: 'm6.8 5-3 3 3 3' }]],
      pause: [['path', { d: 'M6 3.5v9M10 3.5v9' }]],
      sort: [['path', { d: 'M5 3.2v9.6M5 12.8 2.8 10.6M5 12.8l2.2-2.2' }], ['path', { d: 'M11 12.8V3.2M11 3.2 8.8 5.4M11 3.2l2.2 2.2' }]],
    }

    function Icon({ name, size = 16, className = '' }) {
      const spec = ICONS[name]
      if (spec === undefined) return null
      return h('svg', {
        className: `i ${className}`.trim(),
        viewBox: '0 0 16 16',
        width: size,
        height: size,
        'aria-hidden': 'true',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }, spec.map(([tag, attrs], index) => h(tag, { key: index, ...attrs })))
    }

    function RowCheck({ checked, label, onChange }) {
      return h('button', {
        type: 'button',
        className: 'ss-cb',
        role: 'checkbox',
        'aria-checked': checked ? 'true' : 'false',
        'aria-label': label,
        onClick: (event) => {
          event.stopPropagation()
          onChange()
        },
      }, h(Icon, { name: 'check' }))
    }

    function DeviceRail({ t, self, selfAddress, peers, selectedId, onSelect, onOpenSettings, onCopySelf, onDrop, dropPeer }) {
      const online = peers.filter((peer) => peer.online === true)
      const offline = peers.filter((peer) => peer.online !== true)
      const row = (peer) => {
        const meta = [peer.address === undefined ? null : `${peer.address}:${peer.port ?? '—'}`]
        if (peer.online !== true) meta.push(relativeTime(t, peer.lastSeen))
        return h('button', {
          key: peer.id,
          type: 'button',
          className: `ss-dev${peer.online === true ? '' : ' offline'}`,
          'data-peer': peer.id,
          'aria-selected': selectedId === peer.id ? 'true' : 'false',
          title: t('device.sessionsCount', { n: peer.sessions ?? 0 }),
          onClick: () => onSelect(peer),
          onDragOver: (event) => {
            event.preventDefault()
            onDrop(peer, 'over')
          },
          onDragLeave: () => onDrop(peer, 'leave'),
          onDrop: (event) => {
            event.preventDefault()
            onDrop(peer, 'drop', event)
          },
        },
        h('span', { className: `ss-dot${peer.online === true ? ' on' : ' off'}` }),
        h('span', { style: { minWidth: 0 } },
          h('span', { className: 'ss-dev-name' }, peer.name ?? peer.remoteName ?? peer.address ?? peer.id),
          h('span', { className: 'ss-dev-meta' }, meta.filter((part) => part !== null).join(' · ')),
        ),
        h('span', { className: 'ss-dev-count' }, peer.sessions === undefined ? '' : String(peer.sessions)),
        )
      }
      return h('aside', { className: 'ss-rail' },
        h('div', { className: 'ss-self' },
          h('div', { className: 'ss-self-hd' },
            h('span', { className: 'ss-dot on' }),
            h('span', null, t('self.title')),
            h('button', {
              type: 'button',
              className: 'ss-icon xs',
              title: t('self.name'),
              'aria-label': t('self.name'),
              onClick: onOpenSettings,
            }, h(Icon, { name: 'pencil', size: 12 })),
          ),
          h('div', { className: 'ss-self-name' }, self?.name ?? '—'),
          h('div', { className: 'ss-self-meta' },
            h('code', null, selfAddress || '—'),
            h('button', {
              type: 'button',
              className: 'ss-icon xs',
              title: t('devices.copyAddress'),
              'aria-label': t('devices.copyAddress'),
              onClick: onCopySelf,
            }, h(Icon, { name: 'copy', size: 12 })),
          ),
        ),
        h('div', { className: 'ss-rail-scroll' },
          online.length === 0 ? null : h('div', { className: 'ss-glabel' }, h('span', null, t('status.online')), h('span', null, String(online.length))),
          online.map(row),
          offline.length === 0 ? null : h('div', { className: 'ss-glabel' }, h('span', null, t('status.offline')), h('span', null, String(offline.length))),
          offline.map(row),
          peers.length === 0
            ? h('div', { className: 'ss-rail-empty' },
              h(Icon, { name: 'devices', size: 18 }),
              h('span', null, t('devices.emptyTitle')),
            )
            : null,
          dropPeer === null || dropPeer === undefined ? null : h('div', { className: 'ss-hint', style: { padding: '8px 7px', color: 'var(--brand)' } }, t('sessions.dropHint')),
        ),
        h('div', { className: 'ss-rail-foot' },
          h('button', { type: 'button', className: 'ss-btn ghost sm', onClick: onOpenSettings },
            h(Icon, { name: 'plus', size: 14 }),
            h('span', null, t('devices.addAddress')),
          ),
          h('button', {
            type: 'button',
            className: 'ss-icon sm',
            title: t('settings.subnets'),
            'aria-label': t('settings.subnets'),
            onClick: onOpenSettings,
          }, h(Icon, { name: 'radar', size: 14 })),
        ),
      )
    }

    function EmptyStage({ t, selfAddress, manualAddress, setManualAddress, onAddManual, onCopySelf, onOpenSettings, ports, busy }) {
      return h('section', { className: 'ss-stage' },
        h('div', { className: 'ss-empty' },
          h('span', { className: 'glyph' }, h(Icon, { name: 'devices', size: 20 })),
          h('h3', null, t('empty.title')),
          h('p', null, t('empty.body')),
          h('div', { className: 'ss-addr-box' },
            h('code', null, selfAddress || '—'),
            h('button', {
              type: 'button',
              className: 'ss-icon xs',
              title: t('devices.copyAddress'),
              'aria-label': t('devices.copyAddress'),
              onClick: onCopySelf,
            }, h(Icon, { name: 'copy', size: 12 })),
          ),
          h('div', { className: 'ss-empty-actions' },
            h('input', {
              className: 'ss-input',
              value: manualAddress,
              spellCheck: false,
              placeholder: t('devices.manualPlaceholder'),
              'aria-label': t('devices.manualPlaceholder'),
              onChange: (event) => setManualAddress(event.target.value),
              onKeyDown: (event) => { if (event.key === 'Enter') onAddManual() },
            }),
            h('button', { type: 'button', className: 'ss-btn primary sm', disabled: busy || manualAddress.trim().length === 0, onClick: onAddManual }, t('common.add')),
            h('button', { type: 'button', className: 'ss-btn ghost sm', onClick: onOpenSettings },
              h('span', null, t('settings.subnets')),
              h(Icon, { name: 'chevronRight', size: 14 }),
            ),
          ),
          h('div', { className: 'ss-steps' },
            h('div', { className: 'ss-step' }, h('b', null, '1'), h('span', null, t('devices.step1'))),
            h('div', { className: 'ss-step' }, h('b', null, '2'), h('span', null, t('devices.step2'))),
            h('div', { className: 'ss-step' }, h('b', null, '3'), h('span', null, t('devices.step3'))),
          ),
          h('div', { className: 'ss-foot', style: { padding: '6px 0 0' } },
            h('span', null, t('page.ports', { lan: ports?.lan ?? '—', discovery: ports?.discovery ?? '—' })),
          ),
        ),
      )
    }

    function baseName(value) {
      const parts = String(value ?? '').split(/[\\/]/).filter((part) => part.length > 0)
      return parts[parts.length - 1] ?? ''
    }

    function SessionStage({
      t, peer, view, onView, sessions, localSessions, busy, selected, onToggle, onToggleAll,
      onClearSelection, digests, onVerify, onCopyDigest, onPull, onPush, onForgetImport, onPullAll,
      target, onTarget, workspaces, syncDir, extraPaths, pathDraft, onPathDraft, onAddPath,
      queue, progress, queueOpen, onQueueOpen, queueDone, barPercent, queueRunning, activeTitle,
      onClearQueue, onRetry, dragStart, onAction, onRename,
    }) {
      const [query, setQuery] = React.useState('')
      const [filter, setFilter] = React.useState('all')
      const [sort, setSort] = React.useState('time')
      const [cursor, setCursor] = React.useState(-1)
      const [menu, setMenu] = React.useState(false)
      const [renaming, setRenaming] = React.useState(false)
      const [draft, setDraft] = React.useState(peer?.name ?? '')
      const [targetOpen, setTargetOpen] = React.useState(false)
      const searchRef = React.useRef(null)
      const menuRef = React.useRef(null)
      const targetRef = React.useRef(null)

      React.useEffect(() => {
        focusSearch.current = () => searchRef.current?.focus()
        return () => { if (focusSearch.current !== null) focusSearch.current = null }
      }, [])

      React.useEffect(() => {
        setMenu(false)
        setTargetOpen(false)
        setRenaming(false)
        setCursor(-1)
      }, [peer?.id, view])

      React.useEffect(() => {
        if (!renaming) setDraft(peer?.name ?? '')
      }, [renaming, peer?.id, peer?.name])

      React.useEffect(() => {
        if (!menu && !targetOpen) return undefined
        const close = (event) => {
          if (menu && menuRef.current !== null && !menuRef.current.contains(event.target)) setMenu(false)
          if (targetOpen && targetRef.current !== null && !targetRef.current.contains(event.target)) setTargetOpen(false)
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
      }, [menu, targetOpen])

      const list = view === 'peer' ? (Array.isArray(sessions) ? sessions : []) : (Array.isArray(localSessions) ? localSessions : [])
      const loading = busy || (view === 'peer' ? sessions === null || sessions === undefined : localSessions === null || localSessions === undefined)
      const importedCount = list.filter((session) => session.imported !== null && session.imported !== undefined).length
      const freshCount = list.length - importedCount
      const needle = query.trim().toLowerCase()
      const visible = list
        .filter((session) => {
          if (view === 'peer') {
            if (filter === 'new' && session.imported !== null && session.imported !== undefined) return false
            if (filter === 'done' && (session.imported === null || session.imported === undefined)) return false
          }
          if (needle === '') return true
          return `${session.title ?? ''} ${sessionTag(session)} ${session.cwd ?? ''}`.toLowerCase().includes(needle)
        })
        .sort((a, b) => {
          if (sort === 'title') return (a.title ?? '').localeCompare(b.title ?? '')
          return (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
        })
      const runningBySession = new Map(queue.map((item) => [item.sessionId, item.status]))
      const allSelected = visible.length > 0 && visible.every((session) => selected.includes(session.id))
      const count = selected.length
      const countLabel = count === 0
        ? ''
        : t('sessions.selected', { n: count })
      const targetLabel = target?.label
        ?? (typeof syncDir === 'string' && syncDir.length > 0 ? baseName(syncDir) : t('settings.unsortedShort'))
      const currentPath = target?.path ?? syncDir ?? ''

      const commitRename = () => {
        const name = draft.trim()
        if (name.length > 0 && peer !== null && peer !== undefined) onRename(peer, name)
        setRenaming(false)
      }

      const pullOne = (session) => onPull(session)
      const pushOne = (session) => onPush(session)
      const startSelected = () => {
        if (view === 'peer') onPull(selected)
        else onPush(selected)
      }

      const statusChip = (session) => {
        if (view === 'local') return null
        const queueStatus = runningBySession.get(session.id)
        if (queueStatus === 'running' || queueStatus === 'pending') {
          return h('span', { className: `ss-chip${queueStatus === 'running' ? ' brand' : ''}` },
            queueStatus === 'running' ? h('span', { className: 'ss-spinner', style: { width: 10, height: 10 } }) : null,
            t(queueStatus === 'running' ? 'sessions.pulling' : 'sessions.queued'),
          )
        }
        const digest = digests?.[session.id] ?? null
        if (digest?.busy === true) {
          return h('span', { className: 'ss-chip brand' }, h('span', { className: 'ss-spinner', style: { width: 10, height: 10 } }), t('sessions.verifying'))
        }
        if (digest?.verified === false) {
          return h('span', { className: 'ss-chip bad' }, h(Icon, { name: 'alert', size: 11 }), t('sessions.verifyFailedShort'))
        }
        if (session.imported !== null && session.imported !== undefined) {
          return h('span', { className: 'ss-chip ok' }, h(Icon, { name: 'check', size: 11 }), t('sessions.synced'))
        }
        return h('span', { className: 'ss-chip' }, t('sessions.notSynced'))
      }

      const digestStrip = (session) => {
        const digest = digests?.[session.id]
        if (digest === undefined || digest === null) return null
        if (digest.busy === true) {
          return h('div', { className: 'ss-digest' },
            h('span', { className: 'ss-spinner', style: { width: 12, height: 12 } }),
            h('span', null, t('sessions.verifying')),
          )
        }
        if (typeof digest.sha256 !== 'string' || digest.sha256.length === 0) return null
        const bad = digest.verified === false
        const ok = digest.verified === true
        return h('div', { className: `ss-digest${ok ? ' ok' : ''}${bad ? ' bad' : ''}` },
          h(Icon, { name: bad ? 'alert' : 'check', size: 14 }),
          h('div', { className: 'grow' },
            h('code', { title: digest.sha256 }, t(
              digest.verified === null ? 'sessions.noDigest' : bad ? 'sessions.verifyFailed' : 'sessions.verified',
              { hash: bad ? digest.sha256 : `${digest.sha256.slice(0, 12)}…` },
            )),
          ),
          h('button', {
            type: 'button',
            className: 'ss-btn ghost xs',
            title: t('sessions.hashHint'),
            onClick: (event) => { event.stopPropagation(); onCopyDigest(session) },
          }, t('sessions.copyHash')),
          bad ? h('button', {
            type: 'button',
            className: 'ss-btn ghost xs',
            onClick: (event) => { event.stopPropagation(); onVerify(session) },
          }, t('sessions.verify')) : null,
        )
      }

      const actions = (session) => {
        const digest = digests?.[session.id] ?? null
        if (view === 'local') {
          return h('div', { className: 'ss-row-act' },
            h('button', { type: 'button', className: 'ss-btn ghost xs', onClick: (event) => { event.stopPropagation(); pushOne(session) } }, t('sessions.pushShort')),
          )
        }
        const imported = session.imported !== null && session.imported !== undefined
        return h('div', { className: 'ss-row-act' },
          imported
            ? h('button', { type: 'button', className: 'ss-btn ghost xs', disabled: digest?.busy === true, onClick: (event) => { event.stopPropagation(); onVerify(session) } }, t('sessions.verify'))
            : h('button', { type: 'button', className: 'ss-btn ghost xs', onClick: (event) => { event.stopPropagation(); pullOne(session) } }, t('sessions.pullShort')),
          imported
            ? h('button', { type: 'button', className: 'ss-btn ghost xs', onClick: (event) => { event.stopPropagation(); onForgetImport(session) } }, t('common.clear'))
            : h('button', { type: 'button', className: 'ss-btn ghost xs', disabled: digest?.busy === true, onClick: (event) => { event.stopPropagation(); onVerify(session) } }, t('sessions.verify')),
        )
      }

      const onListKeyDown = (event) => {
        const tag = event.target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (visible.length === 0) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setCursor((current) => (event.key === 'ArrowDown'
            ? Math.min(visible.length - 1, current + 1)
            : Math.max(0, current - 1)))
          return
        }
        const session = visible[Math.max(0, cursor)]
        if (session === undefined) return
        if (event.key === ' ') {
          event.preventDefault()
          onToggle(session.id, event)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          if (view === 'peer') pullOne(session)
          else pushOne(session)
        }
      }

      const targetOption = (label, path, value, note) => h('button', {
        key: `${label}:${path}`,
        type: 'button',
        className: 'ss-opt',
        role: 'menuitemradio',
        'aria-checked': currentPath === path ? 'true' : 'false',
        title: path,
        onClick: () => { onTarget(value); setTargetOpen(false) },
      },
      h('span', { className: 'ss-opt-main' },
        h('span', { className: 'ss-opt-name' }, label, currentPath === path ? h('span', { className: 'ss-chip ok' }, t('settings.current')) : null),
        h('span', { className: 'ss-opt-path' }, path || note),
      ),
      currentPath === path ? h(Icon, { name: 'check', size: 14, className: 'check' }) : null,
      )

      const menuButton = (label, action, danger) => h('button', {
        key: action,
        type: 'button',
        className: `ss-menu-item${danger ? ' danger' : ''}`,
        onClick: () => { setMenu(false); onAction(action, peer) },
      }, label)

      return h('section', { className: 'ss-stage' },
        h('header', { className: 'ss-stage-hd' },
          h('div', { className: 'ss-stage-id' },
            h('span', { className: `ss-dot${peer.online === true ? ' on' : ' off'}` }),
            h('div', { style: { minWidth: 0 } },
              renaming
                ? h('div', { className: 'ss-inline' },
                  h('input', {
                    className: 'ss-input',
                    value: draft,
                    autoFocus: true,
                    placeholder: peer.remoteName ?? t('device.namePlaceholder'),
                    'aria-label': t('device.rename'),
                    onChange: (event) => setDraft(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') commitRename()
                      if (event.key === 'Escape') setRenaming(false)
                    },
                  }),
                  h('button', { type: 'button', className: 'ss-btn primary sm', onClick: commitRename }, t('common.save')),
                  h('button', { type: 'button', className: 'ss-btn ghost sm', onClick: () => setRenaming(false) }, t('common.cancel')),
                )
                : h('div', { className: 'ss-stage-name', title: peer.name }, peer.name ?? peer.address ?? peer.id),
              h('div', { className: 'ss-stage-meta' },
                h('code', null, `${peer.address ?? '—'}:${peer.port ?? '—'}`),
                h('span', { className: 'ss-sep' }, '·'),
                h('span', null, h('b', null, String(peer.sessions ?? list.length)), ' ', t('device.sessionsUnit')),
                peer.platform === undefined ? null : h('span', { className: 'ss-sep' }, '·'),
                peer.platform === undefined ? null : h('span', null, peer.platform),
                peer.version === undefined ? null : h('span', { className: 'ss-sep' }, '·'),
                peer.version === undefined ? null : h('span', null, `v${peer.version}`),
              ),
            ),
          ),
          h('div', { className: 'ss-stage-actions' },
            view === 'peer'
              ? h('button', {
                type: 'button',
                className: 'ss-btn primary sm',
                disabled: busy || peer.online !== true,
                onClick: onPullAll,
              }, h(Icon, { name: 'pull', size: 14 }), t('device.pullAll'))
              : null,
            h('div', { className: 'ss-menu-wrap', ref: menuRef },
              h('button', {
                type: 'button',
                className: 'ss-icon sm',
                title: t('device.menu'),
                'aria-label': t('device.menu'),
                'aria-expanded': menu ? 'true' : 'false',
                onClick: () => setMenu((value) => !value),
              }, h(Icon, { name: 'more', size: 14 })),
              menu ? h('div', { className: 'ss-menu', role: 'menu' },
                menuButton(t('device.pushHere'), 'push'),
                h('button', {
                  type: 'button',
                  className: 'ss-menu-item',
                  onClick: () => { setMenu(false); setRenaming(true); setDraft(peer.name ?? '') },
                }, t('device.rename')),
                menuButton(t('device.copyAddress'), 'copy'),
                menuButton(t('device.refresh'), 'refresh'),
                menuButton(t('device.forget'), 'forget', true),
              ) : null,
            ),
          ),
        ),

        h('div', { className: 'ss-tabs', role: 'tablist' },
          h('button', {
            type: 'button', role: 'tab', className: 'ss-tab', 'aria-selected': view === 'peer' ? 'true' : 'false',
            onClick: () => onView('peer'),
          }, h(Icon, { name: 'pull', size: 14 }), t('dir.pull'), h('b', null, String(peer.sessions ?? sessions?.length ?? 0))),
          h('button', {
            type: 'button', role: 'tab', className: 'ss-tab', 'aria-selected': view === 'local' ? 'true' : 'false',
            onClick: () => onView('local'),
          }, h(Icon, { name: 'push', size: 14 }), t('dir.push'), h('b', null, String(localSessions?.length ?? 0))),
        ),

        view === 'local'
          ? h('div', { className: 'ss-note-row' },
            h(Icon, { name: 'arrowRight', size: 12 }),
            h('span', null, t('stage.pushHint', { peer: peer.name })),
          )
          : null,

        h('div', { className: 'ss-tools' },
          h(RowCheck, {
            checked: allSelected,
            label: t('sessions.selectAll'),
            onChange: () => onToggleAll(visible.map((session) => session.id)),
          }),
          h('div', { className: 'ss-search' },
            h(Icon, { name: 'search', size: 14 }),
            h('input', {
              ref: searchRef,
              type: 'text',
              value: query,
              spellCheck: false,
              placeholder: t('sessions.search'),
              'aria-label': t('sessions.search'),
              onChange: (event) => { setQuery(event.target.value); setCursor(-1) },
            }),
            h('kbd', null, '/'),
          ),
          view === 'peer'
            ? h('div', { className: 'ss-filters', role: 'group' },
              h('button', { type: 'button', className: 'ss-filter', 'aria-pressed': filter === 'all' ? 'true' : 'false', onClick: () => { setFilter('all'); setCursor(-1) } }, t('sessions.filterAll', { n: list.length })),
              h('button', { type: 'button', className: 'ss-filter', 'aria-pressed': filter === 'new' ? 'true' : 'false', onClick: () => { setFilter('new'); setCursor(-1) } }, t('sessions.filterNew', { n: freshCount })),
              h('button', { type: 'button', className: 'ss-filter', 'aria-pressed': filter === 'done' ? 'true' : 'false', onClick: () => { setFilter('done'); setCursor(-1) } }, t('sessions.filterDone', { n: importedCount })),
            )
            : null,
          h('button', {
            type: 'button',
            className: 'ss-btn ghost sm ss-sort',
            title: t('sessions.focusHint'),
            onClick: () => setSort((value) => (value === 'time' ? 'title' : 'time')),
          }, t(sort === 'time' ? 'sessions.sortTime' : 'sessions.sortTitle'), h(Icon, { name: 'chevronDown', size: 14 })),
        ),

        h('div', { className: 'ss-list', role: 'listbox', 'aria-multiselectable': 'true', onKeyDown: onListKeyDown },
          loading
            ? h('div', { className: 'ss-empty' }, t('common.loading'))
            : visible.length === 0
              ? h('div', { className: 'ss-empty' },
                h('span', { className: 'glyph' }, h(Icon, { name: 'search', size: 18 })),
                h('h3', null, t('sessions.empty')),
                h('p', null, needle.length > 0 || filter !== 'all' ? t('sessions.emptyFiltered') : t('sessions.emptyBody')),
              )
              : visible.map((session, index) => {
                const digest = digests?.[session.id] ?? null
                const isSelected = selected.includes(session.id)
                const imported = session.imported !== null && session.imported !== undefined
                return h(React.Fragment, { key: session.id },
                  h('div', {
                    className: `ss-row${view === 'local' ? ' push' : ''}${isSelected ? ' selected' : ''}${cursor === index ? ' cursor' : ''}`,
                    role: 'option',
                    'aria-selected': isSelected ? 'true' : 'false',
                    tabIndex: 0,
                    draggable: true,
                    onDragStart: (event) => dragStart?.(event, session),
                    onDragEnd: () => dragStore.clear(),
                    onFocus: () => setCursor(index),
                    onClick: (event) => {
                      if (event.target.closest('button, input, a, select, label, .ss-row-act')) return
                      if (String(window.getSelection?.() ?? '').length > 0) return
                      if (isSelected && selected.length === 1 && event.metaKey !== true && event.ctrlKey !== true && event.shiftKey !== true) {
                        onClearSelection()
                        return
                      }
                      onToggle(session.id, event)
                    },
                  },
                  h(RowCheck, {
                    checked: isSelected,
                    label: `${session.title || t('sessions.untitled')} #${sessionTag(session)}`,
                    onChange: () => onToggle(session.id),
                  }),
                  h('div', { className: 'ss-row-main' },
                    h('div', { className: 'ss-row-title' }, session.title || t('sessions.untitled')),
                    h('div', { className: 'ss-row-meta' },
                      h('code', null, `#${sessionTag(session)}`),
                      h('span', { className: 'ss-sep' }, '·'),
                      h('span', null, shortDate(session.updatedAt ?? session.createdAt)),
                      session.cwd ? h('span', { className: 'ss-sep' }, '·') : null,
                      session.cwd ? h('span', { className: 'ss-path', title: session.cwd }, session.cwd) : null,
                      typeof session.events === 'number' ? h('span', { className: 'ss-sep' }, '·') : null,
                      typeof session.events === 'number' ? h('span', null, t('sessions.events', { n: session.events })) : null,
                    ),
                  ),
                  h('div', { className: 'ss-row-trail' }, statusChip(session)),
                  actions(session),
                  ),
                  digestStrip(session),
                )
              }),
        ),

        count > 0
          ? h('div', { className: 'ss-selbar' },
            h('span', { className: 'count' }, t('sessions.selected', { n: count })),
            view === 'peer'
              ? h('div', { className: 'ss-target-wrap', ref: targetRef },
                h('button', {
                  type: 'button',
                  className: 'ss-target',
                  'aria-expanded': targetOpen ? 'true' : 'false',
                  'aria-haspopup': 'menu',
                  onClick: () => setTargetOpen((value) => !value),
                },
                h('span', null, t('sessions.pullTo')),
                h('span', null, targetLabel),
                h(Icon, { name: 'chevronDown', size: 14 }),
                ),
                targetOpen ? h('div', { className: 'ss-popover', role: 'menu' },
                  h('div', { className: 'ss-pop-hd' }, h('span', null, t('target.title')), h('span', { style: { flex: 1 } }), h('span', null, t('target.count', { n: 1 + workspaces.length + extraPaths.length }))),
                  targetOption(t('settings.unsortedShort'), syncDir || t('settings.syncUnsorted'), null, t('settings.syncUnsorted')),
                  workspaces.map((workspace) => targetOption(workspace.title, workspace.path, { path: workspace.path, workspaceId: workspace.id, label: workspace.title }, workspace.path)),
                  extraPaths.map((path) => targetOption(baseName(path), path, { path, label: baseName(path) }, path)),
                  h('div', { className: 'ss-pop-foot' },
                    h('div', { className: 'ss-inline' },
                      h('input', {
                        className: 'ss-input',
                        value: pathDraft,
                        spellCheck: false,
                        placeholder: t('workspaces.placeholder'),
                        'aria-label': t('workspaces.add'),
                        onChange: (event) => onPathDraft(event.target.value),
                        onKeyDown: (event) => { if (event.key === 'Enter') onAddPath(pathDraft) },
                      }),
                      h('button', { type: 'button', className: 'ss-btn sm', disabled: pathDraft.trim().length === 0, onClick: () => onAddPath(pathDraft) }, t('common.add')),
                    ),
                  ),
                  h('div', { className: 'ss-pop-note' }, t('target.note')),
                ) : null,
              )
              : h('span', { className: 'ss-chip brand' }, h(Icon, { name: 'push', size: 11 }), peer.name),
            h('span', { className: 'ss-spacer' }),
            h('button', { type: 'button', className: 'ss-btn ghost xs', onClick: onClearSelection }, t('sessions.clearSelection')),
            h('button', { type: 'button', className: 'ss-btn primary sm', onClick: startSelected },
              h(Icon, { name: view === 'peer' ? 'pull' : 'push', size: 14 }),
              t(view === 'peer' ? 'sessions.syncSelected' : 'sessions.pushSelected'),
            ),
          )
          : null,

        queue.length > 0 && queueOpen
          ? h(QueuePanel, { t, queue, progress, onClear: onClearQueue, onRetry })
          : null,

        queue.length > 0
          ? h('div', {
            className: `ss-dock${queueRunning ? ' running' : ''}`,
            role: 'button',
            tabIndex: 0,
            onClick: () => onQueueOpen(!queueOpen),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onQueueOpen(!queueOpen) }
            },
          },
          queueRunning ? h('span', { className: 'ss-spinner' }) : h(Icon, { name: 'check', size: 14 }),
          h('div', { className: 'ss-dock-main' },
            h('b', null, queueRunning ? `${t('queue.running')} ${queueDone}/${queue.length}` : t('queue.title')),
            activeTitle === null ? null : h('span', { className: 'ss-dock-title' }, activeTitle),
            h('span', { className: 'ss-dock-pct' }, `${Math.round(barPercent)}%`),
          ),
          h('div', { className: 'meter', 'aria-hidden': 'true' }, h('i', { style: { width: `${barPercent}%` } })),
          h('button', {
            type: 'button',
            className: 'ss-btn ghost xs',
            onClick: (event) => { event.stopPropagation(); onQueueOpen(!queueOpen) },
          }, queueOpen ? t('queue.close') : t('queue.open')),
          )
          : null,
      )
    }

    function SettingsView({
      t, surface, busy, self, platform, workspaces, selfAddress, selfName, onSelfNameChange, onSaveSelfName, onCopySelf,
      override, changeLanguage, syncDir, syncDraft, onSyncDraft, onSaveSyncDir,
      autoPull, onToggleAutoPull, concurrency, autoConcurrency, onSaveConcurrency,
      seeds, onSeeds, onSaveSeeds, subnets, onSubnets, onSaveSubnets,
      advancedOpen, onAdvancedOpen, ports, probe, onRepair,
      version, hostVersion, repo, onBack,
    }) {
      const isPanel = surface === 'panel'
      const row = (label, note, ...body) => h('div', { className: 'ss-field' },
        h('div', { className: 'ss-field-text' },
          h('div', { className: 'ss-field-label' }, label),
          note === null || note === undefined ? null : h('div', { className: 'ss-field-note' }, note),
        ),
        h('div', { className: 'ss-field-body' }, ...body),
      )
      const section = (title, ...content) => h('section', { className: 'ss-set-sec' },
        h('h3', null, title),
        h('div', { className: 'ss-set-card' }, ...content),
      )
      const identity = section(t('settings.identity'),
        row(t('self.name'), t('self.hint'),
          h('input', {
            className: 'ss-input',
            style: { width: 214 },
            value: selfName,
            spellCheck: false,
            'aria-label': t('self.name'),
            onChange: (event) => onSelfNameChange(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') onSaveSelfName() },
          }),
          h('button', { type: 'button', className: 'ss-btn primary sm', disabled: busy || selfName.trim().length === 0, onClick: onSaveSelfName }, t('common.save')),
        ),
        row(t('settings.address'), selfAddress || '—',
          h('button', { type: 'button', className: 'ss-btn sm', onClick: onCopySelf }, t('common.copy')),
        ),
        row(t('settings.platform'), null,
          h('span', { className: 'ss-chip mono' }, platform ?? '—'),
          h('span', { className: 'ss-chip mono' }, `v${version}`),
        ),
      )
      const transfer = section(t('settings.transfer'),
        row(t('settings.language'), t('settings.languageHint'),
          h('select', {
            className: 'ss-select',
            value: override,
            disabled: busy,
            'aria-label': t('settings.language'),
            onChange: (event) => changeLanguage(event.target.value),
          },
          h('option', { value: 'auto' }, t('settings.languageAuto')),
          h('option', { value: 'zh' }, '中文'),
          h('option', { value: 'en' }, 'English'),
          ),
        ),
        row(t('settings.syncDir'), t('settings.syncDirHint'),
          h('select', {
            className: 'ss-select',
            value: syncDir,
            disabled: busy,
            'aria-label': t('settings.syncDir'),
            onChange: (event) => { if (event.target.value !== '__custom__') onSaveSyncDir(event.target.value) },
          },
          h('option', { value: '' }, t('settings.syncUnsorted')),
          (workspaces ?? []).map((workspace) => h('option', { key: workspace.id, value: workspace.path }, workspace.title)),
          syncDir !== '' && !(workspaces ?? []).some((workspace) => workspace.path === syncDir)
            ? h('option', { value: syncDir }, baseName(syncDir))
            : null,
          h('option', { value: '__custom__' }, t('settings.syncCustom')),
          ),
        ),
        row(t('settings.syncCustom'), t('settings.syncCustomPlaceholder'),
          h('input', {
            className: 'ss-input',
            style: { width: 214 },
            value: syncDraft,
            spellCheck: false,
            placeholder: t('settings.syncCustomPlaceholder'),
            'aria-label': t('settings.syncCustom'),
            onChange: (event) => onSyncDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') onSaveSyncDir(syncDraft.trim()) },
          }),
          h('button', { type: 'button', className: 'ss-btn sm', disabled: busy || syncDraft.trim().length === 0, onClick: () => onSaveSyncDir(syncDraft.trim()) }, t('settings.syncDirSave')),
        ),
        row(t('settings.autoPull'), t('settings.autoPullHint'),
          h('button', {
            type: 'button',
            className: 'ss-switch',
            role: 'switch',
            'aria-checked': autoPull ? 'true' : 'false',
            'aria-label': t('settings.autoPullLabel'),
            disabled: busy,
            onClick: () => onToggleAutoPull(!autoPull),
          }),
        ),
        row(t('settings.concurrency'), t('settings.concurrencyHint'),
          h('select', {
            className: 'ss-select',
            value: String(concurrency ?? 0),
            disabled: busy,
            'aria-label': t('settings.concurrency'),
            onChange: (event) => onSaveConcurrency(Number(event.target.value)),
          },
          h('option', { value: '0' }, t('settings.concurrencyAuto', { n: autoConcurrency ?? 5 })),
          h('optgroup', { label: t('settings.concurrencyManual') },
            Array.from({ length: 16 }, (_, index) => index + 1).map((value) => h('option', { key: value, value: String(value) }, String(value))),
          )),
        ),
      )
      const advanced = section(t('settings.advanced'),
        h('button', {
          type: 'button',
          className: 'ss-adv-toggle',
          'aria-expanded': advancedOpen ? 'true' : 'false',
          onClick: () => onAdvancedOpen(!advancedOpen),
        },
        h(Icon, { name: 'chevronRight', size: 14 }),
        h('span', null, t('settings.advancedHint')),
        ),
        advancedOpen ? h(React.Fragment, null,
          row(t('settings.ports'), t('page.ports', { lan: ports?.lan ?? '—', discovery: ports?.discovery ?? '—' }), null),
          h('div', { className: 'ss-field stack' },
            h('div', { className: 'ss-field-text' },
              h('div', { className: 'ss-field-label' }, t('settings.seeds')),
              h('div', { className: 'ss-field-note' }, t('settings.seedsHint')),
            ),
            h(TokenEditor, {
              t,
              value: seeds,
              placeholder: '192.168.1.20:47801',
              onChange: onSeeds,
              onSave: onSaveSeeds,
              busy,
            }),
          ),
          h('div', { className: 'ss-field stack' },
            h('div', { className: 'ss-field-text' },
              h('div', { className: 'ss-field-label' }, t('settings.subnets')),
              h('div', { className: 'ss-field-note' }, t('settings.subnetsHint')),
            ),
            h(TokenEditor, {
              t,
              value: subnets,
              placeholder: '192.168.5.0/24',
              onChange: onSubnets,
              onSave: onSaveSubnets,
              busy,
            }),
            probe !== undefined && probe.targets > 0 && probe.at > 0
              ? h('div', { className: 'ss-field-note', style: { marginTop: 8 } }, t('settings.probeStatus', { at: shortClock(probe.at), n: probe.targets, found: probe.found }))
              : null,
          ),
          row(t('settings.repair'), t('settings.repairHint'),
            h('button', { type: 'button', className: 'ss-btn sm', disabled: busy, onClick: onRepair }, t('settings.repairAction')),
          ),
        ) : null,
      )
      const about = section(t('settings.about'),
        row(t('settings.version'), null, h('span', { className: 'ss-chip mono' }, version)),
        hostVersion === undefined ? null : row(t('settings.hostVersion'), null, h('span', { className: 'ss-chip mono' }, hostVersion)),
        row(t('footer.repo'), null, h('a', {
          className: 'ss-btn ghost sm',
          href: repo ?? 'https://github.com/XXGxiaoyu/dsh-session-sync',
          target: '_blank',
          rel: 'noreferrer noopener',
          style: { textDecoration: 'none' },
        }, t('common.open'), h(Icon, { name: 'external', size: 14 }))),
        row(t('footer.license'), null, h('span', { className: 'ss-chip mono' }, 'MIT')),
      )
      return h('div', { className: `ss-settings${isPanel ? ' cols' : ''}` },
        isPanel
          ? h('div', { className: 'ss-set-view-hd' },
            h('h2', null, t('settings.title')),
            h('span', null, t('settings.intro')),
            h('span', { className: 'ss-spacer' }),
            h('button', { type: 'button', className: 'ss-btn sm', onClick: onBack },
              h(Icon, { name: 'arrowLeft', size: 14 }),
              h('span', null, t('settings.backToDesk')),
            ),
          )
          : h('div', { className: 'ss-set-hd' },
            h('h2', { style: { fontSize: 20, lineHeight: '28px' } }, t('page.title')),
          ),
        isPanel ? null : h('p', { className: 'ss-set-sub' }, t('settings.intro')),
        h('div', { className: 'ss-settings-in' },
          h('div', { className: 'ss-set-col' }, identity, transfer),
          h('div', { className: 'ss-set-col' }, advanced, about),
        ),
      )
    }

    function SettingsPage({ t, surface = 'panel' }) {
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
      const [view, setView] = React.useState('peer')
      const [peerSessions, setPeerSessions] = React.useState({})
      const [localSessions, setLocalSessions] = React.useState(null)
      const [pushTarget, setPushTarget] = React.useState(null)
      const [digests, setDigests] = React.useState({})
      const [selected, setSelected] = React.useState([])
      const [plan, setPlan] = React.useState(null)
      const [queue, setQueue] = React.useState([])
      const [queueOpen, setQueueOpen] = React.useState(false)
      const [settingsOpen, setSettingsOpen] = React.useState(surface !== 'panel')
      const [target, setTarget] = React.useState(null)
      const [advancedOpen, setAdvancedOpen] = React.useState(surface === 'panel')
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

      const selectPeer = (peer) => {
        setOpenPeer(peer.id)
        setView('peer')
        void loadPeerSessions(peer)
      }


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
      const repairLegacyLogs = async () => {
        setBusy(true)
        setNotice(null)
        try {
          const body = await api('repairLogs', {})
          setNotice(body.repaired > 0
            ? { kind: 'ok', key: 'notice.repairDone', params: { repaired: body.repaired, scanned: body.scanned } }
            : { kind: 'ok', key: 'notice.repairNone' })
          await snapshot.reload()
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        } finally {
          setBusy(false)
        }
      }

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
        // Selecting a device never collapses the pane: the list is always the
        // detail view for whichever device is selected on the left.
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
      const openPullPlan = (peer, ids, target) => {
        const cwd = typeof target === 'string' ? target : (target?.path ?? null)
        const workspaceId = typeof target === 'object' && target !== null ? (target.workspaceId ?? null) : null
        const beforeId = typeof target === 'object' && target !== null ? (target.beforeId ?? null) : null
        const targetLabel = typeof target === 'object' && target !== null ? (target.label ?? null) : null
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
        setPlan({
          direction: 'pull',
          peerId: peer.id,
          peerName: peer.name,
          cwd: cwd ?? null,
          workspaceId,
          beforeId,
          targetLabel,
          items,
        })
      }

      // The drop layer lives in a different slot; route its drops back into the
      // page that owns peer sessions and the confirmation dialog.
      React.useEffect(() => {
        const releaseHandler = dragStore.setHandler((payload, target) => {
          const peer = peerById(payload.peerId)
          if (peer === null) return
          openPullPlan(peer, payload.ids, target)
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

      // Claim one pending item atomically, so N workers never pick the same row.
      const claimNext = () => {
        let picked = null
        queueWrite((current) => current.map((item) => {
          if (picked !== null || item.status !== 'pending') return item
          picked = { ...item, status: 'running', message: '', startedAt: Date.now() }
          return picked
        }))
        return picked
      }

      const drain = async () => {
        if (running.current) return
        running.current = true
        const limit = Math.max(1, Number(snapshot.concurrency) || 5)
        const worker = async () => {
          for (;;) {
            const next = claimNext()
            if (next === null) return
            try {
              const body = next.direction === 'pull'
                ? await api('pull', {
                  peerId: next.peerId,
                  sessionId: next.sessionId,
                  cwd: next.cwd ?? undefined,
                  force: next.force === true,
                  workspace: next.workspaceId ?? undefined,
                  before: next.beforeId ?? undefined,
                })
                : await api('push', { peerId: next.peerId, sessionId: next.sessionId, force: next.force === true })
              const skipped = body?.skipped === true
              updateItem(next.key, { status: skipped ? 'skipped' : 'done', endedAt: Date.now() })
            } catch (error) {
              updateItem(next.key, { status: 'failed', message: String(error?.message ?? error), endedAt: Date.now() })
            }
          }
        }
        try {
          await Promise.all(Array.from({ length: limit }, () => worker()))
        } finally {
          running.current = false
        }
        await snapshot.reload()
        const currentPeer = openPeer
        if (currentPeer !== null) {
          try { await reloadPeer(currentPeer) } catch { /* list refreshes on next open */ }
        }
      }

      const saveConcurrency = async (value) => {
        await run('notice.concurrencySaved', async () => {
          await api('settings', { patch: { concurrency: value } })
          return null
        })
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
            workspaceId: plan.workspaceId ?? null,
            beforeId: plan.beforeId ?? null,
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
      // The panel opens on a useful screen: the first online device is selected
      // (and its sessions loaded) instead of showing an empty pane.
      React.useEffect(() => {
        if (openPeer !== null) return
        const first = remotePeers.find((peer) => peer.online) ?? remotePeers[0]
        if (first === undefined) return
        setOpenPeer(first.id)
        void loadPeerSessions(first)
      }, [remotePeers.length])

      React.useEffect(() => {
        if (view !== 'local' || localSessions !== null) return
        let alive = true
        api('localSessions', { limit: 80 })
          .then((body) => { if (alive) setLocalSessions(body.sessions ?? []) })
          .catch(() => {})
        return () => { alive = false }
      }, [view, localSessions])

      const imports = snapshot.imports ?? []
      const cwds = React.useMemo(() => {
        const map = new Map()
        const add = (cwd) => {
          if (typeof cwd !== 'string' || cwd.length === 0) return
          map.set(cwd, (map.get(cwd) ?? 0) + 1)
        }
        for (const session of localSessions ?? []) add(session.cwd)
        for (const session of Object.values(peerSessions).flat()) if (session !== undefined && session !== null) add(session.cwd)
        for (const path of extraPaths) if (!map.has(path)) map.set(path, 0)
        return [...map.entries()].map(([cwd, count]) => ({ cwd, count }))
      }, [localSessions, peerSessions, extraPaths])

      const openSession = openPeer === null ? null : peerById(openPeer)
      const selectedPeer = remotePeers.find((peer) => peer.id === openPeer) ?? null
      const list = openPeer === null ? [] : (peerSessions[openPeer] ?? [])
      const pushPeer = pushTarget === null ? null : peerById(pushTarget)

      const selfAddress = typeof snapshot.self?.ip === 'string'
        ? `${snapshot.self.ip}:${snapshot.ports?.lan ?? snapshot.self?.port ?? '—'}`
        : ''
      const selfDiscoveryAddress = typeof snapshot.self?.ip === 'string'
        ? `${snapshot.self.ip}:${snapshot.ports?.discovery ?? '—'}`
        : ''
      const queueDone = queue.filter((item) => item.status === 'done' || item.status === 'skipped').length
      const queueBusy = queue.some((item) => item.status === 'running' || item.status === 'pending')
      // A 4 s poll makes a live progress bar lie; while transfers run, ask the
      // host for byte counters far more often, and go back to idle polling after.
      React.useEffect(() => {
        if (!queueBusy) return undefined
        const timer = setInterval(() => { void snapshot.reload() }, 700)
        timer?.unref?.()
        return () => clearInterval(timer)
      }, [queueBusy, snapshot.reload])

      const queueRunningItem = queue.find((item) => item.status === 'running') ?? null
      const runningKey = queueRunningItem === null ? null : `${queueRunningItem.peerId}::${queueRunningItem.sessionId}`
      const runningProgress = runningKey === null ? null : ((snapshot.progress ?? {})[runningKey] ?? null)
      const runningPercent = runningProgress !== null && Number.isFinite(runningProgress.total) && runningProgress.total > 0
        ? Math.min(100, Math.round((runningProgress.received / runningProgress.total) * 100))
        : null
      const barPercent = Math.round(((queueDone + (runningPercent === null ? 0 : runningPercent / 100)) / Math.max(1, queue.length)) * 100)
      const queueRunning = queueRunningItem !== null
      const activeTitle = queueRunningItem === null
        ? null
        : (queueRunningItem.title || t('sessions.untitled'))
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
      const copyDiscoveryAddress = async () => {
        const ok = await copyText(selfDiscoveryAddress)
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

      const settingsOnly = surface === 'settings'
      const showSettings = settingsOnly || settingsOpen
      const syncDirSafe = typeof syncDir === 'string' ? syncDir : ''
      const effectiveTarget = target ?? (syncDirSafe.length > 0 ? { path: syncDirSafe, label: baseName(syncDirSafe) } : null)

      const switchView = (next) => {
        setView(next)
        setSelected([])
      }

      const openSettings = () => {
        setSettingsOpen(true)
        setAdvancedOpen(true)
      }

      const requestPull = (value) => {
        const peer = selectedPeer
        if (peer === null) return
        const ids = Array.isArray(value) ? value : [value?.id].filter((id) => typeof id === 'string')
        if (ids.length === 0) return
        openPullPlan(peer, ids, effectiveTarget)
      }

      const requestPush = (value) => {
        const peer = selectedPeer
        if (peer === null) return
        const ids = Array.isArray(value) ? value : [value?.id].filter((id) => typeof id === 'string')
        if (ids.length === 0) return
        openPushPlan(peer, ids)
      }

      const pullAll = async () => {
        const peer = selectedPeer
        if (peer === null) return
        try {
          const sessions = peerSessions[peer.id] ?? await reloadPeer(peer.id)
          openPullPlan(peer, sessions.map((session) => session.id), effectiveTarget)
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        }
      }

      const showPush = (peer) => {
        void openPush(peer).then(() => {
          setView('local')
          setSelected([])
        })
      }

      const handleDeviceAction = (action, peer) => {
        if (action === 'push') { showPush(peer); return }
        if (action === 'copy') {
          void (async () => {
            const ok = await copyText(`${peer.address ?? ''}${peer.port === undefined || peer.port === null ? '' : `:${peer.port}`}`)
            setNotice({ kind: ok ? 'ok' : 'error', key: ok ? 'notice.addressCopied' : 'notice.addressCopyFailed' })
          })()
          return
        }
        if (action === 'refresh') {
          void reloadPeer(peer.id).then(() => setNotice({ kind: 'ok', key: 'notice.refreshed' })).catch((error) => setNotice({ kind: 'error', text: String(error?.message ?? error) }))
          return
        }
        if (action === 'forget') {
          void forgetPeer(peer).then(() => { if (openPeer === peer.id) setOpenPeer(null) })
        }
      }

      const addTargetPath = (value) => {
        const next = value.trim()
        if (next.length === 0) return
        setExtraPaths((current) => (current.includes(next) ? current : [...current, next]))
        setPathDraft('')
        setTarget({ path: next, label: baseName(next) })
      }

      const updateSelfName = (value) => {
        selfDirty.current = true
        setSelfName(value)
      }

      const updateSyncDraft = (value) => {
        syncDraftDirty.current = true
        setSyncDraft(value)
      }

      const updateSeeds = (value) => {
        seedsDirty.current = true
        setSeeds(value)
      }

      const updateSubnets = (value) => {
        subnetsDirty.current = true
        setSubnets(value)
      }

      return h('div', { className: `ss-root${settingsOnly ? ' settings-only' : ''}` },
        h('div', { className: 'ss-page' },
          settingsOnly
            ? null
            : h('header', { className: 'ss-top' },
              h('div', { className: 'ss-top-l' },
                h('h1', { className: 'ss-h1' }, t('page.title')),
                h('div', { className: 'ss-sub' },
                  h('span', { className: `ss-dot${online > 0 ? ' on' : ''}` }),
                  h('span', null, h('b', null, String(online)), ' ', t('page.onlineShort')),
                  h('span', { className: 'sep' }, '·'),
                  h('span', null, h('b', null, String(remotePeers.length)), ' ', t('page.seenShort')),
                ),
              ),
              h('div', { className: 'ss-top-r' },
                h('button', {
                  type: 'button',
                  className: 'ss-icon',
                  title: t('common.refresh'),
                  'aria-label': t('common.refresh'),
                  disabled: busy,
                  onClick: () => { void run('notice.refreshed', () => api('refresh')) },
                }, h(Icon, { name: 'refresh' })),
                showSettings
                  ? null
                  : h('button', { type: 'button', className: 'ss-btn sm', onClick: openSettings },
                    h(Icon, { name: 'sliders', size: 14 }),
                    h('span', null, t('settings.short')),
                  ),
              ),
            ),

          notice === null
            ? null
            : h('div', { className: `ss-notice${notice.kind === 'error' ? ' error' : ' ok'}` },
              h(Icon, { name: notice.kind === 'error' ? 'alert' : 'check', size: 14 }),
              h('span', null, notice.key === undefined ? notice.text : t(notice.key, notice.params)),
            ),
          snapshot.error === null || snapshot.error === undefined
            ? null
            : h('div', { className: 'ss-error' },
              h(Icon, { name: 'alert', size: 14 }),
              h('div', { className: 'grow' }, t('page.apiError', { message: snapshot.error })),
            ),
          snapshot.hasPersistence === false
            ? h('div', { className: 'ss-error' },
              h(Icon, { name: 'alert', size: 14 }),
              h('div', { className: 'grow' }, t('page.noPersistence')),
            )
            : null,

          showSettings
            ? h(SettingsView, {
              t,
              surface,
              busy,
              self: snapshot.self,
              platform: snapshot.platform,
              workspaces: snapshot.workspaces ?? [],
              selfAddress,
              selfName,
              onSelfNameChange: updateSelfName,
              onSaveSelfName: () => { void saveSelfName() },
              onCopySelf: () => { void copySelfAddress() },
              override,
              changeLanguage: (value) => { void changeLanguage(value) },
              syncDir: syncDirSafe,
              syncDraft,
              onSyncDraft: updateSyncDraft,
              onSaveSyncDir: (value) => { void saveSyncDir(value) },
              autoPull: snapshot.settings?.autoPull === true,
              onToggleAutoPull: (value) => { void toggleAutoPull(value) },
              concurrency: snapshot.settings?.concurrency ?? 0,
              autoConcurrency: snapshot.concurrency ?? 5,
              onSaveConcurrency: (value) => { void saveConcurrency(value) },
              seeds,
              onSeeds: updateSeeds,
              onSaveSeeds: () => { void saveSeeds() },
              subnets,
              onSubnets: updateSubnets,
              onSaveSubnets: () => { void saveSubnets() },
              advancedOpen,
              onAdvancedOpen: setAdvancedOpen,
              ports: snapshot.ports,
              probe: snapshot.probe,
              onRepair: () => { void repairLegacyLogs() },
              version: CLIENT_VERSION,
              hostVersion: snapshot.version,
              repo: snapshot.repo,
              onBack: () => setSettingsOpen(false),
            })
            : h('div', { className: 'ss-desk' },
              h(DeviceRail, {
                t,
                self: snapshot.self,
                selfAddress,
                peers: remotePeers,
                selectedId: openPeer,
                onSelect: selectPeer,
                onOpenSettings: openSettings,
                onCopySelf: () => { void copySelfAddress() },
                dropPeer,
                onDrop: (peer, kind, event) => {
                  if (kind === 'over') { setDropPeer(peer.id); return }
                  if (kind === 'leave') { setDropPeer(null); return }
                  setDropPeer(null)
                  const payload = dropPayload(event)
                  if (payload === null || payload.direction !== 'push') return
                  openPushPlan(peer, payload.ids)
                },
              }),
              selectedPeer === null
                ? (remotePeers.length === 0
                  ? h(EmptyStage, {
                    t,
                    selfAddress: selfDiscoveryAddress,
                    manualAddress,
                    setManualAddress,
                    onAddManual: () => { void addManualAddress() },
                    onCopySelf: () => { void copyDiscoveryAddress() },
                    onOpenSettings: openSettings,
                    ports: snapshot.ports,
                    busy,
                  })
                  : h('section', { className: 'ss-stage' },
                    h('div', { className: 'ss-empty' },
                      h('span', { className: 'glyph' }, h(Icon, { name: 'devices', size: 18 })),
                      h('p', null, t('devices.selectHint')),
                    ),
                  ))
                : h(SessionStage, {
                  t,
                  peer: selectedPeer,
                  view,
                  onView: switchView,
                  sessions: openPeer === null ? null : (peerSessions[openPeer] ?? null),
                  localSessions,
                  busy,
                  selected,
                  onToggle: toggleSelected,
                  onToggleAll: toggleAll,
                  onClearSelection: () => setSelected([]),
                  digests,
                  onVerify: (session) => { void verifySession(selectedPeer, session) },
                  onCopyDigest: (session) => { void copyDigest(session) },
                  onPull: requestPull,
                  onPush: requestPush,
                  onForgetImport: (session) => { void forgetImport(selectedPeer, session) },
                  onPullAll: () => { void pullAll() },
                  target,
                  onTarget: setTarget,
                  workspaces: snapshot.workspaces ?? [],
                  syncDir: syncDirSafe,
                  extraPaths,
                  pathDraft,
                  onPathDraft: setPathDraft,
                  onAddPath: addTargetPath,
                  queue,
                  progress: snapshot.progress ?? {},
                  queueOpen,
                  onQueueOpen: setQueueOpen,
                  queueDone,
                  barPercent,
                  queueRunning,
                  activeTitle,
                  onClearQueue: clearQueue,
                  onRetry: retryItem,
                  dragStart: view === 'peer' ? dragPeerSessions(selectedPeer) : dragLocalSessions,
                  onAction: handleDeviceAction,
                  onRename: (peer, name) => { void renamePeer(peer, name) },
                }),
            ),

          h('footer', { className: 'ss-foot ss-footer' },
            h('code', null, t('footer.version', { version: CLIENT_VERSION })),
            h('span', { className: 'sep' }, '·'),
            h('span', null, t('footer.license')),
            snapshot.version !== undefined && snapshot.version !== CLIENT_VERSION
              ? h('span', { className: 'warn' }, t('footer.hostVersion', { version: snapshot.version }))
              : null,
            h('span', { className: 'ss-spacer' }),
            h('a', {
              href: snapshot.repo ?? 'https://github.com/XXGxiaoyu/dsh-session-sync',
              target: '_blank',
              rel: 'noreferrer noopener',
              style: { textDecoration: 'none' },
              title: t('footer.repo'),
            }, h(GitHubIcon, { size: 14 }), h('span', null, t('footer.repo'))),
          ),
        ),
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
      return h(SettingsPage, { t, surface: 'panel' })
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
      return h(SettingsPage, { t: useT(), surface: 'settings' })
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
