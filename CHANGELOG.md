# Changelog

## 0.5.2 — 2026-10-21

- **修复拖拽残影卡在左下角。** 拖拽开始时就会创建跟随指针的拖影节点，浏览器在某些情况下（拖到侧栏后切窗口、OS 取消拖拽、拖入 iframe）不会派发 `dragend`，于是这个节点永远留在 DOM 里；「无法放入此处」的提示胶囊同样会残留。现在改成按需创建，并在 `dragend` / 窗口失焦 / 页面隐藏 / 指针离开窗口 / 20 秒无移动任一路径上清理干净。
- **修复拖影文案显示原始 key。** 拖影里的 `dnd.ghostPull` / `dnd.ghostPush` 两个字典项从来没定义过，界面直接显示了字符串 `dnd.ghostPull`。补齐中英文案（`拉取 · N 个会话` / `Pull · N sessions`），并新增测试：源码里所有 `translateNow('key')` 的 key 必须在两套字典里都存在。
- 测试 **46 项**通过（新增拖拽残留清理用例）。
## 0.5.1 — 2026-10-21

- **修复设置页崩溃 `shortClock is not defined`。** 面板重写时「上次扫描时间」的格式化函数漏了定义：只要跨网段扫描有了目标并渲染出扫描摘要，React 就会抛 `ReferenceError`，Windows 上最先撞到。补上 `shortClock()`（本地时间 `HH:MM:SS`）。
- **新增未声明标识符检查。** 手写 bundle 没有构建期检查，任何漏定义的函数都要等用户点开界面才暴露。现在用 `acorn` 解析 `lib/*.js`，把「读了但从未声明」的标识符列成失败项——本次的 `shortClock` 正好会被它拦下。
- 测试 **44 项**通过。

## 0.5.0 — 2026-10-21

- **Session panel, rebuilt.** Status chips (online / ports / own address), a slim local-device card, one row per device with meta line, and the sessions toolbar now live in one flat, DSH-native layout.
- **Search, filter, sort.** The session list gained a search box (`/` focuses it), 全部 / 未拉取 / 已拉取 filters and a time/title sort — plus ↑↓ / Space / Enter keyboard navigation.
- **Quieter rows.** Every row carries a status chip (未拉取 / 已拉取); 校验 and 拉取 appear on hover or keyboard focus, so a long list no longer reads as a wall of buttons.
- **Device card + ⋯ menu.** Rename, copy LAN address, refresh, push and forget moved into a per-device menu; clicking the name opens its sessions. The whole card stays a push drop target.
- **Queue moved out of the list.** Transfers now summarise in a bottom bar and open in a right-side drawer, leaving the session list uninterrupted.
- **Settings trimmed.** Language, auto-sync folder, custom folder and auto-pull stay visible; ports, manual addresses, cross-subnet scan and seeds fold under “Network & advanced”.
- **Better empty state.** Three steps, one-click copy of this machine's address and an inline manual address box.
- `preview.png` refreshed; 42 tests pass.

## 0.4.3 — 2026-10-21

- **修复拖拽时的重影。** 浏览器原生拖影和插件胶囊会同时出现、互相压字（截图中「未命名会话」盖在侧栏行上）。现在把原生拖影换成 1×1 透明图，只用插件自己的拖影（标题 / 事件数 / `+N`），跟随指针并有最大边界，不再压住侧栏文字。
- **修复展开的分组仍要拖到标题行。** 真实侧栏是 `list > section > (标题行 | span > 会话行)` 的嵌套结构，旧逻辑只沿 `previousElementSibling` 回溯，跨层就找不到标题。改为按文档顺序取最近的 `workspace:*` 标题，并用「最近的、且只包含这一个标题的容器」判定归属；标题行、容器、成员行同时高亮。
- 容器级高亮 `.ss-ws-group`：展开区域连同空白一起染色，指针落在哪一行都算命中。
- 拖影与胶囊分层：拖影 `y+12`、胶囊 `y+60`，互不遮挡。
- 测试 **42 项**（新增嵌套结构用例：`li/ul` 与生产同构的 `div/span section`）。

## 0.4.2 — 2026-10-21

- **展开区域整块可放。** 命中判定改为“向上回溯最近的 `data-row-key="workspace:*"`”，会话行、溢出行的任意位置（含空白）都算命中；嵌套分组取最近标题行。
- **整组反馈。** 标题行 1.5px 品牌描边，成员行 10% 品牌底色 + 2px 左轨；只加临时 class，不改官方 DOM。
- **指针胶囊。** 目标名 + 会发生什么（此分组 / 整组可放 / 未分组 / 无法放入），并给出 blocked 与 90ms 成功态；成功态用实心 success 底 + 深色文字。
- **富拖影。** 标题 + 事件数 + `+N` 徽章，仍走浏览器原生 drag image。
- 测试 **40 项**；新增成员行命中、胶囊文案、blocked 态断言。

## 0.4.1 — 2026-10-21

- **选择条去掉背景容器。** 不再有描边/底色/模糊的「框」：全选、数量、动作直接浮在列表上方，只保留一行留白。
- **按钮常驻、按状态禁用。** 「同步选中」「清除选择」始终可见；没有选中时 `disabled`（45% 不透明度、`cursor: not-allowed`），不会因为隐藏而造成布局跳动。
- 选中行改用 hover 底色 + 圆角高亮，未选中时「全选」文字替代「已选 0 个」。
- 截图 `docs/preview.png` 更新为带选中状态的界面。
- 测试 40 项。

## 0.4.0 — 2026-10-21

- **修复拖拽偶发失效。** 拖拽处理函数原来是单槽位，设置页先挂载、后卸载时会把它清空（后注册者覆盖前者的清理逻辑），表现为「拖过去没反应」。改成带所有者校验的释放函数：只有登记它的组件卸载时才撤销。
- **选择区重做。** 去掉设备动作下面那块悬浮工具条，改成会话列表顶部的 sticky 批量操作条：左侧全选 + 已选数量，右侧「同步选中」「清除选择」，半透明背景 + 模糊，滚动时钉在列表顶部。
- **拖拽反馈补齐。** 拖动时源行降到 45% 透明度；指针旁显示「放入「未分组（不归档到工作区）」」胶囊提示；跟随指针的自定义拖影（标题或「N 个会话」）；目标行用内描边 + hover 底色高亮，0.12s 过渡。
- 目标行解析抽成 `workspaceRowTarget()`，同时给出路径与展示名；未分组统一用 `settings.syncUnsorted`。
- 测试 40 项。

## 0.3.9 — 2026-10-21

- **拖拽直接落在 DSH 自己的侧边栏行上。** 不再绘制覆盖层：插件在 document 捕获阶段接管 `dragover`/`drop`，用官方行已有的 `data-row-key="workspace:<key>"` 定位目标行（`<key>` 为空即「未分组」，等于 workspace id 或路径则取该工作区），命中时给该行加 `.ss-ws-over` 高亮，松手后仍走二次确认弹窗。
- 侧边栏的 DOM、类名与 React 树完全不动，也不抢占 `sidebar.workspaces` 插槽（那需要整套重写侧栏）；DSH 升级只要保留这一行属性就有效。
- 移除 0.3.7 的侧栏投放面板（`shell.overlay`），面板里的目录投放保留为备用入口。
- 测试 40 项，拖拽用例改为对真实行属性做断言。

## 0.3.8 — 2026-10-21

- sha256 定位明确为**完整性校验**：自动执行、失败即 409 拒收，不引入逐次手动确认（选项 A）。
- 校验通过/失败的会话行新增「复制完整摘要」，把 64 位 sha256 复制到剪贴板，供带外核对；失败时行内直接展示完整摘要。
- README 中英两版补充「摘要证明完整性、不证明身份」的说明。
- 测试 40 项（校验行断言剪贴板内容为完整 64 位）。

## 0.3.7 — 2026-10-21

- **自动同步目录**：新增 `settings.syncDir`。默认「未分组」——导入的会话落在插件自己的 `session-sync/unsorted`，不属于任何工作区；也可以直接选一个已有工作区，或填一个文件夹路径（保存时自动创建，只接受绝对路径）。自动拉取用它作为 `cwd`，会话因此在 DSH 侧边栏归到对应分组。
- **拖拽到左侧工作区**：拖动会话时，插件在侧栏位置绘制投放面板（`shell.overlay`，不改 DSH 源码），列出「未分组」与全部工作区；松手后仍然走二次确认弹窗，确认即按该目录同步。面板里的原有目录投放保留。
- 工作区列表由宿主读 `$DSH_HOME/storages/workspace.json` 提供给前端，与侧边栏同一份数据。
- 测试 40 项（新增自动同步目录、工作区列表、投放面板三组）。

## 0.3.6 — 2026-10-21

- 设备列表不再展示本机：移除本机卡片，地址属于本机的 peer 不到达界面。
- 同一 IP 的多个 peer 折叠成一行（在线优先、其次最新），端口不同不算第二台设备。
- 本机名称仍在「本机」区编辑；设备计数只表示其他机器。
- 测试 37 项。

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
