# Changelog

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
