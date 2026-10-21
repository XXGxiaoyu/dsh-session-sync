# Changelog

## 0.5.4 — 2026-10-21

- **Dropping a session actually starts the transfer.** `dragend` fires before the 90 ms success animation finished, and it cleared the drag payload; the drop then ran with `null` and returned silently. The payload is now captured at drop time and handed to the queue, so a drop opens the confirmation dialog again.
- **Drops go through DSH's own workspace model.** Dropping on a sidebar row no longer just copies the folder path: the imported session is attached with `workspaceRegistry.attachSession()` and positioned with `insertSessionBefore()`, which is exactly what the native sidebar does internally. `workspace.json` is never rewritten by hand.
- **Insert at the row you point at.** Hovering a session row draws a 2 px insertion line above or below it (whichever half the pointer is in) and the pull request carries `workspace` + `before`, so the conversation lands between the rows you chose instead of at the end of the group.
- **The confirmation names the workspace.** The dialog shows the group title (`拉取到 Alpha`) instead of the raw directory path.
- Tests **50** pass, including the attach/insert contract and the drop payload captured after `dragend`.
