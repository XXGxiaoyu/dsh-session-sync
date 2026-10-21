# dsh-session-sync

**DSH 的局域网会话同步插件。** 装了它的 DSH 会在局域网里互相发现，列出对方设备，可以通过普通 HTTP 浏览、拉取、推送会话。**你给某台设备起的外号只存在本机**——对方离线、重启、换 IP 再上线，你看到的还是自己给它起的名字。

<div align="center">

[![CI](https://github.com/XXGxiaoyu/dsh-session-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/XXGxiaoyu/dsh-session-sync/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/XXGxiaoyu/dsh-session-sync)](https://github.com/XXGxiaoyu/dsh-session-sync/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.2-4d6bfe)](https://www.npmjs.com/package/@deepseek-ai/dsh)

🌏 **简体中文** · [English](./README.md)

</div>

![会话同步面板](docs/preview.png)

## ✨ 功能

| | |
|---|---|
| **📡 零配置发现**<br/>每 4 秒向每个 IPv4 网段的广播地址发一次 UDP 心跳；收到陌生设备的广播会立刻单播回礼，所以新上线的机器不用等下一轮。 | **🏷️ 仅存本机的外号**<br/>写在 `<home>/session-sync/state.json`，按**稳定设备 id**（uuid）索引，不看 IP、不看主机名。对端改自己的显示名，不会覆盖你起的外号。 |
| **🗂️ 浏览 · 拉取 · 推送**<br/>看到对方每个会话的标题、cwd 和时间；一键把某个会话拉到本机，或把本机的推过去。拉回来的会话在列表里有标记。 | **🔐 SHA-256 校验**<br/>导出时附带 `sha256 = SHA-256(JSON.stringify({format, session, events}))`；导入**先比摘要再写库**，不一致直接拒收（HTTP 409 `checksum-mismatch`）。每个会话行都有「校验」。 |
| **🔁 可选自动拉取**<br/>每 20 秒扫一次在线设备，把还没拉过的会话同步过来。去重靠内容指纹（不是 id），两台都开自动拉取也不会把同一段对话反复互导。 | **🎨 原生观感与 i18n**<br/>全部用 DSH 的设计变量（颜色、圆角、字号阶梯、0.2s 动效），深浅主题跟随宿主；语言默认跟随 DSH，也可固定中文 / English。 |
| **🖱️ 选择与拖拽**<br/>会话可单选/多选，拖到任意已知目录松手即弹确认框，并写明这条对话会导入到哪个目录。 | **🚦 可确认的传输队列**<br/>推送/拉取前先查重：已存在时弹框让你选「保留本机」「覆盖本机」或单独取消这一条，其余条目照常排队执行。 |
| **⚡ 一键同步**<br/>「一键同步」/「一键推送」一次规划整台设备，按内容指纹跳过已有会话，逐条显示完成、跳过或失败。 | **🌐 跨网段扫描**<br/>广播只能留在本网段；在「跨网段扫描」里填 CIDR、IP 或 `IP:端口`。网段走静默 UDP 发现包，单个 IP 额外用 HTTP 探测 47802–47817 端口——防火墙丢弃 UDP 也藏不住对端。 |

### 界面上的三条约定

- **「本机」永远在第一行。** 设备区顶部固定一张本机卡片：你给它起的名字、局域网地址:同步端口、正在运行的版本。它不会出现在下面的设备列表里，所以「列表里有几台」永远等于「其他几台」。
- **未命名会话显示 `#会话 id 前 8 位`。** 一堆“未命名会话”长得一样，靠 id 才分得清；拉取计划里的「已存在」也是按同一台设备的同一个会话 id 判定的，改标题不会把重复判成新会话。
- **界面出错不再是一片空白。** 渲染异常会被错误边界接住，显示平台、Node 版本、宿主版本、端口、UA 和堆栈摘要，并带「重新加载 / 复制诊断」。Windows 上如果仍然空白，把这块诊断内容发到 issue 即可。

## 🚀 安装

```sh
dsh plugin --profile web add github:XXGxiaoyu/dsh-session-sync
```

需要 DSH **0.2.1-rc.2**（当前桌面版内置的版本）与 Node 22+。

然后重启 DSH 桌面应用（宿主半边的改动在启动时加载，页面刷新即可拿到新 UI）。装完会自动启用：包里声明了 `dsh.bundle`，`dsh plugin add` 会自己把它加进 `dsh.profile.bundles`。页脚显示的是**真正在运行**的那份构建；如果比 Latest 版本旧，说明进程还没重启。

预构建 tarball（免构建）：<https://github.com/XXGxiaoyu/dsh-session-sync/releases/latest/download/dsh-session-sync.tgz>

<details>
<summary>从本地目录手动安装</summary>

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "dsh-session-sync": "link:/absolute/path/to/dsh-session-sync"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-session-sync"]
    }
  }
}
```

```sh
cd ~/.dsh/profiles/<profile> && pnpm install
```

</details>

加载成功的话，日志里会出现：

```text
[dsh-session-sync] 已就绪：设备 <hostname>，同步端口 47802，发现端口 47801
[dsh-session-sync] 发现设备 <另一台的名字> (192.168.1.7:47802)
```

## 🧭 在哪用

侧边栏左侧「插件」下面多了一行**会话同步**（`sidebar.panellist` + keyed `main` 面板，id 都是 `session-sync`）；同一个组件也注册成 **设置 → 会话同步**（`settings.section`）。

- **本机**——别的设备看到的你的名字，改完立刻广播。
- **设备**——在线/离线、最近心跳、会话数、平台与版本。
- **命名 / 移除**——只影响本机看到的名字；离线设备保留这一行（和你的外号），只是变灰。
- **查看会话 / 拉取 / 推送**——列对方会话、拉一个到本机、把本机的送出去。
- **校验**——重新拉一遍对方的整包，重算 SHA-256 与本机副本比对（`sha256 2b12f7854d80… 校验通过`）。
- **同步设置**——界面语言、自动拉取开关、手动设备地址（广播被挡的网络用，填 `ip` 或 `ip:udpPort`，一行一个）。

## 🌏 界面语言

| 选项 | 行为 |
| --- | --- |
| 跟随 DSH（默认） | 用 DSH 当前语言。DSH 本身就会按系统语言回退，所以非中文系统一律 English，中文系统中文 |
| 中文 | 固定中文 |
| English | 固定 English |

```text
settings.locale = 'auto' | 'zh' | 'en'   // 持久化在 <home>/session-sync/state.json
```

插件读 `ctx.locale.getSnapshot().active`（`zh*` → 中文，其余 → English）；只有拿不到 locale 服务时才退回 `navigator.languages`。切换语言先落盘再换 UI，不会出现「下次打开又变回去」。侧栏行和设置项的文字由宿主解析，所以语言变化时插件会重新登记槽位——页面和侧栏永远不会一个中文一个英文。

![English UI](docs/preview-en.png)

## 🎨 界面风格

界面不写死任何色值，直接用 DSH 的变量：颜色 `--dsw-alias-*`，圆角 `--dsw-radius-*`，字号用 `--dsw-font-*` 阶梯，动效统一 `var(--ds-transition-duration) var(--ds-ease-in-out)`。排版照搬内置设置页——左边「标题 + 灰色说明」、右边控件、行间 `.5px` 分隔线、32 高输入/下拉、36×22 的 pill 开关，所以两套主题、窄窗口下都与宿主一致。

## ⚙️ 配置（loader row 的 `config`）

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `name` | 主机名 | 首次启动的本机显示名（之后以 GUI 为准） |
| `lanPort` | `47802` | 同步 HTTP 端口，占用时往后试 16 个 |
| `discoveryPort` | `47801` | UDP 发现端口 |
| `token` | 无 | 设置后局域网请求需带 `x-dsh-session-sync-token` |
| `home` | `$DSH_HOME` 或 `~/.dsh` | 状态与会话根目录 |
| `autoPullIntervalMs` | `20000` | 自动拉取间隔（测试里会调小） |
| `verbose` | `true` | 关掉插件日志 |
| `subnets` | `[]` | 广播到不了时额外扫描的 CIDR/IP/`IP:端口`（如 `192.168.5.0/24`、`10.0.0.7`、`10.0.0.7:47802`）。网段用 UDP 发现包；单个 IP 还会用 HTTP 探测 47802–47817 |

## 🔌 局域网协议（`/v1/*`）

绑定 `0.0.0.0`；除 `/v1/health` 外都要 `x-dsh-session-sync: 1`。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/v1/health` | `{ok:true}` 探活 |
| GET | `/v1/info` | 设备 id、名字、会话数、版本 |
| GET | `/v1/sessions?limit=N` | 会话摘要列表 |
| GET | `/v1/sessions/:id` | 导出 `{format:'dsh-session-sync/1', session, events, sha256}` |
| POST | `/v1/sessions` | 导入同一格式（带 `sha256` 会先校验），返回新 id |

发现走 UDP 广播：每 4 秒向各 IPv4 网段广播地址、`127.0.0.1` 和配置的 seeds 发 `dsh-session-sync/hello` 报文（`{id, name, port, platform, version, sessions}`），陌生 id 立刻单播回礼，新设备不用等下一轮。

GUI 的 `/session-sync/api` 跑在 DSH 自己的回环 web 服务上，受宿主连接策略保护；真正暴露到局域网的只有 `/v1/*`。

## 🧵 设计决定

- **命名按设备 id，不按 IP。** `deviceId` 是首次启动生成的 uuid，`peers[<deviceId>].customName` 只属于本机。
- **导入走官方持久化服务**：`ctx.sessionPersistence.create() → append() → flush()`，v4 header 只留允许字段（`version/id/createdAt/cwd/isSeeded/delegationDepth/parentSession/agentPreset`）。多一个 `type` 就会被 `format v4 header has unexpected field type` 拒掉。
- **导入保留源 `createdAt`，重编 id 和 seq。** id 必须全局唯一，seq 从 0 连续；`createdAt` 保留是为了让内容指纹成立。
- **跨机 cwd**：源 cwd 在本机存在就保留，不存在落到 `process.cwd()`，否则会话会在工作区列表里「消失」。
- **SHA-256 认字节**：两端序列化同一份对象，键序一致所以摘要可比；不一致在落库前就中止。
- **去重靠指纹不靠 id**：`state.signatures[sha1(createdAt, 事件形状, 首条预览)]` 在导出/导入时登记，自动拉取遇到就跳过。没有它，两台都开自动拉取的机器会把同一段对话换 id 反复互导。
- **本机可见**：外号、导入记录、设置全在 `<home>/session-sync/state.json`，不上传、不同步。

## 🧪 开发

```bash
node --test --test-force-exit --test-timeout=120000 'test/*.test.mjs'
```

33 个用例：客户端 bundle 契约、词典一致性、页脚与版本一致性（13）、jsdom 挂载与交互（5）、双实例端到端——发现/改名持久化/重启保留/拉取推送/自动拉取不反弹/接收端去重/SHA-256 篡改拒收/仅 HTTP 可发现的设备（8）、HTTP 兜底探测契约（7）。

单独起一个不带桌面壳的实例：

```bash
DSH_HOME=/tmp/dsh-ss-home node <dsh>/lib/bin.js --profile ssync --no-open --host 127.0.0.1 --port 4399
```

`--profile` 要放在 `--no-open` 这类 launcher flag **前面**；`web --profile x` 会报 `select a profile only once`。

## 📄 许可证

[MIT](./LICENSE)
