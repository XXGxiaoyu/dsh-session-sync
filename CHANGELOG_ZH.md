# 更新日志

## 0.2.0 — 2026-10-21

- 界面改用 DSH 自己的设计变量重写（`--dsw-alias-*`、圆角与字号阶梯、`--ds-transition-duration`）：布局、控件与动效在深色/浅色两套主题下都与内置设置页一致。
- 入口变成侧边栏**插件**分组下的真正面板（`sidebar.panellist` + keyed `main`），`settings.section` 仍在，两者是同一组件。
- i18n：语言下拉提供 **跟随 DSH**（默认）/ 中文 / English；非中文系统回退到 English。
- SHA-256 校验：每次导出都带 `sha256 = SHA-256(JSON.stringify({format, session, events}))`，导入时字节不一致直接拒收（HTTP 409 `checksum-mismatch`），每个会话行都有「校验」按钮。

## 0.1.0 — 2026-10-21

- 首个可用版本：UDP 广播发现、0.0.0.0 HTTP 同步接口、设备列表与仅存本机的设备外号（按稳定设备 id 索引）、会话浏览/拉取/推送、自动拉取 + 内容指纹去重。
