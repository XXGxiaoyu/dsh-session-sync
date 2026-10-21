# Changelog

## 0.5.3 — 2026-10-21

- **The transfer confirmation is a real dialog again.** It had no styles at all, so it rendered as a block at the bottom of the page and overlapped the settings. It is now a centred card on a dimmed mask (`position: fixed`, blurred backdrop, 560px max, scrollable list, right-aligned footer), so a long plan no longer pushes the buttons off screen.
- **The queue bar stays at the bottom.** It used to sit between the workspace list and the settings, floating mid-page. It is now a sticky bar after the footer that follows the viewport bottom, so it reads as a status strip instead of an interruption.
- **The queue counter stops printing placeholders.** `queue.summary` was defined twice per language, and the one that won expected `{skipped}` while the caller passed `{pending}` — the bar showed `跳过 (skipped)`. One definition, all three counts, verified against the live UI.
- **"Queued" became "To transfer".** A freshly planned item is not in the queue yet, so the chip now says `待传输` / `To transfer`.
- **API errors follow the interface language.** `请求超时`, `无法连接插件服务` and the unreadable-response message were hard-coded Chinese; they now come from the dictionary (`error.timeout` / `error.offline` / `error.badResponse` / `error.status`), so an English UI shows English failures.
- Tests **46 项** pass, with the confirmation dialog now asserted to be a centred overlay card.
