# Changelog

## 0.2.0 — 2026-10-21

- UI rewritten on DSH design tokens (`--dsw-alias-*`, radius/type scale, `--ds-transition-duration`): layout, controls and motion now match the built-in settings pages in both light and dark themes.
- Entry point is a real panel under **Plugins** in the sidebar (`sidebar.panellist` + keyed `main`), alongside the `settings.section` page.
- i18n: language selector with **Follow DSH** (default) / 中文 / English; non-Chinese systems fall back to English.
- SHA-256 verification: every export carries `sha256 = SHA-256(JSON.stringify({format, session, events}))`, imports refuse (HTTP 409 `checksum-mismatch`) on any byte difference, and each session row has a **Verify** action.

## 0.1.0 — 2026-10-21

- First working version: UDP broadcast discovery, 0.0.0.0 HTTP sync API, device list with local-only nicknames keyed by stable device id, session browse/pull/push, auto-pull with content-fingerprint dedupe.
