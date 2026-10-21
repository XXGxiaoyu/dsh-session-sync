# Changelog

## 0.3.5 — 2026-10-21

- 同一台机器上的其他 profile 不再单独成组，而是**完全不进设备列表**：宿主在吸收 peer 时按本机地址直接跳过，启动时也会清掉历史里同地址的记录。
- 设备数、在线数只表示其他机器；「本机」卡片仍然常驻。
- 测试 36 项（新增「本机地址的 peer 永远不出现在设备列表」）。
- 测试专用开关 `allowLoopbackPeers`（默认 false），仅测试套件在 127.0.0.1 上跑多实例时开启。

## 0.3.4 — 2026-10-21

- **Fixed — one IP is no longer two devices.** Device identity is a `deviceId`, and every profile has its own, so the desktop profile and a scratch profile on the same machine showed up in the device list — reading as if `10.178.48.147:47802` were another computer. Peers now classify by **host address**: anything on a local address moves under the 本机 card as “other DSH instances on this machine”, excluded from the device list and its counters, and duplicate records for the same `address:port` collapse into the freshest one.
- Those same-host rows keep 查看会话 / 推送会话, so cross-profile sync still works.
- Tests: 35 (was 34).

## 0.3.3 — 2026-10-21

- **Fixed — a Windows blank panel is now diagnosable, not silent.** Render errors are caught by an error boundary that prints platform, Node/host version, ports, UA and a stack summary, with *Reload* and *Copy diagnostics*. The page also stopped depending on a hard-coded 100% height, which could collapse to zero on a different shell layout.
- **New — “this device” is always visible.** The device list opens with a fixed row for the machine you are on: its name, `LAN address:sync port` and the running version. It is never mixed into the peer list, so the list count keeps meaning “other devices”.
- **Fixed — look-alike untitled sessions.** Every row now shows `#first-8-of-session-id`, and the pull plan's “already present” decision is documented as keyed by the same peer + session id (it always was — now it is visible and tested), so renaming cannot fake a duplicate.
- **Compatibility** — a fallback subscription is used when a host ships React without `useSyncExternalStore`.
- Tests: 34 (was 32).

## 0.3.2 — 2026-10-21

- **Fixed — the footer no longer looks like a wrong release.** It now prints the version of the build it shipped with (`CLIENT_VERSION`, enforced equal to `package.json` by a test), and appends `host v…` plus *“restart DSH to apply it”* when the running host process is older than the bundle. A page that shows v0.1.0 next to a v0.3.2 release is a stale process, not a mismatched publication.
- Tests: 32 (was 30) — bundled version vs `package.json`, stale-host rendering.

## 0.3.1 — 2026-10-21

- **Fixed — cross-subnet scan actually reaches the peer port.** The sweeper used to send every hello to its *own* discovery port; entries now accept `ip:port` and the packet goes to the port written in the entry.
- **New — HTTP fallback for UDP-blocked networks.** A bare IP (or `ip:port`) is also probed over HTTP on ports 47802–47817 in parallel, using the same header-fenced `/v1/info` API; devices behind a firewall that drops UDP still show up, and the device row reports which path found them (`via: udp | http`).
- **Fixed — scan settings apply immediately.** Saving *Cross-subnet scan* or the manual address list now rebuilds the sweep list and runs a probe right away, instead of waiting up to a minute.
- **New — footer credits.** Version, MIT license, a GitHub link and a small “star this repo” line, all on design tokens.
- **Fixed — English dictionary completed** for the probe-status and footer strings.
- **Verified against a live DSH desktop instance**: HTTP probe found it on port 47802 in 411 ms while UDP could not cross the test boundary.
- Tests: 30 (was 24) — port-aware sweep targets, `parseTarget` validation, probe against a fake peer (header fence, dead ports), an end-to-end discovery where only HTTP can succeed, and the footer contract.

## 0.3.0 — 2026-10-21

- **Fixed — typed text no longer disappears.** The 4s poll used to overwrite the local-name field, the seeds box and the new cross-subnet box on every refresh; fields now only sync from the host when the user is not editing them.
- **Fixed — devices behind a router are found.** UDP broadcast cannot cross a subnet, so a background sweeper probes the discovery port of every host in the CIDRs/IPs listed under *Cross-subnet scan* (cap: 4096 probes per sweep, 15s interval, private ranges only).
- **New — selection, drag & drop, explicit destination.** Sessions are checkboxes; drag one or many onto a known folder (local cwds, peer cwds, or a manual path) and a confirmation dialog names the folder the conversation will land in.
- **New — transfer queue with per-item duplicate handling.** Every transfer is planned first (`共 3 个：2 个待传，1 个已存在`), duplicates get *Keep existing / Overwrite as a new copy / Skip this one*, and a skipped or failed row never stops the rows around it.
- **New — one-click sync / push.** Plan a whole device in one dialog, dedupe by content fingerprint, then run through the queue with live status.
- Tests: 23 (was 18) — poll-vs-typing guard, cross-subnet validation, receiver-side dedupe, skip-mid-queue and overwrite-bypass paths, drop-onto-folder.

## 0.2.0 — 2026-10-21

- UI rewritten on DSH design tokens (`--dsw-alias-*`, radius/type scale, `--ds-transition-duration`): layout, controls and motion now match the built-in settings pages in both light and dark themes.
- Entry point is a real panel under **Plugins** in the sidebar (`sidebar.panellist` + keyed `main`), alongside the `settings.section` page.
- i18n: language selector with **Follow DSH** (default) / 中文 / English; non-Chinese systems fall back to English.
- SHA-256 verification: every export carries `sha256 = SHA-256(JSON.stringify({format, session, events}))`, imports refuse (HTTP 409 `checksum-mismatch`) on any byte difference, and each session row has a **Verify** action.

## 0.1.0 — 2026-10-21

- First working version: UDP broadcast discovery, 0.0.0.0 HTTP sync API, device list with local-only nicknames keyed by stable device id, session browse/pull/push, auto-pull with content-fingerprint dedupe.
