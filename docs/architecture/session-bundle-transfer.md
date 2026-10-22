# 会话整包迁移与并行传输设计

> 适用版本：`dsh-session-sync` 0.7.1 之后
> 关联稿子：`docs/redesign/index.html` 场景 `06a`（迁移预检）/ `06b`（传输详情）
> 结论先行：**现有“多会话并发”保留；新增的是整包文件、分片、断点续传和单任务并行。**

---

## 0. 先纠正三件事

1. **“同时同步好几个会话”现在就能做到。** 手动队列用 `limit` 个 async worker 并行领任务（`lib/client.js:2353`），自动值 2–5，手动可设 1–16。真正串行的是**自动拉取**（`lib/index.js:964`），不是手动队列。
2. **“多线程”在 Node 里要拆成两件事。** 网络/磁盘 I/O 本来就是并发的（libuv）；JS 执行和 `crypto.createHash` 仍然在主线程。要压多核，需要 `worker_threads` 做哈希/压缩。现有传输没有 worker 线程，所以大会话的 SHA-256 会把事件循环挡住。
3. **现在的“同步”只搬会话记录，不搬文件。** `exportSession` 只返回 `{format, session, events}`（`lib/sessions.js:14`）；LAN 的 JSON body 上限 256MB（`lib/lan.js:21`）。整包迁移需要新的二进制协议，不能塞进现有接口。

---

## 1. 迁移单元：一个“会话包”

一次迁移不是“一个 JSON”，而是四层：

```
session bundle
├─ record        会话 header + events（现有 exportSession 格式，SHA-256 校验）
├─ attachments   事件里引用的附件（content-addressed，sha256:<hex>）
├─ workspace     会话的 cwd 工作区快照（可裁剪、可排除、可增量）
└─ path-map      源 cwd → 目标 cwd；外部文件/交付物的映射
```

### 1.1 会话记录

沿用现有 `session` + `events`，导入仍走 `sessionPersistence`，保证目标端会话像本地创建的一样。额外可选保存一份原始 `session.v4.jsonl.zstd` 作为备份，不参与导入。

### 1.2 附件

事件里的图片是 `{"type":"image","attachment":{"attachmentId":"sha256:<64hex>"}}`。附件对象在：

```
<DSH_HOME>/attachments/v1/objects/<前2位>/<完整64hex>
```

迁移时扫描事件里的 `sha256:[0-9a-f]{64}`，把对应对象作为 `attachment` 条目放进包；目标端写回自己的附件库（内容寻址，天然去重），再校验 SHA-256。附件很小，默认全带。

### 1.3 工作区文件

这是几十 GB 的主体。**DSH 没有“这个会话改了哪些文件”的权威清单**：

- `workspace/changes` 事件只有 `{turn}`，没有文件列表（实测 6MB 会话里 4 条都是这样）；
- `tool/call` 里能解析 `write` / `edit` 的路径，但 `bash` 创建的文件无法可靠还原；
- `deliverables/presented` 和 `tool/result.meta.path` 能补充一部分“交付物/外部文件”，但不等于完整变更集。

所以文件范围必须在迁移前**由用户选**，插件不假装知道：

| 模式 | 内容 | 适用 |
|---|---|---|
| `record` | 只搬会话记录 + 附件 | 换台机器继续聊，工程本来就在 |
| `changes` | 记录 + 工具调用/交付物命中的文件 + git 变更 + 时间窗内改动 | 中小工程，想少传 |
| `workspace` | 记录 + 整个 cwd 快照（按预设排除） | 几十 GB 工程，要求目标端能直接跑 |
| `custom` | 记录 + 用户勾选的目录/文件 | 精确控制 |

`changes` 是启发式，界面必须标注“可能遗漏 bash 生成的文件”；`workspace` 才是可保证的。未来可加“会话运行期文件足迹记录器”（监听活跃会话的 cwd，把变更写进 sidecar），让新会话的 `changes` 变成精确集合——这是后话，不影响本期 `workspace`。

### 1.4 预设与排除

默认“代码”预设排除：

```
.git  node_modules  dist  build  .next  .cache  __pycache__
.venv  venv  target  DerivedData  .DS_Store  *.log
```

“完整镜像”一个都不排除；“自定义”可编辑 glob。被排除项在预检里显示为灰色条目和节省的字节数，不能悄悄消失。

---

## 2. 并发模型（所谓“多线程”）

三层 worker + 一个全局闸门：

```
全局 in-flight 上限（默认 32，可调 8–64）
├─ 会话 worker        默认 2，可调 1–8
│  ├─ 文件 worker     每会话默认 4，可调 1–8
│  │  └─ 分片 worker  每文件默认 4，可调 1–8
│  └─ …
└─ …
```

- **不是线程数，是在途请求数。** UI 写“并发”，tooltip 说明“同时在传的文件/分片数”。
- **全局闸门防止爆炸。** 2 会话 × 4 文件 × 4 分片 = 32，正好是默认上限；用户把三层都拉满时，由全局上限截断，不会开 512 个 socket。
- **公平调度。** 会话/文件之间轮转，避免一个 8GB 文件饿死其他小文件。
- **CPU 线程池。** `worker_threads` 固定 2–4 个，负责 SHA-256、zstd 压缩、大目录哈希；通过 job 队列复用，不为每个传输开线程。网络 I/O 仍走 async `fetch`。
- **背压。** 只有拿到分片槽位才读下一块；单块 4MiB，32 路在途最多约 128MiB 缓冲，不会把 10GB 读进内存。
- **限速。** 全局令牌桶 + 单任务限速；暂停/取消立即释放槽位。
- **调度器在宿主。** 不能放在 React 里：面板一关、页面一刷新，几十 GB 的进度就没了。浏览器只做展示和操作，引擎在 `lib/` 里持久化。

---

## 3. 传输协议

### 3.1 为什么不用现有 `/v1/sessions`

现有接口把整个会话 JSON 读进内存再发，256MB 上限；文件是二进制、可达几十 GB，必须走流式分片。新增一套 `/v1/transfers/*`，与旧接口并存。

### 3.2 角色与方向

- **push**：本机是 sender，目标端是 receiver；sender 调 receiver 的 incoming API，`PUT` 分片。
- **pull**：本机是 receiver，对端是 sender；本机在对端创建 outgoing transfer，`GET` 清单和分片。
- 两个方向共用 manifest / chunk / journal 格式，只是 HTTP 方法相反。

### 3.3 分片

- 固定分片，默认 **4 MiB**（可 1/4/8/16）；小文件整文件一片。
- `chunkCount = ceil(size / chunkSize)`；`offset = index * chunkSize`；最后一片可短。
- 分片哈希 = **明文** SHA-256；压缩只影响传输编码，不影响哈希。
- 文件哈希 = 整文件 SHA-256；清单里带 `size / mtime / mode / sha256`。
- `fileId = sha256(relativePath).slice(0,32)`，URL 不暴露原始路径；路径只出现在 manifest。

### 3.4 Manifest（NDJSON 流）

```json
{"kind":"meta","format":"dsh-session-sync/2","transferId":"...","sessionId":"...","sourceCwd":"/Users/me/proj","targetRoot":"/Users/me/sync/proj-4f2c","chunkSize":4194304,"files":8421,"bytes":13743895347,"digest":"..."}
{"kind":"dir","path":"src","mode":493,"mtimeMs":1792560000000}
{"kind":"file","fileId":"a1b2…","path":"src/main.js","size":2431,"mode":420,"mtimeMs":1792560000000,"sha256":"…","chunks":1}
{"kind":"symlink","path":"link","target":"src/main.js"}
{"kind":"attachment","attachmentId":"sha256:9c7f…","bytes":307499}
{"kind":"end","digest":"…"}
```

- `meta` 先到，receiver 先做空间/路径校验，再收条目。
- 文件条目不带全部分片哈希，避免几万文件 × 几千片的清单爆炸；分片哈希随分片请求头传。
- `digest` = 对条目做规范化后 SHA-256，用于断点续传时判断“清单有没有变”。

### 3.5 接口

Receiver 侧：

```http
POST /v1/transfers/incoming
  { transferId?, sessionId, sourceCwd, targetRoot, options }
  → { transferId, uploadToken, chunkSize, maxBytes }

PUT  /v1/transfers/:id/manifest          # NDJSON 流
GET  /v1/transfers/:id                  # 状态/进度/journal 摘要
GET  /v1/transfers/:id/files/:fileId    # { received: "<base64 bitmap>", complete }
PUT  /v1/transfers/:id/files/:fileId/chunks/:index
  Content-Type: application/octet-stream
  X-Chunk-Sha256: <hex>
  X-Chunk-Size: <bytes>
POST /v1/transfers/:id/finalize
POST /v1/transfers/:id/pause | /resume | /cancel
```

Sender 侧（pull 时由 receiver 调用）：

```http
POST /v1/transfers/outgoing
  { transferId, sessionId, root, options, target: { baseUrl } }
GET  /v1/transfers/:id/manifest
GET  /v1/transfers/:id/files/:fileId/chunks/:index
POST /v1/transfers/:id/close
```

鉴权沿用 `x-dsh-session-sync-token`；文件接口额外校验 `uploadToken` 和 `transferId`，避免别的 LAN 客户端乱写。

### 3.6 分片写入与校验

```text
receiver:
  .part 文件按 offset 写入
  → 算收到片的 sha256
  → 与 X-Chunk-Sha256 比对
  → 一致则记 bitmap，flush journal（每 2s 或每 64 片）
  → 不一致回 409，sender 重发该片
finalize:
  逐文件流式重算 sha256
  → 与 manifest 的 sha256 比对
  → 全部通过后 staging → 目标目录原子 rename
  → 导入 session（cwd 改写为目标根）
```

- 幂等：同一片重复 `PUT`，哈希一致就直接回 ok。
- 断点：receiver 只信 journal 里已验证的 bitmap；崩溃后最多重传在途的那几片（每片 4MiB）。
- 源文件在扫描后变了：发送前 `stat`，size/mtime 变化就 `source-changed`，该文件重扫，不静默传旧内容。

---

## 4. 断点续传与故障恢复

每次迁移在 `<DSH_HOME>/session-sync/transfers/<id>/` 下持久化：

```
transfer.json     # 状态机、选项、源/目标、清单摘要
manifest.ndjson   # 条目
journal.json      # 每文件 received bitmap、完成数、字节数
staging/          # 未完成的 .part 文件
```

- 每 2s 或每 64 片 flush 一次 journal；暂停/完成/退出时 `fsync`。
- 进程重启：读 journal → 校验已完成文件（大小+可选哈希）→ 删掉未验证的尾片 → 继续。
- 对端离线：状态 `waiting-peer`，指数退避重连；journal 不动。
- 清单变了：`digest` 不一致 → 重新规划；哈希相同的文件直接复用。
- 会话导入失败：文件已落盘，状态 `files-done / session-pending`，只重试导入，不重传几十 GB。
- 取消：默认保留 staging 7 天，让“手滑取消”可恢复；`清空缓存` 才真删。

---

## 5. 落盘与路径

### 5.1 目标根

默认 **relocate**：

```
<syncRoot>/<session-slug>-<shortId>/
```

- 改写 `session.cwd` 为新根；`sourceCwd` 记在 transfer.json。
- 历史事件里的绝对路径不改——那是日志，不是配置；界面明确提示“历史路径仍指向源机器，继续对话以新 cwd 为准”。
- 可选 **same-path**：目标端重建同样的绝对路径；要求目录不存在或为空，或显式确认覆盖。
- 冲突策略：`rename`（默认，`foo (2).js`）/ `overwrite` / `skip`。

### 5.2 安全

- 路径规范化后必须落在目标根内；拒绝 `..`、绝对路径、NUL、Windows 保留名（CON/NUL/COM1…）、尾随点/空格。
- 符号链接默认跳过；要保留时只允许指向根内的相对链接。
- 跳过 socket/FIFO/设备文件；不跟随 symlink 扫描。
- 文件数上限（默认 100 万）、单文件上限（默认 1TiB）、路径长度上限 4096。
- 目标空间检查：`总字节 × 1.1 + staging`；不足直接拒绝，不传到一半才炸。
- 不保留 owner/ACL/xattr；保留 POSIX mode（Windows 忽略）。硬链接不保留（按内容复制）。
- 大小写冲突检测（macOS/Windows 目标）：冲突项改名并记录。

### 5.3 会话导入

文件 finalize 后调用现有 `bridge.importSession({session, events, sha256}, {cwd: targetRoot})`；成功后：

- 写 `path-map`，UI 显示源→目标；
- 可选把目标目录注册为 DSH 工作区（走 workspace registry；失败不影响迁移）；
- 附件写回 `<DSH_HOME>/attachments/...`；
- 原始 JSONL 备份放 `<transfer>/backup/`。

---

## 6. 性能目标

| 指标 | 目标 |
|---|---|
| 10GB / 50k 文件，1Gbps | 稳态 ≥ 80MB/s，总时长 < 4 分钟（不含首次哈希） |
| 首次全量扫描 + 哈希 | 10GB < 60s（4 个 worker，SSD） |
| 断点恢复 | 进程重启后 < 5s 出首字节；最多丢在途 1 片/流 |
| 内存 | 32 路在途 < 512MB RSS；绝不整文件读入 |
| UI | 进度 ≥ 2 次/秒；主线程单次阻塞 < 50ms |
| 完整性 | 分片 100% 校验；整文件 100% 校验；会话 SHA-256 不变 |
| 去重 | 目标已有同哈希文件直接跳过；跨会话可选 CAS |

哈希/压缩在 worker 线程池；网络用 `fetch` + keep-alive；zstd 只对文本类文件启用（按扩展名 + 熵判断），媒体文件跳过压缩。

---

## 7. 宿主 API 与 UI

### 7.1 新增 host action（`/session-sync/api`）

```text
transfer.scan        { sessionId, peerId, mode, roots, ignore } → 预检摘要
transfer.start       { plan } → transferId
transfer.list        → 进行中/历史
transfer.detail      { id } → 阶段、字节、文件、速度、ETA、journal
transfer.pause/resume/cancel { id }
transfer.retryFile   { id, fileId }
transfer.reveal      { id } → 本地路径
```

### 7.2 UI 变化

- **会话行**：增加 `大小 · 文件数`（懒加载，扫描前显示 `—`）。
- **迁移预检（场景 06a）**：范围、预设、排除项、目标根、冲突策略、空间/预计时间、路径映射。
- **传输详情（场景 06b）**：阶段步进（扫描/哈希/传输/校验/落盘）、总进度、速度/ETA、文件列表、分片网格、暂停/取消、断点横幅。
- **设置**：会话并发、每会话文件并发、每文件分片并发、分片大小、断点续传、压缩、限速、忽略规则、冲突策略、默认范围。
- **队列坞**：从“N/M 条”升级为“字节进度 + 阶段”；失败/等待对端/空间不足各有文案。
- **旧行为保留**：`record` 模式就是现在的会话同步，路径短、速度快。

---

## 8. 分阶段实现

| 阶段 | 内容 | 验收 |
|---|---|---|
| 0 | 传输状态机下沉到宿主；持久化 journal；UI 只读订阅 | 关面板/重启后任务还在；旧会话同步不回归 |
| 1 | 单文件分片收发 + 校验 + 断点续传 | 1GB 文件 kill -9 后恢复；哈希一致；重复片幂等 |
| 2 | manifest/扫描/排除/附件 + 会话导入 + cwd 映射 | 10k 文件目录迁移后 `diff -r` 一致；附件可打开 |
| 3 | 三层调度 + worker_threads + 速度/ETA + 暂停取消 | 2 会话×4 文件×4 片稳定；内存 < 512MB |
| 4 | 预检/详情/设置 UI + 错误状态 | 场景 06a/06b 可交互；错误可恢复 |
| 5 | 去重、压缩、Windows 路径、基准与文档 | 10GB 基准达标；边界用例通过 |

测试重点：路径穿越、符号链接逃逸、磁盘满、源文件变更、对端重启、清单变更、Windows 保留名、大小写冲突、暂停后续传、取消后清理。

---

## 9. 需要你拍板的默认值

1. **默认范围**：大工程用 `workspace` + “代码”预设（排除 `.git`/`node_modules` 等），还是默认 `record` 让人手动选？建议前者，预检里可改。
2. **目标路径**：默认 relocate 到同步根并改写 cwd，还是尽量 same-path？建议 relocate，避免覆盖源机器路径。
3. **冲突**：默认 rename、overwrite、skip？建议 rename。
4. **并发默认**：2 会话 × 4 文件 × 4 分片、4MiB 分片，够不够？建议先这套，设置里可调。
5. **压缩**：默认只压文本，还是全关？建议 auto（文本 zstd，媒体直传）。

---

## 10. 风险与边界

- **“会话产生的文件”无法从历史日志精确还原**；`workspace` 是唯一可保证的语义，`changes` 必须标注启发式。
- 几十 GB 的首次哈希很贵；需要缓存（path,size,mtime）并允许“跳过哈希，边传边算”（弱一致性，不推荐默认）。
- 目标端可能是 exFAT/NTFS：mode、符号链接、大小写、长路径都要降级处理。
- 同一会话在两台机器同时继续会产生分叉；迁移完成后源端应标记“已迁出”，避免双写（可选，不阻塞本期）。
- `worker_threads` 增加打包复杂度；如果只传会话记录，线程池可以懒加载，不增加空闲开销。

---

## 11. 一句话

**会话级并发已经有了；这次要加的是“整包 + 分片 + 断点续传 + 三层并发 + 宿主常驻引擎”。** 其中真正需要多核的是哈希/压缩（worker_threads），网络并发本来就是 async I/O；把这两件事混成“线程数”会误导用户。
