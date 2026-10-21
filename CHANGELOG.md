# Changelog

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
