# Changelog

## 0.9.4 — 2026-10-23

- **An imported title is visible immediately.** Even after writing the title event, DSH's projection cache can lag and cache `null` for 60 seconds; the bridge title cache is now seeded on import so the next list render has the name.
- **An open peer list refreshes when the peer's session count changes.** It used to load once per device selection, so a newly created session on the other machine stayed invisible until the user switched devices. The beacon's `sessionCount` now triggers a reload of the current device.
- **Progress** keeps 0.9.3's active-item percentage; the Windows side must update to see it.
- **63** tests passing.

## 0.9.3 — 2026-10-23

- **Keep the session name across sync.** Remote titles normally live only in DSH's projection cache, not in the exported header/events, so imported copies appeared as “Untitled”. Exports now carry `title`; for older peers the client sends the title from the session list with the pull, and the importer writes it as a log-backed `session/title` event. Titles do not change the conversation fingerprint, so auto-pull cannot bounce on them.
- **A path-only target still attaches.** When a target has a path but no workspace id (older client or path drop), match it against real workspaces before importing, instead of silently landing in “Ungrouped”.
- **The bottom dock shows the current item's progress.** It used to show “2 done + 57% of the third = 86%” while the row showed 57%; both now show the active item, with batch statistics still in the queue panel.
- Re-tested live: after the Windows peer updated to 0.9.2, the previously 502 legacy 2.2 MB session pulls successfully (0.44s, sha256 verified). Title loss and the progress mismatch were found in that run and are fixed here.
- **63** tests passing.

## 0.9.2 — 2026-10-23

- **Fixed pull/verify failures for sessions imported by older builds.** If the peer has a log that DSH rejects with `released v2 unseeded Session contains an inherited end-seed marker`, `readSession` failed and the export returned 502. `SessionBridge.read` now catches exactly that validation error, decodes the stored log, strips the inherited prefix **in memory**, and exports it; no file rewrite, no event loss. Every other read error still surfaces.
- **Connection/real-time tuning.** UDP beacon 4s→2s, explicit target probe 8s→3s, offline TTL 12s→8s; UI state poll 4s→1.5s, transfer poll 700ms→300ms; polling pauses while the page is hidden and refreshes immediately when visible. The local session list (push picker) is cached for 30s and prefetched on the first state call instead of costing ~3.5s per open.
- **62** tests passing (new legacy-export fallback and non-target error propagation).

## 0.9.1 — 2026-10-23

0.9.0's single-identity direction was right; this release makes it actually self-consistent and closes a round of defects found by a full audit.

### Loading and identity

- **The client bundle's module id is now one constant, `MODULE_ID`.** `__ModuleLoader__.load({id})`, the injected `style[data-plugin]`, `data-plugin-css` and the exported plugin name all derive from it, and a test asserts it equals `package.json`'s `name`. The style tag used to carry the old string, so the host's `claimStyles`/`removeOwnedStyles` never recognised it: after a plugin reload the old stylesheet stayed, while the pre-insert `querySelector` found that stale tag and skipped the insert, leaving new CSS inactive until a full page reload.
- **Dropped `@deepseek-ai/dsh-client-ui-slots` from `dsh.client.inject`.** That package does not exist in this DSH build (0.2.1-rc.2), so it was a dependency edge that could never resolve; the bundle only `require`s `react` at runtime, so omitting `inject` means an empty dependency set.

### Behaviour

- **The empty state shows and copies the LAN port, not the UDP discovery port.** Manual seeds connect over HTTP `GET /v1/info`, so a discovery port can never work — and this is the only recovery path when broadcast is blocked. The device rail and the settings page already used the LAN port; all three agree now.
- **The session list's key handler no longer hijacks in-row buttons.** `keydown` bubbled from child buttons into the listbox handler, which called `preventDefault()` (killing the button) and then pulled/pushed the current row; pressing Enter on "verify" silently started a transfer. Rows' `button`/`a`/`input`/`select`/`[role=checkbox]`/`[role=switch]` now keep their own keys.
- **Verification digests are keyed by `(device, session)`.** One conversation usually sits on several devices; keying by `session.id` alone made device B show "synced" because device A had verified.
- **A failed verify request is no longer rendered as a mismatch.** A network error was stored as `verified: false`, painting a healthy copy red as a hash mismatch — and inviting the user to delete good data. It is recorded as "not verified" with the transport error surfaced separately.
- **`busy` is a counter.** Switching device while a rename saved let the first reply re-enable the action buttons mid-flight, and ended the stage's loading state early.
- **Snapshot polling and peer-session loads carry sequence numbers.** The 4 s idle tick, the 700 ms transfer tick and an explicit reload after every action can overlap; an older reply overwrote a newer snapshot (online state flicker, progress jumping backwards) and a slow host queued one request per tick. Clicking device A then B also no longer shows A's error on B's panel.
- **Drag and drop consistency:** hover preview and the real drop share one `dragY` (the preview always claimed "above" while the drop inserted below); device cards finally get the `.ss-dev.over` highlight, with `dragleave` no longer flickering on child elements; the `body`-level `insertLine`/`ss-dnd-tip` singletons are removed on uninstall instead of accumulating per reload; a stale session list now reports why nothing opened instead of silently doing nothing.
- **A rejected manual address keeps the typed value** instead of clearing the exact string the user needs to correct.

### Tests

- New assertion: the registered module id must equal `package.json`'s `name`.
- `test/sync.test.mjs` gained a cleanup safety net: 23 `bootInstance` calls but only a couple of `stop()` calls left HTTP servers, LAN listeners and UDP sockets pinning the process, so `node --test` hung after every assertion passed. The whole suite now finishes in ~30 s and exits.
- **60** tests passing.

## 0.9.0 — 2026-10-23

- **New fully unscoped package identity `dsh-session-sync-xxg`.** The package name, the `cordis.patch.yml` bundle specifier, the host plugin name and the client factory id are now the same unscoped string, so DSH cannot treat one client bundle as two sources. This exact identity was verified loading locally.
- The old scoped `@xxgxiaoyu/dsh-session-sync` (0.8.2–0.8.7) is unpublished.
- Plugin/slot ids and the `sessionSync` settings namespace are unchanged; **60** tests passing.

## 0.8.7 — 2026-10-23

- **Separated the bundle specifier from the registered plugin name.** In `cordis.patch.yml`, `name` is the module specifier and must be the scoped package `'@xxgxiaoyu/dsh-session-sync'`; the registered plugin name (the host export and client factory id) stays unscoped `dsh-session-sync`. 0.8.6 used the unscoped specifier and hit `ERR_MODULE_NOT_FOUND`.
- 0.8.6 and earlier are deprecated; upgrade to 0.8.7.
- **60** tests passing.

## 0.8.6 — 2026-10-23

- **Fixed the DSH plugin registration name.** A DSH bundle `name` cannot start with `@`. The npm package stays `@xxgxiaoyu/dsh-session-sync`, but `cordis.patch.yml` registers the plugin as `dsh-session-sync`. The scoped name in 0.8.2–0.8.5 failed or double-registered; those versions are deprecated.
- Code identical to 0.8.5; **60** tests passing.

## 0.8.5 — 2026-10-22

- **Fixed the `cordis.patch.yml` YAML parse failure.** A scoped package name starts with `@`, which YAML treats as a reserved indicator unless quoted; 0.8.2–0.8.4 shipped `name: @xxgxiaoyu/...` and DSH failed with `bad indentation of a mapping entry`. It is now `name: '@xxgxiaoyu/dsh-session-sync'`.
- 0.8.2–0.8.4 are deprecated on npm; use 0.8.5.
- Code identical to 0.8.4; **60** tests passing.

## 0.8.4 — 2026-10-22

- **README now installs from npm first.** The primary command is `dsh plugin --profile web add @xxgxiaoyu/dsh-session-sync`; GitHub remains as the track-latest-commit fallback. The manual profile example uses the scoped dependency and bundle name.
- Removed the broken prebuilt-tarball link (the release has no such asset) and pointed at Releases; added an npm badge.
- Code identical to 0.8.3; **60** tests passing.

## 0.8.3 — 2026-10-22

- **Privacy fix: removed every screenshot containing real device names, IPs, paths or session titles.** This covers the README images (`docs/preview*.png`, `docs/queue.png`) and the older `docs/mockups/*.png`. The repository no longer contains them, and the npm package no longer bundles them.
- Sample data in the design draft now uses placeholders (device names, IPs, paths, session titles); the HTML/CSS draft stays, the preview images do not.
- Code unchanged; **60** tests passing.

## 0.8.2 — 2026-10-22

- **npm package renamed to `@xxgxiaoyu/dsh-session-sync`.** The unscoped `dsh-session-sync` belongs to another project (`perrylink`, 0.2.30), so the current account cannot publish it. The bundle patch mount name is updated too; plugin/slot ids and the client namespace are unchanged.
- Code identical to 0.8.1; **60** tests passing.

## 0.8.1 — 2026-10-22

- **Fixed: row actions overlapped the status chip.** “Pull here / Push a session…” was too long for the action column; rows now use short Pull / Push labels, the action column is 104px, and the push view uses a three-column grid.
- **Clarified “Concurrent transfers”.** Auto estimates from the CPU count and caps at 5 (4 on this machine); manual 1–16 overrides auto and is grouped separately, so the 16 options no longer read as “5 max”.
- Tests: **60** passing.

## 0.8.0 — 2026-10-22

- **UI rebuilt around a session desk.** Devices live in a left rail that only selects; maintenance moved into the stage header ⋯. Direction is now two explicit tabs, Pull / Push, with a one-line flow hint.
- **Whole-row selection.** Clicking the title, meta line or status badge selects the row; the checkbox is just the visible state. Shift-range, ⌘/Ctrl toggle, Space/Enter, Esc and row-action isolation are preserved.
- **Selection bar appears only when needed.** It carries the count, target menu, start and clear. The target menu lists ungrouped, workspaces and custom paths, so the old bottom workspace list is gone.
- **Transfer dock replaces the drawer.** A persistent bottom summary expands upward into the queue; the session list stays readable.
- **Settings reorganised** into Identity / Transfer / Advanced / About, two columns in the panel and one in the host settings page; manual addresses and subnet scans are list editors now.
- **Complete state coverage**: empty, loading, offline, no results, read failure and diagnostics; all icons inline, all colours/radii/motion from DSH tokens.
- Tests: **60** passing, including whole-row selection, target scoping and the new main panel.

## 0.7.1 — 2026-10-22

- **Device column overflow fixed**: `box-sizing` on the shell/column/rows, so the row's ⋯ button no longer spills across the column gap and over the session pane.
- **Long device lists scroll instead of looking truncated**: the column caps its height and scrolls, and a hint states that every discovered (or previously seen) device is listed — other subnets are scanned from “Network & advanced”.
- **Test**: renders 30 devices and asserts all 30 rows exist.

Tests: 59.

## 0.7.0 — 2026-10-22

- Panel redesigned around a master/detail layout: devices live in a left column, the selected device's sessions are always visible on the right — no hidden "click the card to expand" affordance. The first online device is selected automatically, device rows are full-row targets with a session count and chevron, and the right pane has 对端会话 / 本机会话 tabs.
- Device actions moved into a per-row ⋯ menu (push here, rename, copy address, refresh, remove); inline rename stays in the row.
- `DeviceItem` replaces the old expandable device card; tests updated (58 passing).
- Screenshot refreshed (`docs/preview.png`).

## 0.6.1 — 2026-10-22

- **Fixed: every session looked "Untitled".** `readTitleSnapshots` returns settled results (`{status, value}`), but the old code read them as bare snapshots, so titles were always null; and most sessions never write a `session/title` event — DSH keeps their names in its projection cache. Both sources are now folded together.
- **Concurrent transfers.** The queue runs N workers in parallel. Default is derived from the CPU count (capped at 5); pick 1/2/3/4/5/6/8/10/12/16 under Settings → Concurrent transfers.
- **Live transfer progress.** Pulls stream the response and count bytes (`content-length` gives a real percentage); the host exposes `received/total` per transfer in `state.progress`, the client polls every 700 ms while the queue runs, and both the item badge/bar and the bottom bar show real progress instead of a spinner.
- 58 tests (new: title regression, concurrency validation).

## 0.6.0 — 2026-10-22

- **The transfer queue got a real design.** Every transfer is its own card: status icon (spinner / check / warning), session title, direction and peer, target directory, measured duration and the failure reason. Cards slide in with a short stagger, pop their check when they land, and keep a steady shimmer while running.
- **The batch is legible at a glance.** Four counters open the drawer (done / running / skipped / failed) and the persistent bar shows the running session plus a progress meter, so a long pull no longer looks frozen.
- **Both entry points behave the same.** Clicking anywhere on the bar (or pressing Enter/Space) opens the drawer; while it is open the bar stays out of the way.
- **Accents use DSH's business blue.** `--dsw-alias-brand-primary` is white in the dark theme, which made the running card unreadable; the queue now draws its accents from `--dsw-alias-state-business-primary` and keeps success/error tokens for outcomes.
- **Motion respects `prefers-reduced-motion`.** Spinner, shimmer, stagger and pop are all disabled for users who ask for less movement.
- Tests **56** pass, including the drawer contract (one card per transfer, four counters, filled track for settled rows).

## 0.5.5 — 2026-10-21

- **Sessions pulled by early builds open again.** Those copies were imported with `isSeeded: false` but still carried the peer's inherited end-seed marker, which DSH rejects with `released v2 unseeded Session contains an inherited end-seed marker`. Imports now strip the inherited prefix, so a copy only contains the conversation you actually own.
- **Repair what is already on disk.** *Network & advanced → Repair old sessions* scans `<DSH_HOME>/sessions`, rewrites affected logs (keeping a `.bak` beside each one) and reports how many it fixed. The same logic is available offline: `node scripts/repair-sessions.mjs [--dry-run] [--home ~/.dsh]`.
- **Stored logs are read frame by frame.** DSH writes one zstd frame per batch and Node's `zstdDecompressSync` stops after the first one, so the repair path walks the frame headers itself instead of guessing.
- Tests **56** pass, including the inherited-prefix regression and the repair round trip.

## 0.5.4 — 2026-10-21

- **Dropping a session actually starts the transfer.** `dragend` fires before the 90 ms success animation finished, and it cleared the drag payload; the drop then ran with `null` and returned silently. The payload is now captured at drop time and handed to the queue, so a drop opens the confirmation dialog again.
- **Drops go through DSH's own workspace model.** Dropping on a sidebar row no longer just copies the folder path: the imported session is attached with `workspaceRegistry.attachSession()` and positioned with `insertSessionBefore()`, which is exactly what the native sidebar does internally. `workspace.json` is never rewritten by hand.
- **Insert at the row you point at.** Hovering a session row draws a 2 px insertion line above or below it (whichever half the pointer is in) and the pull request carries `workspace` + `before`, so the conversation lands between the rows you chose instead of at the end of the group.
- **The confirmation names the workspace.** The dialog shows the group title (`拉取到 Alpha`) instead of the raw directory path.
- Tests **50** pass, including the attach/insert contract and the drop payload captured after `dragend`.
