# 更新、兼容与 DSH 接入维护说明

适用项目：[`dsh-open-code-review`](https://github.com/mocilukalbj/dsh-open-code-review)。
记录日期：2026-09-30。本说明区分**已经验证的行为**和**未来版本的适配方案**；不承诺未经测试的新版本兼容。

## 1. 当前版本基线

| 层 | 当前基线 | 更新关系 |
| --- | --- | --- |
| 本插件 | `0.1.1` | 同版本 npm 包与 GitHub Release 均已发布；推荐 npm 作为日常更新来源。 |
| Open Code Review | `@alibaba-group/open-code-review@1.12.10` | 精确固定的运行依赖，随插件版本升级。 |
| OCR 委托协议 | `schema_version: "1"` | `delegate preview` / `delegate rule` 的 JSON 契约。 |
| DSH | `0.1.7-rc.2` / `0.2.0-rc.2` | DSH 服务 peers 明确声明两个已验证版本的 `||` 分支。 |
| Node.js | 22+ | 已验证 Node 22；其他主版本仍需验证。 |
| 接入方式 | 本地 Host Cordis bundle + 原生工具 + Skill | 使用当前会话模型完成默认审查。 |

Linux、macOS、Windows 的确定性测试已通过，见 [VALIDATION.md](VALIDATION.md)。完整 DSH CLI 安装、调用、卸载验证在 Linux 完成。独立 OCR 模型的在线连通性和审查质量不属于这些测试的验证范围。

**三个版本独立变化：**更新 DSH 不会自动升级本插件；更新全局 OCR 不会改变本插件默认调用的 OCR；更新插件才会带入它固定的新 OCR 依赖。设置 `ocrPath` 后调用的是指定程序，例外情况需要另行管理版本。

## 2. 当前是怎样接入 DSH 的

```text
profile/package.json 的 dsh.profile.bundles
  → 插件 package.json 的 dsh.bundle.patch
  → cordis.patch.yml 注册 open-code-review
  → lib/index.js 注入 Host 服务
      ├─ tools：ocr_preview / ocr_rules
      ├─ skills：open-code-review 审查流程
      └─ sandboxPolicy → sandbox → subprocess → OCR 原生程序
```

默认模式：OCR 提供文件筛选和规则，DSH 当前 agent 读取代码并完成审查。可选的 `enableManagedReview` 才注册 `ocr_review`、`ocr_llm_test`，使用 OCR 独立配置的模型。两种模式不能当成同一条执行流程。

- `dsh.bundle` 负责安装和加载，单独声明 `dsh.client` 不够。本插件不依赖自定义浏览器界面。
- Host 服务通过 `peerDependencies` 使用运行中 DSH 的实现；`devDependencies` 供开发和独立测试使用。
- 工具与 Skill 注册在 Host 层。Agent 的工具过滤、preset、Skill 消费插件仍会影响实际可见性；只看到安装记录不等于会话已经能调用。
- `repo` 默认来自调用会话的工作目录，不是 DSH 服务进程的启动目录。
- 沙箱、审批、取消、超时和卸载由当前 Host 接口协同处理。升级时不能只验证命令能运行，还要验证这些行为仍然成立。

参考：[DSH bundle 发布](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)、[工具服务](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/tools/README.md)。链接跟随上游主分支，具体实现应与目标内核版本一起核对。

## 3. 用户如何升级插件

### 先确认实际运行的环境

查看 DSH 界面中的内核版本、当前 profile 和插件列表，并在终端检查：

```sh
dsh --version
dsh --profile web --dump-config
```

将 `web` 替换为实际 profile。`--dump-config` 可能包含配置内容，只在本机查看，不把完整输出贴到公开 issue。

CLI、桌面应用和系统服务可能使用不同的内核、`DSH_HOME` 或 profile。不要仅凭终端的版本号认定桌面内核相同，也不要只在另一个 profile 中完成安装。检查应用/服务的实际启动方式；桌面应用拥有专属 profile 时，优先使用应用自身的插件管理入口。

升级前备份实际 profile 的 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 和 `cordis.patch.yml`，以及自己配置过的 OCR 配置文件。备份留在本机，不提交凭据、会话数据或用户配置到插件仓库。

### 安装指定版本

选择已经发布、兼容当前 DSH 的版本。本次兼容更新使用 **0.1.1**；以后升级时替换为实际目标版本。推荐通过 npm 包安装：

```sh
dsh plugin --profile web add dsh-open-code-review@0.1.1 --save-exact --ignore-scripts
```

也可从 [Releases](https://github.com/mocilukalbj/dsh-open-code-review/releases) 安装同版本的打包产物：

```sh
dsh plugin --profile web add https://github.com/mocilukalbj/dsh-open-code-review/releases/download/v0.1.1/dsh-open-code-review.tgz --ignore-scripts
```

手动使用 Release 升级时推荐带版本的 URL。`releases/latest/download/dsh-open-code-review.tgz` 便于首次安装和市场展示，但固定 URL 的缓存及解析行为不适合作为“这次一定更新了”的证据。安装后核对插件版本、OCR 依赖版本及运行状态。

本插件自身无构建/安装脚本，但上游 OCR 依赖带有 `postinstall`。本插件直接使用 optional dependencies 提供的平台二进制，无需运行该脚本；安装时使用 `--ignore-scripts`，不必全局允许构建。不要使用 `--omit=optional` / `--no-optional`。

热重载启用时，Host 可以应用配置变更；若界面要求重启、profile 为启动时加载、或现有 agent 未刷新能力，应在当前任务结束后重载/重启，并新建会话验证。不要在审查进程尚未结束时更换其运行环境。

验证：插件处于启用且 active 状态；新会话能加载 `/open-code-review`；对小型临时 Git 仓库调用预览和规则，结果范围正确。已有自定义 preset 若隐藏工具，需要在该 preset 的正常配置入口中调整可见性。

### npm 404 历史与安装来源（2026-09-30）

`0.1.1` 刚发布 GitHub Release 时，同名 npm 包尚未发布，所以市场的按包名更新曾报 `E404`。**npm 上现已发布 `dsh-open-code-review@0.1.1`**，并核对了 npm 与同版本 Release 的打包内容。该历史错误不再表示当前包缺失。

已核对的 dsh-market `1.66.6` 会对 Release tarball 安装查询 npm 的 `latest`。现有 Release 安装若也是 `0.1.1`，发布同版本 npm 包不会触发“有新版本”，也不会自动改写 profile 的安装来源。需要立即改用 npm 更新链时，先等运行中的 Agent 结束，再在**实际使用的 profile**执行：

```sh
dsh plugin --profile web add dsh-open-code-review@0.1.1 --save-exact --ignore-scripts
```

随后检查 profile `package.json` 的 `dependencies.dsh-open-code-review` 已从 GitHub URL 切换为 npm 版本，并核对锁文件、已安装版本及工具状态；按 Host 提示重载或重启，新建会话验证。未来 npm `latest` 高于已装版本时，市场才能提示更新；实际安装仍取决于 Host 的包脚本策略。Market Update API v1 复用同一更新流程，不能靠插件元数据让 Release URL 按 GitHub Release 自动跟踪。

以后每次发版同步发布**同一份已验证包**到 GitHub Release 与 npm，检查 `npm view dsh-open-code-review@<版本> version dist.integrity`、实际安装和 Host 兼容性，并确认 npm `latest` 指向预期版本。npm 已发布版本不可覆盖。目录会自动发现符合映射规则的 npm 包；不要在市场条目手写 `npm:` 字段，当前目录校验不接受该字段。稳定的 `tarball` 地址可作为备选安装源保留。

参考：[npm 发布公开包](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)、[市场目录 npm 说明](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md#npm-package--npm-包optional--可选)。

## 4. Open Code Review 升级的维护流程

上游：[仓库](https://github.com/alibaba/open-code-review)、[发布记录](https://github.com/alibaba/open-code-review/releases)。先选定目标版本，不在用户的一次审查任务中自动安装最新版。

### 需要检查的变化

| 上游变化 | 本仓库需要核查的位置 |
| --- | --- |
| 命令、参数、默认值或退出码变化 | `lib/arguments.js`、`lib/runner.js`；特别是 `--from` / `--to` / `--commit`、路径分隔 `--`。 |
| 委托 JSON schema 或字段变化 | `parseResult()` 与工具输出；不兼容版本应明确失败，不能把解析失败解释为无问题。 |
| 文件筛选、重命名、删除、排除规则变化 | 集成测试与 Skill 的完整覆盖清单。包括 staged / unstaged / untracked 和未产生首个提交的仓库。 |
| 规则来源或历史提交语义变化 | `ocr_rules` 的参数传递、规则分组，以及 README / Skill 的说明。当前规则文件来自当前检出版本。 |
| npm 平台包名、二进制路径或平台支持变化 | `packagedBinary()`、optional dependencies；确认仍可直接调用原生程序。 |
| 独立模型配置、环境变量、会话目录变化 | 可选完整模式、`forwardEnv`、沙箱写权限及超时。不要自动复制 DSH 模型凭据。 |
| 自动更新、下载或遥测行为变化 | 核对新版本原生程序实际行为；不能仅假设绕过 npm 启动器就排除了未来新增的副作用。 |

### 修改与验证步骤

1. 在开发分支选择一个具体 OCR 版本，保持精确依赖。例如在 Bash 中设置实际目标后运行：

   ```sh
   OCR_TARGET=填入已核对的版本号
   npm install --save-exact "@alibaba-group/open-code-review@$OCR_TARGET" --ignore-scripts
   ```

2. 同步更新 `package-lock.json`。当前 `scripts/check-package.js` 也硬编码了 OCR `1.12.10` 的断言，必须同步更新或改为统一的版本基线；不能删掉检查来掩盖版本差异。
3. 按上表调整适配代码及有意义的行为测试。若 schema 变化，先决定是否明确迁移到新协议；不要盲目接受任意 JSON。
4. 更新 `NOTICE` 中的上游版本/来源，以及 README、本文的兼容表和验证报告。
5. 运行检查及跨平台 CI，并在隔离的 DSH profile 中安装新 tarball、实际调用、卸载。独立模型相关变化另行进行经授权的小范围在线验证，报告其模型/配置与限制，不在日志中记录密钥。
6. 发布新的插件版本，保留旧 Release，最后才更新生产环境。

`ocrPath` 只适合明确指定、单独验证的原生程序，不是永久绕过依赖锁定的升级通道。必须知道它的版本；不能填 shell 命令、JS 启动器或 `.cmd` 文件。

## 5. DSH 升级的维护流程

上游：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)、[插件开发文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)。

**先验证新内核，再更新日常环境。**当前 DSH 服务 peers 为 `0.1.7-rc.2 || 0.2.0-rc.2`。`engines.dsh` 写得更宽不代表新内核已兼容：DSH 的插件准入检查会读取对应服务的 peer 声明。`optional` peer 也不代表可以忽略 Host 的版本准入检查。

| 接口边界 | 必须验证的契约 |
| --- | --- |
| Bundle / Cordis Loader | `dsh.bundle.patch`、patch 合成顺序、插件 named exports、服务注入与 Config 默认值。 |
| 工具 | `defineTool`、参数/输出 schema、`execute(args, exec)`、错误结果及并发调度约定。 |
| 会话、preset、工具呈现 | `exec.agent.session.header.cwd`、工具继承/过滤、native / PTC 呈现和现有 agent 的刷新行为。 |
| Skill | `ctx.skills.register()` 的目录、作用域、可调用性，以及会话是否提供 Skill 加载工具。 |
| 进程 | `spawn()`、`done`、输出读取、截断判断、`terminate()`、`waitForExit()` 与子进程退出范围。 |
| 沙箱与审批 | `sandboxPolicy.resolve()`、`sandbox.confine()`、单次审批及拒绝/runner 故障的识别。 |
| 生命周期 | `ctx.effect()` 释放顺序；卸载先取消并等待在途调用，再撤销工具和 Skill。 |
| 包解析 | Host 共享依赖与开发依赖的解析，避免安装出第二套 Cordis/工具服务实例。 |

适配步骤：

1. 记录旧内核版本和安装方式，保留可恢复的内核、profile 与必要的应用数据备份。
2. 另行安装/选择目标内核，使用隔离的 `DSH_HOME` 测试；仅创建新 profile 并不能保证与日常环境的凭据/数据完全隔离。不要修改 `HOME` 来实现隔离。
3. 根据目标内核实际发布的包更新所有相关 DSH peers 和开发测试依赖；独立版本的 Cordis、Schemastery、Loader 需要分别核对，不能机械改成 DSH 版本号。
4. 预发布版本遵循 SemVer 的专门匹配规则。若要兼容多个 prerelease 系列，按已验证版本声明明确范围或 `||` 分支；不要认为一个很宽的版本区间一定包含未来所有 `-rc`。
5. 按上表调整代码和必要的测试，再做完整 Host 启动、会话可见性、预览/规则、取消、超时、卸载、沙箱拒绝和旧版本回归验证。
6. 只把实际验证过的组合写入兼容表并发布新插件。跨 DSH 大版本的破坏性适配，应保留旧版本可安装，而不是覆盖原 Release 资产。

插件 `0.1.1` 已针对 DSH `0.2.0-rc.2` 适配，保留 `0.1.7-rc.2` 支持；不承诺整个 `0.2` 系列自动兼容。不要把 `allow-version`、强制安装或关闭沙箱当作兼容性修复；它们不能改变真实的接口契约。

### 0.2.0-rc.2 兼容更新记录（2026-09-30）

- 实际 web 内核与 CLI 均为 `0.2.0-rc.2`。旧插件 `0.1.0` 在运行中返回 `incompatible-version`，五项 DSH 服务 peer 仅允许 `0.1.7-rc.2`，因此未加载。
- 核对目标内核发布产物后，`dsh-tools`、`dsh-skill`、`dsh-subprocess`、`dsh-sandbox`、`dsh-sandbox-policy` 的 `lib` 与旧内核完全一致；Cordis `4.0.4`、Schemastery `3.18.4` 保持一致。本次保留原生 bundle + tools + Skill 接入及执行实现。
- `0.1.1` 将 DSH peers 和 `engines.dsh` 改为明确的双版本 `||` 声明，将默认开发依赖与锁文件更新到 `0.2.0-rc.2`，OCR 仍固定为 `1.12.10`。
- CI 增加两个 DSH 内核 × Linux / macOS / Windows 的六种组合。集成测试校验实际加载的服务版本，防止只修改测试标签却仍测到旧依赖。
- DSH 的版本 guard 根据 `@deepseek-ai/dsh-*` peers 判断准入；`optional` 或只放宽 `engines.dsh` 不会解决拒绝加载。本次不需要版本豁免。

验证结果与范围见 [VALIDATION.md](VALIDATION.md)。旧 `v0.1.0` 仅用于匹配的旧内核；`0.2.0-rc.2` 应安装 `v0.1.1` 或后续明确支持该内核的版本。

## 6. 如果 DSH 的接入方式发生变化

以下是维护时的选择标准，**不是当前已经实现的其他适配器**：

| 情况 | 建议处理 |
| --- | --- |
| 仍支持原生 bundle，只变更服务 API | 继续原生接入，修改 `lib/index.js` / `lib/runner.js`，保留用户侧工具名和 Skill 名。 |
| Host 注册迁移到 agent/preset 作用域 | 按新文档移动注册位置，验证每个 preset 的继承和卸载，防止重复工具及跨会话状态泄漏；不要覆盖用户整个 preset。 |
| Skill API 改变、工具 API 仍稳定 | 单独迁移 Skill 的发现/注册和调用方式，保留确定性工具能力，并同步更新调用示例。 |
| 官方提供适合该场景的 MCP 接入，或需同时支持其他 agent | 可新建 MCP 适配层复用参数构建/结果解析逻辑。另行设计进程管理、沙箱、审批、凭据和部署；当前插件并不是 MCP server。 |
| 只能通过 Skill + Shell 调用 CLI | 可设计独立的降级接入，但需说明依赖安装、命令执行审批和能力差异；不能声称保留了原生工具的生命周期保证。 |
| DSH 切换到远程/容器执行 | 必须在实际执行环境部署对应 OS/架构的 OCR，并按远程服务契约处理仓库路径、凭据和输出；本机绝对二进制路径不能直接沿用。 |

迁移前写明支持/失去的能力、旧配置迁移方法和回滚入口。用户 profile 的后置覆盖优先级可能高于 bundle；排查时同时看最终合成配置，避免插件升级后仍被旧覆盖遮蔽。

## 7. 验证、发布与市场维护

在插件源码目录执行：

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:integration
npm pack --ignore-scripts
```

CI 必须覆盖目标平台。沙箱不可用应明确报错，不能为让测试通过而绕过沙箱。再用目标 DSH 内核在隔离环境安装打包产物，确认从包内依赖解析到 OCR，而非碰巧调用了全局安装。

发布时：

1. 更新插件版本、锁文件、兼容说明和验证报告，创建新的 Git tag 与 GitHub Release。
2. `npm pack` 通常生成带版本号的文件；上传 Release 时保留一个固定资产名 **`dsh-open-code-review.tgz`**，同时提供源码包和 SHA-256 校验值。将同一份已验证 tarball 发布到 npm，核对 registry 上的版本、`latest` 和内容；不能覆盖已发布版本。
3. 发布后实际下载并核对两个渠道的资产，检查安装入口。不要覆盖已发布版本的 tarball 来偷偷升级 OCR。
4. 市场条目的稳定地址是 `releases/latest/download/dsh-open-code-review.tgz`。保持固定资产名，避免下一次发版后下载 404。
5. URL、仓库、分类或功能描述发生变化时，向 [awesome-dsh-plugin 目录](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 更新本插件对应的一份 YAML；不手改其生成的 README。dsh-market 是展示/管理入口，目录合并与插件发布是不同步骤。
6. 核对市场实际刷新和安装结果；不会因为创建了 Release 或 npm 版本就保证所有本机安装已自动更新。此前按 Release URL 安装的 profile 若需立即转为 npm 来源，按第 3 节执行一次同版本按包名安装。

只补充本文等仓库文档，不改变运行代码和安装包时，可直接提交文档，不必覆盖已有 Release。本文件从 GitHub 仓库阅读；历史 Release 安装包不会因仓库文档更新而改变。

## 8. 回滚与常见问题

回滚插件可重新安装一个与目标内核匹配的已验证 npm 版本或带 tag 的 Release URL，例如旧内核可使用历史 `v0.1.0` Release，再按 Host 提示重载。如果同时升级了 DSH，需要先恢复与旧插件匹配的内核；旧插件不一定能在新内核上运行。

内核升级可能涉及应用数据格式迁移。回退前遵循该版本的官方迁移说明，必要时恢复升级前的数据备份；仅恢复插件 manifest 不能回退整个 DSH 环境。不要在服务仍写入配置时用旧备份覆盖整个 profile。

| 现象 | 检查方向 |
| --- | --- |
| 已安装但插件未启用 | 实际 `DSH_HOME` / profile、bundle 选择、最终合成配置。 |
| 插件 active，但会话里找不到能力 | 新建会话，检查 preset/工具过滤、Skill 消费插件；PTC 模式下工具可能通过 `run_code` 呈现。 |
| DSH 升级后拒绝加载 | peer 版本准入与真实 API 兼容性，选择匹配的插件版本。 |
| Missing OCR native dependency | 可选依赖是否被跳过、OS/架构与原生包路径是否匹配。 |
| OCR JSON / schema 错误 | 上游版本和协议是否变化、输出是否混入日志或被截断。 |
| 沙箱拒绝、审批不可用 | 文件位置、会话权限和 Host 的审批服务；通过正常审批解决，不改成无沙箱执行。 |
| 切换 OCR 版本后行为没变 | 是否配置了 `ocrPath`；是否仍在旧 profile / 旧 agent；是否实际上只更新了全局 OCR。 |
| latest URL 安装后版本没变 | 改用明确的 npm 版本或目标 Release 的带 tag URL，再核对实际安装版本和服务加载状态。 |

提交问题时提供插件/DSH/OCR/Node 版本、平台、安装来源、最小复现及经脱敏的错误。不要上传 API Key、登录 URL、Cookie、完整用户配置或私有代码。
